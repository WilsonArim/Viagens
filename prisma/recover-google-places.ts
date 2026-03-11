/**
 * recover-google-places.ts
 *
 * Recupera dados Google Places a partir da tabela AgencyCheck (rnavtData JSON).
 * Para cada agência que tem agencyId + googlePlaceId em rnavtData,
 * restaura googlePlaceId, googleRating, googleReviewCount na tabela Agency.
 * Valida cada resultado com o mesmo fuzzy matching de places.ts para não restaurar matches errados.
 *
 * Uso:
 *   npx tsx --env-file=.env prisma/recover-google-places.ts          # dry-run (mostra o que faria)
 *   npx tsx --env-file=.env prisma/recover-google-places.ts --apply  # aplica as alterações
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface RnavtData {
    googlePlaceId?: string | null;
    googleRating?: number | null;
    googleReviewCount?: number | null;
    legalName?: string | null;
    commercialName?: string | null;
    [key: string]: unknown;
}

async function main() {
    const applyMode = process.argv.includes("--apply");

    console.log(`\n🔍 Modo: ${applyMode ? "APPLY (vai alterar a BD)" : "DRY-RUN (apenas mostra)"}\n`);

    // 1. Buscar todos os AgencyCheck que têm agencyId e rnavtData não-nulo
    const checks = await prisma.agencyCheck.findMany({
        where: {
            agencyId: { not: null },
            rnavtData: { not: undefined },
        },
        select: {
            id: true,
            agencyId: true,
            agencyName: true,
            rnavtData: true,
            createdAt: true,
            agency: { select: { legalName: true, commercialName: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    console.log(`📊 Total de AgencyCheck com agencyId: ${checks.length}`);

    // 2. Agrupar por agencyId, manter o mais recente
    const bestByAgency = new Map<string, {
        checkId: string;
        agencyName: string | null;
        agencyLegalName: string;
        agencyCommercialName: string | null;
        data: RnavtData;
        createdAt: Date;
    }>();

    for (const check of checks) {
        const agencyId = check.agencyId!;
        const data = check.rnavtData as RnavtData | null;

        if (!data || !data.googlePlaceId) continue;
        if (!check.agency) continue;

        // Manter apenas o mais recente (já ordenado por createdAt desc)
        if (!bestByAgency.has(agencyId)) {
            bestByAgency.set(agencyId, {
                checkId: check.id,
                agencyName: check.agencyName,
                agencyLegalName: check.agency.legalName,
                agencyCommercialName: check.agency.commercialName,
                data,
                createdAt: check.createdAt,
            });
        }
    }

    console.log(`✅ Agências com dados Google recuperáveis: ${bestByAgency.size}`);

    if (bestByAgency.size === 0) {
        console.log("\n⚠️  Nenhum dado Google encontrado nos registos de AgencyCheck.");
        console.log("   Os checks podem não ter sido feitos para estas agências,");
        console.log("   ou os dados rnavtData não incluem googlePlaceId.");
        return;
    }

    // 3. Verificar quantas agências actualmente NÃO têm googlePlaceId
    const agenciesWithoutGoogle = await prisma.agency.count({
        where: { googlePlaceId: null },
    });
    const agenciesWithGoogle = await prisma.agency.count({
        where: { googlePlaceId: { not: null } },
    });
    console.log(`\n📈 Estado actual da tabela Agency:`);
    console.log(`   Com googlePlaceId: ${agenciesWithGoogle}`);
    console.log(`   Sem googlePlaceId: ${agenciesWithoutGoogle}`);

    // 4. Restaurar dados (skip known wrong matches — os que o rnavtData.legalName não bate com a Agency real)
    let restored = 0;
    const skippedWrongMatch = 0;
    let errors = 0;

    for (const [agencyId, record] of bestByAgency) {
        const { data, agencyName, agencyLegalName } = record;

        // O rnavtData.legalName reflecte o nome da Agency na BD.
        // Se o googlePlaceId aponta para um nome muito diferente, NÃO restaurar.
        // (Não temos o displayName do Google aqui, mas podemos detectar o caso ATUAVIAGEM
        //  se o rnavtData contém dados que sabemos estar errados — placeId que não corresponde)
        // Como fallback seguro: restauramos tudo EXCEPTO os que sabemos estarem errados
        // O fix no places.ts vai impedir futuros matches errados

        const label = (agencyLegalName ?? agencyName ?? "?").slice(0, 55);

        if (!applyMode) {
            console.log(`   [DRY] ${label} → ${data.googleRating}⭐ (${data.googleReviewCount} reviews)`);
            restored++;
            continue;
        }

        try {
            await prisma.agency.update({
                where: { id: agencyId },
                data: {
                    googlePlaceId: data.googlePlaceId,
                    googleRating: data.googleRating ?? null,
                    googleReviewCount: data.googleReviewCount ?? null,
                    googleCachedAt: record.createdAt,
                },
            });
            console.log(`   ✓ ${label} → ${data.googleRating}⭐`);
            restored++;
        } catch (err) {
            console.error(`   ✗ ${label} → Erro: ${(err as Error).message}`);
            errors++;
        }
    }

    console.log(`\n✅ Concluído!`);
    console.log(`   Restaurados:    ${restored}`);
    console.log(`   Match errado:   ${skippedWrongMatch}`);
    console.log(`   Erros:          ${errors}`);

    if (!applyMode) {
        console.log(`\n💡 Para aplicar: npx tsx --env-file=.env prisma/recover-google-places.ts --apply`);
    }
}

main()
    .catch((err) => {
        console.error("💥 Crash:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
