import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

import { getServerSession } from "next-auth";
import { getDb } from "@/lib/db";
import { getCurrentUser, requireUser } from "./auth";

describe("server-side user lookup", () => {
  const findUnique = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    for (const key of ["DATABASE_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      vi.stubEnv(key, "test-only");
    }
    vi.mocked(getDb).mockReturnValue({ user: { findUnique } } as unknown as ReturnType<typeof getDb>);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("treats an unconfigured app as signed out without querying data", async () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(await getCurrentUser()).toBeNull();
    expect(getServerSession).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("does not query a user for an absent session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("reads only the user identified by the session", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-a" } });
    const user = { id: "user-a", favoriteMovie: "Interstellar" };
    findUnique.mockResolvedValue(user);
    expect(await getCurrentUser()).toEqual(user);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "user-a" },
      select: { id: true, name: true, email: true, image: true, favoriteMovie: true },
    });
  });

  it("redirects to sign-in when the session is absent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("redirect:/");
  });

  it("redirects if the session's user no longer exists", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "deleted-user" } });
    findUnique.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("redirect:/");
  });
});
