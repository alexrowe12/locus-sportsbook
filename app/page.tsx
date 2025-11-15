import fs from 'fs';
import path from 'path';
import BettingForm from './components/BettingForm';

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number;
  awayOdds: number;
}

function getOdds(): Game[] {
  const filePath = path.join(process.cwd(), 'odds.json');

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading odds.json:', error);
    return [];
  }
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
  const games = getOdds();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Locus Sportsbook</h1>
          <p className="text-gray-600 mt-2">NFL Moneyline Odds</p>
        </header>

        <BettingForm />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
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
        </div>

        {games.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No upcoming games found. Run <code className="bg-gray-100 px-2 py-1 rounded">npm run fetch-odds</code> to update.</p>
          </div>
        )}
      </div>
    </main>
  );
}
