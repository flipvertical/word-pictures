import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "wp_session";

function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  // The "icarus" fallback is for local dev only — in production an unset
  // ADMIN_PASSWORD must mean nobody can sign in, not a guessable default.
  return process.env.NODE_ENV === "production" ? null : "icarus";
}

export function sessionToken(): string {
  const pw = adminPassword();
  if (!pw) return "locked";
  return createHmac("sha256", "word-pictures-session-v1").update(pw).digest("hex");
}

export function passwordMatches(attempt: string): boolean {
  const pw = adminPassword();
  return pw !== null && attempt === pw;
}

export async function isTeacher(): Promise<boolean> {
  const pw = adminPassword();
  if (!pw) return false;
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value === sessionToken();
}
