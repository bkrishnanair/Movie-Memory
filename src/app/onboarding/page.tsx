import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth";
import { MovieForm } from "./movie-form";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const user = await requireUser();
  if (user.favoriteMovie) redirect("/dashboard");

  return (
    <div className="mx-auto min-h-svh max-w-5xl px-6 sm:px-10">
      <AppHeader signedIn />
      <main className="mx-auto max-w-lg py-16 sm:py-24">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-600 uppercase">Make yourself at home</p>
        <h1 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">What&apos;s your favorite movie?</h1>
        <p className="mt-5 leading-relaxed text-stone-600">The one you keep coming back to. We&apos;ll remember it for your next visit.</p>
        <MovieForm />
      </main>
    </div>
  );
}
