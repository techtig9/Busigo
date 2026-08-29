// Resolves {{stepKey.field}} / {{trigger.field}} references against real run data.
// Supports dotted paths into nested objects, e.g. {{trigger.customer.email}}.

function getPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

const MERGE_FIELD_RE = /\{\{\s*([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\s*\}\}/g;

/** Resolve merge fields inside a single string. Non-string values are JSON-stringified. */
export function resolveString(template: string, data: Record<string, any>): string {
  return template.replace(MERGE_FIELD_RE, (_match, path: string) => {
    const value = getPath(data, path);
    if (value === undefined) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  });
}

/** Deeply resolve merge fields inside a step's config object (strings only; other types pass through). */
export function resolveConfig<T extends Record<string, any>>(config: T, data: Record<string, any>): T {
  const resolveValue = (value: any): any => {
    if (typeof value === "string") return resolveString(value, data);
    if (Array.isArray(value)) return value.map(resolveValue);
    if (value && typeof value === "object") {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) out[k] = resolveValue(v);
      return out;
    }
    return value;
  };
  return resolveValue(config);
}

/** List every {{...}} reference in a template string — used by the merge-field picker UI. */
export function extractReferences(template: string): string[] {
  const refs = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MERGE_FIELD_RE);
  while ((m = re.exec(template))) refs.add(m[1]);
  return Array.from(refs);
}
