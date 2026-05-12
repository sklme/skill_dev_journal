#!/usr/bin/env node
// @iskl/dev-journal — install/uninstall CLI
// Zero-dependency, pure Node.js (>= 18).

import { promises as fs, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline";

// ---------- Constants ----------

const SKILL_NAME = "dev-journal";

// Where the skill source lives inside this package
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_SRC = path.resolve(__dirname, "..", "skills", SKILL_NAME);

// Each supported agent: directory layout for skills
// `subdir`: relative path from the chosen root that holds the agent's skill folder
const AGENTS = {
  claude: { label: "Claude Code", subdir: ".claude/skills" },
  cursor: { label: "Cursor", subdir: ".cursor/skills" },
  gemini: { label: "Gemini CLI", subdir: ".gemini/skills" },
  codex: { label: "Codex CLI", subdir: ".codex/skills" },
  opencode: { label: "OpenCode", subdir: ".config/opencode/skills" },
  copilot: { label: "GitHub Copilot", subdir: ".copilot/skills" },
};

const ALL_AGENT_KEYS = Object.keys(AGENTS);

// Read version dynamically from package.json so we never drift
const PKG_PATH = path.resolve(__dirname, "..", "package.json");
let PKG = { name: "@iskl/dev-journal", version: "0.0.0" };
try {
  PKG = JSON.parse(await fs.readFile(PKG_PATH, "utf8"));
} catch {
  // fall back to defaults
}

// ---------- Tiny color helpers (no deps; auto-disable in non-TTY) ----------

const useColor =
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";
const c = {
  reset: useColor ? "\x1b[0m" : "",
  bold: useColor ? "\x1b[1m" : "",
  dim: useColor ? "\x1b[2m" : "",
  red: useColor ? "\x1b[31m" : "",
  green: useColor ? "\x1b[32m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  blue: useColor ? "\x1b[34m" : "",
  cyan: useColor ? "\x1b[36m" : "",
};

const log = (...m) => console.log(...m);
const ok = (msg) => log(`${c.green}✓${c.reset} ${msg}`);
const warn = (msg) => log(`${c.yellow}!${c.reset} ${msg}`);
const err = (msg) => log(`${c.red}✗${c.reset} ${msg}`);
const info = (msg) => log(`${c.cyan}·${c.reset} ${msg}`);

// ---------- Argv parsing ----------

function parseArgv(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.flags.help = true;
    else if (a === "--version" || a === "-v") args.flags.version = true;
    else if (a === "--force" || a === "-f") args.flags.force = true;
    else if (a === "--dry-run" || a === "-n") args.flags.dryRun = true;
    else if (a === "--link") args.flags.link = true;
    else if (a === "--yes" || a === "-y") args.flags.yes = true;
    else if (a === "--agent") args.flags.agent = argv[++i];
    else if (a === "--scope") args.flags.scope = argv[++i];
    else if (a.startsWith("--agent=")) args.flags.agent = a.slice(8);
    else if (a.startsWith("--scope=")) args.flags.scope = a.slice(8);
    else args._.push(a);
  }
  return args;
}

// ---------- Help ----------

function printHelp() {
  log(`${c.bold}${PKG.name}${c.reset}  v${PKG.version}

跨平台安装 dev-journal Agent Skill 到 Claude Code / Cursor / Gemini CLI / Codex CLI / OpenCode / Copilot。

${c.bold}Usage${c.reset}
  npx ${PKG.name} <command> [options]

${c.bold}Commands${c.reset}
  install              将 skill 复制到目标 Agent 目录（默认）
  uninstall            从目标 Agent 目录移除 skill
  list                 列出当前已安装本 skill 的位置
  print                把 SKILL.md 内容打印到 stdout（便于管道使用）

${c.bold}Options${c.reset}
  --agent <name>       目标 Agent: ${ALL_AGENT_KEYS.join(" | ")} | all
                       省略时进入交互模式（自动检测已存在的 Agent 目录）
  --scope <name>       project | user  (default: project)
                         project = <cwd>
                         user    = ${homedir()}
  --link               创建 symlink 代替复制（开发场景方便联调）
  --force, -f          目标已存在时直接覆盖
  --dry-run, -n        只展示将要做的操作，不实际写入
  --yes, -y            非交互模式，所有 prompt 默认 yes
  --help, -h           显示帮助
  --version, -v        显示版本

${c.bold}Examples${c.reset}
  # 交互式（默认），自动检测目标 Agent
  npx ${PKG.name} install

  # 显式安装到 Cursor 项目级
  npx ${PKG.name} install --agent cursor --scope project

  # 一次性安装到所有用户级目录
  npx ${PKG.name} install --agent all --scope user

  # 卸载
  npx ${PKG.name} uninstall --agent cursor --scope project

  # 预览将要执行的操作
  npx ${PKG.name} install --agent claude --scope user --dry-run
`);
}

// ---------- Prompt helpers ----------

async function prompt(question, defaultValue = "") {
  if (!process.stdin.isTTY) return defaultValue;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function confirm(question, defaultYes = false) {
  const def = defaultYes ? "Y/n" : "y/N";
  const ans = await prompt(`${question} [${def}] `, defaultYes ? "y" : "n");
  return /^y(es)?$/i.test(ans);
}

// ---------- Detection ----------

function rootFor(scope) {
  if (scope === "user") return homedir();
  return process.cwd();
}

function targetDirFor(agentKey, scope) {
  const root = rootFor(scope);
  const { subdir } = AGENTS[agentKey];
  return path.join(root, subdir, SKILL_NAME);
}

function detectExistingAgentDirs(scope) {
  const root = rootFor(scope);
  return ALL_AGENT_KEYS.filter((k) => {
    // For detection we look at the base ".<agent>" or ".config/opencode" dir, not the skills/ child
    const base = AGENTS[k].subdir.replace(/\/skills$/, "");
    return existsSync(path.join(root, base));
  });
}

// ---------- File ops ----------

async function copyDir(src, dst, { dryRun = false } = {}) {
  const stack = [{ s: src, d: dst }];
  while (stack.length) {
    const { s, d } = stack.pop();
    const stat = statSync(s);
    if (stat.isDirectory()) {
      if (!dryRun) await fs.mkdir(d, { recursive: true });
      for (const child of await fs.readdir(s)) {
        stack.push({ s: path.join(s, child), d: path.join(d, child) });
      }
    } else if (stat.isFile()) {
      if (!dryRun) {
        await fs.mkdir(path.dirname(d), { recursive: true });
        await fs.copyFile(s, d);
      }
    }
  }
}

async function removeDir(dir, { dryRun = false } = {}) {
  if (!existsSync(dir)) return false;
  if (!dryRun) await fs.rm(dir, { recursive: true, force: true });
  return true;
}

// ---------- Commands ----------

async function selectAgentsInteractive(scope) {
  const detected = detectExistingAgentDirs(scope);
  log(
    `${c.bold}Detected agents${c.reset} (scope=${scope}): ${
      detected.length ? detected.join(", ") : c.dim + "none" + c.reset
    }`,
  );
  log(`Available: ${ALL_AGENT_KEYS.join(", ")}, all`);
  const ans = await prompt(
    `请选择要安装的 Agent（逗号分隔，回车=已检测到的全部，输入 all 安装到全部）: `,
    detected.join(",") || "all",
  );
  if (!ans) return [];
  if (ans === "all") return ALL_AGENT_KEYS;
  return ans
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function selectScopeInteractive() {
  const ans = await prompt(
    `安装范围 [project=当前项目 / user=全局] (default: project): `,
    "project",
  );
  if (ans === "user" || ans === "u") return "user";
  return "project";
}

function validateAgents(agents) {
  const invalid = agents.filter((a) => !AGENTS[a]);
  if (invalid.length) {
    err(`未知 agent: ${invalid.join(", ")}`);
    info(`支持的 agent: ${ALL_AGENT_KEYS.join(" | ")} | all`);
    process.exit(2);
  }
}

async function cmdInstall(args) {
  // Validate skill source exists
  if (!existsSync(SKILL_SRC)) {
    err(`skill source not found: ${SKILL_SRC}`);
    err(`这是包内部错误（npm 包不完整）。请重新安装本 npm 包。`);
    process.exit(3);
  }

  // Resolve scope
  let scope = args.flags.scope;
  if (scope && scope !== "project" && scope !== "user") {
    err(`invalid --scope: ${scope} (允许: project | user)`);
    process.exit(2);
  }
  if (!scope) {
    scope = args.flags.yes
      ? "project"
      : process.stdin.isTTY
        ? await selectScopeInteractive()
        : "project";
  }

  // Resolve agents
  let agents = [];
  let raw = args.flags.agent;
  if (raw) {
    raw = raw.toLowerCase();
    agents = raw === "all" ? ALL_AGENT_KEYS : raw.split(",").map((s) => s.trim());
  } else if (args.flags.yes) {
    const detected = detectExistingAgentDirs(scope);
    agents = detected.length ? detected : ALL_AGENT_KEYS;
  } else if (process.stdin.isTTY) {
    agents = await selectAgentsInteractive(scope);
  } else {
    err(`未指定 --agent，且当前不是交互终端`);
    info(`请加 --agent <name>，例如 --agent cursor`);
    process.exit(2);
  }

  if (!agents.length) {
    warn(`未选择任何 Agent，已取消`);
    return;
  }
  validateAgents(agents);

  const action = args.flags.link ? "link" : "copy";
  const tag = args.flags.dryRun ? `${c.yellow}[dry-run]${c.reset} ` : "";

  log("");
  log(`${c.bold}Plan${c.reset}`);
  log(`  scope:   ${scope}`);
  log(`  action:  ${action}`);
  log(`  source:  ${SKILL_SRC}`);
  log(`  targets:`);
  for (const a of agents) {
    log(`    - ${AGENTS[a].label}: ${targetDirFor(a, scope)}`);
  }
  log("");

  if (!args.flags.yes && !args.flags.dryRun) {
    if (!(await confirm("继续？", true))) {
      warn("已取消");
      return;
    }
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of agents) {
    const dst = targetDirFor(a, scope);
    try {
      if (existsSync(dst)) {
        if (!args.flags.force) {
          warn(`${tag}skipping ${AGENTS[a].label}: ${dst} 已存在（用 --force 覆盖）`);
          skipped++;
          continue;
        }
        await removeDir(dst, { dryRun: args.flags.dryRun });
      }

      if (action === "link") {
        if (!args.flags.dryRun) {
          await fs.mkdir(path.dirname(dst), { recursive: true });
          await fs.symlink(SKILL_SRC, dst, "dir");
        }
        ok(`${tag}${AGENTS[a].label}: linked → ${dst}`);
      } else {
        await copyDir(SKILL_SRC, dst, { dryRun: args.flags.dryRun });
        ok(`${tag}${AGENTS[a].label}: installed → ${dst}`);
      }
      success++;
    } catch (e) {
      err(`${AGENTS[a].label}: ${e.message}`);
      failed++;
    }
  }

  log("");
  log(
    `${c.bold}Done${c.reset}  ✓ ${success}   ${c.yellow}skipped${c.reset} ${skipped}   ${c.red}failed${c.reset} ${failed}`,
  );

  if (success > 0 && !args.flags.dryRun) {
    log("");
    info(`下一步：在你的 AI 编程工具里说 "写 journal" 或 "总结这次修改" 即可触发。`);
  }
}

async function cmdUninstall(args) {
  let scope = args.flags.scope;
  if (scope && scope !== "project" && scope !== "user") {
    err(`invalid --scope: ${scope} (允许: project | user)`);
    process.exit(2);
  }
  if (!scope) {
    scope = args.flags.yes
      ? "project"
      : process.stdin.isTTY
        ? await selectScopeInteractive()
        : "project";
  }

  let agents = [];
  const raw = args.flags.agent;
  if (raw) {
    agents =
      raw.toLowerCase() === "all"
        ? ALL_AGENT_KEYS
        : raw.split(",").map((s) => s.trim());
  } else if (args.flags.yes) {
    agents = ALL_AGENT_KEYS;
  } else if (process.stdin.isTTY) {
    agents = await selectAgentsInteractive(scope);
  } else {
    err(`未指定 --agent，且当前不是交互终端`);
    process.exit(2);
  }

  if (!agents.length) {
    warn(`未选择任何 Agent，已取消`);
    return;
  }
  validateAgents(agents);

  const tag = args.flags.dryRun ? `${c.yellow}[dry-run]${c.reset} ` : "";

  let removed = 0;
  let notFound = 0;

  for (const a of agents) {
    const dst = targetDirFor(a, scope);
    if (!existsSync(dst)) {
      info(`${tag}${AGENTS[a].label}: ${dst} 不存在，跳过`);
      notFound++;
      continue;
    }
    if (!args.flags.yes && !args.flags.dryRun) {
      const yes = await confirm(`移除 ${AGENTS[a].label} (${dst})?`, false);
      if (!yes) {
        notFound++;
        continue;
      }
    }
    try {
      await removeDir(dst, { dryRun: args.flags.dryRun });
      ok(`${tag}${AGENTS[a].label}: removed`);
      removed++;
    } catch (e) {
      err(`${AGENTS[a].label}: ${e.message}`);
    }
  }

  log("");
  log(
    `${c.bold}Done${c.reset}  ✓ ${removed}   ${c.dim}not-found${c.reset} ${notFound}`,
  );
}

async function cmdList() {
  log(`${c.bold}Installed locations of skill "${SKILL_NAME}"${c.reset}`);
  let hits = 0;
  for (const scope of ["project", "user"]) {
    for (const a of ALL_AGENT_KEYS) {
      const dst = targetDirFor(a, scope);
      if (existsSync(dst)) {
        ok(`[${scope}] ${AGENTS[a].label}: ${dst}`);
        hits++;
      }
    }
  }
  if (!hits) warn(`未发现任何已安装位置`);
}

async function cmdPrint() {
  const skillMd = path.join(SKILL_SRC, "SKILL.md");
  if (!existsSync(skillMd)) {
    err(`SKILL.md not found: ${skillMd}`);
    process.exit(3);
  }
  process.stdout.write(await fs.readFile(skillMd, "utf8"));
}

// ---------- Entry ----------

async function main() {
  const args = parseArgv(process.argv.slice(2));

  if (args.flags.version) {
    log(PKG.version);
    return;
  }
  if (args.flags.help) {
    printHelp();
    return;
  }

  const cmd = args._[0] || "install";

  try {
    switch (cmd) {
      case "install":
      case "i":
        await cmdInstall(args);
        break;
      case "uninstall":
      case "u":
      case "remove":
      case "rm":
        await cmdUninstall(args);
        break;
      case "list":
      case "ls":
        await cmdList();
        break;
      case "print":
        await cmdPrint();
        break;
      default:
        err(`未知命令: ${cmd}`);
        log("");
        printHelp();
        process.exit(2);
    }
  } catch (e) {
    err(e.stack || e.message);
    process.exit(1);
  }
}

main();
