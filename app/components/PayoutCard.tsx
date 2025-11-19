'use client';

import { useState, useEffect } from 'react';

export interface Bet {
  id: string;
  amount: number;
  team: string;
  matchup: string;
  profit: number;
  totalPayout: number;
  betTransactionId: string;
  status: 'pending' | 'ready' | 'paid';
  timestamp: number;
  payoutTransactionId?: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  gameOutcome?: {
    homeScore: number;
    awayScore: number;
    winner: 'home' | 'away';
  };
  didWin?: boolean;
}

interface PayoutCardProps {
  bet: Bet;
  onPayoutComplete: (betId: string, transactionId: string) => void;
  onStatusChange: (betId: string, status: 'pending' | 'ready' | 'paid') => void;
  onSimulateGame: (betId: string) => void;
}

export default function PayoutCard({ bet, onPayoutComplete, onStatusChange, onSimulateGame }: PayoutCardProps) {
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Timer logic: wait 10 seconds after bet placed, then simulate game and mark as ready
  useEffect(() => {
    if (bet.status === 'pending') {
      const timeElapsed = Date.now() - bet.timestamp;
      const timeRemaining = 10000 - timeElapsed;

      if (timeRemaining <= 0) {
        onSimulateGame(bet.id);
        onStatusChange(bet.id, 'ready');
      } else {
        const timer = setTimeout(() => {
          onSimulateGame(bet.id);
          onStatusChange(bet.id, 'ready');
        }, timeRemaining);

        return () => clearTimeout(timer);
      }
    }
  }, [bet.status, bet.timestamp, bet.id, onStatusChange, onSimulateGame]);

  const handlePayout = async () => {
    setPayoutLoading(true);
    setPayoutError(null);

    try {
      const res = await fetch('/api/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          betId: bet.id,
          payoutAmount: bet.totalPayout,
          team: bet.team,
          matchup: bet.matchup,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process payout');
      }

      onPayoutComplete(bet.id, data.transactionId);

    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Payout failed');
    } finally {
      setPayoutLoading(false);
    }
  };

  const getButtonColor = () => {
    if (bet.status === 'ready' && bet.didWin) return 'bg-green-600 hover:bg-green-700';
    if (bet.status === 'ready' && !bet.didWin) return 'bg-red-600';
    return 'bg-gray-400';
  };

  const getButtonText = () => {
    if (payoutLoading) return 'Processing...';
    if (bet.status === 'paid') return 'Paid Out';
    if (bet.status === 'ready' && bet.didWin) return 'Claim Payout';
    if (bet.status === 'ready' && !bet.didWin) return 'Bet Lost';
    return 'Pending...';
  };

  const isPayoutDisabled = () => {
    return bet.status !== 'ready' || !bet.didWin || payoutLoading;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Left side: Payout button and details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {bet.team}
            </h3>
            <p className="text-sm text-gray-600 mb-1">{bet.matchup}</p>
            <p className="text-sm text-gray-600">
              Bet: {bet.amount} USDC | Profit: {bet.profit} USDC
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Payout</p>
            <p className="text-2xl font-bold text-gray-900">
              {bet.totalPayout} USDC
            </p>
          </div>

          <button
            onClick={handlePayout}
            disabled={isPayoutDisabled()}
            className={`w-full px-4 py-3 text-white font-medium rounded-lg disabled:cursor-not-allowed transition-colors ${getButtonColor()}`}
          >
            {getButtonText()}
          </button>

          {payoutError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{payoutError}</p>
            </div>
          )}
        </div>

        {/* Right side: Game outcome and payout status */}
        <div className="border-l border-gray-200 pl-6">
          {bet.status === 'paid' && bet.payoutTransactionId ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <h4 className="font-semibold text-gray-900">Payout Complete</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Amount Paid</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {bet.totalPayout} USDC
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Transaction ID</p>
                  <p className="text-xs font-mono bg-gray-100 px-2 py-1 rounded break-all">
                    {bet.payoutTransactionId}
                  </p>
                </div>
              </div>
            </div>
          ) : bet.gameOutcome ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${bet.didWin ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <h4 className={`font-semibold ${bet.didWin ? 'text-green-700' : 'text-red-700'}`}>
                  {bet.didWin ? 'Bet Won!' : 'Bet Lost'}
                </h4>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">Final Score</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${bet.gameOutcome.winner === 'away' ? 'font-bold' : ''}`}>
                      {bet.awayTeam}
                    </span>
                    <span className={`text-lg font-bold ${bet.gameOutcome.winner === 'away' ? 'text-gray-900' : 'text-gray-500'}`}>
                      {bet.gameOutcome.awayScore}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${bet.gameOutcome.winner === 'home' ? 'font-bold' : ''}`}>
                      {bet.homeTeam}
                    </span>
                    <span className={`text-lg font-bold ${bet.gameOutcome.winner === 'home' ? 'text-gray-900' : 'text-gray-500'}`}>
                      {bet.gameOutcome.homeScore}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">
                {bet.status === 'pending' ? 'Game in progress...' : 'Ready to claim'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
