import { z } from "zod";

/** Schema for chat messages stored as JSON in ChatSession.messages */
export const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
  toolResults: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type ChatMessageParsed = z.infer<typeof chatMessageSchema>;

export const chatMessagesSchema = z.array(chatMessageSchema);

/** Schema for AgencyCheck.onlineData JSON field */
export const onlineDataSchema = z.object({
  rnavtFound: z.string().nullable(),
  agencyNameFound: z.string().nullable(),
  followers: z.number().nullable().optional(),
  ageDescription: z.string().nullable().optional(),
  redFlags: z.array(z.string()),
  summary: z.string(),
  mismatch: z.boolean().optional(),
  rnavtBelongsTo: z.string().nullable().optional(),
});

/** Schema for Agency.googleReviews JSON field */
export const googleReviewSchema = z.object({
  author: z.string(),
  rating: z.number(),
  text: z.string(),
  time: z.string().optional(),
});

export const googleReviewsSchema = z.array(googleReviewSchema);
