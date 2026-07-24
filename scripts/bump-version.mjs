#!/usr/bin/env node
/**
 * Dual-track SemVer bump for Quack desktop.
 *
 *   npm run release:rc                 # develop → X.Y.Z-rc.N
 *   npm run release:rc -- 1.1.0-rc.1
 *   npm run release:prod -- patch      # production → X.Y.Z
 *   npm run release:prod -- 1.0.0
 *   npm run release:dry -- rc
 *   npm run release:dry -- prod -- minor
 *
 * Flags: --channel rc|prod, --dry-run, --push, --no-tag
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_FILES = [
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
];

const STABLE_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const RC_RE = /^(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$/;
const CHANNEL_BRANCH = { rc: "develop", prod: "production" };

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function git(args, opts = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    ...opts,
  }).trim();
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function writeJson(rel, data) {
  fs.writeFileSync(path.join(ROOT, rel), `${JSON.stringify(data, null, 2)}\n`);
}

function parseArgs(argv) {
  const flags = { dryRun: false, push: false, noTag: false, channel: null };
  const positionals = [];
  for (const a of argv) {
    if (a === "--") continue;
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--push") flags.push = true;
    else if (a === "--no-tag") flags.noTag = true;
    else if (a.startsWith("--channel=")) flags.channel = a.slice(10);
    else if (a === "rc" || a === "prod") {
      if (flags.channel) positionals.push(a);
      else flags.channel = a;
    } else if (!a.startsWith("-")) positionals.push(a);
    else die(`unknown flag: ${a}`);
  }
  return { ...flags, bump: positionals[0] ?? null };
}

function currentVersion() {
  return readJson("package.json").version;
}

function parseStable(v) {
  const m = STABLE_RE.exec(v);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function parseRc(v) {
  const m = RC_RE.exec(v);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], rc: +m[4] };
}

function fmtStable({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function fmtRc(base, n) {
  return `${fmtStable(base)}-rc.${n}`;
}

function baseOf(version) {
  const rc = parseRc(version);
  if (rc) return { major: rc.major, minor: rc.minor, patch: rc.patch };
  const st = parseStable(version);
  if (st) return st;
  // Strip unknown prerelease suffix for base (e.g. 1.0.0-beta.1 → refuse)
  die(`unsupported current version: ${version}`);
}

function nextRc(current, explicit) {
  if (explicit) {
    if (!parseRc(explicit)) die(`RC channel requires X.Y.Z-rc.N, got: ${explicit}`);
    return explicit;
  }
  const rc = parseRc(current);
  if (rc) return fmtRc(rc, rc.rc + 1);
  return fmtRc(baseOf(current), 1);
}

function bumpStable(current, kind) {
  const base = parseStable(current) ?? (() => {
    const rc = parseRc(current);
    if (!rc) die(`cannot bump stable from: ${current}`);
    return { major: rc.major, minor: rc.minor, patch: rc.patch };
  })();
  if (kind === "major") return fmtStable({ major: base.major + 1, minor: 0, patch: 0 });
  if (kind === "minor") return fmtStable({ major: base.major, minor: base.minor + 1, patch: 0 });
  if (kind === "patch") return fmtStable({ major: base.major, minor: base.minor, patch: base.patch + 1 });
  die(`unknown bump: ${kind}`);
}

function nextProd(current, explicit) {
  if (!explicit) die("prod channel requires patch|minor|major|X.Y.Z");
  if (explicit === "patch" || explicit === "minor" || explicit === "major") {
    // Bump from last stable base (strip -rc.N if present on develop carry-over)
    const stableOnDisk = parseStable(current);
    if (stableOnDisk) return bumpStable(current, explicit);
    // If files still say 1.0.0-rc.3 on production (shouldn't), bump the base
    return bumpStable(fmtStable(baseOf(current)), explicit);
  }
  if (!parseStable(explicit)) {
    die(`prod channel requires stable X.Y.Z (no prerelease), got: ${explicit}`);
  }
  return explicit;
}

function assertChannel(channel) {
  if (channel !== "rc" && channel !== "prod") {
    die(`channel must be rc|prod, got: ${channel ?? "(missing)"}`);
  }
}

function currentBranch() {
  try {
    return git(["branch", "--show-current"]);
  } catch {
    die("not inside a git repository");
  }
}

function assertBranch(channel, { soft = false } = {}) {
  const expected = CHANNEL_BRANCH[channel];
  const branch = currentBranch();
  if (!branch) {
    const msg = "detached HEAD — checkout develop or production";
    if (soft) {
      console.warn(`warning: ${msg}`);
      return;
    }
    die(msg);
  }
  if (branch !== expected) {
    const msg = `${channel} releases must run on '${expected}' (current: '${branch}')`;
    if (soft) {
      console.warn(`warning: ${msg}`);
      return;
    }
    die(msg);
  }
}

function dirtyBeyondVersionFiles() {
  const status = git(["status", "--porcelain"]);
  if (!status) return [];
  const allowed = new Set(VERSION_FILES);
  return status
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((f) => !allowed.has(f));
}

function assertClean(dryRun) {
  const extra = dirtyBeyondVersionFiles();
  if (extra.length && !dryRun) {
    die(`working tree dirty (unrelated files):\n  ${extra.join("\n  ")}`);
  }
}

function tagExists(tag) {
  try {
    git(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function assertTagFree(version, { soft = false } = {}) {
  const tag = `v${version}`;
  if (!tagExists(tag)) return;
  const msg = `tag already exists: ${tag}`;
  if (soft) console.warn(`warning: ${msg}`);
  else die(msg);
}

function writePackageJson(version) {
  const pkg = readJson("package.json");
  pkg.version = version;
  writeJson("package.json", pkg);
}

function writePackageLock(version) {
  const lock = readJson("package-lock.json");
  lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;
  writeJson("package-lock.json", lock);
}

function writeTauriConf(version) {
  const conf = readJson("src-tauri/tauri.conf.json");
  conf.version = version;
  writeJson("src-tauri/tauri.conf.json", conf);
}

function writeCargoToml(version) {
  const rel = "src-tauri/Cargo.toml";
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const next = text.replace(/^version = "[^"]*"/m, `version = "${version}"`);
  if (next === text) die("failed to update src-tauri/Cargo.toml version");
  fs.writeFileSync(path.join(ROOT, rel), next);
}

function writeCargoLock(version) {
  const rel = "src-tauri/Cargo.lock";
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const next = text.replace(
    /(\[\[package\]\]\nname = "codetta"\n)version = "[^"]*"/,
    `$1version = "${version}"`,
  );
  if (next === text) die("failed to update codetta version in Cargo.lock");
  fs.writeFileSync(path.join(ROOT, rel), next);
}

function syncFiles(version) {
  writePackageJson(version);
  writePackageLock(version);
  writeTauriConf(version);
  writeCargoToml(version);
  writeCargoLock(version);
}

function commitAndTag(version, { noTag, push, dryRun }) {
  const msg = `chore(release): bump version to ${version}`;
  const tag = `v${version}`;
  if (dryRun) {
    console.log(`[dry-run] would commit: ${msg}`);
    if (!noTag) console.log(`[dry-run] would tag: ${tag}`);
    if (push) console.log(`[dry-run] would push branch + ${tag}`);
    return;
  }
  git(["add", ...VERSION_FILES]);
  git(["commit", "-s", "-m", msg]);
  if (!noTag) {
    git(["tag", "-a", tag, "-m", `Quack ${tag}`]);
    console.log(`tagged ${tag}`);
  }
  if (push) {
    git(["push"]);
    if (!noTag) git(["push", "origin", tag]);
    console.log("pushed branch" + (noTag ? "" : ` + ${tag}`));
  }
}

function resolveNext(channel, current, bump) {
  if (channel === "rc") return nextRc(current, bump);
  return nextProd(current, bump);
}

function main() {
  // Re-parse so `--channel rc` two-token form works via raw argv
  const raw = process.argv.slice(2);
  const cleaned = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "--channel" && raw[i + 1]) {
      cleaned.push(`--channel=${raw[i + 1]}`);
      i++;
    } else cleaned.push(raw[i]);
  }
  const opts = parseArgs(cleaned);
  assertChannel(opts.channel);
  assertBranch(opts.channel, { soft: opts.dryRun });

  const current = currentVersion();
  const next = resolveNext(opts.channel, current, opts.bump);
  if (opts.channel === "rc" && !parseRc(next)) die(`internal: not an RC: ${next}`);
  if (opts.channel === "prod" && !parseStable(next)) die(`internal: not stable: ${next}`);

  assertClean(opts.dryRun);
  if (!opts.noTag) assertTagFree(next, { soft: opts.dryRun });

  console.log(`${current} → ${next} (${opts.channel})`);
  if (opts.dryRun) {
    console.log("[dry-run] would sync:", VERSION_FILES.join(", "));
  } else {
    syncFiles(next);
  }
  commitAndTag(next, opts);
}

main();
