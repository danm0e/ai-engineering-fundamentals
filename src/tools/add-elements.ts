import { tool } from "ai";
import { z } from "zod";
import { elementSchema } from "./element-schema";

// Client side tool: no execute. The browser fulfills it via onToolCall in
// App.tsx, which appends the new elements to the live Excalidraw scene and
// returns the result back to the agent.

export const addElements = tool({
  description: `Add new elements to the canvas. Use this for creating diagrams or adding to an existing one. Each element needs an id, type, position, and size.

To label a shape, set the shape's \`label\` field. Excalidraw centers the text inside the box automatically. Do NOT create a separate text element to label a shape. Standalone text elements are for floating annotations only.

To connect two shapes with an arrow, set \`start: { id: ... }\` and \`end: { id: ... }\` on the arrow. The shapes must exist in the same call or already be on the canvas.

Example: addElements({ elements: [
  { type: "rectangle", id: "rect_start", x: 100, y: 100, width: 200, height: 80, label: { text: "Start" } },
  { type: "rectangle", id: "rect_end",   x: 380, y: 100, width: 200, height: 80, label: { text: "End" } },
  { type: "arrow",     id: "arrow_start_end", x: 300, y: 140, width: 80, height: 0, start: { id: "rect_start" }, end: { id: "rect_end" } }
]})`,
  inputSchema: z.object({
    elements: z.array(elementSchema).describe("Array of new elements to add to the canvas"),
  }),
  // No `strict: true` here (unlike update-elements/remove-elements): this
  // tool's schema is a 4-branch z.union, and Anthropic's strict mode compiles
  // a formal grammar per tool whose cost scales with schema complexity, not
  // just parameter count - large enough here to hit "the compiled grammar is
  // too large" even after collapsing rectangle/ellipse/diamond into one
  // branch. Dropping strict here doesn't remove validation: the `ai` SDK
  // still runs every tool call through Zod (`safeParseJSON` against
  // `elementSchema`) before it ever reaches onToolCall in App.tsx - it only
  // gives up Anthropic's grammar-level guarantee that the raw output is
  // already schema-valid before that parse happens.
});
