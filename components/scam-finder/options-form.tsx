"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { SettingRow, SettingToggle } from "./setting-row";
import { SettingsSection } from "./settings-section";

const storageKey = "scam-finder.settings.v1";
const defaults = {
  auto_scan: true, show_inline_warnings: true, context_message_count: 6,
  send_message_content: true, save_history: false, allow_anonymized_training: false,
  analytics_opt_in: false, dev_mode: false,
};
type Settings = typeof defaults;
type ToggleKey = Exclude<keyof Settings, "context_message_count">;
type ToggleDefinition = { name: ToggleKey; label: string; help: string };
const scanning: ToggleDefinition[] = [
  { name: "auto_scan", label: "Scan new messages automatically", help: "Checks each message as it arrives. Turn this off to scan only when you click Analyze." },
  { name: "show_inline_warnings", label: "Show warnings inside the chat", help: "Places the risk block next to the message instead of only in the popup." },
];
const privacy: ToggleDefinition[] = [
  { name: "send_message_content", label: "Send message text to the server", help: "Needed for AI analysis. With this off, only the on-device rules run." },
  { name: "save_history", label: "Keep scan history", help: "Stores the score, categories and time, without message text." },
  { name: "allow_anonymized_training", label: "Share anonymised examples to improve detection", help: "Off by default. Choose whether to allow examples for training when detection is connected." },
  { name: "analytics_opt_in", label: "Usage analytics", help: "Counts of scans and errors, with no message content." },
];

function readSettings(): Settings {
  const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
  const result = { ...defaults };
  if (!raw || typeof raw !== "object") return result;
  for (const name of Object.keys(defaults) as (keyof Settings)[]) {
    const value = (raw as Record<string, unknown>)[name];
    if (name === "context_message_count") {
      if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 20) result[name] = value;
    } else if (typeof value === "boolean") result[name] = value;
  }
  return result;
}

export function OptionsForm() {
  const [settings, setSettings] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Hydrate browser-only preferences after the server render.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings(readSettings());
    } catch { setNotice("Saved settings could not be loaded. Default values are shown."); }
    setReady(true);
  }, []);

  function update<K extends keyof Settings>(name: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [name]: value }));
    setNotice("Unsaved changes.");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); setNotice("Settings saved in this browser."); }
    catch { setNotice("Settings could not be saved. Browser storage may be unavailable or full."); }
  }

  function toggles(items: ToggleDefinition[]) {
    return items.map((item) => <SettingToggle key={item.name} {...item} checked={settings[item.name]} onChange={(checked) => update(item.name, checked)} />);
  }

  return (
    <form onSubmit={save}>
      <fieldset disabled={!ready} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend className="fsd-sr-only">Scam detector settings</legend>
        <SettingsSection title="Scanning">
          {toggles(scanning)}
          <SettingRow label="Messages sent for context" help="Earlier messages help judge intent. Choose between 0 and 20 messages.">
            <div className="fsd-stepper">
              <button className="fsd-btn fsd-btn--sm" type="button" aria-label="Fewer messages" disabled={settings.context_message_count === 0} onClick={() => update("context_message_count", settings.context_message_count - 1)}>&minus;</button>
              <output className="fsd-stepper__value" aria-label="Context message count" aria-live="polite">{settings.context_message_count}</output>
              <button className="fsd-btn fsd-btn--sm" type="button" aria-label="More messages" disabled={settings.context_message_count === 20} onClick={() => update("context_message_count", settings.context_message_count + 1)}>+</button>
            </div>
          </SettingRow>
        </SettingsSection>
        <SettingsSection title="Privacy">{toggles(privacy)}</SettingsSection>
        <SettingsSection title="Account and data">
          <SettingRow label="Stored scans" help="No persistent scan storage is connected yet.">
            <div className="fsd-btn-row">
              <button className="fsd-btn fsd-btn--sm" type="button" disabled>Export</button>
              <button className="fsd-btn fsd-btn--sm" type="button" disabled>Delete all</button>
            </div>
          </SettingRow>
          <SettingToggle name="dev_mode" label="Developer mode" help="Shows a link to the message tester preview." checked={settings.dev_mode} onChange={(checked) => update("dev_mode", checked)} />
          {settings.dev_mode && <div className="fsd-card__body"><Link className="fsd-btn fsd-btn--sm" href="/scam-finder/tester">Open message tester preview</Link></div>}
          <div className="fsd-card__foot"><div className="fsd-row fsd-row--between">
            <span className="fsd-small fsd-muted">Preferences stored in this browser</span>
            <button className="fsd-btn fsd-btn--primary fsd-btn--sm" type="submit">Save changes</button>
          </div></div>
        </SettingsSection>
      </fieldset>
      <p className="fsd-p fsd-small" role="status">{notice || (!ready ? "Loading settings…" : "")}</p>
    </form>
  );
}
