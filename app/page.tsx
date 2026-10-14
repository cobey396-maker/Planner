import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

/**
 * Welcome screen. In Phase 3 this becomes onboarding + sign-in for new
 * visitors, and signed-in users skip straight to /today.
 */
export default function Home() {
  return (
    <main className="pt-safe pb-safe relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="pt-safe absolute right-3 top-2">
        <ThemeToggle />
      </div>
      <div className="glass-card mb-6 grid size-20 place-items-center rounded-[24px] text-4xl">✦</div>
      <h1 className="text-large-title">{APP_NAME}</h1>
      <p className="mt-2 text-body text-secondary-label">{APP_TAGLINE}</p>
      <Link
        href="/today"
        className="mt-10 inline-flex h-[52px] items-center justify-center rounded-full bg-tint text-headline text-on-tint shadow-[inset_0_1px_0_rgb(255_255_255/0.35),var(--elev-float)] transition-transform active:scale-[0.97]"
      >
        Open my week
      </Link>
      <Link
        href="/design"
        className="glass-card mt-3 inline-flex h-[52px] items-center justify-center rounded-full text-headline"
      >
        Design system
      </Link>
      <p className="mt-4 text-center text-footnote text-tertiary-label">Preview · sample data</p>
    </main>
  );
}
