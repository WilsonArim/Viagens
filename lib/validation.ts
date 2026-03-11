import { z } from "zod";

export const memberSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nome é obrigatório").max(80, "Nome demasiado longo"),
  age: z
    .number()
    .int("Idade deve ser um número inteiro")
    .min(0, "Idade não pode ser negativa")
    .max(120, "Idade inválida"),
  hobbies: z.array(z.string().trim().min(1)).default([]),
  interests: z.array(z.string().trim().min(1)).default([]),
});

export const familyProfileSchema = z.object({
  generalBudget: z.string().trim().min(2, "Orçamento é obrigatório"),
  dietaryRestrictions: z.array(z.string().trim().min(1)).default([]),
  travelPace: z.enum(["slow", "balanced", "fast"]).default("balanced"),
  notes: z.string().trim().max(600).optional(),
  members: z.array(memberSchema).min(1, "Adiciona pelo menos um membro"),
});

export const xrayRequestSchema = z.object({
  hotelName: z.string().trim().min(2, "Nome do hotel é obrigatório"),
  destination: z.string().trim().min(2, "Destino é obrigatório"),
  reviews: z.array(z.string().trim().min(2)).max(40).optional(),
  tripId: z.string().cuid().optional(),
});

export const itineraryRequestSchema = z.object({
  destination: z.string().trim().min(2, "Destino é obrigatório"),
  days: z
    .number()
    .int("Número de dias deve ser inteiro")
    .min(1, "Número de dias deve ser maior do que zero")
    .max(30, "Número de dias máximo é 30"),
  startDate: z.string().trim().optional(),
  tripId: z.string().cuid().optional(),
});

export const radarRequestSchema = z.object({
  destination: z.string().trim().min(2, "Destino é obrigatório"),
  tripId: z.string().cuid().optional(),
});

export const tripHistorySchema = z.object({
  limit: z
    .number()
    .int("Limite deve ser inteiro")
    .min(1, "Limite mínimo é 1")
    .max(50, "Limite máximo é 50")
    .optional(),
});

export const agencyReputationSchema = z.object({
  commercialName: z.string().trim().min(2, "Nome comercial é obrigatório"),
  city: z.string().trim().max(100).optional(),
  website: z.string().trim().url("URL inválido").optional(),
});

export const webmcpToolNameSchema = z.enum([
  "get_user_preferences",
  "analyze_hotel",
  "generate_itinerary",
  "get_travel_radar",
  "get_trip_history",
  "sniff_agency_reputation",
  "read_instagram_bio",
  "discover_complaint_urls",
  "read_complaints_summary",
]);

export const webmcpExecuteSchema = z.object({
  toolName: webmcpToolNameSchema,
  input: z.unknown().optional(),
});

export type FamilyProfileInput = z.infer<typeof familyProfileSchema>;
export type WebMCPToolName = z.infer<typeof webmcpToolNameSchema>;
