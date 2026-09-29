import { tool } from "ai";
import { z } from "zod";
import { elementSchema } from "./element-schema";

export const addElements = tool({
  description: `Add new elements to the canvas. Each element needs an id, type, position, and size.

Example: addElements({ elements: [
  { id: "rect_start", type: "rectangle", x: 100, y: 100, width: 160, height: 80, text: "Start" },
  { id: "rect_end", type: "rectangle", x: 360, y: 100, width: 160, height: 80, text: "End" },
  { id: "arrow_start_end", type: "arrow", x: 260, y: 140, width: 100, height: 0, startBinding: { elementId: "rect_start", focus: 0, gap: 8 }, endBinding: { elementId: "rect_end", focus: 0, gap: 8 } }
]})`,
  inputSchema: z.object({
    elements: z.array(elementSchema),
  }),
  strict: true,
});
