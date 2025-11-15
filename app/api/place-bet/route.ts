import { NextResponse } from 'next/server';
import { MCPClientCredentials } from '@locus-technologies/langchain-mcp-m2m';
import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import fs from 'fs';
import path from 'path';

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number;
  awayOdds: number;
}

function calculatePayout(stake: number, odds: number): number {
  if (odds > 0) {
    // Positive odds: profit = (stake * odds) / 100
    return stake + (stake * odds) / 100;
  } else {
    // Negative odds: profit = (stake * 100) / abs(odds)
    return stake + (stake * 100) / Math.abs(odds);
  }
}

export async function POST(request: Request) {
  try {
    const { userInput } = await request.json();

    if (!userInput) {
      return NextResponse.json(
        { error: 'No input provided' },
        { status: 400 }
      );
    }

    // Read odds data
    const oddsPath = path.join(process.cwd(), 'odds.json');
    const oddsData: Game[] = JSON.parse(fs.readFileSync(oddsPath, 'utf8'));

    // Initialize MCP client with bettor credentials
    const client = new MCPClientCredentials({
      mcpServers: {
        'locus': {
          url: 'https://mcp.paywithlocus.com/mcp',
          auth: {
            clientId: process.env.BETTOR_CLIENT_ID!,
            clientSecret: process.env.BETTOR_CLIENT_SECRET!,
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

    // Create prompt for agent
    const availableGames = oddsData.map((game, idx) =>
      `${idx + 1}. ${game.awayTeam} @ ${game.homeTeam} - Away: ${game.awayOdds}, Home: ${game.homeOdds}`
    ).join('\n');

    const systemPrompt = `You are a betting agent. The user wants to place a bet.

Available games:
${availableGames}

Bettor wallet: ${process.env.BETTOR_WALLET_ADDRESS}
Sportsbook wallet: ${process.env.SPORTSBOOK_WALLET_ADDRESS}

Parse the user's input to determine:
1. The bet amount in USDC (look for dollar amounts, cents, or USDC amounts. If they say "5 cents" that's 0.05 USDC. If they say "$15" that's 15 USDC)
2. Which team they want to bet on
3. Find the corresponding odds

Then:
1. Transfer the EXACT bet amount from the bettor wallet to the sportsbook wallet using the available MCP tools
2. Calculate the profit if the bet wins (not including the original stake)

After completing the transfer, respond in EXACTLY this format (no emojis, no extra text):
Bet Confirmed! [amount] USDC bet on [team] to win [matchup]. [profit] profit if bet hits.
Transaction ID: [transaction id]

Example:
Bet Confirmed! 0.15 USDC bet on New York Giants to win Green Bay Packers @ New York Giants. 0.48 USDC profit if bet hits.
Transaction ID: abc123

User input: "${userInput}"`;

    // Run agent
    const result = await agent.invoke({
      messages: [{ role: 'user', content: systemPrompt }],
    });

    // Extract the final message from agent
    const finalMessage = result.messages[result.messages.length - 1];
    const agentResponse = finalMessage.content;

    // Try to extract bet amount from response
    const amountMatch = agentResponse.match(/(\d+\.?\d*)\s*USDC/i);
    const betAmount = amountMatch ? parseFloat(amountMatch[1]) : null;

    return NextResponse.json({
      success: true,
      response: agentResponse,
      betAmount: betAmount,
    });

  } catch (error) {
    console.error('Error placing bet:', error);
    return NextResponse.json(
      { error: 'Failed to place bet. Please try again.' },
      { status: 500 }
    );
  }
}
