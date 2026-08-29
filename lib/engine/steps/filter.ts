import type { StepHandler } from "../types";
import { resolveString } from "../merge-fields";

type Operator = "equals" | "contains" | "greater_than" | "less_than" | "exists";

function getPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function evaluate(fieldValue: any, operator: Operator, compareValue: string): boolean {
  switch (operator) {
    case "exists":
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== "";
    case "equals":
      return String(fieldValue) === compareValue;
    case "contains":
      return typeof fieldValue === "string" && fieldValue.includes(compareValue);
    case "greater_than":
      return Number(fieldValue) > Number(compareValue);
    case "less_than":
      return Number(fieldValue) < Number(compareValue);
    default:
      return false;
  }
}

// A Filter step stopping a run early is a deliberate outcome, not an error — it must be
// recorded as stopped_by_filter, distinct from failed, so analytics don't conflate
// "this ran as designed" with "this broke".
export const filterStep: StepHandler = async ({ step, ctx }) => {
  const { field, operator, value } = step.config as { field: string; operator: Operator; value: string };
  const fieldValue = getPath(ctx.data, field);
  const compareValue = typeof value === "string" ? resolveString(value, ctx.data) : value;

  const passed = evaluate(fieldValue, operator, compareValue);

  return {
    status: passed ? "success" : "stopped_by_filter",
    output: { field, operator, compared_against: compareValue, actual_value: fieldValue, passed },
  };
};
