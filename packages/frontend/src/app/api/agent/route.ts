import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, wallet } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const AGENT_URL = process.env.AGENT_API_URL || "http://localhost:3002/chat";

    // 🔗 Forward to Agent Backend
    const agentRes = await fetch(AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        message,
        sessionId: sessionId || null,
        wallet, // IMPORTANT — Pass wallet address to backend
      }),
    });

    if (!agentRes.ok) {
      const errorText = await agentRes.text();
      return NextResponse.json(
        {
          error: "Agent backend failed",
          details: errorText,
        },
        { status: 500 }
      );
    }

    const data = await agentRes.json();

    // Return everything the backend agent provided
    return NextResponse.json({
      success: true,
      reply: data.reply,
      sessionId: data.sessionId,
      history: data.history,
      unsignedTx: data.unsignedTx || null, // IMPORTANT: forward unsigned transaction
    });

  } catch (error: any) {
    console.error("Frontend API error:", error);

    return NextResponse.json(
      {
        error: "Failed to handle request",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
