"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { Send, Bot, User, Sparkles, ArrowUp } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AgentChat() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // -----------------------------
  // ❗ ALL HOOKS MUST BE HERE
  // -----------------------------
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your MetaVault Assistant. I can help you check your balance, deposit LINK tokens, withdraw shares, and view public vault information.\n\nHow can I assist you today?",
      timestamp: new Date(),
    },
  ]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // -----------------------------
  // ❗ CONDITIONAL UI AFTER HOOKS
  // -----------------------------
  if (!publicClient) {
    return (
      <div className="text-center text-red-400 p-6">
        Public client is not ready. Please refresh.
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in duration-700">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-medium text-white">Welcome to MetaVault AI Assistant</h2>
          <p className="text-gray-400 max-w-md">Connect your wallet to start chatting.</p>
        </div>
      </div>
    );
  }

  // -----------------------------
  // SEND MESSAGE HANDLER
  // -----------------------------
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput("");

    // Add user message instantly
    const userMessage: Message = {
      role: "user",
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    if (!address) {
      alert("Please connect your wallet first.");
      return;
    }

    setIsLoading(true);

    try {
      // -----------------------------
      // 1️⃣ SEND TO BACKEND AGENT
      // -----------------------------
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          sessionId,
          wallet: address,
        }),
      });

      const data = await res.json();

      if (data.sessionId) setSessionId(data.sessionId);

      // Show assistant reply
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        },
      ]);

      // -----------------------------
      // 2️⃣ HANDLE UNSIGNED TRANSACTION
      // -----------------------------
      if (data.unsignedTx && walletClient) {
        console.log("Unsigned TX received:", data.unsignedTx);

        // Broadcast TX
        const txHash = await walletClient.sendTransaction(data.unsignedTx);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status !== "success") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ Transaction failed.\n\nHash: ${txHash}`,
              timestamp: new Date(),
            },
          ]);
          return;
        }

        // Inform backend agent that TX succeeded
        const followUp = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Transaction Confirmed",
            sessionId,
            wallet: address,
          }),
        });

        const followData = await followUp.json();

        // Display follow-up assistant message
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: followData.reply,
            timestamp: new Date(),
          },
        ]);

        // -----------------------------
        // 3️⃣ HANDLE SECOND TRANSACTION
        // -----------------------------
        if (followData.unsignedTx) {
          const txHash2 = await walletClient.sendTransaction(followData.unsignedTx);

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `💰 Second transaction sent!\n\nTx Hash: ${txHash2}`,
              timestamp: new Date(),
            },
          ]);
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Something went wrong. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#0A0A12] text-gray-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0A0A12]/50 backdrop-blur-md sticky top-0 z-10">
        <span className="text-sm font-medium text-gray-200">MetaVault AI Assistant</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom duration-300`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-green-400" />
                </div>
              )}

              <div className="max-w-[85%]">
                <div className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#2A2A35] text-white rounded-br-sm"
                    : "bg-transparent text-gray-100 px-0"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-[#2A2A35] flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex items-center gap-1.5 h-8">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 bg-[#0A0A12]">
        <div className="max-w-3xl mx-auto relative">
          <div className="flex items-center bg-[#1A1A20] border border-white/10 rounded-xl overflow-hidden">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message MetaVault Agent..."
              disabled={isLoading}
              className="flex-1 bg-transparent outline-none text-white px-4 py-4"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="p-2 bg-white text-black rounded-lg m-2 disabled:opacity-40"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
