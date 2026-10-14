import type { Metadata } from "next";
import { DesignTypography } from "@/components/design/typography";

export const metadata: Metadata = { title: "Typography" };

export default function Page() {
  return <DesignTypography />;
}
