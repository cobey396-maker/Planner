"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { BackLink } from "@/components/ui/back-link";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, stagger } from "@/lib/design/motion";

/** Shared frame for the design sub-screens: back to the hub, theme toggle. */
export function DesignPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const entrance = useEntrance();
  return (
    <LargeTitlePage
      title={title}
      subtitle={subtitle}
      leading={<BackLink href="/design" label="Design" />}
      trailing={<ThemeToggle />}
    >
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-8">
        {children}
      </motion.div>
    </LargeTitlePage>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <motion.section variants={fadeUp}>
      <h2 className="text-title3">{title}</h2>
      {note ? <p className="mb-3 mt-0.5 text-subhead text-secondary-label">{note}</p> : <div className="mb-3" />}
      {children}
    </motion.section>
  );
}
