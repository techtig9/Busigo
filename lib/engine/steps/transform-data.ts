import type { StepHandler } from "../types";
import { resolveString } from "../merge-fields";

// Deliberately a small fixed set of operations — not an arbitrary code/script step, to avoid
// needing a real code-execution sandbox in one day (see Phase 2: "Explicitly Deferred").

function getPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export const transformDataStep: StepHandler = async ({ step, ctx }) => {
  const config = step.config as { operation: string; path?: string; text?: string };

  try {
    switch (config.operation) {
      case "extract_field": {
        const value = getPath(ctx.data, config.path || "");
        return { status: "success", output: value ?? null };
      }
      case "json_parse": {
        const raw = resolveString(config.text || "", ctx.data);
        return { status: "success", output: JSON.parse(raw) };
      }
      case "json_stringify": {
        const value = getPath(ctx.data, config.path || "");
        return { status: "success", output: JSON.stringify(value) };
      }
      case "uppercase":
        return { status: "success", output: resolveString(config.text || "", ctx.data).toUpperCase() };
      case "lowercase":
        return { status: "success", output: resolveString(config.text || "", ctx.data).toLowerCase() };
      case "trim":
        return { status: "success", output: resolveString(config.text || "", ctx.data).trim() };
      default:
        return { status: "failed", output: null, error: `Unknown transform operation: "${config.operation}"` };
    }
  } catch (e: any) {
    return { status: "failed", output: null, error: e.message };
  }
};
