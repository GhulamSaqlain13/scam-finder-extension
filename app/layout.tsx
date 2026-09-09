import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiverr Scam Detector: UI kit",
  description: "Screens, components, and risk bands for the Fiverr Scam Detector.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-theme="light"><body className="fsd-root" data-theme="light">{children}</body></html>;
}

