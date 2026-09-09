import type { Metadata } from "next";
import { Home } from "@/components/scam-finder/home";

export const metadata: Metadata = {
  title: "Scam Finder | Safer conversations",
  description: "Explore message risk signals and practical next steps for suspicious Fiverr conversations.",
};

export default function HomePage() { return <Home />; }
