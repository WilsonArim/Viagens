"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface OfficialAgency {
    rnavt: string;
    nif: string;
    legalName: string;
    commercialName?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    district?: string | null;
    phone?: string | null;
    googleRating?: number | null;
    googleReviewCount?: number | null;
    googlePlaceId?: string | null;
}

interface LinkAnalysis {
    rnavtFound: string | null;
    agencyNameFound: string | null;
    followers: string | null;
    ageDescription: string | null;
    redFlags: string[];
    summary: string;
    mismatch: boolean;
    rnavtBelongsTo: string | null;
}

type Verdict = "safe" | "caution" | "danger" | "not_found";

// ── Verdict config ─────────────────────────────────────────────────────────
const VERDICT_CFG: Record<Verdict, { color: string; bg: string; border: string; icon: string; label: string }> = {
    safe: { color: "#4ade80", bg: "rgba(74,222,128,0.07)", border: "rgba(74,222,128,0.5)", icon: "✅", label: "Agência Licenciada" },
    caution: { color: "#fbbf24", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.5)", icon: "⚠️", label: "Atenção" },
    danger: { color: "#f87171", bg: "rgba(248,113,113,0.09)", border: "rgba(248,113,113,0.6)", icon: "🚨", label: "Alto Risco" },
    not_found: { color: "#fbbf24", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.5)", icon: "❓", label: "Não Encontrada" },
};

// ── Micro-components ───────────────────────────────────────────────────────
function Stars({ rating, count, placeId }: { rating: number; count?: number | null; placeId?: string | null }) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.3 && rating % 1 < 0.8;
    const empty = 5 - full - (half ? 1 : 0);
    const stars = <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
        <span style={{ color: "#fbbf24", fontSize: "1.05rem", letterSpacing: "1px" }}>
            {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(Math.max(0, empty))}
        </span>
        <strong style={{ color: "#fbbf24" }}>{rating.toFixed(1)}</strong>
        {count != null && <span style={{ opacity: 0.4, fontSize: "0.78rem" }}>({count.toLocaleString("pt-PT")} avaliações)</span>}
        {placeId && <span style={{ fontSize: "0.72rem", opacity: 0.5 }}>↗</span>}
    </span>;

    if (placeId) {
        return <a href={`https://www.google.com/maps/place/?q=place_id:${placeId}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "inline-flex" }}>{stars}</a>;
    }
    return stars;
}

function DataGrid({ items }: { items: [string, string | null | undefined][] }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.8rem" }}>
            {items.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                    <div style={{ fontSize: "0.7rem", opacity: 0.38, marginBottom: "0.15rem" }}>{k}</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{v}</div>
                </div>
            ))}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AgencyCheckPage() {
    const [agencyName, setAgencyName] = useState("");
    const [rnavt, setRnavt] = useState("");
    const [nipc, setNipc] = useState("");
    const [socialUrl, setSocialUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [verdict, setVerdict] = useState<Verdict | null>(null);
    const [verdictText, setVerdictText] = useState("");
    const [official, setOfficial] = useState<OfficialAgency | null>(null);
    const [linkAnalysis, setLinkAnalysis] = useState<LinkAnalysis | null>(null);
    const [fromCache, setFromCache] = useState(false);
    const [cacheAge, setCacheAge] = useState<number | undefined>(undefined);
    const [error, setError] = useState("");
    // Phase 4: engagement
    const [checkId, setCheckId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [savingAgency, setSavingAgency] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareCopied, setShareCopied] = useState(false);
    const [sharingCheck, setSharingCheck] = useState(false);

    async function handleCheck(forceRefresh = false) {
        if (!agencyName && !rnavt && !nipc && !socialUrl) {
            setError("Preenche pelo menos um campo para verificar."); return;
        }
        setError("");
        setLoading(true);
        if (!forceRefresh) {
            setVerdict(null); setOfficial(null); setLinkAnalysis(null);
            setFromCache(false); setCacheAge(undefined); setVerdictText("");
            setCheckId(null); setSaved(false); setShareUrl(null); setShareCopied(false);
        }

        try {
            const res = await fetch("/api/agency/check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agencyName, rnavt, nipc, socialUrl, forceRefresh }),
            });
            const data = await res.json();

            if (data.verdict) {
                setVerdict(data.verdict as Verdict);
                setVerdictText(data.verdictText ?? "");
                setOfficial(data.officialAgency ?? null);
                setLinkAnalysis(data.linkAnalysis ?? null);
                setFromCache(data.fromCache ?? false);
                setCacheAge(data.cacheAge);
                setCheckId(data.id ?? null);
                setShareUrl(data.shareToken ? `${window.location.origin}/verificacao/${data.shareToken}` : null);
            } else {
                setError("Erro na verificação. Tenta novamente.");
            }
        } catch {
            setError("Erro de rede. Verifica a ligação e tenta novamente.");
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!official?.rnavt || savingAgency) return;
        setSavingAgency(true);
        try {
            const method = saved ? "DELETE" : "POST";
            const res = await fetch(`/api/agencies/${official.rnavt}/save`, { method });
            const data = await res.json();
            setSaved(data.saved);
        } catch {
            // silently ignore
        } finally {
            setSavingAgency(false);
        }
    }

    async function handleShare() {
        if (!checkId || sharingCheck) return;
        if (shareUrl) {
            await navigator.clipboard.writeText(shareUrl);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2500);
            return;
        }
        setSharingCheck(true);
        try {
            const res = await fetch(`/api/agency/check/${checkId}/share`, { method: "POST" });
            const data = await res.json();
            if (data.url) {
                const url = data.url.replace(process.env.NEXT_PUBLIC_APP_URL ?? "", window.location.origin);
                setShareUrl(url);
                await navigator.clipboard.writeText(url);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2500);
            }
        } catch {
            // silently ignore
        } finally {
            setSharingCheck(false);
        }
    }

    const cfg = verdict ? VERDICT_CFG[verdict] : null;

    return (
        <div className="module-container">
            <p className="eyebrow">Verificação</p>
            <h1>🔍 Verificar Agência</h1>
            <p style={{ opacity: 0.5, marginBottom: "1.5rem" }}>
                Cola o nome, RNAVT, NIF ou link do Instagram/Facebook/site da agência. Verificamos se está licenciada e se o registo é legítimo.
            </p>

            {/* ── Form ── */}
            <div className="glass-card" style={{ padding: "1.4rem", marginBottom: "1rem" }}>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                    {[
                        { label: "Nome da Agência", value: agencyName, set: setAgencyName, ph: "ex: Viagens Felizes Lda." },
                        { label: "Número RNAVT", value: rnavt, set: setRnavt, ph: "ex: 4521" },
                        { label: "NIPC / NIF", value: nipc, set: setNipc, ph: "ex: 512847631" },
                        { label: "Link Instagram / Facebook / Site / Google Maps", value: socialUrl, set: setSocialUrl, ph: "Cola aqui o link do perfil ou site da agência" },
                    ].map(({ label, value, set, ph }) => (
                        <div key={label}>
                            <label style={{ fontSize: "0.76rem", opacity: 0.4, display: "block", marginBottom: "0.25rem" }}>{label}</label>
                            <input
                                className="chat-input"
                                style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", fontSize: "0.9rem", boxSizing: "border-box" }}
                                value={value}
                                onChange={e => set(e.target.value)}
                                placeholder={ph}
                            />
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.9rem", borderRadius: "8px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", fontSize: "0.78rem", opacity: 0.7 }}>
                    💡 <strong>Dica legal:</strong> Em Portugal, todas as agências de viagens são <strong>obrigadas por lei</strong> a exibir o RNAVT nos seus perfis e sites.
                </div>

                {error && <p style={{ color: "#f87171", marginTop: "0.7rem", fontSize: "0.85rem" }}>{error}</p>}

                <button
                    className="btn-primary"
                    style={{ width: "100%", marginTop: "1rem", padding: "0.8rem", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                    onClick={() => handleCheck(false)}
                    disabled={loading}
                >
                    {loading
                        ? <><span className="loading-spinner" style={{ width: 18, height: 18 }} /> {socialUrl ? "A analisar perfil…" : "A verificar…"}</>
                        : "🔍 Verificar Agência"}
                </button>
            </div>

            {/* ── Cache badge ── */}
            {verdict && !loading && (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
                    padding: "0.55rem 0.9rem", borderRadius: "10px", marginBottom: "0.85rem",
                    background: fromCache ? "rgba(251,191,36,0.07)" : "rgba(74,222,128,0.07)",
                    border: `1px solid ${fromCache ? "rgba(251,191,36,0.2)" : "rgba(74,222,128,0.2)"}`,
                }}>
                    <span style={{ fontSize: "0.82rem" }}>
                        {fromCache
                            ? <>⚡ <strong>Resultado em cache</strong> <span style={{ opacity: 0.45 }}>— verificado há {cacheAge} dia{cacheAge === 1 ? "" : "s"}</span></>
                            : <>✅ <strong>Verificação concluída</strong> <span style={{ opacity: 0.45 }}>— em cache por 30 dias</span></>}
                    </span>
                    {fromCache && (
                        <button onClick={() => handleCheck(true)} disabled={loading} style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "inherit", cursor: "pointer", fontWeight: 600 }}>
                            🔄 Atualizar
                        </button>
                    )}
                </div>
            )}

            {/* ── Results ── */}
            {verdict && !loading && cfg && (
                <div style={{ display: "grid", gap: "0.85rem" }}>

                    {/* ── Verdict banner ── */}
                    <div style={{ borderRadius: "14px", border: `1.5px solid ${cfg.border}`, background: `linear-gradient(135deg, ${cfg.bg} 0%, rgba(0,0,0,0) 70%)`, padding: "1.4rem" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.9rem" }}>
                            <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>{cfg.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: cfg.color, fontSize: "1.05rem", marginBottom: "0.2rem" }}>{verdictText || cfg.label}</div>
                                {official && <div style={{ fontSize: "0.74rem", opacity: 0.4 }}>Consta no Registo Nacional de Turismo · Turismo de Portugal</div>}
                                {verdict === "danger" && linkAnalysis?.mismatch && (
                                    <p style={{ fontSize: "0.88rem", opacity: 0.85, margin: "0.5rem 0 0", lineHeight: 1.6 }}>
                                        🚨 O RNAVT <strong>{linkAnalysis.rnavtFound}</strong> declarado neste perfil pertence a <strong>&ldquo;{linkAnalysis.rnavtBelongsTo}&rdquo;</strong>, não a esta agência. Possível roubo de identidade.
                                    </p>
                                )}

                                {/* ── Phase 4: Action buttons ── */}
                                {checkId && (
                                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
                                        {/* Save button — only for licensed agencies */}
                                        {official && (
                                            <button
                                                onClick={handleSave}
                                                disabled={savingAgency}
                                                style={{
                                                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                                                    padding: "0.35rem 0.8rem", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600,
                                                    border: saved ? "1px solid rgba(251,191,36,0.5)" : "1px solid rgba(255,255,255,0.15)",
                                                    background: saved ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
                                                    color: saved ? "#fbbf24" : "inherit",
                                                    cursor: savingAgency ? "default" : "pointer",
                                                    transition: "all 0.2s",
                                                }}
                                            >
                                                {saved ? "★ Guardada" : "☆ Guardar"}
                                            </button>
                                        )}
                                        {/* Share button */}
                                        <button
                                            onClick={handleShare}
                                            disabled={sharingCheck}
                                            style={{
                                                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                                                padding: "0.35rem 0.8rem", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600,
                                                border: "1px solid rgba(255,255,255,0.15)",
                                                background: shareCopied ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
                                                color: shareCopied ? "#4ade80" : "inherit",
                                                cursor: sharingCheck ? "default" : "pointer",
                                                transition: "all 0.2s",
                                            }}
                                        >
                                            {shareCopied ? "✅ Link copiado!" : sharingCheck ? "A gerar…" : "🔗 Partilhar"}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {official && (
                                <span style={{ fontSize: "0.82rem", fontWeight: 700, padding: "0.3rem 0.8rem", borderRadius: "20px", background: "rgba(74,222,128,0.18)", color: "#4ade80", whiteSpace: "nowrap" }}>
                                    RNAVT {official.rnavt}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Official agency data ── */}
                    {official && (
                        <div style={{ borderRadius: "12px", border: "1px solid rgba(74,222,128,0.2)", background: "rgba(74,222,128,0.04)", padding: "1.2rem" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80", marginBottom: "0.8rem" }}>Dados Oficiais</div>
                            <DataGrid items={[
                                ["NIF / NIPC", official.nif],
                                ["Denominação", official.legalName],
                                ["Nome Comercial", official.commercialName || undefined],
                                ["Localidade", [official.city, official.district].filter(Boolean).join(", ") || undefined],
                                ["Morada", [official.address, official.postalCode].filter(Boolean).join(", ") || undefined],
                                ["Telefone", official.phone || undefined],
                            ]} />
                            {official.googleRating != null && (
                                <div style={{ marginTop: "0.8rem", paddingTop: "0.7rem", borderTop: "1px solid rgba(74,222,128,0.12)" }}>
                                    <div style={{ fontSize: "0.7rem", opacity: 0.38, marginBottom: "0.3rem" }}>Google Rating</div>
                                    <Stars rating={official.googleRating} count={official.googleReviewCount} placeId={official.googlePlaceId} />
                                </div>
                            )}
                            {!official.googleRating && (
                                <div style={{ marginTop: "0.8rem", paddingTop: "0.7rem", borderTop: "1px solid rgba(74,222,128,0.12)", fontSize: "0.82rem", opacity: 0.35 }}>
                                    ☆☆☆☆☆ Sem ficha no Google Business
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Link Analysis ── */}
                    {linkAnalysis && (
                        <div style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "1.2rem" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.5, marginBottom: "0.8rem" }}>Análise do Perfil</div>
                            <DataGrid items={[
                                ["RNAVT declarado", linkAnalysis.rnavtFound ?? "Não encontrado"],
                                ["Nome declarado", linkAnalysis.agencyNameFound ?? "—"],
                                ["Seguidores", linkAnalysis.followers ?? "—"],
                                ["Idade do perfil", linkAnalysis.ageDescription ?? "—"],
                            ]} />
                            {linkAnalysis.summary && (
                                <p style={{ fontSize: "0.86rem", opacity: 0.7, marginTop: "0.8rem", marginBottom: 0, lineHeight: 1.6 }}>{linkAnalysis.summary}</p>
                            )}
                            {linkAnalysis.redFlags.length > 0 && (
                                <div style={{ marginTop: "0.9rem", paddingTop: "0.7rem", borderTop: "1px solid rgba(248,113,113,0.15)" }}>
                                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>🚩 Red Flags</div>
                                    {linkAnalysis.redFlags.map((f, i) => (
                                        <div key={i} style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem", marginBottom: "0.25rem", borderRadius: "6px", background: "rgba(248,113,113,0.07)", borderLeft: "2px solid rgba(248,113,113,0.4)" }}>{f}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Not found: RNT link ── */}
                    {(verdict === "not_found" || verdict === "caution") && (
                        <div style={{ borderRadius: "12px", border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)", padding: "1.2rem" }}>
                            <p style={{ fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
                                <strong>⚠️ Pede sempre o número RNAVT antes de pagar qualquer valor.</strong> Agências de viagens em Portugal são obrigadas por lei a ter um número de registo válido.
                            </p>
                            <a
                                href="https://rnt.turismodeportugal.pt/rnt/Pesquisa_AVT.aspx"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.1rem", borderRadius: "10px", background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24", fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}
                            >
                                🔎 Verificar no Registo Nacional de Turismo ↗
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
