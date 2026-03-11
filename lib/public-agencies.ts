import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const AGENCY_DIRECTORY_PAGE_SIZE = 24;

const ALLOWED_MIN_RATINGS = [0, 3, 4, 4.5] as const;
const STATUS_FILTERS = ["all", "active"] as const;

export type AgencyStatusFilter = (typeof STATUS_FILTERS)[number];
type MinRatingOption = (typeof ALLOWED_MIN_RATINGS)[number];

type SearchParamValue = string | string[] | undefined;

const publicAgencySelect = Prisma.validator<Prisma.AgencySelect>()({
  id: true,
  rnavt: true,
  nif: true,
  legalName: true,
  commercialName: true,
  address: true,
  city: true,
  district: true,
  postalCode: true,
  phone: true,
  googleRating: true,
  googleReviewCount: true,
  googleReviews: true,
  googlePlaceId: true,
  nifptStatus: true,
  nifptActivity: true,
  nifptWebsite: true,
  nifptEmail: true,
  nifptPhone: true,
  nifptNature: true,
  nifptCapital: true,
  nifptStartDate: true,
  nifptRegion: true,
  nifptCounty: true,
  nifptParish: true,
  nifptLastChecked: true,
  updatedAt: true,
  externalLinks: {
    where: { source: "website" },
    select: { url: true },
    take: 1,
  },
});

export type PublicAgency = Prisma.AgencyGetPayload<{
  select: typeof publicAgencySelect;
}>;

export interface AgencyDirectoryFilters {
  district?: string;
  minRating: MinRatingOption;
  page: number;
  status: AgencyStatusFilter;
}

export interface AgencyDirectoryResult {
  agencies: PublicAgency[];
  currentPage: number;
  districts: string[];
  filters: AgencyDirectoryFilters;
  totalCount: number;
  totalPages: number;
}

export interface AgencyGoogleReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface AgencyStatusBadge {
  description: string;
  label: string;
  tone: "success" | "warning";
}

function getFirstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePositiveInteger(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeMinRating(value: string | undefined): MinRatingOption {
  const parsed = Number.parseFloat(value ?? "");

  return ALLOWED_MIN_RATINGS.includes(parsed as MinRatingOption)
    ? (parsed as MinRatingOption)
    : 0;
}

function normalizeStatusFilter(value: string | undefined): AgencyStatusFilter {
  return STATUS_FILTERS.includes(value as AgencyStatusFilter)
    ? (value as AgencyStatusFilter)
    : "all";
}

function normalizeRnavt(rawRnavt: string): string {
  return rawRnavt.replace(/\s+/g, "");
}

function buildDirectoryWhere(filters: AgencyDirectoryFilters): Prisma.AgencyWhereInput {
  const conditions: Prisma.AgencyWhereInput[] = [];

  if (filters.district) {
    conditions.push({ district: filters.district });
  }

  if (filters.minRating > 0) {
    conditions.push({ googleRating: { gte: filters.minRating } });
  }

  if (filters.status === "active") {
    conditions.push({ nifptStatus: "active" });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAgencyDirectorySearchParams(searchParams: Record<string, SearchParamValue>): AgencyDirectoryFilters {
  const district = getFirstValue(searchParams.district)?.trim();

  return {
    district: district || undefined,
    minRating: normalizeMinRating(getFirstValue(searchParams.rating)),
    page: normalizePositiveInteger(getFirstValue(searchParams.page)),
    status: normalizeStatusFilter(getFirstValue(searchParams.status)),
  };
}

export async function getAgencyDirectory(filters: AgencyDirectoryFilters): Promise<AgencyDirectoryResult> {
  const where = buildDirectoryWhere(filters);
  const [districtRows, totalCount] = await Promise.all([
    prisma.agency.findMany({
      where: { district: { not: null } },
      distinct: ["district"],
      orderBy: { district: "asc" },
      select: { district: true },
    }),
    prisma.agency.count({ where }),
  ]);

  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / AGENCY_DIRECTORY_PAGE_SIZE);
  const currentPage = Math.min(filters.page, totalPages);

  const agencies = await prisma.agency.findMany({
    where,
    select: publicAgencySelect,
    skip: (currentPage - 1) * AGENCY_DIRECTORY_PAGE_SIZE,
    take: AGENCY_DIRECTORY_PAGE_SIZE,
    orderBy: [
      { googleRating: { sort: "desc", nulls: "last" } },
      { googleReviewCount: { sort: "desc", nulls: "last" } },
      { legalName: "asc" },
    ],
  });

  return {
    agencies,
    currentPage,
    districts: districtRows
      .map((row) => row.district)
      .filter((district): district is string => Boolean(district)),
    filters,
    totalCount,
    totalPages,
  };
}

export async function getPublicAgencyByRnavt(rnavt: string): Promise<PublicAgency | null> {
  const normalizedRnavt = normalizeRnavt(rnavt.trim());

  if (!/^\d+$/.test(normalizedRnavt)) {
    return null;
  }

  return prisma.agency.findUnique({
    where: { rnavt: normalizedRnavt },
    select: publicAgencySelect,
  });
}

export async function getAgencySitemapEntries(): Promise<Array<{ rnavt: string; updatedAt: Date }>> {
  return prisma.agency.findMany({
    select: {
      rnavt: true,
      updatedAt: true,
    },
    orderBy: { rnavt: "asc" },
  });
}

export function getAgencyDisplayName(
  agency: Pick<PublicAgency, "commercialName" | "legalName">
): string {
  return agency.commercialName?.trim() || agency.legalName;
}

export function getAgencySecondaryName(
  agency: Pick<PublicAgency, "commercialName" | "legalName">
): string | null {
  const commercialName = agency.commercialName?.trim();

  if (!commercialName || commercialName === agency.legalName) {
    return null;
  }

  return agency.legalName;
}

export function getAgencyStatusBadge(
  agency: Pick<PublicAgency, "nifptLastChecked" | "nifptStatus">
): AgencyStatusBadge {
  if (agency.nifptStatus === "active") {
    return {
      description: "RNAVT presente e nif.pt marcado como ativo.",
      label: "Licenciada e Ativa",
      tone: "success",
    };
  }

  return {
    description: agency.nifptLastChecked
      ? "O RNAVT existe, mas o estado fiscal não está ativo no último sync."
      : "O RNAVT existe, mas o sync do nif.pt ainda não fechou o estado da empresa.",
    label: "Registo desatualizado",
    tone: "warning",
  };
}

export function getAgencyLocationLabel(
  agency: Pick<PublicAgency, "city" | "district">
): string | null {
  const parts = [agency.city, agency.district].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function getAgencyAddressLabel(
  agency: Pick<PublicAgency, "address" | "city" | "postalCode">
): string | null {
  const parts = [agency.address, agency.postalCode, agency.city].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function getAgencyPrimaryPhone(
  agency: Pick<PublicAgency, "nifptPhone" | "phone">
): string | null {
  return agency.nifptPhone?.trim() || agency.phone?.trim() || null;
}

export function normalizeExternalUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getAgencyWebsiteUrl(
  agency: Pick<PublicAgency, "externalLinks" | "nifptWebsite">
): string | null {
  return normalizeExternalUrl(agency.nifptWebsite ?? agency.externalLinks[0]?.url ?? null);
}

export function getAgencyMapsUrl(
  agency: Pick<PublicAgency, "address" | "city" | "googlePlaceId" | "legalName">
): string {
  if (agency.googlePlaceId) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(agency.googlePlaceId)}`;
  }

  const query = [agency.legalName, agency.address, agency.city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function getAgencySearchUrl(
  agency: Pick<PublicAgency, "legalName" | "rnavt">
): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${agency.legalName} RNAVT ${agency.rnavt}`)}`;
}

export function buildAgencyMetaTitle(
  agency: Pick<PublicAgency, "legalName" | "rnavt">
): string {
  return `${agency.legalName} — RNAVT ${agency.rnavt} | Agência Licenciada`;
}

export function buildAgencyMetaDescription(
  agency: Pick<PublicAgency, "city" | "district" | "googleRating" | "googleReviewCount">
): string {
  const location = agency.district || agency.city || "Portugal";
  const ratingText =
    agency.googleRating != null
      ? ` ${agency.googleRating.toFixed(1)}★ no Google${
          agency.googleReviewCount != null
            ? ` (${agency.googleReviewCount.toLocaleString("pt-PT")} avaliações)`
            : ""
        }.`
      : "";

  return `Agência de viagens licenciada em ${location}. Verificada no Registo Nacional do Turismo.${ratingText}`;
}

export function parseAgencyGoogleReviews(
  value: Prisma.JsonValue | null | undefined
): AgencyGoogleReview[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isJsonObject(entry)) {
        return null;
      }

      const author = typeof entry.author === "string" ? entry.author : "Cliente Google";
      const text = typeof entry.text === "string" ? entry.text : "";
      const relativeTime =
        typeof entry.relativeTime === "string" ? entry.relativeTime : "";
      const rating = typeof entry.rating === "number" ? entry.rating : 0;

      if (!text) {
        return null;
      }

      return { author, rating, relativeTime, text };
    })
    .filter((review): review is AgencyGoogleReview => review !== null);
}
