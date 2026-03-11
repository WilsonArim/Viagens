import { getServerAuthSession } from "@/lib/auth";
import { extractJsonFromText, generateGeminiContent } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import {
  agencyReputationSchema,
  itineraryRequestSchema,
  radarRequestSchema,
  tripHistorySchema,
  webmcpToolNameSchema,
  xrayRequestSchema,
} from "@/lib/validation";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

type ToolName = z.infer<typeof webmcpToolNameSchema>;

type ToolError = {
  error: string;
  details?: unknown;
  login_url?: string;
};

type ToolResult = ToolError | Record<string, unknown>;

function validationError(error: z.ZodError): ToolError {
  return {
    error: "validation_error",
    details: error.flatten(),
  };
}

function sanitizeInput(value: string, maxLength = 200): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, maxLength)
    .trim();
}

export async function executeWebMCPTool(
  toolName: ToolName,
  input: unknown,
): Promise<ToolResult> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return {
      error: "auth_required",
      login_url: "/login",
    };
  }

  const userId = session.user.id;

  if (toolName === "get_user_preferences") {
    const profile = await prisma.familyProfile.findUnique({
      where: { userId },
      include: { members: { orderBy: { createdAt: "asc" } } },
    });

    return { profile };
  }

  if (toolName === "analyze_hotel") {
    const parsed = xrayRequestSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const { hotelName, destination, reviews = [] } = parsed.data;
    const safeHotel = sanitizeInput(hotelName, 100);
    const safeDest = sanitizeInput(destination, 100);
    const cachedKey = `${userId}:${safeHotel.toLowerCase()}:${safeDest.toLowerCase()}`;

    const cached = await prisma.hotelAnalysis.findUnique({ where: { cachedKey } });
    if (cached) {
      return {
        analysis: {
          verdict: cached.verdict,
          abundanceIndex: cached.abundanceIndex,
          redFlags: cached.redFlags,
          realExperience: cached.realExperience,
          executiveSummary: cached.rawResponse,
        },
        cached: true,
      };
    }

    const safeReviews = reviews.map((r) => sanitizeInput(r, 500));
    const prompt = `<persona>Você é o Detetive de Hospitalidade, objetivo e clínico, em PT-PT.</persona>
<benchmark>Padrão das Caraíbas: fartura, energia impecável, zero fricção operacional.</benchmark>
<input>Hotel: ${safeHotel}\nDestino: ${safeDest}\nReviews:\n${safeReviews.length ? safeReviews.map((r, i) => `${i + 1}. ${r}`).join("\n") : "Sem reviews fornecidas, use heurística conservadora."}</input>
<output>Responde APENAS em JSON válido com as chaves: {"verdict":"Excelente"|"Aceitável"|"Evitar","abundanceIndex":number,"redFlags":string[],"realExperience":string,"executiveSummary":string}</output>`;

    const fallback = {
      verdict: "Aceitável" as const,
      abundanceIndex: 62,
      redFlags: ["Dados insuficientes para validar padrões de manutenção."],
      realExperience: `A experiência em ${safeHotel} pode ser agradável, mas com incerteza operacional.`,
      executiveSummary: "Análise preventiva sem dados de fontes suficientes.",
    };

    const gemini = await generateGeminiContent(prompt, { temperature: 0.55, fallbackText: JSON.stringify(fallback) });
    const analysis = extractJsonFromText(gemini.text, fallback);
    analysis.abundanceIndex = Math.max(0, Math.min(100, Math.round(analysis.abundanceIndex)));

    const trip = await prisma.tripSearch.create({
      data: {
        userId,
        destination: safeDest,
        queryType: "XRAY",
        queryPayload: { hotelName: safeHotel, reviews: safeReviews } as unknown as Prisma.JsonObject,
        results: { ...analysis, usedFallback: gemini.usedFallback } as unknown as Prisma.JsonObject,
      },
    });

    await prisma.hotelAnalysis.create({
      data: {
        userId,
        tripSearchId: trip.id,
        hotelName: safeHotel,
        destination: safeDest,
        verdict: analysis.verdict,
        abundanceIndex: analysis.abundanceIndex,
        redFlags: analysis.redFlags,
        realExperience: analysis.realExperience,
        rawResponse: analysis.executiveSummary,
        cachedKey,
      },
    });

    return { analysis, cached: false, usedFallback: gemini.usedFallback };
  }

  if (toolName === "generate_itinerary") {
    const parsed = itineraryRequestSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const { destination, days, startDate } = parsed.data;
    const safeDest = sanitizeInput(destination, 100);

    const profile = await prisma.familyProfile.findUnique({
      where: { userId },
      include: { members: true },
    });

    const profileSummary = profile
      ? {
        budget: profile.generalBudget,
        pace: profile.travelPace,
        dietary: profile.dietaryRestrictions,
        members: profile.members.map((m) => ({ name: m.name, age: m.age, hobbies: m.hobbies, interests: m.interests })),
      }
      : { warning: "perfil ainda não configurado" };

    const prompt = `<role>Você é o Arquiteto de Culturas, em PT-PT, focado em experiências autênticas.</role>
<context>Destino: ${safeDest}\nDias: ${days}\nData inicial: ${startDate ?? "não especificada"}\nPerfil: ${JSON.stringify(profileSummary)}</context>
<rules>- Evitar turismo de massas\n- Incluir manhã, almoço, tarde e nota de detetive por dia\n- Ajustar para interesses da família</rules>
<output>Responde APENAS em JSON válido: {"days":[{"day":1,"morning":"...","lunch":"...","afternoon":"...","detectiveNote":"..."}],"globalNote":"..."}</output>`;

    const fallback = {
      days: Array.from({ length: days }).map((_, i) => ({
        day: i + 1,
        morning: `Passeio cultural discreto em ${safeDest}.`,
        lunch: "Restaurante local sem menu turístico.",
        afternoon: "Atividade prática alinhada com interesses da família.",
        detectiveNote: "Evita horários de pico e zonas turísticas.",
      })),
      globalNote: "Roteiro gerado em modo de contingência.",
    };

    const gemini = await generateGeminiContent(prompt, { temperature: 0.8, fallbackText: JSON.stringify(fallback) });
    const itinerary = extractJsonFromText(gemini.text, fallback);

    await prisma.tripSearch.create({
      data: {
        userId,
        destination: safeDest,
        queryType: "ITINERARY",
        queryPayload: { days, startDate } as unknown as Prisma.JsonObject,
        results: itinerary as unknown as Prisma.JsonObject,
      },
    });

    return { itinerary, usedFallback: gemini.usedFallback };
  }

  if (toolName === "get_travel_radar") {
    const parsed = radarRequestSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const safeDest = sanitizeInput(parsed.data.destination, 100);

    const prompt = `<instruction>Você é a Sentinela de Viagens. Trabalha com dados da última semana em PT-PT.</instruction>
<destination>${safeDest}</destination>
<requirements>- Categorias: Segurança, Infraestrutura, Eventos, Elogios\n- Marcar riscos médios/altos com clareza\n- Incluir pivoting</requirements>
<output>Responde APENAS em JSON válido: {"summary":"...","alerts":[{"category":"Segurança"|"Infraestrutura"|"Eventos"|"Elogios","risk":"low"|"medium"|"high","title":"...","description":"...","pivoting":"...","sourceHints":["https://..."]}]}</output>`;

    const fallback = {
      summary: `Monitorização preventiva ativa para ${safeDest}.`,
      alerts: [{
        category: "Infraestrutura" as const,
        risk: "medium" as const,
        title: "Sem dados em tempo real suficientes",
        description: "Não foi possível obter fontes recentes.",
        pivoting: "Confirmar informação em fontes oficiais locais.",
        sourceHints: [] as string[],
      }],
    };

    const gemini = await generateGeminiContent(prompt, { temperature: 1.0, useGoogleSearch: true, fallbackText: JSON.stringify(fallback) });
    const radar = extractJsonFromText(gemini.text, fallback);

    await prisma.tripSearch.create({
      data: {
        userId,
        destination: safeDest,
        queryType: "RADAR",
        queryPayload: {} as unknown as Prisma.JsonObject,
        results: { ...radar, groundingMetadata: gemini.groundingMetadata } as unknown as Prisma.JsonObject,
      },
    });

    return { radar, groundingMetadata: gemini.groundingMetadata, usedFallback: gemini.usedFallback };
  }

  if (toolName === "get_trip_history") {
    const parsed = tripHistorySchema.safeParse(input ?? {});
    if (!parsed.success) return validationError(parsed.error);

    const limit = parsed.data.limit ?? 20;
    const trips = await prisma.tripSearch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { trips };
  }

  if (toolName === "sniff_agency_reputation") {
    const parsed = agencyReputationSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const { commercialName, city, website } = parsed.data;
    const safeName = sanitizeInput(commercialName, 150);
    const safeNameLower = safeName.toLowerCase().replace(/\s+/g, "");
    const cityHint = city ? ` ${sanitizeInput(city, 100)}` : "";

    const reputationPrompt = `ÉS O 'FAREJADOR DE REPUTAÇÃO' — investigador OSINT focado na voz dos clientes.

A veracidade legal da agência JÁ FOI CONFIRMADA na Fase 1. A tua ÚNICA missão agora é traçar o perfil de risco com base na reputação online.

INPUT: Nome Comercial a pesquisar: "${safeName}"${cityHint ? ` (${cityHint})` : ""}
${website ? `Website declarado: ${website}` : ""}

ALGORITMO DE PESQUISA OBRIGATÓRIO (executa sequencialmente):

PASSO 1 — GOOGLE MY BUSINESS:
Pesquisa no Google: "${safeName}" agência de viagens${cityHint}
Localiza a ficha do Google Maps/Business. Extrai:
- Rating geral (ex: 4,5/5)
- Total de opiniões
- Lê as queixas (1★ e 2★) — foca em problemas financeiros

PASSO 2 — PORTAIS DE QUEIXAS:
Pesquisa no Google:
- "${safeName}" portal da queixa OR trustpilot
- "${safeName}" fraude OR burla OR tribunal OR "não devolveram"
- "${safeName}" reclamação OR reclamações
Extrai queixas concretas com datas se possível.

PASSO 3 — REDES SOCIAIS:
Pesquisa no Google:
- "${safeNameLower}" instagram
- "${safeNameLower}" facebook
- "${safeName}" Portugal viagens
Para cada rede encontrada regista: URL, seguidores, publicações recentes (têm posts este ano?), comentários bloqueados ou com queixas?
${website ? `\nPASSO 4 — WEBSITE:\nVerifica se ${website} está activo e parece legítimo.` : ""}

DIRECTRIZES DE AVALIAÇÃO:
- Filtra o "ruído" (ex: "o guia era chato") e foca-te em FRAUDE / INSOLVÊNCIA (ex: "ficou com o dinheiro", "falso cancelamento", "não enviam vouchers").
- Se não houver presença online nenhuma para uma agência supostamente activa, sinaliza como GRANDE red flag.

Responde ESTRITAMENTE neste JSON:
{
  "action_log": ["Pesquisei no Google", "Li X reviews no Maps", "Entrei no Portal da Queixa"],
  "digital_footprint": {
    "google_rating": "4.5/5 (80 avaliações) | N/D",
    "social_media_presence": "Forte|Fraca|Inexistente (justificação breve)",
    "website_active": true | false | "não verificado"
  },
  "critical_red_flags": ["Apenas queixas graves financeiras ou ghosting. Array vazio se limpo."],
  "sentiment_summary": "Resumo de 2 frases sobre a reputação.",
  "fraud_risk": "Alto|Médio|Baixo"
}`;

    interface ReputationResult {
      action_log?: string[];
      digital_footprint?: { google_rating?: string; social_media_presence?: string; website_active?: boolean | string };
      critical_red_flags?: string[];
      sentiment_summary?: string;
      fraud_risk?: string;
    }

    const fallback: ReputationResult = {
      action_log: [],
      digital_footprint: { google_rating: "N/D", social_media_presence: "Não verificado", website_active: "não verificado" },
      critical_red_flags: [],
      sentiment_summary: "Análise de reputação indisponível.",
      fraud_risk: "Médio",
    };

    const gemini = await generateGeminiContent(reputationPrompt, {
      useGoogleSearch: true,
      temperature: 0.2,
      fallbackText: JSON.stringify(fallback),
    });

    const reputation = gemini.usedFallback
      ? fallback
      : extractJsonFromText<ReputationResult>(gemini.text, fallback);

    return { reputation, usedFallback: gemini.usedFallback, groundingMetadata: gemini.groundingMetadata };
  }

  return { error: "unknown_tool" };
}
