import Link from "next/link";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardHomePage() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  const [tripsCount, searchesCount, xrayCount, chatCount, pollsCount] = await Promise.all([
    prisma.trip.count({ where: { userId: userId ?? "" } }),
    prisma.tripSearch.count({ where: { userId: userId ?? "" } }),
    prisma.hotelAnalysis.count({ where: { userId: userId ?? "" } }),
    prisma.chatSession.count({ where: { userId: userId ?? "" } }),
    prisma.poll.count({ where: { trip: { userId: userId ?? "" } } }),
  ]);

  const recentSearches = await prisma.tripSearch.findMany({
    where: { userId: userId ?? "" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, queryType: true, destination: true, createdAt: true },
  });

  const stats = [
    { label: "Viagens", value: tripsCount, icon: "✈️", color: "#74b0d4" },
    { label: "Raio-X", value: xrayCount, icon: "🔍", color: "#d4a574" },
    { label: "Consultas", value: searchesCount, icon: "📊", color: "#a974d4" },
    { label: "Conversas", value: chatCount, icon: "💬", color: "#74d4a5" },
    { label: "Polls", value: pollsCount, icon: "📊", color: "#d4d474" },
  ];

  const typeLabels: Record<string, string> = { XRAY: "Raio-X", ITINERARY: "Roteiro", RADAR: "Radar", CHAT: "Chat" };

  const modules = [
    { href: "/chat", label: "Falar com o Detetive", desc: "Pede conselhos, compara hotéis, tira dúvidas", icon: "🕵️", color: "#c9a96e" },
    { href: "/trips", label: "Minhas Viagens", desc: "Raio-X, Roteiros, Radar e Polls organizados por viagem", icon: "✈️", color: "#74b0d4" },
    { href: "/profile", label: "Perfil Familiar", desc: "Orçamento, ritmo, restrições e membros da família", icon: "👨‍👩‍👧", color: "#74d4a5" },
  ];

  return (
    <div className="module-container">
      <p className="eyebrow">Resumo</p>
      <h1>Centro de Comando</h1>
      <p style={{ opacity: 0.6, marginBottom: "1.5rem" }}>Bem-vindo de volta, {session?.user?.name ?? "Detetive"}.</p>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.8rem", marginBottom: "2rem" }}>
        {stats.map((s) => (
          <div key={s.label} className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "1.5rem" }}>{s.icon}</span>
            <p style={{ fontSize: "2rem", fontWeight: 700, margin: "0.2rem 0", color: s.color }}>{s.value}</p>
            <p style={{ fontSize: "0.78rem", opacity: 0.6, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Module Cards */}
      <h2 style={{ marginBottom: "0.8rem" }}>Módulos</h2>
      <div style={{ display: "grid", gap: "0.8rem", marginBottom: "2rem" }}>
        {modules.map((m) => (
          <Link key={m.href} href={m.href} className="glass-card" style={{ padding: "1rem 1.2rem", display: "flex", alignItems: "center", gap: "1rem", textDecoration: "none", color: "var(--text-primary)", transition: "border-color 0.2s", borderLeft: `3px solid ${m.color}` }}>
            <span style={{ fontSize: "1.8rem" }}>{m.icon}</span>
            <div>
              <strong style={{ fontSize: "1rem" }}>{m.label}</strong>
              <p style={{ fontSize: "0.8rem", opacity: 0.6, margin: "0.15rem 0 0" }}>{m.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      {recentSearches.length > 0 && (
        <>
          <h2 style={{ marginBottom: "0.8rem" }}>Atividade Recente</h2>
          <div className="glass-card" style={{ padding: "0" }}>
            {recentSearches.map((s: { id: string; queryType: string; destination: string; createdAt: Date }, i: number) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.7rem 1rem", borderBottom: i < recentSearches.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", borderRadius: "4px", backgroundColor: s.queryType === "XRAY" ? "#d4a574" : s.queryType === "ITINERARY" ? "#74b0d4" : s.queryType === "RADAR" ? "#d47474" : "#a974d4", color: "#000", fontWeight: 600 }}>
                    {typeLabels[s.queryType]}
                  </span>
                  <span style={{ fontSize: "0.88rem" }}>{s.destination}</span>
                </div>
                <span style={{ fontSize: "0.72rem", opacity: 0.4 }}>{new Date(s.createdAt).toLocaleDateString("pt-PT")}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
