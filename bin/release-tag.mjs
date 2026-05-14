#!/usr/bin/env node
// 在 changesets/action 的 `publish` 阶段被调用：
//   - 仅当 HEAD 这次 commit 实际改变了 package.json 的 version 字段（即 Version PR 刚被合并）
//     才创建 v<version> tag 并 push，触发 .github/workflows/release.yml 走真正的发布
//   - 否则（普通 docs / refactor commit）什么都不做
//   - tag 已存在则幂等跳过
//
// 这样我们既保留了原有的 tag-driven release pipeline（OIDC + provenance + smoke test），
// 又把版本号管理交给 changesets，无需手动 bump / tag。
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const version = pkg.version;
const tag = `v${version}`;

function capture(cmd, args) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
}

function runInherit(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

function previousVersion() {
  // 读取 HEAD~1 的 package.json.version；若不存在（第一笔 commit 之类）返回 null
  try {
    const raw = capture("git", ["show", "HEAD~1:package.json"]);
    return JSON.parse(raw).version ?? null;
  } catch {
    return null;
  }
}

function tagExists(t) {
  try {
    capture("git", ["rev-parse", "--verify", `refs/tags/${t}`]);
    return true;
  } catch {}
  try {
    const out = capture("git", ["ls-remote", "--tags", "origin", `refs/tags/${t}`]);
    return out.length > 0;
  } catch {
    return false;
  }
}

const prev = previousVersion();
if (prev === version) {
  console.log(`✓ Version unchanged at ${version} on this commit; no tag to push.`);
  process.exit(0);
}

if (tagExists(tag)) {
  console.log(`✓ Tag ${tag} already exists; skipping (idempotent re-run).`);
  process.exit(0);
}

console.log(`Version bumped: ${prev ?? "<initial>"} → ${version}. Creating tag ${tag}...`);
runInherit("git", ["tag", tag]);

console.log(`Pushing tag ${tag} to origin...`);
runInherit("git", ["push", "origin", tag]);

console.log(`✓ Pushed ${tag}. release.yml workflow will now publish to npm.`);
