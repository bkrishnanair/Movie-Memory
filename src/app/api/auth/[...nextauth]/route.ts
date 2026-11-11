import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthOptions, isAuthConfigured } from "@/lib/auth";

export const runtime = "nodejs";

async function handler(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  if (!isAuthConfigured()) {
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Please try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextAuth(getAuthOptions())(request, context);
}

export { handler as GET, handler as POST };
