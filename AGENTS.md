# Project instructions

This repository contains both the Next.js app and the standalone Manifest V3 extension.
Preserve app/, components/, lib/, styles, configs, and extension/ source files.
The user's cleanup authorization applies only to unused legacy HTML, not useful source.
Before Next.js changes read the applicable guide in node_modules/next/dist/docs/.
Use npm run build and npm run lint for the app.
Use npm run build:extension, npm run check:extension, and npm test for the extension.
Keep extension runtime assets local and never persist message text or sender identities.
