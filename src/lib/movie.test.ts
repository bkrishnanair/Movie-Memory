import { describe, expect, it } from "vitest";
import { validateMovie } from "./movie";

describe("movie title validation", () => {
  it("trims surrounding whitespace before saving", () => {
    expect(validateMovie("  Interstellar \n")).toEqual({
      success: true,
      movie: "Interstellar",
    });
  });

  it.each([undefined, null, 42, {}, ["Interstellar"], "", " \n\t "])(
    "rejects invalid input: %j",
    (input) => {
      expect(validateMovie(input)).toEqual({
        success: false,
        error: "Enter a movie title.",
      });
    },
  );

  it.each(["M", "Amélie", "千と千尋の神隠し", "Spider-Man: Into the Spider-Verse"])(
    "preserves valid titles: %s",
    (movie) => {
      expect(validateMovie(movie)).toEqual({ success: true, movie });
    },
  );

  it("accepts exactly 120 characters after trimming", () => {
    const movie = "a".repeat(120);
    expect(validateMovie(` ${movie} `)).toEqual({ success: true, movie });
  });

  it("rejects 121 characters", () => {
    expect(validateMovie("a".repeat(121))).toEqual({
      success: false,
      error: "Keep the movie title to 120 characters or fewer.",
    });
  });
});
