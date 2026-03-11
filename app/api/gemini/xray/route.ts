import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { validationError } from "@/lib/api-response";
import { extractJsonFromText, generateGeminiContent } from "@/lib/gemini";
import { callGrokWithFallback } from "@/lib/grok";
import { sanitizeForPrompt } from "@/lib/helpers";
import { prisma } from "@/lib/prisma";
import { buildRCSEstimationPrompt, calculateRCS } from "@/lib/rcs";
import { xrayRequestSchema } from "@/lib/validation";

interface XrayResult {
  verdict: "Excelente" | "Aceitável" | "Evitar";
  abundanceIndex: number;
  redFlags: string[];
  realExperience: string;
  executiveSummary: string;
}

function makeCacheKey(userId: string, hotelName: string, destination: string): string {
  return `${userId}:${hotelName.toLowerCase().trim()}:${destination.toLowerCase().trim()}`;
}

function defaultXray(hotelName: string): XrayResult {
  return {
    verdict: "Aceitável",
    abundanceIndex: 62,
    redFlags: ["Dados insuficientes para validar padrões de manutenção."],
    realExperience: `A experiência em ${hotelName} pode ser agradável, mas com incerteza operacional em horários de pico.`,
    executiveSummary: "Análise preventiva sem dados de fontes suficientes.",
  };
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth_required", login_url: "/login" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = xrayRequestSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return validationError(parsedPayload.error.flatten());
  }

  const { hotelName: rawHotel, destination: rawDest, reviews: rawReviews = [], tripId } = parsedPayload.data;
  const hotelName = sanitizeForPrompt(rawHotel, 100);
  const destination = sanitizeForPrompt(rawDest, 100);
  const reviews = rawReviews.map((r) => sanitizeForPrompt(r, 500));
  const cachedKey = makeCacheKey(session.user.id, hotelName, destination);

  // Verify trip ownership if tripId provided
  if (tripId) {
    const ownerCheck = await prisma.trip.findFirst({ where: { id: tripId, deletedAt: null }, select: { userId: true } });
    if (!ownerCheck || ownerCheck.userId !== session.user.id) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }
  }

  const cachedAnalysis = await prisma.hotelAnalysis.findUnique({
    where: {
      cachedKey,
    },
  });

  if (cachedAnalysis) {
    return NextResponse.json({
      analysis: {
        verdict: cachedAnalysis.verdict,
        abundanceIndex: cachedAnalysis.abundanceIndex,
        redFlags: cachedAnalysis.redFlags,
        realExperience: cachedAnalysis.realExperience,
        executiveSummary: cachedAnalysis.rawResponse,
      },
      cached: true,
      createdAt: cachedAnalysis.createdAt,
    });
  }

  // ═══ HYBRID: Grok-4 (primary — céptico, X complaints) + Gemini 2.5 Pro (secondary — structured data) ═══

  const outputSpec = `Responde APENAS em JSON válido:
{
  "verdict": "Excelente" | "Aceitável" | "Evitar",
  "abundanceIndex": number (0-100),
  "redFlags": string[],
  "realExperience": string,
  "executiveSummary": string,
  "rcsPillars": {"hardware": number, "service": number, "hygiene": number, "location": number},
  "designations": string[]
}`;

  const grokSystemPrompt = `Tu és o Detetive de Hospitalidade — céptico brutal, direto, PT-PT. Fazes Raio-X a hotéis. Snifas queixas reais do X/redes sociais, reviews falsas, taxas escondidas, ruído, limpeza duvidosa. Padrão de referência: Caraíbas (fartura, zero fricção).`;

  const grokUserPrompt = `Faz Raio-X profundo a este hotel:
Hotel: ${hotelName}
Destino: ${destination}
Reviews: ${reviews.length ? reviews.join("; ") : "Sem reviews, usa heurística conservadora."}

${buildRCSEstimationPrompt(hotelName, destination)}

${outputSpec}`;

  const fallback = defaultXray(hotelName);

  // Step 1: Try Grok-4 first (primary brain — sniffs X, céptico tone)
  const grokResult = await callGrokWithFallback(grokSystemPrompt, grokUserPrompt, {
    temperature: 0.55,
    fallbackText: "",
  });

  let analysisText: string;
  let usedGrok = false;

  if (grokResult.usedGrok && grokResult.text.trim()) {
    analysisText = grokResult.text;
    usedGrok = true;
  } else {
    // Step 2: Fallback to Gemini 2.5 Pro (structured data, grounding)
    const geminiPrompt = `<persona>Detetive de Hospitalidade, objetivo e clínico, PT-PT.</persona>
<benchmark>Padrão das Caraíbas: fartura, energia, zero fricção.</benchmark>
<input>Hotel: ${hotelName}\nDestino: ${destination}\nReviews: ${reviews.length ? reviews.join("; ") : "Sem reviews, heurística conservadora."}</input>
${buildRCSEstimationPrompt(hotelName, destination)}
<output>${outputSpec}</output>`;

    const gemini = await generateGeminiContent(geminiPrompt, {
      temperature: 0.55,
      fallbackText: JSON.stringify(fallback),
    });
    analysisText = gemini.text;
  }

  const analysis = extractJsonFromText<XrayResult>(analysisText, fallback);
  analysis.abundanceIndex = Math.max(0, Math.min(100, Math.round(analysis.abundanceIndex)));

  // Calculate RCS from pillar scores
  const analysisRaw = analysis as unknown as Record<string, unknown>;
  const rawPillars = analysisRaw.rcsPillars as Record<string, number> | undefined;
  const designations = analysisRaw.designations as string[] | undefined;
  const rcsPillars = {
    hardware: rawPillars?.hardware ?? 5,
    service: rawPillars?.service ?? 5,
    hygiene: rawPillars?.hygiene ?? 5,
    location: rawPillars?.location ?? 5,
  };
  const rcsResult = calculateRCS(rcsPillars, undefined, designations);

  const enrichedResults = {
    ...analysis,
    rcs: rcsResult.rcs,
    rcsStars: rcsResult.stars,
    rcsLabel: rcsResult.label,
    rcsEmoji: rcsResult.emoji,
    rcsPillars: rcsResult.pillarScores,
    rcsModifiers: rcsResult.modifiersApplied,
    usedFallback: !usedGrok,
    usedGrok,
  };

  const trip = await prisma.tripSearch.create({
    data: {
      userId: session.user.id,
      destination,
      queryType: "XRAY",
      queryPayload: { hotelName, reviews } as unknown as Prisma.JsonObject,
      results: enrichedResults as unknown as Prisma.JsonObject,
      ...(tripId ? { tripId } : {}),
    },
  });

  await prisma.hotelAnalysis.create({
    data: {
      userId: session.user.id,
      tripSearchId: trip.id,
      hotelName,
      destination,
      verdict: analysis.verdict,
      abundanceIndex: analysis.abundanceIndex,
      redFlags: analysis.redFlags,
      realExperience: analysis.realExperience,
      rawResponse: analysis.executiveSummary,
      cachedKey,
    },
  });

  return NextResponse.json({
    analysis: enrichedResults,
    cached: false,
    usedGrok,
    usedFallback: !usedGrok,
  });
}
