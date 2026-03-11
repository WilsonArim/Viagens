"use client";

import { useEffect, useState } from "react";

interface SaveButtonProps {
    agencyId: string;
    initialSaved?: boolean;
}

export function SaveButton({ agencyId, initialSaved = false }: SaveButtonProps) {
    const [saved, setSaved] = useState(initialSaved);
    const [loading, setLoading] = useState(false);
    const [checked, setChecked] = useState(initialSaved);

    // Fetch current state on mount
    useEffect(() => {
        fetch(`/api/agency/save?agencyId=${agencyId}`)
            .then(r => r.json())
            .then(d => { setSaved(d.saved ?? false); setChecked(true); })
            .catch(() => setChecked(true));
    }, [agencyId]);

    async function toggle() {
        setLoading(true);
        try {
            const res = await fetch("/api/agency/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agencyId }),
            });
            const d = await res.json();
            if (res.ok) setSaved(d.saved ?? !saved);
        } catch { /* ignore */ }
        setLoading(false);
    }

    if (!checked) return null; // don't flash before auth check

    return (
        <button
            onClick={toggle}
            disabled={loading}
            style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                padding: "0.55rem 1rem", borderRadius: "10px", cursor: "pointer",
                border: saved ? "1px solid rgba(251,191,36,0.5)" : "1px solid rgba(255,255,255,0.12)",
                background: saved ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.04)",
                color: saved ? "#fbbf24" : "inherit",
                fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s ease",
                opacity: loading ? 0.6 : 1,
            }}
        >
            {saved ? "⭐ Guardada" : "☆ Guardar"}
        </button>
    );
}
