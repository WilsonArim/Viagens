import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

interface ExcelRow {
    "rnavt": string;                     // era "Nº de registo" — estava ERRADO
    "Data do registo"?: string;
    "Denominação": string;
    "Nº de contribuinte": string;
    "Marcas"?: string;
    "Sede (Endereço)"?: string;
    "Sede (Código postal)"?: string;
    "Sede  (Localidade)"?: string;       // duplo espaço confirmado
    "Sede (Concelho)"?: string;
    "Sede (Distrito)"?: string;
    "ERT DRT"?: string;
    "NUT II"?: string;
    "NUT III"?: string;
    "Contacto (Telef/Telem.)"?: string;
    "Contacto (Email)"?: string;
}

function clean(val: string | undefined | null): string | null {
    if (!val) return null;
    const trimmed = val.toString().trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function main() {
    const filePath = path.resolve(__dirname, "..", "registos_avt_2026.xlsx");
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

    console.log(`📋 ${rows.length} registos encontrados no Excel`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
        const rnavt = clean(row["rnavt"]);
        const nif = clean(row["Nº de contribuinte"]);

        if (!rnavt || !nif) {
            skipped++;
            continue;
        }

        try {
            await prisma.agency.upsert({
                where: { rnavt },
                create: {
                    rnavt,
                    nif,
                    legalName: row["Denominação"]?.trim() || "SEM DENOMINAÇÃO",
                    commercialName: clean(row["Marcas"]),
                    address: clean(row["Sede (Endereço)"]),
                    postalCode: clean(row["Sede (Código postal)"]),
                    city: clean(row["Sede  (Localidade)"]),
                    district: clean(row["Sede (Distrito)"]),
                    phone: clean(row["Contacto (Telef/Telem.)"]),
                },
                update: {
                    // Actualiza campos que podem ter mudado
                    nif,
                    legalName: row["Denominação"]?.trim() || "SEM DENOMINAÇÃO",
                    commercialName: clean(row["Marcas"]),
                    address: clean(row["Sede (Endereço)"]),
                    postalCode: clean(row["Sede (Código postal)"]),
                    city: clean(row["Sede  (Localidade)"]),
                    district: clean(row["Sede (Distrito)"]),
                    phone: clean(row["Contacto (Telef/Telem.)"]),
                },
            });
            created++;
        } catch (err) {
            errors++;
            if (errors <= 5) {
                console.error(`❌ Erro no RNAVT ${rnavt}:`, (err as Error).message);
            }
        }
    }

    console.log(`\n✅ Seed completo!`);
    console.log(`   Inseridos/existentes: ${created}`);
    console.log(`   Ignorados (sem RNAVT/NIF): ${skipped}`);
    if (errors > 0) console.log(`   Erros: ${errors}`);
}

main()
    .catch((err) => {
        console.error("💥 Falha no seed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
