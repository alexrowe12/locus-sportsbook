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
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
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

    const systemPrompt = `You are a conversational betting agent helping users place sports bets. Be friendly, concise, and helpful.

Available games:
${availableGames}

Bettor wallet: ${process.env.BETTOR_WALLET_ADDRESS}
Sportsbook wallet: ${process.env.SPORTSBOOK_WALLET_ADDRESS}

CONVERSATION GUIDELINES:
- The user may provide vague betting intentions (e.g., "I want a risky bet" or "I don't believe in the Giants")
- Ask clarifying questions to gather: which specific game, which team, and how much to bet
- Be conversational and help guide them to a decision
- If they mention wanting a "risky" bet, suggest underdogs with positive odds
- If they mention not believing in a team, confirm they want to bet against that team
- Keep responses concise and natural
- NEVER use markdown formatting (**, __, etc.) in your responses
- NEVER use emojis in your responses
- Write in plain text only

BETTING RULES:
- Bet amounts should be in USDC (e.g., "$5" = 5 USDC, "50 cents" = 0.50 USDC)
- Only place the bet when you have ALL three pieces of information:
  1. The specific game (e.g., "Patriots @ Giants")
  2. The team they want to bet on
  3. The bet amount in USDC
- IMPORTANT: Only execute the transfer tool AFTER the user explicitly confirms the bet (e.g., "yes", "do it", "place it", "sounds good", "let's do it")

WHEN PLACING A BET:
Once you have all information AND user confirmation:
1. Transfer the EXACT bet amount from bettor wallet to sportsbook wallet
2. Calculate the profit if the bet wins (not including the original stake)
3. You MUST respond in EXACTLY this format (no markdown, no emojis, no variations):

Bet Confirmed! [amount] USDC bet on [team] to win [matchup]. [profit] USDC profit if bet hits.
Transaction ID: [transaction id]

Example confirmation message:
Bet Confirmed! 5 USDC bet on New York Giants to win Green Bay Packers @ New York Giants. 8.50 USDC profit if bet hits.
Transaction ID: abc123

CRITICAL: When confirming a bet, you must start your response with "Bet Confirmed!" exactly as shown. Do not use any other format or add any extra text before it.

Remember: Be conversational and helpful. Don't place the bet until you have all info AND clear confirmation from the user.`;

    // Build messages array for agent
    const agentMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // Run agent
    const result = await agent.invoke({
      messages: agentMessages,
    });

    // Extract the final message from agent
    const finalMessage = result.messages[result.messages.length - 1];
    const agentResponse = finalMessage.content;

    // Check if a bet was placed (contains "Bet Confirmed" and transaction ID)
    const betPlaced = agentResponse.includes('Bet Confirmed!') && agentResponse.includes('Transaction ID:');

    // Try to extract bet amount from response if bet was placed
    let betAmount = null;
    if (betPlaced) {
      const amountMatch = agentResponse.match(/(\d+\.?\d*)\s*USDC/i);
      betAmount = amountMatch ? parseFloat(amountMatch[1]) : null;
    }

    return NextResponse.json({
      success: true,
      response: agentResponse,
      betPlaced: betPlaced,
      betAmount: betAmount,
    });

  } catch (error) {
    console.error('Error in betting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to process request. Please try again.' },
      { status: 500 }
    );
  }
}
