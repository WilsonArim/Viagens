import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerateContentRequest,
  type SafetySetting,
} from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.5-pro";

const SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export interface GeminiResult {
  text: string;
  groundingMetadata?: unknown;
  blocked?: boolean;
  usedFallback: boolean;
}

export interface GeminiCallOptions {
  temperature?: number;
  useGoogleSearch?: boolean;
  fallbackText?: string;
}

const client = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export async function generateGeminiContent(
  prompt: string,
  options: GeminiCallOptions = {},
): Promise<GeminiResult> {
  if (!client) {
    return {
      text: options.fallbackText ?? "Sem chave Gemini configurada.",
      usedFallback: true,
    };
  }

  try {
    const model = client.getGenerativeModel({
      model: DEFAULT_MODEL,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
      },
    });

    // Gemini 2.0+ uses "google_search" tool (not "googleSearchRetrieval" which is 1.5 only)
    // SDK v0.24.1 types don't include this yet, so we cast to bypass
    const requestPayload: string | GenerateContentRequest = options.useGoogleSearch
      ? {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} } as unknown as import("@google/generative-ai").Tool],
      }
      : prompt;

    const result = await model.generateContent(requestPayload);
    const response = result.response;

    const text = response.text();
    const candidates = response.candidates;
    const groundingMetadata = candidates?.[0]?.groundingMetadata ?? undefined;
    const blocked = Boolean(response.promptFeedback?.blockReason);

    return {
      text,
      groundingMetadata,
      blocked,
      usedFallback: false,
    };
  } catch (error) {
    return {
      text: options.fallbackText ?? "Resposta simulada devido a falha no Gemini.",
      usedFallback: true,
      groundingMetadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    };
  }
}

export function extractJsonFromText<T>(text: string, fallback: T): T {
  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return fallback;
    }

    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return fallback;
    }
  }
}
