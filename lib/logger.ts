import pino from "pino";

export const logger = pino({
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
    transport: process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
});

export const grokLog = logger.child({ module: "grok" });
export const grokResearcherLog = logger.child({ module: "grok-researcher" });
export const placesLog = logger.child({ module: "google-places" });
export const authLog = logger.child({ module: "auth" });
