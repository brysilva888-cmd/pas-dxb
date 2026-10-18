export type Gender = 'M' | 'F';

export type CourtMode =
  | 'MENS_DOUBLES'
  | 'WOMENS_DOUBLES'
  | 'MIXED_DOUBLES'
  | 'OPEN_DOUBLES';

export type PlayPhase = 'GENDER_SPLIT' | 'MIXED_DOUBLES' | 'CUSTOM';

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  active: boolean;
}

export interface CourtConfig {
  id: number;
  name: string;
  mode: CourtMode;
}

export interface Match {
  id: string;
  roundNumber: number;
  courtId: number;
  courtName: string;
  mode: CourtMode;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number | null;
  scoreB: number | null;
  completed: boolean;
  noveltyScore: number; // 0 to 100% unique pairings in this match
  repeatPartners: number;
  repeatOpponents: number;
}

export interface Round {
  roundNumber: number;
  phase: PlayPhase;
  matches: Match[];
  archivedMatches?: Match[];
  benchPlayerIds: string[];
  createdAt: string;
}

export interface PlayerStats {
  playerId: string;
  gamesPlayed: number;
  genderGamesPlayed: number;
  mixedGamesPlayed: number;
  gamesBench: number;
  currentBenchStreak: number;
  currentWinStreak: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  uniquePartners: string[];
  uniqueOpponents: string[];
  partnerCounts: Record<string, number>;
  opponentCounts: Record<string, number>;
}
