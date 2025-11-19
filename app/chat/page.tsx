"use client";

import { useState } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();
    const aiMessage = { role: "assistant", content: data.reply };

    setMessages((prev) => [...prev, aiMessage]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--background-soft)] via-white to-[var(--primary-soft)] px-4 py-6">
      <div className="max-w-4xl mx-auto flex flex-col h-[80vh] glass-panel rounded-3xl">
        <div className="border-b border-white/50 px-6 py-4">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Чат</h1>
          <p className="text-sm text-[var(--muted)]">Общайтесь в рамках рабочей переписки</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {messages.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">💬</div>
              <h3 className="empty-state-title">Сообщений пока нет</h3>
              <p className="empty-state-description">Напишите первое сообщение, чтобы начать диалог.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`p-3 rounded-2xl max-w-[75%] ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white self-end ml-auto shadow-lg"
                    : "bg-white/80 border border-[var(--border)] text-[var(--foreground)] self-start"
                }`}
              >
                {msg.content}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/40 bg-white/60 backdrop-blur-xl flex gap-3 rounded-b-3xl">
          <input
            className="flex-1 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напиши сообщение..."
          />
          <button
            onClick={sendMessage}
            className="btn-primary px-6"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
