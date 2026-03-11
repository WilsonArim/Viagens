"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const RadarMap = dynamic(() => import("@/components/maps/RadarMap"), { ssr: false });
const ItineraryMap = dynamic(() => import("@/components/maps/ItineraryMap"), { ssr: false });
const TripPreviewMap = dynamic(() => import("@/components/maps/TripPreviewMap"), { ssr: false });

interface HotelAnalysisSummary {
    id: string;
    hotelName: string;
    verdict: string;
    abundanceIndex: number;
    redFlags: string[];
}

interface RadarAlert {
    category?: string;
    risk?: "low" | "medium" | "high";
    title?: string;
    description?: string;
    pivoting?: string;
    locationHint?: string;
    lat?: number | null;
    lng?: number | null;
}

interface ItineraryMapPoint {
    period?: string;
    name?: string;
    query?: string;
    lat?: number;
    lng?: number;
}

interface ItineraryDayData {
    day?: number;
    morning?: string;
    lunch?: string;
    afternoon?: string;
    detectiveNote?: string;
    walkingKm?: number;
    mapPoints?: ItineraryMapPoint[];
}

interface TripSearchItem {
    id: string;
    queryType: "XRAY" | "ITINERARY" | "RADAR" | "CHAT";
    destination: string;
    results: Record<string, unknown>;
    hotelAnalyses: HotelAnalysisSummary[];
    createdAt: string;
}

interface TripDetail {
    id: string;
    name: string;
    destination: string | null;
    notes: string | null;
    searches: TripSearchItem[];
}

const TYPE_LABELS: Record<string, string> = { XRAY: "Raio-X", ITINERARY: "Roteiro", RADAR: "Radar", CHAT: "Chat" };
const TYPE_COLORS: Record<string, string> = { XRAY: "#d4a574", ITINERARY: "#74b0d4", RADAR: "#d47474", CHAT: "#a974d4" };

function VerdictBadge({ verdict }: { verdict: string }) {
    const color = verdict === "Excelente" ? "#4ade80" : verdict === "Evitar" ? "#f87171" : "#fbbf24";
    return <span style={{ display: "inline-block", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, color: "#000", backgroundColor: color }}>{verdict}</span>;
}

function RiskBadge({ risk }: { risk: string }) {
    const color = risk === "high" ? "#ef4444" : risk === "medium" ? "#f59e0b" : "#22c55e";
    const label = risk === "high" ? "Alto" : risk === "medium" ? "Médio" : "Baixo";
    return <span style={{ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, color: "#000", backgroundColor: color }}>{label}</span>;
}

interface PollItem {
    id: string;
    question: string;
    options: string[];
    shareToken: string;
    votes: { id: string; voterName: string; optionIndex: number }[];
}

type ActiveModule = null | "xray" | "itinerary" | "radar" | "poll" | "import";

export default function TripDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [trip, setTrip] = useState<TripDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [activeModule, setActiveModule] = useState<ActiveModule>(null);
    const [moduleLoading, setModuleLoading] = useState(false);

    const [xrayHotel, setXrayHotel] = useState("");
    const [xrayDest, setXrayDest] = useState("");
    const [itinDest, setItinDest] = useState("");
    const [itinDays, setItinDays] = useState("4");
    const [radarDest, setRadarDest] = useState("");

    // Poll state
    const [polls, setPolls] = useState<PollItem[]>([]);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["Sim", "Não"]);

    // Import state
    const [importText, setImportText] = useState("");
    const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null);

    const fetchTrip = useCallback(async () => {
        const res = await fetch(`/api/trips/${params.id}`);
        if (res.ok) {
            const data = await res.json();
            setTrip(data.trip);
        }
        setLoading(false);
    }, [params.id]);

    const fetchPolls = useCallback(async () => {
        const res = await fetch(`/api/trips/${params.id}/polls`);
        if (res.ok) {
            const data = await res.json();
            setPolls(data.polls);
        }
    }, [params.id]);

    useEffect(() => { fetchTrip(); fetchPolls(); }, [fetchTrip, fetchPolls]);

    useEffect(() => {
        if (trip?.destination) {
            setXrayDest(trip.destination);
            setItinDest(trip.destination);
            setRadarDest(trip.destination);
        }
    }, [trip?.destination]);

    async function handleDelete() {
        if (!confirm("Tens a certeza que queres apagar esta viagem?")) return;
        setDeleting(true);
        const res = await fetch(`/api/trips/${params.id}`, { method: "DELETE" });
        if (res.ok) router.push("/trips");
        setDeleting(false);
    }

    async function runXray(e: React.FormEvent) {
        e.preventDefault();
        if (!xrayHotel.trim() || !xrayDest.trim()) return;
        setModuleLoading(true);
        try {
            const res = await fetch("/api/gemini/xray", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hotelName: xrayHotel, destination: xrayDest, tripId: params.id }),
            });
            if (res.ok) { setXrayHotel(""); setActiveModule(null); await fetchTrip(); }
        } catch { /* */ }
        setModuleLoading(false);
    }

    async function runItinerary(e: React.FormEvent) {
        e.preventDefault();
        if (!itinDest.trim()) return;
        setModuleLoading(true);
        try {
            const res = await fetch("/api/gemini/itinerary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ destination: itinDest, days: Number(itinDays) || 4, tripId: params.id }),
            });
            if (res.ok) { setActiveModule(null); await fetchTrip(); }
        } catch { /* */ }
        setModuleLoading(false);
    }

    async function runRadar(e: React.FormEvent) {
        e.preventDefault();
        if (!radarDest.trim()) return;
        setModuleLoading(true);
        try {
            const res = await fetch("/api/gemini/radar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ destination: radarDest, tripId: params.id }),
            });
            if (res.ok) { setActiveModule(null); await fetchTrip(); }
        } catch { /* */ }
        setModuleLoading(false);
    }

    if (loading) return <div className="module-container"><p className="eyebrow">A carregar...</p></div>;

    if (!trip) {
        return (
            <div className="module-container">
                <p className="eyebrow">Erro</p>
                <h1>Viagem não encontrada</h1>
                <Link href="/trips" className="lux-button" style={{ display: "inline-block", marginTop: "1rem" }}>← Voltar</Link>
            </div>
        );
    }

    const xraySearches = trip.searches.filter((s) => s.queryType === "XRAY");
    const radarSearches = trip.searches.filter((s) => s.queryType === "RADAR");
    const itinerarySearches = trip.searches.filter((s) => s.queryType === "ITINERARY");

    // Extract all radar alerts for the map
    const allRadarAlerts: RadarAlert[] = radarSearches.flatMap((s) => {
        const alerts = (s.results as Record<string, unknown>).alerts;
        return Array.isArray(alerts) ? alerts as RadarAlert[] : [];
    });

    return (
        <div className="module-container">
            <Link href="/trips" style={{ opacity: 0.7, fontSize: "0.85rem" }}>← Minhas Viagens</Link>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.5rem" }}>
                <div>
                    <p className="eyebrow">{trip.destination ?? "Viagem"}</p>
                    <h1>{trip.name}</h1>
                    {trip.notes && <p style={{ opacity: 0.7, marginTop: "0.25rem" }}>{trip.notes}</p>}
                </div>
                <button className="lux-button" style={{ backgroundColor: "#7f1d1d", fontSize: "0.8rem" }} onClick={handleDelete} disabled={deleting}>
                    {deleting ? "..." : "Apagar"}
                </button>
            </div>
            <div style={{ marginTop: "0.9rem", maxWidth: "380px" }}>
                <TripPreviewMap destination={trip.destination} />
            </div>

            {/* Module Action Buttons */}
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
                {(["xray", "itinerary", "radar", "poll", "import"] as ActiveModule[]).map((mod) => (
                    <button
                        key={mod!}
                        className="lux-button"
                        style={{ fontSize: "0.82rem", opacity: activeModule === mod ? 1 : 0.7, borderBottom: activeModule === mod ? "2px solid var(--gold)" : "none" }}
                        onClick={() => setActiveModule(activeModule === mod ? null : mod)}
                    >
                        {mod === "xray" ? "🔍 Raio-X" : mod === "itinerary" ? "🗺️ Roteiro" : mod === "radar" ? "📡 Radar" : mod === "poll" ? "📊 Poll" : "📧 Importar"}
                    </button>
                ))}
            </div>

            {/* Inline Forms */}
            {activeModule === "xray" && (
                <form onSubmit={runXray} className="glass-card" style={{ marginTop: "1rem" }}>
                    <h3 style={{ margin: "0 0 0.8rem", fontSize: "1rem" }}>🔍 Raio-X de Hotel</h3>
                    <div className="form-group">
                        <label htmlFor="xh">Hotel</label>
                        <input id="xh" type="text" placeholder="Nome do hotel" value={xrayHotel} onChange={(e) => setXrayHotel(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="xd">Destino</label>
                        <input id="xd" type="text" placeholder="Cidade/região" value={xrayDest} onChange={(e) => setXrayDest(e.target.value)} required />
                    </div>
                    <button className="lux-button" type="submit" disabled={moduleLoading}>{moduleLoading ? "A analisar..." : "Analisar Hotel"}</button>
                </form>
            )}

            {activeModule === "itinerary" && (
                <form onSubmit={runItinerary} className="glass-card" style={{ marginTop: "1rem" }}>
                    <h3 style={{ margin: "0 0 0.8rem", fontSize: "1rem" }}>🗺️ Gerar Roteiro</h3>
                    <div className="form-group">
                        <label htmlFor="id">Destino</label>
                        <input id="id" type="text" placeholder="Destino" value={itinDest} onChange={(e) => setItinDest(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="in">Dias</label>
                        <input id="in" type="number" min="1" max="30" value={itinDays} onChange={(e) => setItinDays(e.target.value)} required />
                    </div>
                    <button className="lux-button" type="submit" disabled={moduleLoading}>{moduleLoading ? "A gerar..." : "Gerar Roteiro"}</button>
                </form>
            )}

            {activeModule === "radar" && (
                <form onSubmit={runRadar} className="glass-card" style={{ marginTop: "1rem" }}>
                    <h3 style={{ margin: "0 0 0.8rem", fontSize: "1rem" }}>📡 Radar de Alertas</h3>
                    <div className="form-group">
                        <label htmlFor="rd">Destino</label>
                        <input id="rd" type="text" placeholder="Destino" value={radarDest} onChange={(e) => setRadarDest(e.target.value)} required />
                    </div>
                    <button className="lux-button" type="submit" disabled={moduleLoading}>{moduleLoading ? "A escanear..." : "Abrir Radar"}</button>
                </form>
            )}

            {activeModule === "import" && (
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!importText.trim()) return;
                    setModuleLoading(true);
                    setImportResult(null);
                    try {
                        const res = await fetch(`/api/trips/${params.id}/import`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ emailText: importText }),
                        });
                        if (res.ok) {
                            const data = await res.json();
                            setImportResult(data);
                            setImportText("");
                            await fetchTrip();
                        }
                    } catch { /* */ }
                    setModuleLoading(false);
                }} className="glass-card" style={{ marginTop: "1rem" }}>
                    <h3 style={{ margin: "0 0 0.8rem", fontSize: "1rem" }}>📧 Importar Reserva</h3>
                    <p style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: "0.6rem" }}>Cola o email de confirmação da reserva. O Detetive extrai os dados e faz Raio-X automático.</p>
                    <div className="form-group">
                        <label htmlFor="imp">Email/Texto da reserva</label>
                        <textarea id="imp" placeholder="Cola aqui o email de confirmação do Booking, Expedia, etc..." value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} required style={{ width: "100%", resize: "vertical", padding: "0.6rem", borderRadius: "8px", border: "1px solid var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)", fontSize: "0.85rem" }} />
                    </div>
                    <button className="lux-button" type="submit" disabled={moduleLoading}>{moduleLoading ? "A extrair e analisar..." : "Importar e Raio-X"}</button>
                </form>
            )}

            {importResult && (() => {
                const ext = importResult.extracted as Record<string, unknown> | undefined;
                return (
                    <div className="glass-card" style={{ marginTop: "0.8rem", borderLeft: "3px solid var(--gold)" }}>
                        <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>{String(importResult.message ?? "")}</p>
                        {ext && (
                            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                                {!!ext.hotelName && <p style={{ margin: "0.15rem 0" }}>🏨 {String(ext.hotelName)}</p>}
                                {!!ext.destination && <p style={{ margin: "0.15rem 0" }}>📍 {String(ext.destination)}</p>}
                                {!!ext.checkIn && <p style={{ margin: "0.15rem 0" }}>📅 {String(ext.checkIn)} → {String(ext.checkOut)}</p>}
                                {!!ext.totalPrice && <p style={{ margin: "0.15rem 0" }}>💰 {String(ext.totalPrice)} {String(ext.currency)}</p>}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ═══ RADAR MAP ═══ */}
            {allRadarAlerts.length > 0 && (
                <section style={{ marginTop: "2rem" }}>
                    <h2 style={{ marginBottom: "1rem" }}>📡 Mapa de Alertas</h2>
                    <RadarMap alerts={allRadarAlerts} destination={trip.destination ?? undefined} />

                    {/* Alert Cards */}
                    <div style={{ display: "grid", gap: "0.6rem", marginTop: "1rem" }}>
                        {allRadarAlerts.map((alert, i) => (
                            <div key={i} className="glass-card" style={{ padding: "0.8rem 1rem", borderLeft: `3px solid ${alert.risk === "high" ? "#ef4444" : alert.risk === "medium" ? "#f59e0b" : "#22c55e"}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                                    <RiskBadge risk={alert.risk ?? "low"} />
                                    <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>{alert.category}</span>
                                    <strong style={{ fontSize: "0.88rem" }}>{alert.title}</strong>
                                </div>
                                <p style={{ fontSize: "0.82rem", opacity: 0.7, margin: "0" }}>{alert.description}</p>
                                {alert.pivoting && <p style={{ fontSize: "0.78rem", color: "var(--gold)", margin: "0.3rem 0 0" }}>💡 {alert.pivoting}</p>}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ═══ HOTEL COMPARISON TABLE ═══ */}
            {xraySearches.length > 0 && (
                <section style={{ marginTop: "2rem" }}>
                    <h2 style={{ marginBottom: "1rem" }}>🔍 Comparação de Hotéis</h2>
                    <div className="glass-card" style={{ overflowX: "auto" }}>
                        <table className="comparison-table">
                            <thead>
                                <tr><th>Hotel</th><th>Destino</th><th>Veredito</th><th>RCS</th><th>Índice Fartura</th><th>Red Flags</th></tr>
                            </thead>
                            <tbody>
                                {xraySearches.flatMap((s) => {
                                    const res = s.results as Record<string, unknown> | null;
                                    return s.hotelAnalyses.map((h) => {
                                        const rcs = typeof res?.rcs === "number" ? res.rcs : null;
                                        const rcsEmoji = typeof res?.rcsEmoji === "string" ? res.rcsEmoji : "";
                                        const rcsLabel = typeof res?.rcsLabel === "string" ? res.rcsLabel : "";
                                        return (
                                            <tr key={h.id}>
                                                <td style={{ fontWeight: 600 }}>{h.hotelName}</td>
                                                <td>{s.destination}</td>
                                                <td><VerdictBadge verdict={h.verdict} /></td>
                                                <td>
                                                    {rcs !== null ? (
                                                        <div style={{ textAlign: "center" }}>
                                                            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: rcs >= 9 ? "#4ade80" : rcs >= 7.5 ? "#a3e635" : rcs >= 6 ? "#fbbf24" : rcs >= 4 ? "#fb923c" : "#f87171" }}>{rcs.toFixed(1)}</span>
                                                            <br />
                                                            <span style={{ fontSize: "0.65rem", opacity: 0.6 }}>{rcsEmoji} {rcsLabel}</span>
                                                        </div>
                                                    ) : <span style={{ opacity: 0.4 }}>—</span>}
                                                </td>
                                                <td>
                                                    <div className="abundance-bar">
                                                        <div className="abundance-fill" style={{ width: `${h.abundanceIndex}%`, backgroundColor: h.abundanceIndex >= 70 ? "#4ade80" : h.abundanceIndex >= 40 ? "#fbbf24" : "#f87171" }} />
                                                        <span>{h.abundanceIndex}%</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {h.redFlags.length === 0 ? <span style={{ color: "#4ade80" }}>Nenhuma</span> : h.redFlags.map((f, i) => <span key={i} className="red-flag-tag">{f}</span>)}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ═══ ITINERARY RESULTS ═══ */}
            {itinerarySearches.length > 0 && (
                <section style={{ marginTop: "2rem" }}>
                    <h2 style={{ marginBottom: "1rem" }}>🗺️ Roteiros Gerados</h2>
                    {itinerarySearches.map((search) => {
                        const results = search.results as Record<string, unknown>;
                        const days = Array.isArray(results.days) ? results.days as ItineraryDayData[] : [];
                        return (
                            <div key={search.id} className="glass-card" style={{ marginBottom: "1rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                                    <strong>{search.destination} — {days.length} dias</strong>
                                    <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>{new Date(search.createdAt).toLocaleDateString("pt-PT")}</span>
                                </div>
                                <ItineraryMap destination={search.destination} days={days} />
                                {days.map((day, i) => (
                                    <div key={i} style={{ marginBottom: "0.8rem", paddingBottom: "0.8rem", borderBottom: i < days.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <strong style={{ color: "var(--gold)", fontSize: "0.9rem" }}>Dia {day.day ?? i + 1}</strong>
                                            {day.walkingKm && <span style={{ fontSize: "0.72rem", opacity: 0.5 }}>🚶 {day.walkingKm}km</span>}
                                        </div>
                                        <p style={{ margin: "0.2rem 0", fontSize: "0.82rem" }}>🌅 {day.morning}</p>
                                        <p style={{ margin: "0.2rem 0", fontSize: "0.82rem" }}>🍽️ {day.lunch}</p>
                                        <p style={{ margin: "0.2rem 0", fontSize: "0.82rem" }}>🌆 {day.afternoon}</p>
                                        {day.detectiveNote && <p style={{ margin: "0.3rem 0 0", fontSize: "0.78rem", color: "var(--gold)" }}>🕵️ {day.detectiveNote}</p>}
                                    </div>
                                ))}
                                {typeof results.globalNote === "string" && <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.5rem" }}>📝 {results.globalNote}</p>}
                                {typeof results.paceWarning === "string" && <p style={{ fontSize: "0.8rem", color: "#f59e0b", marginTop: "0.3rem" }}>⚠️ {results.paceWarning}</p>}
                            </div>
                        );
                    })}
                </section>
            )}

            {/* ═══ POLL FORM ═══ */}
            {activeModule === "poll" && (
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
                    setModuleLoading(true);
                    const res = await fetch(`/api/trips/${params.id}/polls`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ question: pollQuestion, options: pollOptions.filter(o => o.trim()) }),
                    });
                    if (res.ok) { setPollQuestion(""); setPollOptions(["Sim", "Não"]); setActiveModule(null); await fetchPolls(); }
                    setModuleLoading(false);
                }} className="glass-card" style={{ marginTop: "1rem" }}>
                    <h3 style={{ margin: "0 0 0.8rem", fontSize: "1rem" }}>📊 Criar Poll Familiar</h3>
                    <div className="form-group">
                        <label htmlFor="pq">Pergunta</label>
                        <input id="pq" type="text" placeholder="Ex: Qual hotel preferem?" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} required />
                    </div>
                    <div className="poll-create-form">
                        <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Opções</label>
                        {pollOptions.map((opt, i) => (
                            <div key={i} className="poll-option-row">
                                <input type="text" placeholder={`Opção ${i + 1}`} value={opt} onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} />
                                {pollOptions.length > 2 && <button type="button" className="lux-button" style={{ backgroundColor: "#7f1d1d" }} onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>✕</button>}
                            </div>
                        ))}
                        <button type="button" className="lux-button" style={{ fontSize: "0.78rem", alignSelf: "flex-start" }} onClick={() => setPollOptions([...pollOptions, ""])}>+ Opção</button>
                    </div>
                    <button className="lux-button" type="submit" disabled={moduleLoading} style={{ marginTop: "0.8rem" }}>{moduleLoading ? "A criar..." : "Criar Poll"}</button>
                </form>
            )}

            {/* ═══ POLLS DISPLAY ═══ */}
            {polls.length > 0 && (
                <section style={{ marginTop: "2rem" }}>
                    <h2 style={{ marginBottom: "1rem" }}>📊 Polls Familiares</h2>
                    {polls.map((poll) => {
                        const totalVotes = poll.votes.length;
                        return (
                            <div key={poll.id} className="glass-card" style={{ marginBottom: "1rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                                    <strong style={{ fontSize: "1rem" }}>{poll.question}</strong>
                                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/vote?token=${poll.shareToken}`); }} className="lux-button" style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>📋 Copiar Link</button>
                                </div>
                                {poll.options.map((opt, i) => {
                                    const count = poll.votes.filter(v => v.optionIndex === i).length;
                                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                    const voters = poll.votes.filter(v => v.optionIndex === i);
                                    return (
                                        <div key={i} style={{ marginBottom: "0.5rem" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.2rem" }}>
                                                <span>{opt}</span>
                                                <span>{count} ({pct}%)</span>
                                            </div>
                                            <div className="vote-result-bar"><div className="vote-result-fill" style={{ width: `${pct}%` }} /></div>
                                            {voters.length > 0 && <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem" }}>{voters.map(v => <span key={v.id} className="voter-chip">{v.voterName}</span>)}</div>}
                                        </div>
                                    );
                                })}
                                <p style={{ fontSize: "0.72rem", opacity: 0.4, marginTop: "0.6rem" }}>{totalVotes} {totalVotes === 1 ? "voto" : "votos"} · Link: /vote?token={poll.shareToken.slice(0, 8)}...</p>
                            </div>
                        );
                    })}
                </section>
            )}

            {/* ═══ TIMELINE ═══ */}
            {trip.searches.length > 0 && (
                <section style={{ marginTop: "2rem" }}>
                    <h2 style={{ marginBottom: "1rem" }}>Histórico de Consultas</h2>
                    <div className="searches-timeline">
                        {trip.searches.map((search) => (
                            <div key={search.id} className="glass-card search-card">
                                <div className="search-card-header">
                                    <span className="search-type-badge" style={{ backgroundColor: TYPE_COLORS[search.queryType] }}>
                                        {TYPE_LABELS[search.queryType]}
                                    </span>
                                    <span className="search-destination">{search.destination}</span>
                                    <span className="search-date">{new Date(search.createdAt).toLocaleDateString("pt-PT")}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {trip.searches.length === 0 && !activeModule && (
                <div className="glass-card" style={{ textAlign: "center", padding: "3rem", marginTop: "2rem" }}>
                    <p style={{ fontSize: "1.1rem" }}>Sem consultas nesta viagem.</p>
                    <p style={{ opacity: 0.7 }}>Usa os botões acima para fazer Raio-X, Roteiro ou Radar.</p>
                </div>
            )}
        </div>
    );
}
