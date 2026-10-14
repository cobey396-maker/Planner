import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** iOS-style "‹ Back" link for the nav bar's leading slot. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 flex h-11 items-center gap-0.5 pr-2 text-body text-tint">
      <ChevronLeft aria-hidden size={26} strokeWidth={2.2} />
      {label}
    </Link>
  );
}
