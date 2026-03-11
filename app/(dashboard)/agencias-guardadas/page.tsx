"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SavedAgency {
    id: string;
    createdAt: string;
    agency: {
        id: string;
        rnavt: string;
        legalName: string;
        commercialName: string | null;
        city: string | null;
        district: string | null;
        googleRating: number | null;
        googleReviewCount: number | null;
        nifptStatus: string | null;
    };
}

export default function AgenciasGuardadasPage() {
    const [saved, setSaved] = useState<SavedAgency[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/agency/saved")
            .then(r => r.json())
            .then(d => { setSaved(d.agencies ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    async function handleRemove(agencyId: string) {
        await fetch("/api/agency/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agencyId }),
        });
        setSaved(prev => prev.filter(s => s.agency.id !== agencyId));
    }

    if (loading) {
        return (
            <div className="module-container">
                <p className="eyebrow">As tuas agências</p>
                <h1>⭐ Agências Guardadas</h1>
                <p style={{ opacity: 0.4 }}>A carregar...</p>
            </div>
        );
    }

    return (
        <div className="module-container">
            <p className="eyebrow">As tuas agências</p>
            <h1>⭐ Agências Guardadas</h1>
            <p style={{ opacity: 0.45, marginBottom: "1.5rem", fontSize: "0.88rem" }}>
                Acompanha as agências que guardaste. Serás notificado se surgir algo de novo.
            </p>

            {saved.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", opacity: 0.4 }}>
                    <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⭐</p>
                    <p>Ainda não guardaste nenhuma agência.</p>
                    <Link href="/agencia" style={{ color: "inherit", fontSize: "0.85rem", marginTop: "0.5rem", display: "inline-block" }}>
                        → Explorar agências licenciadas
                    </Link>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                    {saved.map(({ agency, createdAt }) => {
                        const isActive = agency.nifptStatus !== "inactive";
                        const name = agency.commercialName ?? agency.legalName;
                        const location = [agency.city, agency.district].filter(Boolean).join(", ");
                        const savedDate = new Date(createdAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });

                        return (
                            <div key={agency.id} style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "1rem 1.2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: "200px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                                        <span style={{ fontSize: "0.72rem" }}>{isActive ? "✅" : "⚠️"}</span>
                                        <Link href={`/agencia/${agency.rnavt}`} style={{ fontWeight: 700, color: "inherit", textDecoration: "none", fontSize: "0.95rem" }}>
                                            {name}
                                        </Link>
                                    </div>
                                    <div style={{ fontSize: "0.76rem", opacity: 0.38 }}>
                                        RNAVT {agency.rnavt}{location ? ` · ${location}` : ""}
                                        <span style={{ margin: "0 0.4rem" }}>·</span>
                                        Guardada em {savedDate}
                                    </div>
                                    {agency.googleRating != null && (
                                        <div style={{ fontSize: "0.8rem", color: "#fbbf24", marginTop: "0.2rem" }}>
                                            ★ {agency.googleRating.toFixed(1)}
                                            <span style={{ opacity: 0.35, fontWeight: 400 }}> ({agency.googleReviewCount ?? 0} avaliações)</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                                    <Link
                                        href={`/agency-check?rnavt=${agency.rnavt}`}
                                        style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.07)", color: "#4ade80", textDecoration: "none", fontSize: "0.78rem", fontWeight: 600 }}
                                    >
                                        🔍 Verificar
                                    </Link>
                                    <button
                                        onClick={() => handleRemove(agency.id)}
                                        style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "inherit", fontSize: "0.78rem", cursor: "pointer", opacity: 0.5 }}
                                    >
                                        × Remover
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
