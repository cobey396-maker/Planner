"use client";

import { Inbox } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BlockListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { fadeUp } from "@/lib/design/motion";
import { DesignPage, Section } from "./design-page";

export function DesignStates() {
  const [state, setState] = useState<"loading" | "empty" | "error">("loading");
  const toast = useToast();
  return (
    <DesignPage title="States & feedback" subtitle="Every screen has a loading, empty and error state.">
      <Section title="Screen states">
        <SegmentedControl
          label="State"
          value={state}
          onChange={setState}
          options={[
            { value: "loading", label: "Loading" },
            { value: "empty", label: "Empty" },
            { value: "error", label: "Error" },
          ]}
        />
        <Card className="mt-3 min-h-72">
          <AnimatePresence mode="wait">
            <motion.div key={state} variants={fadeUp} initial="initial" animate="animate" exit="exit">
              {state === "loading" && <BlockListSkeleton />}
              {state === "empty" && (
                <EmptyState
                  icon={<Inbox className="text-secondary-label" />}
                  title="Nothing planned yet"
                  message="Add a task and we'll find the perfect time for it."
                  action={<Button>Add a task</Button>}
                />
              )}
              {state === "error" && <ErrorState onRetry={() => setState("loading")} />}
            </motion.div>
          </AnimatePresence>
        </Card>
      </Section>
      <Section title="Toast" note="A glass capsule drops in from the top, then floats away.">
        <Button variant="glass" onClick={() => toast("Invite sent to Maya")}>
          Show a toast
        </Button>
      </Section>
    </DesignPage>
  );
}
