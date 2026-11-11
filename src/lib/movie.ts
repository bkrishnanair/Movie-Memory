export const MOVIE_MAX_LENGTH = 120;

type MovieValidation =
  | { success: true; movie: string }
  | { success: false; error: string };

export function validateMovie(input: unknown): MovieValidation {
  if (typeof input !== "string") {
    return { success: false, error: "Enter a movie title." };
  }

  const movie = input.trim();
  if (movie.length === 0) {
    return { success: false, error: "Enter a movie title." };
  }
  if (movie.length > MOVIE_MAX_LENGTH) {
    return {
      success: false,
      error: `Keep the movie title to ${MOVIE_MAX_LENGTH} characters or fewer.`,
    };
  }

  return { success: true, movie };
}
