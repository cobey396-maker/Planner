import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/auth/routing";

/** "Explore with sample data": remember the choice, then open the app. */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/today", request.nextUrl.origin));
  response.cookies.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
