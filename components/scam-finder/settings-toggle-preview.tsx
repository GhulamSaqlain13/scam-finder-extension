"use client";

import { useState } from "react";
import { SettingRow, SettingToggle } from "./setting-row";
import { SettingsSection } from "./settings-section";

const initialSettings = {
  auto_scan: true,
  show_inline_warnings: true,
  send_message_content: true,
  save_history: false,
  allow_anonymized_training: false,
};

export function SettingsTogglePreview() {
  const [settings, setSettings] = useState(initialSettings);
  const [contextCount, setContextCount] = useState(6);

  function toggle(name: keyof typeof initialSettings, label: string, help: string) {
    return <SettingToggle name={name} label={label} help={help} checked={settings[name]}
      onChange={(checked) => setSettings((current) => ({ ...current, [name]: checked }))} />;
  }

  return (
    <>
      <SettingsSection title="Scanning">
        {toggle("auto_scan", "Scan new messages automatically", "Checks each message as it arrives. Turn this off to scan only when you click Analyze.")}
        {toggle("show_inline_warnings", "Show warnings inside the chat", "Places the risk block next to the message. Turn off to see results only in the popup.")}
        <SettingRow label="Messages sent for context" help="Earlier messages help judge intent. Fewer messages means less data leaves your browser.">
          <div className="fsd-stepper">
            <button className="fsd-btn fsd-btn--sm" type="button" aria-label="Fewer messages" disabled={contextCount === 0} onClick={() => setContextCount((count) => Math.max(0, count - 1))}>&minus;</button>
            <output className="fsd-stepper__value" data-fsd="context_message_count" aria-label="Context message count" aria-live="polite">{contextCount}</output>
            <button className="fsd-btn fsd-btn--sm" type="button" aria-label="More messages" disabled={contextCount === 20} onClick={() => setContextCount((count) => Math.min(20, count + 1))}>+</button>
          </div>
        </SettingRow>
      </SettingsSection>
      <SettingsSection title="Privacy">
        {toggle("send_message_content", "Send message text to the server", "Needed for AI analysis. With this off, only the on-device rules run.")}
        {toggle("save_history", "Keep scan history", "Stores the score, categories and time. Message text is never stored.")}
        {toggle("allow_anonymized_training", "Share anonymised examples to improve detection", "Off by default. Nothing from your chats is used for training unless you turn this on.")}
      </SettingsSection>
    </>
  );
}
