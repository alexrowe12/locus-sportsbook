'use client';

import { useState } from 'react';
import BettingForm from './components/BettingForm';
import PayoutCard, { Bet } from './components/PayoutCard';
import oddsData from '../odds.json';
import { simulateGame } from './utils/gameSimulation';

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number;
  awayOdds: number;
}

interface GameOutcome {
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away';
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Home() {
  const games: Game[] = oddsData;
  const [bets, setBets] = useState<Bet[]>([]);
  const [gameOutcomes, setGameOutcomes] = useState<Record<string, GameOutcome>>({});

  const handleBetPlaced = (newBet: Bet) => {
    setBets(prevBets => [...prevBets, newBet]);
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

  const handleSimulateGame = (betId: string) => {
    setBets(prevBets => {
      const bet = prevBets.find(b => b.id === betId);
      if (!bet) return prevBets;

      // Check if we already have an outcome for this matchup
      let outcome = gameOutcomes[bet.matchup];

      if (!outcome) {
        // Simulate the game and store the outcome
        outcome = simulateGame(bet.homeOdds, bet.awayOdds);
        setGameOutcomes(prev => ({ ...prev, [bet.matchup]: outcome }));
      }

      // Determine if the bet won
      // The bet.team is the full team name, and bet.matchup is "Away @ Home"
      // We need to check if the team they bet on matches the winner
      const isHomeBet = bet.team === bet.homeTeam;
      const didWin = (isHomeBet && outcome.winner === 'home') || (!isHomeBet && outcome.winner === 'away');

      // Update the bet with the outcome
      return prevBets.map(b =>
        b.id === betId
          ? { ...b, gameOutcome: outcome, didWin }
          : b
      );
    });
  };

  return (
    <main className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Locus Sportsbook</h1>
        <p className="text-gray-600 text-sm">NFL Moneyline Odds</p>
      </header>

      {/* Split Screen Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Chat Interface */}
        <div className="w-1/2 border-r border-gray-200 bg-white">
          <div className="h-full p-6">
            <BettingForm onBetPlaced={handleBetPlaced} games={games} />
          </div>
        </div>

        {/* Right Side - Active Bets & Game Odds */}
        <div className="w-1/2 overflow-y-auto bg-gray-50">
          <div className="p-6 space-y-6">
            {/* Active Bets Section */}
            {bets.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Bets</h2>
                <div className="space-y-4">
                  {bets.map(bet => (
                    <PayoutCard
                      key={bet.id}
                      bet={bet}
                      onStatusChange={handleStatusChange}
                      onPayoutComplete={handlePayoutComplete}
                      onSimulateGame={handleSimulateGame}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Game Odds Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Games</h2>
              <div className="grid grid-cols-1 gap-4">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="text-sm text-gray-500 mb-3">
                      {formatDate(game.commenceTime)}
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{game.awayTeam}</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {formatOdds(game.awayOdds)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{game.homeTeam}</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {formatOdds(game.homeOdds)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {games.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No upcoming games found. Run <code className="bg-gray-100 px-2 py-1 rounded">npm run fetch-odds</code> to update.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
