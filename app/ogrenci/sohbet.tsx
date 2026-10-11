"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send } from "lucide-react";

export function SohbetPaneli() {
  const chat = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const { messages, sendMessage, status, error } = chat;
  const isLoading = status === "submitted" || status === "streaming";
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState("");

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Sohbet</h2>
      <p className="mt-1 text-sm text-stone-600">Bu hafta kalan soru hakkı: henüz tanımlanmadı</p>
      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-stone-500">
            Bu haftanın metni hakkında soru sorabilirsiniz. Yanıtlar öğrenme ve revizyon içindir.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              message.role === "user" ? "ml-8 bg-stone-900 text-white" : "mr-8 bg-stone-100"
            }`}
          >
            <p className="mb-1 text-xs opacity-70">{message.role === "user" ? "Siz" : "Asistan"}</p>
            <p className="whitespace-pre-wrap">
              {message.parts
                ?.filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")}
            </p>
          </div>
        ))}
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Yanıt hazırlanıyor…
          </p>
        )}
      </div>
      {(sendError || error) && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {sendError || error?.message || "Soru gönderilemedi."}
        </p>
      )}
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={async (event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text || isLoading) return;
          setSendError("");
          try {
            await sendMessage({ text });
            setInput("");
          } catch (err) {
            setSendError(err instanceof Error ? err.message : "Soru gönderilemedi.");
          }
        }}
      >
        <label className="sr-only" htmlFor="soru">
          Sorunuz
        </label>
        <input
          id="soru"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-3 text-base"
          placeholder="Sorunuzu yazın"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-3 text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Gönder
        </button>
      </form>
    </section>
  );
}
