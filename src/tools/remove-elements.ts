import { tool } from "ai";
import { z } from "zod";

export const removeElements = tool({
  description: `Remove elements from the canvas by id. Call queryCanvas first if you don't know what's there.

Example: removeElements({ ids: ["rect_old", "arrow_stale"] })`,
  inputSchema: z.object({
    ids: z.array(z.string()),
  }),
  strict: true,
});
