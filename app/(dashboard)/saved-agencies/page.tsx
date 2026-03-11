"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SavedEntry {
    id: string;
    createdAt: string;
    agency: {
        rnavt: string;
        legalName: string;
        commercialName: string | null;
        city: string | null;
        district: string | null;
        googleRating: number | null;
        googleReviewCount: number | null;
        googlePlaceId: string | null;
        nifptStatus: string | null;
    };
}

function Stars({ rating, count }: { rating: number; count?: number | null }) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.3 && rating % 1 < 0.8;
    const empty = 5 - full - (half ? 1 : 0);
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
            <span style={{ color: "#fbbf24" }}>{"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(Math.max(0, empty))}</span>
            <strong style={{ color: "#fbbf24" }}>{rating.toFixed(1)}</strong>
            {count != null && <span style={{ opacity: 0.4, fontSize: "0.75rem" }}>({count.toLocaleString("pt-PT")})</span>}
        </span>
    );
}

export default function SavedAgenciesPage() {
    const [entries, setEntries] = useState<SavedEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/agencies/saved")
            .then(r => r.json())
            .then(data => setEntries(data.saved ?? []))
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, []);

    async function handleRemove(rnavt: string, entryId: string) {
        setRemovingId(entryId);
        try {
            await fetch(`/api/agencies/${rnavt}/save`, { method: "DELETE" });
            setEntries(prev => prev.filter(e => e.id !== entryId));
        } catch {
            // silently ignore
        } finally {
            setRemovingId(null);
        }
    }

    return (
        <div className="module-container">
            <p className="eyebrow">Favoritos</p>
            <h1>★ Agências Guardadas</h1>
            <p style={{ opacity: 0.5, marginBottom: "1.5rem" }}>
                Agências que estás a acompanhar. Verifica o estado antes de pagar qualquer viagem.
            </p>

            {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", opacity: 0.5 }}>
                    <span className="loading-spinner" style={{ width: 18, height: 18 }} />
                    A carregar…
                </div>
            )}

            {!loading && entries.length === 0 && (
                <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>☆</div>
                    <p style={{ opacity: 0.5, marginBottom: "1.2rem" }}>
                        Ainda não guardaste nenhuma agência. Verifica uma agência e clica em &ldquo;☆ Guardar&rdquo;.
                    </p>
                    <Link
                        href="/agency-check"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.65rem 1.2rem", borderRadius: "10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "inherit", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}
                    >
                        🔍 Verificar Agência
                    </Link>
                </div>
            )}

            {!loading && entries.length > 0 && (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                    {entries.map(entry => {
                        const { agency } = entry;
                        const isActive = agency.nifptStatus === "active" || !agency.nifptStatus;
                        const location = [agency.city, agency.district].filter(Boolean).join(", ");

                        return (
                            <div
                                key={entry.id}
                                className="glass-card"
                                style={{ padding: "1.1rem 1.3rem", display: "flex", alignItems: "center", gap: "1rem" }}
                            >
                                {/* Status dot */}
                                <div style={{
                                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                                    background: isActive ? "#4ade80" : "#f87171",
                                    boxShadow: isActive ? "0 0 8px rgba(74,222,128,0.5)" : "0 0 8px rgba(248,113,113,0.4)",
                                }} />

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                                        <strong style={{ fontSize: "0.95rem" }}>
                                            {agency.commercialName || agency.legalName}
                                        </strong>
                                        <span style={{ fontSize: "0.75rem", opacity: 0.35, fontWeight: 500 }}>
                                            RNAVT {agency.rnavt}
                                        </span>
                                    </div>
                                    {location && (
                                        <div style={{ fontSize: "0.8rem", opacity: 0.4, marginTop: "0.1rem" }}>{location}</div>
                                    )}
                                    {agency.googleRating != null && (
                                        <div style={{ marginTop: "0.25rem" }}>
                                            <Stars rating={agency.googleRating} count={agency.googleReviewCount} />
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                                    <Link
                                        href={`/agencia/${agency.rnavt}`}
                                        target="_blank"
                                        style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.75rem", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "inherit", textDecoration: "none", fontSize: "0.78rem", fontWeight: 600 }}
                                    >
                                        Ver ficha ↗
                                    </Link>
                                    <button
                                        onClick={() => handleRemove(agency.rnavt, entry.id)}
                                        disabled={removingId === entry.id}
                                        style={{ display: "inline-flex", alignItems: "center", padding: "0.35rem 0.6rem", borderRadius: "8px", background: "transparent", border: "1px solid rgba(248,113,113,0.2)", color: "rgba(248,113,113,0.7)", cursor: "pointer", fontSize: "0.8rem" }}
                                        title="Remover dos favoritos"
                                    >
                                        {removingId === entry.id ? "…" : "✕"}
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
