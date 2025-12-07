import { AgentBuilder } from "@iqai/adk";
import express from "express";
import cors from "cors";
import { chatAgent } from "../src/agents/sub-agents/chat-agent/agent";

const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT;


// ------------------------------------------------
// Session Store
// ------------------------------------------------

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  history: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const sessions = new Map<string, ChatSession>();

function getSession(sessionId: string): ChatSession {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return sessions.get(sessionId)!;
}

let agentBuilder: any = null;

function log(emoji: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${emoji} [${timestamp}] ${message}`);
  if (data) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
}

const initializeAgent = async () => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`\n⏳ Initializing agent system (attempt ${attempt}/${maxAttempts})...\n`);

      agentBuilder = AgentBuilder
        .create('MetaVault-AI-chat-agent')
        .withAgent(chatAgent);

      console.log('✅ MetaVault-AI chat agent initialized successfully\n');
      return; // Success

    } catch (error: any) {
      console.error(`❌ Agent initialization failed (attempt ${attempt}/${maxAttempts}):`, error.message);

      if (attempt === maxAttempts) {
        console.error('❌ Failed to initialize agent after', maxAttempts, 'attempts');
        console.log('⚠️ Server will run with fallback responses only\n');
        agentBuilder = null;
        return; // Don't crash server
      }

      // Wait before retry
      const delay = 2000 * attempt;
      console.log(`⏳ Retrying in ${delay}ms...\n`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agent: agentBuilder ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
    sessions: sessions.size
  });
});


// ------------------------------------------------
// CHAT ENDPOINT (Main logic)
// ------------------------------------------------

app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId, wallet } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!wallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    const sid = sessionId || Date.now().toString();
    const session = getSession(sid);

    // Build conversation history
    const conversation = session.history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    // Inject wallet address (VERY IMPORTANT)
    const instruction = `WALLET: ${wallet}\n${conversation ? `${conversation}\nUSER: ${message}` : `USER: ${message}`
      }`;

    // Save user message
    session.history.push({ role: "user", content: message });
    session.updatedAt = new Date().toISOString();

    // Ask agent
    const reply = await agentBuilder.ask(instruction);

    // Save agent response
    session.history.push({ role: "assistant", content: reply });
    session.updatedAt = new Date().toISOString();

    // ------------------------------
    // Extract unsigned tx if present
    // ------------------------------
    let unsignedTx = null;

    let assistantReply = reply;

    let step = '';

    // Try to extract JSON from the LLM response
    const jsonMatch = reply.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Use structured reply if present
        if (parsed.reply) assistantReply = parsed.reply;

        if (parsed.unsignedTx) unsignedTx = parsed.unsignedTx;

        if(parsed.step) step = parsed.step;
      } catch (e) {
        console.log("Failed to parse JSON from agent:", e);
      }
    }

    return res.json({
      success: true,
      sessionId: sid,
      reply: assistantReply,
      history: session.history,
      unsignedTx, // send unsigned tx to UI
      step: step
    });

  } catch (err: any) {
    console.error("❌ Chat error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Agent error",
    });
  }
});


// ------------------------------------------------
// GET FULL SESSION HISTORY
// ------------------------------------------------

app.get("/session/:id", (req, res) => {
  const sid = req.params.id;

  if (!sessions.has(sid)) {
    return res.status(404).json({ error: "Session not found" });
  }

  return res.json({
    success: true,
    sessionId: sid,
    data: sessions.get(sid),
  });
});

// ------------------------------------------------
// RESET SESSION
// ------------------------------------------------

app.post("/session/reset/:id", (req, res) => {
  const sid = req.params.id;

  if (!sessions.has(sid)) {
    return res.status(404).json({ error: "Session not found" });
  }

  sessions.set(sid, {
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return res.json({
    success: true,
    sessionId: sid,
    message: "Session reset",
  });
});

// ------------------------------------------------
// START SERVER
// ------------------------------------------------

export async function startChatServer() {
  const PORT = process.env.CHAT_PORT || 8080;

  app.listen(PORT, async () => {
    console.log("\n=====================================");
    console.log("🚀 Vault ChatAgent Server Started");
    console.log("=====================================");
    console.log(`📡 Listening on http://localhost:${PORT}`);
    console.log(`⏰ ${new Date().toISOString()}`);
    console.log("=====================================\n");

    await initializeAgent();
  });
}
