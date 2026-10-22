import React, { useState, useMemo } from 'react';
import { Search, Flame, Grid, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Player, PlayerStats, Round } from '../types';

interface MatchupMatrixViewProps {
  players: Player[];
  statsMap: Record<string, PlayerStats>;
  scheduledStatsMap: Record<string, PlayerStats>;
  rounds: Round[];
}

type HeatmapRelationMode = 'ALL' | 'PARTNERS' | 'OPPONENTS';

interface PairDetail {
  playerA: Player;
  playerB: Player;
  partnerCount: number;
  opponentCount: number;
  totalCount: number;
  roundDetails: {
    roundNumber: number;
    courtNumber: number;
    relation: 'PARTNER' | 'OPPONENT';
    completed: boolean;
  }[];
}

export const MatchupMatrixView: React.FC<MatchupMatrixViewProps> = ({
  players,
  statsMap,
  scheduledStatsMap,
  rounds,
}) => {
  const [viewMode, setViewMode] = useState<'PLAYED' | 'SCHEDULED'>('SCHEDULED');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [heatmapRelation, setHeatmapRelation] =
    useState<HeatmapRelationMode>('ALL');
  const [onlyImbalancedRows, setOnlyImbalancedRows] = useState(false);
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string>(
    players[0]?.id || ''
  );
  const [selectedCellPair, setSelectedCellPair] = useState<{
    aId: string;
    bId: string;
  } | null>(null);

  const activeStatsMap = viewMode === 'PLAYED' ? statsMap : scheduledStatsMap;

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const p of players) {
      map[p.id] = p;
    }
    return map;
  }, [players]);

  // Build exact pairwise round-by-round history for the heat map
  const pairMatrix = useMemo(() => {
    const matrix: Record<
      string,
      Record<
        string,
        {
          partnerCount: number;
          opponentCount: number;
          totalCount: number;
          roundDetails: {
            roundNumber: number;
            courtNumber: number;
            relation: 'PARTNER' | 'OPPONENT';
            completed: boolean;
          }[];
        }
      >
    > = {};

    const ensureCell = (a: string, b: string) => {
      if (!matrix[a]) matrix[a] = {};
      if (!matrix[a][b]) {
        matrix[a][b] = {
          partnerCount: 0,
          opponentCount: 0,
          totalCount: 0,
          roundDetails: [],
        };
      }
      return matrix[a][b];
    };

    for (const r of rounds) {
      const matchesToCount =
        viewMode === 'PLAYED'
          ? [...(r.archivedMatches || []), ...r.matches].filter(
              (m) => m.completed
            )
          : [...(r.archivedMatches || []), ...r.matches];

      for (const m of matchesToCount) {
        const [a1, a2] = m.teamA;
        const [b1, b2] = m.teamB;

        // Partner pairs
        const recordPartner = (p1: string, p2: string) => {
          if (!p1 || !p2 || p1 === p2) return;
          const cell1 = ensureCell(p1, p2);
          cell1.partnerCount += 1;
          cell1.totalCount += 1;
          cell1.roundDetails.push({
            roundNumber: r.roundNumber,
            courtNumber: m.courtNumber,
            relation: 'PARTNER',
            completed: m.completed,
          });

          const cell2 = ensureCell(p2, p1);
          cell2.partnerCount += 1;
          cell2.totalCount += 1;
          cell2.roundDetails.push({
            roundNumber: r.roundNumber,
            courtNumber: m.courtNumber,
            relation: 'PARTNER',
            completed: m.completed,
          });
        };

        // Opponent pairs
        const recordOpponent = (p1: string, p2: string) => {
          if (!p1 || !p2 || p1 === p2) return;
          const cell1 = ensureCell(p1, p2);
          cell1.opponentCount += 1;
          cell1.totalCount += 1;
          cell1.roundDetails.push({
            roundNumber: r.roundNumber,
            courtNumber: m.courtNumber,
            relation: 'OPPONENT',
            completed: m.completed,
          });

          const cell2 = ensureCell(p2, p1);
          cell2.opponentCount += 1;
          cell2.totalCount += 1;
          cell2.roundDetails.push({
            roundNumber: r.roundNumber,
            courtNumber: m.courtNumber,
            relation: 'OPPONENT',
            completed: m.completed,
          });
        };

        recordPartner(a1, a2);
        recordPartner(b1, b2);
        recordOpponent(a1, b1);
        recordOpponent(a1, b2);
        recordOpponent(a2, b1);
        recordOpponent(a2, b2);
      }
    }

    return matrix;
  }, [rounds, viewMode]);

  const getCellCount = (aId: string, bId: string): number => {
    const cell = pairMatrix[aId]?.[bId];
    if (!cell) return 0;
    if (heatmapRelation === 'PARTNERS') return cell.partnerCount;
    if (heatmapRelation === 'OPPONENTS') return cell.opponentCount;
    return cell.totalCount;
  };

  // Compute all unique pairs sorted by frequency to highlight hotspots / imbalances
  const rankedPairs = useMemo(() => {
    const list: PairDetail[] = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const pA = players[i];
        const pB = players[j];
        const cell = pairMatrix[pA.id]?.[pB.id];
        if (!cell || cell.totalCount === 0) continue;
        list.push({
          playerA: pA,
          playerB: pB,
          partnerCount: cell.partnerCount,
          opponentCount: cell.opponentCount,
          totalCount: cell.totalCount,
          roundDetails: cell.roundDetails,
        });
      }
    }
    return list.sort((a, b) => {
      const countA =
        heatmapRelation === 'PARTNERS'
          ? a.partnerCount
          : heatmapRelation === 'OPPONENTS'
          ? a.opponentCount
          : a.totalCount;
      const countB =
        heatmapRelation === 'PARTNERS'
          ? b.partnerCount
          : heatmapRelation === 'OPPONENTS'
          ? b.opponentCount
          : b.totalCount;
      if (countB !== countA) return countB - countA;
      return b.totalCount - a.totalCount;
    });
  }, [players, pairMatrix, heatmapRelation]);

  const imbalancedPairs = useMemo(
    () =>
      rankedPairs.filter((pair) => {
        const count =
          heatmapRelation === 'PARTNERS'
            ? pair.partnerCount
            : heatmapRelation === 'OPPONENTS'
            ? pair.opponentCount
            : pair.totalCount;
        return count > 1;
      }),
    [rankedPairs, heatmapRelation]
  );

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (selectedGender !== 'ALL' && p.gender !== selectedGender) return false;
      if (
        searchQuery.trim() &&
        !p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      if (onlyImbalancedRows) {
        const hasRepeat = players.some(
          (other) => other.id !== p.id && getCellCount(p.id, other.id) > 1
        );
        if (!hasRepeat) return false;
      }
      return true;
    });
  }, [
    players,
    selectedGender,
    searchQuery,
    onlyImbalancedRows,
    pairMatrix,
    heatmapRelation,
  ]);

  const inspectedPlayer =
    playerMap[inspectedPlayerId] || filteredPlayers[0] || players[0];
  const inspectedStats = inspectedPlayer
    ? activeStatsMap[inspectedPlayer.id]
    : null;

  // Compute global novelty metrics across all 6 pairs per doubles court (2 partner + 4 opponent relationships)
  let totalPairings = 0;
  let totalRepeatMeetings = 0;
  for (const r of rounds) {
    const matchesToCount =
      viewMode === 'PLAYED'
        ? [...(r.archivedMatches || []), ...r.matches].filter((m) => m.completed)
        : [...(r.archivedMatches || []), ...r.matches];
    for (const m of matchesToCount) {
      totalPairings += 6; // 6 pairwise player meetings per 4-player court
      totalRepeatMeetings += (m.repeatPartners || 0) + (m.repeatOpponents || 0);
    }
  }
  const uniqueMeetingRate =
    totalPairings > 0
      ? Math.round(((totalPairings - totalRepeatMeetings) / totalPairings) * 100)
      : 100;

  const getShortLabel = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 6);
    return `${parts[0].slice(0, 5)} ${parts[parts.length - 1][0]}.`;
  };

  const getHeatmapCellStyle = (count: number, isSelected: boolean) => {
    const ringClass = isSelected
      ? 'ring-2 ring-[#111312] ring-offset-1 z-10'
      : '';
    if (count === 0) {
      return `bg-[#F9FAF8] text-slate-300 hover:bg-slate-100 ${ringClass}`;
    }
    if (count === 1) {
      return `bg-[#DCFCE7] text-[#14532D] font-semibold hover:bg-[#BBF7D0] ${ringClass}`;
    }
    if (count === 2) {
      return `bg-[#FDE047] text-[#713F12] font-bold hover:bg-[#FACC15] ${ringClass}`;
    }
    return `bg-[#FF4D38] text-white font-bold hover:bg-[#E03B28] ${ringClass}`;
  };

  const selectedPairDetails = useMemo(() => {
    if (!selectedCellPair) return null;
    const pA = playerMap[selectedCellPair.aId];
    const pB = playerMap[selectedCellPair.bId];
    if (!pA || !pB) return null;
    const cell = pairMatrix[pA.id]?.[pB.id] || {
      partnerCount: 0,
      opponentCount: 0,
      totalCount: 0,
      roundDetails: [],
    };
    return {
      playerA: pA,
      playerB: pB,
      ...cell,
    };
  }, [selectedCellPair, playerMap, pairMatrix]);

  return (
    <div className="space-y-6">
      {/* Top Diversity Summary Strip */}
      <div className="bg-white border border-[#E6EAE4] rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6EAE4]">
          <div>
            <h2 className="text-lg font-bold text-[#111312] font-display">
              Opponent &amp; Partner Diversity Audit (No Repeat Meetings Rule)
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Visualizes pairwise frequency across all players so organizers can spot repeat pairings or rotation imbalances immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('PLAYED')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'PLAYED'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                Completed Games Only
              </button>
              <button
                type="button"
                onClick={() => setViewMode('SCHEDULED')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'SCHEDULED'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                Full Scheduled Plan ({rounds.length} Rounds)
              </button>
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono tabular-nums font-semibold ${
                totalRepeatMeetings === 0
                  ? 'bg-[#EFFCE6] border-[#98F64F] text-[#1F6309]'
                  : 'bg-[#FFF6D6] border-[#F7D348] text-[#6B4F00]'
              }`}
            >
              {totalRepeatMeetings === 0
                ? `✓ 100% Unique Meetings (0 Repeats)`
                : `Unique Meeting Rate: ${uniqueMeetingRate}% (${totalRepeatMeetings} Repeats)`}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="pt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedGender('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedGender === 'ALL'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                All Players ({players.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedGender('M')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedGender === 'M'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                Men ({players.filter((p) => p.gender === 'M').length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedGender('F')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedGender === 'F'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                Women ({players.filter((p) => p.gender === 'F').length})
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-xl">
              <button
                type="button"
                onClick={() => setHeatmapRelation('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  heatmapRelation === 'ALL'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                All Court Meetings
              </button>
              <button
                type="button"
                onClick={() => setHeatmapRelation('PARTNERS')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  heatmapRelation === 'PARTNERS'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                Partners Only
              </button>
              <button
                type="button"
                onClick={() => setHeatmapRelation('OPPONENTS')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  heatmapRelation === 'OPPONENTS'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                Opponents Only
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOnlyImbalancedRows((prev) => !prev)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                onlyImbalancedRows
                  ? 'bg-[#FFF6D6] border-[#F7D348] text-[#6B4F00]'
                  : 'bg-white border-[#E6EAE4] text-slate-600 hover:text-[#111312]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#FF4D38]" />
              <span>
                {onlyImbalancedRows
                  ? 'Showing Repeat Pairings Only'
                  : `Filter Repeat Pairings (${imbalancedPairs.length})`}
              </span>
            </button>
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
            />
          </div>
        </div>
      </div>

      {/* Visual Pairing Frequency Heat Map Card */}
      <div className="bg-white border border-[#E6EAE4] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#E6EAE4]">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#111312] text-[#98F64F] flex items-center justify-center shrink-0 mt-0.5">
              <Grid className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111312] font-display">
                Player Pairing Frequency Heat Map
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any cell to inspect exact rounds &amp; courts where two players shared a court. Green (1x) indicates balanced single meetings; Gold (2x) and Coral (3x+) flag repeat pairings.
              </p>
            </div>
          </div>

          {/* Color Scale Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-[#F9FAF8] border border-slate-200 inline-block" />
              <span className="text-slate-600">0x (Never Met)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-[#DCFCE7] border border-[#86EFAC] inline-block" />
              <span className="text-[#14532D] font-medium">1x (Balanced)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-[#FDE047] border border-[#EAB308] inline-block" />
              <span className="text-[#713F12] font-semibold">2x (Repeat)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-[#FF4D38] inline-block" />
              <span className="text-[#991B1B] font-semibold">3x+ (High Imbalance)</span>
            </div>
          </div>
        </div>

        {/* Imbalance / Hotspot Summary Banner */}
        <div
          className={`rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            imbalancedPairs.length === 0
              ? 'bg-[#F4FCEB] border-[#BCEE94]'
              : 'bg-[#FFF9E6] border-[#F7D348]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {imbalancedPairs.length === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-[#287D0C] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0" />
            )}
            <div className="text-xs">
              {imbalancedPairs.length === 0 ? (
                <span className="font-semibold text-[#1E5E08]">
                  Zero Pairing Imbalances Detected — No player pair has met more than once in this view ({rankedPairs.length} unique 1x pairings).
                </span>
              ) : (
                <span className="font-semibold text-[#713F12]">
                  {imbalancedPairs.length} Repeat Player{' '}
                  {imbalancedPairs.length === 1 ? 'Pairing' : 'Pairings'}{' '}
                  Detected (&gt;1x) — Click any highlighted pair below to inspect rounds:
                </span>
              )}
            </div>
          </div>

          {imbalancedPairs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {imbalancedPairs.slice(0, 6).map((pair) => {
                const count =
                  heatmapRelation === 'PARTNERS'
                    ? pair.partnerCount
                    : heatmapRelation === 'OPPONENTS'
                    ? pair.opponentCount
                    : pair.totalCount;
                return (
                  <button
                    key={`${pair.playerA.id}-${pair.playerB.id}`}
                    type="button"
                    onClick={() => {
                      setInspectedPlayerId(pair.playerA.id);
                      setSelectedCellPair({
                        aId: pair.playerA.id,
                        bId: pair.playerB.id,
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors ${
                      count >= 3
                        ? 'bg-[#FF4D38] text-white'
                        : 'bg-[#FDE047] text-[#713F12] hover:bg-[#FACC15]'
                    }`}
                  >
                    {getShortLabel(pair.playerA.name)} &amp;{' '}
                    {getShortLabel(pair.playerB.name)} ({count}x)
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Cell Pair Drilldown Banner */}
        {selectedPairDetails && (
          <div className="bg-[#111312] text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[#98F64F] font-mono uppercase tracking-wider">
                Selected Pairing Inspection
              </div>
              <div className="text-sm font-bold mt-0.5">
                {selectedPairDetails.playerA.name} &amp;{' '}
                {selectedPairDetails.playerB.name}
              </div>
              <div className="text-xs text-slate-300 mt-0.5 font-mono tabular-nums">
                Total Meetings: {selectedPairDetails.totalCount}x (
                {selectedPairDetails.partnerCount}x as Partners ·{' '}
                {selectedPairDetails.opponentCount}x as Opponents)
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedPairDetails.roundDetails.length === 0 ? (
                <span className="text-xs text-slate-400 font-mono">
                  Never shared a court in this view
                </span>
              ) : (
                selectedPairDetails.roundDetails.map((rd, idx) => (
                  <span
                    key={`${rd.roundNumber}-${rd.courtNumber}-${idx}`}
                    className="px-2.5 py-1 rounded-lg bg-[#232725] border border-white/15 text-xs font-mono tabular-nums"
                  >
                    R{rd.roundNumber} · Ct {rd.courtNumber} ·{' '}
                    <span
                      className={
                        rd.relation === 'PARTNER'
                          ? 'text-[#98F64F] font-semibold'
                          : 'text-[#F7D348] font-semibold'
                      }
                    >
                      {rd.relation === 'PARTNER' ? 'Partners' : 'Opponents'}
                    </span>
                  </span>
                ))
              )}
              <button
                type="button"
                onClick={() => setSelectedCellPair(null)}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white underline ml-2"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* 2D Scrollable Heat Map Matrix */}
        {filteredPlayers.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No players match the current filter criteria.
          </div>
        ) : (
          <div className="overflow-auto max-h-[560px] border border-[#E6EAE4] rounded-xl">
            <table className="border-collapse text-xs w-full">
              <thead className="sticky top-0 z-20 bg-[#F8F9F6]">
                <tr>
                  <th className="sticky left-0 z-30 bg-[#F8F9F6] border-b border-r border-[#E6EAE4] px-3 py-2.5 text-left font-bold text-[#111312] min-w-[165px]">
                    Player ({filteredPlayers.length})
                  </th>
                  <th className="border-b border-r border-[#E6EAE4] px-2 py-2.5 text-center font-semibold text-slate-600 min-w-[52px]">
                    Max
                  </th>
                  {filteredPlayers.map((colPlayer) => (
                    <th
                      key={colPlayer.id}
                      title={`${colPlayer.name} (${
                        colPlayer.gender === 'M' ? 'Men' : 'Women'
                      })`}
                      className="border-b border-r border-[#E6EAE4] px-1 py-2 text-center font-mono text-[10px] font-semibold text-slate-700 min-w-[34px] max-w-[34px] truncate"
                    >
                      <div className="writing-mode-vertical">
                        {getShortLabel(colPlayer.name)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((rowPlayer) => {
                  const isRowInspected = inspectedPlayer?.id === rowPlayer.id;
                  let rowMax = 0;
                  for (const colPlayer of filteredPlayers) {
                    if (colPlayer.id === rowPlayer.id) continue;
                    const c = getCellCount(rowPlayer.id, colPlayer.id);
                    if (c > rowMax) rowMax = c;
                  }

                  return (
                    <tr
                      key={rowPlayer.id}
                      className={
                        isRowInspected ? 'bg-[#EFFCE6]/60' : 'hover:bg-slate-50/70'
                      }
                    >
                      <td
                        onClick={() => setInspectedPlayerId(rowPlayer.id)}
                        className={`sticky left-0 z-10 border-b border-r border-[#E6EAE4] px-3 py-1.5 cursor-pointer truncate max-w-[185px] ${
                          isRowInspected
                            ? 'bg-[#EFFCE6] font-bold text-[#111312]'
                            : 'bg-white text-slate-800 hover:bg-[#F8F9F6]'
                        }`}
                        title={rowPlayer.name}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate">{rowPlayer.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {rowPlayer.gender}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-r border-[#E6EAE4] px-2 py-1.5 text-center font-mono tabular-nums font-semibold">
                        <span
                          className={
                            rowMax > 1
                              ? 'text-[#B91C1C] font-bold'
                              : rowMax === 1
                              ? 'text-[#15803D]'
                              : 'text-slate-400'
                          }
                        >
                          {rowMax}x
                        </span>
                      </td>
                      {filteredPlayers.map((colPlayer) => {
                        if (rowPlayer.id === colPlayer.id) {
                          return (
                            <td
                              key={colPlayer.id}
                              className="border-b border-r border-[#E6EAE4] bg-[#111312]/90 text-center text-[10px] font-mono text-slate-400 select-none"
                              title="Same player"
                            >
                              —
                            </td>
                          );
                        }

                        const count = getCellCount(rowPlayer.id, colPlayer.id);
                        const cellData = pairMatrix[rowPlayer.id]?.[colPlayer.id];
                        const isCellSelected =
                          (selectedCellPair?.aId === rowPlayer.id &&
                            selectedCellPair?.bId === colPlayer.id) ||
                          (selectedCellPair?.aId === colPlayer.id &&
                            selectedCellPair?.bId === rowPlayer.id);

                        const tooltipText =
                          count === 0
                            ? `${rowPlayer.name} & ${colPlayer.name}: Never met`
                            : `${rowPlayer.name} & ${colPlayer.name}: ${count}x (${
                                cellData?.partnerCount || 0
                              }P, ${cellData?.opponentCount || 0}O)`;

                        return (
                          <td
                            key={colPlayer.id}
                            onClick={() => {
                              setInspectedPlayerId(rowPlayer.id);
                              setSelectedCellPair({
                                aId: rowPlayer.id,
                                bId: colPlayer.id,
                              });
                            }}
                            title={tooltipText}
                            className={`border-b border-r border-[#E6EAE4] text-center font-mono tabular-nums text-[11px] py-1.5 cursor-pointer transition-colors select-none ${getHeatmapCellStyle(
                              count,
                              isCellSelected
                            )}`}
                          >
                            {count > 0 ? count : '·'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Split Inspector: Left Table of All Players + Right Detailed Opponent History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Player Rotation Coverage (Click a row to inspect)
            </h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {filteredPlayers.length} shown
            </span>
          </div>

          <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr className="text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Player</th>
                  <th className="py-2.5 px-3 text-right">Games</th>
                  <th className="py-2.5 px-3 text-right">Gender / Mixed</th>
                  <th className="py-2.5 px-3 text-right">Unique Opponents</th>
                  <th className="py-2.5 px-3 text-right">Unique Partners</th>
                  <th className="py-2.5 px-4 text-right">Same / Mixed Opp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredPlayers.map((player) => {
                  const st = activeStatsMap[player.id];
                  const isSelected = inspectedPlayer?.id === player.id;
                  const sameGenderOpp =
                    st?.uniqueOpponents.filter(
                      (id) => playerMap[id]?.gender === player.gender
                    ).length || 0;
                  const mixedGenderOpp =
                    st?.uniqueOpponents.filter(
                      (id) => playerMap[id]?.gender !== player.gender
                    ).length || 0;

                  return (
                    <tr
                      key={player.id}
                      onClick={() => setInspectedPlayerId(player.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/80 text-slate-900 font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{player.name}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 font-mono">
                            {player.gender === 'M' ? 'Men' : 'Women'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {st?.gamesPlayed || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {st?.genderGamesPlayed || 0}G / {st?.mixedGamesPlayed || 0}M
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        {st?.uniqueOpponents.length || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {st?.uniquePartners.length || 0}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">
                        {sameGenderOpp} same / {mixedGenderOpp} mixed
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          {inspectedPlayer && inspectedStats ? (
            <>
              <div className="pb-4 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900 font-display">
                  {inspectedPlayer.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  <span>{inspectedPlayer.gender === 'M' ? 'Men Roster' : 'Women Roster'}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {inspectedStats.gamesPlayed} Games ({inspectedStats.genderGamesPlayed} Gender, {inspectedStats.mixedGamesPlayed} Mixed)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{inspectedStats.gamesBench} Bench Rounds</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-900 mb-2">
                  Different Opponents Faced ({inspectedStats.uniqueOpponents.length})
                </h4>
                {inspectedStats.uniqueOpponents.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No opponents recorded yet. Generate or advance rounds to populate matchups.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {inspectedStats.uniqueOpponents.map((oppId) => {
                      const opp = playerMap[oppId];
                      const timesFaced = inspectedStats.opponentCounts[oppId] || 1;
                      if (!opp) return null;
                      return (
                        <div
                          key={oppId}
                          onClick={() =>
                            setSelectedCellPair({
                              aId: inspectedPlayer.id,
                              bId: oppId,
                            })
                          }
                          className={`px-3 py-2 border rounded text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            timesFaced > 1
                              ? 'bg-[#FFF6D6] border-[#F7D348] text-[#713F12] font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{opp.name}</span>
                          <span className="font-mono tabular-nums shrink-0">
                            {timesFaced}x
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-semibold text-slate-900 mb-2">
                  Different Partners Teamed With ({inspectedStats.uniquePartners.length})
                </h4>
                {inspectedStats.uniquePartners.length === 0 ? (
                  <p className="text-xs text-slate-500">No partners recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {inspectedStats.uniquePartners.map((partId) => {
                      const part = playerMap[partId];
                      const timesTeamed = inspectedStats.partnerCounts[partId] || 1;
                      if (!part) return null;
                      return (
                        <div
                          key={partId}
                          onClick={() =>
                            setSelectedCellPair({
                              aId: inspectedPlayer.id,
                              bId: partId,
                            })
                          }
                          className={`px-3 py-2 border rounded text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            timesTeamed > 1
                              ? 'bg-[#FFF6D6] border-[#F7D348] text-[#713F12] font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{part.name}</span>
                          <span className="font-mono tabular-nums shrink-0">
                            {timesTeamed}x
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a player to inspect matchups.</p>
          )}
        </div>
      </div>
    </div>
  );
};

