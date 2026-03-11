import * as XLSX from "xlsx";
import path from "path";

async function main() {
    const wb = XLSX.readFile(path.resolve("registos_avt_2026.xlsx"));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    // Agrupar por RNAVT
    const byRnavt: Record<string, Record<string, string>[]> = {};

    for (const row of rows) {
        const rnavt = row["rnavt"]?.toString().trim();
        if (!rnavt) continue;

        if (!byRnavt[rnavt]) {
            byRnavt[rnavt] = [];
        }
        byRnavt[rnavt].push(row);
    }

    // Identificar discrepâncias entre duplicados
    let totalDupes = 0;
    let exactDupes = 0;
    let filiais = 0;

    console.log("Analisando agências com o mesmo RNAVT...\n");

    for (const [rnavt, records] of Object.entries(byRnavt)) {
        if (records.length > 1) {
            totalDupes++;

            const first = records[0];
            let isExact = true;
            const diffKeys: string[] = [];

            for (let i = 1; i < records.length; i++) {
                const current = records[i];
                for (const key of Object.keys(first)) {
                    // Ignorar espaços vazios ou dados nulos que não afetam a substância
                    const v1 = first[key]?.toString().trim() || "";
                    const v2 = current[key]?.toString().trim() || "";

                    if (v1 !== v2) {
                        isExact = false;
                        if (!diffKeys.includes(key)) diffKeys.push(key);
                    }
                }
            }

            if (isExact) {
                exactDupes++;
            } else {
                filiais++;
                if (filiais <= 5) { // Mostrar os primeiros 5 exemplos
                    console.log(`RNAVT ${rnavt} tem linhas DIFERENTES:`);
                    console.log(`- Diferenças encontradas nas colunas: ${diffKeys.join(", ")}`);
                    records.forEach((r, idx) => {
                        console.log(`  [Linha ${idx + 1}] Morada: ${r["Sede (Endereço)"]?.trim()} | Localidade: ${r["Sede  (Localidade)"]?.trim()}`);
                    });
                    console.log("---");
                }
            }
        }
    }

    console.log(`\nRESUMO DOS DUPLICADOS:`);
    console.log(`Total de RNAVTs com mais que 1 linha: ${totalDupes} (representam as ${291} linhas extra)`);
    console.log(`- CÓPIAS EXATAS (100% igual): ${exactDupes}`);
    console.log(`- FILIAIS / ALTERAÇÕES (difere na morada, nome ou contactos): ${filiais}`);
}

main().catch(console.error);
