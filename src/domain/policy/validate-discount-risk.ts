import {
  DiscountRiskPolicyZ,
  POLICY_SCHEMAS,
  type PolicyKind,
  type PolicyPayload,
} from "./schemas";
import { ValidationError } from "../errors";
export type PolicyValidation =
  { ok: true } | { ok: false; errors: { path: string; message: string }[] };
/** Overall conditions are dormant when the optional ceiling is null (PRD 7.2). */
export function validateDiscountRisk(input: unknown): PolicyValidation {
  const parsed = DiscountRiskPolicyZ.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  const p = parsed.data,
    errors: { path: string; message: string }[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });
  if (new Set(p.reviewerChain).size !== p.reviewerChain.length)
    add("reviewerChain", "Each reviewer role may appear only once.");
  const rules = [...p.routingRules].sort((a, b) => a.level - b.level);
  rules.forEach((r, i) => {
    const path = `routingRules.${p.routingRules.indexOf(r)}`;
    if (r.level !== i + 1 || r.level > p.reviewerChain.length)
      add(
        `${path}.level`,
        "Levels must be contiguous from 1 and have a reviewer.",
      );
    if (
      !r.anyLineExcess &&
      r.worstExcessGteBp === null &&
      r.blendedExcessGteBp === null &&
      (r.overallExcessGteBp === null || p.overallCeilingBp === null)
    )
      add(
        path,
        "Add at least one active condition. Overall conditions need an enabled ceiling.",
      );
    if (r.anyLineExcess && r.level !== 1)
      add(
        `${path}.anyLineExcess`,
        "Any line excess is allowed only at level 1.",
      );
    for (const key of [
      "worstExcessGteBp",
      "blendedExcessGteBp",
      "overallExcessGteBp",
    ] as const) {
      if (
        r[key] !== null &&
        rules
          .slice(0, i)
          .some((prev) => prev[key] !== null && prev[key]! > r[key]!)
      )
        add(
          `${path}.${key}`,
          "Higher levels cannot have lower thresholds for the same metric.",
        );
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}
export function parsePolicy<K extends PolicyKind>(
  kind: K,
  input: unknown,
): PolicyPayload<K> {
  const parsed = POLICY_SCHEMAS[kind].safeParse(input);
  if (!parsed.success)
    throw new ValidationError("Check the policy fields.", {
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  if (kind === "DISCOUNT_RISK") {
    const validation = validateDiscountRisk(parsed.data);
    if (!validation.ok)
      throw new ValidationError("Check the routing rules.", {
        errors: validation.errors,
      });
  }
  return parsed.data as PolicyPayload<K>;
}
