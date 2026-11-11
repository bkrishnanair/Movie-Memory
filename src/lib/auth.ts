import "server-only";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.NEXTAUTH_SECRET &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function getAuthOptions(): NextAuthOptions {
  if (!isAuthConfigured()) {
    throw new Error("Authentication is not configured.");
  }

  return {
    adapter: PrismaAdapter(getDb()),
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "database" },
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    pages: { signIn: "/", error: "/" },
    callbacks: {
      async session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
    logger: {
      error(code) {
        console.error("Authentication error:", code);
      },
    },
  };
}

export async function getCurrentUser() {
  if (!isAuthConfigured()) return null;

  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) return null;

  // Read current data rather than keeping the onboarding state in a cookie.
  return getDb().user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, favoriteMovie: true },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}
