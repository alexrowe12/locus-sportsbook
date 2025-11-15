import { NextResponse } from 'next/server';
import { MCPClientCredentials } from '@locus-technologies/langchain-mcp-m2m';
import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

export async function POST(request: Request) {
  try {
    const { betId, payoutAmount, team, matchup } = await request.json();

    if (!betId || !payoutAmount || !team || !matchup) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize MCP client with SPORTSBOOK credentials
    const client = new MCPClientCredentials({
      mcpServers: {
        'locus': {
          url: 'https://mcp.paywithlocus.com/mcp',
          auth: {
            clientId: process.env.SPORTSBOOK_AGENT_CLIENT_ID!,
            clientSecret: process.env.SPORTSBOOK_CLIENT_SECRET!,
          },
        },
      },
    });

    await client.initializeConnections();
    const tools = await client.getTools();

    // Create Claude agent
    const llm = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const agent = createReactAgent({ llm, tools });

    // Create prompt for agent to execute payout
    const systemPrompt = `You are a sportsbook payout agent. A bettor has won their bet and needs to be paid out.

Payout Details:
- From: ${process.env.SPORTSBOOK_WALLET_ADDRESS} (sportsbook wallet)
- To: ${process.env.BETTOR_WALLET_ADDRESS} (bettor wallet)
- Amount: ${payoutAmount} USDC
- Winning bet: ${team} in ${matchup}

Use the MCP tools to transfer exactly ${payoutAmount} USDC from the sportsbook wallet to the bettor wallet.

After completing the transfer, respond in EXACTLY this format:
Payout complete! ${payoutAmount} USDC sent to bettor.
Transaction ID: [transaction id]`;

    // Run agent
    const result = await agent.invoke({
      messages: [{ role: 'user', content: systemPrompt }],
    });

    // Extract the final message from agent
    const finalMessage = result.messages[result.messages.length - 1];
    const agentResponse = finalMessage.content;

    // Extract transaction ID from response
    const txIdMatch = agentResponse.match(/Transaction ID:\s*([a-zA-Z0-9-]+)/i);
    const transactionId = txIdMatch ? txIdMatch[1] : null;

    return NextResponse.json({
      success: true,
      response: agentResponse,
      transactionId,
      payoutAmount,
    });

  } catch (error) {
    console.error('Error processing payout:', error);
    return NextResponse.json(
      {
        error: 'Failed to process payout. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
