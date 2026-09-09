import type { CSSProperties } from "react";

export type IconName = "shield" | "home" | "history" | "settings" | "message" | "arrow" | "chevron" | "lock" | "link";

const paths: Record<IconName, string> = {
  shield: "M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Z M8 12l3 3 5-6",
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  message: "M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2ZM7 9h10M7 13h6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10ZM12 14v3",
  link: "m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M13 7l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
};

export function Icon({ name, size = 18, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
