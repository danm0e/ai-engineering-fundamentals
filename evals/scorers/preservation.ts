import type { EvalScorer } from "braintrust";
import type { AgentOutput } from "./schema";
import type { GoldenTestCase } from "../buildMessages";

export const preservationScorer: EvalScorer<
  GoldenTestCase,
  AgentOutput,
  GoldenTestCase
> = ({ output, expected }) => {
  const preservedIds = expected?.preservedIds;
  if (!preservedIds || preservedIds.length === 0) {
    return null; // skip cases that don't care about preservation
  }

  const outputIds = new Set(
    output.elements
      .filter(
        (el): el is { id: string } =>
          !!el && typeof el === "object" && "id" in el,
      )
      .map((el) => el.id),
  );

  let kept = 0;
  const missing: string[] = [];
  for (const id of preservedIds) {
    if (outputIds.has(id)) kept += 1;
    else missing.push(id);
  }

  return {
    name: "Preservation",
    score: kept / preservedIds.length,
    metadata: { kept, missing, total: preservedIds.length },
  };
};
