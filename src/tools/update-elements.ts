import { tool } from "ai";
import { z } from "zod";
import { styleSchema } from "./element-schema";

// Client side tool: no execute. The browser fulfills it via onToolCall, which
// also strips undefined fields before applying. Style properties are
// bundled into one optional `style` object (shared with element-schema.ts)
// rather than six individually optional fields, since Anthropic caps the
// number of optional/union-typed parameters per request. The cost: changing
// any one style property means resending the whole group (call queryCanvas
// first if you don't already know the element's current values).

const updateFields = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  style: styleSchema.optional(),
});

export const updateElements = tool({
  description: `Update one or more existing elements by id. Omit any field you don't want to change. Only use ids that exist on the canvas, call queryCanvas first if you're not sure.

Example: updateElements({ updates: [
  { id: "rect_login", fields: { style: { strokeColor: "#1e1e1e", backgroundColor: "#fa5252", fillStyle: "hachure", strokeWidth: 1, roughness: 1, opacity: 100 } } }
]})`,
  inputSchema: z.object({
    updates: z.array(
      z.object({
        id: z.string(),
        fields: updateFields,
      })
    ),
  }),
  strict: true,
});
