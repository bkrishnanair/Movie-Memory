import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ProfilePhoto } from "@/components/profile-photo";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  if (!user.favoriteMovie) redirect("/onboarding");
  const name = user.name?.trim() || "Movie fan";

  return (
    <div className="mx-auto min-h-svh max-w-5xl px-6 sm:px-10">
      <AppHeader signedIn />
      <main className="py-12 sm:py-20">
        <div className="flex items-center gap-4">
          <ProfilePhoto image={user.image} name={name} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">Welcome, {name}</h1>
            <p className="mt-1 break-words text-sm text-stone-600">{user.email || "Email unavailable"}</p>
          </div>
        </div>
        <section aria-labelledby="movie-heading" className="mt-10 rounded-2xl border border-stone-300 bg-white p-6 sm:p-10">
          <h2 id="movie-heading" className="text-xs font-semibold tracking-[0.2em] text-stone-600 uppercase">Your favorite movie</h2>
          <p className="mt-4 break-words font-serif text-4xl leading-tight sm:text-5xl">{user.favoriteMovie}</p>
          <p className="mt-6 text-sm text-stone-600">Saved for your next visit.</p>
        </section>
      </main>
    </div>
  );
}
