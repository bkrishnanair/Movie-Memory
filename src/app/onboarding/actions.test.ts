import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { saveMovie } from "./actions";

describe("save favorite movie", () => {
  const updateMany = vi.fn();
  const user = { id: "user-a", name: null, email: "a@example.test", image: null, favoriteMovie: null };

  function form(movie: string) {
    const data = new FormData();
    data.set("movie", movie);
    return data;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(user);
    vi.mocked(getDb).mockReturnValue({ user: { updateMany } } as unknown as ReturnType<typeof getDb>);
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("requires a session before attempting a write", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("redirect:/"));
    await expect(saveMovie({ error: null }, form("Interstellar"))).rejects.toThrow("redirect:/");
    expect(getDb).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([" \t\n ", "a".repeat(121)])("rejects invalid input on the server", async (movie) => {
    const result = await saveMovie({ error: null }, form(movie));
    expect(result.error).toBeTruthy();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("ignores a submitted owner ID and saves the trimmed title to the session user", async () => {
    const data = form("  Interstellar  ");
    data.set("userId", "user-b");
    await expect(saveMovie({ error: null }, data)).rejects.toThrow("redirect:/dashboard");
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: "user-a", favoriteMovie: null },
      data: { favoriteMovie: "Interstellar" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("does not turn onboarding into a movie-edit endpoint", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...user, favoriteMovie: "Arrival" });
    await expect(saveMovie({ error: null }, form("Interstellar"))).rejects.toThrow("redirect:/dashboard");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("returns to the dashboard if another tab already saved a movie", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(saveMovie({ error: null }, form("Interstellar"))).rejects.toThrow("redirect:/dashboard");
    expect(updateMany).toHaveBeenCalledOnce();
  });

  it("returns a friendly error if persistence fails", async () => {
    updateMany.mockRejectedValue(new Error("internal database connection detail"));
    expect(await saveMovie({ error: null }, form("Interstellar"))).toEqual({
      error: "We couldn't save your movie. Please try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
