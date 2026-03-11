import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type OpenAI from "openai";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import {
    grokAnalyzeHotel,
    grokGenerateItinerary,
    grokScanDestination,
    grokResearchAgency,
    grokSummarizeHistory,
} from "@/lib/grok-researcher";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai-client";
import { prisma } from "@/lib/prisma";
import { DETETIVE_SYSTEM } from "@/lib/grok";

// ────────────────────────────────────────────────────────────────────────────
// History management
// ────────────────────────────────────────────────────────────────────────────
const HISTORY_LIMIT = 20;
const SUMMARIZE_AFTER = 30;

interface ChatMessage {
    role: "user" | "model";
    text: string;
    toolResults?: Record<string, unknown>[];
}

// ────────────────────────────────────────────────────────────────────────────
// Tool dispatchers — all powered by Grok Researcher
// ────────────────────────────────────────────────────────────────────────────
async function toolAnalyzeHotel(hotelName: string, destination: string) {
    return grokAnalyzeHotel(hotelName, destination);
}

async function toolGenerateItinerary(destination: string, days: number, familyContext?: string) {
    return grokGenerateItinerary(destination, days, familyContext);
}

async function toolScanRadar(destination: string) {
    return grokScanDestination(destination);
}

async function toolAgencyCheck(agencyName?: string, rnavt?: string, socialUrl?: string, cookieHeader?: string) {
    // 1. DB lookup via the agency check API (forward cookies for auth)
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-internal": "chat-tool" };
    if (cookieHeader) headers["cookie"] = cookieHeader;
    const res = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/agency/check`, {
        method: "POST",
        headers,
        body: JSON.stringify({ agencyName, rnavt, socialUrl }),
    });
    const data = await res.json().catch(() => ({ error: "Erro na verificação" }));

    // 2. Enrich with Grok reputation research if found
    const name = agencyName ?? (data.officialAgency as { legalName?: string } | null)?.legalName;
    if (name && data.verdict === "safe") {
        const reputation = await grokResearchAgency(name, rnavt ?? (data.officialAgency as { rnavt?: string } | null)?.rnavt);
        if (reputation.usedGrok && reputation.complaints) {
            return { ...data, grokReputation: reputation.complaints, grokRedFlags: reputation.redFlags };
        }
    }

    return data;
}

async function executeTool(name: string, args: Record<string, unknown>, cookieHeader?: string): Promise<{ type: string; data: unknown;[k: string]: unknown }> {
    switch (name) {
        case "analyze_hotel": {
            const data = await toolAnalyzeHotel(args.hotelName as string, args.destination as string);
            return { type: "xray", data, hotelName: args.hotelName, destination: args.destination };
        }
        case "generate_itinerary": {
            const data = await toolGenerateItinerary(args.destination as string, Number(args.days) || 3, args.familyContext as string | undefined);
            return { type: "itinerary", data, destination: args.destination, days: args.days };
        }
        case "scan_radar": {
            const data = await toolScanRadar(args.destination as string);
            return { type: "radar", data, destination: args.destination };
        }
        case "agency_check": {
            const a = args as { agencyName?: string; rnavt?: string; socialUrl?: string };
            const data = await toolAgencyCheck(a.agencyName, a.rnavt, a.socialUrl, cookieHeader);
            return { type: "agency", data, ...a };
        }
        default:
            return { type: "error", data: { error: `Função desconhecida: ${name}` } };
    }
}

// ────────────────────────────────────────────────────────────────────────────
// OpenAI function definitions for GPT-4o
// ────────────────────────────────────────────────────────────────────────────
const openaiTools: OpenAI.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "analyze_hotel",
            description: "Raio-X profundo a um hotel via Grok: reviews reais, taxas ocultas, red flags, alternativa mais segura",
            parameters: {
                type: "object",
                properties: {
                    hotelName: { type: "string", description: "Nome do hotel" },
                    destination: { type: "string", description: "Destino/cidade" },
                },
                required: ["hotelName", "destination"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "generate_itinerary",
            description: "Gera roteiro anti-massas dia a dia para um destino, adaptado ao perfil familiar",
            parameters: {
                type: "object",
                properties: {
                    destination: { type: "string", description: "Destino" },
                    days: { type: "number", description: "Número de dias" },
                    familyContext: { type: "string", description: "Contexto familiar relevante (idades, preferências)" },
                },
                required: ["destination", "days"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "scan_radar",
            description: "Alertas em tempo real via Grok + X: segurança, greves, infraestrutura, eventos na última semana",
            parameters: {
                type: "object",
                properties: { destination: { type: "string", description: "Destino" } },
                required: ["destination"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "agency_check",
            description: "Verifica agência de viagens: licença RNAVT oficial + reputação online via Grok (Portal da Queixa, X). Usa quando o utilizador menciona uma agência, RNAVT, ou cola link de Instagram/Facebook/site.",
            parameters: {
                type: "object",
                properties: {
                    agencyName: { type: "string", description: "Nome da agência" },
                    rnavt: { type: "string", description: "Número RNAVT" },
                    socialUrl: { type: "string", description: "Link Instagram, Facebook, Google Maps ou site" },
                },
                required: [],
            },
        },
    },
];

// ────────────────────────────────────────────────────────────────────────────
// POST handler
// ────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const body = await request.json().catch(() => null);
    if (!body?.message || typeof body.message !== "string") {
        return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 });
    }

    // Load history from DB (source of truth)
    const chatSession = await prisma.chatSession.findFirst({
        where: { userId: session.user.id, deletedAt: null },
        orderBy: { updatedAt: "desc" },
    });
    const allStoredMessages: ChatMessage[] = Array.isArray(chatSession?.messages)
        ? (chatSession.messages as unknown as ChatMessage[])
        : [];
    const existingSummary = (chatSession as { summary?: string | null } | null)?.summary ?? null;
    const historyForLLM = allStoredMessages.slice(-HISTORY_LIMIT);

    // Load family profile
    const familyProfile = await prisma.familyProfile.findUnique({
        where: { userId: session.user.id },
        include: { members: true },
    });
    const userName = session.user.name?.split(" ")[0] ?? null;

    const familyContext = familyProfile
        ? `\n\nCONTEXTO DO UTILIZADOR (usa SEMPRE):\n- Nome: ${userName ?? "não fornecido"} (usa o primeiro nome)\n- Orçamento: ${familyProfile.generalBudget ?? "não definido"}\n- Ritmo: ${(familyProfile as Record<string, unknown>).travelPace ?? "não definido"}\n- Restrições alimentares: ${Array.isArray(familyProfile.dietaryRestrictions) ? familyProfile.dietaryRestrictions.join(", ") : (familyProfile.dietaryRestrictions ?? "nenhuma")}\n- Membros: ${familyProfile.members.map((m) => `${m.name} (${m.age}a, interesses: ${m.interests ?? "diversos"})`).join("; ")}`
        : userName ? `\n\nCONTEXTO DO UTILIZADOR:\n- Nome: ${userName}` : "";

    const summaryContext = existingSummary
        ? `\n\nRESUMO DA CONVERSA ANTERIOR:\n${existingSummary}`
        : "";

    const systemPrompt = DETETIVE_SYSTEM + familyContext + summaryContext;

    const openai = getOpenAIClient();
    if (!openai) {
        return NextResponse.json({
            reply: "O Detetive não está configurado. Adiciona a OPENAI_API_KEY ao .env.",
            toolResults: [],
            engine: "unconfigured",
        });
    }

    const cookieHeader = request.headers.get("cookie") ?? undefined;
    return handleOpenAIChat(openai, systemPrompt, body.message, historyForLLM, session.user.id, chatSession?.id ?? null, allStoredMessages, existingSummary, cookieHeader);
}

// ────────────────────────────────────────────────────────────────────────────
// GPT-4o chat handler
// ────────────────────────────────────────────────────────────────────────────
async function handleOpenAIChat(
    openai: OpenAI,
    systemPrompt: string,
    userMessage: string,
    history: ChatMessage[],
    userId: string,
    sessionId: string | null,
    allStoredMessages: ChatMessage[],
    existingSummary: string | null,
    cookieHeader?: string,
) {
    try {
        const messages: OpenAI.ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            ...history.map((m) => ({
                role: m.role === "model" ? "assistant" as const : "user" as const,
                content: m.text,
            })),
            { role: "user", content: userMessage },
        ];

        let response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages,
            tools: openaiTools,
            tool_choice: "auto",
            temperature: 0.75,
        });

        const toolResults: Record<string, unknown>[] = [];
        const toolMessages: OpenAI.ChatCompletionMessageParam[] = [];
        let iterations = 0;

        while (iterations < 5) {
            const choice = response.choices[0];
            if (!choice?.message?.tool_calls?.length) break;

            toolMessages.push({ role: "assistant", content: choice.message.content, tool_calls: choice.message.tool_calls });

            for (const toolCall of choice.message.tool_calls) {
                if (toolCall.type !== "function") continue;
                const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
                const result = await executeTool(toolCall.function.name, args, cookieHeader);
                toolResults.push(result);
                toolMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result.data),
                });
            }

            response = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [...messages, ...toolMessages],
                tools: openaiTools,
                tool_choice: "auto",
                temperature: 0.75,
            });
            iterations++;
        }

        const finalText = response.choices[0]?.message?.content ?? "Sem resposta do Detetive.";
        await persistChat(userId, userMessage, finalText, toolResults, sessionId, allStoredMessages, existingSummary);
        return NextResponse.json({ reply: finalText, toolResults, engine: "gpt-4o" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return NextResponse.json({
            reply: `O Detetive está temporariamente indisponível: ${message}. Tenta novamente.`,
            toolResults: [],
            engine: "error",
        });
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Persist chat + smart summarization (via Grok)
// ────────────────────────────────────────────────────────────────────────────
async function persistChat(
    userId: string,
    userMessage: string,
    reply: string,
    toolResults: Record<string, unknown>[],
    sessionId: string | null,
    allStoredMessages: ChatMessage[],
    existingSummary: string | null,
) {
    const newMessages: ChatMessage[] = [
        ...allStoredMessages,
        { role: "user", text: userMessage },
        { role: "model", text: reply, toolResults },
    ];

    let updatedSummary = existingSummary;
    if (newMessages.length > SUMMARIZE_AFTER) {
        const toSummarize = newMessages.slice(0, newMessages.length - HISTORY_LIMIT);
        const freshSummary = await grokSummarizeHistory(toSummarize.map(m => ({ role: m.role, text: m.text })));
        updatedSummary = freshSummary || existingSummary;
        newMessages.splice(0, toSummarize.length);
    }

    const data = {
        messages: newMessages as unknown as Prisma.InputJsonValue,
        ...(updatedSummary !== existingSummary ? { summary: updatedSummary } : {}),
    };

    if (sessionId) {
        await prisma.chatSession.update({ where: { id: sessionId }, data });
    } else {
        await prisma.chatSession.create({ data: { userId, ...data } });
    }
}
