import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

async function getCheck(token: string) {
    return prisma.agencyCheck.findUnique({
        where: { shareToken: token },
        include: {
            agency: {
                select: {
                    rnavt: true, legalName: true, commercialName: true,
                    city: true, district: true, nif: true,
                    phone: true, googleRating: true, googleReviewCount: true,
                    googlePlaceId: true, nifptStatus: true,
                },
            },
        },
    });
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
    const { token } = await params;
    const check = await getCheck(token);
    if (!check) return { title: "Verificação não encontrada" };

    const name = check.agencyName ?? check.agency?.legalName ?? "Agência";
    const isOk = check.verdict === "safe";

    return {
        title: `Verificação de ${name} | Amigo de Viagens`,
        description: `${isOk ? "✅" : "⚠️"} ${name} — resultado de verificação RNAVT. ${check.verdictText} Partilhado via Amigo de Viagens.`,
    };
}

const VERDICT_CFG = {
    safe: { icon: "✅", color: "#4ade80", border: "rgba(74,222,128,0.4)", bg: "rgba(74,222,128,0.06)", label: "Agência Licenciada" },
    caution: { icon: "⚠️", color: "#fbbf24", border: "rgba(251,191,36,0.4)", bg: "rgba(251,191,36,0.06)", label: "Atenção" },
    danger: { icon: "🚨", color: "#f87171", border: "rgba(248,113,113,0.5)", bg: "rgba(248,113,113,0.07)", label: "Alto Risco" },
    not_found: { icon: "❓", color: "#fbbf24", border: "rgba(251,191,36,0.4)", bg: "rgba(251,191,36,0.06)", label: "Não Encontrada" },
} as const;

export default async function VerificacaoPublicaPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const check = await getCheck(token);
    if (!check) notFound();

    const cfg = VERDICT_CFG[check.verdict as keyof typeof VERDICT_CFG] ?? VERDICT_CFG.caution;
    const agencyName = check.agencyName ?? check.agency?.commercialName ?? check.agency?.legalName ?? "Agência desconhecida";
    const location = [check.agency?.city, check.agency?.district].filter(Boolean).join(", ");
    const checkedAt = new Date(check.createdAt).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.2rem", background: "var(--bg-primary, #0a0a0a)" }}>

            {/* Card */}
            <div style={{ maxWidth: "540px", width: "100%", borderRadius: "20px", border: `1.5px solid ${cfg.border}`, background: `linear-gradient(135deg, ${cfg.bg} 0%, rgba(0,0,0,0) 70%)`, padding: "2.2rem", boxShadow: `0 0 60px ${cfg.bg}` }}>

                {/* Brand */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.8rem", opacity: 0.5 }}>
                    <span style={{ fontSize: "0.85rem" }}>🕵️</span>
                    <Link href="/" style={{ fontSize: "0.78rem", fontWeight: 700, color: "inherit", textDecoration: "none", letterSpacing: "0.05em" }}>
                        AMIGO DE VIAGENS
                    </Link>
                    <span style={{ marginLeft: "auto", fontSize: "0.72rem" }}>Certificado de Verificação</span>
                </div>

                {/* Verdict */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1.4rem" }}>
                    <span style={{ fontSize: "2.2rem", flexShrink: 0, lineHeight: 1 }}>{cfg.icon}</span>
                    <div>
                        <div style={{ fontWeight: 800, color: cfg.color, fontSize: "1.1rem", marginBottom: "0.2rem" }}>{cfg.label}</div>
                        <p style={{ fontSize: "0.92rem", opacity: 0.8, margin: 0, lineHeight: 1.5 }}>{check.verdictText}</p>
                    </div>
                </div>

                {/* Agency details */}
                <div style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "1.1rem", marginBottom: "1.2rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>{agencyName}</div>
                    {location && <div style={{ fontSize: "0.82rem", opacity: 0.4, marginBottom: "0.5rem" }}>📍 {location}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.6rem", marginTop: "0.6rem" }}>
                        {check.rnavt && (
                            <div>
                                <div style={{ fontSize: "0.68rem", opacity: 0.35, marginBottom: "0.1rem" }}>RNAVT</div>
                                <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>{check.rnavt}</div>
                            </div>
                        )}
                        {check.agency?.nif && (
                            <div>
                                <div style={{ fontSize: "0.68rem", opacity: 0.35, marginBottom: "0.1rem" }}>NIF</div>
                                <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>{check.agency.nif}</div>
                            </div>
                        )}
                        {check.agency?.googleRating != null && (
                            <div>
                                <div style={{ fontSize: "0.68rem", opacity: 0.35, marginBottom: "0.1rem" }}>Google</div>
                                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fbbf24" }}>★ {check.agency.googleRating.toFixed(1)}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Red flags */}
                {check.redFlags.length > 0 && (
                    <div style={{ marginBottom: "1.2rem" }}>
                        {check.redFlags.map((f, i) => (
                            <div key={i} style={{ padding: "0.35rem 0.75rem", marginBottom: "0.3rem", borderRadius: "6px", background: "rgba(248,113,113,0.07)", borderLeft: "2px solid rgba(248,113,113,0.4)", fontSize: "0.82rem" }}>
                                🚩 {f}
                            </div>
                        ))}
                    </div>
                )}

                {/* Timestamp & source */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.72rem", opacity: 0.35, flexWrap: "wrap", gap: "0.3rem" }}>
                    <span>Verificado em {checkedAt}</span>
                    <span>Registo Nacional de Turismo · Turismo de Portugal</span>
                </div>

                {/* CTA */}
                <div style={{ marginTop: "1.4rem", paddingTop: "1.2rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <Link
                        href="/agency-check"
                        style={{ flex: 1, minWidth: "140px", padding: "0.6rem 1rem", borderRadius: "10px", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none", textAlign: "center" }}
                    >
                        🔍 Verificar outra agência
                    </Link>
                    {check.agency?.rnavt && (
                        <Link
                            href={`/agencia/${check.agency.rnavt}`}
                            style={{ flex: 1, minWidth: "140px", padding: "0.6rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "inherit", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none", textAlign: "center" }}
                        >
                            Ver ficha completa →
                        </Link>
                    )}
                </div>
            </div>

            {/* Brand footer */}
            <p style={{ marginTop: "1.2rem", fontSize: "0.75rem", opacity: 0.25 }}>
                Verificação powered by <Link href="/" style={{ color: "inherit" }}>Amigo de Viagens</Link>
            </p>
        </div>
    );
}
