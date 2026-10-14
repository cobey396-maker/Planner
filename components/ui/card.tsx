import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A rounded liquid-glass surface: translucent, blurred, with a lit rim. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card rounded-card p-4", className)} {...props} />;
}

/** A small uppercase heading above a group of content. */
export function SectionHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-title3">{children}</h2>
      {action}
    </div>
  );
}

/**
 * iOS "inset grouped" list: rows inside one rounded glass card, separated by
 * hairlines, like the Settings app.
 */
export function ListGroup({
  header,
  footer,
  className,
  children,
}: {
  header?: string;
  footer?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      {header && (
        <h3 className="mb-1.5 px-4 text-footnote font-medium uppercase tracking-wide text-secondary-label">
          {header}
        </h3>
      )}
      <div className="glass-card overflow-hidden rounded-card [&>*+*]:border-t [&>*+*]:border-separator">
        {children}
      </div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-secondary-label">{footer}</p>}
    </section>
  );
}

/**
 * One row in a ListGroup. Give it `href` to make it a link (adds a chevron);
 * otherwise put any control (a Switch, a value) in `trailing`.
 */
export function ListRow({
  icon,
  title,
  detail,
  trailing,
  href,
  className,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string;
  trailing?: ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-body">{title}</div>
        {detail && <div className="truncate text-subhead text-secondary-label">{detail}</div>}
      </div>
      {trailing}
      {href && <ChevronRight aria-hidden size={18} className="text-tertiary-label" />}
    </>
  );
  const classes = cn("flex min-h-12 items-center gap-3 px-4 py-2.5", className);
  if (href) {
    return (
      <Link href={href} className={cn(classes, "transition-colors active:bg-fill")}>
        {content}
      </Link>
    );
  }
  return <div className={classes}>{content}</div>;
}

/** Rounded square icon in a solid color, like iOS Settings row icons. */
export function RowIcon({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-[9px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}
