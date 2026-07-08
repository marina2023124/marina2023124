"use client";

import { useCallback, useRef, useState } from "react";
import {
  Sparkles,
  FileUp,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  extractTextFromDocument,
  getAcceptedDocumentExtensions,
} from "@/lib/document-extract";
import {
  parseProjectsFromExcelRows,
  parseResumeText,
  summarizeParsedProfile,
  type ParsedProfileDraft,
} from "@/lib/resume-parser";
import { mergeParsedProfile } from "@/lib/profile-merge";
import { Button, Textarea, Badge } from "./ui";

export const RESUME_DEMO_TEXT = `张三
电话：13800138000  邮箱：zhangsan@example.com

自我评价
5年数据分析经验，熟悉用户研究与商业分析，擅长 Excel/SQL 与可视化汇报。

工作经历
2021.03 - 至今  数说故事  商业分析师
- 负责社媒聆听与品牌声誉分析，输出行业洞察报告
- 搭建研究框架，支持产品与市场决策
- 运用内部大数据工具评估营销效果

2019.07 - 2021.02  某咨询公司  研究顾问
- 完成快消行业竞品与用户研究项目
- 独立撰写 PPT 并向客户汇报

项目经验
用户洞察分析平台
- 搭建自动化分析流程，报告产出效率提升 40%
- 技术栈：Python, SQL, Excel, Tableau

教育背景
2015.09 - 2019.06  对外经济贸易大学  本科  统计学

专业技能
Excel, SQL, Python, PPT, 数据分析, 用户研究, Tableau`;

function PreviewSummary({ draft }: { draft: ParsedProfileDraft }) {
  return (
    <div className="space-y-3 text-sm">
      {(draft.name || draft.email || draft.phone) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
          {draft.name && <span><span className="text-slate-500">姓名：</span>{draft.name}</span>}
          {draft.email && <span><span className="text-slate-500">邮箱：</span>{draft.email}</span>}
          {draft.phone && <span><span className="text-slate-500">电话：</span>{draft.phone}</span>}
        </div>
      )}
      {draft.summary && (
        <p className="text-slate-600"><span className="font-medium text-slate-700">摘要：</span>{draft.summary.slice(0, 120)}{draft.summary.length > 120 ? "…" : ""}</p>
      )}
      {draft.workExperiences.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-slate-700">工作经历（{draft.workExperiences.length}）</p>
          <ul className="space-y-1 text-slate-600">
            {draft.workExperiences.slice(0, 3).map((w) => (
              <li key={w.id}>{w.company} · {w.title}</li>
            ))}
          </ul>
        </div>
      )}
      {draft.projects.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-slate-700">项目（{draft.projects.length}）</p>
          <ul className="space-y-1 text-slate-600">
            {draft.projects.slice(0, 3).map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}
      {draft.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {draft.skills.slice(0, 12).map((s) => (
            <Badge key={s.id} color="indigo">{s.name}</Badge>
          ))}
          {draft.skills.length > 12 && <Badge>+{draft.skills.length - 12}</Badge>}
        </div>
      )}
    </div>
  );
}

export function SmartExperienceImport() {
  const { data, setProfile } = useApp();
  const [rawInput, setRawInput] = useState("");
  const [preview, setPreview] = useState<ParsedProfileDraft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const runParse = useCallback((text: string, excelRows?: Record<string, string>[]) => {
    const parsed = parseResumeText(text);
    if (excelRows?.length) {
      const fromExcel = parseProjectsFromExcelRows(excelRows);
      if (fromExcel.length) {
        parsed.projects = [...parsed.projects, ...fromExcel];
      }
    }
    setPreview(parsed);
    setShowDetails(true);
  }, []);

  const handleSmartParse = () => {
    if (!rawInput.trim()) return;
    setParsing(true);
    try {
      runParse(rawInput);
    } finally {
      setParsing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setParsing(true);
    setProgress(`正在解析 ${file.name}…`);
    try {
      const extracted = await extractTextFromDocument(file);
      if (!extracted.text.trim() && !extracted.excelRows?.length) {
        alert("未能从文件中提取到文字，请尝试其他格式或直接粘贴文本");
        return;
      }
      setRawInput(extracted.text);
      runParse(extracted.text, extracted.excelRows);
      setProgress(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "文件解析失败");
    } finally {
      setParsing(false);
      setProgress(null);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    const merged = mergeParsedProfile(preview, data.profile);
    setProfile(merged);
    setPreview(null);
    setRawInput("");
    setShowDetails(false);
    alert("已合并到「我的经历」，可在下方继续微调");
  };

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white p-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">智能导入经历</h3>
            <p className="text-sm text-slate-500">
              粘贴简历文字，或上传 PDF / Word / Excel / 图片，自动识别工作经历、项目与技能
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
      </button>

      {expanded && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-indigo-100 bg-white/80 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">支持格式</p>
            <p className="mt-1">PDF、Word（.docx）、Excel（.xlsx/.xls/.csv）、图片（OCR）、纯文本</p>
            <p className="mt-1">Excel 项目列表：表头含「项目名称 / 描述 / 技术栈 / 亮点」等列时识别更准确</p>
            <button
              type="button"
              className="mt-2 text-indigo-600 hover:underline"
              onClick={() => setRawInput(RESUME_DEMO_TEXT)}
            >
              填入示例简历
            </button>
          </div>

          <Textarea
            label="粘贴简历 / 经历文本"
            rows={7}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={"粘贴整份简历，或某段经历文字。\n\n支持识别：\n· 基本信息（姓名、邮箱、电话）\n· 工作经历 / 项目经验 / 教育背景\n· 专业技能"}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">或上传文件</label>
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-6 transition-colors hover:border-indigo-400 hover:bg-indigo-50/30"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
            >
              <FileUp className="mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-600">点击或拖拽上传 PDF / Word / Excel / 图片</p>
              {progress && (
                <p className="mt-2 flex items-center gap-2 text-sm text-indigo-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> {progress}
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={getAcceptedDocumentExtensions()}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          </div>

          <Button onClick={handleSmartParse} disabled={!rawInput.trim() || parsing} className="w-full">
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 识别中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> 智能识别
              </>
            )}
          </Button>

          {preview && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-emerald-900">识别结果</h4>
                  <p className="text-sm text-emerald-700">{summarizeParsedProfile(preview)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  {showDetails ? "收起" : "展开详情"}
                </button>
              </div>

              {showDetails && <PreviewSummary draft={preview} />}

              <div className="mt-4 flex gap-2">
                <Button onClick={handleApply}>
                  <Check className="h-4 w-4" /> 合并到我的经历
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>取消</Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                合并时会保留已有内容，仅追加不重复的工作/项目/技能条目
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
