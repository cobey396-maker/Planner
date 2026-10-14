"use client";

import { Card } from "@/components/ui/card";
import { TASK_COLOR_NAMES, TASK_COLORS } from "@/lib/design/tokens";
import { DesignPage, Section } from "./design-page";

const SEMANTIC = [
  ["bg", "Page"],
  ["surface", "Surface"],
  ["fill", "Fill"],
  ["label", "Label"],
  ["secondary-label", "Secondary"],
  ["tertiary-label", "Tertiary"],
  ["tint", "Tint"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["danger", "Danger"],
] as const;

export function DesignColors() {
  return (
    <DesignPage title="Colors & glass" subtitle="Named by job, so dark mode is automatic.">
      <Section title="Semantic colors" note="Components only use these names, never raw hex values.">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {SEMANTIC.map(([token, name]) => (
            <div key={token} className="flex flex-col gap-1.5">
              <div className="h-12 rounded-xl border border-separator" style={{ background: `var(--${token})` }} />
              <span className="text-caption text-secondary-label">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Task colors" note="Users color-code tasks. Each has a light and a dark shade, and text on every one passes WCAG AA.">
        <div className="grid grid-cols-3 gap-3">
          {TASK_COLOR_NAMES.map((c) => (
            <div
              key={c}
              className="task-block rounded-block px-4 py-2.5 text-subhead font-medium"
              style={{ "--block": `var(--task-${c})` } as React.CSSProperties}
            >
              {TASK_COLORS[c].label}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Liquid glass" note="Translucent, blurred, with a lit top rim. The drifting color behind it shows through.">
        <div className="grid grid-cols-2 gap-3">
          <Card className="grid h-28 place-items-center text-subhead font-medium">Glass card</Card>
          <div className="glass-pill grid h-28 place-items-center rounded-full text-subhead font-medium">
            Glass pill
          </div>
        </div>
      </Section>

      <Section title="Radius">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["rounded-button", "Button 14"],
            ["rounded-block", "Block 16"],
            ["rounded-card", "Card 20"],
            ["rounded-sheet", "Sheet 24"],
          ].map(([r, label]) => (
            <div key={r} className={`${r} glass-card grid h-20 place-items-center text-footnote`}>
              {label}
            </div>
          ))}
        </div>
      </Section>
    </DesignPage>
  );
}
