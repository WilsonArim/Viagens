/**
 * nifpt-sync-worker.ts — Modo Rápido (Plano Pago)
 *
 * Processa agências em paralelo com concorrência configurável.
 * Faz backoff automático em caso de 429.
 * Retoma do ponto onde parou (ordena por nifptLastChecked ASC NULLS FIRST).
 *
 * Configuração via .env:
 *   NIFPT_API_KEY      — Chave da API nif.pt (obrigatório)
 *   NIFPT_CONCURRENCY  — Pedidos em paralelo (default: 10)
 *   NIFPT_BATCH_SIZE   — Agências por batch (default: 50)
 *   NIFPT_DELAY_MS     — Delay entre batches em ms (default: 500)
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/nifpt-sync-worker.ts
 *   # Em background:
 *   mkdir -p logs && npx tsx --env-file=.env scripts/nifpt-sync-worker.ts >> logs/nifpt-sync.log 2>&1 &
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Config ──────────────────────────────────────────────────────────────────
const API_KEY = process.env.NIFPT_API_KEY ?? "";
const CONCURRENCY = parseInt(process.env.NIFPT_CONCURRENCY ?? "10", 10);
const BATCH_SIZE = parseInt(process.env.NIFPT_BATCH_SIZE ?? "50", 10);
const DELAY_MS = parseInt(process.env.NIFPT_DELAY_MS ?? "500", 10);

// ── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function log(msg: string) {
    process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

interface NifptRecord {
    title?: string;
    status?: string;
    activity?: string;
    cae?: string | string[];
    address?: string;
    city?: string;
    start_date?: string | null;
    racius?: string;
    geo?: { region?: string; county?: string; parish?: string };
    contacts?: { website?: string; phone?: string; email?: string; fax?: string };
    structure?: { nature?: string; capital?: string; capital_currency?: string };
}

/**
 * Chama a API nif.pt para um único NIF.
 * Lança "RATE_LIMIT_429" se receber 429.
 */
async function fetchNifpt(nif: string): Promise<NifptRecord | null> {
    const res = await fetch(
        `https://www.nif.pt/?json=1&q=${nif}&key=${API_KEY}`,
        {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; DetetiveViagens/1.0)" },
            signal: AbortSignal.timeout(12_000),
        }
    );

    if (res.status === 429) throw new Error("RATE_LIMIT_429");
    if (!res.ok) throw new Error(`HTTP_${res.status}`);

    const json = await res.json() as { result?: string; records?: Record<string, unknown> };
    if (json.result !== "success" || !json.records) return null;

    const candidate = Object.values(json.records)[0] as NifptRecord;
    if (candidate.title && /key necessary|contact.*api|error|unauthorized/i.test(candidate.title)) return null;

    return candidate;
}

/**
 * Processa um único NIF com retry em 429.
 */
async function processOne(agency: { id: string; nif: string; rnavt: string; legalName: string }): Promise<"ok" | "not_found" | "error"> {
    let backoff = 60_000; // 60s no primeiro 429

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const record = await fetchNifpt(agency.nif);

            // CAE pode vir como string ou array — normaliza para o primário
            const rawCae = record?.cae;
            const cae = rawCae
                ? Array.isArray(rawCae) ? rawCae[0] : rawCae
                : null;

            await prisma.agency.update({
                where: { id: agency.id },
                data: {
                    nifptStatus: record?.status?.trim() ?? null,
                    nifptCae: cae?.toString().trim() ?? null,
                    nifptActivity: record?.activity?.trim() ?? null,
                    nifptWebsite: record?.contacts?.website?.trim() ?? null,
                    nifptEmail: record?.contacts?.email?.trim() ?? null,
                    nifptPhone: record?.contacts?.phone?.trim() ?? null,
                    nifptFax: record?.contacts?.fax?.trim() ?? null,
                    nifptNature: record?.structure?.nature?.trim() ?? null,
                    nifptCapital: record?.structure?.capital?.trim() ?? null,
                    nifptStartDate: record?.start_date?.toString() ?? null,
                    nifptRegion: record?.geo?.region?.trim() ?? null,
                    nifptCounty: record?.geo?.county?.trim() ?? null,
                    nifptParish: record?.geo?.parish?.trim() ?? null,
                    nifptRacius: record?.racius?.trim() ?? null,
                    nifptLastChecked: new Date(),
                },
            });

            return record ? "ok" : "not_found";

        } catch (err) {
            const msg = (err as Error).message;
            if (msg === "RATE_LIMIT_429") {
                log(`   ⛔ 429 em ${agency.rnavt} — backoff ${backoff / 1000}s…`);
                await sleep(backoff);
                backoff = Math.min(backoff * 2, 10 * 60_000); // max 10 min
            } else {
                log(`   ✗ Erro em ${agency.rnavt} (${agency.nif}): ${msg}`);
                return "error";
            }
        }
    }
    return "error";
}

/**
 * Corre `tasks` com no máximo `concurrency` a correr simultaneamente.
 */
async function runConcurrent<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
    const results: T[] = [];
    let i = 0;

    async function worker() {
        while (i < tasks.length) {
            const index = i++;
            results[index] = await tasks[index]();
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    if (!API_KEY) {
        log("❌ NIFPT_API_KEY não configurada no .env — a terminar.");
        process.exit(1);
    }

    log("🚀 nif.pt Bulk Sync Worker (Modo Rápido)");
    log(`   Concorrência: ${CONCURRENCY} | Batch: ${BATCH_SIZE} | Delay entre batches: ${DELAY_MS}ms`);

    const total = await prisma.agency.count();
    const synced = await prisma.agency.count({ where: { nifptLastChecked: { not: null } } });
    log(`   Total: ${total} agências (${synced} já sincronizadas, ${total - synced} por fazer)\n`);

    let globalOk = 0, globalNotFound = 0, globalErrors = 0;
    let batchNum = 0;

    while (true) {
        // SEMPRE skip: 0 — os registos processados saem do filtro null automaticamente
        // Usar skip crescente era o bug: o conjunto encolhia mas o skip aumentava
        // Lógica de filtro: processar agências com nifptLastChecked = null
        // MAS apenas para as que têm CAE 79110 ou 79120 (ou se CAE ainda for null porque nunca correu)
        const batch = await prisma.agency.findMany({
            where: {
                nifptLastChecked: null,
                OR: [
                    { nifptCae: null },
                    { nifptCae: "79110" },
                    { nifptCae: "79120" },
                ],
            },
            orderBy: { rnavt: "asc" }, // ordem estável por RNAVT
            take: BATCH_SIZE,
            select: { id: true, nif: true, rnavt: true, legalName: true },
        });

        if (batch.length === 0) {
            // Sem mais null — verifica registos desactualizados (> 30 dias)
            // Sem mais null — verifica registos desactualizados (> 30 dias)
            // Apenas para os CAEs pretendidos
            const stale = await prisma.agency.findMany({
                where: {
                    nifptLastChecked: { lt: new Date(Date.now() - 30 * 24 * 60 * 60_000) },
                    OR: [
                        { nifptCae: "79110" },
                        { nifptCae: "79120" },
                    ],
                },
                orderBy: { nifptLastChecked: "asc" },
                take: BATCH_SIZE,
                select: { id: true, nif: true, rnavt: true, legalName: true },
            });

            if (stale.length === 0) {
                log(`\n✅ Sincronização completa!`);
                log(`   ✓ ${globalOk} actualizadas | ⚠ ${globalNotFound} não encontradas | ✗ ${globalErrors} erros`);
                break;
            }

            log(`\n♻️  A re-sincronizar agências com dados > 30 dias…`);
            const tasks = stale.map((a) => () => processOne(a));
            const batchResults = await runConcurrent(tasks, CONCURRENCY);
            batchResults.forEach((r) => {
                if (r === "ok") globalOk++;
                else if (r === "not_found") globalNotFound++;
                else globalErrors++;
            });
            await sleep(DELAY_MS);
            continue;
        }

        batchNum++;
        log(`📦 Batch ${batchNum} — ${batch.length} agências restantes: ${total - globalOk - globalNotFound - globalErrors}`);

        const tasks = batch.map((a) => () => {
            return processOne(a).then((r) => {
                const icon = r === "ok" ? "✓" : r === "not_found" ? "⚠" : "✗";
                log(`   ${icon} RNAVT ${a.rnavt} | NIF ${a.nif}`);
                return r;
            });
        });

        const batchResults = await runConcurrent(tasks, CONCURRENCY);
        batchResults.forEach((r) => {
            if (r === "ok") globalOk++;
            else if (r === "not_found") globalNotFound++;
            else globalErrors++;
        });


        const done = globalOk + globalNotFound + globalErrors;
        const pct = ((done / total) * 100).toFixed(1);
        log(`   📊 ${done}/${total} (${pct}%) — ✓${globalOk} ⚠${globalNotFound} ✗${globalErrors}\n`);

        if (DELAY_MS > 0) await sleep(DELAY_MS);
    }

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("Worker crash:", err);
    process.exit(1);
});
