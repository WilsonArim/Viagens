"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ToolResult {
    type: string;
    data: Record<string, unknown>;
    [key: string]: unknown;
}

interface ChatMsg {
    role: "user" | "model";
    text: string;
    toolResults?: ToolResult[];
}

function VerdictBadge({ verdict }: { verdict: string }) {
    const color = verdict === "Excelente" ? "#4ade80" : verdict === "Evitar" ? "#f87171" : "#fbbf24";
    return (
        <span style={{ padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 700, color: "#000", backgroundColor: color }}>
            {verdict}
        </span>
    );
}

function ToolResultCard({ result }: { result: ToolResult }) {
    const data = result.data as Record<string, unknown>;

    if (result.type === "xray") {
        return (
            <div className="tool-result-card xray-result">
                <div className="tool-result-header">
                    <span className="tool-badge" style={{ backgroundColor: "#d4a574" }}>RAIO-X</span>
                    <span>{String(result.hotelName)} — {String(result.destination)}</span>
                </div>
                <div className="tool-result-body">
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                        <VerdictBadge verdict={String(data.verdict)} />
                        <span style={{ fontSize: "0.85rem" }}>Fartura: <strong>{String(data.abundanceIndex)}%</strong></span>
                    </div>
                    {Array.isArray(data.redFlags) && data.redFlags.length > 0 && (
                        <div style={{ marginTop: "0.5rem" }}>
                            {data.redFlags.map((f: string, i: number) => (
                                <span key={i} className="red-flag-tag">{f}</span>
                            ))}
                        </div>
                    )}
                    {typeof data.realExperience === "string" ? <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.8 }}>{data.realExperience}</p> : null}
                </div>
            </div>
        );
    }

    if (result.type === "itinerary") {
        const days = Array.isArray(data.days) ? data.days : [];
        return (
            <div className="tool-result-card itinerary-result">
                <div className="tool-result-header">
                    <span className="tool-badge" style={{ backgroundColor: "#74b0d4" }}>ROTEIRO</span>
                    <span>{String(result.destination)} — {String(result.days)} dias</span>
                </div>
                <div className="tool-result-body">
                    {days.slice(0, 3).map((day: Record<string, string>, i: number) => (
                        <div key={i} style={{ marginBottom: "0.6rem", paddingBottom: "0.6rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <strong style={{ color: "var(--gold)" }}>Dia {day.day}</strong>
                            <p style={{ margin: "0.2rem 0", fontSize: "0.82rem" }}>🌅 {day.morning}</p>
                            <p style={{ margin: "0.2rem 0", fontSize: "0.82rem" }}>🍽️ {day.lunch}</p>
                            <p style={{ margin: "0.2rem 0", fontSize: "0.82rem" }}>🌆 {day.afternoon}</p>
                        </div>
                    ))}
                    {days.length > 3 && <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>+{days.length - 3} dias...</p>}
                </div>
            </div>
        );
    }

    if (result.type === "radar") {
        const alerts = Array.isArray(data.alerts) ? data.alerts : [];
        return (
            <div className="tool-result-card radar-result">
                <div className="tool-result-header">
                    <span className="tool-badge" style={{ backgroundColor: "#d47474" }}>RADAR</span>
                    <span>{String(result.destination)}</span>
                </div>
                <div className="tool-result-body">
                    {typeof data.summary === "string" ? <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>{data.summary}</p> : null}
                    {alerts.slice(0, 3).map((a: Record<string, string>, i: number) => {
                        const riskColor = a.risk === "high" ? "#f87171" : a.risk === "medium" ? "#fbbf24" : "#4ade80";
                        return (
                            <div key={i} style={{ marginBottom: "0.4rem", paddingLeft: "0.6rem", borderLeft: `3px solid ${riskColor}` }}>
                                <strong style={{ fontSize: "0.82rem" }}>{a.title}</strong>
                                <p style={{ fontSize: "0.78rem", opacity: 0.7, margin: "0.1rem 0" }}>{a.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    // Load chat history from DB
    useEffect(() => {
        async function loadHistory() {
            try {
                const res = await fetch("/api/chat/session");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.messages) && data.messages.length > 0) {
                        setMessages(data.messages as ChatMsg[]);
                    }
                }
            } catch { /* ignore */ }
            setInitialLoading(false);
            inputRef.current?.focus();
        }
        loadHistory();
    }, []);

    async function handleClearChat() {
        if (!confirm("Apagar todo o histórico de chat?")) return;
        await fetch("/api/chat/session", { method: "DELETE" });
        setMessages([]);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: ChatMsg = { role: "user", text };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setLoading(true);

        try {
            const history = newMessages.slice(0, -1).map((m) => ({ role: m.role, text: m.text }));
            const res = await fetch("/api/gemini/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, history }),
            });

            const data = await res.json();
            const modelMsg: ChatMsg = {
                role: "model",
                text: data.reply || "Sem resposta.",
                toolResults: data.toolResults,
            };
            setMessages([...newMessages, modelMsg]);
        } catch {
            setMessages([...newMessages, { role: "model", text: "Erro de ligação. Tenta novamente." }]);
        }
        setLoading(false);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    }

    if (initialLoading) {
        return (
            <div className="chat-container">
                <div className="chat-header">
                    <p className="eyebrow">Detetive Supremo</p>
                    <h1>Fala com o Detetive</h1>
                </div>
                <div className="chat-messages">
                    <div className="chat-empty"><p>A carregar histórico...</p></div>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <p className="eyebrow">Detetive Supremo</p>
                        <h1>Fala com o Detetive</h1>
                        <p style={{ opacity: 0.6, fontSize: "0.85rem" }}>Pede análises de hotéis, roteiros ou alertas — o Detetive decide o que investigar.</p>
                    </div>
                    {messages.length > 0 && (
                        <button
                            onClick={handleClearChat}
                            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "var(--text-secondary)", padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                            Limpar Chat
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🕵️</p>
                        <p>Ainda sem conversas.</p>
                        <p style={{ fontSize: "0.85rem", opacity: 0.6, marginTop: "0.3rem" }}>
                            Tenta: &quot;Compara hotéis em Punta Cana&quot; ou &quot;Cria roteiro de 5 dias em Lisboa&quot;
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                        <div className="chat-bubble-content">
                            {msg.text.split("\n").map((line, j) => (
                                <p key={j} style={{ margin: "0.2rem 0" }}>{line}</p>
                            ))}
                        </div>
                        {msg.toolResults && msg.toolResults.length > 0 && (
                            <div className="chat-tool-results">
                                {msg.toolResults.map((tr, j) => (
                                    <ToolResultCard key={j} result={tr} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="chat-bubble model">
                        <div className="chat-bubble-content">
                            <div className="chat-typing">
                                <span /><span /><span />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSubmit}>
                <textarea
                    ref={inputRef}
                    className="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunta ao Detetive..."
                    rows={1}
                    disabled={loading}
                />
                <button className="chat-send-btn" type="submit" disabled={loading || !input.trim()}>
                    {loading ? "..." : "Enviar"}
                </button>
            </form>
        </div>
    );
}
