"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { generateAgentResponse, createChatMessage, QUICK_PROMPTS } from "@/lib/agent";
import {
  estimateContextChars,
  prepareContextForReply,
  getContextBarColor,
  COMPRESS_THRESHOLD,
} from "@/lib/context-manager";
import { Button, ProgressBar } from "./ui";

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-slate-900">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("• ") || line.startsWith("- ")) {
          return <p key={i} className="pl-2 text-slate-700">{line}</p>;
        }
        if (line.match(/^\d+\./)) {
          return <p key={i} className="pl-2 text-slate-700">{line}</p>;
        }
        if (line.startsWith("   ")) {
          return <p key={i} className="pl-4 text-slate-600">{line.trim()}</p>;
        }
        if (line.startsWith("💡")) {
          return <p key={i} className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-800">{line}</p>;
        }
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} className="text-slate-700">{line}</p>;
      })}
    </div>
  );
}

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
  const [loadingPercent, setLoadingPercent] = useState<number | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    if (!text.trim() || thinking) return;

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

  const displayPercent = loadingPercent ?? contextUsage.percent;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">职业顾问 Agent</h2>
            <p className="text-xs text-slate-500">帮你梳理经历、分析技能、匹配岗位（支持 DeepSeek）</p>
          </div>
        </div>
        {data.chatHistory.length > 1 && (
          <Button variant="ghost" size="sm" onClick={clearChat}>
            <Trash2 className="h-4 w-4" /> 清空对话
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
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
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <MessageContent content={msg.content} />
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

      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <input
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="描述你的经历、提问或粘贴 JD..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || thinking}
              className="rounded-xl px-5"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
