/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crown,
  Eye,
  EyeOff,
  Link2,
  LogIn,
  LogOut,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  Trophy,
  Upload,
} from 'lucide-react';
import {
  CourtConfig,
  CourtMode,
  Gender,
  Player,
  PlayPhase,
  Round,
} from './types';
import {
  adjustRosterToCounts,
  advanceSingleCourtToNextGame,
  computePlayerStats,
  createInitialRoster,
  generateNextRound,
  generateTwoPhaseSchedule,
  ParsedBulkPlayer,
  parseBulkNamesText,
  syncRoundsWithUpdatedRoster,
} from './utils/scheduler';
import { CourtCard } from './components/CourtCard';
import { ScheduleQueueView } from './components/ScheduleQueueView';
import { PlayerRosterView } from './components/PlayerRosterView';
import { MatchupMatrixView } from './components/MatchupMatrixView';
import { ScoreboardView } from './components/ScoreboardView';
import {
  auth,
  DEFAULT_SESSION_ID,
  onAuthStateChanged,
  saveCloudSession,
  signInWithGoogle,
  signOutUser,
  subscribeToCloudSession,
  User,
} from './firebase';

type ActiveTab = 'courts' | 'scores' | 'schedule' | 'roster' | 'matrix';

export default function App() {
  const [players, setPlayers] = useState<Player[]>(() =>
    createInitialRoster(25, 20)
  );
  const [courtCount, setCourtCount] = useState<number>(4);
  const [menCourtsPhase1, setMenCourtsPhase1] = useState<number>(2);
  const [genderGamesTarget, setGenderGamesTarget] = useState<number>(4);
  const [mixedGamesTarget, setMixedGamesTarget] = useState<number>(1);

  const [rounds, setRounds] = useState<Round[]>(() => {
    const initialPlayers = createInitialRoster(25, 20);
    return generateTwoPhaseSchedule(initialPlayers, 4, 1, 4, 2);
  });

  const [activeRoundNumber, setActiveRoundNumber] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<ActiveTab>('courts');
  const [selectedSwapPlayerId, setSelectedSwapPlayerId] = useState<string | null>(
    null
  );
  const [sessionResetKey, setSessionResetKey] = useState<number>(0);

  // Quick Add Player & Quick .txt Upload state on the Live Courts Bench panel
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddGender, setQuickAddGender] = useState<Gender>('M');
  const [quickImportBanner, setQuickImportBanner] = useState<string | null>(null);
  const quickTxtInputRef = useRef<HTMLInputElement | null>(null);

  // Round Timer State (12 minutes default open-play game timer)
  const [timerSeconds, setTimerSeconds] = useState<number>(12 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [showOverviewDashboard, setShowOverviewDashboard] =
    useState<boolean>(true);

  // Firebase Auth & Real-Time Firestore Session Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [cloudSessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('session')?.trim();
      if (fromUrl && /^[a-zA-Z0-9_-]{1,128}$/.test(fromUrl)) {
        return fromUrl;
      }
    }
    return DEFAULT_SESSION_ID;
  });
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'offline' | 'connecting' | 'synced'
  >('offline');
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);

  const isApplyingRemoteUpdateRef = useRef<boolean>(false);
  const hasLoadedInitialRemoteRef = useRef<boolean>(false);
  const lastSyncedSignatureRef = useRef<string>('');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (!user) {
        setCloudSyncStatus('offline');
        hasLoadedInitialRemoteRef.current = false;
      }
    });
    return () => unsubAuth();
  }, []);

  // Subscribe to real-time Firestore updates once authenticated
  useEffect(() => {
    if (!authReady || !currentUser) return;
    setCloudSyncStatus('connecting');

    const unsubSession = subscribeToCloudSession(
      cloudSessionId,
      (remoteData) => {
        if (!remoteData) {
          // First time this cloud session is created: seed it with current state
          const initialSig = JSON.stringify({
            courtCount,
            menCourtsPhase1,
            genderGamesTarget,
            mixedGamesTarget,
            activeRoundNumber,
            players,
            rounds,
          });
          lastSyncedSignatureRef.current = initialSig;
          hasLoadedInitialRemoteRef.current = true;
          saveCloudSession(cloudSessionId, {
            courtCount,
            menCourtsPhase1,
            genderGamesTarget,
            mixedGamesTarget,
            activeRoundNumber,
            players,
            rounds,
          })
            .then(() => setCloudSyncStatus('synced'))
            .catch(() => setCloudSyncStatus('offline'));
          return;
        }

        const remoteSig = JSON.stringify({
          courtCount: remoteData.courtCount,
          menCourtsPhase1: remoteData.menCourtsPhase1,
          genderGamesTarget: remoteData.genderGamesTarget,
          mixedGamesTarget: remoteData.mixedGamesTarget,
          activeRoundNumber: remoteData.activeRoundNumber,
          players: remoteData.players,
          rounds: remoteData.rounds,
        });

        hasLoadedInitialRemoteRef.current = true;
        setCloudSyncStatus('synced');

        if (remoteSig !== lastSyncedSignatureRef.current) {
          isApplyingRemoteUpdateRef.current = true;
          lastSyncedSignatureRef.current = remoteSig;
          setCourtCount(remoteData.courtCount);
          setMenCourtsPhase1(remoteData.menCourtsPhase1);
          setGenderGamesTarget(remoteData.genderGamesTarget);
          setMixedGamesTarget(remoteData.mixedGamesTarget);
          setActiveRoundNumber(remoteData.activeRoundNumber);
          if (remoteData.players.length > 0) {
            setPlayers(remoteData.players);
          }
          if (remoteData.rounds.length > 0) {
            setRounds(remoteData.rounds);
          }
        }
      },
      () => {
        setCloudSyncStatus('offline');
      }
    );

    return () => unsubSession();
  }, [authReady, currentUser, cloudSessionId]);

  // Persist local mutations to Firestore so all connected devices stay in sync
  useEffect(() => {
    if (!authReady || !currentUser || !hasLoadedInitialRemoteRef.current) {
      return;
    }
    if (isApplyingRemoteUpdateRef.current) {
      isApplyingRemoteUpdateRef.current = false;
      return;
    }

    const localSig = JSON.stringify({
      courtCount,
      menCourtsPhase1,
      genderGamesTarget,
      mixedGamesTarget,
      activeRoundNumber,
      players,
      rounds,
    });

    if (localSig === lastSyncedSignatureRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastSyncedSignatureRef.current = localSig;
      saveCloudSession(cloudSessionId, {
        courtCount,
        menCourtsPhase1,
        genderGamesTarget,
        mixedGamesTarget,
        activeRoundNumber,
        players,
        rounds,
      }).catch(() => {
        // Error handled by handleFirestoreError
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    authReady,
    currentUser,
    cloudSessionId,
    courtCount,
    menCourtsPhase1,
    genderGamesTarget,
    mixedGamesTarget,
    activeRoundNumber,
    players,
    rounds,
  ]);

  const handleCopyLiveShareLink = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('session', cloudSessionId);
    navigator.clipboard?.writeText(shareUrl.toString());
    setCopiedShareLink(true);
    window.setTimeout(() => setCopiedShareLink(false), 2500);
  };

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const p of players) {
      map[p.id] = p;
    }
    return map;
  }, [players]);

  // Actual played stats (counts only completed games, starting at 0 for new/reset rosters)
  const playedStatsMap = useMemo(
    () => computePlayerStats(players, rounds, undefined, true),
    [players, rounds]
  );

  // Full scheduled stats across all pre-generated rounds (used in Matchup Matrix schedule audit)
  const fullStatsMap = useMemo(
    () => computePlayerStats(players, rounds, undefined, false),
    [players, rounds]
  );

  // Court appearances up through the currently active round (including completed or active court games)
  const statsUpToActiveRoundMap = useMemo(
    () => computePlayerStats(players, rounds, activeRoundNumber, false),
    [players, rounds, activeRoundNumber]
  );

  const currentRound =
    rounds.find((r) => r.roundNumber === activeRoundNumber) || rounds[0];

  const menPlayers = players.filter((p) => p.gender === 'M' && p.active);
  const womenPlayers = players.filter((p) => p.gender === 'F' && p.active);

  const {
    activePlayersCount,
    playersWithCompletedGameCount,
    playersOnCourtUpToRoundCount,
    playersCompletedTargetCount,
    allPlayersCompletedAtLeastOne,
    allPlayersOnCourtUpToRound,
    allPlayersFinishedTarget,
  } = useMemo(() => {
    const activeList = players.filter((p) => p.active);
    const totalActive = activeList.length;
    const targetGP = genderGamesTarget + mixedGamesTarget;

    let completedAtLeastOne = 0;
    let onCourtUpToNow = 0;
    let finishedTarget = 0;

    for (const p of activeList) {
      const doneGP = playedStatsMap[p.id]?.gamesPlayed || 0;
      const upToRoundGP = statsUpToActiveRoundMap[p.id]?.gamesPlayed || 0;
      if (doneGP >= 1) completedAtLeastOne += 1;
      if (doneGP >= 1 || upToRoundGP >= 1) onCourtUpToNow += 1;
      if (doneGP >= targetGP && targetGP > 0) finishedTarget += 1;
    }

    return {
      activePlayersCount: totalActive,
      playersWithCompletedGameCount: completedAtLeastOne,
      playersOnCourtUpToRoundCount: onCourtUpToNow,
      playersCompletedTargetCount: finishedTarget,
      allPlayersCompletedAtLeastOne:
        totalActive > 0 && completedAtLeastOne === totalActive,
      allPlayersOnCourtUpToRound:
        totalActive > 0 && onCourtUpToNow === totalActive,
      allPlayersFinishedTarget:
        totalActive > 0 && finishedTarget === totalActive,
    };
  }, [
    players,
    playedStatsMap,
    statsUpToActiveRoundMap,
    genderGamesTarget,
    mixedGamesTarget,
  ]);

  const minGamesPlayed = useMemo(() => {
    const activeIds = players.filter((p) => p.active).map((p) => p.id);
    if (activeIds.length === 0) return 0;
    return Math.min(...activeIds.map((id) => playedStatsMap[id]?.gamesPlayed || 0));
  }, [players, playedStatsMap]);

  const maxGamesPlayed = useMemo(() => {
    const activeIds = players.filter((p) => p.active).map((p) => p.id);
    if (activeIds.length === 0) return 0;
    return Math.max(...activeIds.map((id) => playedStatsMap[id]?.gamesPlayed || 0));
  }, [players, playedStatsMap]);

  // Compute global and active round telemetry for the dashboard overview & gauge
  const {
    totalScheduledMatches,
    completedMatchesTotal,
    currentRoundNovelty,
    phase1RoundsCount,
    phase2RoundsCount,
    phase1CompletedRounds,
  } = useMemo(() => {
    let totalM = 0;
    let doneM = 0;
    let p1Count = 0;
    let p2Count = 0;
    let p1Done = 0;

    for (const r of rounds) {
      const rMatches = [...(r.archivedMatches || []), ...r.matches];
      totalM += rMatches.length;
      const rCompleted = rMatches.filter((m) => m.completed).length;
      doneM += rCompleted;
      if (r.phase === 'GENDER_SPLIT') {
        p1Count++;
        if (rMatches.length > 0 && rCompleted === rMatches.length) p1Done++;
      } else if (r.phase === 'MIXED_DOUBLES') {
        p2Count++;
      }
    }

    const activeMatches = currentRound?.matches || [];
    const avgNov =
      activeMatches.length > 0
        ? Math.round(
            activeMatches.reduce((acc, m) => acc + m.noveltyScore, 0) /
              activeMatches.length
          )
        : 100;

    return {
      totalScheduledMatches: totalM,
      completedMatchesTotal: doneM,
      currentRoundNovelty: avgNov,
      phase1RoundsCount: p1Count,
      phase2RoundsCount: p2Count,
      phase1CompletedRounds: p1Done,
    };
  }, [rounds, currentRound]);

  const sessionProgressPct =
    totalScheduledMatches > 0
      ? Math.round((completedMatchesTotal / totalScheduledMatches) * 100)
      : 0;

  // Compute Individual Men & Women Crown Champions (Highest Score) and Mixed Doubles Highest Score
  const { topManChampion, topWomanChampion, topMixedPair } = useMemo(() => {
    const buildIndividualCandidates = (gender: Gender) => {
      return players
        .filter((p) => p.gender === gender && p.active)
        .map((player) => {
          const st = playedStatsMap[player.id];
          const wins = st?.wins || 0;
          const losses = st?.losses || 0;
          const pointsFor = st?.pointsFor || 0;
          const pointsAgainst = st?.pointsAgainst || 0;
          const pointDiff = pointsFor - pointsAgainst;
          const completedGames = wins + losses;
          return {
            player,
            wins,
            losses,
            pointsFor,
            pointsAgainst,
            pointDiff,
            completedGames,
            hasScore: completedGames > 0 || pointsFor > 0,
          };
        })
        .sort((a, b) => {
          if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
          return a.player.name.localeCompare(b.player.name);
        });
    };

    const menRanked = buildIndividualCandidates('M');
    const womenRanked = buildIndividualCandidates('F');

    const mixedMap: Record<
      string,
      {
        pairKey: string;
        pairName: string;
        gamesPlayed: number;
        wins: number;
        losses: number;
        pointsFor: number;
        pointsAgainst: number;
        bestGameScore: number;
      }
    > = {};

    for (const r of rounds) {
      const allMatches = [...(r.archivedMatches || []), ...r.matches];
      for (const m of allMatches) {
        if (m.mode !== 'MIXED_DOUBLES') continue;

        const recordMixedTeam = (
          team: [string, string],
          myScore: number | null,
          oppScore: number | null,
          completed: boolean
        ) => {
          const [id1, id2] = [...team].sort();
          const p1 = playerMap[id1];
          const p2 = playerMap[id2];
          if (!p1 || !p2) return;
          const key = `${id1}__${id2}`;
          if (!mixedMap[key]) {
            mixedMap[key] = {
              pairKey: key,
              pairName: `${p1.name} & ${p2.name}`,
              gamesPlayed: 0,
              wins: 0,
              losses: 0,
              pointsFor: 0,
              pointsAgainst: 0,
              bestGameScore: 0,
            };
          }
          if (completed && myScore !== null && oppScore !== null) {
            mixedMap[key].gamesPlayed += 1;
            mixedMap[key].pointsFor += myScore;
            mixedMap[key].pointsAgainst += oppScore;
            if (myScore > mixedMap[key].bestGameScore) {
              mixedMap[key].bestGameScore = myScore;
            }
            if (myScore > oppScore) mixedMap[key].wins += 1;
            if (oppScore > myScore) mixedMap[key].losses += 1;
          }
        };

        recordMixedTeam(m.teamA, m.scoreA, m.scoreB, m.completed);
        recordMixedTeam(m.teamB, m.scoreB, m.scoreA, m.completed);
      }
    }

    const mixedRanked = Object.values(mixedMap).sort((a, b) => {
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      if (b.wins !== a.wins) return b.wins - a.wins;
      const diffA = a.pointsFor - a.pointsAgainst;
      const diffB = b.pointsFor - b.pointsAgainst;
      if (diffB !== diffA) return diffB - diffA;
      return b.gamesPlayed - a.gamesPlayed;
    });

    const bestMan =
      menRanked.find((candidate) => candidate.pointsFor > 0) || null;
    const bestWoman =
      womenRanked.find((candidate) => candidate.pointsFor > 0) || null;
    const bestMixed =
      mixedRanked.find((candidate) => candidate.pointsFor > 0) || null;

    return {
      topManChampion: bestMan,
      topWomanChampion: bestWoman,
      topMixedPair: bestMixed
        ? {
            ...bestMixed,
            pointDiff: bestMixed.pointsFor - bestMixed.pointsAgainst,
            hasScore: true,
          }
        : null,
    };
  }, [players, playedStatsMap, rounds, playerMap]);

  // Helper to rebuild active + future rounds with a given list of CourtConfigs for active round
  const rebuildFromActiveRound = (
    activeRoundConfigs: CourtConfig[],
    newTotalCourts: number,
    newMenPhase1Count: number
  ) => {
    if (!currentRound) return;
    setSelectedSwapPlayerId(null);

    setRounds((prevRounds) => {
      const updatedRounds: Round[] = [];
      for (const r of prevRounds) {
        if (r.roundNumber < activeRoundNumber) {
          updatedRounds.push(r);
        } else if (r.roundNumber === activeRoundNumber) {
          const allMixed = activeRoundConfigs.every(
            (c) => c.mode === 'MIXED_DOUBLES'
          );
          const regen = generateNextRound(
            players,
            updatedRounds,
            activeRoundConfigs,
            allMixed ? 'MIXED_DOUBLES' : r.phase
          );
          regen.roundNumber = r.roundNumber;
          updatedRounds.push(regen);
        } else {
          const futureConfigs: CourtConfig[] = Array.from(
            { length: newTotalCourts },
            (_, idx) => ({
              id: idx + 1,
              name: `Court ${idx + 1}`,
              mode:
                r.phase === 'MIXED_DOUBLES'
                  ? 'MIXED_DOUBLES'
                  : idx < newMenPhase1Count
                  ? 'MENS_DOUBLES'
                  : 'WOMENS_DOUBLES',
            })
          );
          const regen = generateNextRound(
            players,
            updatedRounds,
            futureConfigs,
            r.phase
          );
          regen.roundNumber = r.roundNumber;
          updatedRounds.push(regen);
        }
      }
      return updatedRounds;
    });
  };

  // Dynamically Add a Court in Live Courts
  const handleAddCourt = (requestedMode?: CourtMode) => {
    if (!currentRound) return;

    const benchMen = currentRound.benchPlayerIds.filter(
      (id) => playerMap[id]?.gender === 'M'
    ).length;
    const benchWomen = currentRound.benchPlayerIds.filter(
      (id) => playerMap[id]?.gender === 'F'
    ).length;

    let chosenMode: CourtMode =
      requestedMode ||
      (currentRound.phase === 'MIXED_DOUBLES'
        ? 'MIXED_DOUBLES'
        : benchMen >= benchWomen
        ? 'MENS_DOUBLES'
        : 'WOMENS_DOUBLES');

    if (chosenMode === 'MENS_DOUBLES' && benchMen < 4) {
      if (benchMen >= 2 && benchWomen >= 2) chosenMode = 'MIXED_DOUBLES';
      else if (benchWomen >= 4) chosenMode = 'WOMENS_DOUBLES';
      else chosenMode = 'OPEN_DOUBLES';
    } else if (chosenMode === 'WOMENS_DOUBLES' && benchWomen < 4) {
      if (benchMen >= 2 && benchWomen >= 2) chosenMode = 'MIXED_DOUBLES';
      else if (benchMen >= 4) chosenMode = 'MENS_DOUBLES';
      else chosenMode = 'OPEN_DOUBLES';
    } else if (chosenMode === 'MIXED_DOUBLES' && (benchMen < 2 || benchWomen < 2)) {
      if (benchMen >= 4) chosenMode = 'MENS_DOUBLES';
      else if (benchWomen >= 4) chosenMode = 'WOMENS_DOUBLES';
      else chosenMode = 'OPEN_DOUBLES';
    }

    const existingConfigs: CourtConfig[] = currentRound.matches.map(
      (m, idx) => ({
        id: idx + 1,
        name: `Court ${idx + 1}`,
        mode: m.mode,
      })
    );

    const nextCourtNumber = existingConfigs.length + 1;
    const nextConfigs: CourtConfig[] = [
      ...existingConfigs,
      {
        id: nextCourtNumber,
        name: `Court ${nextCourtNumber}`,
        mode: chosenMode,
      },
    ];

    const nextMenPhase1 =
      chosenMode === 'MENS_DOUBLES'
        ? menCourtsPhase1 + 1
        : Math.min(nextCourtNumber, menCourtsPhase1);

    setCourtCount(nextCourtNumber);
    setMenCourtsPhase1(nextMenPhase1);
    rebuildFromActiveRound(nextConfigs, nextCourtNumber, nextMenPhase1);
  };

  // Dynamically Remove a specific Court (or last Court) in Live Courts
  const handleRemoveCourt = (courtIdToRemove?: number) => {
    if (!currentRound || currentRound.matches.length <= 1) return;

    const targetId =
      courtIdToRemove ??
      currentRound.matches[currentRound.matches.length - 1].courtId;

    const remainingMatches = currentRound.matches.filter(
      (m) => m.courtId !== targetId
    );

    const nextConfigs: CourtConfig[] = remainingMatches.map((m, idx) => ({
      id: idx + 1,
      name: `Court ${idx + 1}`,
      mode: m.mode,
    }));

    const nextCourtCount = Math.max(1, nextConfigs.length);
    const nextMenPhase1 = Math.min(
      nextCourtCount,
      nextConfigs.filter((c) => c.mode === 'MENS_DOUBLES').length ||
        Math.ceil(nextCourtCount / 2)
    );

    setCourtCount(nextCourtCount);
    setMenCourtsPhase1(nextMenPhase1);
    rebuildFromActiveRound(nextConfigs, nextCourtCount, nextMenPhase1);
  };

  const handleAdvanceRound = () => {
    setSelectedSwapPlayerId(null);

    // Record scores for the finished round's games when advancing
    const finishedRoundNum = activeRoundNumber;
    const finalizedRounds = rounds.map((r) => {
      if (r.roundNumber !== finishedRoundNum) return r;
      return {
        ...r,
        matches: r.matches.map((m) =>
          m.completed
            ? m
            : {
                ...m,
                scoreA: m.scoreA ?? 11,
                scoreB: m.scoreB ?? 8,
                completed: true,
              }
        ),
      };
    });

    if (activeRoundNumber < finalizedRounds.length) {
      setRounds(finalizedRounds);
      setActiveRoundNumber(activeRoundNumber + 1);
      setTimerSeconds(12 * 60);
      setTimerRunning(false);
    } else {
      const configs: CourtConfig[] = Array.from(
        { length: courtCount },
        (_, idx) => ({
          id: idx + 1,
          name: `Court ${idx + 1}`,
          mode: 'MIXED_DOUBLES',
        })
      );
      const newRound = generateNextRound(
        players,
        finalizedRounds,
        configs,
        'MIXED_DOUBLES'
      );
      setRounds([...finalizedRounds, newRound]);
      setActiveRoundNumber(newRound.roundNumber);
      setTimerSeconds(12 * 60);
      setTimerRunning(false);
    }
  };

  const handleAppendRound = (phase: PlayPhase, jumpToNew = false) => {
    const configs: CourtConfig[] = Array.from({ length: courtCount }, (_, idx) => ({
      id: idx + 1,
      name: `Court ${idx + 1}`,
      mode:
        phase === 'MIXED_DOUBLES'
          ? 'MIXED_DOUBLES'
          : idx < menCourtsPhase1
          ? 'MENS_DOUBLES'
          : 'WOMENS_DOUBLES',
    }));

    const newRound = generateNextRound(players, rounds, configs, phase);
    const updated = [...rounds, newRound];
    setRounds(updated);
    if (jumpToNew) {
      setActiveRoundNumber(newRound.roundNumber);
      setTimerSeconds(12 * 60);
      setTimerRunning(false);
    }
  };

  const handleApplyRoundPreset = (
    preset: 'SPLIT_MW' | 'ALL_M' | 'ALL_W' | 'ALL_MIXED'
  ) => {
    if (!currentRound) return;
    setSelectedSwapPlayerId(null);

    const priorRounds = rounds.filter(
      (r) => r.roundNumber < currentRound.roundNumber
    );

    const activeCourtTotal = Math.max(1, currentRound.matches.length || courtCount);

    const configs: CourtConfig[] = Array.from(
      { length: activeCourtTotal },
      (_, idx) => {
        let mode: CourtMode = 'MIXED_DOUBLES';
        if (preset === 'SPLIT_MW') {
          mode =
            idx < Math.ceil(activeCourtTotal / 2)
              ? 'MENS_DOUBLES'
              : 'WOMENS_DOUBLES';
        } else if (preset === 'ALL_M') {
          mode = 'MENS_DOUBLES';
        } else if (preset === 'ALL_W') {
          mode = 'WOMENS_DOUBLES';
        } else {
          mode = 'MIXED_DOUBLES';
        }
        return {
          id: idx + 1,
          name: `Court ${idx + 1}`,
          mode,
        };
      }
    );

    const newPhase: PlayPhase =
      preset === 'ALL_MIXED' ? 'MIXED_DOUBLES' : 'GENDER_SPLIT';

    const regenerated = generateNextRound(
      players,
      priorRounds,
      configs,
      newPhase
    );
    regenerated.roundNumber = currentRound.roundNumber;

    setRounds((prev) =>
      prev.map((r) =>
        r.roundNumber === currentRound.roundNumber ? regenerated : r
      )
    );
  };

  const handleChangeSingleCourtMode = (courtId: number, mode: CourtMode) => {
    if (!currentRound) return;
    setSelectedSwapPlayerId(null);

    const priorRounds = rounds.filter(
      (r) => r.roundNumber < currentRound.roundNumber
    );

    const activeCourtTotal = Math.max(1, currentRound.matches.length || courtCount);

    const configs: CourtConfig[] = Array.from(
      { length: activeCourtTotal },
      (_, idx) => {
        const cid = idx + 1;
        const existingMatch = currentRound.matches.find((m) => m.courtId === cid);
        return {
          id: cid,
          name: `Court ${cid}`,
          mode: cid === courtId ? mode : existingMatch?.mode || 'MIXED_DOUBLES',
        };
      }
    );

    const allMixed = configs.every((c) => c.mode === 'MIXED_DOUBLES');
    const regenerated = generateNextRound(
      players,
      priorRounds,
      configs,
      allMixed ? 'MIXED_DOUBLES' : 'GENDER_SPLIT'
    );
    regenerated.roundNumber = currentRound.roundNumber;

    setRounds((prev) =>
      prev.map((r) =>
        r.roundNumber === currentRound.roundNumber ? regenerated : r
      )
    );
  };

  const handleSelectSwapPlayer = (targetPlayerId: string) => {
    if (!selectedSwapPlayerId) {
      setSelectedSwapPlayerId(targetPlayerId);
      return;
    }
    if (selectedSwapPlayerId === targetPlayerId) {
      setSelectedSwapPlayerId(null);
      return;
    }

    const p1 = selectedSwapPlayerId;
    const p2 = targetPlayerId;

    setRounds((prevRounds) =>
      prevRounds.map((round) => {
        if (round.roundNumber !== activeRoundNumber) return round;

        const swapId = (id: string) => {
          if (id === p1) return p2;
          if (id === p2) return p1;
          return id;
        };

        const updatedMatches = round.matches.map((m) => ({
          ...m,
          teamA: [swapId(m.teamA[0]), swapId(m.teamA[1])] as [string, string],
          teamB: [swapId(m.teamB[0]), swapId(m.teamB[1])] as [string, string],
        }));

        const updatedBench = round.benchPlayerIds.map((id) => swapId(id));

        return {
          ...round,
          matches: updatedMatches,
          benchPlayerIds: updatedBench,
        };
      })
    );

    setSelectedSwapPlayerId(null);
  };

  const handleUpdateScore = (
    matchId: string,
    scoreA: number | null,
    scoreB: number | null,
    completed: boolean
  ) => {
    handleUpdateMatchScoreAnyRound(
      activeRoundNumber,
      matchId,
      scoreA,
      scoreB,
      completed
    );
  };

  const handleUpdateMatchScoreAnyRound = (
    roundNumber: number,
    matchId: string,
    scoreA: number | null,
    scoreB: number | null,
    completed: boolean
  ) => {
    setRounds((prevRounds) =>
      prevRounds.map((r) => {
        if (r.roundNumber !== roundNumber) return r;
        return {
          ...r,
          archivedMatches: r.archivedMatches?.map((m) =>
            m.id === matchId ? { ...m, scoreA, scoreB, completed } : m
          ),
          matches: r.matches.map((m) =>
            m.id === matchId ? { ...m, scoreA, scoreB, completed } : m
          ),
        };
      })
    );
  };

  const handleNextCourtGame = (courtId: number) => {
    setSelectedSwapPlayerId(null);
    setRounds((prevRounds) =>
      advanceSingleCourtToNextGame(
        players,
        prevRounds,
        activeRoundNumber,
        courtId
      )
    );
  };

  // Roster management handlers with automatic schedule & bench synchronization
  const handleAddPlayer = (name: string, gender: Gender): Player => {
    const newPlayer: Player = {
      id: `${gender.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      gender,
      active: true,
    };
    const nextPlayers = [newPlayer, ...players];
    setPlayers(nextPlayers);
    setRounds((prevRounds) =>
      syncRoundsWithUpdatedRoster(
        nextPlayers,
        prevRounds,
        activeRoundNumber,
        courtCount,
        menCourtsPhase1,
        genderGamesTarget,
        mixedGamesTarget
      )
    );
    return newPlayer;
  };

  const handleBulkImportPlayers = (
    parsedPlayers: ParsedBulkPlayer[],
    mode: 'REPLACE' | 'APPEND'
  ) => {
    if (parsedPlayers.length === 0) return;

    let finalRoster: Player[] = [];
    if (mode === 'REPLACE') {
      finalRoster = parsedPlayers.map((item, idx) => ({
        id: `${item.gender === 'M' ? 'm' : 'f'}-bulk-${Date.now()}-${idx}`,
        name: item.name,
        gender: item.gender,
        active: true,
      }));
    } else {
      const addedList: Player[] = parsedPlayers.map((item, idx) => ({
        id: `${item.gender === 'M' ? 'm' : 'f'}-bulk-${Date.now()}-${idx}`,
        name: item.name,
        gender: item.gender,
        active: true,
      }));

      finalRoster = [
        ...players.map((p) => ({ ...p, active: true })),
        ...addedList,
      ];
    }

    const totalMen = finalRoster.filter((p) => p.gender === 'M').length;
    const totalWomen = finalRoster.filter((p) => p.gender === 'F').length;
    const maxPossibleCourts = Math.max(1, Math.floor(finalRoster.length / 4));
    const resetCourtCount = Math.max(1, Math.min(4, maxPossibleCourts));

    let finalMenCourts = Math.round(resetCourtCount / 2);
    if (totalWomen < 4 && totalMen >= 4) {
      finalMenCourts = resetCourtCount;
    } else if (totalMen < 4 && totalWomen >= 4) {
      finalMenCourts = 0;
    } else if (totalMen + totalWomen > 0) {
      finalMenCourts = Math.max(
        1,
        Math.min(
          resetCourtCount - 1,
          Math.round((totalMen / (totalMen + totalWomen)) * resetCourtCount)
        )
      );
    }

    const freshSchedule = generateTwoPhaseSchedule(
      finalRoster,
      4,
      1,
      resetCourtCount,
      finalMenCourts
    );

    // Completely reset all session state, scores, stats, round number, and timer
    setSelectedSwapPlayerId(null);
    setTimerRunning(false);
    setTimerSeconds(12 * 60);
    setQuickAddName('');
    setPlayers(finalRoster);
    setCourtCount(resetCourtCount);
    setMenCourtsPhase1(finalMenCourts);
    setGenderGamesTarget(4);
    setMixedGamesTarget(1);
    setRounds(freshSchedule);
    setActiveRoundNumber(1);
    setSessionResetKey((prev) => prev + 1);
  };

  const handleQuickTxtUploadOnBench = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const parsed = parseBulkNamesText(content, quickAddGender);
      if (parsed.length > 0) {
        handleBulkImportPlayers(parsed, 'REPLACE');
        const mCount = parsed.filter((p) => p.gender === 'M').length;
        const wCount = parsed.filter((p) => p.gender === 'F').length;
        setQuickImportBanner(
          `Loaded ${parsed.length} players (${mCount} Men, ${wCount} Women) from "${file.name}"`
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleQuickAddOnBench = (e: React.FormEvent) => {
    e.preventDefault();
    const fallbackNum =
      players.filter((p) => p.gender === quickAddGender).length + 1;
    const finalName =
      quickAddName.trim() ||
      `${quickAddGender === 'M' ? 'Men' : 'Women'} Player ${fallbackNum}`;
    handleAddPlayer(finalName, quickAddGender);
    setQuickAddName('');
  };

  const handleToggleActive = (playerId: string) => {
    const nextPlayers = players.map((p) =>
      p.id === playerId ? { ...p, active: !p.active } : p
    );
    setPlayers(nextPlayers);
    setRounds((prevRounds) =>
      syncRoundsWithUpdatedRoster(
        nextPlayers,
        prevRounds,
        activeRoundNumber,
        courtCount,
        menCourtsPhase1,
        genderGamesTarget,
        mixedGamesTarget
      )
    );
  };

  const handleDeletePlayer = (playerId: string) => {
    const nextPlayers = players.filter((p) => p.id !== playerId);
    setPlayers(nextPlayers);
    setRounds((prevRounds) =>
      syncRoundsWithUpdatedRoster(
        nextPlayers,
        prevRounds,
        activeRoundNumber,
        courtCount,
        menCourtsPhase1,
        genderGamesTarget,
        mixedGamesTarget
      )
    );
  };

  const handleBulkDeletePlayers = (playerIds: string[]) => {
    const removeSet = new Set(playerIds);
    const nextPlayers = players.filter((p) => !removeSet.has(p.id));
    setPlayers(nextPlayers);
    setRounds((prevRounds) =>
      syncRoundsWithUpdatedRoster(
        nextPlayers,
        prevRounds,
        activeRoundNumber,
        courtCount,
        menCourtsPhase1,
        genderGamesTarget,
        mixedGamesTarget
      )
    );
  };

  const handleClearAllPlayers = () => {
    setSelectedSwapPlayerId(null);
    setTimerRunning(false);
    setTimerSeconds(12 * 60);
    setPlayers([]);
    setRounds([
      {
        roundNumber: 1,
        phase: 'GENDER_SPLIT',
        matches: [],
        benchPlayerIds: [],
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    setActiveRoundNumber(1);
    setSessionResetKey((prev) => prev + 1);
  };

  const handleResetRoundsKeepRoster = () => {
    setSelectedSwapPlayerId(null);
    setTimerRunning(false);
    setTimerSeconds(12 * 60);
    const freshSchedule = generateTwoPhaseSchedule(
      players,
      genderGamesTarget,
      mixedGamesTarget,
      courtCount,
      menCourtsPhase1
    );
    setRounds(freshSchedule);
    setActiveRoundNumber(1);
    setSessionResetKey((prev) => prev + 1);
  };

  const handleRebuildWithCurrentRoster = (
    targetMenCount: number,
    targetWomenCount: number,
    newCourtCount: number,
    newMenCourtsPhase1: number,
    genderGamesPerPlayer: number,
    mixedGamesPerPlayer: number
  ) => {
    setSelectedSwapPlayerId(null);
    setTimerRunning(false);
    setTimerSeconds(12 * 60);
    const adjustedRoster = adjustRosterToCounts(
      players,
      targetMenCount,
      targetWomenCount
    );
    const freshSchedule = generateTwoPhaseSchedule(
      adjustedRoster,
      genderGamesPerPlayer,
      mixedGamesPerPlayer,
      newCourtCount,
      newMenCourtsPhase1
    );
    setPlayers(adjustedRoster);
    setCourtCount(newCourtCount);
    setMenCourtsPhase1(newMenCourtsPhase1);
    setGenderGamesTarget(genderGamesPerPlayer);
    setMixedGamesTarget(mixedGamesPerPlayer);
    setRounds(freshSchedule);
    setActiveRoundNumber(1);
    setSessionResetKey((prev) => prev + 1);
    setActiveTab('courts');
  };

  const handleResetToDefaultSample = () => {
    setSelectedSwapPlayerId(null);
    setTimerRunning(false);
    setTimerSeconds(12 * 60);
    const defaultRoster = createInitialRoster(25, 20);
    const defaultSchedule = generateTwoPhaseSchedule(defaultRoster, 4, 1, 4, 2);
    setPlayers(defaultRoster);
    setCourtCount(4);
    setMenCourtsPhase1(2);
    setGenderGamesTarget(4);
    setMixedGamesTarget(1);
    setRounds(defaultSchedule);
    setActiveRoundNumber(1);
    setSessionResetKey((prev) => prev + 1);
  };

  const activeCourtsInRound = currentRound?.matches.length || courtCount;
  const canAddMoreCourts =
    (currentRound?.benchPlayerIds.length || 0) >= 4;

  const currentGenderRoundsCount = genderGamesTarget;
  const currentMixedRoundsCount = mixedGamesTarget;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6F3] text-[#111312]">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="bg-white border-b border-[#E6EAE4] sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#courts"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('courts');
            }}
            className="text-lg font-bold tracking-tight text-[#111312] font-display whitespace-nowrap shrink-0"
          >
            PICKLE &amp; SMASH DXB Open Play
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('courts')}
              className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'courts'
                  ? 'bg-[#111312] text-white font-semibold'
                  : 'bg-white border border-[#E6EAE4] text-slate-700 hover:bg-[#F7F8F5] hover:text-[#111312]'
              }`}
            >
              Live Courts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scores')}
              className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'scores'
                  ? 'bg-[#111312] text-white font-semibold'
                  : 'bg-white border border-[#E6EAE4] text-slate-700 hover:bg-[#F7F8F5] hover:text-[#111312]'
              }`}
            >
              Score
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'schedule'
                  ? 'bg-[#111312] text-white font-semibold'
                  : 'bg-white border border-[#E6EAE4] text-slate-700 hover:bg-[#F7F8F5] hover:text-[#111312]'
              }`}
            >
              Full Schedule
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'roster'
                  ? 'bg-[#111312] text-white font-semibold'
                  : 'bg-white border border-[#E6EAE4] text-slate-700 hover:bg-[#F7F8F5] hover:text-[#111312]'
              }`}
            >
              Player Roster
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'matrix'
                  ? 'bg-[#111312] text-white font-semibold'
                  : 'bg-white border border-[#E6EAE4] text-slate-700 hover:bg-[#F7F8F5] hover:text-[#111312]'
              }`}
            >
              Matchup Matrix
            </button>
          </nav>

          {/* Zone 3: Cloud Sync + Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-[#F5F6F3] border border-[#E6EAE4] px-2.5 py-1.5 rounded-xl">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111312] whitespace-nowrap">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cloudSyncStatus === 'synced'
                        ? 'bg-[#98F64F] ring-2 ring-[#98F64F]/40'
                        : 'bg-[#F7D348]'
                    }`}
                  />
                  <span>
                    {cloudSyncStatus === 'synced' ? 'Live Sync' : 'Syncing...'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyLiveShareLink}
                  className="px-2 py-1 text-[11px] font-semibold bg-white border border-[#E6EAE4] rounded-lg hover:bg-[#ECEFE9] transition-colors flex items-center gap-1 whitespace-nowrap"
                  title="Copy live session link to share across devices"
                >
                  <Link2 className="w-3 h-3" />
                  <span>{copiedShareLink ? 'Copied!' : 'Share Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="p-1 text-slate-500 hover:text-[#111312] rounded-lg transition-colors"
                  title={`Signed in as ${currentUser.email || 'User'} · Click to Sign Out`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="px-3.5 py-2 text-xs font-semibold text-[#111312] bg-[#98F64F] rounded-xl hover:bg-[#88E63E] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In for Live Sync</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAdvanceRound}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#111312] rounded-xl hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0"
            >
              Advance to Round {activeRoundNumber + 1}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Strip */}
      <div className="md:hidden bg-white border-b border-[#E6EAE4] px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {(
          [
            ['courts', 'Live Courts'],
            ['scores', 'Score'],
            ['schedule', 'Full Schedule'],
            ['roster', 'Player Roster'],
            ['matrix', 'Matchup Matrix'],
          ] as Array<[ActiveTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 ${
              activeTab === key
                ? 'bg-[#111312] text-white'
                : 'text-slate-600 bg-[#F5F6F3] hover:bg-[#EAECE7]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Content Container (1440px max-width) */}
      <main className="max-w-[1440px] w-full mx-auto px-6 py-6 flex-1 space-y-5">
        {/* Hide / Unhide Overview Dashboard Bar */}
        <div className="bg-white border border-[#E6EAE4] rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#111312]">
              <span className="w-2 h-2 rounded-full bg-[#98F64F]" />
              <span>Overview &amp; Champions Dashboard</span>
            </span>

            {/* Compact summary pills shown when dashboard is hidden (or always for quick glance) */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1 bg-[#F5F6F3] border border-[#E6EAE4] rounded-lg px-2 py-1 font-mono font-semibold text-[#111312]">
                <button
                  type="button"
                  disabled={activeRoundNumber <= 1}
                  onClick={() => {
                    setSelectedSwapPlayerId(null);
                    setActiveRoundNumber((r) => Math.max(1, r - 1));
                  }}
                  className="hover:text-slate-600 disabled:opacity-30"
                  title="Previous Round"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span>
                  R{activeRoundNumber}/{rounds.length}
                </span>
                <button
                  type="button"
                  disabled={activeRoundNumber >= rounds.length}
                  onClick={() => {
                    setSelectedSwapPlayerId(null);
                    setActiveRoundNumber((r) => Math.min(rounds.length, r + 1));
                  }}
                  className="hover:text-slate-600 disabled:opacity-30"
                  title="Next Round"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="px-2.5 py-1 rounded-lg bg-[#F5F6F3] border border-[#E6EAE4] font-semibold text-[#111312] whitespace-nowrap">
                {activeCourtsInRound} Courts · {activePlayersCount} Players · {currentRound?.benchPlayerIds.length || 0} Bench
              </span>

              {/* All Players Played Status Indicator */}
              {allPlayersFinishedTarget ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111312] border border-[#F7D348] text-[#F7D348] font-bold whitespace-nowrap">
                  <Check className="w-3.5 h-3.5 text-[#98F64F] shrink-0" />
                  <span>
                    All {activePlayersCount} Players Completed All {genderGamesTarget + mixedGamesTarget} Games!
                  </span>
                </span>
              ) : allPlayersCompletedAtLeastOne ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#98F64F] text-[#111312] font-bold whitespace-nowrap shadow-2xs">
                  <Check className="w-3.5 h-3.5 text-[#111312] shrink-0" />
                  <span>
                    All {activePlayersCount} Players Have Played! (Min {minGamesPlayed} GP)
                  </span>
                </span>
              ) : allPlayersOnCourtUpToRound ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFFCE6] border border-[#65C71C] text-[#1E5E08] font-bold whitespace-nowrap">
                  <Check className="w-3.5 h-3.5 text-[#287D0C] shrink-0" />
                  <span>
                    All {activePlayersCount} Players Assigned to Court by R{activeRoundNumber} ({playersWithCompletedGameCount}/{activePlayersCount} Scored)
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF8DE] border border-[#F7D348] text-[#5C4500] font-semibold whitespace-nowrap">
                  <span>
                    Played: {playersWithCompletedGameCount}/{activePlayersCount} Scored · {playersOnCourtUpToRoundCount}/{activePlayersCount} On Court ({activePlayersCount - playersOnCourtUpToRoundCount} waiting 1st game)
                  </span>
                </span>
              )}

              <button
                type="button"
                onClick={() => setTimerRunning(!timerRunning)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111312] text-white font-mono font-semibold whitespace-nowrap hover:bg-[#272B29] transition-colors"
                title={timerRunning ? 'Pause Round Timer' : 'Start Round Timer'}
              >
                {timerRunning ? (
                  <Pause className="w-3 h-3 text-[#98F64F]" />
                ) : (
                  <Play className="w-3 h-3 text-[#98F64F]" />
                )}
                <span>{formatTimer(timerSeconds)}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowOverviewDashboard((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              showOverviewDashboard
                ? 'bg-[#F5F6F3] hover:bg-[#EAECE6] text-[#111312] border border-[#E6EAE4]'
                : 'bg-[#98F64F] hover:bg-[#88E63E] text-[#111312]'
            }`}
          >
            {showOverviewDashboard ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide Overview</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Unhide Overview</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Two-Column Asymmetric Dashboard Hero (Matching Reference Graphic) */}
        {showOverviewDashboard && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: 3-Step Progression Timeline + Colored Division Counters + Hatched Overview Card */}
          <div className="lg:col-span-7 bg-white border border-[#E6EAE4] rounded-2xl p-5 flex flex-col gap-4">
            {/* Step 1-3 Progression Timeline (solid black checkmark icons + dashed connector lines) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-[#E6EAE4]">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-[#111312] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-[#98F64F]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#111312]">
                    Phase 1 · Rounds 1–{phase1RoundsCount || 1}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    <span className="font-semibold text-[#111312]">
                      {genderGamesTarget} Gender Doubles
                    </span>{' '}
                    games per player
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    currentRound?.phase === 'MIXED_DOUBLES' ||
                    phase1CompletedRounds >= phase1RoundsCount
                      ? 'bg-[#111312] text-white'
                      : 'bg-[#F2F4F0] text-slate-500 border border-[#E6EAE4]'
                  }`}
                >
                  <Check
                    className={`w-4 h-4 ${
                      currentRound?.phase === 'MIXED_DOUBLES' ||
                      phase1CompletedRounds >= phase1RoundsCount
                        ? 'text-[#98F64F]'
                        : 'text-slate-400'
                    }`}
                  />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#111312]">
                    Phase 2 · Mixed ({phase2RoundsCount} Rds)
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    <span className="font-semibold text-[#111312]">
                      {mixedGamesTarget} Mixed Doubles
                    </span>{' '}
                    game per player
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    completedMatchesTotal > 0 &&
                    completedMatchesTotal === totalScheduledMatches
                      ? 'bg-[#111312] text-white'
                      : 'bg-[#F2F4F0] text-slate-500 border border-[#E6EAE4]'
                  }`}
                >
                  <Check
                    className={`w-4 h-4 ${
                      completedMatchesTotal > 0 &&
                      completedMatchesTotal === totalScheduledMatches
                        ? 'text-[#98F64F]'
                        : 'text-slate-400'
                    }`}
                  />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#111312]">
                    Final Standings
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    Record scores &amp; export{' '}
                    <span className="font-semibold text-[#111312]">
                      CSV stats
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Colored Counter Tabs (Coral, Electric Lime, Warm Gold — matching Reference Image) */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => setActiveTab('courts')}
                  className="flex items-center gap-2.5 text-left group"
                >
                  <span className="w-7 h-7 rounded-full bg-[#F06449] text-white text-xs font-mono tabular-nums font-bold flex items-center justify-center shrink-0">
                    {activeCourtsInRound}
                  </span>
                  <span className="text-sm font-semibold text-[#111312] group-hover:underline whitespace-nowrap">
                    Active Courts
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('roster')}
                  className="flex items-center gap-2.5 text-left group"
                >
                  <span className="w-7 h-7 rounded-full bg-[#98F64F] text-[#111312] text-xs font-mono tabular-nums font-bold flex items-center justify-center shrink-0">
                    {players.filter((p) => p.active).length}
                  </span>
                  <span className="text-sm font-semibold text-[#111312] group-hover:underline whitespace-nowrap">
                    Active Players ({menPlayers.length} Men · {womenPlayers.length} Women)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('courts')}
                  className="flex items-center gap-2.5 text-left group"
                >
                  <span className="w-7 h-7 rounded-full bg-[#F7D348] text-[#111312] text-xs font-mono tabular-nums font-bold flex items-center justify-center shrink-0">
                    {currentRound?.benchPlayerIds.length || 0}
                  </span>
                  <span className="text-sm font-semibold text-[#111312] group-hover:underline whitespace-nowrap">
                    Bench Queue
                  </span>
                </button>
              </div>

              {/* Add / Remove Court Controls */}
              <div className="flex items-center gap-1.5 bg-[#F5F6F3] p-1 rounded-xl border border-[#E6EAE4]">
                <button
                  type="button"
                  disabled={activeCourtsInRound <= 1}
                  onClick={() => handleRemoveCourt()}
                  title="Remove last court"
                  className="px-2.5 py-1.5 text-xs font-medium text-[#111312] bg-white rounded-lg disabled:opacity-40 hover:bg-[#EEF1EC] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>Remove Court</span>
                </button>
                <span className="px-2.5 text-xs font-mono tabular-nums font-semibold text-[#111312] whitespace-nowrap shrink-0">
                  {activeCourtsInRound}{' '}
                  {activeCourtsInRound === 1 ? 'Court' : 'Courts'}
                </span>
                <button
                  type="button"
                  disabled={!canAddMoreCourts}
                  onClick={() => handleAddCourt()}
                  className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#111312] rounded-lg disabled:opacity-40 hover:bg-[#272B29] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[#98F64F]" />
                  <span>Add Court</span>
                </button>
              </div>
            </div>

            {/* Session Overview Box with Diagonal Hatched Spectrum Bar */}
            <div className="bg-[#F8F9F6] border border-[#E6EAE4] rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#111312] font-display">
                    Overview ·{' '}
                    {currentRound?.phase === 'MIXED_DOUBLES'
                      ? `Round ${activeRoundNumber} Mixed Doubles`
                      : `Round ${activeRoundNumber} Gender Doubles`}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Every player is scheduled for {genderGamesTarget} Gender Doubles games and {mixedGamesTarget} Mixed Doubles game ({genderGamesTarget + mixedGamesTarget} total games).
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-white border border-[#E6EAE4] p-1 rounded-xl">
                  <button
                    type="button"
                    disabled={activeRoundNumber <= 1}
                    onClick={() => {
                      setSelectedSwapPlayerId(null);
                      setActiveRoundNumber((r) => Math.max(1, r - 1));
                    }}
                    className="p-1.5 text-[#111312] rounded-lg disabled:opacity-40 hover:bg-[#F5F6F3] transition-colors"
                    title="Previous Round"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2.5 text-xs font-mono tabular-nums font-semibold text-[#111312] whitespace-nowrap shrink-0">
                    Round {activeRoundNumber} / {rounds.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeRoundNumber >= rounds.length}
                    onClick={() => {
                      setSelectedSwapPlayerId(null);
                      setActiveRoundNumber((r) => Math.min(rounds.length, r + 1));
                    }}
                    className="p-1.5 text-[#111312] rounded-lg disabled:opacity-40 hover:bg-[#F5F6F3] transition-colors"
                    title="Next Round"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Signature Spectrum Diagonal Hatched Bar */}
              <div className="w-full h-4 bg-[#E9ECE6] rounded-md overflow-hidden p-0.5">
                <div
                  className="h-full spectrum-hatch-bar rounded-sm transition-opacity"
                  style={{
                    width: `${Math.max(
                      12,
                      Math.round((activeRoundNumber / Math.max(1, rounds.length)) * 100)
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-xs text-slate-500">
                    Completed Games / Player
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#111312]">
                    {minGamesPlayed} – {maxGamesPlayed}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      of {genderGamesTarget + mixedGamesTarget} target
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">
                    Recorded Match Scores
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#111312]">
                    {completedMatchesTotal} / {totalScheduledMatches}
                  </div>
                </div>
              </div>

              {/* All Players Played Rotation Indicator Banner inside Overview */}
              <div
                className={`rounded-xl px-3.5 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-xs ${
                  allPlayersFinishedTarget
                    ? 'bg-[#111312] border-[#F7D348] text-white'
                    : allPlayersCompletedAtLeastOne
                    ? 'bg-[#EFFCE6] border-[#65C71C] text-[#111312]'
                    : allPlayersOnCourtUpToRound
                    ? 'bg-[#F3FDE8] border-[#98F64F] text-[#111312]'
                    : 'bg-white border-[#E6EAE4] text-[#111312]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      allPlayersCompletedAtLeastOne || allPlayersOnCourtUpToRound
                        ? 'bg-[#98F64F] text-[#111312]'
                        : 'bg-[#F7D348] text-[#111312]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-bold">
                    {allPlayersFinishedTarget
                      ? `All ${activePlayersCount} Players Completed All ${
                          genderGamesTarget + mixedGamesTarget
                        } Target Games!`
                      : allPlayersCompletedAtLeastOne
                      ? `All ${activePlayersCount} Active Players Have Played at Least 1 Completed Game!`
                      : allPlayersOnCourtUpToRound
                      ? `All ${activePlayersCount} Active Players Have Stepped On Court by Round ${activeRoundNumber}!`
                      : `Player Rotation Progress: ${playersOnCourtUpToRoundCount} of ${activePlayersCount} Players Have Been On Court`}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] whitespace-nowrap ${
                    allPlayersFinishedTarget
                      ? 'bg-[#F7D348] text-[#111312]'
                      : allPlayersCompletedAtLeastOne || allPlayersOnCourtUpToRound
                      ? 'bg-[#111312] text-[#98F64F]'
                      : 'bg-[#FFF8DE] text-[#5C4500] border border-[#F7D348]'
                  }`}
                >
                  {allPlayersCompletedAtLeastOne
                    ? `100% Played (${playersCompletedTargetCount}/${activePlayersCount} at ${
                        genderGamesTarget + mixedGamesTarget
                      } GP)`
                    : allPlayersOnCourtUpToRound
                    ? `100% On Court · ${playersWithCompletedGameCount}/${activePlayersCount} Scored`
                    : `${
                        activePlayersCount - playersOnCourtUpToRoundCount
                      } Waiting for 1st Game`}
                </span>
              </div>
            </div>

            {/* Round Timeline Pills & Court Presets */}
            <div className="bg-[#F8F9F6] border border-[#E6EAE4] rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#111312]">
                  Session Rounds ({rounds.length} Total)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Courts:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApplyRoundPreset('SPLIT_MW')}
                    className="px-2.5 py-1 text-xs font-medium text-[#111312] bg-white border border-[#E6EAE4] rounded-lg hover:bg-[#ECEFE9] transition-colors whitespace-nowrap shrink-0"
                  >
                    Split Men &amp; Women
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyRoundPreset('ALL_M')}
                    className="px-2.5 py-1 text-xs font-medium text-[#111312] bg-white border border-[#E6EAE4] rounded-lg hover:bg-[#ECEFE9] transition-colors whitespace-nowrap shrink-0"
                  >
                    All Men
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyRoundPreset('ALL_W')}
                    className="px-2.5 py-1 text-xs font-medium text-[#111312] bg-white border border-[#E6EAE4] rounded-lg hover:bg-[#ECEFE9] transition-colors whitespace-nowrap shrink-0"
                  >
                    All Women
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyRoundPreset('ALL_MIXED')}
                    className="px-2.5 py-1 text-xs font-semibold text-[#111312] bg-[#98F64F] rounded-lg hover:bg-[#88E63E] transition-colors whitespace-nowrap shrink-0"
                  >
                    All Mixed
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {rounds.map((r) => {
                  const isSelected = r.roundNumber === activeRoundNumber;
                  const isMixed = r.phase === 'MIXED_DOUBLES';
                  return (
                    <button
                      key={r.roundNumber}
                      type="button"
                      onClick={() => {
                        setSelectedSwapPlayerId(null);
                        setActiveRoundNumber(r.roundNumber);
                      }}
                      className={`px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#111312] text-white border-[#111312] font-semibold'
                          : isMixed
                          ? 'bg-[#EFFCE6] text-[#1E5E08] border-[#BCEE94] hover:bg-[#E2FAD1]'
                          : 'bg-white text-slate-700 border-[#E6EAE4] hover:bg-[#ECEFE9]'
                      }`}
                    >
                      R{r.roundNumber} · {isMixed ? 'Mixed' : 'Gender'}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleAppendRound('MIXED_DOUBLES', true)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#111312] bg-[#98F64F] rounded-lg hover:bg-[#88E63E] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Mixed Round</span>
                </button>
              </div>
            </div>

            {/* Active Round Courts Snapshot Grid (Fills Left Card Cleanly Without Empty Gaps) */}
            <div className="bg-[#F8F9F6] border border-[#E6EAE4] rounded-xl p-4 flex-1 flex flex-col justify-start gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#111312]">
                  Round {activeRoundNumber} Live Court Lineup
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('courts')}
                  className="text-xs font-semibold text-slate-600 hover:text-[#111312] flex items-center gap-1"
                >
                  <span>Manage Courts</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(currentRound?.matches || []).map((match) => {
                  const pA1 = playerMap[match.teamA[0]]?.name || 'TBD';
                  const pA2 = playerMap[match.teamA[1]]?.name || 'TBD';
                  const pB1 = playerMap[match.teamB[0]]?.name || 'TBD';
                  const pB2 = playerMap[match.teamB[1]]?.name || 'TBD';
                  const modeTag =
                    match.mode === 'MENS_DOUBLES'
                      ? 'Men'
                      : match.mode === 'WOMENS_DOUBLES'
                      ? 'Women'
                      : 'Mixed';
                  return (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => setActiveTab('courts')}
                      className="bg-white border border-[#E6EAE4] rounded-xl p-3 text-left hover:border-[#111312]/30 transition-colors flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#111312]">
                          {match.courtName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
                              match.mode === 'MIXED_DOUBLES'
                                ? 'bg-[#98F64F] text-[#111312]'
                                : match.mode === 'WOMENS_DOUBLES'
                                ? 'bg-[#FCE592] text-[#5C4500]'
                                : 'bg-[#111312] text-white'
                            }`}
                          >
                            {modeTag}
                          </span>
                          {match.completed && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#EFFCE6] text-[#1E5E08] border border-[#BCEE94]">
                              {match.scoreA}–{match.scoreB}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-700 truncate">
                        <span className="font-semibold text-[#111312]">
                          {pA1} &amp; {pA2}
                        </span>{' '}
                        <span className="text-slate-400">vs</span>{' '}
                        <span className="font-semibold text-[#111312]">
                          {pB1} &amp; {pB2}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Mint Spotlight Panel with Semi-Circular Gauge + 6-Card Metric Grid (Matching Reference Graphic) */}
          <div className="lg:col-span-5 mint-spotlight-panel border border-[#DCEAD9] rounded-2xl p-5 flex flex-col justify-between gap-4">
            {/* Top Center Greeting & Semi-Circular Gauge */}
            <div className="text-center space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-600">
                PICKLE &amp; SMASH DXB · Round {activeRoundNumber}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#111312] font-display">
                Here is your live court rotation rate
              </h1>

              {/* 3-Mode Switcher (like TransUnion | Equifax | Experian in reference) */}
              <div className="inline-flex items-center gap-1 p-1 bg-white/80 border border-[#DCEAD9] rounded-xl mt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('courts')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'courts'
                      ? 'bg-white text-[#111312] shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-[#111312]'
                  }`}
                >
                  Live Courts
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'schedule'
                      ? 'bg-white text-[#111312] shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-[#111312]'
                  }`}
                >
                  Full Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('scores')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'scores'
                      ? 'bg-white text-[#111312] shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-[#111312]'
                  }`}
                >
                  Standings
                </button>
              </div>

              {/* Semi-Circular Arch Gauge with Diagonal Hatched Spectrum */}
              <div className="relative max-w-[270px] mx-auto pt-2">
                <svg
                  viewBox="0 0 240 135"
                  className="w-full h-auto overflow-visible"
                  aria-label="Matchup Novelty & Session Gauge"
                >
                  <defs>
                    <linearGradient
                      id="gaugeGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#F06449" />
                      <stop offset="50%" stopColor="#F7D348" />
                      <stop offset="100%" stopColor="#98F64F" />
                    </linearGradient>
                  </defs>
                  {/* Background Track */}
                  <path
                    d="M 24 115 A 96 96 0 0 1 216 115"
                    fill="none"
                    stroke="#DCE6D9"
                    strokeWidth="20"
                    strokeLinecap="round"
                  />
                  {/* Spectrum Arc */}
                  <path
                    d="M 24 115 A 96 96 0 0 1 216 115"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="20"
                    strokeLinecap="round"
                    strokeDasharray="301.6"
                    strokeDashoffset={
                      301.6 - (301.6 * Math.max(15, currentRoundNovelty)) / 100
                    }
                  />
                  {/* Dashed Hatch Overlay on Arc */}
                  <path
                    d="M 24 115 A 96 96 0 0 1 216 115"
                    fill="none"
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth="20"
                    strokeDasharray="2 4"
                  />
                  {/* Scale Labels */}
                  <text
                    x="6"
                    y="122"
                    className="fill-slate-500 text-[9px] font-mono"
                  >
                    0%
                  </text>
                  <text
                    x="28"
                    y="50"
                    className="fill-slate-500 text-[9px] font-mono"
                  >
                    4G
                  </text>
                  <text
                    x="110"
                    y="12"
                    className="fill-slate-500 text-[9px] font-mono"
                  >
                    R{activeRoundNumber}
                  </text>
                  <text
                    x="196"
                    y="50"
                    className="fill-slate-500 text-[9px] font-mono"
                  >
                    1M
                  </text>
                  <text
                    x="216"
                    y="122"
                    className="fill-slate-500 text-[9px] font-mono"
                  >
                    100%
                  </text>
                </svg>

                {/* Center Score / Timer Readout */}
                <div className="-mt-16 flex flex-col items-center">
                  <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-[#98F64F] text-[#111312] rounded-md">
                    ▲ {currentRoundNovelty}% Unique
                  </span>
                  <div className="text-4xl font-bold font-mono tabular-nums text-[#111312] tracking-tight mt-1">
                    {formatTimer(timerSeconds)}
                  </div>
                </div>
              </div>

              {/* Solid Jet-Black Primary CTA below Gauge */}
              <div className="pt-1 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#111312] rounded-xl hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-[#98F64F]" />
                      <span>Pause Round Timer</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-[#98F64F]" />
                      <span>Start Round Timer</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(12 * 60);
                  }}
                  title="Reset timer to 12:00"
                  className="p-2 text-slate-700 bg-white/90 border border-[#DCEAD9] rounded-xl hover:bg-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Crown Champions (Individual Men & Women Highest Score) + Mixed Doubles Highest Score */}
            <div className="bg-[#111312] border-2 border-[#F7D348] rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#F7D348]">
                  <span className="w-6 h-6 rounded-lg bg-[#F7D348] text-[#111312] flex items-center justify-center shrink-0">
                    <Crown className="w-3.5 h-3.5 fill-[#111312] text-[#111312]" />
                  </span>
                  <span>Crown Champions · Highest Score</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('scores')}
                  className="px-2.5 py-1 rounded-lg bg-[#98F64F] text-[#111312] text-[11px] font-bold hover:bg-[#88E63E] transition-colors flex items-center gap-0.5"
                >
                  <span>Leaderboard</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Individual Men & Women Highest Score Crown Champions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Men's Crown Champion */}
                <button
                  type="button"
                  onClick={() => setActiveTab('scores')}
                  className="bg-gradient-to-br from-[#FFFDF4] to-[#FFF6CC] border-2 border-[#F7D348] rounded-xl p-3.5 text-left hover:brightness-102 transition-all relative overflow-hidden group shadow-xs"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#111312] text-[#F7D348] text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap shrink-0">
                      <Crown className="w-3 h-3 fill-[#F7D348] text-[#F7D348] shrink-0" />
                      Men Champion
                    </span>
                    <span className="text-xs font-mono tabular-nums font-extrabold px-2 py-0.5 rounded-lg bg-[#98F64F] text-[#111312] border border-[#111312]/15 whitespace-nowrap shrink-0">
                      {topManChampion ? `${topManChampion.pointsFor} PTS` : '0 PTS'}
                    </span>
                  </div>
                  <div className="mt-2 font-extrabold text-base sm:text-lg text-[#111312] truncate">
                    {topManChampion && topManChampion.pointsFor > 0
                      ? topManChampion.player.name
                      : '—'}
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-[#F7D348]/50 flex items-center justify-between text-xs font-mono tabular-nums text-slate-700">
                    <span className="font-semibold">
                      {topManChampion
                        ? `${topManChampion.wins}W - ${topManChampion.losses}L`
                        : '0W - 0L'}
                    </span>
                    <span className="font-extrabold text-[#111312] bg-white/80 px-1.5 py-0.5 rounded">
                      Diff:{' '}
                      {topManChampion
                        ? topManChampion.pointDiff > 0
                          ? `+${topManChampion.pointDiff}`
                          : topManChampion.pointDiff
                        : '0'}
                    </span>
                  </div>
                </button>

                {/* Women's Crown Champion */}
                <button
                  type="button"
                  onClick={() => setActiveTab('scores')}
                  className="bg-gradient-to-br from-[#FFFDF4] to-[#FFF6CC] border-2 border-[#F7D348] rounded-xl p-3.5 text-left hover:brightness-102 transition-all relative overflow-hidden group shadow-xs"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#111312] text-[#F7D348] text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap shrink-0">
                      <Crown className="w-3 h-3 fill-[#F7D348] text-[#F7D348] shrink-0" />
                      Women Champion
                    </span>
                    <span className="text-xs font-mono tabular-nums font-extrabold px-2 py-0.5 rounded-lg bg-[#F7D348] text-[#111312] border border-[#111312]/15 whitespace-nowrap shrink-0">
                      {topWomanChampion
                        ? `${topWomanChampion.pointsFor} PTS`
                        : '0 PTS'}
                    </span>
                  </div>
                  <div className="mt-2 font-extrabold text-base sm:text-lg text-[#111312] truncate">
                    {topWomanChampion && topWomanChampion.pointsFor > 0
                      ? topWomanChampion.player.name
                      : '—'}
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-[#F7D348]/50 flex items-center justify-between text-xs font-mono tabular-nums text-slate-700">
                    <span className="font-semibold">
                      {topWomanChampion
                        ? `${topWomanChampion.wins}W - ${topWomanChampion.losses}L`
                        : '0W - 0L'}
                    </span>
                    <span className="font-extrabold text-[#111312] bg-white/80 px-1.5 py-0.5 rounded">
                      Diff:{' '}
                      {topWomanChampion
                        ? topWomanChampion.pointDiff > 0
                          ? `+${topWomanChampion.pointDiff}`
                          : topWomanChampion.pointDiff
                        : '0'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Below: Highest Score for Mixed Doubles */}
              <button
                type="button"
                onClick={() => setActiveTab('scores')}
                className="w-full bg-gradient-to-r from-[#F3FDE8] to-[#E2FBC7] border-2 border-[#98F64F] rounded-xl p-3.5 text-left hover:brightness-102 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#111312] text-[#98F64F] text-[10px] font-extrabold uppercase tracking-wide">
                    <Trophy className="w-3 h-3 text-[#98F64F]" />
                    Mixed Double Champion
                  </span>
                  <span className="text-sm font-mono tabular-nums font-extrabold px-2.5 py-0.5 rounded-lg bg-[#98F64F] text-[#111312] border border-[#111312]/15">
                    {topMixedPair ? `${topMixedPair.pointsFor} PTS` : '0 PTS'}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <div className="font-extrabold text-base sm:text-lg text-[#111312] truncate">
                    {topMixedPair && topMixedPair.pointsFor > 0
                      ? topMixedPair.pairName
                      : '—'}
                  </div>
                  <div className="text-xs font-mono tabular-nums font-bold text-[#111312] bg-white/80 px-2 py-0.5 rounded shrink-0">
                    {topMixedPair
                      ? `${topMixedPair.wins}W - ${topMixedPair.losses}L (${
                          topMixedPair.pointDiff > 0
                            ? `+${topMixedPair.pointDiff}`
                            : topMixedPair.pointDiff
                        })`
                      : '0W - 0L'}
                  </div>
                </div>
              </button>
            </div>

            {/* 6-Card Metric Grid (2x3) Matching the Bottom-Right of the Reference Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className="bg-white/95 border border-[#E2ECE0] rounded-xl p-3 text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="truncate">Novelty rate</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-lg font-bold font-mono tabular-nums text-[#111312]">
                    {currentRoundNovelty}%
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#98F64F] text-[#111312] whitespace-nowrap">
                    Optimal
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  Unique court pairings
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="bg-white/95 border border-[#E2ECE0] rounded-xl p-3 text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="truncate">Gender double</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-lg font-bold font-mono tabular-nums text-[#111312]">
                    {genderGamesTarget} GP
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#98F64F] text-[#111312] whitespace-nowrap">
                    Phase 1
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  {phase1RoundsCount} Gender rounds
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="bg-white/95 border border-[#E2ECE0] rounded-xl p-3 text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="truncate">Mixed double</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-lg font-bold font-mono tabular-nums text-[#111312]">
                    {mixedGamesTarget} GP
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#98F64F] text-[#111312] whitespace-nowrap">
                    Phase 2
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  {phase2RoundsCount} Mixed rounds
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('roster')}
                className="bg-white/95 border border-[#E2ECE0] rounded-xl p-3 text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="truncate">Men roster</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-lg font-bold font-mono tabular-nums text-[#111312]">
                    {menPlayers.length}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#D7F7B8] text-[#1E5E08] whitespace-nowrap">
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  Checked-in Men
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('roster')}
                className="bg-white/95 border border-[#E2ECE0] rounded-xl p-3 text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="truncate">Women roster</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-lg font-bold font-mono tabular-nums text-[#111312]">
                    {womenPlayers.length}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FCE592] text-[#5C4500] whitespace-nowrap">
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  Checked-in Women
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('scores')}
                className="bg-white/95 border border-[#E2ECE0] rounded-xl p-3 text-left hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="truncate">Completed</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-1">
                  <span className="text-lg font-bold font-mono tabular-nums text-[#111312]">
                    {sessionProgressPct}%
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F06449] text-white whitespace-nowrap">
                    {completedMatchesTotal} Done
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  Recorded match scores
                </p>
              </button>
            </div>
          </div>
        </section>
        )}

        {/* Active Swap Banner */}
        {selectedSwapPlayerId && (
          <div className="bg-[#FFF8DE] border border-[#F7D348] rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="text-xs text-[#111312]">
              <span className="font-semibold">Swap Mode Active:</span> Selected{' '}
              <span className="font-mono font-semibold">
                {playerMap[selectedSwapPlayerId]?.name}
              </span>
              . Click any other player on a court or in the Priority Bench Queue below to swap their positions.
            </div>
            <button
              type="button"
              onClick={() => setSelectedSwapPlayerId(null)}
              className="px-3 py-1 text-xs font-medium bg-[#111312] text-white rounded-lg hover:bg-[#272B29] whitespace-nowrap shrink-0"
            >
              Cancel Swap
            </button>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'courts' && currentRound && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Active Courts Grid + Add Court Card (8 cols on large desktop) */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              {currentRound.matches.map((match) => (
                <CourtCard
                  key={match.id}
                  match={match}
                  canRemoveCourt={currentRound.matches.length > 1}
                  playerMap={playerMap}
                  statsMap={playedStatsMap}
                  selectedSwapPlayerId={selectedSwapPlayerId}
                  onSelectSwapPlayer={handleSelectSwapPlayer}
                  onUpdateScore={handleUpdateScore}
                  onChangeCourtMode={handleChangeSingleCourtMode}
                  onRemoveCourt={handleRemoveCourt}
                  onNextCourtGame={handleNextCourtGame}
                />
              ))}

              {/* Interactive Add Court Card inside Live Courts Grid */}
              <div className="bg-white border border-dashed border-[#CFD7CC] rounded-2xl p-5 flex flex-col justify-between min-h-[260px]">
                <div>
                  <h3 className="text-base font-bold text-[#111312] font-display">
                    Add Court {activeCourtsInRound + 1}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {canAddMoreCourts
                      ? `${currentRound.benchPlayerIds.length} resting players available on the bench. Choose a division to open another court immediately:`
                      : `Need at least 4 resting players on the bench to open Court ${
                          activeCourtsInRound + 1
                        } (currently ${
                          currentRound.benchPlayerIds.length
                        } resting). Add more players or remove a court.`}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  <button
                    type="button"
                    disabled={!canAddMoreCourts}
                    onClick={() => handleAddCourt('MENS_DOUBLES')}
                    className="px-3 py-2 text-xs font-medium text-[#111312] bg-[#F7F8F5] border border-[#E6EAE4] rounded-xl hover:bg-[#ECEFE9] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#287D0C]" />
                    <span>Add Men&apos;s Court</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canAddMoreCourts}
                    onClick={() => handleAddCourt('WOMENS_DOUBLES')}
                    className="px-3 py-2 text-xs font-medium text-[#111312] bg-[#F7F8F5] border border-[#E6EAE4] rounded-xl hover:bg-[#ECEFE9] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#287D0C]" />
                    <span>Add Women&apos;s Court</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canAddMoreCourts}
                    onClick={() => handleAddCourt('MIXED_DOUBLES')}
                    className="px-3 py-2 text-xs font-semibold text-[#111312] bg-[#98F64F] rounded-xl hover:bg-[#88E63E] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#111312]" />
                    <span>Add Mixed Court</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canAddMoreCourts}
                    onClick={() => handleAddCourt('OPEN_DOUBLES')}
                    className="px-3 py-2 text-xs font-medium text-[#111312] bg-[#F7F8F5] border border-[#E6EAE4] rounded-xl hover:bg-[#ECEFE9] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>Add Open Court</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Priority Bench Queue & Quick Add / Bulk .txt Upload (4 cols on large desktop) */}
            <aside className="lg:col-span-4 bg-white border border-[#E6EAE4] rounded-2xl p-5 space-y-4">
              <div className="pb-3 border-b border-[#E6EAE4]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#98F64F] text-[#111312] text-xs font-mono tabular-nums font-bold flex items-center justify-center shrink-0">
                      {currentRound.benchPlayerIds.length}
                    </span>
                    <h2 className="text-base font-bold text-[#111312] font-display">
                      Priority Bench Queue
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={quickTxtInputRef}
                      type="file"
                      accept=".txt,.csv,text/plain"
                      onChange={handleQuickTxtUploadOnBench}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => quickTxtInputRef.current?.click()}
                      className="px-2.5 py-1 text-xs font-medium text-[#111312] bg-[#F2F4F0] rounded-lg hover:bg-[#E5E9E2] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                      title="Upload a .txt file of player names"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload .txt</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Ordered by rotation priority (fewest games played &amp; longest bench streak enter next round first).
                </p>

                {/* Bench Indicator when All Players Have Played */}
                <div
                  className={`mt-2.5 px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    allPlayersCompletedAtLeastOne || allPlayersOnCourtUpToRound
                      ? 'bg-[#EFFCE6] border-[#65C71C] text-[#111312]'
                      : 'bg-[#FFFDF4] border-[#F7D348] text-[#5C4500]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check
                      className={`w-3.5 h-3.5 shrink-0 ${
                        allPlayersCompletedAtLeastOne || allPlayersOnCourtUpToRound
                          ? 'text-[#287D0C]'
                          : 'text-[#B45309]'
                      }`}
                    />
                    <span>
                      {allPlayersFinishedTarget
                        ? `All ${activePlayersCount} players completed ${
                            genderGamesTarget + mixedGamesTarget
                          } GP!`
                        : allPlayersCompletedAtLeastOne
                        ? `All ${activePlayersCount} players have played already!`
                        : allPlayersOnCourtUpToRound
                        ? `All ${activePlayersCount} players have been on court by R${activeRoundNumber}!`
                        : `${
                            activePlayersCount - playersOnCourtUpToRoundCount
                          } player(s) still waiting for 1st game`}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[11px] whitespace-nowrap">
                    {playersWithCompletedGameCount}/{activePlayersCount} Scored
                  </span>
                </div>

                {quickImportBanner && (
                  <div className="mt-2.5 px-3 py-2 bg-[#EFFCE6] border border-[#BCEE94] rounded-xl text-xs text-[#111312] flex items-center justify-between gap-2">
                    <span>{quickImportBanner}</span>
                    <button
                      type="button"
                      onClick={() => setQuickImportBanner(null)}
                      className="text-[#287D0C] font-semibold shrink-0"
                    >
                      OK
                    </button>
                  </div>
                )}

                {/* Quick Add Player Form directly on Live Courts Bench */}
                <form
                  onSubmit={handleQuickAddOnBench}
                  className="mt-3 pt-3 border-t border-[#E6EAE4] flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    placeholder="Add player name..."
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
                  />
                  <select
                    aria-label="Quick add player division"
                    value={quickAddGender}
                    onChange={(e) => setQuickAddGender(e.target.value as Gender)}
                    className="px-2 py-1.5 text-xs bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
                  >
                    <option value="M">Men</option>
                    <option value="F">Women</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#111312] rounded-lg hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#98F64F]" />
                    <span>Add</span>
                  </button>
                </form>
              </div>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {currentRound.benchPlayerIds.map((pid, idx) => {
                  const player = playerMap[pid];
                  const st = playedStatsMap[pid];
                  const completedGP = st?.gamesPlayed || 0;
                  const courtGPUpToRound =
                    statsUpToActiveRoundMap[pid]?.gamesPlayed || 0;
                  const targetGP = genderGamesTarget + mixedGamesTarget;
                  const isNextUp = idx < activeCourtsInRound * 4;
                  const isSelected = selectedSwapPlayerId === pid;
                  if (!player) return null;

                  return (
                    <div
                      key={pid}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                        isSelected
                          ? 'bg-[#EFFCE6] border-[#65C71C]'
                          : isNextUp
                          ? 'bg-[#F7F8F5] border-[#E6EAE4]'
                          : 'bg-white border-[#E6EAE4]/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-mono tabular-nums font-bold flex items-center justify-center shrink-0 ${
                              isNextUp
                                ? 'bg-[#98F64F] text-[#111312]'
                                : 'bg-[#F2F4F0] text-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-[#111312] truncate">
                            {player.name}
                          </span>
                          {completedGP >= targetGP && targetGP > 0 ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#111312] text-[#98F64F] whitespace-nowrap shrink-0">
                              ✓ All {completedGP} GP Done
                            </span>
                          ) : completedGP > 0 ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#EFFCE6] text-[#1E5E08] border border-[#BCEE94] whitespace-nowrap shrink-0">
                              ✓ Played ({completedGP} GP)
                            </span>
                          ) : courtGPUpToRound > 0 ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#E9F7EC] text-[#1E5E08] whitespace-nowrap shrink-0">
                              ✓ Played On Court
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#FFF8DE] text-[#5C4500] border border-[#F7D348] whitespace-nowrap shrink-0">
                              0 GP · Waiting
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 pl-7">
                          <span>{player.gender === 'M' ? 'Men' : 'Women'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{completedGP} GP</span>
                          <span aria-hidden="true">·</span>
                          <span>Wait {st?.currentBenchStreak || 0}</span>
                          {isNextUp && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#287D0C] font-semibold">
                                Next Up
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectSwapPlayer(pid)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                          isSelected
                            ? 'bg-[#111312] text-white border-[#111312]'
                            : selectedSwapPlayerId
                            ? 'bg-[#FFF6D6] text-[#5C4500] border-[#F7D348] hover:bg-[#FCEB9F]'
                            : 'bg-white text-slate-700 border-[#E6EAE4] hover:bg-[#F2F4F0]'
                        }`}
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        <span>{isSelected ? 'Selected' : 'Swap In'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'scores' && (
          <ScoreboardView
            key={`scores-${sessionResetKey}`}
            players={players}
            statsMap={playedStatsMap}
            rounds={rounds}
            onUpdateMatchScore={handleUpdateMatchScoreAnyRound}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleQueueView
            key={`schedule-${sessionResetKey}`}
            rounds={rounds}
            players={players}
            activeRoundNumber={activeRoundNumber}
            onSelectRound={(rNum) => {
              setActiveRoundNumber(rNum);
              setActiveTab('courts');
            }}
            onAppendRound={(phase) => handleAppendRound(phase, false)}
            onUpdateMatchScore={handleUpdateMatchScoreAnyRound}
          />
        )}

        {activeTab === 'roster' && (
          <PlayerRosterView
            players={players}
            statsMap={playedStatsMap}
            currentCourtCount={courtCount}
            currentMenCourtsPhase1={menCourtsPhase1}
            currentGenderRoundsCount={currentGenderRoundsCount}
            currentMixedRoundsCount={currentMixedRoundsCount}
            onAddPlayer={handleAddPlayer}
            onBulkImportPlayers={handleBulkImportPlayers}
            onToggleActive={handleToggleActive}
            onDeletePlayer={handleDeletePlayer}
            onBulkDeletePlayers={handleBulkDeletePlayers}
            onClearAllPlayers={handleClearAllPlayers}
            onResetRoundsKeepRoster={handleResetRoundsKeepRoster}
            onRebuildWithCurrentRoster={handleRebuildWithCurrentRoster}
            onResetToDefaultSample={handleResetToDefaultSample}
          />
        )}

        {activeTab === 'matrix' && (
          <MatchupMatrixView
            key={`matrix-${sessionResetKey}`}
            players={players}
            statsMap={playedStatsMap}
            scheduledStatsMap={fullStatsMap}
            rounds={rounds}
          />
        )}
      </main>
    </div>
  );
}
