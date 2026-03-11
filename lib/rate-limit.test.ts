import { describe, it, expect, vi } from "vitest";
import { checkRateLimit } from "./rate-limit/index";

// Use unique keys per test to avoid cross-test pollution (module-level store persists)
let testId = 0;
function uniqueKey() {
    return `test-${++testId}-${Date.now()}`;
}

describe("checkRateLimit", () => {
    it("allows first request", async () => {
        const key = uniqueKey();
        const result = await checkRateLimit(key, 5, 60000);
        expect(result.allowed).toBe(true);
        expect(result.retryAfter).toBe(0);
    });

    it("allows up to limit requests", async () => {
        const key = uniqueKey();
        for (let i = 0; i < 5; i++) {
            const result = await checkRateLimit(key, 5, 60000);
            expect(result.allowed).toBe(true);
        }
    });

    it("blocks after limit exceeded", async () => {
        const key = uniqueKey();
        for (let i = 0; i < 5; i++) {
            await checkRateLimit(key, 5, 60000);
        }
        const result = await checkRateLimit(key, 5, 60000);
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("resets after window expires", async () => {
        vi.useFakeTimers();
        try {
            const key = uniqueKey();
            for (let i = 0; i < 5; i++) {
                await checkRateLimit(key, 5, 1000);
            }
            expect((await checkRateLimit(key, 5, 1000)).allowed).toBe(false);

            vi.advanceTimersByTime(1001);
            expect((await checkRateLimit(key, 5, 1000)).allowed).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it("tracks different keys independently", async () => {
        const keyA = uniqueKey();
        const keyB = uniqueKey();
        for (let i = 0; i < 5; i++) {
            await checkRateLimit(keyA, 5, 60000);
        }
        expect((await checkRateLimit(keyA, 5, 60000)).allowed).toBe(false);
        expect((await checkRateLimit(keyB, 5, 60000)).allowed).toBe(true);
    });

    it("returns correct retryAfter in seconds", async () => {
        vi.useFakeTimers();
        try {
            const key = uniqueKey();
            for (let i = 0; i < 3; i++) {
                await checkRateLimit(key, 3, 30000);
            }
            const result = await checkRateLimit(key, 3, 30000);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBe(30);
        } finally {
            vi.useRealTimers();
        }
    });
});
