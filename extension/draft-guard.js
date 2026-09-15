(() => {
  function create() {
    const warnings = new Map();
    function check(event) {
      const target = event.target;
      const editor = target instanceof Element ? target.closest('textarea,[contenteditable="true"]') : null;
      if (!editor || !/^\/inbox(?:\/|$)/.test(location.pathname) || !editor.getClientRects().length) return;
      const results = globalThis.fsdSensitiveInformation.draft(editor.value ?? editor.innerText ?? "");
      warnings.get(editor)?.remove();
      warnings.delete(editor);
      for (const [node, host] of warnings) if (!node.isConnected) { host.remove(); warnings.delete(node); }
      if (!results.length) return;
      const host = document.createElement("aside");
      host.dataset.fsdWarning = "true";
      host.dataset.fsdDraftWarning = "true";
      const root = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = ':host{display:block;margin:8px 0}section{padding:12px;border:1px solid #b44b52;border-radius:6px;background:#fff3f3;color:#8e2349;font:13px/1.5 system-ui}p{margin:6px 0}';
      const section = document.createElement("section");
      section.setAttribute("role", "alert");
      const heading = document.createElement("strong"); heading.textContent = "Sensitive information in draft";
      section.append(heading);
      for (const result of results) {
        const line = document.createElement("p"); line.textContent = result.explanation + " " + result.action; section.append(line);
      }
      root.append(style, section); editor.after(host); warnings.set(editor, host);
    }
    return {
      start() { document.addEventListener("input", check, true); document.addEventListener("focusin", check, true); },
      stop() {
        document.removeEventListener("input", check, true); document.removeEventListener("focusin", check, true);
        for (const host of warnings.values()) host.remove(); warnings.clear();
      },
    };
  }
  globalThis.fsdDraftGuard = { create };
})();
