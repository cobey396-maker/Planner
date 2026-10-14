"use client";

import { Card } from "@/components/ui/card";
import { DesignPage, Section } from "./design-page";

const TYPE_SCALE = [
  ["text-large-title", "Large Title", "34px bold"],
  ["text-title1", "Title 1", "28px bold"],
  ["text-title2", "Title 2", "22px bold"],
  ["text-title3", "Title 3", "20px semibold"],
  ["text-headline", "Headline", "17px semibold"],
  ["text-body", "Body", "17px"],
  ["text-callout", "Callout", "16px"],
  ["text-subhead", "Subhead", "15px"],
  ["text-footnote", "Footnote", "13px"],
  ["text-caption", "Caption", "12px"],
] as const;

export function DesignTypography() {
  return (
    <DesignPage title="Typography" subtitle="San Francisco on Apple devices, Inter everywhere else.">
      <Section title="Type scale" note="Each style sets size, line height and weight together.">
        <Card className="flex flex-col gap-3">
          {TYPE_SCALE.map(([cls, name, spec]) => (
            <div key={cls} className="flex items-baseline justify-between gap-4">
              <span className={cls}>{name}</span>
              <span className="shrink-0 text-caption text-tertiary-label">{spec}</span>
            </div>
          ))}
        </Card>
      </Section>
      <Section title="Text colors">
        <Card className="flex flex-col gap-1">
          <span className="text-body">Label · primary text</span>
          <span className="text-body text-secondary-label">Secondary label · supporting text</span>
          <span className="text-body text-tertiary-label">Tertiary label · hints, placeholders</span>
          <span className="text-body text-tint">Tint · links and actions</span>
        </Card>
      </Section>
    </DesignPage>
  );
}
