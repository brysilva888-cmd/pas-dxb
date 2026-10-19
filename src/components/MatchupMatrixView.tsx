import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Player, PlayerStats, Round } from '../types';

interface MatchupMatrixViewProps {
  players: Player[];
  statsMap: Record<string, PlayerStats>;
  scheduledStatsMap: Record<string, PlayerStats>;
  rounds: Round[];
}

export const MatchupMatrixView: React.FC<MatchupMatrixViewProps> = ({
  players,
  statsMap,
  scheduledStatsMap,
  rounds,
}) => {
  const [viewMode, setViewMode] = useState<'PLAYED' | 'SCHEDULED'>('PLAYED');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string>(
    players[0]?.id || ''
  );

  const activeStatsMap = viewMode === 'PLAYED' ? statsMap : scheduledStatsMap;

  const playerMap: Record<string, Player> = {};
  for (const p of players) {
    playerMap[p.id] = p;
  }

  const filteredPlayers = players.filter((p) => {
    if (selectedGender !== 'ALL' && p.gender !== selectedGender) return false;
    if (
      searchQuery.trim() &&
      !p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

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
              Enforces the strict rule that no player meets the same person again on any court (neither as a partner nor as an opponent).
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
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-xl self-start">
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

          <div className="relative w-full sm:w-64">
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
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-slate-800">{opp.name}</span>
                          <span className="font-mono tabular-nums text-slate-500 shrink-0">
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
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-slate-800">{part.name}</span>
                          <span className="font-mono tabular-nums text-slate-500 shrink-0">
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
