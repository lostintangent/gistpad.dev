import { z } from "zod";

// The pieces that the agent's responses (answers and reviews) share.

export const followUpSchema = z.object({ question: z.string(), topic: z.string() });

/** A follow-up request that the agent suggests (after an answer or review), which the user can run. */
export type AgentFollowUp = z.infer<typeof followUpSchema>;

/** Removes the citation markers that web searches can leave in the agent's text. */
export const removeCitationMarkers = (text: string) =>
  text.replace(/citeturn\d+(search|view)\d+/g, "");
