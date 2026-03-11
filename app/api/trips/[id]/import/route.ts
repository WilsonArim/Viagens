import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { generateGeminiContent, extractJsonFromText } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";

interface ExtractedReservation {
    hotelName: string;
    destination: string;
    checkIn: string;
    checkOut: string;
    totalPrice: string;
    currency: string;
    guests: number;
    confirmationCode: string;
    notes: string;
}

// POST /api/trips/[id]/import — extract reservation from pasted email and auto Raio-X
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const body = await req.json().catch(() => null);

    if (!body?.emailText || typeof body.emailText !== "string") {
        return NextResponse.json({ error: "emailText é obrigatório" }, { status: 400 });
    }

    if (body.emailText.length > 10_000) {
        return NextResponse.json({ error: "Texto demasiado longo (máximo 10.000 caracteres)" }, { status: 400 });
    }

    // Verify trip ownership
    const trip = await prisma.trip.findFirst({ where: { id, userId: session.user.id, deletedAt: null } });
    if (!trip) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

    // Step 1: Use Gemini to extract reservation data from email text
    const extractionPrompt = `Extrai os dados de reserva deste email/texto. Responde APENAS com JSON válido.
<email>${body.emailText.slice(0, 3000)}</email>
<output>JSON: {"hotelName":"...","destination":"...","checkIn":"YYYY-MM-DD","checkOut":"YYYY-MM-DD","totalPrice":"...","currency":"EUR","guests":0,"confirmationCode":"...","notes":"observações relevantes"}</output>
Se algum campo não estiver disponível, usa string vazia ou 0.`;

    const fallback: ExtractedReservation = {
        hotelName: "", destination: "", checkIn: "", checkOut: "",
        totalPrice: "", currency: "EUR", guests: 0, confirmationCode: "", notes: "Não foi possível extrair dados automaticamente",
    };

    const extractionResult = await generateGeminiContent(extractionPrompt, {
        temperature: 0.2,
        fallbackText: JSON.stringify(fallback),
    });

    const extracted = extractJsonFromText(extractionResult.text, fallback) as ExtractedReservation;

    // Step 2: Auto Raio-X if hotel name was extracted
    const sanitize = (s: string, maxLen = 200) => s.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
    let xrayResult = null;
    if (extracted.hotelName && extracted.destination) {
        const safeHotel = sanitize(extracted.hotelName);
        const safeDest = sanitize(extracted.destination);
        const xrayPrompt = `<persona>Detetive de Hospitalidade, objectivo e clínico, PT-PT.</persona>
<benchmark>Padrão das Caraíbas: fartura, energia, zero fricção.</benchmark>
<input>Hotel: ${safeHotel}\nDestino: ${safeDest}</input>
<output>JSON: {"verdict":"Excelente"|"Aceitável"|"Evitar","abundanceIndex":number,"redFlags":string[],"pros":string[],"cons":string[],"saferAlternative":string,"realExperience":string,"executiveSummary":string}</output>`;

        const xrayFallback = { verdict: "Aceitável", abundanceIndex: 50, redFlags: ["Dados limitados"], pros: [], cons: [], saferAlternative: "", realExperience: "", executiveSummary: "Análise preventiva." };
        const xrayRes = await generateGeminiContent(xrayPrompt, { temperature: 0.55, fallbackText: JSON.stringify(xrayFallback) });
        xrayResult = extractJsonFromText(xrayRes.text, xrayFallback);

        // Save as TripSearch + HotelAnalysis
        const xrayData = xrayResult as Record<string, unknown>;
        const search = await prisma.tripSearch.create({
            data: {
                userId: session.user.id,
                tripId: id,
                destination: extracted.destination,
                queryType: "XRAY",
                queryPayload: { hotelName: extracted.hotelName, source: "import" },
                results: xrayData as unknown as Prisma.InputJsonValue,
            },
        });

        await prisma.hotelAnalysis.create({
            data: {
                userId: session.user.id,
                tripSearchId: search.id,
                hotelName: extracted.hotelName,
                destination: extracted.destination,
                verdict: (xrayData.verdict as string) ?? "Aceitável",
                abundanceIndex: (xrayData.abundanceIndex as number) ?? 50,
                redFlags: Array.isArray(xrayData.redFlags) ? xrayData.redFlags as string[] : [],
                realExperience: (xrayData.realExperience as string) ?? "",
                rawResponse: JSON.stringify(xrayData),
                cachedKey: `import_${extracted.hotelName}_${extracted.destination}_${Date.now()}`.toLowerCase(),
            },
        });
    }

    return NextResponse.json({
        extracted,
        xrayResult,
        message: xrayResult
            ? `Reserva extraída e Raio-X automático feito ao ${extracted.hotelName}.`
            : "Reserva extraída. Sem dados suficientes para Raio-X automático.",
    });
}
