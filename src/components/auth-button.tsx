"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";

export function AuthButton({
  action,
  disabled = false,
}: {
  action: "signin" | "signout";
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = action === "signin" ? "Sign in with Google" : "Log out";

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      if (action === "signin") {
        await signIn("google", { callbackUrl: "/dashboard" });
      } else {
        await signOut({ callbackUrl: "/" });
      }
    } catch {
      setError("That didn't work. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={handleClick}
        className="rounded-lg border border-stone-400 bg-white px-6 py-3.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Please wait..." : label}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}
