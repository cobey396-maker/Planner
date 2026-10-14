import type { Metadata } from "next";
import { DesignColors } from "@/components/design/colors";

export const metadata: Metadata = { title: "Colors & glass" };

export default function Page() {
  return <DesignColors />;
}
