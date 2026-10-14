import { Component, Layers, Palette, Type } from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { ListGroup, ListRow, RowIcon } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = { title: "Design System" };

/**
 * The style guide, split into focused screens instead of one endless page.
 * Server Component: it's just links, so it ships no JavaScript of its own.
 */
export default function DesignHub() {
  return (
    <LargeTitlePage
      title="Design System"
      subtitle="The building blocks every screen is made from."
      leading={<BackLink href="/settings" label="Settings" />}
      trailing={<ThemeToggle />}
    >
      <ListGroup footer="One spring powers every animation, so the whole app moves like one liquid surface.">
        <ListRow
          href="/design/colors"
          icon={
            <RowIcon color="var(--task-pink)">
              <Palette size={17} />
            </RowIcon>
          }
          title="Colors & glass"
          detail="Semantic colors, task colors, materials"
        />
        <ListRow
          href="/design/typography"
          icon={
            <RowIcon color="var(--task-blue)">
              <Type size={17} />
            </RowIcon>
          }
          title="Typography"
          detail="iOS Dynamic Type scale"
        />
        <ListRow
          href="/design/components"
          icon={
            <RowIcon color="var(--task-purple)">
              <Component size={17} />
            </RowIcon>
          }
          title="Components"
          detail="Buttons, controls, blocks, sheets"
        />
        <ListRow
          href="/design/states"
          icon={
            <RowIcon color="var(--task-orange)">
              <Layers size={17} />
            </RowIcon>
          }
          title="States & feedback"
          detail="Loading, empty, error, toasts"
        />
      </ListGroup>
    </LargeTitlePage>
  );
}
