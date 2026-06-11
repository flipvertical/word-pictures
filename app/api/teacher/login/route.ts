import { NextRequest, NextResponse } from "next/server";
import { passwordMatches, sessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const attempt = String(form.get("password") ?? "");
  if (!passwordMatches(attempt)) {
    return NextResponse.redirect(new URL("/teacher/login?error=1", req.url));
  }
  const res = NextResponse.redirect(new URL("/teacher", req.url));
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
