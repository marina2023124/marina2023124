"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Bot, User, Sparkles, Trash2, Paperclip, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { generateAgentResponse, createChatMessage, QUICK_PROMPTS } from "@/lib/agent";
import {
  estimateContextChars,
  prepareContextForReply,
  getContextBarColor,
  COMPRESS_THRESHOLD,
} from "@/lib/context-manager";
import { extractTextFromDocument } from "@/lib/document-extract";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Button, ProgressBar } from "./ui";

const RESUME_ACCEPT = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp";
const RESUME_TEXT_LIMIT = 12000;

function ContextChatStatus({
  percent,
  loading,
  note,
}: {
  percent: number;
  loading?: boolean;
  note?: string | null;
}) {
  const thresholdPercent = Math.round(COMPRESS_THRESHOLD * 100);

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <ProgressBar
          percent={percent}
          label={loading ? "正在加载上下文" : "上下文占用"}
          barClassName={getContextBarColor(percent)}
          animated={loading}
          hint={
            note ||
            (percent >= thresholdPercent
              ? `已达 ${thresholdPercent}%，已自动压缩历史以继续对话`
              : `超过 ${thresholdPercent}% 时将自动压缩历史`)
          }
        />
      </div>
    </div>
  );
}

export function AgentChat() {
  const { data, addChatMessage, replaceChatHistory, clearChat } = useApp();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingPercent, setLoadingPercent] = useState<number | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const contextUsage = useMemo(() => estimateContextChars(data), [data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.chatHistory, thinking, loadingPercent, statusNote]);

  useEffect(() => {
    if (data.chatHistory.length === 0) {
      const welcome = createChatMessage(
        "assistant",
        generateAgentResponse("你好", data)
      );
      addChatMessage(welcome);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = (text: string) => {
    if (!text.trim() || thinking || uploading) return;

    const userMsg = createChatMessage("user", text.trim());
    const historyWithUser = [...data.chatHistory, userMsg];
    replaceChatHistory(historyWithUser);
    setInput("");
    setThinking(true);
    setStatusNote(null);

    const startUsage = estimateContextChars({ ...data, chatHistory: historyWithUser }, text.trim());
    setLoadingPercent(startUsage.percent);

    setTimeout(async () => {
      const prepared = prepareContextForReply(
        { ...data, chatHistory: historyWithUser },
        text.trim()
      );

      if (prepared.compressed) {
        replaceChatHistory(prepared.data.chatHistory);
        setStatusNote(prepared.compressionNote ?? null);
      }

      setLoadingPercent(prepared.usage.percent);

      let response: string;
      try {
        const statusRes = await fetch("/api/llm/status");
        const status = (await statusRes.json()) as { configured: boolean };
        if (status.configured) {
          const chatRes = await fetch("/api/llm/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: prepared.data, message: text.trim() }),
          });
          const chatBody = (await chatRes.json()) as { ok?: boolean; content?: string; error?: string };
          if (chatRes.ok && chatBody.ok && chatBody.content) {
            response = chatBody.content;
          } else {
            response = generateAgentResponse(text.trim(), prepared.data);
          }
        } else {
          response = generateAgentResponse(text.trim(), prepared.data);
        }
      } catch {
        response = generateAgentResponse(text.trim(), prepared.data);
      }

      replaceChatHistory([
        ...prepared.data.chatHistory,
        createChatMessage("assistant", response),
      ]);
      setThinking(false);
      setLoadingPercent(null);
    }, 500);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const doc = await extractTextFromDocument(file);
      if (!doc.text.trim()) {
        alert("未能从文件中提取到文字，请尝试 PDF、Word 或更清晰的图片");
        return;
      }
      const truncated = doc.text.slice(0, RESUME_TEXT_LIMIT);
      const suffix =
        doc.text.length > RESUME_TEXT_LIMIT
          ? "\n\n（内容已截断，仅发送前 12000 字）"
          : "";
      const prefix = `【已上传简历：${doc.fileName}】\n\n`;
      const hint = "（在此补充说明，例如目标岗位、优化重点，然后点击发送）";
      setInput(`${prefix}${hint}\n\n---\n\n${truncated}${suffix}`);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(prefix.length, prefix.length + hint.length);
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "文件解析失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const displayPercent = loadingPercent ?? contextUsage.percent;
  const busy = thinking || uploading;

  return (
    <div className="flex h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] flex-col lg:h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">职业顾问 Agent</h2>
            <p className="hidden text-xs text-slate-500 sm:block">
              帮你梳理经历、分析技能、匹配岗位；支持上传简历优化（DeepSeek）
            </p>
          </div>
        </div>
        {data.chatHistory.length > 1 && (
          <Button variant="ghost" size="sm" onClick={clearChat}>
            <Trash2 className="h-4 w-4" /> 清空对话
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {data.chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  msg.role === "user"
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                }`}
              >
                {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 shadow-sm"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                ) : (
                  <MarkdownContent content={msg.content} />
                )}
              </div>
            </div>
          ))}

          <ContextChatStatus
            percent={displayPercent}
            loading={thinking}
            note={statusNote}
          />

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3 lg:px-6 lg:py-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={busy}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={RESUME_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="上传简历（PDF、Word、图片、TXT）"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </button>
            <textarea
              ref={inputRef}
              rows={3}
              className="max-h-48 min-h-[3rem] flex-1 resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="描述你的经历、提问或粘贴 JD..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              disabled={busy}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || busy}
              className="rounded-xl px-5"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            支持上传 PDF、Word、TXT、图片简历；上传后可在输入框补充说明再发送（Ctrl+Enter 快捷发送）
          </p>
        </div>
      </div>
    </div>
  );
}
