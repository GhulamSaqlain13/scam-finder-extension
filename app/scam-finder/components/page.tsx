import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScamFinderPreview } from "@/components/scam-finder/scam-finder-preview";

export const metadata: Metadata = { title: "Component library | Scam Finder" };

export default function ComponentsPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <><nav style={{ padding: "20px 24px 0" }}><BackButton /></nav><ScamFinderPreview /></>;
}
