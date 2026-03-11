/**
 * scripts/export-db.ts
 * Exporta a tabela Agency para CSV (Excel) e JSON.
 * 
 * Uso: npx tsx scripts/export-db.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
    console.log("A ler a base de dados...");

    // Busca todas as agências (ordem por RNAVT para ser mais legível)
    const agencies = await prisma.agency.findMany({
        orderBy: { rnavt: 'asc' }
    });

    if (agencies.length === 0) {
        console.log("Nenhuma agência encontrada na base de dados.");
        return;
    }

    // --- EXPORTAR PARA JSON ---
    const jsonPath = path.join(process.cwd(), "agencias_export.json");
    fs.writeFileSync(jsonPath, JSON.stringify(agencies, null, 2), "utf-8");
    console.log(`✅ Exportado para JSON: ${jsonPath}`);

    // --- EXPORTAR PARA CSV (EXCEL) ---
    // Extrai os cabeçalhos das chaves do primeiro objecto
    const headers = Object.keys(agencies[0]);

    const csvRows = [];
    // Adiciona o cabeçalho (junta tudo com vírgulas)
    csvRows.push(headers.join(","));

    // Adiciona as linhas
    for (const row of agencies) {
        const values = headers.map(header => {
            const val = (row as Record<string, unknown>)[header];

            // Trata valores nulos, arrays ou strings com vírgulas/quebras de linha
            if (val === null || val === undefined) return '""';
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;

            const strVal = String(val);
            if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
                return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        });
        csvRows.push(values.join(","));
    }

    const csvPath = path.join(process.cwd(), "agencias_export.csv");
    // Adiciona BOM para o Excel reconhecer os acentos (UTF-8)
    fs.writeFileSync(csvPath, '\uFEFF' + csvRows.join("\n"), "utf-8");
    console.log(`✅ Exportado para Excel (CSV): ${csvPath}`);
}

main()
    .catch((err) => {
        console.error("Erro na exportação:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
