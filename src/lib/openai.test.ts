import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create, constructor } = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class {
    responses = { create };
    constructor(options: unknown) { constructor(options); }
  },
}));
import { generateMovieFact } from "./openai";

describe("movie fact provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends only the title with bounded time and output, then trims the result", async () => {
    create.mockResolvedValue({ status: "completed", output_text: " A movie fact. " });
    expect(await generateMovieFact("Interstellar")).toBe("A movie fact.");
    expect(constructor).toHaveBeenCalledWith({ apiKey: "test-key", timeout: 10_000, maxRetries: 0 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      input: JSON.stringify({ movie: "Interstellar" }),
      model: "gpt-4.1-mini", max_output_tokens: 200, store: false,
    }));
  });

  it.each([
    { status: "completed", output_text: " " },
    { status: "completed", output_text: "UNKNOWN_MOVIE" },
    { status: "incomplete", output_text: "An unfinished fact" },
    { status: "completed", output_text: "a".repeat(1201) },
  ])("rejects unusable provider output", async (response) => {
    create.mockResolvedValue(response);
    await expect(generateMovieFact("Interstellar")).rejects.toThrow("No complete movie fact");
  });

  it("does not call the provider without a key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(generateMovieFact("Interstellar")).rejects.toThrow("not configured");
    expect(create).not.toHaveBeenCalled();
  });

  it("propagates a timeout for the service to handle", async () => {
    create.mockRejectedValue(new Error("timeout"));
    await expect(generateMovieFact("Interstellar")).rejects.toThrow("timeout");
  });
});
