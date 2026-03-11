"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface PollVote {
    id: string;
    voterName: string;
    optionIndex: number;
}

interface PollData {
    id: string;
    question: string;
    options: string[];
    votes: PollVote[];
    trip: { name: string; destination: string | null };
}

export default function VotePage() {
    return (<Suspense fallback={<div className="vote-page"><div className="vote-card"><p>A carregar...</p></div></div>}><VotePageInner /></Suspense>);
}

function VotePageInner() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [poll, setPoll] = useState<PollData | null>(null);
    const [loading, setLoading] = useState(true);
    const [voterName, setVoterName] = useState("");
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false);

    const fetchPoll = useCallback(async () => {
        if (!token) return;
        const res = await fetch(`/api/polls/vote?token=${token}`);
        if (res.ok) {
            const data = await res.json();
            setPoll(data.poll);
        }
        setLoading(false);
    }, [token]);

    useEffect(() => { fetchPoll(); }, [fetchPoll]);

    async function handleVote() {
        if (selectedOption === null || !voterName.trim() || !token) return;
        setVoting(true);
        const res = await fetch("/api/polls/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, voterName: voterName.trim(), optionIndex: selectedOption }),
        });
        if (res.ok) {
            const data = await res.json();
            setPoll(data.poll);
            setVoted(true);
        }
        setVoting(false);
    }

    if (!token) {
        return (
            <div className="vote-page">
                <div className="vote-card">
                    <h1>Link inválido</h1>
                    <p>Este link não contém um token de votação válido.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="vote-page">
                <div className="vote-card"><p>A carregar...</p></div>
            </div>
        );
    }

    if (!poll) {
        return (
            <div className="vote-page">
                <div className="vote-card">
                    <h1>Poll não encontrado</h1>
                    <p>Este link pode ter expirado ou o poll foi apagado.</p>
                </div>
            </div>
        );
    }

    const totalVotes = poll.votes.length;
    const voteCounts = poll.options.map((_, i) => poll.votes.filter((v) => v.optionIndex === i).length);

    return (
        <div className="vote-page">
            <div className="vote-card">
                <p className="vote-trip-name">🕵️ {poll.trip.name} {poll.trip.destination ? `— ${poll.trip.destination}` : ""}</p>
                <h1 className="vote-question">{poll.question}</h1>

                {!voted ? (
                    <>
                        <div className="vote-name-input">
                            <label htmlFor="vn">O teu nome</label>
                            <input id="vn" type="text" placeholder="Ex: Mãe, Pai, Filha..." value={voterName} onChange={(e) => setVoterName(e.target.value)} />
                        </div>

                        <div className="vote-options">
                            {poll.options.map((option, i) => (
                                <button
                                    key={i}
                                    className={`vote-option ${selectedOption === i ? "selected" : ""}`}
                                    onClick={() => setSelectedOption(i)}
                                >
                                    <span className="vote-option-radio">{selectedOption === i ? "●" : "○"}</span>
                                    {option}
                                </button>
                            ))}
                        </div>

                        <button className="vote-submit" onClick={handleVote} disabled={voting || selectedOption === null || !voterName.trim()}>
                            {voting ? "A votar..." : "Votar"}
                        </button>
                    </>
                ) : (
                    <div className="vote-success">
                        <p>✅ Voto registado, {voterName}!</p>
                    </div>
                )}

                {/* Results */}
                {totalVotes > 0 && (
                    <div className="vote-results">
                        <h3>{totalVotes} {totalVotes === 1 ? "voto" : "votos"}</h3>
                        {poll.options.map((option, i) => {
                            const count = voteCounts[i];
                            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                            return (
                                <div key={i} className="vote-result-row">
                                    <div className="vote-result-label">
                                        <span>{option}</span>
                                        <span>{count} ({pct}%)</span>
                                    </div>
                                    <div className="vote-result-bar">
                                        <div className="vote-result-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="vote-result-voters">
                                        {poll.votes.filter((v) => v.optionIndex === i).map((v) => (
                                            <span key={v.id} className="voter-chip">{v.voterName}</span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
