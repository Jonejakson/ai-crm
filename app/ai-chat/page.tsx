"use client"

import { useState } from "react"

export default function AIChatPage() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState("")

  const sendMessage = async () => {
    if (!input.trim()) return

    const newMessages = [...messages, { role: "user", content: input }]
    setMessages(newMessages)
    setInput("")

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    })

    const data = await res.json()
    setMessages([...newMessages, { role: "assistant", content: data.reply }])
  }

  return (
    <div className="flex flex-col h-[80vh] p-6 bg-gray-50 rounded-lg shadow-inner">
      <div className="flex-1 overflow-y-auto mb-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg max-w-[70%] ${
              m.role === "user"
                ? "bg-blue-500 text-white self-end ml-auto"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Введите сообщение..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Отправить
        </button>
      </div>
    </div>
  )
}
