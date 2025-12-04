import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

  // TODO: Integrate with actual agent backend
  // For now, return a mock response
  // In production, this should call your agent service
  
  // Example: Call your agent API endpoint
  // const agentResponse = await fetch(`${process.env.AGENT_API_URL}/ask`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ input: message }),
  // });
  // const data = await agentResponse.json();

  // Mock response for now
  const mockResponse = `I understand you're asking: "${message}". 

I'm the Strategy Sentinel Agent, and I can help you:
- Monitor vault and strategy health
- Check liquidation risks
- Trigger rebalancing operations
- Harvest yields from strategies
- Analyze portfolio allocations

To integrate me fully, connect this frontend to your agent backend service running on the agents package.`;

  return NextResponse.json({ response: mockResponse });
} catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}



