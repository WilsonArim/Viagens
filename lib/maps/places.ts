/**
 * Google Places API — Text Search para obter rating, reviews e website oficial.
 * Usa a Places API (New) v1.
 * Chave: GOOGLE_PLACES_API_KEY no .env
 */

import { placesLog } from "@/lib/logger";
import { nameSimilarity, MIN_SIMILARITY } from "./name-matching";

interface PlaceReview {
    author: string;
    rating: number;
    text: string;
    relativeTime: string;
}

export interface PlacesResult {
    placeId: string | null;
    rating: number | null;
    reviewCount: number | null;
    reviews: PlaceReview[];
    website: string | null;
}

const EMPTY_RESULT: PlacesResult = {
    placeId: null,
    rating: null,
    reviewCount: null,
    reviews: [],
    website: null,
};

interface GooglePlace {
    id?: string;
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    reviews?: { authorAttribution?: { displayName?: string }; rating?: number; text?: { text?: string }; relativePublishTimeDescription?: string }[];
    websiteUri?: string;
}

/**
 * Pesquisa uma agencia no Google Places pelo nome legal + morada.
 * Pede ate 3 resultados e escolhe o que melhor corresponde ao nome da agencia.
 * Rejeita resultados com similaridade de nome abaixo de 40%.
 */
export async function fetchGooglePlaces(
    legalName: string,
    address?: string | null,
    commercialName?: string | null,
): Promise<PlacesResult> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        placesLog.warn("GOOGLE_PLACES_API_KEY not configured — skipping Google Places");
        return EMPTY_RESULT;
    }

    const query = address ? `${legalName} ${address}` : legalName;

    try {
        const searchRes = await fetch(
            "https://places.googleapis.com/v1/places:searchText",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": apiKey,
                    "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.reviews,places.websiteUri",
                },
                body: JSON.stringify({
                    textQuery: query,
                    languageCode: "pt",
                    regionCode: "PT",
                    maxResultCount: 3,
                }),
            }
        );

        if (!searchRes.ok) {
            placesLog.error({ status: searchRes.status, body: await searchRes.text() }, "Google Places API error");
            return EMPTY_RESULT;
        }

        const data = await searchRes.json();
        const places: GooglePlace[] = data.places ?? [];

        if (!places.length) return EMPTY_RESULT;

        // Escolhe o melhor match por similaridade de nome
        const namesForMatch = [legalName, commercialName].filter(Boolean) as string[];
        let bestPlace: GooglePlace | null = null;
        let bestScore = 0;

        for (const place of places) {
            const googleName = place.displayName?.text ?? "";
            if (!googleName) continue;

            const score = Math.max(...namesForMatch.map((n) => nameSimilarity(n, googleName)));
            if (score > bestScore) {
                bestScore = score;
                bestPlace = place;
            }
        }

        // Rejeitar se nenhum resultado tem similaridade suficiente
        if (!bestPlace || bestScore < MIN_SIMILARITY) {
            return EMPTY_RESULT;
        }

        const reviews: PlaceReview[] = (bestPlace.reviews || [])
            .slice(0, 3)
            .map((r) => ({
                author: r.authorAttribution?.displayName || "Anonimo",
                rating: r.rating || 0,
                text: r.text?.text || "",
                relativeTime: r.relativePublishTimeDescription || "",
            }));

        return {
            placeId: bestPlace.id || null,
            rating: bestPlace.rating || null,
            reviewCount: bestPlace.userRatingCount || null,
            reviews,
            website: bestPlace.websiteUri || null,
        };
    } catch (err) {
        placesLog.error({ err }, "Google Places fetch error");
        return EMPTY_RESULT;
    }
}
