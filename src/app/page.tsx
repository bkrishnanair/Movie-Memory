export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col px-6 sm:px-10">
      <header className="flex items-center gap-3 border-b border-stone-300 py-7">
        <span aria-hidden="true" className="rounded-md bg-stone-800 px-2 py-1 text-xs font-bold tracking-widest text-amber-100">
          MM
        </span>
        <span className="text-sm font-semibold tracking-tight">Movie Memory</span>
      </header>

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
        <button
          type="button"
          disabled
          aria-describedby="signin-status"
          className="mt-10 rounded-lg border border-stone-400 bg-white px-6 py-3.5 text-sm font-semibold text-stone-600 disabled:cursor-not-allowed"
        >
          Sign in with Google
        </button>
        <p id="signin-status" className="mt-3 text-sm text-stone-500">
          Sign-in will be available soon.
        </p>
      </main>

      <footer className="border-t border-stone-300 py-6 text-xs text-stone-600">
        One favorite. A fresh perspective.
      </footer>
    </div>
  );
}
