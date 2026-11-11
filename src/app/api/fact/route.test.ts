import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/facts", () => ({ getFactForUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth";
import { getFactForUser } from "@/lib/facts";
import { POST } from "./route";

describe("fact request authorization", () => {
  const user = { id: "user-a", name: null, email: "a@example.test", image: null, favoriteMovie: "Arrival" };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
  });

  it("rejects signed-out requests before looking up facts", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/fact", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(getFactForUser).not.toHaveBeenCalled();
  });

  it("ignores user and movie supplied in the URL or request body", async () => {
    vi.mocked(getFactForUser).mockResolvedValue({ fact: { id: "a", movie: "Arrival", text: "Fact", createdAt: "2026-01-01" }, source: "generated" });
    const response = await POST(new Request("http://localhost/api/fact?userId=user-b&movie=Alien", {
      method: "POST", body: JSON.stringify({ userId: "user-b", movie: "Alien" }),
    }));
    expect(response.status).toBe(200);
    expect(getFactForUser).toHaveBeenCalledExactlyOnceWith("user-a", "Arrival");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("requires onboarding before generation", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, favoriteMovie: null });
    const response = await POST(new Request("http://localhost/api/fact", { method: "POST" }));
    expect(response.status).toBe(409);
    expect(getFactForUser).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin POST", async () => {
    const response = await POST(new Request("http://localhost/api/fact", {
      method: "POST", headers: { origin: "https://another-site.example" },
    }));
    expect(response.status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("does not expose provider details in an error response", async () => {
    vi.mocked(getFactForUser).mockRejectedValue(new Error("private provider details"));
    const response = await POST(new Request("http://localhost/api/fact", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "We couldn't load a movie fact. Please try again." });
  });
});
