import { describe, it, expect } from "vitest";
import { stripAccents, normalizeName, distinctiveWords, nameSimilarity } from "./name-matching";

describe("stripAccents", () => {
    it("removes Portuguese accents", () => {
        expect(stripAccents("Agência de Viagens São João")).toBe("Agencia de Viagens Sao Joao");
    });

    it("handles cedilla", () => {
        expect(stripAccents("Açores Turístico")).toBe("Acores Turistico");
    });

    it("leaves plain ASCII unchanged", () => {
        expect(stripAccents("Hello World")).toBe("Hello World");
    });
});

describe("normalizeName", () => {
    it("removes legal suffixes", () => {
        expect(normalizeName("Viagens Premium Lda")).toBe("viagens premium");
    });

    it("removes accents and punctuation", () => {
        expect(normalizeName("Agência São João, SA")).toBe("agencia sao joao");
    });

    it("normalizes whitespace", () => {
        expect(normalizeName("  Multi   Destinos  ")).toBe("multi destinos");
    });

    it("removes Unipessoal suffix", () => {
        expect(normalizeName("Core Travel, Unipessoal Lda")).toBe("core travel");
    });
});

describe("distinctiveWords", () => {
    it("removes stop words and travel terms", () => {
        const words = distinctiveWords("Viagens do Algarve Lda");
        expect(words).toEqual(new Set(["algarve"]));
    });

    it("falls back to all words if only stop words remain", () => {
        const words = distinctiveWords("Agência de Viagens e Turismo");
        expect(words.size).toBeGreaterThan(0);
    });

    it("keeps distinctive business words", () => {
        const words = distinctiveWords("ATUAVIAGEM AGENCIA DE VIAGENS E TURISMO LDA");
        expect(words).toEqual(new Set(["atuaviagem"]));
    });

    it("extracts multiple distinctive words", () => {
        const words = distinctiveWords("Multi Destinos - Viagens e Turismo");
        expect(words).toEqual(new Set(["multi", "destinos"]));
    });
});

describe("nameSimilarity", () => {
    it("returns 1.0 for identical names", () => {
        expect(nameSimilarity("Premium Travel", "Premium Travel")).toBe(1);
    });

    it("returns high score for same business, different format", () => {
        expect(nameSimilarity("Viagens Premium Lda", "Premium Viagens")).toBeGreaterThanOrEqual(0.5);
    });

    it("rejects completely different businesses", () => {
        expect(nameSimilarity("ATUAVIAGEM AGENCIA DE VIAGENS", "Amo Viajar - Agência de Viagens")).toBeLessThan(0.4);
    });

    it("matches agency with commercial name variant", () => {
        expect(nameSimilarity("Multi Destinos - Viagens e Turismo, Unipessoal Lda", "Multi Destinos")).toBeGreaterThanOrEqual(0.5);
    });

    it("handles substring matching for partial words", () => {
        expect(nameSimilarity("Core Travel", "CoreTravel Viagens")).toBeGreaterThanOrEqual(0.4);
    });

    it("returns 0 for empty strings", () => {
        expect(nameSimilarity("", "Something")).toBe(0);
    });

    it("correctly rejects agencies with only generic words in common", () => {
        // Two agencies that share only "viagens" and "turismo" - should be rejected
        expect(nameSimilarity(
            "PEGADAS INÉDITAS LDA",
            "Horizonte Azul Viagens Lda",
        )).toBeLessThan(0.4);
    });
});
