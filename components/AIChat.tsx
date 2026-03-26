"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";

export default function AIChat({ pack }: { pack: any }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!question.trim()) return;
    const q = question;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await apiPost<{ answer: string }>("/api/chat", {
        question: q,
        pack,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: e.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ns-ai-panel">
      <div className="ns-ai-head">
        <div>
          <div className="ns-ai-title">AI Copilot</div>
          <div className="ns-ai-sub">Ask about your financials</div>
        </div>
      </div>

      <div className="ns-ai-body">
        <div className="ai-chat-stack">
          {messages.map((m, i) => (
            <div key={i} className={`ai-bubble ${m.role === "user" ? "user" : "assistant"}`}>
              <div className="ai-bubble-head">
                <span>{m.role === "user" ? "Du" : "AI"}</span>
              </div>
              <div>{m.content}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ns-ai-input">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your financials..."
        />
        <button onClick={send} disabled={loading}>
          {loading ? "Skickar..." : "Send"}
        </button>
      </div>
    </div>
  );
}