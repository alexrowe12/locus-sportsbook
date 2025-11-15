import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface OddsData {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
}

interface FormattedGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number;
  awayOdds: number;
}

async function fetchNFLOdds() {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    throw new Error('ODDS_API_KEY not found in .env file');
  }

  const sport = 'americanfootball_nfl';
  const regions = 'us';
  const markets = 'h2h'; // h2h = moneyline
  const oddsFormat = 'american';

  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`;

  console.log('Fetching NFL odds...\n');

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: OddsData[] = await response.json();

    // Filter games in the next 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingGames = data.filter(game => {
      const gameDate = new Date(game.commence_time);
      return gameDate >= now && gameDate <= sevenDaysFromNow;
    });

    // Format the data
    const formattedGames: FormattedGame[] = upcomingGames.map(game => {
      // Get the first bookmaker's odds (they're usually similar across bookmakers)
      const bookmaker = game.bookmakers[0];
      const moneylineMarket = bookmaker?.markets.find(m => m.key === 'h2h');

      const homeOdds = moneylineMarket?.outcomes.find(o => o.name === game.home_team)?.price || 0;
      const awayOdds = moneylineMarket?.outcomes.find(o => o.name === game.away_team)?.price || 0;

      return {
        id: game.id,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        homeOdds,
        awayOdds,
      };
    });

    // Write to JSON file
    const outputPath = path.join(process.cwd(), 'odds.json');
    fs.writeFileSync(outputPath, JSON.stringify(formattedGames, null, 2));

    // Print results
    console.log(`✅ Found ${formattedGames.length} upcoming NFL games\n`);
    console.log('='.repeat(80));

    formattedGames.forEach((game, index) => {
      const gameDate = new Date(game.commenceTime);
      console.log(`\n[${index + 1}] ${game.awayTeam} @ ${game.homeTeam}`);
      console.log(`    Date: ${gameDate.toLocaleString()}`);
      console.log(`    ${game.awayTeam}: ${game.awayOdds > 0 ? '+' : ''}${game.awayOdds}`);
      console.log(`    ${game.homeTeam}: ${game.homeOdds > 0 ? '+' : ''}${game.homeOdds}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n💾 Saved to ${outputPath}\n`);

    // Show API usage
    const remaining = response.headers.get('x-requests-remaining');
    if (remaining) {
      console.log(`📊 API requests remaining: ${remaining}`);
    }

  } catch (error) {
    console.error('Error fetching odds:', error);
    throw error;
  }
}

fetchNFLOdds();
