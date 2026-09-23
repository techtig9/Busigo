/**
 * Required-environment access.
 *
 * The Supabase factories used to read `process.env.X!`. The non-null assertion is a lie to
 * the type checker and nothing more — at runtime the value is `undefined`, it is handed to
 * the Supabase constructor, and the failure surfaces somewhere inside the library as
 * "Invalid URL" or a fetch to the string "undefined". The one piece of information that
 * would fix it — which variable is missing — is the one thing that error does not contain.
 *
 * This reports it at the point of use, names the variable, and fails before constructing
 * anything from a value that cannot work.
 *
 * Read at call time, never at module scope: a build must still succeed with no environment
 * at all (see docs/vercel-deployment.md), so nothing here may run during the build.
 */
export function requireEnv(name: string, hint?: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}.` + (hint ? ` ${hint}` : "") + " See .env.example."
    );
  }
  return value;
}
