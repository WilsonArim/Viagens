"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const TripPreviewMap = dynamic(() => import("@/components/maps/TripPreviewMap"), { ssr: false });

interface TripSummary {
    id: string;
    name: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
    notes: string | null;
    createdAt: string;
    _count: { searches: number };
}

export default function TripsPage() {
    const [trips, setTrips] = useState<TripSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: "", destination: "", notes: "" });
    const [creating, setCreating] = useState(false);

    const fetchTrips = useCallback(async () => {
        const res = await fetch("/api/trips");
        if (res.ok) {
            const data = await res.json();
            setTrips(data.trips);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchTrips();
    }, [fetchTrips]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name.trim()) return;
        setCreating(true);

        const res = await fetch("/api/trips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        if (res.ok) {
            setFormData({ name: "", destination: "", notes: "" });
            setShowForm(false);
            await fetchTrips();
        }
        setCreating(false);
    }

    if (loading) {
        return (
            <div className="module-container">
                <p className="eyebrow">A carregar...</p>
            </div>
        );
    }

    return (
        <div className="module-container">
            <p className="eyebrow">Viagens Guardadas</p>
            <h1>Minhas Viagens</h1>
            <p>Organiza destinos, hotéis e roteiros em viagens para comparar e decidir.</p>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.5rem" }}>
                <button className="lux-button" onClick={() => setShowForm(!showForm)}>
                    {showForm ? "Cancelar" : "+ Nova Viagem"}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="glass-card" style={{ marginBottom: "2rem" }}>
                    <div className="form-group">
                        <label htmlFor="trip-name">Nome da Viagem</label>
                        <input
                            id="trip-name"
                            type="text"
                            placeholder="Ex: Verão com a mãe 2026"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="trip-dest">Destino (opcional)</label>
                        <input
                            id="trip-dest"
                            type="text"
                            placeholder="Ex: Algarve, Lisboa"
                            value={formData.destination}
                            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="trip-notes">Notas (opcional)</label>
                        <textarea
                            id="trip-notes"
                            placeholder="Ideias, restrições, desejos..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={2}
                        />
                    </div>
                    <button className="lux-button" type="submit" disabled={creating}>
                        {creating ? "A criar..." : "Criar Viagem"}
                    </button>
                </form>
            )}

            {trips.length === 0 ? (
                <div className="glass-card" style={{ textAlign: "center", padding: "3rem" }}>
                    <p style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Ainda não tens viagens guardadas.</p>
                    <p style={{ opacity: 0.7 }}>Cria uma viagem e depois guarda consultas do Raio-X, Roteiros ou Radar.</p>
                </div>
            ) : (
                <div className="trips-grid">
                    {trips.map((trip) => (
                        <Link href={`/trips/${trip.id}`} key={trip.id} className="trip-card glass-card">
                            <div className="trip-card-header">
                                <h3>{trip.name}</h3>
                                {trip.destination && <span className="trip-destination">{trip.destination}</span>}
                            </div>
                            {trip.destination && <TripPreviewMap destination={trip.destination} height={140} />}
                            <div className="trip-card-meta">
                                <span>{trip._count.searches} consulta{trip._count.searches !== 1 ? "s" : ""}</span>
                                <span>{new Date(trip.createdAt).toLocaleDateString("pt-PT")}</span>
                            </div>
                            {trip.notes && <p className="trip-card-notes">{trip.notes}</p>}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
