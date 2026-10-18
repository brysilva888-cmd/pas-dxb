import {
  CourtConfig,
  Match,
  Player,
  PlayerStats,
  PlayPhase,
  Round,
} from '../types';

const MEN_NAMES = [
  'Liam Carter',
  'Noah Bennett',
  'Oliver Hayes',
  'Elijah Brooks',
  'James Sullivan',
  'William Price',
  'Benjamin Reed',
  'Lucas Morgan',
  'Henry Cooper',
  'Theodore Ward',
  'Jack Torres',
  'Levi Peterson',
  'Alexander Gray',
  'Jackson Ramirez',
  'Mateo James',
  'Daniel Watson',
  'Michael Kelly',
  'Mason Sanders',
  'Sebastian Ross',
  'Ethan Henderson',
  'Logan Coleman',
  'Owen Jenkins',
  'Samuel Perry',
  'Jacob Powell',
  'Asher Long',
  'Aiden Patterson',
  'John Hughes',
  'Joseph Flores',
  'Wyatt Washington',
  'David Butler',
  'Leo Simmons',
  'Luke Foster',
  'Julian Gonzales',
  'Hudson Bryant',
  'Grayson Alexander',
  'Matthew Russell',
  'Ezra Griffin',
  'Gabriel Diaz',
  'Carter Hayes',
  'Isaac Myers',
];

const WOMEN_NAMES = [
  'Olivia Chen',
  'Emma Rodriguez',
  'Charlotte Kim',
  'Amelia Patel',
  'Sophia Nguyen',
  'Mia Kowalski',
  'Isabella Silva',
  'Ava Morales',
  'Evelyn Lindqvist',
  'Luna Novak',
  'Harper Vance',
  'Camila Reyes',
  'Sofia Rostova',
  'Scarlett Jensen',
  'Elizabeth Park',
  'Eleanor Sato',
  'Emily Costa',
  'Chloe Hoffman',
  'Mila Bernard',
  'Violet Gallagher',
  'Penelope Walsh',
  'Gianna Cross',
  'Aria Manning',
  'Abigail Steele',
  'Ella Lowe',
  'Nora Barton',
  'Hazel Fleming',
  'Madison Watts',
  'Ellie Gregory',
  'Lily Benson',
  'Nova Jensen',
  'Isla Becker',
  'Grace Lawson',
  'Chloe Webb',
  'Zoe Tiwari',
  'Stella Vega',
  'Aurora Mendoza',
  'Natalie Rhodes',
  'Emilia Frost',
  'Hannah Drake',
];

export function createInitialRoster(menCount = 25, womenCount = 20): Player[] {
  const players: Player[] = [];

  for (let i = 0; i < menCount; i++) {
    const baseName = MEN_NAMES[i] || `Men Player ${i + 1}`;
    players.push({
      id: `m-${i + 1}`,
      name: baseName,
      gender: 'M',
      active: true,
    });
  }

  for (let i = 0; i < womenCount; i++) {
    const baseName = WOMEN_NAMES[i] || `Women Player ${i + 1}`;
    players.push({
      id: `f-${i + 1}`,
      name: baseName,
      gender: 'F',
      active: true,
    });
  }

  return players;
}

/**
 * Preserves existing/uploaded players and their names when rebuilding a session,
 * trimming or appending only if targetMenCount / targetWomenCount differs from current count.
 */
export function adjustRosterToCounts(
  currentPlayers: Player[],
  targetMenCount: number,
  targetWomenCount: number
): Player[] {
  const existingMen = currentPlayers.filter((p) => p.gender === 'M');
  const existingWomen = currentPlayers.filter((p) => p.gender === 'F');

  const finalMen: Player[] = [];
  for (let i = 0; i < targetMenCount; i++) {
    if (i < existingMen.length) {
      finalMen.push({ ...existingMen[i], active: true });
    } else {
      const baseName = MEN_NAMES[i] || `Men Player ${i + 1}`;
      finalMen.push({
        id: `m-gen-${Date.now()}-${i + 1}`,
        name: baseName,
        gender: 'M',
        active: true,
      });
    }
  }

  const finalWomen: Player[] = [];
  for (let i = 0; i < targetWomenCount; i++) {
    if (i < existingWomen.length) {
      finalWomen.push({ ...existingWomen[i], active: true });
    } else {
      const baseName = WOMEN_NAMES[i] || `Women Player ${i + 1}`;
      finalWomen.push({
        id: `f-gen-${Date.now()}-${i + 1}`,
        name: baseName,
        gender: 'F',
        active: true,
      });
    }
  }

  return [...finalMen, ...finalWomen];
}

export function computePlayerStats(
  players: Player[],
  rounds: Round[],
  upToRoundNumber?: number,
  completedOnly = false
): Record<string, PlayerStats> {
  const statsMap: Record<string, PlayerStats> = {};

  for (const p of players) {
    statsMap[p.id] = {
      playerId: p.id,
      gamesPlayed: 0,
      genderGamesPlayed: 0,
      mixedGamesPlayed: 0,
      gamesBench: 0,
      currentBenchStreak: 0,
      currentWinStreak: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      uniquePartners: [],
      uniqueOpponents: [],
      partnerCounts: {},
      opponentCounts: {},
    };
  }

  const partnerSets: Record<string, Set<string>> = {};
  const opponentSets: Record<string, Set<string>> = {};
  for (const p of players) {
    partnerSets[p.id] = new Set();
    opponentSets[p.id] = new Set();
  }

  const filteredRounds =
    upToRoundNumber !== undefined
      ? rounds.filter((r) => r.roundNumber <= upToRoundNumber)
      : rounds;

  for (const round of filteredRounds) {
    const playingInRound = new Set<string>();
    const rawRoundMatches = [
      ...(round.archivedMatches || []),
      ...round.matches,
    ];
    const allRoundMatches = completedOnly
      ? rawRoundMatches.filter((m) => m.completed)
      : rawRoundMatches;

    for (const match of allRoundMatches) {
      const [a1, a2] = match.teamA;
      const [b1, b2] = match.teamB;
      const allFour = [a1, a2, b1, b2];
      const isMixedMatch =
        match.mode === 'MIXED_DOUBLES' || round.phase === 'MIXED_DOUBLES';

      for (const pid of allFour) {
        playingInRound.add(pid);
        if (statsMap[pid]) {
          statsMap[pid].gamesPlayed += 1;
          if (isMixedMatch) {
            statsMap[pid].mixedGamesPlayed += 1;
          } else {
            statsMap[pid].genderGamesPlayed += 1;
          }
          statsMap[pid].currentBenchStreak = 0;
        }
      }

      const addPartner = (p1: string, p2: string) => {
        if (!statsMap[p1]) return;
        partnerSets[p1]?.add(p2);
        statsMap[p1].partnerCounts[p2] = (statsMap[p1].partnerCounts[p2] || 0) + 1;
      };
      addPartner(a1, a2);
      addPartner(a2, a1);
      addPartner(b1, b2);
      addPartner(b2, b1);

      const addOpponent = (p1: string, p2: string) => {
        if (!statsMap[p1]) return;
        opponentSets[p1]?.add(p2);
        statsMap[p1].opponentCounts[p2] = (statsMap[p1].opponentCounts[p2] || 0) + 1;
      };
      addOpponent(a1, b1);
      addOpponent(a1, b2);
      addOpponent(a2, b1);
      addOpponent(a2, b2);
      addOpponent(b1, a1);
      addOpponent(b1, a2);
      addOpponent(b2, a1);
      addOpponent(b2, a2);

      if (match.completed && match.scoreA !== null && match.scoreB !== null) {
        const sA = match.scoreA;
        const sB = match.scoreB;
        const aWon = sA > sB;
        const bWon = sB > sA;

        for (const pid of [a1, a2]) {
          if (!statsMap[pid]) continue;
          statsMap[pid].pointsFor += sA;
          statsMap[pid].pointsAgainst += sB;
          if (aWon) {
            statsMap[pid].wins += 1;
            statsMap[pid].currentWinStreak += 1;
          } else {
            if (bWon) statsMap[pid].losses += 1;
            statsMap[pid].currentWinStreak = 0;
          }
        }
        for (const pid of [b1, b2]) {
          if (!statsMap[pid]) continue;
          statsMap[pid].pointsFor += sB;
          statsMap[pid].pointsAgainst += sA;
          if (bWon) {
            statsMap[pid].wins += 1;
            statsMap[pid].currentWinStreak += 1;
          } else {
            if (aWon) statsMap[pid].losses += 1;
            statsMap[pid].currentWinStreak = 0;
          }
        }
      }
    }

    if (!completedOnly || allRoundMatches.length > 0) {
      for (const p of players) {
        if (!p.active) continue;
        if (!playingInRound.has(p.id) && statsMap[p.id]) {
          statsMap[p.id].gamesBench += 1;
          statsMap[p.id].currentBenchStreak += 1;
        }
      }
    }
  }

  for (const p of players) {
    if (statsMap[p.id]) {
      statsMap[p.id].uniquePartners = Array.from(partnerSets[p.id] || []);
      statsMap[p.id].uniqueOpponents = Array.from(opponentSets[p.id] || []);
    }
  }

  return statsMap;
}

function evaluateMatchCost(
  teamA: [string, string],
  teamB: [string, string],
  statsMap: Record<string, PlayerStats>
): {
  cost: number;
  repeatPartners: number;
  repeatOpponents: number;
  noveltyScore: number;
} {
  const [a1, a2] = teamA;
  const [b1, b2] = teamB;

  const repPartnerA = statsMap[a1]?.partnerCounts[a2] || 0;
  const repPartnerB = statsMap[b1]?.partnerCounts[b2] || 0;
  const repeatPartners = repPartnerA + repPartnerB;

  const repOpp1 = statsMap[a1]?.opponentCounts[b1] || 0;
  const repOpp2 = statsMap[a1]?.opponentCounts[b2] || 0;
  const repOpp3 = statsMap[a2]?.opponentCounts[b1] || 0;
  const repOpp4 = statsMap[a2]?.opponentCounts[b2] || 0;
  const repeatOpponents = repOpp1 + repOpp2 + repOpp3 + repOpp4;

  // Heavy penalty for repeat partners and repeat opponents
  const cost =
    repeatPartners * 600 +
    repeatOpponents * 280 +
    (repOpp1 > 1 ? 300 : 0) +
    (repOpp2 > 1 ? 300 : 0) +
    (repOpp3 > 1 ? 300 : 0) +
    (repOpp4 > 1 ? 300 : 0);

  let newRelationships = 0;
  if (repPartnerA === 0) newRelationships++;
  if (repPartnerB === 0) newRelationships++;
  if (repOpp1 === 0) newRelationships++;
  if (repOpp2 === 0) newRelationships++;
  if (repOpp3 === 0) newRelationships++;
  if (repOpp4 === 0) newRelationships++;

  const noveltyScore = Math.round((newRelationships / 6) * 100);

  return {
    cost,
    repeatPartners: (repPartnerA > 0 ? 1 : 0) + (repPartnerB > 0 ? 1 : 0),
    repeatOpponents:
      (repOpp1 > 0 ? 1 : 0) +
      (repOpp2 > 0 ? 1 : 0) +
      (repOpp3 > 0 ? 1 : 0) +
      (repOpp4 > 0 ? 1 : 0),
    noveltyScore,
  };
}

function bestSingleCourtSplit(
  fourIds: [string, string, string, string],
  statsMap: Record<string, PlayerStats>
) {
  const splits: Array<[[string, string], [string, string]]> = [
    [
      [fourIds[0], fourIds[1]],
      [fourIds[2], fourIds[3]],
    ],
    [
      [fourIds[0], fourIds[2]],
      [fourIds[1], fourIds[3]],
    ],
    [
      [fourIds[0], fourIds[3]],
      [fourIds[1], fourIds[2]],
    ],
  ];

  let best = splits[0];
  let bestEval = evaluateMatchCost(splits[0][0], splits[0][1], statsMap);

  for (let i = 1; i < splits.length; i++) {
    const ev = evaluateMatchCost(splits[i][0], splits[i][1], statsMap);
    if (ev.cost < bestEval.cost) {
      best = splits[i];
      bestEval = ev;
    }
  }

  return { teamA: best[0], teamB: best[1], ...bestEval };
}

function bestMixedCourtSplit(
  menTwo: [string, string],
  womenTwo: [string, string],
  statsMap: Record<string, PlayerStats>
) {
  const opt1: [[string, string], [string, string]] = [
    [menTwo[0], womenTwo[0]],
    [menTwo[1], womenTwo[1]],
  ];
  const opt2: [[string, string], [string, string]] = [
    [menTwo[0], womenTwo[1]],
    [menTwo[1], womenTwo[0]],
  ];

  const ev1 = evaluateMatchCost(opt1[0], opt1[1], statsMap);
  const ev2 = evaluateMatchCost(opt2[0], opt2[1], statsMap);

  if (ev2.cost < ev1.cost) {
    return { teamA: opt2[0], teamB: opt2[1], ...ev2 };
  }
  return { teamA: opt1[0], teamB: opt1[1], ...ev1 };
}

function sortCandidatesByPriority(
  candidates: Player[],
  statsMap: Record<string, PlayerStats>,
  seedOffset: number,
  phaseFocus: 'GENDER' | 'MIXED' | 'TOTAL' = 'TOTAL'
): Player[] {
  return [...candidates].sort((a, b) => {
    const sa = statsMap[a.id];
    const sb = statsMap[b.id];
    if (!sa || !sb) return 0;

    if (phaseFocus === 'GENDER' && sa.genderGamesPlayed !== sb.genderGamesPlayed) {
      return sa.genderGamesPlayed - sb.genderGamesPlayed;
    }
    if (phaseFocus === 'MIXED' && sa.mixedGamesPlayed !== sb.mixedGamesPlayed) {
      return sa.mixedGamesPlayed - sb.mixedGamesPlayed;
    }
    if (sa.gamesPlayed !== sb.gamesPlayed) {
      return sa.gamesPlayed - sb.gamesPlayed;
    }
    if (sa.currentBenchStreak !== sb.currentBenchStreak) {
      return sb.currentBenchStreak - sa.currentBenchStreak;
    }
    if (sa.uniqueOpponents.length !== sb.uniqueOpponents.length) {
      return sa.uniqueOpponents.length - sb.uniqueOpponents.length;
    }
    const hashA =
      (a.id.charCodeAt(0) * 31 + a.id.charCodeAt(a.id.length - 1) + seedOffset * 17) %
      97;
    const hashB =
      (b.id.charCodeAt(0) * 31 + b.id.charCodeAt(b.id.length - 1) + seedOffset * 17) %
      97;
    return hashA - hashB;
  });
}

function optimizeSamePoolCourts(
  courtCount: number,
  prioritizedCandidates: Player[],
  statsMap: Record<string, PlayerStats>,
  roundSeed: number
): Array<{
  teamA: [string, string];
  teamB: [string, string];
  noveltyScore: number;
  repeatPartners: number;
  repeatOpponents: number;
}> {
  const needed = courtCount * 4;
  if (prioritizedCandidates.length < needed || courtCount === 0) return [];

  const cutoffPlayer = prioritizedCandidates[needed - 1];
  const cutoffStats = statsMap[cutoffPlayer.id];

  const mustPlay: string[] = [];
  const tiedPool: string[] = [];

  for (const p of prioritizedCandidates) {
    const st = statsMap[p.id];
    if (
      st.genderGamesPlayed < cutoffStats.genderGamesPlayed ||
      (st.genderGamesPlayed === cutoffStats.genderGamesPlayed &&
        st.gamesPlayed < cutoffStats.gamesPlayed) ||
      (st.genderGamesPlayed === cutoffStats.genderGamesPlayed &&
        st.gamesPlayed === cutoffStats.gamesPlayed &&
        st.currentBenchStreak > cutoffStats.currentBenchStreak)
    ) {
      mustPlay.push(p.id);
    } else if (
      st.genderGamesPlayed === cutoffStats.genderGamesPlayed &&
      st.gamesPlayed === cutoffStats.gamesPlayed &&
      st.currentBenchStreak === cutoffStats.currentBenchStreak
    ) {
      tiedPool.push(p.id);
    }
  }

  let bestArrangement: string[] = [
    ...mustPlay,
    ...tiedPool.slice(0, needed - mustPlay.length),
  ];

  const evaluateArrangement = (arr: string[]) => {
    let totalCost = 0;
    const courtResults = [];
    for (let c = 0; c < courtCount; c++) {
      const slice: [string, string, string, string] = [
        arr[c * 4],
        arr[c * 4 + 1],
        arr[c * 4 + 2],
        arr[c * 4 + 3],
      ];
      const res = bestSingleCourtSplit(slice, statsMap);
      totalCost += res.cost;
      courtResults.push(res);
    }
    return { totalCost, courtResults };
  };

  let bestScore = evaluateArrangement(bestArrangement);
  let currentArr = [...bestArrangement];
  let currentTiedUnused = tiedPool.slice(needed - mustPlay.length);

  for (let iter = 0; iter < 180; iter++) {
    if (bestScore.totalCost === 0) break;

    const nextArr = [...currentArr];
    const nextUnused = [...currentTiedUnused];

    if (nextUnused.length > 0 && iter % 3 === 0 && needed > mustPlay.length) {
      const tiedSlotIdx =
        mustPlay.length + ((iter * 13 + roundSeed * 7) % (needed - mustPlay.length));
      const unusedIdx = (iter * 19 + roundSeed * 11) % nextUnused.length;
      const temp = nextArr[tiedSlotIdx];
      nextArr[tiedSlotIdx] = nextUnused[unusedIdx];
      nextUnused[unusedIdx] = temp;
    } else if (needed >= 4) {
      const idx1 = (iter * 7 + roundSeed * 3) % needed;
      const idx2 = (iter * 11 + roundSeed * 5 + 1) % needed;
      if (idx1 !== idx2) {
        const temp = nextArr[idx1];
        nextArr[idx1] = nextArr[idx2];
        nextArr[idx2] = temp;
      }
    }

    const candidateEval = evaluateArrangement(nextArr);
    if (candidateEval.totalCost <= bestScore.totalCost) {
      bestScore = candidateEval;
      bestArrangement = nextArr;
      currentArr = nextArr;
      currentTiedUnused = nextUnused;
    }
  }

  return bestScore.courtResults;
}

function optimizeMixedCourts(
  courtCount: number,
  prioritizedMen: Player[],
  prioritizedWomen: Player[],
  statsMap: Record<string, PlayerStats>,
  roundSeed: number
): Array<{
  teamA: [string, string];
  teamB: [string, string];
  noveltyScore: number;
  repeatPartners: number;
  repeatOpponents: number;
}> {
  const neededPerGender = courtCount * 2;
  if (
    prioritizedMen.length < neededPerGender ||
    prioritizedWomen.length < neededPerGender ||
    courtCount === 0
  ) {
    return [];
  }

  const splitPriority = (list: Player[], count: number) => {
    const cutoff = statsMap[list[count - 1].id];
    const must: string[] = [];
    const tied: string[] = [];
    for (const p of list) {
      const st = statsMap[p.id];
      if (
        st.mixedGamesPlayed < cutoff.mixedGamesPlayed ||
        (st.mixedGamesPlayed === cutoff.mixedGamesPlayed &&
          st.gamesPlayed < cutoff.gamesPlayed) ||
        (st.mixedGamesPlayed === cutoff.mixedGamesPlayed &&
          st.gamesPlayed === cutoff.gamesPlayed &&
          st.currentBenchStreak > cutoff.currentBenchStreak)
      ) {
        must.push(p.id);
      } else if (
        st.mixedGamesPlayed === cutoff.mixedGamesPlayed &&
        st.gamesPlayed === cutoff.gamesPlayed &&
        st.currentBenchStreak === cutoff.currentBenchStreak
      ) {
        tied.push(p.id);
      }
    }
    return {
      active: [...must, ...tied.slice(0, count - must.length)],
      mustLen: must.length,
      unusedTied: tied.slice(count - must.length),
    };
  };

  const menPool = splitPriority(prioritizedMen, neededPerGender);
  const womenPool = splitPriority(prioritizedWomen, neededPerGender);

  let currentMen = [...menPool.active];
  let unusedMen = [...menPool.unusedTied];
  let currentWomen = [...womenPool.active];
  let unusedWomen = [...womenPool.unusedTied];

  const evaluateMixed = (mArr: string[], wArr: string[]) => {
    let totalCost = 0;
    const courtResults = [];
    for (let c = 0; c < courtCount; c++) {
      const mTwo: [string, string] = [mArr[c * 2], mArr[c * 2 + 1]];
      const wTwo: [string, string] = [wArr[c * 2], wArr[c * 2 + 1]];
      const res = bestMixedCourtSplit(mTwo, wTwo, statsMap);
      totalCost += res.cost;
      courtResults.push(res);
    }
    return { totalCost, courtResults };
  };

  let bestEval = evaluateMixed(currentMen, currentWomen);

  for (let iter = 0; iter < 220; iter++) {
    if (bestEval.totalCost === 0) break;

    const nextM = [...currentMen];
    const nextUnusedM = [...unusedMen];
    const nextW = [...currentWomen];
    const nextUnusedW = [...unusedWomen];

    const mode = iter % 4;
    if (mode === 0 && neededPerGender >= 2) {
      const i1 = (iter * 5 + roundSeed) % neededPerGender;
      const i2 = (iter * 9 + roundSeed + 1) % neededPerGender;
      const tmp = nextM[i1];
      nextM[i1] = nextM[i2];
      nextM[i2] = tmp;
    } else if (mode === 1 && neededPerGender >= 2) {
      const i1 = (iter * 7 + roundSeed) % neededPerGender;
      const i2 = (iter * 11 + roundSeed + 1) % neededPerGender;
      const tmp = nextW[i1];
      nextW[i1] = nextW[i2];
      nextW[i2] = tmp;
    } else if (
      mode === 2 &&
      nextUnusedM.length > 0 &&
      neededPerGender > menPool.mustLen
    ) {
      const slot =
        menPool.mustLen + ((iter * 13 + roundSeed) % (neededPerGender - menPool.mustLen));
      const uIdx = (iter * 17 + roundSeed) % nextUnusedM.length;
      const tmp = nextM[slot];
      nextM[slot] = nextUnusedM[uIdx];
      nextUnusedM[uIdx] = tmp;
    } else if (
      mode === 3 &&
      nextUnusedW.length > 0 &&
      neededPerGender > womenPool.mustLen
    ) {
      const slot =
        womenPool.mustLen +
        ((iter * 13 + roundSeed) % (neededPerGender - womenPool.mustLen));
      const uIdx = (iter * 19 + roundSeed) % nextUnusedW.length;
      const tmp = nextW[slot];
      nextW[slot] = nextUnusedW[uIdx];
      nextUnusedW[uIdx] = tmp;
    }

    const cand = evaluateMixed(nextM, nextW);
    if (cand.totalCost <= bestEval.totalCost) {
      bestEval = cand;
      currentMen = nextM;
      unusedMen = nextUnusedM;
      currentWomen = nextW;
      unusedWomen = nextUnusedW;
    }
  }

  return bestEval.courtResults;
}

export function generateNextRound(
  players: Player[],
  existingRounds: Round[],
  courtConfigs: CourtConfig[],
  phase: PlayPhase
): Round {
  const nextRoundNumber = existingRounds.length + 1;
  const statsMap = computePlayerStats(players, existingRounds);

  const activePlayers = players.filter((p) => p.active);
  const assignedPlayerIds = new Set<string>();
  const matches: Match[] = [];

  const mensCourts = courtConfigs.filter((c) => c.mode === 'MENS_DOUBLES');
  const womensCourts = courtConfigs.filter((c) => c.mode === 'WOMENS_DOUBLES');
  const mixedCourts = courtConfigs.filter((c) => c.mode === 'MIXED_DOUBLES');
  const openCourts = courtConfigs.filter((c) => c.mode === 'OPEN_DOUBLES');

  if (mensCourts.length > 0) {
    const availMen = sortCandidatesByPriority(
      activePlayers.filter((p) => p.gender === 'M' && !assignedPlayerIds.has(p.id)),
      statsMap,
      nextRoundNumber,
      'GENDER'
    );
    const maxCourts = Math.min(mensCourts.length, Math.floor(availMen.length / 4));
    const results = optimizeSamePoolCourts(
      maxCourts,
      availMen,
      statsMap,
      nextRoundNumber
    );
    results.forEach((res, idx) => {
      const court = mensCourts[idx];
      res.teamA.forEach((id) => assignedPlayerIds.add(id));
      res.teamB.forEach((id) => assignedPlayerIds.add(id));
      matches.push({
        id: `r${nextRoundNumber}-c${court.id}`,
        roundNumber: nextRoundNumber,
        courtId: court.id,
        courtName: court.name,
        mode: court.mode,
        teamA: res.teamA,
        teamB: res.teamB,
        scoreA: null,
        scoreB: null,
        completed: false,
        noveltyScore: res.noveltyScore,
        repeatPartners: res.repeatPartners,
        repeatOpponents: res.repeatOpponents,
      });
    });
  }

  if (womensCourts.length > 0) {
    const availWomen = sortCandidatesByPriority(
      activePlayers.filter((p) => p.gender === 'F' && !assignedPlayerIds.has(p.id)),
      statsMap,
      nextRoundNumber + 100,
      'GENDER'
    );
    const maxCourts = Math.min(womensCourts.length, Math.floor(availWomen.length / 4));
    const results = optimizeSamePoolCourts(
      maxCourts,
      availWomen,
      statsMap,
      nextRoundNumber + 100
    );
    results.forEach((res, idx) => {
      const court = womensCourts[idx];
      res.teamA.forEach((id) => assignedPlayerIds.add(id));
      res.teamB.forEach((id) => assignedPlayerIds.add(id));
      matches.push({
        id: `r${nextRoundNumber}-c${court.id}`,
        roundNumber: nextRoundNumber,
        courtId: court.id,
        courtName: court.name,
        mode: court.mode,
        teamA: res.teamA,
        teamB: res.teamB,
        scoreA: null,
        scoreB: null,
        completed: false,
        noveltyScore: res.noveltyScore,
        repeatPartners: res.repeatPartners,
        repeatOpponents: res.repeatOpponents,
      });
    });
  }

  if (mixedCourts.length > 0) {
    const availMen = sortCandidatesByPriority(
      activePlayers.filter((p) => p.gender === 'M' && !assignedPlayerIds.has(p.id)),
      statsMap,
      nextRoundNumber + 200,
      'MIXED'
    );
    const availWomen = sortCandidatesByPriority(
      activePlayers.filter((p) => p.gender === 'F' && !assignedPlayerIds.has(p.id)),
      statsMap,
      nextRoundNumber + 300,
      'MIXED'
    );

    const maxMixedCourts = Math.min(
      mixedCourts.length,
      Math.floor(availMen.length / 2),
      Math.floor(availWomen.length / 2)
    );

    const results = optimizeMixedCourts(
      maxMixedCourts,
      availMen,
      availWomen,
      statsMap,
      nextRoundNumber
    );

    results.forEach((res, idx) => {
      const court = mixedCourts[idx];
      res.teamA.forEach((id) => assignedPlayerIds.add(id));
      res.teamB.forEach((id) => assignedPlayerIds.add(id));
      matches.push({
        id: `r${nextRoundNumber}-c${court.id}`,
        roundNumber: nextRoundNumber,
        courtId: court.id,
        courtName: court.name,
        mode: court.mode,
        teamA: res.teamA,
        teamB: res.teamB,
        scoreA: null,
        scoreB: null,
        completed: false,
        noveltyScore: res.noveltyScore,
        repeatPartners: res.repeatPartners,
        repeatOpponents: res.repeatOpponents,
      });
    });
  }

  if (openCourts.length > 0) {
    const availAny = sortCandidatesByPriority(
      activePlayers.filter((p) => !assignedPlayerIds.has(p.id)),
      statsMap,
      nextRoundNumber + 400
    );
    const maxCourts = Math.min(openCourts.length, Math.floor(availAny.length / 4));
    const results = optimizeSamePoolCourts(
      maxCourts,
      availAny,
      statsMap,
      nextRoundNumber + 400
    );
    results.forEach((res, idx) => {
      const court = openCourts[idx];
      res.teamA.forEach((id) => assignedPlayerIds.add(id));
      res.teamB.forEach((id) => assignedPlayerIds.add(id));
      matches.push({
        id: `r${nextRoundNumber}-c${court.id}`,
        roundNumber: nextRoundNumber,
        courtId: court.id,
        courtName: court.name,
        mode: court.mode,
        teamA: res.teamA,
        teamB: res.teamB,
        scoreA: null,
        scoreB: null,
        completed: false,
        noveltyScore: res.noveltyScore,
        repeatPartners: res.repeatPartners,
        repeatOpponents: res.repeatOpponents,
      });
    });
  }

  const filledCourtIds = new Set(matches.map((m) => m.courtId));
  const unfilledCourts = courtConfigs.filter((c) => !filledCourtIds.has(c.id));
  if (unfilledCourts.length > 0) {
    const availRemaining = sortCandidatesByPriority(
      activePlayers.filter((p) => !assignedPlayerIds.has(p.id)),
      statsMap,
      nextRoundNumber + 500
    );
    const maxFallback = Math.min(
      unfilledCourts.length,
      Math.floor(availRemaining.length / 4)
    );
    if (maxFallback > 0) {
      const results = optimizeSamePoolCourts(
        maxFallback,
        availRemaining,
        statsMap,
        nextRoundNumber + 500
      );
      results.forEach((res, idx) => {
        const court = unfilledCourts[idx];
        res.teamA.forEach((id) => assignedPlayerIds.add(id));
        res.teamB.forEach((id) => assignedPlayerIds.add(id));
        const allM = [...res.teamA, ...res.teamB].every(
          (id) => activePlayers.find((p) => p.id === id)?.gender === 'M'
        );
        const allW = [...res.teamA, ...res.teamB].every(
          (id) => activePlayers.find((p) => p.id === id)?.gender === 'F'
        );
        matches.push({
          id: `r${nextRoundNumber}-c${court.id}`,
          roundNumber: nextRoundNumber,
          courtId: court.id,
          courtName: court.name,
          mode: allM
            ? 'MENS_DOUBLES'
            : allW
            ? 'WOMENS_DOUBLES'
            : 'OPEN_DOUBLES',
          teamA: res.teamA,
          teamB: res.teamB,
          scoreA: null,
          scoreB: null,
          completed: false,
          noveltyScore: res.noveltyScore,
          repeatPartners: res.repeatPartners,
          repeatOpponents: res.repeatOpponents,
        });
      });
    }
  }

  matches.sort((a, b) => a.courtId - b.courtId);

  const benchPlayerIds = sortCandidatesByPriority(
    activePlayers.filter((p) => !assignedPlayerIds.has(p.id)),
    statsMap,
    nextRoundNumber
  ).map((p) => p.id);

  return {
    roundNumber: nextRoundNumber,
    phase,
    matches,
    benchPlayerIds,
    createdAt: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

/**
 * Generates a two-phase Open Play schedule where:
 * - Phase 1 (Gender Doubles): Every active player plays `genderGamesPerPlayer` (default 4) Gender Doubles games.
 * - Phase 2 (Mixed Doubles): Every active player plays `mixedGamesPerPlayer` (default 1) Mixed Doubles game.
 */
export function generateTwoPhaseSchedule(
  players: Player[],
  genderGamesPerPlayer = 4,
  mixedGamesPerPlayer = 1,
  courtCount = 4,
  menCourtsInPhase1 = 2
): Round[] {
  const rounds: Round[] = [];
  const activeMenCount = players.filter((p) => p.active && p.gender === 'M').length;
  const activeWomenCount = players.filter((p) => p.active && p.gender === 'F').length;

  // Phase 1: Gender Doubles — schedule exact matches so every Man and every Woman plays `genderGamesPerPlayer` (e.g. 4) games
  let menMatchesRemaining =
    activeMenCount >= 4
      ? Math.ceil((activeMenCount * genderGamesPerPlayer) / 4)
      : 0;
  let womenMatchesRemaining =
    activeWomenCount >= 4
      ? Math.ceil((activeWomenCount * genderGamesPerPlayer) / 4)
      : 0;

  const maxMenCourtsPerRound = Math.floor(activeMenCount / 4);
  const maxWomenCourtsPerRound = Math.floor(activeWomenCount / 4);

  while (menMatchesRemaining > 0 || womenMatchesRemaining > 0) {
    const canScheduleMen = Math.min(menMatchesRemaining, maxMenCourtsPerRound);
    const canScheduleWomen = Math.min(
      womenMatchesRemaining,
      maxWomenCourtsPerRound
    );

    if (canScheduleMen === 0 && canScheduleWomen === 0) break;

    let mCourts = Math.min(menCourtsInPhase1, canScheduleMen);
    let wCourts = Math.min(courtCount - mCourts, canScheduleWomen);

    if (mCourts + wCourts < courtCount) {
      const extraM = Math.min(
        courtCount - (mCourts + wCourts),
        canScheduleMen - mCourts
      );
      mCourts += extraM;
    }

    if (mCourts + wCourts < courtCount) {
      const extraW = Math.min(
        courtCount - (mCourts + wCourts),
        canScheduleWomen - wCourts
      );
      wCourts += extraW;
    }

    if (mCourts + wCourts === 0) break;

    const roundCourts: CourtConfig[] = [];
    for (let i = 0; i < mCourts; i++) {
      roundCourts.push({
        id: roundCourts.length + 1,
        name: `Court ${roundCourts.length + 1}`,
        mode: 'MENS_DOUBLES',
      });
    }
    for (let i = 0; i < wCourts; i++) {
      roundCourts.push({
        id: roundCourts.length + 1,
        name: `Court ${roundCourts.length + 1}`,
        mode: 'WOMENS_DOUBLES',
      });
    }

    const nextR = generateNextRound(players, rounds, roundCourts, 'GENDER_SPLIT');
    rounds.push(nextR);

    menMatchesRemaining -= mCourts;
    womenMatchesRemaining -= wCourts;
  }

  // Fallback if fewer than 4 Men and fewer than 4 Women exist
  if (rounds.length === 0 && activeMenCount + activeWomenCount >= 4) {
    const totalPlayers = activeMenCount + activeWomenCount;
    let openMatchesRemaining = Math.ceil(
      (totalPlayers * genderGamesPerPlayer) / 4
    );
    const maxOpenPerRound = Math.floor(totalPlayers / 4);
    while (openMatchesRemaining > 0 && maxOpenPerRound > 0) {
      const openThisRound = Math.min(
        courtCount,
        openMatchesRemaining,
        maxOpenPerRound
      );
      const roundCourts: CourtConfig[] = Array.from(
        { length: openThisRound },
        (_, idx) => ({
          id: idx + 1,
          name: `Court ${idx + 1}`,
          mode: 'OPEN_DOUBLES',
        })
      );
      const nextR = generateNextRound(players, rounds, roundCourts, 'GENDER_SPLIT');
      rounds.push(nextR);
      openMatchesRemaining -= openThisRound;
    }
  }

  // Phase 2: Mixed Doubles — every player plays `mixedGamesPerPlayer` (default 1) Mixed Doubles game
  if (mixedGamesPerPlayer > 0 && activeMenCount >= 2 && activeWomenCount >= 2) {
    let mixedMatchesRemaining = Math.max(
      Math.ceil((activeMenCount * mixedGamesPerPlayer) / 2),
      Math.ceil((activeWomenCount * mixedGamesPerPlayer) / 2)
    );
    const maxMixedPerRound = Math.min(
      Math.floor(activeMenCount / 2),
      Math.floor(activeWomenCount / 2)
    );

    while (mixedMatchesRemaining > 0 && maxMixedPerRound > 0) {
      const mixedThisRound = Math.min(
        courtCount,
        mixedMatchesRemaining,
        maxMixedPerRound
      );
      if (mixedThisRound === 0) break;

      const phase2Courts: CourtConfig[] = Array.from(
        { length: mixedThisRound },
        (_, idx) => ({
          id: idx + 1,
          name: `Court ${idx + 1}`,
          mode: 'MIXED_DOUBLES',
        })
      );

      const nextR = generateNextRound(
        players,
        rounds,
        phase2Courts,
        'MIXED_DOUBLES'
      );
      rounds.push(nextR);
      mixedMatchesRemaining -= mixedThisRound;
    }
  }

  return rounds;
}

/**
 * Recalculates upcoming rounds when the roster changes (e.g. a player is added, paused, or removed),
 * preserving completed/past rounds while updating the active round's bench and regenerating subsequent rounds.
 */
export function syncRoundsWithUpdatedRoster(
  players: Player[],
  existingRounds: Round[],
  activeRoundNumber: number,
  courtCount: number,
  menCourtsInPhase1: number,
  genderGamesPerPlayer = 4,
  mixedGamesPerPlayer = 1
): Round[] {
  const hasAnyCompletedOrArchived = existingRounds.some(
    (r) =>
      (r.archivedMatches && r.archivedMatches.length > 0) ||
      r.matches.some((m) => m.completed)
  );

  // If still at the start of the session with no games completed yet, generate a clean full schedule
  if (activeRoundNumber <= 1 && !hasAnyCompletedOrArchived) {
    return generateTwoPhaseSchedule(
      players,
      genderGamesPerPlayer,
      mixedGamesPerPlayer,
      courtCount,
      menCourtsInPhase1
    );
  }

  const activePlayerIds = new Set(players.filter((p) => p.active).map((p) => p.id));
  const preservedRounds: Round[] = [];

  for (const r of existingRounds) {
    if (r.roundNumber < activeRoundNumber) {
      preservedRounds.push(r);
    } else if (r.roundNumber === activeRoundNumber) {
      const onCourtIds = new Set<string>();
      let courtPlayersValid = true;
      for (const m of r.matches) {
        for (const pid of [...m.teamA, ...m.teamB]) {
          onCourtIds.add(pid);
          if (!activePlayerIds.has(pid)) {
            courtPlayersValid = false;
          }
        }
      }

      if (courtPlayersValid && r.matches.length > 0) {
        const statsBefore = computePlayerStats(players, preservedRounds);
        const updatedBench = sortCandidatesByPriority(
          players.filter((p) => p.active && !onCourtIds.has(p.id)),
          statsBefore,
          r.roundNumber
        ).map((p) => p.id);

        preservedRounds.push({
          ...r,
          benchPlayerIds: updatedBench,
        });
      } else {
        const configs: CourtConfig[] = Array.from({ length: courtCount }, (_, idx) => {
          const cid = idx + 1;
          const prevMatch = r.matches.find((m) => m.courtId === cid);
          return {
            id: cid,
            name: `Court ${cid}`,
            mode:
              prevMatch?.mode ||
              (r.phase === 'MIXED_DOUBLES'
                ? 'MIXED_DOUBLES'
                : idx < menCourtsInPhase1
                ? 'MENS_DOUBLES'
                : 'WOMENS_DOUBLES'),
          };
        });
        const regen = generateNextRound(players, preservedRounds, configs, r.phase);
        preservedRounds.push(regen);
      }
    }
  }

  // Schedule remaining Phase 1 (Gender Doubles) and Phase 2 (Mixed Doubles) matches so all active players reach 4 Gender + 1 Mixed games
  const activeMen = players.filter((p) => p.active && p.gender === 'M');
  const activeWomen = players.filter((p) => p.active && p.gender === 'F');
  const currentStats = computePlayerStats(players, preservedRounds);

  const menGenderDeficit = activeMen.reduce(
    (sum, p) =>
      sum + Math.max(0, genderGamesPerPlayer - (currentStats[p.id]?.genderGamesPlayed || 0)),
    0
  );
  const womenGenderDeficit = activeWomen.reduce(
    (sum, p) =>
      sum + Math.max(0, genderGamesPerPlayer - (currentStats[p.id]?.genderGamesPlayed || 0)),
    0
  );

  let menMatchesRemaining =
    activeMen.length >= 4 ? Math.ceil(menGenderDeficit / 4) : 0;
  let womenMatchesRemaining =
    activeWomen.length >= 4 ? Math.ceil(womenGenderDeficit / 4) : 0;

  const maxMenCourtsPerRound = Math.floor(activeMen.length / 4);
  const maxWomenCourtsPerRound = Math.floor(activeWomen.length / 4);

  while (menMatchesRemaining > 0 || womenMatchesRemaining > 0) {
    const canScheduleMen = Math.min(menMatchesRemaining, maxMenCourtsPerRound);
    const canScheduleWomen = Math.min(womenMatchesRemaining, maxWomenCourtsPerRound);
    if (canScheduleMen === 0 && canScheduleWomen === 0) break;

    let mCourts = Math.min(menCourtsInPhase1, canScheduleMen);
    let wCourts = Math.min(courtCount - mCourts, canScheduleWomen);

    if (mCourts + wCourts < courtCount) {
      mCourts += Math.min(courtCount - (mCourts + wCourts), canScheduleMen - mCourts);
    }
    if (mCourts + wCourts < courtCount) {
      wCourts += Math.min(courtCount - (mCourts + wCourts), canScheduleWomen - wCourts);
    }
    if (mCourts + wCourts === 0) break;

    const roundCourts: CourtConfig[] = [];
    for (let i = 0; i < mCourts; i++) {
      roundCourts.push({
        id: roundCourts.length + 1,
        name: `Court ${roundCourts.length + 1}`,
        mode: 'MENS_DOUBLES',
      });
    }
    for (let i = 0; i < wCourts; i++) {
      roundCourts.push({
        id: roundCourts.length + 1,
        name: `Court ${roundCourts.length + 1}`,
        mode: 'WOMENS_DOUBLES',
      });
    }

    const nextR = generateNextRound(players, preservedRounds, roundCourts, 'GENDER_SPLIT');
    preservedRounds.push(nextR);
    menMatchesRemaining -= mCourts;
    womenMatchesRemaining -= wCourts;
  }

  if (mixedGamesPerPlayer > 0 && activeMen.length >= 2 && activeWomen.length >= 2) {
    const postPhase1Stats = computePlayerStats(players, preservedRounds);
    const menMixedDeficit = activeMen.reduce(
      (sum, p) =>
        sum + Math.max(0, mixedGamesPerPlayer - (postPhase1Stats[p.id]?.mixedGamesPlayed || 0)),
      0
    );
    const womenMixedDeficit = activeWomen.reduce(
      (sum, p) =>
        sum + Math.max(0, mixedGamesPerPlayer - (postPhase1Stats[p.id]?.mixedGamesPlayed || 0)),
      0
    );

    let mixedMatchesRemaining = Math.max(
      Math.ceil(menMixedDeficit / 2),
      Math.ceil(womenMixedDeficit / 2)
    );
    const maxMixedPerRound = Math.min(
      Math.floor(activeMen.length / 2),
      Math.floor(activeWomen.length / 2)
    );

    while (mixedMatchesRemaining > 0 && maxMixedPerRound > 0) {
      const mixedThisRound = Math.min(
        courtCount,
        mixedMatchesRemaining,
        maxMixedPerRound
      );
      if (mixedThisRound === 0) break;

      const phase2Courts: CourtConfig[] = Array.from(
        { length: mixedThisRound },
        (_, idx) => ({
          id: idx + 1,
          name: `Court ${idx + 1}`,
          mode: 'MIXED_DOUBLES',
        })
      );

      const nextR = generateNextRound(
        players,
        preservedRounds,
        phase2Courts,
        'MIXED_DOUBLES'
      );
      preservedRounds.push(nextR);
      mixedMatchesRemaining -= mixedThisRound;
    }
  }

  return preservedRounds;
}

export interface ParsedBulkPlayer {
  name: string;
  gender: 'M' | 'F';
}

/**
 * Parses bulk player names from a .txt or .csv file or pasted text.
 * Supports:
 * - Section headers like "Men:", "[Men]", "Women:", "[Women]"
 * - Line prefixes like "M: John Doe", "W: Jane Doe", "F - Jane Doe"
 * - Line suffixes like "John Doe, M", "Jane Doe, W", "Jane Doe (F)", "John Doe - Men"
 * - Plain names (1 per line) assigned to `defaultGender`
 */
export function parseBulkNamesText(
  rawText: string,
  defaultGender: 'M' | 'F' = 'M'
): ParsedBulkPlayer[] {
  const results: ParsedBulkPlayer[] = [];
  let currentSectionGender: 'M' | 'F' = defaultGender;

  const lines = rawText.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Check if the line is a section header like "Men:", "[Men]", "--- Women ---", "Ladies"
    const headerMatch = line.match(
      /^[\[\-=*\s]*(men|mens|man|male|males|boys|women|womens|woman|female|females|ladies|girls)[\]\-=*:\s]*$/i
    );
    if (headerMatch) {
      const keyword = headerMatch[1].toLowerCase();
      if (
        keyword.startsWith('w') ||
        keyword.startsWith('f') ||
        keyword.startsWith('l') ||
        keyword.startsWith('g')
      ) {
        currentSectionGender = 'F';
      } else {
        currentSectionGender = 'M';
      }
      continue;
    }

    // Strip leading numbering or codes like "1. ", "01) ", "M01 · ", "W02 - "
    let working = line;
    let detectedGender: 'M' | 'F' | null = null;

    // Check prefix like "M01 · Name", "W02 · Name", "M: Name", "W: Name", "F - Name"
    const prefixMatch = working.match(
      /^(?:([MWF])\d*\s*[·:\-|]\s*|(men|man|male|women|woman|female)\s*[:\-|]\s*)(.+)$/i
    );
    if (prefixMatch) {
      const token = (prefixMatch[1] || prefixMatch[2] || '').toUpperCase();
      detectedGender = token.startsWith('W') || token.startsWith('F') ? 'F' : 'M';
      working = prefixMatch[3].trim();
    } else {
      // Strip plain list numbers like "1. John Smith" or "12) John Smith"
      working = working.replace(/^\d+[\.\)\-]\s*/, '').trim();
    }

    // Check suffix like "John Smith, M" or "Jane Doe - Women" or "Jane Doe (W)"
    const suffixMatch = working.match(
      /^(.+?)(?:\s*[,\-|/]\s*|\s+\()(m|w|f|men|man|male|women|woman|female)\)?$/i
    );
    if (suffixMatch) {
      const token = suffixMatch[2].toUpperCase();
      detectedGender = token.startsWith('W') || token.startsWith('F') ? 'F' : 'M';
      working = suffixMatch[1].trim();
    }

    if (!working) continue;

    results.push({
      name: working,
      gender: detectedGender ?? currentSectionGender,
    });
  }

  return results;
}

export function generateSampleTxtContent(players?: Player[]): string {
  if (players && players.length > 0) {
    const men = players
      .filter((p) => p.gender === 'M')
      .map((p) => p.name.replace(/^[MW]\d+\s*·\s*/, ''));
    const women = players
      .filter((p) => p.gender === 'F')
      .map((p) => p.name.replace(/^[MW]\d+\s*·\s*/, ''));

    return [
      '# CourtFlow Pickleball Open Play Roster (.txt)',
      '# You can list names under Men: and Women: sections, or write "Name, M" / "Name, W" on each line.',
      '',
      'Men:',
      ...men,
      '',
      'Women:',
      ...women,
      '',
    ].join('\n');
  }

  return [
    '# CourtFlow Pickleball Open Play Roster (.txt)',
    'Men:',
    ...MEN_NAMES.slice(0, 25),
    '',
    'Women:',
    ...WOMEN_NAMES.slice(0, 20),
    '',
  ].join('\n');
}

/**
 * Advances a single completed court to the next game using the top priority waiting players from the bench,
 * while archiving the completed match so its score and stats remain saved.
 */
export function advanceSingleCourtToNextGame(
  players: Player[],
  existingRounds: Round[],
  activeRoundNumber: number,
  courtId: number
): Round[] {
  const targetRound = existingRounds.find(
    (r) => r.roundNumber === activeRoundNumber
  );
  if (!targetRound) return existingRounds;

  const targetMatch = targetRound.matches.find((m) => m.courtId === courtId);
  if (!targetMatch) return existingRounds;

  // Archive the completed match so its scores/stats are preserved
  const archivedMatch: Match = {
    ...targetMatch,
    id: `${targetMatch.id}-done-${Date.now()}`,
    completed: true,
    scoreA: targetMatch.scoreA ?? 11,
    scoreB: targetMatch.scoreB ?? 8,
  };

  // Players currently active on OTHER courts in this round cannot be pulled
  const otherCourtsMatches = targetRound.matches.filter(
    (m) => m.courtId !== courtId
  );
  const busyOnOtherCourts = new Set<string>();
  for (const m of otherCourtsMatches) {
    m.teamA.forEach((id) => busyOnOtherCourts.add(id));
    m.teamB.forEach((id) => busyOnOtherCourts.add(id));
  }

  // Build temporary rounds list including the archived match to compute up-to-the-second player stats
  const tempRoundsWithArchive = existingRounds.map((r) => {
    if (r.roundNumber !== activeRoundNumber) return r;
    return {
      ...r,
      archivedMatches: [...(r.archivedMatches || []), archivedMatch],
      matches: otherCourtsMatches,
    };
  });

  const statsMap = computePlayerStats(
    players,
    tempRoundsWithArchive,
    activeRoundNumber
  );

  // Available pool: active players not currently playing on another court
  const justFinishedIds = new Set([
    ...targetMatch.teamA,
    ...targetMatch.teamB,
  ]);
  const availablePlayers = players.filter(
    (p) => p.active && !busyOnOtherCourts.has(p.id)
  );

  // Prioritize bench players who did NOT just finish on this court first, then by fewest games played & wait streak
  const sortForNextCourt = (list: Player[], seed: number) => {
    const rested = list.filter((p) => !justFinishedIds.has(p.id));
    const justPlayed = list.filter((p) => justFinishedIds.has(p.id));
    return [
      ...sortCandidatesByPriority(rested, statsMap, seed),
      ...sortCandidatesByPriority(justPlayed, statsMap, seed + 17),
    ];
  };

  const seed =
    activeRoundNumber * 31 +
    courtId * 7 +
    ((targetRound.archivedMatches?.length || 0) + 1) * 13;

  let chosenTeamA: [string, string] = targetMatch.teamA;
  let chosenTeamB: [string, string] = targetMatch.teamB;
  let noveltyScore = 100;
  let repeatPartners = 0;
  let repeatOpponents = 0;

  const mode = targetMatch.mode;

  if (mode === 'MENS_DOUBLES') {
    const menPool = sortForNextCourt(
      availablePlayers.filter((p) => p.gender === 'M'),
      seed
    );
    const poolToUse =
      menPool.length >= 4
        ? menPool
        : sortForNextCourt(availablePlayers, seed);
    if (poolToUse.length >= 4) {
      const res = optimizeSamePoolCourts(1, poolToUse, statsMap, seed)[0];
      if (res) {
        chosenTeamA = res.teamA;
        chosenTeamB = res.teamB;
        noveltyScore = res.noveltyScore;
        repeatPartners = res.repeatPartners;
        repeatOpponents = res.repeatOpponents;
      }
    }
  } else if (mode === 'WOMENS_DOUBLES') {
    const womenPool = sortForNextCourt(
      availablePlayers.filter((p) => p.gender === 'F'),
      seed
    );
    const poolToUse =
      womenPool.length >= 4
        ? womenPool
        : sortForNextCourt(availablePlayers, seed);
    if (poolToUse.length >= 4) {
      const res = optimizeSamePoolCourts(1, poolToUse, statsMap, seed)[0];
      if (res) {
        chosenTeamA = res.teamA;
        chosenTeamB = res.teamB;
        noveltyScore = res.noveltyScore;
        repeatPartners = res.repeatPartners;
        repeatOpponents = res.repeatOpponents;
      }
    }
  } else if (mode === 'MIXED_DOUBLES') {
    const menPool = sortForNextCourt(
      availablePlayers.filter((p) => p.gender === 'M'),
      seed
    );
    const womenPool = sortForNextCourt(
      availablePlayers.filter((p) => p.gender === 'F'),
      seed + 50
    );
    if (menPool.length >= 2 && womenPool.length >= 2) {
      const res = optimizeMixedCourts(1, menPool, womenPool, statsMap, seed)[0];
      if (res) {
        chosenTeamA = res.teamA;
        chosenTeamB = res.teamB;
        noveltyScore = res.noveltyScore;
        repeatPartners = res.repeatPartners;
        repeatOpponents = res.repeatOpponents;
      }
    } else {
      const anyPool = sortForNextCourt(availablePlayers, seed);
      if (anyPool.length >= 4) {
        const res = optimizeSamePoolCourts(1, anyPool, statsMap, seed)[0];
        if (res) {
          chosenTeamA = res.teamA;
          chosenTeamB = res.teamB;
          noveltyScore = res.noveltyScore;
          repeatPartners = res.repeatPartners;
          repeatOpponents = res.repeatOpponents;
        }
      }
    }
  } else {
    const anyPool = sortForNextCourt(availablePlayers, seed);
    if (anyPool.length >= 4) {
      const res = optimizeSamePoolCourts(1, anyPool, statsMap, seed)[0];
      if (res) {
        chosenTeamA = res.teamA;
        chosenTeamB = res.teamB;
        noveltyScore = res.noveltyScore;
        repeatPartners = res.repeatPartners;
        repeatOpponents = res.repeatOpponents;
      }
    }
  }

  const nextMatch: Match = {
    id: `r${activeRoundNumber}-c${courtId}-g${
      (targetRound.archivedMatches?.length || 0) + 2
    }`,
    roundNumber: activeRoundNumber,
    courtId: targetMatch.courtId,
    courtName: targetMatch.courtName,
    mode: targetMatch.mode,
    teamA: chosenTeamA,
    teamB: chosenTeamB,
    scoreA: null,
    scoreB: null,
    completed: false,
    noveltyScore,
    repeatPartners,
    repeatOpponents,
  };

  const nowOnCourt = new Set<string>([
    ...busyOnOtherCourts,
    ...chosenTeamA,
    ...chosenTeamB,
  ]);

  const updatedBench = sortCandidatesByPriority(
    players.filter((p) => p.active && !nowOnCourt.has(p.id)),
    statsMap,
    seed
  ).map((p) => p.id);

  return existingRounds.map((r) => {
    if (r.roundNumber !== activeRoundNumber) return r;
    return {
      ...r,
      archivedMatches: [...(r.archivedMatches || []), archivedMatch],
      matches: r.matches.map((m) => (m.courtId === courtId ? nextMatch : m)),
      benchPlayerIds: updatedBench,
    };
  });
}


