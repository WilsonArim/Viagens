import criteriaData from "@/data/rcs-criteria.json";

// ═══ TYPES ═══

export interface RCSPillarScores {
    hardware: number;    // H: 1.0-10.0 (Infraestrutura, área, camas, HVAC)
    service: number;     // S: 1.0-10.0 (Staff ratio, certificações, 24h, multilingue)
    hygiene: number;     // G: 1.0-10.0 (Limpeza, probiótico, purificação, robótica)
    location: number;    // L: 1.0-10.0 (Digitalização, GSTC, comunidade local)
}

export interface RCSResult {
    rcs: number;
    stars: number;
    label: string;
    emoji: string;
    pillarScores: RCSPillarScores;
    modifiersApplied: string[];
    redFlags: string[];
    isBlocked: boolean;
}

interface StarConversion {
    officialStars: number;
    rcsMin: number;
    rcsMax: number;
    label?: string;
    conditions?: string;
}

interface SpecialDesignation {
    name: string;
    effect: "bonus" | "override" | "multiplier";
    target: "hardware" | "service" | "hygiene" | "location" | "rcs_final";
    value: number;
}

interface Penalty {
    trigger: string;
    rcsPenalty: number;
    isBlocking: boolean;
}

interface CountryCriteria {
    countryCode: string;
    countryName: string;
    regulatoryBody: string;
    lastAuditYear: number;
    maxOfficialStars: number;
    starConversion: StarConversion[];
    specialDesignations: SpecialDesignation[];
    penalties: Penalty[];
    requiredLicenses: { name: string; code: string; mandatory: boolean; validityYears: number }[];
    redFlags: string[];
    notes: string;
}

// ═══ WEIGHTS ═══
const WEIGHTS = {
    hardware: 0.35,
    service: 0.30,
    hygiene: 0.20,
    location: 0.15,
} as const;

// ═══ PUBLIC API ═══

export function getCountryCriteria(countryCode: string): CountryCriteria | null {
    return (criteriaData as CountryCriteria[]).find(
        (c) => c.countryCode.toUpperCase() === countryCode.toUpperCase()
    ) ?? null;
}

export function getAllCountryCodes(): string[] {
    return (criteriaData as CountryCriteria[]).map((c) => c.countryCode);
}

export function rcsToStars(rcs: number): { stars: number; label: string; emoji: string } {
    if (rcs >= 9.0) return { stars: 5, label: "Ultra-Luxo", emoji: "⭐⭐⭐⭐⭐" };
    if (rcs >= 7.5) return { stars: 4, label: "Primeira Classe", emoji: "⭐⭐⭐⭐" };
    if (rcs >= 6.0) return { stars: 3, label: "Standard Sólido", emoji: "⭐⭐⭐" };
    if (rcs >= 4.0) return { stars: 2, label: "Económico", emoji: "⭐⭐" };
    return { stars: 1, label: "Armadilha Logística", emoji: "🚩" };
}

export function calculateRCS(
    pillarScores: RCSPillarScores,
    countryCode?: string,
    designations?: string[],
    penalties?: string[],
): RCSResult {
    const criteria = countryCode ? getCountryCriteria(countryCode) : null;
    const modifiersApplied: string[] = [];
    const redFlags: string[] = [];
    let isBlocked = false;

    // Clone scores for modification
    let h = clamp(pillarScores.hardware, 1, 10);
    let s = clamp(pillarScores.service, 1, 10);
    let g = clamp(pillarScores.hygiene, 1, 10);
    let l = clamp(pillarScores.location, 1, 10);

    // Apply special designations
    if (criteria && designations?.length) {
        for (const desig of criteria.specialDesignations) {
            if (!designations.some((d) => d.toLowerCase().includes(desig.name.toLowerCase()))) continue;

            switch (desig.effect) {
                case "override":
                    if (desig.target === "hardware") { h = desig.value; modifiersApplied.push(`${desig.name}: H=${desig.value}`); }
                    if (desig.target === "service") { s = desig.value; modifiersApplied.push(`${desig.name}: S=${desig.value}`); }
                    if (desig.target === "hygiene") { g = desig.value; modifiersApplied.push(`${desig.name}: G=${desig.value}`); }
                    if (desig.target === "location") { l = desig.value; modifiersApplied.push(`${desig.name}: L=${desig.value}`); }
                    break;
                case "multiplier":
                    if (desig.target === "service") { s = clamp(s * desig.value, 1, 10); modifiersApplied.push(`${desig.name}: S×${desig.value}`); }
                    if (desig.target === "hardware") { h = clamp(h * desig.value, 1, 10); modifiersApplied.push(`${desig.name}: H×${desig.value}`); }
                    break;
                // "bonus" applied to rcs_final below
            }
        }
    }

    // Calculate base RCS
    let rcs = (h * WEIGHTS.hardware) + (s * WEIGHTS.service) + (g * WEIGHTS.hygiene) + (l * WEIGHTS.location);

    // Apply designation bonuses to rcs_final
    if (criteria && designations?.length) {
        for (const desig of criteria.specialDesignations) {
            if (desig.effect !== "bonus" || desig.target !== "rcs_final") continue;
            if (!designations.some((d) => d.toLowerCase().includes(desig.name.toLowerCase()))) continue;
            rcs += desig.value;
            modifiersApplied.push(`${desig.name}: +${desig.value}`);
        }
    }

    // Apply penalties
    if (criteria && penalties?.length) {
        for (const pen of criteria.penalties) {
            if (!penalties.some((p) => p.toLowerCase().includes(pen.trigger.toLowerCase().slice(0, 20)))) continue;
            if (pen.isBlocking) {
                isBlocked = true;
                rcs = 0;
                modifiersApplied.push(`BLOQUEADO: ${pen.trigger}`);
            } else {
                rcs += pen.rcsPenalty;
                modifiersApplied.push(`Penalidade: ${pen.rcsPenalty} (${pen.trigger})`);
            }
        }
    }

    // Collect red flags
    if (criteria?.redFlags) {
        redFlags.push(...criteria.redFlags);
    }

    // Clamp final
    rcs = clamp(Math.round(rcs * 10) / 10, 0, 10);

    const starInfo = rcsToStars(rcs);

    return {
        rcs,
        stars: starInfo.stars,
        label: starInfo.label,
        emoji: starInfo.emoji,
        pillarScores: { hardware: h, service: s, hygiene: g, location: l },
        modifiersApplied,
        redFlags,
        isBlocked,
    };
}

// Build a prompt instruction for Gemini to estimate pillar scores
export function buildRCSEstimationPrompt(hotelName: string, destination: string, countryCode?: string): string {
    const criteria = countryCode ? getCountryCriteria(countryCode) : null;
    const countryContext = criteria
        ? `País: ${criteria.countryName} (${criteria.regulatoryBody}). ${criteria.notes}`
        : "";

    return `
Além da análise principal, estima os 4 pilares do Real Comfort Score (RCS) para ${hotelName} em ${destination}.
${countryContext}

Cada pilar é uma nota de 1.0 a 10.0:
- hardware: Infraestrutura (área quarto m², camas, insonorização, climatização)
- service: Qualidade serviço (staff/hóspede ratio, certificações, 24h, multilingue)
- hygiene: Higiene e operações (limpeza ecológica, purificação ar, arrumação)
- location: Localização + tecnologia + sustentabilidade (check-in móvel, GSTC, digitalização)

Inclui no JSON de resposta um campo "rcsPillars": {"hardware": X, "service": X, "hygiene": X, "location": X}
Também inclui "designations": [] com designações especiais se aplicável (ex: "Palace", "Superior", "Red Stars", "Heritage Grand").
`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
