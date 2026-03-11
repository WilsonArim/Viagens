/** Remove acentos portugueses (e→e, a→a, c→c, etc.) */
export function stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Palavras portuguesas genericas + termos do setor de turismo (nao distinguem agencias) */
export const STOP_WORDS = new Set([
    "de", "do", "da", "dos", "das", "e", "o", "a", "os", "as",
    "em", "no", "na", "nos", "nas", "por", "para", "com", "sem",
    "agencia", "viagens", "viagem", "turismo", "travel", "tours",
    "tourism", "tour", "agency",
]);

/**
 * Normaliza um nome de empresa para comparacao fuzzy.
 * Remove acentos, sufixos legais, pontuacao e espacos extra.
 */
export function normalizeName(name: string): string {
    return stripAccents(name)
        .toLowerCase()
        .replace(/[.,\-–—:;'"()]/g, " ")
        .replace(/\b(lda|limitada|sa|unipessoal|sociedade|eireli|s\.?a\.?r\.?l\.?|lta|ltd|gmbh|inc|corp)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** Extrai palavras distintivas (sem stop words). Fallback para todas se vazias. */
export function distinctiveWords(name: string): Set<string> {
    const all = normalizeName(name).split(" ").filter(Boolean);
    const distinctive = all.filter((w) => !STOP_WORDS.has(w));
    return new Set(distinctive.length > 0 ? distinctive : all);
}

/**
 * Calcula similaridade entre dois nomes (0-1).
 * Usa sobreposicao de palavras distintivas (ignora stop words e termos genericos do setor).
 */
export function nameSimilarity(a: string, b: string): number {
    const wordsA = distinctiveWords(a);
    const wordsB = distinctiveWords(b);
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let matches = 0;
    for (const w of wordsA) {
        for (const wb of wordsB) {
            if (w === wb || (w.length >= 3 && wb.includes(w)) || (wb.length >= 3 && w.includes(wb))) {
                matches++;
                break;
            }
        }
    }
    const minSize = Math.min(wordsA.size, wordsB.size);
    return matches / minSize;
}

/** Limiar minimo de similaridade para aceitar um resultado do Google */
export const MIN_SIMILARITY = 0.4;
