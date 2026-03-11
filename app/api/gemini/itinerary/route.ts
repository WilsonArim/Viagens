import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { validationError } from "@/lib/api-response";
import { extractJsonFromText, generateGeminiContent } from "@/lib/gemini";
import { callGrokWithFallback } from "@/lib/grok";
import { sanitizeForPrompt } from "@/lib/helpers";
import { geocodeQueries } from "@/lib/maps/nominatim";
import { prisma } from "@/lib/prisma";
import { itineraryRequestSchema } from "@/lib/validation";

interface ItineraryMapPoint {
  period: "morning" | "lunch" | "afternoon";
  name: string;
  query: string;
  lat?: number | null;
  lng?: number | null;
}

interface ItineraryDay {
  day: number;
  morning: string;
  lunch: string;
  afternoon: string;
  detectiveNote: string;
  walkingKm?: number;
  mapPoints?: ItineraryMapPoint[];
}

interface ItineraryResult {
  days: ItineraryDay[];
  globalNote: string;
  paceWarning?: string | null;
}

function buildFallbackItinerary(destination: string, days: number): ItineraryResult {
  return {
    days: Array.from({ length: days }).map((_, idx) => ({
      day: idx + 1,
      morning: `Passeio cultural discreto em ${destination}.`,
      lunch: "Restaurante local sem menu turístico.",
      afternoon: "Atividade prática alinhada com interesses da família.",
      detectiveNote: "Evita horários de pico e zonas de alto tráfego turístico.",
      walkingKm: 4,
      mapPoints: [
        { period: "morning", name: "Ponto cultural local", query: `${destination} centro histórico` },
        { period: "lunch", name: "Restaurante local", query: `${destination} restaurante tradicional` },
        { period: "afternoon", name: "Atividade imersiva", query: `${destination} atividade cultural local` },
      ],
    })),
    globalNote: "Roteiro gerado em modo de contingência por ausência de resposta da IA.",
  };
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required", login_url: "/login" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = itineraryRequestSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return validationError(parsedPayload.error.flatten());
  }

  const { destination: rawDest, days, startDate, tripId } = parsedPayload.data;
  const destination = sanitizeForPrompt(rawDest, 100);

  // Verify trip ownership if tripId provided
  if (tripId) {
    const ownerCheck = await prisma.trip.findFirst({ where: { id: tripId, deletedAt: null }, select: { userId: true } });
    if (!ownerCheck || ownerCheck.userId !== session.user.id) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }
  }

  const profile = await prisma.familyProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    include: {
      members: true,
    },
  });

  const profileSummary = profile
    ? {
      budget: profile.generalBudget,
      pace: profile.travelPace,
      dietary: profile.dietaryRestrictions,
      members: profile.members.map((m) => ({ name: m.name, age: m.age, hobbies: m.hobbies, interests: m.interests })),
    }
    : { warning: "perfil ainda não configurado" };

  const paceRules = profile?.travelPace === "slow"
    ? `- Ritmo LENTO: máximo 2 atividades por dia. Sesta obrigatória (14h-16h). Sem correria.
- Se detectares roteiro apertado, adiciona paceWarning a explicar.`
    : profile?.travelPace === "fast"
      ? `- Ritmo DINÂMICO: pode incluir 4+ atividades por dia. Energia alta, aproveitar ao máximo.`
      : `- Ritmo EQUILIBRADO: 3 atividades por dia, tempo livre entre elas.`;

  const prompt = `
<role>
Você é o Arquiteto de Culturas, em PT-PT, focado em experiências autênticas e logística realista.
</role>

<context>
Destino: ${destination}
Dias: ${days}
Data inicial: ${startDate ?? "não especificada"}
Perfil Familiar: ${JSON.stringify(profileSummary)}
</context>

<rules>
- Evitar turismo de massas
- Incluir manhã, almoço, tarde e nota de detetive por dia
- Estimar quilómetros a pé por dia (walkingKm)
${paceRules}
- Se houver membros com idade <6 ou >65, reduzir distâncias e adicionar warnings
</rules>

<output>
Responde APENAS em JSON válido:
{
  "days": [
    {
      "day": 1,
      "morning": "...",
      "lunch": "...",
      "afternoon": "...",
      "detectiveNote": "...",
      "walkingKm": 3.5,
      "mapPoints": [
        {
          "period": "morning" | "lunch" | "afternoon",
          "name": "nome curto do local",
          "query": "query clara para geocoding OSM (bairro + cidade)",
          "lat": number | null,
          "lng": number | null
        }
      ]
    }
  ],
  "globalNote": "...",
  "paceWarning": "..." (ou null se tudo OK)
}
</output>
`;

  const fallback = buildFallbackItinerary(destination, days);

  // ═══ HYBRID: Grok-4 (primary — Arquiteto céptico, anti-massas) + Gemini 2.5 Pro (fallback — structured data) ═══

  const grokSystemPrompt = `Tu és o Arquiteto de Culturas — céptico, direto, PT-PT. Crias roteiros anti-massas com logística realista. Nunca geras roteiros irreais (ex: 18 km a pé com criança de 6 anos). Prioridade: conforto real > experiência autêntica > preço.`;

  const grokUserPrompt = `Cria roteiro detalhado:
Destino: ${destination}
Dias: ${days}
Data inicial: ${startDate ?? "não especificada"}
Perfil Familiar: ${JSON.stringify(profileSummary)}

${paceRules}

${prompt.match(/<rules>[\s\S]*<\/rules>/)?.[0] ?? ""}

${prompt.match(/<output>[\s\S]*<\/output>/)?.[0] ?? ""}`;

  // Step 1: Try Grok-4 first (primary brain — céptico, anti-massas)
  const grokResult = await callGrokWithFallback(grokSystemPrompt, grokUserPrompt, {
    temperature: 0.8,
    fallbackText: "",
  });

  let resultText: string;
  let usedGrok = false;

  if (grokResult.usedGrok && grokResult.text.trim()) {
    resultText = grokResult.text;
    usedGrok = true;
  } else {
    // Step 2: Fallback to Gemini 2.5 Pro (structured data, grounding)
    const gemini = await generateGeminiContent(prompt, {
      temperature: 0.8,
      fallbackText: JSON.stringify(fallback),
    });
    resultText = gemini.text;
  }

  const itinerary = extractJsonFromText<ItineraryResult>(resultText, fallback);

  itinerary.days = itinerary.days.map((day, index) => {
    if (Array.isArray(day.mapPoints) && day.mapPoints.length > 0) {
      return day;
    }

    return {
      ...day,
      day: day.day ?? index + 1,
      mapPoints: [
        {
          period: "morning",
          name: `Manhã do Dia ${day.day ?? index + 1}`,
          query: `${day.morning}, ${destination}`,
        },
        {
          period: "lunch",
          name: `Almoço do Dia ${day.day ?? index + 1}`,
          query: `${day.lunch}, ${destination}`,
        },
        {
          period: "afternoon",
          name: `Tarde do Dia ${day.day ?? index + 1}`,
          query: `${day.afternoon}, ${destination}`,
        },
      ],
    };
  });

  const geoQueries = itinerary.days.flatMap((day) =>
    (day.mapPoints ?? []).map((point) => point.query).filter(Boolean),
  );
  const geocodedPoints = await geocodeQueries(geoQueries, { maxQueries: 18 });
  const geocodedByQuery = new Map(
    geocodedPoints.map((point) => [point.query.trim().toLowerCase(), point]),
  );

  itinerary.days = itinerary.days.map((day) => ({
    ...day,
    mapPoints: (day.mapPoints ?? []).map((point) => {
      if (point.lat != null && point.lng != null) {
        return point;
      }

      const match = geocodedByQuery.get(point.query.trim().toLowerCase());
      if (!match) {
        return point;
      }

      return {
        ...point,
        lat: match.lat,
        lng: match.lng,
      };
    }),
  }));

  await prisma.tripSearch.create({
    data: {
      userId: session.user.id,
      destination,
      queryType: "ITINERARY",
      queryPayload: { days, startDate } as unknown as Prisma.JsonObject,
      results: itinerary as unknown as Prisma.JsonObject,
      ...(tripId ? { tripId } : {}),
    },
  });

  return NextResponse.json({
    itinerary,
    usedGrok,
    usedFallback: !usedGrok,
  });
}
