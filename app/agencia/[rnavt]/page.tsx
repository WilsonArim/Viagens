import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";


// ── Data fetcher ─────────────────────────────────────────────────────────────

async function getAgency(rnavt: string) {
  return prisma.agency.findUnique({
    where: { rnavt },
    include: { externalLinks: true },
  });
}

// ── SEO metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ rnavt: string }> }): Promise<Metadata> {
  const { rnavt } = await params;
  const agency = await getAgency(rnavt);
  if (!agency) return { title: "Agência não encontrada" };

  const name = agency.commercialName ?? agency.legalName;
  const location = [agency.city, agency.district].filter(Boolean).join(", ");
  const rating = agency.googleRating ? `${agency.googleRating.toFixed(1)}★` : null;
  const status = agency.nifptStatus === "inactive" ? "Registo inativo" : "Licenciada e Ativa";

  return {
    title: `${name} — RNAVT ${rnavt} | Agência de Viagens Verificada`,
    description: `${name}${location ? ` em ${location}` : ""}. ${status}. Verificada no Registo Nacional de Turismo de Portugal.${rating ? ` ${rating} no Google.` : ""} RNAVT ${rnavt} · NIF ${agency.nif}.`,
    openGraph: {
      title: `${name} — Agência Verificada | RNAVT ${rnavt}`,
      description: `Agência de viagens licenciada${location ? ` em ${location}` : ""}. Verifique a licença, morada e avaliações Google.`,
      type: "website",
    },
    alternates: {
      canonical: `/agencia/${rnavt}`,
    },
  };
}

// ── Structured data (JSON-LD) ─────────────────────────────────────────────────

function AgencyJsonLd({ agency }: { agency: Awaited<ReturnType<typeof getAgency>> }) {
  if (!agency) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: agency.commercialName ?? agency.legalName,
    legalName: agency.legalName,
    taxID: agency.nif,
    address: agency.address ? {
      "@type": "PostalAddress",
      streetAddress: agency.address,
      addressLocality: agency.city ?? undefined,
      addressRegion: agency.district ?? undefined,
      postalCode: agency.postalCode ?? undefined,
      addressCountry: "PT",
    } : undefined,
    telephone: agency.phone ?? agency.nifptPhone ?? undefined,
    url: agency.nifptWebsite ?? undefined,
    aggregateRating: agency.googleRating ? {
      "@type": "AggregateRating",
      ratingValue: agency.googleRating,
      reviewCount: agency.googleReviewCount ?? 1,
    } : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating, count, placeId }: { rating: number; count?: number | null; placeId?: string | null }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3 && rating % 1 < 0.8;
  const empty = Math.max(0, 5 - full - (half ? 1 : 0));
  const inner = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontFamily: "system-ui" }}>
      <span style={{ color: "#fbbf24", fontSize: "1.1rem" }}>
        {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(empty)}
      </span>
      <strong style={{ color: "#fbbf24" }}>{rating.toFixed(1)}</strong>
      {count != null && <span style={{ opacity: 0.45, fontSize: "0.82rem" }}>({count.toLocaleString("pt-PT")} avaliações)</span>}
    </span>
  );
  if (placeId) return <a href={`https://www.google.com/maps/place/?q=place_id:${placeId}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{inner}</a>;
  return inner;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: "0.2rem" }}>
      <span style={{ fontSize: "0.72rem", opacity: 0.38, display: "block", marginBottom: "0.1rem" }}>{label}</span>
      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AgencyPage({ params }: { params: Promise<{ rnavt: string }> }) {
  const { rnavt } = await params;
  const agency = await getAgency(rnavt);
  if (!agency) notFound();

  const isActive = agency.nifptStatus !== "inactive";
  const name = agency.commercialName ?? agency.legalName;
  const location = [agency.city, agency.district].filter(Boolean).join(", ");
  const website = agency.nifptWebsite ?? agency.externalLinks.find(l => l.source === "website")?.url;

  const cardStyle = {
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "1.4rem",
    marginBottom: "0.85rem",
  };

  return (
    <>
      <AgencyJsonLd agency={agency} />

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1.2rem" }}>

        {/* Breadcrumb */}
        <nav style={{ fontSize: "0.78rem", opacity: 0.4, marginBottom: "1.4rem" }}>
          <Link href="/agencia" style={{ color: "inherit", textDecoration: "none" }}>Agências</Link>
          <span style={{ margin: "0 0.4rem" }}>›</span>
          <span>{name}</span>
        </nav>

        {/* Hero */}
        <div style={{ ...cardStyle, border: `1.5px solid ${isActive ? "rgba(74,222,128,0.4)" : "rgba(251,191,36,0.3)"}`, background: `linear-gradient(135deg, ${isActive ? "rgba(74,222,128,0.06)" : "rgba(251,191,36,0.05)"} 0%, rgba(0,0,0,0) 70%)` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "1.2rem" }}>{isActive ? "✅" : "⚠️"}</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: isActive ? "#4ade80" : "#fbbf24", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {isActive ? "Licenciada e Ativa" : "Registo Inativo"}
                </span>
              </div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.3rem", lineHeight: 1.2 }}>{name}</h1>
              {agency.commercialName && agency.commercialName !== agency.legalName && (
                <p style={{ fontSize: "0.82rem", opacity: 0.45, margin: "0 0 0.3rem" }}>{agency.legalName}</p>
              )}
              {location && <p style={{ fontSize: "0.9rem", opacity: 0.6, margin: 0 }}>📍 {location}</p>}
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "inline-block", padding: "0.45rem 1rem", borderRadius: "20px", background: isActive ? "rgba(74,222,128,0.12)" : "rgba(251,191,36,0.12)", color: isActive ? "#4ade80" : "#fbbf24", fontWeight: 800, fontSize: "0.9rem", letterSpacing: "0.04em" }}>
                RNAVT {rnavt}
              </span>
              <p style={{ fontSize: "0.72rem", opacity: 0.35, marginTop: "0.3rem" }}>Turismo de Portugal</p>
            </div>
          </div>

          {agency.googleRating != null && (
            <div style={{ marginTop: "1rem", paddingTop: "0.9rem", borderTop: `1px solid ${isActive ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.06)"}` }}>
              <Stars rating={agency.googleRating} count={agency.googleReviewCount} placeId={agency.googlePlaceId} />
            </div>
          )}
        </div>

        {/* Official data */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.4, marginBottom: "1rem", marginTop: 0 }}>Dados Oficiais</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            <Field label="NIF / NIPC" value={agency.nif} />
            <Field label="Morada" value={agency.address} />
            <Field label="Código Postal" value={agency.postalCode} />
            <Field label="Localidade" value={agency.city} />
            <Field label="Distrito" value={agency.district} />
            <Field label="Telefone" value={agency.phone ?? agency.nifptPhone} />
            {agency.nifptEmail && <Field label="E-mail" value={agency.nifptEmail} />}
            {agency.nifptNature && <Field label="Natureza Jurídica" value={agency.nifptNature} />}
            {agency.nifptCapital && <Field label="Capital Social" value={agency.nifptCapital} />}
            {agency.nifptStartDate && <Field label="Início de Atividade" value={agency.nifptStartDate} />}
          </div>
        </div>

        {/* External links */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" style={{ padding: "0.55rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "inherit", textDecoration: "none", fontSize: "0.84rem", fontWeight: 600 }}>
              🌐 Website
            </a>
          )}
          {agency.googlePlaceId && (
            <a href={`https://www.google.com/maps/place/?q=place_id:${agency.googlePlaceId}`} target="_blank" rel="noopener noreferrer" style={{ padding: "0.55rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "inherit", textDecoration: "none", fontSize: "0.84rem", fontWeight: 600 }}>
              📍 Google Maps
            </a>
          )}
          {agency.nifptRacius && (
            <a href={agency.nifptRacius} target="_blank" rel="noopener noreferrer" style={{ padding: "0.55rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "inherit", textDecoration: "none", fontSize: "0.84rem", fontWeight: 600 }}>
              📋 Racius
            </a>
          )}
          <a href={`https://rnt.turismodeportugal.pt/rnt/Pesquisa_AVT.aspx`} target="_blank" rel="noopener noreferrer" style={{ padding: "0.55rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "inherit", textDecoration: "none", fontSize: "0.84rem", fontWeight: 600 }}>
            🏛️ RNT Oficial
          </a>
        </div>

        {/* Verify CTA */}
        <div style={{ borderRadius: "12px", border: "1px solid rgba(74,222,128,0.2)", background: "rgba(74,222,128,0.04)", padding: "1.2rem", marginBottom: "0.85rem" }}>
          <p style={{ margin: "0 0 0.8rem", fontSize: "0.9rem", opacity: 0.8 }}>
            Está a pensar trabalhar com esta agência? Usa o nosso Farejar Agência para uma verificação completa com reputação online.
          </p>
          <Link
            href={`/agency-check?rnavt=${rnavt}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", borderRadius: "10px", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}
          >
            🔍 Farejar esta Agência →
          </Link>
        </div>

        {/* Back to directory */}
        <Link href="/agencia" style={{ fontSize: "0.82rem", opacity: 0.4, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          ← Todas as agências
        </Link>
      </div>
    </>
  );
}

// ── Static params (build top agencies; others generated on demand) ───────────
export async function generateStaticParams() {
  // Pre-build first 200 most-reviewed agencies; rest are ISR on demand
  const agencies = await prisma.agency.findMany({
    select: { rnavt: true },
    orderBy: { googleReviewCount: "desc" },
    take: 200,
  });
  return agencies.map(a => ({ rnavt: a.rnavt }));
}
