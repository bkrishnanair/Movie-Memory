import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create, chatCreate, constructor } = vi.hoisted(() => ({
  create: vi.fn(), chatCreate: vi.fn(), constructor: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class {
    responses = { create };
    chat = { completions: { create: chatCreate } };
    constructor(options: unknown) { constructor(options); }
  },
}));
import { generateMovieFact } from "./movie-fact-provider";

describe("movie fact provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("FACT_PROVIDER", "openai");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.1-flash-lite");
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


  it("defaults to OpenAI when no provider is selected", async () => {
    vi.stubEnv("FACT_PROVIDER", "");
    create.mockResolvedValue({ status: "completed", output_text: "A fact." });
    await generateMovieFact("Interstellar");
    expect(create).toHaveBeenCalledOnce();
    expect(chatCreate).not.toHaveBeenCalled();
  });

  it("uses only the Gemini key and endpoint when selected", async () => {
    vi.stubEnv("FACT_PROVIDER", "gemini");
    vi.stubEnv("OPENAI_BASE_URL", "https://example.invalid/v1");
    chatCreate.mockResolvedValue({ choices: [{ finish_reason: "stop", message: { content: " A Gemini fact. " } }] });
    expect(await generateMovieFact("Interstellar")).toBe("A Gemini fact.");
    expect(constructor).toHaveBeenCalledWith({
      apiKey: "gemini-test-key", timeout: 10_000, maxRetries: 0,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
    expect(chatCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-3.1-flash-lite", max_tokens: 200, reasoning_effort: "minimal",
      messages: [expect.objectContaining({ role: "system" }), { role: "user", content: JSON.stringify({ movie: "Interstellar" }) }],
    }));
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { choices: [] },
    { choices: [{ finish_reason: "length", message: { content: "Cut off" } }] },
    { choices: [{ finish_reason: "stop", message: { content: null } }] },
    { choices: [{ finish_reason: "stop", message: { content: "UNKNOWN_MOVIE" } }] },
    { choices: [{ finish_reason: "stop", message: { content: "x".repeat(1201) } }] },
  ])("rejects unusable Gemini output", async (response) => {
    vi.stubEnv("FACT_PROVIDER", "gemini");
    chatCreate.mockResolvedValue(response);
    await expect(generateMovieFact("Interstellar")).rejects.toThrow("No complete movie fact");
  });

  it("does not fall back to paid OpenAI when Gemini fails", async () => {
    vi.stubEnv("FACT_PROVIDER", "gemini");
    chatCreate.mockRejectedValue(new Error("quota"));
    await expect(generateMovieFact("Interstellar")).rejects.toThrow("quota");
    expect(create).not.toHaveBeenCalled();
  });

  it("requires the selected provider's key", async () => {
    vi.stubEnv("FACT_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(generateMovieFact("Interstellar")).rejects.toThrow("not configured");
    expect(constructor).not.toHaveBeenCalled();
  });

  it("rejects an unknown provider without making a request", async () => {
    vi.stubEnv("FACT_PROVIDER", "other");
    await expect(generateMovieFact("Interstellar")).rejects.toThrow("Unknown fact provider");
    expect(constructor).not.toHaveBeenCalled();
  });
});
