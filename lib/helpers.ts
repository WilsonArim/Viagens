export function sanitizeForPrompt(value: string, maxLength = 200): string {
    return value
        .replace(/<[^>]*>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .slice(0, maxLength)
        .trim();
}

export function toJsonObject<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
