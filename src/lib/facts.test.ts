import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/openai", () => ({ generateMovieFact: vi.fn() }));

import { getDb } from "@/lib/db";
import { generateMovieFact } from "@/lib/openai";
import { getFactForUser } from "./facts";

describe("movie fact cache", () => {
  const findFirst = vi.fn();
  const create = vi.fn();
  const now = new Date("2026-01-01T12:00:00Z");
  const saved = { id: "fact-a", movie: "Arrival", text: "A movie fact.", createdAt: now };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    vi.mocked(getDb).mockReturnValue({ fact: { create, findFirst } } as unknown as ReturnType<typeof getDb>);
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue(saved);
    vi.mocked(generateMovieFact).mockResolvedValue(saved.text);
  });
  afterEach(() => vi.useRealTimers());

  it("saves a generated fact with its owner and movie", async () => {
    const result = await getFactForUser("user-a", "Arrival");
    expect(create).toHaveBeenCalledWith({ data: { userId: "user-a", movie: "Arrival", text: saved.text } });
    expect(result.fact.createdAt).toBe(now.toISOString());
    expect(result.source).toBe("generated");
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "user-a", movie: "Arrival" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });

  it.each([0, 59_999])("reuses a fact that is %i milliseconds old", async (age) => {
    findFirst.mockResolvedValue({ ...saved, createdAt: new Date(now.getTime() - age) });
    expect((await getFactForUser("user-a", "Arrival")).source).toBe("cached");
    expect(generateMovieFact).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([60_000, 60_001])("replaces a fact that is %i milliseconds old", async (age) => {
    findFirst.mockResolvedValue({ ...saved, createdAt: new Date(now.getTime() - age) });
    expect((await getFactForUser("user-a", "Arrival")).source).toBe("generated");
    expect(generateMovieFact).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
  });

  it("does not treat a future timestamp as a fresh fact", async () => {
    findFirst.mockResolvedValue({ ...saved, createdAt: new Date(now.getTime() + 1_000) });
    expect((await getFactForUser("user-a", "Arrival")).source).toBe("generated");
  });

  it("shares both the lookup and generation during simultaneous requests", async () => {
    const gate = Promise.withResolvers<string>();
    const started = Promise.withResolvers<void>();
    vi.mocked(generateMovieFact).mockImplementation(() => { started.resolve(); return gate.promise; });
    const first = getFactForUser("user-a", "Arrival");
    const second = getFactForUser("user-a", "Arrival");
    expect(first).toBe(second);
    await started.promise;
    expect(findFirst).toHaveBeenCalledOnce();
    expect(generateMovieFact).toHaveBeenCalledOnce();
    gate.resolve(saved.text);
    const results = await Promise.all([first, second]);
    expect(results[0]).toEqual(results[1]);
    expect(create).toHaveBeenCalledOnce();
  });

  it("keeps different users' in-progress requests separate", async () => {
    await Promise.all([getFactForUser("user-a", "Arrival"), getFactForUser("user-b", "Arrival")]);
    expect(generateMovieFact).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({ data: { userId: "user-b", movie: "Arrival", text: saved.text } });
  });

  it("keeps different movies separate for the same user", async () => {
    await Promise.all([getFactForUser("user-a", "Arrival"), getFactForUser("user-a", "Alien")]);
    expect(generateMovieFact).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-a", movie: "Alien" } }));
  });

  it("does not return another user's cached fact for the same movie", async () => {
    findFirst.mockImplementation(({ where }) => where.userId === "user-a" ? Promise.resolve(saved) : Promise.resolve(null));
    const a = await getFactForUser("user-a", "Arrival");
    const b = await getFactForUser("user-b", "Arrival");
    expect(a.source).toBe("cached");
    expect(b.source).toBe("generated");
    expect(create).toHaveBeenCalledWith({ data: { userId: "user-b", movie: "Arrival", text: saved.text } });
  });

  it("returns an old fact without changing its age when the provider fails", async () => {
    const old = { ...saved, createdAt: new Date(now.getTime() - 90_000) };
    findFirst.mockResolvedValue(old);
    vi.mocked(generateMovieFact).mockRejectedValue(new Error("timeout"));
    const result = await getFactForUser("user-a", "Arrival");
    expect(result.source).toBe("stale");
    expect(result.fact.createdAt).toBe(old.createdAt.toISOString());
    expect(create).not.toHaveBeenCalled();
  });

  it("clears a failed request so a later request can succeed", async () => {
    vi.mocked(generateMovieFact).mockRejectedValueOnce(new Error("timeout"));
    await expect(getFactForUser("user-a", "Arrival")).rejects.toThrow("timeout");
    expect((await getFactForUser("user-a", "Arrival")).source).toBe("generated");
    expect(generateMovieFact).toHaveBeenCalledTimes(2);
  });

  it("does not return unsaved text after a database failure", async () => {
    create.mockRejectedValue(new Error("database unavailable"));
    await expect(getFactForUser("user-a", "Arrival")).rejects.toThrow("database unavailable");
  });

  it("falls back to the last saved fact if saving a new one fails", async () => {
    findFirst.mockResolvedValue({ ...saved, createdAt: new Date(now.getTime() - 90_000) });
    create.mockRejectedValue(new Error("database unavailable"));
    expect((await getFactForUser("user-a", "Arrival")).source).toBe("stale");
  });

  it("rechecks storage after completed work, then generates again after expiry", async () => {
    await getFactForUser("user-a", "Arrival");
    findFirst.mockResolvedValue(saved);
    expect((await getFactForUser("user-a", "Arrival")).source).toBe("cached");
    vi.setSystemTime(new Date(now.getTime() + 60_000));
    expect((await getFactForUser("user-a", "Arrival")).source).toBe("generated");
    expect(generateMovieFact).toHaveBeenCalledTimes(2);
  });
});
