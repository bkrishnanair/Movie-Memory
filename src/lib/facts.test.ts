import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/openai", () => ({ generateMovieFact: vi.fn() }));

import { getDb } from "@/lib/db";
import { generateMovieFact } from "@/lib/openai";
import { getFactForUser } from "./facts";

describe("saved movie facts", () => {
  const create = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getDb).mockReturnValue({ fact: { create } } as unknown as ReturnType<typeof getDb>);
  });

  it("saves generated text with its owner and movie", async () => {
    vi.mocked(generateMovieFact).mockResolvedValue("A movie fact.");
    create.mockResolvedValue({ id: "fact-a", movie: "Arrival", text: "A movie fact.", createdAt: new Date("2026-01-01T12:00:00Z") });
    const result = await getFactForUser("user-a", "Arrival");
    expect(create).toHaveBeenCalledWith({ data: { userId: "user-a", movie: "Arrival", text: "A movie fact." } });
    expect(result.fact.createdAt).toBe("2026-01-01T12:00:00.000Z");
    expect(result.source).toBe("generated");
  });

  it("does not return an unsaved fact after a database failure", async () => {
    vi.mocked(generateMovieFact).mockResolvedValue("A movie fact.");
    create.mockRejectedValue(new Error("database unavailable"));
    await expect(getFactForUser("user-a", "Arrival")).rejects.toThrow("database unavailable");
  });
});
