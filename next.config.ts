import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async redirects() {
    const pages: Record<string, string> = {
      index: "", popup: "popup", options: "options", tester: "tester",
      header: "header", "risk-meter": "risk-meter", "warning-inline": "warning-inline",
      "signal-list": "signal-list", "recommended-actions": "recommended-actions",
      feedback: "feedback", "settings-toggle": "settings-toggle", "history-item": "history", states: "states",
    };
    return Object.entries(pages).flatMap(([file, route]) => {
      const destination = `/scam-finder${route ? `/${route}` : ""}`;
      return [
        { source: `/scam-finder/${file}.html`, destination, permanent: true },
        { source: `/scam-finder/components/${file}.html`, destination, permanent: true },
      ];
    });
  },
};
export default nextConfig;
