'use client';

import { useState, useRef, useEffect } from 'react';
import { Bet } from './PayoutCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number;
  awayOdds: number;
}

interface BettingFormProps {
  onBetPlaced: (bet: Bet) => void;
  games: Game[];
}

export default function BettingForm({ onBetPlaced, games }: BettingFormProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userInput.trim()) {
      return;
    }

    // Add user message to conversation
    const newUserMessage: Message = {
      role: 'user',
      content: userInput.trim(),
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setUserInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/place-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      // Add assistant response to conversation
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If a bet was placed, add it to the bets list
      if (data.betPlaced) {
        // Parse the response to extract ALL bet details (could be multiple bets)
        // Split by "Bet Confirmed!" to handle multiple bets in one response
        const betConfirmations = data.response.split(/Bet Confirmed!/i).filter(s => s.trim().length > 0);

        betConfirmations.forEach((confirmation, index) => {
          const amountMatch = confirmation.match(/([\d.]+)\s*USDC bet on/i);
          const teamMatch = confirmation.match(/USDC bet on (.+?) to win/i);
          const matchupMatch = confirmation.match(/to win (.+?)\.\s*([\d.]+)/i);
          const profitMatch = confirmation.match(/([\d.]+)\s*USDC profit/i);
          const txIdMatch = confirmation.match(/Transaction ID:\s*([a-zA-Z0-9-]+)/i);

          if (amountMatch && teamMatch && matchupMatch && profitMatch && txIdMatch) {
            const amount = parseFloat(amountMatch[1]);
            const team = teamMatch[1];
            const matchup = matchupMatch[1];
            const profit = parseFloat(profitMatch[1]);
            const betTransactionId = txIdMatch[1];
            const totalPayout = amount + profit;

            // Parse matchup to get home and away teams (format: "Away @ Home")
            const matchupParts = matchup.split(' @ ');
            const awayTeam = matchupParts[0]?.trim();
            const homeTeam = matchupParts[1]?.trim();

            // Find the game in the games data to get odds
            const game = games.find(g => g.homeTeam === homeTeam && g.awayTeam === awayTeam);

            const newBet: Bet = {
              id: `bet-${Date.now()}-${index}`,
              amount,
              team,
              matchup,
              profit,
              totalPayout,
              betTransactionId,
              status: 'pending',
              timestamp: Date.now(),
              homeTeam: homeTeam || '',
              awayTeam: awayTeam || '',
              homeOdds: game?.homeOdds || 0,
              awayOdds: game?.awayOdds || 0,
            };

            onBetPlaced(newBet);
          }
        });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm">Tell me about the bets you'd like to place</p>
          </div>
        )}

        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !userInput.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
