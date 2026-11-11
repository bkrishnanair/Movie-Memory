"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { validateMovie } from "@/lib/movie";

export type MovieFormState = { error: string | null };

export async function saveMovie(
  _previous: MovieFormState,
  formData: FormData,
): Promise<MovieFormState> {
  const user = await requireUser();
  if (user.favoriteMovie) redirect("/dashboard");

  const result = validateMovie(formData.get("movie"));
  if (!result.success) return { error: result.error };

  try {
    // The condition also prevents two onboarding tabs from overwriting each other.
    await getDb().user.updateMany({
      where: { id: user.id, favoriteMovie: null },
      data: { favoriteMovie: result.movie },
    });
  } catch {
    return { error: "We couldn't save your movie. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
