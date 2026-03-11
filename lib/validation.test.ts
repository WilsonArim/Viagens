import { describe, it, expect } from "vitest";
import {
    memberSchema,
    familyProfileSchema,
    xrayRequestSchema,
    itineraryRequestSchema,
    radarRequestSchema,
} from "./validation";

describe("memberSchema", () => {
    it("accepts valid member", () => {
        const result = memberSchema.safeParse({ name: "Wilson", age: 36, hobbies: [], interests: [] });
        expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
        const result = memberSchema.safeParse({ name: "", age: 10 });
        expect(result.success).toBe(false);
    });

    it("rejects negative age", () => {
        const result = memberSchema.safeParse({ name: "Ana", age: -1 });
        expect(result.success).toBe(false);
    });

    it("rejects age > 120", () => {
        const result = memberSchema.safeParse({ name: "Ana", age: 121 });
        expect(result.success).toBe(false);
    });

    it("defaults hobbies and interests to empty arrays", () => {
        const result = memberSchema.parse({ name: "Ana", age: 30 });
        expect(result.hobbies).toEqual([]);
        expect(result.interests).toEqual([]);
    });
});

describe("familyProfileSchema", () => {
    const validProfile = {
        generalBudget: "2000-3000",
        members: [{ name: "Wilson", age: 36 }],
    };

    it("accepts valid profile", () => {
        const result = familyProfileSchema.safeParse(validProfile);
        expect(result.success).toBe(true);
    });

    it("requires at least one member", () => {
        const result = familyProfileSchema.safeParse({ ...validProfile, members: [] });
        expect(result.success).toBe(false);
    });

    it("defaults travelPace to balanced", () => {
        const result = familyProfileSchema.parse(validProfile);
        expect(result.travelPace).toBe("balanced");
    });

    it("rejects invalid travelPace", () => {
        const result = familyProfileSchema.safeParse({ ...validProfile, travelPace: "turbo" });
        expect(result.success).toBe(false);
    });
});

describe("xrayRequestSchema", () => {
    it("accepts valid request", () => {
        const result = xrayRequestSchema.safeParse({ hotelName: "Hotel Ritz", destination: "Lisboa" });
        expect(result.success).toBe(true);
    });

    it("rejects too short hotelName", () => {
        const result = xrayRequestSchema.safeParse({ hotelName: "H", destination: "Lisboa" });
        expect(result.success).toBe(false);
    });

    it("rejects missing destination", () => {
        const result = xrayRequestSchema.safeParse({ hotelName: "Hotel Ritz" });
        expect(result.success).toBe(false);
    });
});

describe("itineraryRequestSchema", () => {
    it("accepts valid request", () => {
        const result = itineraryRequestSchema.safeParse({ destination: "Porto", days: 5 });
        expect(result.success).toBe(true);
    });

    it("rejects 0 days", () => {
        const result = itineraryRequestSchema.safeParse({ destination: "Porto", days: 0 });
        expect(result.success).toBe(false);
    });

    it("rejects more than 30 days", () => {
        const result = itineraryRequestSchema.safeParse({ destination: "Porto", days: 31 });
        expect(result.success).toBe(false);
    });

    it("rejects float days", () => {
        const result = itineraryRequestSchema.safeParse({ destination: "Porto", days: 3.5 });
        expect(result.success).toBe(false);
    });
});

describe("radarRequestSchema", () => {
    it("accepts valid request", () => {
        const result = radarRequestSchema.safeParse({ destination: "Barcelona" });
        expect(result.success).toBe(true);
    });

    it("rejects too short destination", () => {
        const result = radarRequestSchema.safeParse({ destination: "B" });
        expect(result.success).toBe(false);
    });
});
