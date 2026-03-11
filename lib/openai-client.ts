/**
 * OpenAI GPT-4o client — the conversational brain of the Detetive.
 * Handles all user-facing conversation, personality, and response synthesis.
 */

import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "YOUR_OPENAI_API_KEY_HERE") return null;
    if (!openaiClient) {
        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

export const OPENAI_MODEL = "gpt-4o";
export const OPENAI_MODEL_FAST = "gpt-4o-mini"; // for lightweight tasks
