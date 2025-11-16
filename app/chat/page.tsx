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
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-2xl max-w-[75%] ${
              msg.role === "user"
                ? "bg-indigo-600 text-white self-end ml-auto"
                : "bg-gray-200 text-gray-900 self-start"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div className="p-4 border-t bg-white flex gap-2">
        <input
          className="flex-1 border rounded-xl px-4 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напиши сообщение..."
        />
        <button
          onClick={sendMessage}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
