import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(), getCurrentUser: vi.fn(), isAuthConfigured: () => true,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));
vi.mock("./onboarding/movie-form", () => ({ MovieForm: () => null }));

import { getCurrentUser, requireUser } from "@/lib/auth";
import Home from "./page";
import Dashboard from "./dashboard/page";
import Onboarding from "./onboarding/page";

describe("onboarding routing", () => {
  const user = { id: "user-a", name: null, email: "a@example.test", image: null, favoriteMovie: null };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(user);
    vi.mocked(getCurrentUser).mockResolvedValue(user);
  });

  it("sends a signed-in user with no movie from the landing page to onboarding", async () => {
    await expect(Home({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/onboarding");
  });

  it("sends a returning user from the landing page to the dashboard", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, favoriteMovie: "Arrival" });
    await expect(Home({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/dashboard");
  });

  it("resumes incomplete onboarding when visiting the dashboard directly", async () => {
    await expect(Dashboard()).rejects.toThrow("redirect:/onboarding");
  });

  it("keeps a returning user out of onboarding", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...user, favoriteMovie: "Arrival" });
    await expect(Onboarding()).rejects.toThrow("redirect:/dashboard");
  });

  it("renders a saved movie with fallbacks for a missing name and photo", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...user, favoriteMovie: "Arrival" });
    const html = renderToStaticMarkup(await Dashboard());
    expect(html).toContain("Movie fan");
    expect(html).toContain("Arrival");
    expect(html).toContain("a@example.test");
    expect(html).not.toContain("<img");
  });
});
