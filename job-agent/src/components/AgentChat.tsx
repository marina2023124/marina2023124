"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { generateAgentResponse, createChatMessage, QUICK_PROMPTS } from "@/lib/agent";
import { Button } from "./ui";

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

export function AgentChat() {
  const { data, addChatMessage, clearChat } = useApp();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.chatHistory, thinking]);

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
    addChatMessage(userMsg);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      const response = generateAgentResponse(text.trim(), {
        ...data,
        chatHistory: [...data.chatHistory, userMsg],
      });
      addChatMessage(createChatMessage("assistant", response));
      setThinking(false);
    }, 600 + Math.random() * 400);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">职业顾问 Agent</h2>
            <p className="text-xs text-slate-500">帮你梳理经历、分析技能、匹配岗位</p>
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

          {thinking && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
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
