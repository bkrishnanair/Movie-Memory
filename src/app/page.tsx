import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AuthButton } from "@/components/auth-button";
import { getCurrentUser, isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.favoriteMovie ? "/dashboard" : "/onboarding");

  const configured = isAuthConfigured();
  const { error } = await searchParams;
  const signInError = error === "OAuthAccountNotLinked"
    ? "Please sign in with the Google account you originally used."
    : "We couldn't sign you in. Please try again.";

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col px-6 sm:px-10">
      <AppHeader />

      <main className="flex flex-1 flex-col items-start justify-center py-20 sm:py-28">
        <p className="mb-6 text-xs font-semibold tracking-[0.2em] text-stone-600 uppercase">
          For the films that stay with you
        </p>
        <h1 className="max-w-3xl font-serif text-5xl leading-[1.08] tracking-tight sm:text-7xl">
          Your favorite movie.<br />
          <span className="text-amber-900">A little more to love.</span>
        </h1>
        <p className="mt-7 max-w-md text-lg leading-relaxed text-stone-600">
          Save the film you always come back to and discover a fun fact about it.
        </p>
        <div className="mt-10">
          <AuthButton action="signin" disabled={!configured} />
        </div>
        {!configured && <p className="mt-3 text-sm text-stone-600">Sign-in is temporarily unavailable. Please try again later.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-800">{signInError}</p>}
      </main>

      <footer className="border-t border-stone-300 py-6 text-xs text-stone-600">
        One favorite. A fresh perspective.
      </footer>
    </div>
  );
}
