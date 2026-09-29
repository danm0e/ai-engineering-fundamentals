import { tool } from "ai";
import { z } from "zod";

const updateFields = z.object({
  x: z.number().nullable(),
  y: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  text: z.string().nullable(),
  fontSize: z.number().nullable(),
  textAlign: z.enum(["left", "center", "right"]).nullable(),
  strokeColor: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).nullable(),
  strokeWidth: z.number().nullable(),
  roughness: z.number().nullable(),
  opacity: z.number().nullable(),
});

export const updateElements = tool({
  description: `Update one or more existing elements by id. Pass null for any field you don't want to change.

Example: updateElements({ updates: [
  { id: "rect_login", fields: { backgroundColor: "#fa5252", x: null, y: null, ... } }
]})`,
  inputSchema: z.object({
    updates: z.array(z.object({ id: z.string(), fields: updateFields })),
  }),
  strict: true,
});
