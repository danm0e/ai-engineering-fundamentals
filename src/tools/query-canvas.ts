import { tool } from "ai";
import { z } from "zod";

export const queryCanvas = tool({
  description: `Read the current contents of the canvas. Call this when you need to know what elements already exist before adding, modifying, or removing anything. Returns a summary of every element with its id, type, position, and label.

Example: queryCanvas({})`,
  inputSchema: z.object({}),
});
