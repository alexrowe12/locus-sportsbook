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
}

interface PayoutCardProps {
  bet: Bet;
  onPayoutComplete: (betId: string, transactionId: string) => void;
  onStatusChange: (betId: string, status: 'pending' | 'ready' | 'paid') => void;
}

export default function PayoutCard({ bet, onPayoutComplete, onStatusChange }: PayoutCardProps) {
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Timer logic: wait 10 seconds after bet placed, then mark as ready
  useEffect(() => {
    if (bet.status === 'pending') {
      const timeElapsed = Date.now() - bet.timestamp;
      const timeRemaining = 10000 - timeElapsed;

      if (timeRemaining <= 0) {
        onStatusChange(bet.id, 'ready');
      } else {
        const timer = setTimeout(() => {
          onStatusChange(bet.id, 'ready');
        }, timeRemaining);

        return () => clearTimeout(timer);
      }
    }
  }, [bet.status, bet.timestamp, bet.id, onStatusChange]);

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
    if (bet.status === 'ready') return 'bg-green-600 hover:bg-green-700';
    return 'bg-gray-400';
  };

  const getButtonText = () => {
    if (payoutLoading) return 'Processing...';
    if (bet.status === 'paid') return 'Paid Out';
    if (bet.status === 'ready') return 'Claim Payout';
    return 'Pending...';
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
            disabled={bet.status !== 'ready' || payoutLoading}
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

        {/* Right side: Payout confirmation */}
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
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">
                {bet.status === 'pending' ? 'Waiting for payout...' : 'Ready to claim'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
