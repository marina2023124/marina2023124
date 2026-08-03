#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

async function main() {
  const privateKey = process.env.WECHAT_UPLOAD_KEY;
  if (!privateKey) throw new Error("缺少 WECHAT_UPLOAD_KEY");

  const repoRoot = path.join(__dirname, "../../..");
  const miniprogramRoot = path.join(repoRoot, "job-agent-miniprogram");
  const keyPath = path.join(repoRoot, "private.key");
  fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });

  const ci = require("miniprogram-ci");
  const config = JSON.parse(
    fs.readFileSync(path.join(miniprogramRoot, "project.config.json"), "utf8")
  );

  const project = new ci.Project({
    appid: config.appid,
    type: "miniProgram",
    projectPath: miniprogramRoot,
    privateKeyPath: keyPath,
    ignores: [
      "node_modules/**/*",
      "package.json",
      "package-lock.json",
      "README.md",
      "setup-mac.sh",
    ],
  });

  const version = `1.0.${process.env.GITHUB_RUN_NUMBER || "0"}`;
  const desc = (process.env.GITHUB_EVENT_HEAD_COMMIT_MESSAGE || "CI upload").slice(
    0,
    100
  );

  await ci.upload({
    project,
    version,
    desc,
    setting: { es6: true, minify: true, postcss: false },
    onProgressUpdate: (msg) => console.log(msg),
  });

  console.log(`✅ 体验版已上传 version=${version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
