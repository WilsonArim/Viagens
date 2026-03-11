import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

// ── SEO metadata ─────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Diretório de Agências de Viagens Licenciadas em Portugal | Amigo de Viagens",
  description: "Lista completa e verificada de agências de viagens licenciadas em Portugal (RNAVT). Filtro por distrito, rating Google e estado do registo. Evite fraudes — verifique antes de pagar.",
  alternates: { canonical: "/agencia" },
  openGraph: {
    title: "Agências de Viagens Licenciadas em Portugal",
    description: "Diretório verificado com +3500 agências. Filtra por distrito, encontra a tua agência e verifica a licença RNAVT.",
  },
};

// ── Types ──────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{
    pagina?: string;
    distrito?: string;
    rating?: string;
    estado?: string;
    q?: string;
  }>;
}

const PAGE_SIZE = 40;

// ── Data fetcher ─────────────────────────────────────────────────────────────

async function getAgencies(page: number, filters: { distrito?: string; rating?: number; estado?: string; q?: string }) {
  const where = {
    ...(filters.q ? {
      OR: [
        { legalName: { contains: filters.q, mode: "insensitive" as const } },
        { commercialName: { contains: filters.q, mode: "insensitive" as const } },
        { rnavt: { contains: filters.q } },
        { nif: { contains: filters.q } },
      ],
    } : {}),
    ...(filters.distrito ? { district: { equals: filters.distrito, mode: "insensitive" as const } } : {}),
    ...(filters.rating ? { googleRating: { gte: filters.rating } } : {}),
    ...(filters.estado === "ativas" ? { nifptStatus: { not: "inactive" } }
      : filters.estado === "inativas" ? { nifptStatus: "inactive" }
        : {}),
  };

  const [total, agencies] = await Promise.all([
    prisma.agency.count({ where }),
    prisma.agency.findMany({
      where,
      select: {
        rnavt: true, legalName: true, commercialName: true,
        city: true, district: true, googleRating: true,
        googleReviewCount: true, nifptStatus: true,
      },
      orderBy: [
        { googleReviewCount: "desc" },
        { legalName: "asc" },
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return { total, agencies };
}

async function getDistricts() {
  const result = await prisma.agency.findMany({
    select: { district: true },
    where: { district: { not: null } },
    distinct: ["district"],
    orderBy: { district: "asc" },
  });
  return result.map(r => r.district).filter(Boolean) as string[];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AgencyDirectoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.pagina ?? "1", 10));
  const filters = {
    q: sp.q?.trim() || undefined,
    distrito: sp.distrito || undefined,
    rating: sp.rating ? parseFloat(sp.rating) : undefined,
    estado: sp.estado || undefined,
  };

  const [{ total, agencies }, districts] = await Promise.all([
    getAgencies(page, filters),
    getDistricts(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { pagina: String(page), ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [k === "q" ? "q" : k === "rating" ? "rating" : k === "estado" ? "estado" : "distrito", v?.toString() ?? ""])), ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    return `/agencia?${params.toString()}`;
  }

  const inputStyle = { padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "inherit", fontSize: "0.85rem", width: "100%" };
  const labelStyle = { fontSize: "0.7rem", opacity: 0.38, display: "block", marginBottom: "0.2rem" };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.2rem" }}>

      {/* Header */}
      <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.4, marginBottom: "0.5rem" }}>Diretório</p>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 0.4rem" }}>🏢 Agências Licenciadas</h1>
      <p style={{ opacity: 0.45, fontSize: "0.88rem", marginBottom: "1.5rem" }}>
        {total.toLocaleString("pt-PT")} agências verificadas no Registo Nacional de Turismo de Portugal
      </p>

      {/* Filters */}
      <form method="GET" action="/agencia" style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "1.2rem", marginBottom: "1.2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <label style={labelStyle} htmlFor="q">Nome, RNAVT ou NIF</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Pesquisar..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="distrito">Distrito</label>
            <select id="distrito" name="distrito" defaultValue={sp.distrito ?? ""} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Todos os distritos</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="rating">Rating mínimo</label>
            <select id="rating" name="rating" defaultValue={sp.rating ?? ""} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Qualquer rating</option>
              <option value="4">4★ ou mais</option>
              <option value="4.5">4.5★ ou mais</option>
              <option value="3">3★ ou mais</option>
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="estado">Estado</label>
            <select id="estado" name="estado" defaultValue={sp.estado ?? ""} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Todas</option>
              <option value="ativas">Apenas ativas</option>
              <option value="inativas">Inativas</option>
            </select>
          </div>
        </div>
        <input type="hidden" name="pagina" value="1" />
        <button type="submit" style={{ padding: "0.55rem 1.2rem", borderRadius: "8px", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
          🔍 Filtrar
        </button>
        {(sp.q || sp.distrito || sp.rating || sp.estado) && (
          <Link href="/agencia" style={{ marginLeft: "0.6rem", fontSize: "0.8rem", opacity: 0.4, textDecoration: "none" }}>× Limpar</Link>
        )}
      </form>

      {/* Agency list */}
      <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1.4rem" }}>
        {agencies.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", opacity: 0.4 }}>
            <p>Nenhuma agência encontrada com esses filtros.</p>
            <Link href="/agencia" style={{ color: "inherit", fontSize: "0.85rem" }}>← Ver todas</Link>
          </div>
        )}
        {agencies.map(agency => {
          const isActive = agency.nifptStatus !== "inactive";
          const name = agency.commercialName ?? agency.legalName;
          const location = [agency.city, agency.district].filter(Boolean).join(", ");
          return (
            <Link
              key={agency.rnavt}
              href={`/agencia/${agency.rnavt}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.9rem 1.1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", textDecoration: "none", color: "inherit", transition: "all 0.15s ease" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.15rem" }}>
                  <span style={{ fontSize: "0.72rem" }}>{isActive ? "✅" : "⚠️"}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                </div>
                <div style={{ fontSize: "0.76rem", opacity: 0.4 }}>
                  RNAVT {agency.rnavt}{location ? ` · ${location}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {agency.googleRating != null ? (
                  <div style={{ fontSize: "0.82rem", color: "#fbbf24", fontWeight: 700 }}>
                    ★ {agency.googleRating.toFixed(1)}
                    <span style={{ opacity: 0.4, fontWeight: 400 }}> ({agency.googleReviewCount ?? 0})</span>
                  </div>
                ) : (
                  <span style={{ fontSize: "0.72rem", opacity: 0.25 }}>sem rating</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Paginação" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {page > 1 && (
            <Link href={buildUrl({ pagina: String(page - 1) })} style={{ padding: "0.45rem 0.9rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "inherit", textDecoration: "none", fontSize: "0.85rem" }}>
              ← Anterior
            </Link>
          )}
          <span style={{ fontSize: "0.82rem", opacity: 0.45 }}>
            Página {page} de {totalPages} ({total.toLocaleString("pt-PT")} resultados)
          </span>
          {page < totalPages && (
            <Link href={buildUrl({ pagina: String(page + 1) })} style={{ padding: "0.45rem 0.9rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "inherit", textDecoration: "none", fontSize: "0.85rem" }}>
              Próxima →
            </Link>
          )}
        </nav>
      )}

      {/* SEO note */}
      <p style={{ marginTop: "2rem", fontSize: "0.78rem", opacity: 0.3, textAlign: "center" }}>
        Dados do Registo Nacional de Turismo · Turismo de Portugal · Atualizado regularmente
      </p>
    </div>
  );
}
