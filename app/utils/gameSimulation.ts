/**
 * Simulates a game outcome based on moneyline odds
 */

interface GameOutcome {
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away';
}

/**
 * Convert moneyline odds to win probability
 */
function oddsToWinProbability(odds: number): number {
  if (odds > 0) {
    // Positive odds (underdog)
    return 100 / (odds + 100);
  } else {
    // Negative odds (favorite)
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Generate a realistic NFL score
 * NFL scores typically range from 14-35 points
 * Most common scores use combinations of TDs (7) and FGs (3)
 */
function generateNFLScore(isWinner: boolean): number {
  if (isWinner) {
    // Winner: 17-35 points
    const touchdowns = Math.floor(Math.random() * 4) + 2; // 2-5 TDs
    const fieldGoals = Math.floor(Math.random() * 3); // 0-2 FGs
    const extraPoints = Math.random() > 0.3 ? 0 : 2; // Occasional 2-point conversion
    return touchdowns * 7 + fieldGoals * 3 + extraPoints;
  } else {
    // Loser: 10-27 points
    const touchdowns = Math.floor(Math.random() * 3) + 1; // 1-3 TDs
    const fieldGoals = Math.floor(Math.random() * 3); // 0-2 FGs
    return touchdowns * 7 + fieldGoals * 3;
  }
}

/**
 * Simulates a game outcome based on the odds
 */
export function simulateGame(homeOdds: number, awayOdds: number): GameOutcome {
  const homeProbability = oddsToWinProbability(homeOdds);
  const awayProbability = oddsToWinProbability(awayOdds);

  // Normalize probabilities to sum to 1
  const total = homeProbability + awayProbability;
  const normalizedHomeProbability = homeProbability / total;

  // Determine winner based on probability
  const random = Math.random();
  const homeWins = random < normalizedHomeProbability;

  // Generate scores ensuring winner has more points
  let homeScore: number;
  let awayScore: number;

  if (homeWins) {
    homeScore = generateNFLScore(true);
    awayScore = generateNFLScore(false);
    // Ensure home actually won
    if (awayScore >= homeScore) {
      homeScore = awayScore + (Math.floor(Math.random() * 2) + 1) * 7; // Add 1-2 TDs
    }
  } else {
    awayScore = generateNFLScore(true);
    homeScore = generateNFLScore(false);
    // Ensure away actually won
    if (homeScore >= awayScore) {
      awayScore = homeScore + (Math.floor(Math.random() * 2) + 1) * 7; // Add 1-2 TDs
    }
  }

  return {
    homeScore,
    awayScore,
    winner: homeWins ? 'home' : 'away',
  };
}
