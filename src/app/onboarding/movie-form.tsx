"use client";

import { useActionState } from "react";
import { MOVIE_MAX_LENGTH } from "@/lib/movie";
import { saveMovie } from "./actions";

export function MovieForm() {
  const [state, action, pending] = useActionState(saveMovie, { error: null });

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="movie" className="block text-sm font-semibold">Favorite movie</label>
        <input
          id="movie"
          name="movie"
          required
          minLength={1}
          maxLength={MOVIE_MAX_LENGTH}
          placeholder="For example, Interstellar"
          aria-describedby={state.error ? "movie-hint movie-error" : "movie-hint"}
          aria-invalid={Boolean(state.error)}
          readOnly={pending}
          className="mt-2 w-full rounded-lg border border-stone-400 bg-white px-4 py-3 text-base focus:border-amber-900 focus:outline-2 focus:outline-amber-900"
        />
        <p id="movie-hint" className="mt-2 text-sm text-stone-600">Enter a title up to {MOVIE_MAX_LENGTH} characters long.</p>
      </div>
      {state.error && <p id="movie-error" role="alert" className="text-sm text-red-800">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-stone-800 px-6 py-3.5 text-sm font-semibold text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-900 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save my movie"}
      </button>
    </form>
  );
}
