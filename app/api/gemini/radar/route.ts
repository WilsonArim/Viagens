import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { validationError } from "@/lib/api-response";
import { extractJsonFromText, generateGeminiContent } from "@/lib/gemini";
import { callGrokWithFallback } from "@/lib/grok";
import { sanitizeForPrompt } from "@/lib/helpers";
import { geocodeQueries } from "@/lib/maps/nominatim";
import { prisma } from "@/lib/prisma";
import { radarRequestSchema } from "@/lib/validation";

interface RadarAlert {
  category: string;
  risk: "low" | "medium" | "high";
  title: string;
  description: string;
  pivoting: string;
  sourceHints?: string[];
  locationHint?: string;
  lat?: number | null;
  lng?: number | null;
}

interface RadarResult {
  summary: string;
  alerts: RadarAlert[];
}

function fallbackRadar(destination: string): RadarResult {
  return {
    summary: `Radar em modo preventivo para ${destination}. Dados em tempo real indisponíveis.`,
    alerts: [
      {
        category: "Infraestrutura",
        risk: "medium",
        title: "Dados limitados",
        description: "Fontes de informação em tempo real temporariamente indisponíveis.",
        pivoting: "Consulte fontes locais ou embaixada antes de viajar.",
      },
    ],
  };
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required", login_url: "/login" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = radarRequestSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return validationError(parsedPayload.error.flatten());
  }

  const { destination: rawDest, tripId } = parsedPayload.data;
  const destination = sanitizeForPrompt(rawDest, 100);

  // Verify trip ownership if tripId provided
  if (tripId) {
    const trip = await prisma.trip.findFirst({ where: { id: tripId, deletedAt: null }, select: { userId: true } });
    if (!trip || trip.userId !== session.user.id) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }
  }

  // ═══ HYBRID: Grok-4 (primary — native X pipeline, buzz fresco) ═══

  const outputSpec = `Responde APENAS em JSON válido:
{
  "summary": "...",
  "alerts": [
    {
      "category": "Segurança" | "Infraestrutura" | "Eventos" | "Elogios",
      "risk": "low" | "medium" | "high",
      "title": "...",
      "description": "...",
      "pivoting": "...",
      "sourceHints": ["https://..."],
      "locationHint": "bairro/rua/zona afetada",
      "lat": number | null,
      "lng": number | null
    }
  ]
}`;

  const grokSystemPrompt = `Tu és a Sentinela de Viagens — snifas o X, redes sociais e notícias em tempo real. Procuras alertas de segurança, greves, preços a subir, queixas frescas, eventos recentes. PT-PT, direto e sem filtro. Pipeline nativo com X — tens acesso ao buzz fresco e desabafos reais dos viajantes.`;

  const grokUserPrompt = `Escaneia ${destination} na última semana. Quero alertas reais: segurança, infraestrutura, eventos, elogios. Usa dados frescos do X e redes sociais.\n\n${outputSpec}`;

  const fallback = fallbackRadar(destination);

  // Step 1: Grok-4 primary (native X pipeline — buzz fresco, desabafos)
  const grokResult = await callGrokWithFallback(grokSystemPrompt, grokUserPrompt, {
    temperature: 0.8,
    fallbackText: "",
  });

  let radarText: string;
  let usedGrok = false;

  if (grokResult.usedGrok && grokResult.text.trim()) {
    radarText = grokResult.text;
    usedGrok = true;
  } else {
    // Fallback: Gemini with Google Search grounding
    const geminiPrompt = `<instruction>Sentinela de Viagens. Última semana. PT-PT.</instruction>
<destination>${destination}</destination>
<requirements>Categorias: Segurança, Infraestrutura, Eventos, Elogios. Marcar riscos. Incluir pivoting.</requirements>
<output>${outputSpec}</output>`;

    const gemini = await generateGeminiContent(geminiPrompt, {
      temperature: 1.0,
      useGoogleSearch: true,
      fallbackText: JSON.stringify(fallback),
    });
    radarText = gemini.text;
  }

  const radar = extractJsonFromText<RadarResult>(radarText, fallback);

  const geoQueries = radar.alerts
    .map((alert) => alert.locationHint?.trim() || `${alert.title} ${destination}`.trim())
    .filter(Boolean);
  const geocodedAlerts = await geocodeQueries(geoQueries, { maxQueries: 12 });
  const geocodedByQuery = new Map(
    geocodedAlerts.map((item) => [item.query.trim().toLowerCase(), item]),
  );

  const enrichedRadar: RadarResult = {
    ...radar,
    alerts: radar.alerts.map((alert) => {
      if (alert.lat != null && alert.lng != null) {
        return alert;
      }

      const query = (alert.locationHint?.trim() || `${alert.title} ${destination}`.trim()).toLowerCase();
      const match = geocodedByQuery.get(query);

      if (!match) {
        return alert;
      }

      return {
        ...alert,
        lat: match.lat,
        lng: match.lng,
      };
    }),
  };

  await prisma.tripSearch.create({
    data: {
      userId: session.user.id,
      destination,
      queryType: "RADAR",
      queryPayload: {} as unknown as Prisma.JsonObject,
      results: { ...enrichedRadar, usedGrok } as unknown as Prisma.JsonObject,
      ...(tripId ? { tripId } : {}),
    },
  });

  return NextResponse.json({
    radar: enrichedRadar,
    usedGrok,
    usedFallback: !usedGrok,
  });
}
