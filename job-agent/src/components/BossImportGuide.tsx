"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, Bookmark } from "lucide-react";
import { Button } from "./ui";

/** 用户在 BOSS 直聘页面手动点击运行，提取当前岗位文字到剪贴板（非爬虫） */
export const BOSS_BOOKMARKLET = `javascript:(function(){try{var u=location.href;var s=document.querySelector('.job-detail-section,.job-detail,.job-box,.position-content,.job-sec-text');var t=s?s.innerText:'';if(!t||t.length<50){var p=document.querySelector('[class*="job-detail"],[class*="JobDetail"],.detail-content');t=p?p.innerText:''}if(!t||t.length<30)t=window.getSelection()?.toString()||'';if(!t||t.length<20){alert('请先打开岗位详情页，或选中岗位描述文字后再点击书签');return}var out='来源：'+u+'\\n\\n'+t.trim();navigator.clipboard.writeText(out).then(function(){alert('✅ 已复制 BOSS 岗位信息\\n请回到 JobAgent 粘贴并点「智能识别」')}).catch(function(){prompt('请手动复制以下内容到 JobAgent：',out)})}catch(e){alert('提取失败，请手动复制岗位描述')}})();`;

export function BossImportGuide({ onPasteDemo }: { onPasteDemo?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showBookmarklet, setShowBookmarklet] = useState(false);

  const copyBookmarklet = async () => {
    await navigator.clipboard.writeText(BOSS_BOOKMARKLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-lg bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">BOSS直聘</span>
        <h4 className="font-semibold text-slate-900">一键导入（无需爬虫）</h4>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        BOSS直聘有登录验证和反爬机制，无法自动爬取。推荐以下两种方式，30 秒完成导入：
      </p>

      <div className="space-y-4">
        {/* 方式 1：书签 */}
        <div className="rounded-lg bg-white p-4 border border-teal-100">
          <p className="mb-2 text-sm font-medium text-slate-800">方式 1：浏览器书签（推荐）</p>
          <ol className="mb-3 list-decimal space-y-1 pl-4 text-sm text-slate-600">
            <li>点击下方按钮复制书签代码</li>
            <li>浏览器新建书签，网址粘贴代码，名称填「导入 BOSS 岗位」</li>
            <li>在 BOSS直聘打开<strong>岗位详情页</strong></li>
            <li>点击书签 → 自动复制 → 回到 JobAgent 粘贴</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowBookmarklet(!showBookmarklet)}>
              <Bookmark className="h-4 w-4" />
              {showBookmarklet ? "隐藏" : "查看"}书签代码
            </Button>
            <Button size="sm" onClick={copyBookmarklet}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "已复制" : "复制书签代码"}
            </Button>
            <a
              href="https://www.zhipin.com/web/geek/recommend"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              打开 BOSS直聘 <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {showBookmarklet && (
            <pre className="mt-3 max-h-24 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-300">
              {BOSS_BOOKMARKLET.slice(0, 200)}...
            </pre>
          )}
        </div>

        {/* 方式 2：手动复制 */}
        <div className="rounded-lg bg-white p-4 border border-teal-100">
          <p className="mb-2 text-sm font-medium text-slate-800">方式 2：手动复制</p>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-600">
            <li>在 BOSS 岗位详情页，<strong>Ctrl+A 全选</strong> 或拖选岗位描述</li>
            <li>Ctrl+C 复制，粘贴到下方输入框</li>
            <li>点「智能识别」— 已针对 BOSS 格式优化</li>
          </ol>
          {onPasteDemo && (
            <button
              type="button"
              onClick={onPasteDemo}
              className="mt-2 text-sm text-teal-700 underline hover:text-teal-900"
            >
              填入 BOSS 格式示例
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const BOSS_DEMO_TEXT = `来源：https://www.zhipin.com/job_detail/xxx.html

高级前端工程师
20-35K·北京·3-5年·本科
字节跳动
职位描述
1. 负责核心业务前端开发与架构设计
2. 参与技术选型和代码评审

任职要求
1. 精通 React、TypeScript
2. 3年以上前端开发经验
3. 熟悉 Node.js 和工程化工具
4. 有大型项目经验者优先`;
