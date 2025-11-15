'use client';

import { useState } from 'react';
import PayoutCard, { Bet } from './PayoutCard';

export default function BettingForm() {
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userInput.trim()) {
      setError('Please enter your bet details');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/place-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to place bet');
      }

      setResponse(data.response);

      // Parse the response to extract bet details
      // Expected format: "Bet Confirmed! [amount] USDC bet on [team] to win [matchup]. [profit] profit if bet hits.\nTransaction ID: [id]"
      const amountMatch = data.response.match(/Bet Confirmed! ([\d.]+) USDC/);
      const teamMatch = data.response.match(/USDC bet on (.+?) to win/);
      const matchupMatch = data.response.match(/to win (.+?)\./);
      const profitMatch = data.response.match(/([\d.]+) USDC profit/);
      const txIdMatch = data.response.match(/Transaction ID:\s*([a-zA-Z0-9-]+)/);

      if (amountMatch && teamMatch && matchupMatch && profitMatch && txIdMatch) {
        const amount = parseFloat(amountMatch[1]);
        const team = teamMatch[1];
        const matchup = matchupMatch[1];
        const profit = parseFloat(profitMatch[1]);
        const betTransactionId = txIdMatch[1];
        const totalPayout = amount + profit;

        const newBet: Bet = {
          id: `bet-${Date.now()}`,
          amount,
          team,
          matchup,
          profit,
          totalPayout,
          betTransactionId,
          status: 'pending',
          timestamp: Date.now(),
        };

        setBets(prevBets => [...prevBets, newBet]);
      }

      // Clear input after successful bet
      setUserInput('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (betId: string, status: 'pending' | 'ready' | 'paid') => {
    setBets(prevBets =>
      prevBets.map(bet =>
        bet.id === betId ? { ...bet, status } : bet
      )
    );
  };

  const handlePayoutComplete = (betId: string, transactionId: string) => {
    setBets(prevBets =>
      prevBets.map(bet =>
        bet.id === betId
          ? { ...bet, status: 'paid', payoutTransactionId: transactionId }
          : bet
      )
    );
  };

  return (
    <div className="mb-8">
      <form onSubmit={handleSubmit}>
        <label htmlFor="bet-input" className="block text-sm font-medium text-gray-700 mb-2">
          Describe your bet
        </label>
        <div className="flex gap-2">
          <input
            id="bet-input"
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="e.g., Bet $10 on the Patriots to win"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processing...' : 'Place Bet'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800">Processing your bet and sending payment...</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {response && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-900 whitespace-pre-wrap">{response}</p>
        </div>
      )}

      {/* Payout Cards Section */}
      {bets.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Active Bets</h2>
          {bets.map(bet => (
            <PayoutCard
              key={bet.id}
              bet={bet}
              onStatusChange={handleStatusChange}
              onPayoutComplete={handlePayoutComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
