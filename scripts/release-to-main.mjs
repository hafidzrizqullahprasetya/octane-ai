#!/usr/bin/env node
import { execSync } from "child_process";

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: "inherit" });
}

function runOut(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

console.log("\n🚀 Starting automated release to 'main'...\n");

try {
  // 1. Check current branch
  const branch = runOut("git branch --show-current");
  if (branch !== "dev") {
    console.error(`❌ Error: You must run release from the 'dev' branch (currently on '${branch}').`);
    process.exit(1);
  }

  // 2. Check for unstaged changes
  const status = runOut("git status --porcelain");
  if (status) {
    console.error("❌ Error: You have uncommitted changes in 'dev'. Please commit them first.");
    process.exit(1);
  }

  const lastCommitMsg = runOut("git log -1 --pretty=%B").split("\n")[0] || "update core to latest dev";

  // 3. Switch to main
  console.log("📦 1/4 Switching to main branch...");
  run("git checkout main");

  // 4. Copy all core directories and files from dev
  console.log("📥 2/4 Syncing core files from dev...");
  const corePaths = [
    "src/",
    "open-sse/",
    "cli/",
    "public/",
    "skills/",
    "tests/",
    "Dockerfile",
    "docker-compose.yml",
    "next.config.mjs",
    "package.json",
    "package-lock.json",
    "jsconfig.json",
    "eslint.config.mjs",
    "postcss.config.mjs",
    ".dockerignore",
    ".env.example",
    ".github/workflows/deploy.yml"
  ];

  run(`git checkout dev -- ${corePaths.join(" ")}`);

  // 5. Commit and push to main
  console.log("📤 3/4 Committing and pushing to main...");
  try {
    run(`git commit -m "release: ${lastCommitMsg.replace(/^(feat|fix|chore|refactor)(\([^)]+\))?: /, "")}"`);
  } catch (e) {
    console.log("ℹ️ No new core changes to commit on main.");
  }
  run("git push origin main");

  // 6. Return to dev and sync history
  console.log("🔄 4/4 Returning to dev and syncing git history...");
  run("git checkout dev");
  run('git merge main -m "merge: sync dev with latest release on main"');
  run("git push origin dev");

  console.log("\n✨ RELEASE COMPLETE!");
  console.log("--------------------------------------------------");
  console.log("• Branch 'main' updated and pushed.");
  console.log("• GitHub Actions CI/CD has been triggered.");
  console.log("• Home Server will automatically update in ~30s.");
  console.log("• Returned safely to branch 'dev'.\n");
} catch (err) {
  console.error("\n❌ Release failed with error:", err.message);
  try {
    run("git checkout dev");
  } catch {}
  process.exit(1);
}
