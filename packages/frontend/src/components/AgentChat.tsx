"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { Send, Bot, User, Sparkles, ArrowUp } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AgentChat() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your DeFi Vault Assistant. I can help you check your balance, deposit LINK tokens, withdraw shares, and view public vault information.\n\nHow can I assist you today?",
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!address) {
      alert("Please connect your wallet first.");
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const userInputBackup = input;
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInputBackup,
          sessionId,
          wallet: address,
        }),
      });

      const data = await response.json();

      if (data.sessionId) setSessionId(data.sessionId);

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.unsignedTx && walletClient ) {
        console.log("Unsigned TX received from agent:", data.unsignedTx);
        let txHash = await walletClient.sendTransaction(data.unsignedTx);
        
        const followup = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Transaction Signed !",
            sessionId,
            wallet: address
          }),
        });
    
        const followData = await followup.json();
    
        // Render the agent's deposit message
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: followData.reply,
            timestamp: new Date(),
          }
        ]);
    
        // If this follow-up ALSO returns a tx → send deposit transaction
        if (followData.unsignedTx) {
          txHash = await walletClient.sendTransaction(followData.unsignedTx);
    
          setMessages(prev => [
            ...prev,
            {
              role: "assistant",
              content: `💰 Deposit transaction sent!\n\n**Tx Hash:** ${txHash}`,
              timestamp: new Date(),
            }
          ]);
        }

        const txMessage: Message = {
          role: "assistant",
          content: `🚀 Transaction submitted!\n\n**Tx Hash:** ${txHash}\n\nYou can track it on the block explorer.`,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, txMessage]);
      }
    } catch (err) {
      console.error(err);
      const errorMessage: Message = {
        role: "assistant",
        content: "⚠️ Something went wrong. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in duration-700">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-medium text-white">Welcome to Strategy Agent</h2>
          <p className="text-gray-400 max-w-md">
            Connect your wallet to start chatting.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#0A0A12] text-gray-100 font-sans">
      {/* Header - Minimal */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0A0A12]/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-200">Strategy Agent 1.0</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Add any header actions here if needed */}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-8">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-green-400" />
                </div>
              )}

              <div className={`flex flex-col max-w-[85%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${message.role === "user"
                  ? "bg-[#2A2A35] text-white rounded-br-sm"
                  : "bg-transparent text-gray-100 px-0"
                  }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>

              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-[#2A2A35] flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 animate-in fade-in duration-300">
              <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex items-center gap-1.5 h-8">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Input Area - Fixed Bottom */}
      <div className="p-4 md:p-6 bg-[#0A0A12]">
        <div className="max-w-3xl mx-auto relative">
          <div className="relative flex items-center bg-[#1A1A20] border border-white/10 rounded-xl shadow-lg focus-within:border-gray-500/50 transition-colors overflow-hidden">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message Strategy Agent..."
              disabled={isLoading}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 px-4 py-4 h-[52px]"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2 bg-white text-black rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-white transition-all"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-600 mt-2">
            AI can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}
