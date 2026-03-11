import { describe, it, expect } from "vitest";
import { isCacheValid } from "./agency-cache";

describe("isCacheValid", () => {
    it("returns false for null", () => {
        expect(isCacheValid(null)).toBe(false);
    });

    it("returns false for undefined", () => {
        expect(isCacheValid(undefined)).toBe(false);
    });

    it("returns true for date within 30 days", () => {
        const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
        expect(isCacheValid(recent)).toBe(true);
    });

    it("returns false for date older than 30 days", () => {
        const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
        expect(isCacheValid(old)).toBe(false);
    });

    it("returns true for date exactly now", () => {
        expect(isCacheValid(new Date())).toBe(true);
    });
});
