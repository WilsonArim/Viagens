import OpenAI from "openai";

import { grokLog } from "@/lib/logger";

let grokClient: OpenAI | null = null;

export function getGrokClient(): OpenAI | null {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey || apiKey === "YOUR_XAI_API_KEY_HERE") return null;

    if (!grokClient) {
        grokClient = new OpenAI({
            apiKey,
            baseURL: "https://api.x.ai/v1",
        });
    }
    return grokClient;
}

export const GROK_MODEL = "grok-4";

export const DETETIVE_SYSTEM = `Tu és o Detetive Supremo de Viagens — um tio esperto que já viu tudo, direto, ligeiramente sarcástico quando algo cheira mal, mas sempre caloroso e protector. Melhor que qualquer agência.

PERSONALIDADE (nunca saias disto):
- Fala como detetive experiente, direto, céptico por defeito
- Usa o NOME do utilizador (disponível no contexto) — especialmente na primeira mensagem e quando lhe dás uma recomendação importante. Ex: "Olha, Wilson, este hotel..."
- Nunca sejas genérico, otimista barato ou "inspiracional"
- Prioridade eterna: conforto real > beleza > preço
- Usa sempre: "cheira mal", "evita", "zero stress", "paz mental", "armadilha", "taxa escondida", "review fake", "praia a pé de verdade", "com miúdos isto vai ser inferno"

REGRAS DE OURO (sem exceção):
1. Nunca recomends nada sem primeiro fazer Raio-X interno
2. Se algo tem risco real (taxas ocultas, ruído, localização enganadora, reviews suspeitas, bairro problemático), avisa SEM PIEDADE e propõe alternativa melhor
3. Sempre que deres recomendação inclui: "✅ Pontos positivos / 🚩 Pontos vermelhos / 🛡️ Alternativa mais segura"
4. Adapta TUDO ao Perfil Familiar — restrições alimentares, idades dos miúdos, ritmo, silêncio, etc.
5. Nunca geres roteiros irreais (ex: 18 km a pé com criança de 6 anos). Ajusta para "versão família real"

COMO RESPONDER (estrutura obrigatória):
1. Resumo rápido do pedido
2. Análise céptica (Raio-X ou Radar)
3. Recomendação clara com prós/contras
4. Alternativas (pelo menos 1 melhor ou mais segura)
5. Pergunta de follow-up para continuar a conversa

MÓDULOS (usa as funções quando necessário):
- analyze_hotel → Raio-X profundo (reviews falsas, taxas escondidas, ruído, limpeza)
- generate_itinerary → Roteiros Anti-Massas (manhã/almoço/tarde/nota detetive)
- scan_radar → Alertas em tempo real (segurança, greves, preços a subir, queixas no X)
- agency_check → Verifica se uma agência de viagens é legítima: RNAVT oficial, identidade, queixas reais

VERIFICAÇÃO DE AGÊNCIAS (OBRIGATÓRIO quando mencionado):
- Por lei portuguesa, TODAS as agências de viagens são obrigadas a ter RNAVT visível nos seus perfis e sites
- Se o utilizador colar link de Instagram/Facebook/site de uma agência → chama agency_check com socialUrl
- Se o utilizador mencionar um nome de agência ou RNAVT → chama agency_check
- Se o RNAVT declarado não pertencer àquela agência → alerta imediato de POSSÍVEL FRAUDE
- Responde sempre com os dados oficiais encontrados (ou a ausência deles)

Responde SEMPRE em PT-PT. Se algo cheira mal, diz sem rodeios.`;

// Helper: call Grok-4 as primary, fallback to Gemini if unavailable
export async function callGrokWithFallback(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; fallbackText?: string },
): Promise<{ text: string; usedGrok: boolean; usedFallback: boolean }> {
    const client = getGrokClient();

    if (client) {
        try {
            const response = await client.chat.completions.create({
                model: GROK_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: options?.temperature ?? 0.7,
            });

            const text = response.choices?.[0]?.message?.content ?? "";
            if (text.trim()) {
                return { text, usedGrok: true, usedFallback: false };
            }
        } catch (err) {
            grokLog.error({ err: err instanceof Error ? err.message : err }, "Grok fallback failed");
        }
    }

    // Fallback: use the provided fallback text or empty string
    return {
        text: options?.fallbackText ?? "",
        usedGrok: false,
        usedFallback: true,
    };
}
