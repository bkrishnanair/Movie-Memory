"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="font-serif text-4xl">Something went wrong.</h1>
      <p className="mt-4 text-stone-600">We couldn&apos;t load this page. Please try again in a moment.</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-stone-800 px-5 py-3 text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-900">Try again</button>
    </main>
  );
}
