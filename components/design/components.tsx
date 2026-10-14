"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, ListGroup, ListRow } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { TaskBlock } from "@/components/ui/task-block";
import type { TaskColor } from "@/lib/design/tokens";
import { DesignPage, Section } from "./design-page";

type DemoBlock = { id: string; title: string; time: string; color: TaskColor; kind: "task" | "event" };

const BLOCKS: DemoBlock[] = [
  { id: "1", title: "AP Chem", time: "9:00 – 10:15 AM", color: "blue", kind: "event" },
  { id: "2", title: "History essay · part 1", time: "10:30 – 11:30 AM", color: "orange", kind: "task" },
  { id: "3", title: "Shift at Juice Bar", time: "4:00 – 8:00 PM", color: "green", kind: "event" },
  { id: "4", title: "Calc problem set", time: "8:30 – 9:15 PM", color: "purple", kind: "task" },
];

export function DesignComponents() {
  const [blocks, setBlocks] = useState(BLOCKS);
  const [done, setDone] = useState<Set<string>>(new Set(["1"]));
  const [seg, setSeg] = useState<"day" | "week">("day");
  const [chip, setChip] = useState("1h");
  const [on, setOn] = useState(true);
  const [ring, setRing] = useState(0.62);

  return (
    <DesignPage title="Components" subtitle="Everything moves on the same fluid spring.">
      <Section title="Buttons" note="Every button squishes when pressed.">
        <div className="flex flex-wrap gap-3">
          <Button>Plan my week</Button>
          <Button variant="tinted">Add task</Button>
          <Button variant="glass">Glass</Button>
          <Button variant="plain">Skip</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="glass" size="icon" aria-label="Add">
            <Plus size={22} className="text-tint" />
          </Button>
        </div>
        <Button size="lg" className="mt-3">
          Full-width primary
        </Button>
      </Section>

      <Section title="Controls" note="The selected highlight is a glass lens that glides between options.">
        <Card className="flex flex-col gap-4">
          <SegmentedControl
            label="View"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {["30m", "1h", "1h 30m", "2h"].map((c) => (
              <Chip key={c} group="demo" selected={chip === c} onClick={() => setChip(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body">Switch</span>
            <Switch label="Demo switch" checked={on} onChange={setOn} />
          </div>
          <button
            type="button"
            className="flex items-center gap-4 text-left"
            onClick={() => setRing(Math.round(Math.random() * 100) / 100)}
          >
            <ProgressRing value={ring} label="Demo progress">
              <span className="text-footnote font-semibold">{Math.round(ring * 100)}%</span>
            </ProgressRing>
            <span className="text-subhead text-secondary-label">Progress ring. Tap to change.</span>
          </button>
        </Card>
      </Section>

      <Section title="Schedule blocks" note="Tap a block to toggle complete. Shuffle shows the reflow used for drag-to-reschedule.">
        <div className="flex flex-col gap-2.5">
          {blocks.map((b) => (
            <TaskBlock
              key={b.id}
              title={b.title}
              timeLabel={b.time}
              color={b.color}
              kind={b.kind}
              completed={done.has(b.id)}
              onClick={() =>
                setDone((d) => {
                  const next = new Set(d);
                  if (next.has(b.id)) next.delete(b.id);
                  else next.add(b.id);
                  return next;
                })
              }
            />
          ))}
        </div>
        <Button variant="tinted" size="sm" className="mt-3" onClick={() => setBlocks((b) => [...b].sort(() => Math.random() - 0.5))}>
          Shuffle
        </Button>
      </Section>

      <Section title="Grouped list">
        <ListGroup header="Account" footer="Settings uses this layout.">
          <ListRow title="Notifications" detail="15 min before each block" href="/settings" />
          <ListRow title="Week starts on" trailing={<span className="text-secondary-label">Monday</span>} />
        </ListGroup>
      </Section>

      <Section title="Bottom sheet" note="Drag the handle down, flick it, tap outside, or press Escape.">
        <Sheet title="Example sheet" description="Sheets slide up over the page." trigger={<Button variant="glass">Open a sheet</Button>}>
          <p className="pb-2 text-body text-secondary-label">
            Notice the page behind shrinks back slightly, just like iOS.
          </p>
        </Sheet>
      </Section>
    </DesignPage>
  );
}
