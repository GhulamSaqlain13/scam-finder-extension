"use client";

import { useId, type ReactNode } from "react";

export function SettingRow({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return <div className="fsd-setting"><div><div className="fsd-setting__label">{label}</div><div className="fsd-setting__help">{help}</div></div>{children}</div>;
}

export function SettingToggle({ name, label, help, checked, onChange }: {
  name: string; label: string; help: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  const helpId = useId();
  return (
    <div className="fsd-setting">
      <div><div className="fsd-setting__label">{label}</div><div className="fsd-setting__help" id={helpId}>{help}</div></div>
      <label className="fsd-switch">
        <input type="checkbox" name={name} checked={checked} onChange={(event) => onChange(event.target.checked)} aria-describedby={helpId} />
        <span className="fsd-switch__track" /><span className="fsd-sr-only">{label}</span>
      </label>
    </div>
  );
}
