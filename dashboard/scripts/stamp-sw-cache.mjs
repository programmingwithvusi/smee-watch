#!/usr/bin/env node
/**
 * Stamps a fresh CACHE_NAME into dist/sw.js on every build, so the PWA's cache-first shell can
 * never again serve a stale bundle just because a version string was forgotten by hand.
 *
 * Incident this fixes (2026-10-16): three dashboard deploys in a row (the EasyEquities section,
 * the compact-row collapse, the STXDIV watch addition) went unnoticed on the installed phone app,
 * because CACHE_NAME in public/sw.js was never bumped -- the service worker kept serving the
 * pre-EasyEquities-wiring bundle. The fix isn't a better reminder, it's removing the manual step:
 * this script runs automatically after every `npm run build` (see package.json's "postbuild").
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.join(__dirname, "..", "dist", "sw.js");

if (!existsSync(swPath)) {
  console.error(`stamp-sw-cache: ${swPath} not found -- did the build run first?`);
  process.exitCode = 1;
  process.exit();
}

function buildVersion() {
  // Netlify sets COMMIT_REF to the deployed commit's full SHA; that's the most meaningful version
  // string when it's available. Locally (no Netlify env) fall back to the current git SHA, and if
  // this isn't even a git checkout, a timestamp -- anything that changes between builds works,
  // since all this needs to do is not equal the previous build's value.
  const fromEnv = process.env.COMMIT_REF;
  if (fromEnv) return fromEnv.slice(0, 10);
  try {
    return execSync("git rev-parse --short=10 HEAD", { cwd: __dirname }).toString().trim();
  } catch {
    return Date.now().toString(36);
  }
}

const version = buildVersion();
const sw = readFileSync(swPath, "utf8");
const stamped = sw.replace(/const CACHE_NAME = "[^"]*";/, `const CACHE_NAME = "chip-watch-shell-${version}";`);

if (stamped === sw) {
  console.error("stamp-sw-cache: CACHE_NAME line not found in dist/sw.js -- did sw.js's shape change?");
  process.exitCode = 1;
  process.exit();
}

writeFileSync(swPath, stamped, "utf8");
console.log(`stamp-sw-cache: dist/sw.js CACHE_NAME -> chip-watch-shell-${version}`);
