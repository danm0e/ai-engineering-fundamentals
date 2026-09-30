import { z } from "zod";

// Element schema for the agent's canvas tools.
//
// IMPORTANT: this schema describes the INPUT format that
// `convertToExcalidrawElements` (the Excalidraw skeleton helper) consumes,
// NOT the runtime element shape that lives on the canvas afterwards. The
// helper has its own vocabulary:
//
//   - To label a shape (rectangle, ellipse, diamond), set `label: { text }`
//     directly on the shape. Do NOT create a separate text element. The
//     helper will produce the child text element and wire up `containerId`
//     and `boundElements` for you.
//   - To bind an arrow between two shapes, set `start: { id }` and
//     `end: { id }` on the arrow. Do NOT use `startBinding` / `endBinding`,
//     those are runtime field names that the helper does not consume.
//
// Encoding the labeling and binding rules in the schema (rather than in
// prose in the system prompt) means the model literally cannot construct an
// element that drops its label or floats its arrow. The structural
// invariants are enforced by the type system.
//
// Style properties are grouped into one optional `style` object per shape
// (and label typography into `label`) instead of individually optional
// fields. `z.union`'s six shape branches each spread their own copy of
// every field, so flat optional fields multiply across branches: six style
// fields x six branches alone compiled to 36 separate union/optional
// parameters against Anthropic's per-request cap. Bundling into one
// optional object per branch collapses that multiplication. The cost:
// customizing any single style property means sending the whole group
// (the descriptions below give Excalidraw's own defaults for the rest).

export const styleSchema = z
  .object({
    strokeColor: z
      .string()
      .describe("Hex stroke color. Excalidraw default: '#1e1e1e'."),
    backgroundColor: z
      .string()
      .describe("Hex fill color. Excalidraw default: 'transparent'."),
    fillStyle: z
      .enum(["solid", "hachure", "cross-hatch"])
      .describe("Excalidraw default: 'hachure'."),
    strokeWidth: z.number().describe("Excalidraw default: 1."),
    roughness: z
      .number()
      .describe("0 for clean, 1 for sketchy, 2 for cartoonish. Excalidraw default: 1."),
    opacity: z.number().describe("0-100. Excalidraw default: 100."),
  })
  .describe(
    "All style properties together. Omit this entire object to use Excalidraw's defaults for every one; to customize any single property, supply all six (use the stated defaults for the ones you aren't changing)."
  );

const labelSchema = z
  .object({
    text: z.string().describe("The label text rendered inside the shape or on the arrow."),
    fontSize: z.number().describe("Excalidraw default: 20."),
    textAlign: z.enum(["left", "center", "right"]).describe("Excalidraw default: 'left'."),
  })
  .describe(
    "Label rendered inside this shape (or on this arrow). Excalidraw centers the text inside the container automatically and creates the bound text element for you. This is the ONLY way to put text inside a box. Omit for unlabeled shapes."
  );

const baseFields = {
  id: z
    .string()
    .describe(
      "Unique, concise, meaningful id like 'rect_login' or 'arrow_user_api'. Other elements reference this id, so it must be unique within the canvas and stable across calls."
    ),
  x: z.number().describe("X position in pixels"),
  y: z.number().describe("Y position in pixels"),
  width: z.number().describe("Width in pixels. At least 20."),
  height: z.number().describe("Height in pixels. At least 20."),
};

// Container shapes (rectangle/ellipse/diamond) are structurally identical,
// only the `type` value differs, so they're one union branch with `type`
// as an enum rather than three near-duplicate branches. Each duplicate
// branch is a full separate object in the compiled grammar (label, style,
// and their nested fields all over again), which adds real compilation
// cost independent of the optional/union-typed parameter count. Merging
// costs nothing structurally: arrow/line still require start/end, only
// containers and arrows get label, text is still the only bare-text type.
const containerSchema = z.object({
  type: z.enum(["rectangle", "ellipse", "diamond"]),
  ...baseFields,
  label: labelSchema.optional(),
  style: styleSchema.optional(),
});

const endpointSchema = z
  .object({
    id: z
      .string()
      .describe(
        "Id of the shape this end of the arrow attaches to. The shape must exist in the same call or already on the canvas."
      ),
  })
  .describe("Arrow endpoint binding. Set both start AND end for any arrow that connects two shapes.");

const arrowSchema = z.object({
  type: z.literal("arrow"),
  ...baseFields,
  start: endpointSchema.optional(),
  end: endpointSchema.optional(),
  label: labelSchema
    .optional()
    .describe(
      "Optional label rendered on the arrow itself, e.g. 'yes', 'no', '1. login'. Omit for unlabeled arrows."
    ),
  style: styleSchema.optional(),
});

const lineSchema = z.object({
  type: z.literal("line"),
  ...baseFields,
  start: endpointSchema.optional(),
  end: endpointSchema.optional(),
  style: styleSchema.optional(),
});

// Standalone text. Use this ONLY for floating annotations that are not
// attached to a shape. To label a shape, set `label` on the shape itself.
const textSchema = z.object({
  type: z.literal("text"),
  ...baseFields,
  text: z.string().describe("The text content. Required."),
  fontSize: z.number().describe("Excalidraw default: 20."),
  textAlign: z.enum(["left", "center", "right"]).describe("Excalidraw default: 'left'."),
  style: styleSchema.optional(),
});

// NOTE: we use z.union, not z.discriminatedUnion. They look interchangeable
// but compile to different JSON Schema: discriminatedUnion produces `oneOf`,
// which OpenAI's strict mode rejects with "'oneOf' is not permitted."
// z.union produces `anyOf`, which strict mode accepts. The model still
// picks the right branch by the `type` literal either way.
export const elementSchema = z.union([
  containerSchema,
  arrowSchema,
  lineSchema,
  textSchema,
]);

export type ElementInput = z.infer<typeof elementSchema>;
