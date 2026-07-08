#!/usr/bin/env node
import { createInterface } from "readline/promises";
import { writeFile } from "fs/promises";
import { stdin as input, stdout as output } from "process";
import { createClient } from "@supabase/supabase-js";

const rl = createInterface({ input, output });

async function main() {
  console.log("\n🚀 JobAgent Supabase 配置向导\n");

  const url = await rl.question("Project URL (https://xxx.supabase.co): ");
  const anonKey = await rl.question("anon public key: ");

  if (!url || !anonKey) {
    console.error("❌ URL 和 key 不能为空");
    process.exit(1);
  }

  console.log("\n正在测试连接...");
  const supabase = createClient(url.trim(), anonKey.trim());
  const { error } = await supabase.from("user_app_data").select("user_id").limit(1);

  if (error) {
    if (error.code === "PGRST205" || error.message.includes("Could not find the table")) {
      console.error("❌ 连接成功，但 user_app_data 表不存在");
      console.error("   请先在 Supabase SQL Editor 执行 supabase/schema.sql");
    } else {
      console.error("❌ 连接失败:", error.message);
    }
    process.exit(1);
  }

  const content = [
    "# Supabase 云端存储配置",
    `NEXT_PUBLIC_SUPABASE_URL=${url.trim()}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey.trim()}`,
    "",
  ].join("\n");

  await writeFile(".env.local", content, "utf-8");
  console.log("\n✅ 配置已写入 .env.local");
  console.log("   请运行: npm run dev\n");

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
