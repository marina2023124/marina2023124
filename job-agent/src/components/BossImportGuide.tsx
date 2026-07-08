"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, GripVertical, ArrowRight } from "lucide-react";
import { Button } from "./ui";
import { BOSS_BOOKMARKLET } from "@/lib/boss-bookmarklet";

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-teal-100 bg-white p-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
        {step}
      </div>
      <div className="flex-1">
        <h5 className="mb-2 font-medium text-slate-900">{title}</h5>
        {children}
      </div>
    </div>
  );
}

export function BossImportGuide({ onPasteDemo }: { onPasteDemo?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const copyBookmarklet = async () => {
    await navigator.clipboard.writeText(BOSS_BOOKMARKLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50/50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-bold text-white">BOSS直聘</span>
        <h4 className="font-semibold text-slate-900">3 步导入岗位</h4>
      </div>

      {/* 流程预览 */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-4 py-3 text-sm text-slate-600">
        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-teal-800">拖书签</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-teal-800">BOSS 点一下</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-teal-800">回来粘贴</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
        <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-indigo-800">智能识别</span>
      </div>

      <div className="space-y-3">
        {/* 步骤 1：拖书签 */}
        <StepCard step={1} title="把下面按钮拖到浏览器书签栏">
          <p className="mb-3 text-sm text-slate-600">
            用鼠标<strong>按住</strong>绿色按钮，拖到 Edge 顶部的书签栏松手。
            看不到书签栏？按 <kbd className="rounded border bg-slate-100 px-1.5 py-0.5 text-xs">Ctrl+Shift+B</kbd> 显示。
          </p>

          {/* 可拖拽书签按钮 — 核心交互 */}
          <a
            href={BOSS_BOOKMARKLET}
            onClick={(e) => e.preventDefault()}
            draggable
            className="inline-flex cursor-grab items-center gap-2 rounded-xl border-2 border-dashed border-teal-400 bg-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-600 hover:shadow-lg active:cursor-grabbing"
            title="拖到书签栏"
          >
            <GripVertical className="h-5 w-5 opacity-80" />
            📥 导入 BOSS 岗位
          </a>

          <p className="mt-3 text-xs text-slate-500">
            拖不动？点右侧「备用：复制代码手动添加」
          </p>
        </StepCard>

        {/* 步骤 2 */}
        <StepCard step={2} title="在 BOSS 打开岗位，点一下书签">
          <p className="mb-3 text-sm text-slate-600">
            登录 BOSS直聘 → 打开<strong>某个岗位的详情页</strong>（不是列表页）
            → 点击书签栏里的「📥 导入 BOSS 岗位」→ 弹出「✅ 已复制（含薪资）」
          </p>
          <p className="mb-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            BOSS 页面上的薪资用了字体反爬，<strong>手动复制无法得到真实薪资</strong>。必须用书签从 BOSS 内部 API 获取明文薪资。
          </p>
          <a
            href="https://www.zhipin.com/web/geek/recommend"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            打开 BOSS直聘 <ExternalLink className="h-4 w-4" />
          </a>
        </StepCard>

        {/* 步骤 3 */}
        <StepCard step={3} title="回到这里粘贴，点「智能识别」">
          <p className="text-sm text-slate-600">
            在下方<strong>「粘贴岗位描述」</strong>输入框按 <kbd className="rounded border bg-slate-100 px-1.5 py-0.5 text-xs">Ctrl+V</kbd> 粘贴
            → 点页面上的<strong>「智能识别」</strong> → <strong>「确认添加」</strong>
          </p>
        </StepCard>
      </div>

      {/* 备用方案折叠 */}
      <div className="mt-4 border-t border-teal-200 pt-4">
        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          className="text-sm text-teal-700 hover:text-teal-900"
        >
          {showManual ? "▲ 收起备用方案" : "▼ 拖书签不方便？看备用方案"}
        </button>

        {showManual && (
          <div className="mt-3 space-y-3 rounded-lg bg-white p-4 border border-teal-100">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-800">备用 A：手动添加书签（Edge）</p>
              <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-600">
                <li>按 <kbd className="rounded border px-1 text-xs">Ctrl+Shift+O</kbd> 打开收藏夹</li>
                <li>右上角 ⋯ → 添加收藏夹</li>
                <li>名称填 <strong>导入 BOSS 岗位</strong></li>
                <li>网址点下面按钮复制后粘贴</li>
              </ol>
              <Button size="sm" variant="secondary" className="mt-2" onClick={copyBookmarklet}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "已复制代码" : "复制书签代码"}
              </Button>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-sm font-medium text-slate-800">备用 B：直接复制粘贴（无薪资）</p>
              <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-600">
                <li>仅当书签不可用时使用；手动复制<strong>无法获取薪资</strong>（BOSS 字体反爬）</li>
                <li>从<strong>「职位描述」</strong>拖到<strong>「工作地址」</strong>选中复制（不要 Ctrl+A 全页）</li>
                <li><kbd className="rounded border px-1 text-xs">Ctrl+C</kbd> 复制后粘贴，薪资需手动补充</li>
              </ol>
              {onPasteDemo && (
                <button
                  type="button"
                  onClick={onPasteDemo}
                  className="mt-2 text-sm text-teal-700 underline"
                >
                  试试示例文本
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const BOSS_DEMO_TEXT = `来源：https://www.zhipin.com/job_detail/xxx.html

岗位：商业分析师（双休）
薪资：11-20K·14薪
地点：北京
经验：1-3年
学历：本科
公司：数说故事

商业分析师（双休）
11-20K·14薪·北京·1-3年·本科
职位描述
8:30-9:30，17:30-18:30（弹性一个小时）
午休12:00-13:30
周末双休，法定节假日正常放假
岗位职责:
1、与客户沟通，了解并细化数据分析需求（社媒聆听、品牌声誉、消费者洞察等）
2、根据业务及行业背景，搭建研究框架，设计研究方案
3、运用内部大数据工具分析数据，评估营销效果，提供解决方案及建议
任职条件:
1、本科及以上学历，有咨询、广告公关或大型企业市场/用户研究背景
2、了解快消及零售行业，数据敏感度高
3、具备数据运营能力，熟练使用 Excel 或至少一种统计软件
4、能独立制作 PPT，逻辑/框架思维强，熟悉品牌营销指标
5、了解并能熟练使用 Agent、豆包或 DeepSeek 等 AI 工具提升效率
工作地址
北京朝阳区天元港中心B座708`;
