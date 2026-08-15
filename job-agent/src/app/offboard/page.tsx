"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eraser,
  FolderSearch,
  ListChecks,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Card, Button, Badge } from "@/components/ui";
import {
  ACCOUNT_CHECKLIST,
  BROWSER_WIPE_SNIPPET,
  DO_NOT_TAKE_LIST,
  MAC_SCAN_COMMAND,
  WORK_COMPUTER_CLEAN_LIST,
  buildPersonalCareerBackup,
  inventoryCareerAssets,
  type OffboardBucket,
  type OffboardFinding,
} from "@/lib/offboard";
import {
  listBrowserResidue,
  wipeAllBrowserResidue,
  type BrowserResidueItem,
} from "@/lib/local-storage";

const BUCKET_META: Record<
  OffboardBucket,
  { label: string; color: "green" | "amber" | "red"; hint: string }
> = {
  backup: { label: "带走备份", color: "green", hint: "个人求职资产，存到手机或个人网盘" },
  clean: { label: "工作电脑清干净", color: "amber", hint: "归还设备前删除残留" },
  "do-not-take": { label: "不要带走", color: "red", hint: "公司材料，只改写成履历表述" },
};

function FindingList({ items }: { items: OffboardFinding[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">这一类目前没有发现需要处理的条目。</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{item.title}</p>
            {typeof item.count === "number" && (
              <Badge color="indigo">{item.count} 项</Badge>
            )}
            {item.risk === "high" && <Badge color="red">高风险</Badge>}
            {item.risk === "medium" && <Badge color="amber">需核对</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
          {item.samples && item.samples.length > 0 && (
            <p className="mt-1 truncate text-xs text-slate-400">{item.samples.join(" · ")}</p>
          )}
          {item.action && <p className="mt-1 text-xs font-medium text-indigo-600">{item.action}</p>}
        </li>
      ))}
    </ul>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "空";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function OffboardPage() {
  const { data, exportData, signOut, user, localMode, guestMode } = useApp();
  const [residue, setResidue] = useState<BrowserResidueItem[] | null>(null);
  const [copied, setCopied] = useState<"scan" | "wipe" | null>(null);
  const [wiped, setWiped] = useState(false);
  const [backupWarnings, setBackupWarnings] = useState<string[]>([]);

  const findings = useMemo(() => inventoryCareerAssets(data), [data]);
  const backupItems = findings.filter((item) => item.bucket === "backup");
  const doNotTakeItems = [...findings.filter((item) => item.bucket === "do-not-take"), ...DO_NOT_TAKE_LIST];
  const presentResidue = (residue ?? []).filter((item) => item.present);

  const scanBrowser = () => {
    setResidue(listBrowserResidue());
    setWiped(false);
  };

  const copyText = async (value: string, which: "scan" | "wipe") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const downloadPersonalBackup = () => {
    const result = buildPersonalCareerBackup(data);
    setBackupWarnings(result.warnings);
    const blob = new Blob([JSON.stringify(result.payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const wipeThisBrowser = () => {
    const ok = window.confirm(
      "将清除这台电脑浏览器里的 JobAgent 缓存和登录 Cookie。\n云端账号数据不会删除。\n请确认个人备份已经拷到手机或网盘，而不是留在这台工作电脑。"
    );
    if (!ok) return;
    wipeAllBrowserResidue();
    setWiped(true);
    setResidue(listBrowserResidue());
  };

  const wipeAndSignOut = async () => {
    const ok = window.confirm("将清除本机残留并退出登录。云端数据仍在。确定？");
    if (!ok) return;
    wipeAllBrowserResidue();
    setWiped(true);
    await signOut();
    window.location.href = "/login";
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <p className="text-xs font-medium text-indigo-600">版本 0.2.78 · 离职数据管家</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">离职备份与清理</h1>
        <p className="mt-1 text-slate-500">
          先把个人求职档案拷到自己的设备，再把工作电脑上的密钥、缓存和公司材料清干净。
          不要带走周报原文、内部文档或公司账号。
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {user?.email ? `当前云端账号：${user.email}` : guestMode ? "当前是访客模式" : localMode ? "当前是离线模式（数据在这台浏览器）" : "未登录"}
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(Object.keys(BUCKET_META) as OffboardBucket[]).map((bucket) => {
          const meta = BUCKET_META[bucket];
          const count =
            bucket === "backup"
              ? backupItems.length
              : bucket === "clean"
                ? WORK_COMPUTER_CLEAN_LIST.length + presentResidue.length
                : doNotTakeItems.length;
          return (
            <Card key={bucket} className="!p-4">
              <Badge color={meta.color}>{meta.label}</Badge>
              <p className="mt-2 text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-500">{meta.hint}</p>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={downloadPersonalBackup}>
          <Download className="h-4 w-4" />
          下载个人求职备份
        </Button>
        <Button variant="secondary" onClick={exportData}>
          <Download className="h-4 w-4" />
          下载完整备份（含对话，慎用）
        </Button>
        <Button variant="secondary" onClick={scanBrowser}>
          <FolderSearch className="h-4 w-4" />
          扫描这台浏览器
        </Button>
        <Button variant="danger" onClick={wipeThisBrowser}>
          <Eraser className="h-4 w-4" />
          清除本机浏览器残留
        </Button>
      </div>

      {backupWarnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">备份时已自动处理</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {backupWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">把文件立刻传到手机/个人网盘，然后从这台工作电脑的「下载」里删掉。</p>
        </div>
      )}

      {wiped && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          本机浏览器 JobAgent 残留已清除。云端数据仍在。建议再点「退出并清除」。
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="1. 云端个人材料（建议备份）">
          <FindingList items={backupItems} />
        </Card>

        <Card title="2. 不要整份带走">
          <FindingList items={doNotTakeItems} />
        </Card>

        <Card
          title="3. 这台浏览器残留"
          action={
            <Button variant="ghost" size="sm" onClick={scanBrowser}>
              重新扫描
            </Button>
          }
        >
          {residue == null ? (
            <p className="text-sm text-slate-500">点「扫描这台浏览器」，查看 localStorage / Cookie 是否还留着求职资料。</p>
          ) : presentResidue.length === 0 ? (
            <p className="text-sm text-emerald-700">未发现 JobAgent 本机资料。可以再退出登录。</p>
          ) : (
            <ul className="space-y-2">
              {presentResidue.map((item) => (
                <li
                  key={`${item.location}-${item.key}`}
                  className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-slate-700">
                    {item.location} · {item.key}
                  </span>
                  <span className="text-xs text-amber-800">{formatBytes(item.bytes)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={wipeAndSignOut}>
              <Trash2 className="h-4 w-4" />
              退出并清除本机
            </Button>
          </div>
        </Card>

        <Card title="4. 工作电脑还要清的位置">
          <FindingList items={WORK_COMPUTER_CLEAN_LIST} />
        </Card>
      </div>

      <Card className="mt-6" title="5. 在 Mac 终端扫描工作电脑（只读）">
        <p className="text-sm text-slate-600">
          这台云端环境看不到你的 Mac。把下面命令在工作电脑终端运行，会列出密钥文件、备份 JSON、周报/简历文件名，
          <span className="font-medium">不会打印密钥内容，也不会擅自删除</span>。
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">{MAC_SCAN_COMMAND}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void copyText(MAC_SCAN_COMMAND, "scan")}>
            <Copy className="h-4 w-4" />
            {copied === "scan" ? "已复制" : "复制扫描命令"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void copyText(BROWSER_WIPE_SNIPPET, "wipe")}>
            <Copy className="h-4 w-4" />
            {copied === "wipe" ? "已复制" : "复制浏览器清理片段"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          确认个人备份已离开工作电脑后，可再运行 <code className="rounded bg-slate-100 px-1">bash scan-leave.sh --clean-job-agent</code>，
          仅删除 JobAgent 的 <code className="rounded bg-slate-100 px-1">.env.local</code> 及其备份。周报和公司文件只列出，不会自动删。
        </p>
      </Card>

      <Card className="mt-6" title="6. 账号清单">
        <ul className="space-y-3">
          {ACCOUNT_CHECKLIST.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              {item.keep ? (
                <ListChecks className="mt-0.5 h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {item.title}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {item.keep ? "个人账号：工作电脑退出即可" : "公司账号：按 IT 交还"}
                  </span>
                </p>
                <p className="text-sm text-slate-600">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        <p>
          个人履历可以带走；公司周报、源代码、未公开数据和公司密钥不能带走。
          还没完善经历时，先去{" "}
          <Link href="/experience" className="font-medium text-indigo-600 hover:underline">
            我的经历
          </Link>{" "}
          确认云端档案是最新的，再备份。
        </p>
      </div>
    </div>
  );
}
