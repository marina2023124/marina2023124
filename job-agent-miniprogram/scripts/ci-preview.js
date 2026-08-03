#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

async function main() {
  const privateKey = process.env.WECHAT_UPLOAD_KEY;
  if (!privateKey) {
    throw new Error("缺少 WECHAT_UPLOAD_KEY 环境变量");
  }

  const miniprogramRoot = path.join(__dirname, "..");
  const repoRoot = path.join(miniprogramRoot, "..");
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
    ignores: ["node_modules/**/*"],
  });

  const version =
    process.env.GITHUB_RUN_NUMBER && process.env.GITHUB_RUN_ATTEMPT
      ? `${process.env.GITHUB_RUN_NUMBER}.${process.env.GITHUB_RUN_ATTEMPT}`
      : "1.0.0";
  const desc = process.env.GITHUB_SHA?.slice(0, 7) || "CI preview";
  const qrcodePath = path.join(repoRoot, "preview-qrcode.png");

  await ci.preview({
    project,
    version,
    desc: `CI preview ${desc}`,
    setting: {
      es6: true,
      minify: true,
      postcss: false,
    },
    qrcodeFormat: "image",
    qrcodeOutputDest: qrcodePath,
    onProgressUpdate: (msg) => console.log(msg),
  });

  console.log(`✅ 预览二维码已生成: ${qrcodePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
