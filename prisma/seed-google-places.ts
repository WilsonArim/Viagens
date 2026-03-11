/**
 * seed-google-places.ts
 *
 * Pre-fetch em massa do Google Places para todas as agências.
 * Processa uma por uma com 300ms de delay entre chamadas.
 *
 * Uso:
 *   npx tsx --env-file=.env prisma/seed-google-places.ts          # só agências sem googlePlaceId
 *   npx tsx --env-file=.env prisma/seed-google-places.ts --reset   # limpa TUDO e re-pesquisa
 */

import { PrismaClient } from "@prisma/client";
import { fetchGooglePlaces } from "../lib/maps/places";

const prisma = new PrismaClient();
const DELAY_MS = 300;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
    const resetMode = process.argv.includes("--reset");

    if (resetMode) {
        console.log("\n🔄 Modo RESET — a limpar todos os dados Google Places...");
        const { count } = await prisma.agency.updateMany({
            data: {
                googlePlaceId: null,
                googleRating: null,
                googleReviewCount: null,
                googleReviews: [],
                googleCachedAt: null,
            },
        });
        console.log(`   ✓ ${count} agências limpas.\n`);
    }

    const agencies = await prisma.agency.findMany({
        where: { googlePlaceId: null },
        select: { id: true, legalName: true, commercialName: true, address: true },
        orderBy: { legalName: "asc" },
    });

    const total = agencies.length;
    console.log(`\n🗺️  Google Places Seed — ${total} agências por processar\n`);

    if (total === 0) {
        console.log("✅ Todas as agências já têm googlePlaceId. Nada a fazer.");
        return;
    }

    // Preflight: testa uma chamada à API antes de processar 3500+ agências
    console.log("🔍 Preflight — a testar acesso à Google Places API...");
    const testResult = await testApiAccess();
    if (!testResult) {
        console.error("💥 Google Places API inacessível. Ativa em: https://console.developers.google.com/apis/api/places.googleapis.com");
        console.error("   As agências ficam SEM dados Google até a API funcionar (preferível a dados errados).");
        return;
    }
    console.log("✅ API acessível. A processar...\n");

    let found = 0;
    let notFound = 0;
    let errors = 0;
    let consecutiveEmpty = 0;

    for (let i = 0; i < agencies.length; i++) {
        const agency = agencies[i];
        const label = `[${i + 1}/${total}]`;

        try {
            const places = await fetchGooglePlaces(agency.legalName, agency.address, agency.commercialName);

            if (places.placeId) {
                await prisma.agency.update({
                    where: { id: agency.id },
                    data: {
                        googlePlaceId: places.placeId,
                        googleRating: places.rating,
                        googleReviewCount: places.reviewCount,
                        googleReviews: places.reviews as object[],
                        googleCachedAt: new Date(),
                    },
                });

                const stars = places.rating ? `${places.rating}⭐ (${places.reviewCount} reviews)` : "sem rating";
                console.log(`${label} ✓ ${agency.legalName.slice(0, 50)} → ${stars}`);
                found++;
                consecutiveEmpty = 0;
            } else {
                // Grava googleCachedAt mesmo assim para não processar de novo
                await prisma.agency.update({
                    where: { id: agency.id },
                    data: { googleCachedAt: new Date() },
                });
                console.log(`${label} ⚠ ${agency.legalName.slice(0, 50)} → Sem ficha no Google`);
                notFound++;
                consecutiveEmpty++;
            }
        } catch (err) {
            const msg = (err as Error).message;
            console.error(`${label} ✗ ${agency.legalName.slice(0, 50)} → Erro: ${msg}`);
            errors++;
            consecutiveEmpty++;
        }

        // Abortar se 20 resultados consecutivos vazios no início (possível problema de API)
        if (consecutiveEmpty >= 20 && found === 0) {
            console.error("\n💥 20 resultados vazios consecutivos sem nenhum sucesso — possível problema de API. A abortar.");
            break;
        }

        // Progresso percentual a cada 100 agências
        if ((i + 1) % 100 === 0) {
            const pct = (((i + 1) / total) * 100).toFixed(1);
            const etaSeconds = ((total - i - 1) * DELAY_MS) / 1000;
            const etaMin = (etaSeconds / 60).toFixed(0);
            console.log(`\n📊 Progresso: ${i + 1}/${total} (${pct}%) — ETA ≈ ${etaMin} min\n`);
        }

        if (i < agencies.length - 1) await sleep(DELAY_MS);
    }

    console.log(`\n✅ Concluído!`);
    console.log(`   ✓ Com ficha Google: ${found}`);
    console.log(`   ⚠ Sem ficha:        ${notFound}`);
    console.log(`   ✗ Erros:            ${errors}`);
    console.log(`   Total:              ${total}`);
}

/** Testa se a API está acessível com uma pesquisa conhecida */
async function testApiAccess(): Promise<boolean> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        console.error("   ⚠ GOOGLE_PLACES_API_KEY não definida no .env");
        return false;
    }
    try {
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": "places.id",
            },
            body: JSON.stringify({ textQuery: "Viagens Abreu Lisboa", languageCode: "pt", regionCode: "PT", maxResultCount: 1 }),
        });
        if (!res.ok) {
            const body = await res.text();
            console.error(`   ⚠ API respondeu ${res.status}: ${body.slice(0, 200)}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error(`   ⚠ Erro de rede: ${(err as Error).message}`);
        return false;
    }
}

main()
    .catch((err) => {
        console.error("💥 Crash:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
