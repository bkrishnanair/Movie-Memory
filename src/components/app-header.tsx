import Link from "next/link";
import { AuthButton } from "@/components/auth-button";

export function AppHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-stone-300 py-7">
      <Link href="/" className="flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-900">
        <span aria-hidden="true" className="rounded-md bg-stone-800 px-2 py-1 text-xs font-bold tracking-widest text-amber-100">MM</span>
        <span className="text-sm font-semibold tracking-tight">Movie Memory</span>
      </Link>
      {signedIn && <AuthButton action="signout" />}
    </header>
  );
}
