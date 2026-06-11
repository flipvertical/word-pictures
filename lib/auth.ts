import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "wp_session";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "icarus";
}

export function sessionToken(): string {
  return createHmac("sha256", "word-pictures-session-v1")
    .update(adminPassword())
    .digest("hex");
}

export function passwordMatches(attempt: string): boolean {
  return attempt === adminPassword();
}

export async function isTeacher(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value === sessionToken();
}
