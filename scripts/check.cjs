const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8").replace(/^\uFEFF/, ""));
const resources = [manifest.action.default_popup, manifest.options_page, manifest.background.service_worker, ...manifest.content_scripts.flatMap(c => c.js)];
for (const resource of resources) if (!fs.existsSync(path.join(root, resource))) throw Error("Missing manifest resource: " + resource);
for (const file of fs.readdirSync(path.join(root, "extension"))) {
  const full = path.join(root, "extension", file);
  if (file.endsWith(".js")) cp.execFileSync(process.execPath, ["--check", full]);
  if (file.endsWith(".html")) {
    const html = fs.readFileSync(full, "utf8");
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (!fs.existsSync(path.resolve(path.dirname(full), match[1]))) throw Error("Broken resource: " + match[1]);
    }
  }
}
console.log("PASS: Manifest resources, extension scripts, and local HTML links.");
