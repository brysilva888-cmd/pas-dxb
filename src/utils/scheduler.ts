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

export function getPairMeetingCount(
  p1: string,
  p2: string,
  statsMap: Record<string, PlayerStats>
): number {
  if (p1 === p2) return 999;
  const st = statsMap[p1];
  if (!st) return 0;
  return (st.partnerCounts[p2] || 0) + (st.opponentCounts[p2] || 0);
}

export function evaluateMatchCost(
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

  // Strict Rule: No player may meet the same person again (whether prior meeting was as partner OR opponent)
  const metPartnerA = getPairMeetingCount(a1, a2, statsMap);
  const metPartnerB = getPairMeetingCount(b1, b2, statsMap);
  const repeatPartnersTotal = metPartnerA + metPartnerB;

  const metOpp1 = getPairMeetingCount(a1, b1, statsMap);
  const metOpp2 = getPairMeetingCount(a1, b2, statsMap);
  const metOpp3 = getPairMeetingCount(a2, b1, statsMap);
  const metOpp4 = getPairMeetingCount(a2, b2, statsMap);
  const repeatOpponentsTotal = metOpp1 + metOpp2 + metOpp3 + metOpp4;

  const exactRepPartnerA = statsMap[a1]?.partnerCounts[a2] || 0;
  const exactRepPartnerB = statsMap[b1]?.partnerCounts[b2] || 0;

  // Massive penalty for any repeat meeting of the same person on a court
  const cost =
    repeatPartnersTotal * 12000 +
    repeatOpponentsTotal * 10000 +
    (exactRepPartnerA + exactRepPartnerB) * 1500 +
    (metPartnerA > 1 ? 5000 : 0) +
    (metPartnerB > 1 ? 5000 : 0) +
    (metOpp1 > 1 ? 4000 : 0) +
    (metOpp2 > 1 ? 4000 : 0) +
    (metOpp3 > 1 ? 4000 : 0) +
    (metOpp4 > 1 ? 4000 : 0);

  let newRelationships = 0;
  if (metPartnerA === 0) newRelationships++;
  if (metPartnerB === 0) newRelationships++;
  if (metOpp1 === 0) newRelationships++;
  if (metOpp2 === 0) newRelationships++;
  if (metOpp3 === 0) newRelationships++;
  if (metOpp4 === 0) newRelationships++;

  const noveltyScore = Math.round((newRelationships / 6) * 100);

  return {
    cost,
    repeatPartners: (metPartnerA > 0 ? 1 : 0) + (metPartnerB > 0 ? 1 : 0),
    repeatOpponents:
      (metOpp1 > 0 ? 1 : 0) +
      (metOpp2 > 0 ? 1 : 0) +
      (metOpp3 > 0 ? 1 : 0) +
      (metOpp4 > 0 ? 1 : 0),
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
    const metA = new Set([...sa.uniquePartners, ...sa.uniqueOpponents]).size;
    const metB = new Set([...sb.uniquePartners, ...sb.uniqueOpponents]).size;
    if (metA !== metB) {
      return metB - metA; // Place more-constrained players first within the exact same priority tier
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

/**
 * Exact bitmask backtracking solver that finds `targetCourts` disjoint 4-player courts
 * from `poolIds` where NO two players on the same court have EVER met before (neither as partner nor opponent).
 */
function solveZeroConflictSamePool(
  targetCourts: number,
  poolIds: string[],
  statsMap: Record<string, PlayerStats>,
  mustIncludeCount = 0
): Array<[string, string, string, string]> | null {
  const n = poolIds.length;
  if (n < targetCourts * 4 || targetCourts <= 0) return null;

  const conflictMasks: bigint[] = new Array(n).fill(0n);
  for (let i = 0; i < n; i++) {
    let mask = 1n << BigInt(i);
    for (let j = 0; j < n; j++) {
      if (i !== j && getPairMeetingCount(poolIds[i], poolIds[j], statsMap) > 0) {
        mask |= 1n << BigInt(j);
      }
    }
    conflictMasks[i] = mask;
  }

  const chosenCourts: Array<[number, number, number, number]> = [];
  let steps = 0;
  const maxSteps = 14000;

  const backtrack = (
    courtIdx: number,
    usedMask: bigint,
    minFirstIdx: number,
    skipsRemaining: number
  ): boolean => {
    if (courtIdx === targetCourts) return true;
    if (++steps > maxSteps) return false;

    // Count remaining available players from minFirstIdx..n-1
    let a = minFirstIdx;
    while (a < n && (usedMask & (1n << BigInt(a))) !== 0n) {
      a++;
    }
    if (a >= n) return false;

    const courtsLeft = targetCourts - courtIdx;
    if (n - a < courtsLeft * 4) return false;

    const bitA = 1n << BigInt(a);
    const maskA = usedMask | conflictMasks[a];

    // Branch 1: Include player `a` in court `courtIdx`
    for (let b = a + 1; b < n; b++) {
      const bitB = 1n << BigInt(b);
      if ((maskA & bitB) !== 0n) continue;
      const maskAB = maskA | conflictMasks[b];

      for (let c = b + 1; c < n; c++) {
        const bitC = 1n << BigInt(c);
        if ((maskAB & bitC) !== 0n) continue;
        const maskABC = maskAB | conflictMasks[c];

        for (let d = c + 1; d < n; d++) {
          const bitD = 1n << BigInt(d);
          if ((maskABC & bitD) !== 0n) continue;

          chosenCourts.push([a, b, c, d]);
          if (
            backtrack(
              courtIdx + 1,
              usedMask | bitA | bitB | bitC | bitD,
              a + 1,
              skipsRemaining
            )
          ) {
            return true;
          }
          chosenCourts.pop();
          if (steps > maxSteps) return false;
        }
      }
    }

    // Branch 2: Skip player `a` if `a >= mustIncludeCount` and we have spare candidates
    if (a >= mustIncludeCount && skipsRemaining > 0) {
      if (backtrack(courtIdx, usedMask | bitA, a + 1, skipsRemaining - 1)) {
        return true;
      }
    }

    return false;
  };

  const maxSkips = Math.max(0, n - targetCourts * 4);
  if (backtrack(0, 0n, 0, maxSkips)) {
    return chosenCourts.map(([a, b, c, d]) => [
      poolIds[a],
      poolIds[b],
      poolIds[c],
      poolIds[d],
    ]);
  }
  return null;
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

  // Players strictly behind in games played vs players in the same gamesPlayed wave
  const strictMustPlay: string[] = [];
  const sameWaveTied: string[] = [];
  const laterWave: string[] = [];

  for (const p of prioritizedCandidates) {
    const st = statsMap[p.id];
    if (
      st.genderGamesPlayed < cutoffStats.genderGamesPlayed ||
      (st.genderGamesPlayed === cutoffStats.genderGamesPlayed &&
        st.gamesPlayed < cutoffStats.gamesPlayed)
    ) {
      strictMustPlay.push(p.id);
    } else if (
      st.genderGamesPlayed === cutoffStats.genderGamesPlayed &&
      st.gamesPlayed === cutoffStats.gamesPlayed
    ) {
      sameWaveTied.push(p.id);
    } else {
      laterWave.push(p.id);
    }
  }

  // Deterministically rotate the tied wave slightly by roundSeed while keeping longer bench streaks first
  const rotatedTied = [...sameWaveTied].sort((idA, idB) => {
    const sa = statsMap[idA];
    const sb = statsMap[idB];
    if (sa && sb && sa.currentBenchStreak !== sb.currentBenchStreak) {
      return sb.currentBenchStreak - sa.currentBenchStreak;
    }
    const degA = sa ? new Set([...sa.uniquePartners, ...sa.uniqueOpponents]).size : 0;
    const degB = sb ? new Set([...sb.uniquePartners, ...sb.uniqueOpponents]).size : 0;
    if (degA !== degB) return degB - degA;
    const hA = (idA.charCodeAt(idA.length - 1) * 29 + roundSeed * 13) % 89;
    const hB = (idB.charCodeAt(idB.length - 1) * 29 + roundSeed * 13) % 89;
    return hA - hB;
  });

  const activeWavePool = [...strictMustPlay, ...rotatedTied];
  const allCandidateIds = [...activeWavePool, ...laterWave];

  let zeroConflictGroups: Array<[string, string, string, string]> | null = null;

  // 1. Wave Lookahead: if activeWavePool has multiple courts left in this GP wave, solve the whole wave
  // so the remaining players in the wave are guaranteed conflict-free for the next round!
  const waveTotalCourts = Math.min(5, Math.floor(activeWavePool.length / 4));
  if (waveTotalCourts > courtCount) {
    const fullWaveSolution = solveZeroConflictSamePool(
      waveTotalCourts,
      activeWavePool,
      statsMap,
      strictMustPlay.length
    );
    if (fullWaveSolution) {
      zeroConflictGroups = fullWaveSolution.slice(0, courtCount);
    }
  }

  // 2. Exact `courtCount` within activeWavePool including all strictMustPlay players
  if (!zeroConflictGroups) {
    zeroConflictGroups = solveZeroConflictSamePool(
      courtCount,
      activeWavePool,
      statsMap,
      strictMustPlay.length
    );
  }

  // 3. Exact `courtCount` within activeWavePool with flexible mustPlay if two mustPlay players already met
  if (!zeroConflictGroups) {
    zeroConflictGroups = solveZeroConflictSamePool(
      courtCount,
      activeWavePool,
      statsMap,
      0
    );
  }

  // 4. Exact `courtCount` across all active candidates (requiring strictMustPlay if possible, then any conflict-free)
  if (!zeroConflictGroups) {
    zeroConflictGroups =
      solveZeroConflictSamePool(
        courtCount,
        allCandidateIds,
        statsMap,
        strictMustPlay.length
      ) || solveZeroConflictSamePool(courtCount, allCandidateIds, statsMap, 0);
  }

  if (zeroConflictGroups) {
    return zeroConflictGroups.map((group) => bestSingleCourtSplit(group, statsMap));
  }

  // 5. Fallback local optimizer (only reached on tiny rosters where every possible pair has already met)
  let bestArrangement: string[] = allCandidateIds.slice(0, needed);

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
  let currentUnused = allCandidateIds.slice(needed);

  for (let iter = 0; iter < 320; iter++) {
    if (bestScore.totalCost === 0) break;

    const nextArr = [...currentArr];
    const nextUnused = [...currentUnused];

    if (nextUnused.length > 0 && iter % 2 === 0) {
      const slotIdx = (iter * 13 + roundSeed * 7) % needed;
      const unusedIdx = (iter * 19 + roundSeed * 11) % nextUnused.length;
      const temp = nextArr[slotIdx];
      nextArr[slotIdx] = nextUnused[unusedIdx];
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
      currentUnused = nextUnused;
    }
  }

  return bestScore.courtResults;
}

/**
 * Exact solver for Mixed Doubles courts ensuring no two players placed on a court
 * have ever met before (neither across genders nor within the same gender).
 */
function solveZeroConflictMixedPool(
  targetCourts: number,
  menIds: string[],
  womenIds: string[],
  statsMap: Record<string, PlayerStats>,
  mustMenCount = 0,
  mustWomenCount = 0,
  enforceSameGenderUnmet = true
): Array<{ men: [string, string]; women: [string, string] }> | null {
  const nM = menIds.length;
  const nW = womenIds.length;
  if (nM < targetCourts * 2 || nW < targetCourts * 2 || targetCourts <= 0) {
    return null;
  }

  const chosen: Array<{ m1: number; m2: number; w1: number; w2: number }> = [];
  let steps = 0;
  const maxSteps = 14000;

  const backtrack = (
    courtIdx: number,
    usedMenMask: bigint,
    usedWomenMask: bigint,
    minM: number,
    menSkipsLeft: number,
    womenSkipsLeft: number
  ): boolean => {
    if (courtIdx === targetCourts) return true;
    if (++steps > maxSteps) return false;

    let m1 = minM;
    while (m1 < nM && (usedMenMask & (1n << BigInt(m1))) !== 0n) {
      m1++;
    }
    if (m1 >= nM) return false;
    if (nM - m1 < (targetCourts - courtIdx) * 2) return false;

    const bitM1 = 1n << BigInt(m1);
    const idM1 = menIds[m1];

    // Branch 1: Include man `m1`
    for (let m2 = m1 + 1; m2 < nM; m2++) {
      const bitM2 = 1n << BigInt(m2);
      if ((usedMenMask & bitM2) !== 0n) continue;
      const idM2 = menIds[m2];

      if (
        enforceSameGenderUnmet &&
        getPairMeetingCount(idM1, idM2, statsMap) > 0
      ) {
        continue;
      }

      for (let w1 = 0; w1 < nW; w1++) {
        const bitW1 = 1n << BigInt(w1);
        if ((usedWomenMask & bitW1) !== 0n) continue;
        if (w1 < mustWomenCount && womenSkipsLeft < 0) continue;
        const idW1 = womenIds[w1];

        if (
          getPairMeetingCount(idM1, idW1, statsMap) > 0 ||
          getPairMeetingCount(idM2, idW1, statsMap) > 0
        ) {
          continue;
        }

        for (let w2 = w1 + 1; w2 < nW; w2++) {
          const bitW2 = 1n << BigInt(w2);
          if ((usedWomenMask & bitW2) !== 0n) continue;
          const idW2 = womenIds[w2];

          if (
            enforceSameGenderUnmet &&
            getPairMeetingCount(idW1, idW2, statsMap) > 0
          ) {
            continue;
          }
          if (
            getPairMeetingCount(idM1, idW2, statsMap) > 0 ||
            getPairMeetingCount(idM2, idW2, statsMap) > 0
          ) {
            continue;
          }

          chosen.push({ m1, m2, w1, w2 });
          if (
            backtrack(
              courtIdx + 1,
              usedMenMask | bitM1 | bitM2,
              usedWomenMask | bitW1 | bitW2,
              m1 + 1,
              menSkipsLeft,
              womenSkipsLeft
            )
          ) {
            return true;
          }
          chosen.pop();
          if (steps > maxSteps) return false;
        }
      }
    }

    // Branch 2: Skip `m1` if allowed
    if (m1 >= mustMenCount && menSkipsLeft > 0) {
      if (
        backtrack(
          courtIdx,
          usedMenMask | bitM1,
          usedWomenMask,
          m1 + 1,
          menSkipsLeft - 1,
          womenSkipsLeft
        )
      ) {
        return true;
      }
    }

    return false;
  };

  const maxMenSkips = Math.max(0, nM - targetCourts * 2);
  const maxWomenSkips = Math.max(0, nW - targetCourts * 2);

  if (backtrack(0, 0n, 0n, 0, maxMenSkips, maxWomenSkips)) {
    // Verify mustWomenCount constraint if mustWomenCount > 0
    if (mustWomenCount > 0) {
      const usedW = new Set<number>();
      for (const c of chosen) {
        usedW.add(c.w1);
        usedW.add(c.w2);
      }
      for (let w = 0; w < Math.min(mustWomenCount, targetCourts * 2); w++) {
        if (!usedW.has(w)) {
          return null;
        }
      }
    }
    return chosen.map((c) => ({
      men: [menIds[c.m1], menIds[c.m2]],
      women: [womenIds[c.w1], womenIds[c.w2]],
    }));
  }

  return null;
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

  const buildWavePools = (list: Player[], count: number) => {
    const cutoff = statsMap[list[count - 1].id];
    const strictMust: string[] = [];
    const sameWave: string[] = [];
    const laterWave: string[] = [];
    for (const p of list) {
      const st = statsMap[p.id];
      if (
        st.mixedGamesPlayed < cutoff.mixedGamesPlayed ||
        (st.mixedGamesPlayed === cutoff.mixedGamesPlayed &&
          st.gamesPlayed < cutoff.gamesPlayed)
      ) {
        strictMust.push(p.id);
      } else if (
        st.mixedGamesPlayed === cutoff.mixedGamesPlayed &&
        st.gamesPlayed === cutoff.gamesPlayed
      ) {
        sameWave.push(p.id);
      } else {
        laterWave.push(p.id);
      }
    }
    return {
      waveIds: [...strictMust, ...sameWave],
      allIds: [...strictMust, ...sameWave, ...laterWave],
      mustLen: strictMust.length,
    };
  };

  const menPool = buildWavePools(prioritizedMen, neededPerGender);
  const womenPool = buildWavePools(prioritizedWomen, neededPerGender);

  // Try strict 0-repeat-meeting solver (neither same-gender nor mixed-gender pairs have ever met)
  const exactSolution =
    solveZeroConflictMixedPool(
      courtCount,
      menPool.waveIds,
      womenPool.waveIds,
      statsMap,
      menPool.mustLen,
      womenPool.mustLen,
      true
    ) ||
    solveZeroConflictMixedPool(
      courtCount,
      menPool.waveIds,
      womenPool.waveIds,
      statsMap,
      0,
      0,
      true
    ) ||
    solveZeroConflictMixedPool(
      courtCount,
      menPool.allIds,
      womenPool.allIds,
      statsMap,
      menPool.mustLen,
      womenPool.mustLen,
      true
    ) ||
    solveZeroConflictMixedPool(
      courtCount,
      menPool.allIds,
      womenPool.allIds,
      statsMap,
      0,
      0,
      true
    ) ||
    solveZeroConflictMixedPool(
      courtCount,
      menPool.allIds,
      womenPool.allIds,
      statsMap,
      0,
      0,
      false
    );

  if (exactSolution) {
    return exactSolution.map((c) =>
      bestMixedCourtSplit(c.men, c.women, statsMap)
    );
  }

  let currentMen = menPool.allIds.slice(0, neededPerGender);
  let unusedMen = menPool.allIds.slice(neededPerGender);
  let currentWomen = womenPool.allIds.slice(0, neededPerGender);
  let unusedWomen = womenPool.allIds.slice(neededPerGender);

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

  for (let iter = 0; iter < 320; iter++) {
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
    } else if (mode === 2 && nextUnusedM.length > 0) {
      const slot = (iter * 13 + roundSeed) % neededPerGender;
      const uIdx = (iter * 17 + roundSeed) % nextUnusedM.length;
      const tmp = nextM[slot];
      nextM[slot] = nextUnusedM[uIdx];
      nextUnusedM[uIdx] = tmp;
    } else if (mode === 3 && nextUnusedW.length > 0) {
      const slot = (iter * 13 + roundSeed) % neededPerGender;
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
  phase: PlayPhase,
  seedBonus = 0
): Round {
  const nextRoundNumber = existingRounds.length + 1;
  const effectiveSeed = nextRoundNumber + seedBonus * 37;
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
      effectiveSeed,
      'GENDER'
    );
    const maxCourts = Math.min(mensCourts.length, Math.floor(availMen.length / 4));
    const results = optimizeSamePoolCourts(
      maxCourts,
      availMen,
      statsMap,
      effectiveSeed
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
      effectiveSeed + 100,
      'GENDER'
    );
    const maxCourts = Math.min(womensCourts.length, Math.floor(availWomen.length / 4));
    const results = optimizeSamePoolCourts(
      maxCourts,
      availWomen,
      statsMap,
      effectiveSeed + 100
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
      effectiveSeed + 200,
      'MIXED'
    );
    const availWomen = sortCandidatesByPriority(
      activePlayers.filter((p) => p.gender === 'F' && !assignedPlayerIds.has(p.id)),
      statsMap,
      effectiveSeed + 300,
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
      effectiveSeed
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
      effectiveSeed + 400
    );
    const maxCourts = Math.min(openCourts.length, Math.floor(availAny.length / 4));
    const results = optimizeSamePoolCourts(
      maxCourts,
      availAny,
      statsMap,
      effectiveSeed + 400
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
      effectiveSeed + 500
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
        effectiveSeed + 500
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
    effectiveSeed
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

function generateSingleTwoPhaseAttempt(
  players: Player[],
  genderGamesPerPlayer: number,
  mixedGamesPerPlayer: number,
  courtCount: number,
  menCourtsInPhase1: number,
  seedBonus: number
): Round[] {
  const rounds: Round[] = [];
  const activeMenCount = players.filter((p) => p.active && p.gender === 'M').length;
  const activeWomenCount = players.filter((p) => p.active && p.gender === 'F').length;

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

    const nextR = generateNextRound(
      players,
      rounds,
      roundCourts,
      'GENDER_SPLIT',
      seedBonus
    );
    rounds.push(nextR);

    menMatchesRemaining -= mCourts;
    womenMatchesRemaining -= wCourts;
  }

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
      const nextR = generateNextRound(
        players,
        rounds,
        roundCourts,
        'GENDER_SPLIT',
        seedBonus
      );
      rounds.push(nextR);
      openMatchesRemaining -= openThisRound;
    }
  }

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
        'MIXED_DOUBLES',
        seedBonus
      );
      rounds.push(nextR);
      mixedMatchesRemaining -= mixedThisRound;
    }
  }

  return rounds;
}

export function countScheduleRepeatMeetings(rounds: Round[]): number {
  let totalRepeats = 0;
  for (const r of rounds) {
    for (const m of [...(r.archivedMatches || []), ...r.matches]) {
      totalRepeats += (m.repeatPartners || 0) + (m.repeatOpponents || 0);
    }
  }
  return totalRepeats;
}

/**
 * Generates a two-phase Open Play schedule where:
 * - Phase 1 (Gender Doubles): Every active player plays `genderGamesPerPlayer` (default 4) Gender Doubles games.
 * - Phase 2 (Mixed Doubles): Every active player plays `mixedGamesPerPlayer` (default 1) Mixed Doubles game.
 * - Strict Rule: No player meets the same person again (0 repeat partners and 0 repeat opponents).
 */
export function generateTwoPhaseSchedule(
  players: Player[],
  genderGamesPerPlayer = 4,
  mixedGamesPerPlayer = 1,
  courtCount = 4,
  menCourtsInPhase1 = 2
): Round[] {
  let bestRounds: Round[] = [];
  let bestRepeats = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateSingleTwoPhaseAttempt(
      players,
      genderGamesPerPlayer,
      mixedGamesPerPlayer,
      courtCount,
      menCourtsInPhase1,
      attempt
    );
    const repeats = countScheduleRepeatMeetings(candidate);
    if (repeats < bestRepeats) {
      bestRepeats = repeats;
      bestRounds = candidate;
    }
    if (repeats === 0) {
      break;
    }
  }

  return bestRounds;
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


