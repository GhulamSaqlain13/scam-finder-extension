require("./check.cjs");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const target = path.join(root, "dist", "scam-finder");
fs.mkdirSync(path.join(target, "extension"), { recursive: true });
fs.mkdirSync(path.join(target, "data"), { recursive: true });
fs.copyFileSync(path.join(root, "manifest.json"), path.join(target, "manifest.json"));
fs.copyFileSync(path.join(root, "data", "scamPatterns.json"), path.join(target, "data", "scamPatterns.json"));
for (const file of fs.readdirSync(path.join(root, "extension"))) {
  if (/\.(html|css|js)$/.test(file)) fs.copyFileSync(path.join(root, "extension", file), path.join(target, "extension", file));
}
console.log("Load unpacked: " + target);
