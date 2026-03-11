/**
 * Grok Researcher — the silent engine behind all research and analysis.
 * Handles: web search, X/Twitter data, hotel analysis, itineraries,
 * agency reputation, link analysis, and destination alerts.
 *
 * NOT conversational. Returns structured data for GPT-4o to compile.
 */

import OpenAI from "openai";

import { grokResearcherLog } from "@/lib/logger";

let grokClient: OpenAI | null = null;

export function getGrokResearcher(): OpenAI | null {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey || apiKey.includes("YOUR_")) return null;
    if (!grokClient) {
        grokClient = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
    }
    return grokClient;
}

export const GROK_MODEL = "grok-3";

// ── Core: raw search ────────────────────────────────────────────────────────

export async function grokResearch(query: string, opts?: {
    includeX?: boolean;
    maxTokens?: number;
    temperature?: number;
}): Promise<{ data: string; usedGrok: boolean }> {
    const client = getGrokResearcher();
    if (!client) return { data: "", usedGrok: false };

    const system = opts?.includeX
        ? "Motor de pesquisa especializado em viagens. Pesquisa na web E no X (Twitter). Devolve apenas dados factuais brutos, citações directas, alertas reais. NÃO elabores opiniões."
        : "Motor de pesquisa especializado em viagens. Pesquisa na web. Devolve apenas dados factuais brutos. NÃO elabores opiniões.";

    try {
        const response = await client.chat.completions.create({
            model: GROK_MODEL,
            messages: [{ role: "system", content: system }, { role: "user", content: query }],
            temperature: opts?.temperature ?? 0.15,
            max_tokens: opts?.maxTokens ?? 1500,
        });
        return { data: response.choices[0]?.message?.content ?? "", usedGrok: true };
    } catch (err) {
        grokResearcherLog.error({ err: err instanceof Error ? err.message : err }, "Grok research failed");
        return { data: "", usedGrok: false };
    }
}

// ── Structured JSON output from Grok ────────────────────────────────────────

async function grokJSON<T>(prompt: string, fallback: T, maxTokens = 2000): Promise<T & { usedGrok: boolean }> {
    const client = getGrokResearcher();
    if (!client) return { ...fallback, usedGrok: false };

    try {
        const response = await client.chat.completions.create({
            model: GROK_MODEL,
            messages: [
                { role: "system", content: "Responde APENAS em JSON válido, sem markdown, sem texto extra." },
                { role: "user", content: prompt },
            ],
            temperature: 0.4,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
        });

        const raw = response.choices[0]?.message?.content ?? "";
        try {
            const parsed = JSON.parse(raw) as T;
            return { ...parsed, usedGrok: true };
        } catch {
            return { ...fallback, usedGrok: true };
        }
    } catch (err) {
        grokResearcherLog.error({ err: err instanceof Error ? err.message : err }, "Grok JSON parse failed");
        return { ...fallback, usedGrok: false };
    }
}

// ── Hotel analysis ───────────────────────────────────────────────────────────

export interface HotelAnalysis {
    verdict: "Excelente" | "Aceitável" | "Evitar";
    abundanceIndex: number;
    redFlags: string[];
    pros: string[];
    cons: string[];
    saferAlternative: string;
    realExperience: string;
    executiveSummary: string;
    usedGrok: boolean;
}

export async function grokAnalyzeHotel(hotelName: string, destination: string): Promise<HotelAnalysis> {
    const fallback: HotelAnalysis = {
        verdict: "Aceitável", abundanceIndex: 50,
        redFlags: ["Dados insuficientes"], pros: [], cons: [],
        saferAlternative: "", realExperience: "", executiveSummary: "Análise preventiva.",
        usedGrok: false,
    };

    return grokJSON<HotelAnalysis>(
        `Analisa o hotel "${hotelName}" em "${destination}". Pesquisa reviews reais, queixas, taxas ocultas, localização real vs anunciada.
Devolve JSON: {"verdict":"Excelente"|"Aceitável"|"Evitar","abundanceIndex":0-100,"redFlags":[],"pros":[],"cons":[],"saferAlternative":"","realExperience":"","executiveSummary":""}`,
        fallback, 1500
    );
}

// ── Itinerary generation ─────────────────────────────────────────────────────

export interface ItineraryDay {
    day: number;
    morning: string;
    lunch: string;
    afternoon: string;
    detectiveNote: string;
    walkingKm: number;
}

export interface Itinerary {
    days: ItineraryDay[];
    globalNote: string;
    paceWarning: string | null;
    usedGrok: boolean;
}

export async function grokGenerateItinerary(destination: string, days: number, context?: string): Promise<Itinerary> {
    const fallback: Itinerary = {
        days: Array.from({ length: days }, (_, i) => ({
            day: i + 1, morning: "Exploração cultural", lunch: "Restaurante local", afternoon: "Atividade autêntica", detectiveNote: "Evitar zonas turísticas", walkingKm: 5,
        })),
        globalNote: "Roteiro de contingência", paceWarning: null, usedGrok: false,
    };

    return grokJSON<Itinerary>(
        `Cria roteiro anti-massas de ${days} dias em "${destination}". ${context ?? "Adaptado a família."} Experiências autênticas, max 8km/dia a pé.
JSON: {"days":[{"day":1,"morning":"","lunch":"","afternoon":"","detectiveNote":"","walkingKm":0}],"globalNote":"","paceWarning":null}`,
        fallback, 2500
    );
}

// ── Destination radar (real-time web + X) ────────────────────────────────────

export interface RadarAlert {
    category: string;
    risk: "low" | "medium" | "high";
    title: string;
    description: string;
    pivoting?: string;
}

export interface RadarResult {
    summary: string;
    alerts: RadarAlert[];
    usedGrok: boolean;
}

export async function grokScanDestination(destination: string): Promise<RadarResult> {
    const fallback: RadarResult = { summary: `Sem dados em tempo real para ${destination}`, alerts: [], usedGrok: false };

    return grokJSON<RadarResult>(
        `Alertas em tempo real para viajantes em "${destination}" na última semana. Pesquisa web e X/Twitter.
Categorias: Segurança, Infraestrutura, Eventos, Elogios. Inclui risco: low/medium/high.
JSON: {"summary":"","alerts":[{"category":"","risk":"low","title":"","description":"","pivoting":""}]}`,
        fallback, 1500
    );
}

// ── Agency reputation (web + X + Portal da Queixa) ──────────────────────────

export async function grokResearchAgency(agencyName: string, rnavt?: string): Promise<{
    complaints: string;
    redFlags: string[];
    usedGrok: boolean;
}> {
    const query = `Queixas e reputação online da agência de viagens "${agencyName}"${rnavt ? ` (RNAVT ${rnavt})` : ""} Portugal. Pesquisa portaldaqueixa.com, Trustpilot, Google reviews, X/Twitter. Existem queixas? Sobre o quê? Foram resolvidas?`;
    const { data, usedGrok } = await grokResearch(query, { includeX: true, maxTokens: 1000 });

    const redFlags: string[] = [];
    if (/queixa|reclamação|fraude|golpe|burla|nunca devolveu/i.test(data)) {
        redFlags.push("Menções a queixas ou fraude encontradas online");
    }

    return { complaints: data.slice(0, 600), redFlags, usedGrok };
}

// ── External link analysis (Instagram, Facebook, site) ──────────────────────

export interface LinkAnalysis {
    rnavtFound: string | null;
    agencyNameFound: string | null;
    followers: string | null;
    ageDescription: string | null;
    complaints: { count: number; topics: string[] } | null;
    redFlags: string[];
    summary: string;
    usedGrok: boolean;
}

export async function grokAnalyzeLink(url: string): Promise<LinkAnalysis> {
    const fallback: LinkAnalysis = {
        rnavtFound: null, agencyNameFound: null, followers: null,
        ageDescription: null, complaints: null, redFlags: [], summary: "Não foi possível analisar o link.",
        usedGrok: false,
    };

    const result = await grokJSON<LinkAnalysis>(
        `Analisa este perfil/site de possível agência de viagens: ${url}
1. Extrai da bio/descrição/rodapé: RNAVT declarado, nome da agência, nº de seguidores, data de criação do perfil
2. Pesquisa queixas: "[nome]" site:portaldaqueixa.com
3. Identifica red flags: conta recente (<6 meses), sem RNAVT (obrigatório por lei em Portugal), fotos de stock, sem contacto oficial
NOTA: Por lei portuguesa, todas as agências devem declarar RNAVT visível.
JSON: {"rnavtFound":null,"agencyNameFound":null,"followers":null,"ageDescription":null,"complaints":{"count":0,"topics":[]},"redFlags":[],"summary":""}`,
        fallback, 1200
    );

    // Auto-flag missing RNAVT as illegal
    if (!result.rnavtFound && !result.redFlags.some(f => f.toLowerCase().includes("rnavt"))) {
        result.redFlags.push("Sem RNAVT declarado (obrigatório por lei em Portugal)");
    }

    return result;
}

// ── Chat history summarization ───────────────────────────────────────────────

export async function grokSummarizeHistory(messages: { role: string; text: string }[]): Promise<string> {
    const client = getGrokResearcher();
    if (!client || messages.length === 0) return "";

    const text = messages.map((m) => `${m.role === "user" ? "Utilizador" : "Detetive"}: ${m.text.slice(0, 300)}`).join("\n");

    try {
        const response = await client.chat.completions.create({
            model: GROK_MODEL,
            messages: [
                { role: "system", content: "Resume em 3-4 frases curtas o histórico de conversa fornecido. Foca-te em destinos, hotéis, agências ou preferências mencionadas. PT-PT, ultra-conciso." },
                { role: "user", content: text },
            ],
            temperature: 0.3,
            max_tokens: 200,
        });
        return response.choices[0]?.message?.content?.trim() ?? "";
    } catch {
        return "";
    }
}
