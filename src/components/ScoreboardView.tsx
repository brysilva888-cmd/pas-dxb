import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  FileText,
  RotateCcw,
  Search,
  Trophy,
  Users,
} from 'lucide-react';
import { Player, PlayerStats, Round } from '../types';
import { downloadDashboardStatsPdf } from '../utils/pdfStatsGenerator';

interface ScoreboardViewProps {
  players: Player[];
  statsMap: Record<string, PlayerStats>;
  rounds: Round[];
  onUpdateMatchScore: (
    roundNumber: number,
    matchId: string,
    scoreA: number | null,
    scoreB: number | null,
    completed: boolean
  ) => void;
}

interface TeamPairRecord {
  pairKey: string;
  player1Id: string;
  player2Id: string;
  pairName: string;
  divisionLabel: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export const ScoreboardView: React.FC<ScoreboardViewProps> = ({
  players,
  statsMap,
  rounds,
  onUpdateMatchScore,
}) => {
  const [subTab, setSubTab] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [teamFilter, setTeamFilter] = useState<
    'ALL' | 'MENS_DOUBLES' | 'WOMENS_DOUBLES' | 'MIXED_DOUBLES'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<number | 'ALL'>(
    'ALL'
  );

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const p of players) {
      map[p.id] = p;
    }
    return map;
  }, [players]);

  // 1. Individual Player Leaderboard sorted by Wins -> Point Diff -> Points For -> Games Played
  const individualStandings = useMemo(() => {
    return players
      .filter((p) => {
        if (genderFilter !== 'ALL' && p.gender !== genderFilter) return false;
        if (
          searchQuery.trim() &&
          !p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .map((player) => {
        const st = statsMap[player.id];
        const wins = st?.wins || 0;
        const losses = st?.losses || 0;
        const completedGames = wins + losses;
        const winPct =
          completedGames > 0 ? Math.round((wins / completedGames) * 100) : 0;
        const pointsFor = st?.pointsFor || 0;
        const pointsAgainst = st?.pointsAgainst || 0;
        const pointDiff = pointsFor - pointsAgainst;

        return {
          player,
          gamesScheduled: st?.gamesPlayed || 0,
          completedGames,
          wins,
          losses,
          winPct,
          pointsFor,
          pointsAgainst,
          pointDiff,
        };
      })
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        return a.player.name.localeCompare(b.player.name);
      });
  }, [players, statsMap, genderFilter, searchQuery]);

  // 2. Team Pair Leaderboard & Match Team Score Records
  const teamPairStandings = useMemo(() => {
    const map: Record<string, TeamPairRecord> = {};

    for (const round of rounds) {
      const allMatches = [...(round.archivedMatches || []), ...round.matches];
      for (const match of allMatches) {
        if (teamFilter !== 'ALL' && match.mode !== teamFilter) continue;

        const processPair = (
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
          if (!map[key]) {
            const divLabel =
              p1.gender === 'M' && p2.gender === 'M'
                ? "Men's Team"
                : p1.gender === 'F' && p2.gender === 'F'
                ? "Women's Team"
                : 'Mixed Team';

            map[key] = {
              pairKey: key,
              player1Id: id1,
              player2Id: id2,
              pairName: `${p1.name} & ${p2.name}`,
              divisionLabel: divLabel,
              gamesPlayed: 0,
              wins: 0,
              losses: 0,
              pointsFor: 0,
              pointsAgainst: 0,
            };
          }

          if (completed && myScore !== null && oppScore !== null) {
            map[key].gamesPlayed += 1;
            map[key].pointsFor += myScore;
            map[key].pointsAgainst += oppScore;
            if (myScore > oppScore) map[key].wins += 1;
            if (oppScore > myScore) map[key].losses += 1;
          }
        };

        processPair(match.teamA, match.scoreA, match.scoreB, match.completed);
        processPair(match.teamB, match.scoreB, match.scoreA, match.completed);
      }
    }

    return Object.values(map)
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        return item.pairName
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase());
      })
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const diffA = a.pointsFor - a.pointsAgainst;
        const diffB = b.pointsFor - b.pointsAgainst;
        if (diffB !== diffA) return diffB - diffA;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        return b.gamesPlayed - a.gamesPlayed;
      });
  }, [rounds, playerMap, teamFilter, searchQuery]);

  const totalCompletedMatches = useMemo(() => {
    let count = 0;
    for (const r of rounds) {
      const allMatches = [...(r.archivedMatches || []), ...r.matches];
      for (const m of allMatches) {
        if (m.completed) count += 1;
      }
    }
    return count;
  }, [rounds]);

  const totalScheduledMatches = useMemo(() => {
    return rounds.reduce(
      (acc, r) => acc + (r.archivedMatches?.length || 0) + r.matches.length,
      0
    );
  }, [rounds]);

  const filteredRoundsForTeamScores = useMemo(() => {
    if (selectedRoundFilter === 'ALL') return rounds;
    return rounds.filter((r) => r.roundNumber === selectedRoundFilter);
  }, [rounds, selectedRoundFilter]);

  const handleExportPlayerStatsCsv = () => {
    const headers = [
      'Rank',
      'Player Name',
      'Division',
      'Wins',
      'Win Rate (%)',
      'Losses',
      'Total Games Played',
      'Points For',
      'Points Against',
      'Point Diff',
      'Unique Opponents',
      'Unique Partners',
    ];

    const escapeCsvField = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = individualStandings.map((row, index) => {
      const st = statsMap[row.player.id];
      return [
        index + 1,
        row.player.name,
        row.player.gender === 'M' ? 'Men' : 'Women',
        row.wins,
        `${row.winPct}%`,
        row.losses,
        row.completedGames,
        row.pointsFor,
        row.pointsAgainst,
        row.pointDiff,
        st?.uniqueOpponents.length || 0,
        st?.uniquePartners.length || 0,
      ]
        .map(escapeCsvField)
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pickle_and_smash_dxb_player_stats.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Main Score Header & Sub-Navigation Switcher (Individual vs Team Score) */}
      <div className="bg-white border border-[#E6EAE4] rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6EAE4]">
          <div>
            <h2 className="text-lg font-bold text-[#111312] font-display">
              Open Play Scoreboard &amp; Standings
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Track individual player wins and doubles team scores across all Men&apos;s, Women&apos;s, and Mixed Doubles rounds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="text-xs font-mono tabular-nums text-slate-600 mr-1">
              Completed Matches: {totalCompletedMatches} / {totalScheduledMatches}
            </span>
            <button
              type="button"
              onClick={() =>
                downloadDashboardStatsPdf(players, statsMap, rounds)
              }
              className="px-4 py-2 text-xs font-bold text-[#111312] bg-[#98F64F] border border-[#111312]/10 rounded-xl hover:bg-[#88E63E] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-[#111312]" />
              <span>Download Stats (PDF)</span>
            </button>
            <button
              type="button"
              onClick={handleExportPlayerStatsCsv}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#111312] rounded-xl hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#98F64F]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Main Segmented Toggle: Individual (Player Wins) vs Team Score */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#F5F6F3] rounded-xl self-start">
            <button
              type="button"
              onClick={() => setSubTab('INDIVIDUAL')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                subTab === 'INDIVIDUAL'
                  ? 'bg-[#111312] text-white'
                  : 'text-slate-600 hover:text-[#111312]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-[#98F64F]" />
              <span>Individual Score (Player Wins)</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('TEAM')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                subTab === 'TEAM'
                  ? 'bg-[#111312] text-white'
                  : 'text-slate-600 hover:text-[#111312]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#98F64F]" />
              <span>Team Score (Doubles Teams &amp; Matches)</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                subTab === 'INDIVIDUAL'
                  ? 'Search player name...'
                  : 'Search team player name...'
              }
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
            />
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: INDIVIDUAL SCORE (HOW MANY WINS EACH PLAYER HAS) */}
      {subTab === 'INDIVIDUAL' && (
        <div className="bg-white border border-[#E6EAE4] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E6EAE4]">
            <div>
              <h3 className="text-base font-bold text-[#111312] font-display">
                Individual Player Leaderboard (Wins &amp; Points)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ranked by total individual wins across both Gender Doubles and Mixed Doubles games.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-xl">
              <button
                type="button"
                onClick={() => setGenderFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  genderFilter === 'ALL'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                All Players ({players.length})
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('M')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  genderFilter === 'M'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                Men ({players.filter((p) => p.gender === 'M').length})
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('F')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  genderFilter === 'F'
                    ? 'bg-[#111312] text-white'
                    : 'text-slate-600 hover:text-[#111312]'
                }`}
              >
                Women ({players.filter((p) => p.gender === 'F').length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#E6EAE4] rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F7F8F5] border-b border-[#E6EAE4] text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 w-14">Rank</th>
                  <th className="py-2.5 px-4">Player</th>
                  <th className="py-2.5 px-3">Division</th>
                  <th className="py-2.5 px-3 text-right">Wins (Win %)</th>
                  <th className="py-2.5 px-3 text-right">Losses</th>
                  <th className="py-2.5 px-3 text-right">Games Played</th>
                  <th className="py-2.5 px-3 text-right">Points For</th>
                  <th className="py-2.5 px-3 text-right">Points Against</th>
                  <th className="py-2.5 px-4 text-right">Point Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAE4] text-xs">
                {individualStandings.map((row, idx) => (
                  <tr
                    key={row.player.id}
                    className="hover:bg-[#F7F8F5] transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#111312]">
                      {row.player.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {row.player.gender === 'M' ? 'Men' : 'Women'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="font-bold text-[#287D0C] text-sm">
                        {row.wins}
                      </span>
                      <span className="text-slate-500 text-xs ml-1.5">
                        ({row.winPct}%)
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                      {row.losses}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#111312]">
                      {row.completedGames}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {row.pointsFor}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                      {row.pointsAgainst}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                        row.pointDiff > 0
                          ? 'text-[#287D0C]'
                          : row.pointDiff < 0
                          ? 'text-[#D84E34]'
                          : 'text-slate-500'
                      }`}
                    >
                      {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: TEAM SCORE (DOUBLES TEAM STANDINGS + MATCH SCOREBOARD) */}
      {subTab === 'TEAM' && (
        <div className="space-y-6">
          {/* Section A: Doubles Team Pair Leaderboard */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Doubles Team Standings (Pair Wins &amp; Team Score)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracks win-loss records and total team points for every doubles partnership.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTeamFilter('ALL')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    teamFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Teams
                </button>
                <button
                  type="button"
                  onClick={() => setTeamFilter('MENS_DOUBLES')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    teamFilter === 'MENS_DOUBLES'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Men&apos;s Teams
                </button>
                <button
                  type="button"
                  onClick={() => setTeamFilter('WOMENS_DOUBLES')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    teamFilter === 'WOMENS_DOUBLES'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Women&apos;s Teams
                </button>
                <button
                  type="button"
                  onClick={() => setTeamFilter('MIXED_DOUBLES')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    teamFilter === 'MIXED_DOUBLES'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mixed Teams
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 w-14">Rank</th>
                    <th className="py-2.5 px-4">Doubles Team Pair</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Team Wins</th>
                    <th className="py-2.5 px-3 text-right">Team Losses</th>
                    <th className="py-2.5 px-3 text-right">Team Score (PF - PA)</th>
                    <th className="py-2.5 px-4 text-right">Point Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {teamPairStandings.map((team, idx) => {
                    const diff = team.pointsFor - team.pointsAgainst;
                    return (
                      <tr
                        key={team.pairKey}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {team.pairName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {team.divisionLabel}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 text-sm">
                          {team.wins}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                          {team.losses}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {team.pointsFor} - {team.pointsAgainst}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                            diff > 0
                              ? 'text-emerald-700'
                              : diff < 0
                              ? 'text-red-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Round-by-Round Match Team Score Entry */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Enter &amp; Review Match Team Scores by Round
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Log or edit Team 1 vs Team 2 scores for any court. Completing a match automatically updates both Team Scores and Individual Player Wins.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Filter Round:</span>
                <select
                  value={selectedRoundFilter}
                  onChange={(e) =>
                    setSelectedRoundFilter(
                      e.target.value === 'ALL'
                        ? 'ALL'
                        : parseInt(e.target.value, 10)
                    )
                  }
                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="ALL">All Rounds ({rounds.length})</option>
                  {rounds.map((r) => (
                    <option key={r.roundNumber} value={r.roundNumber}>
                      Round {r.roundNumber} (
                      {r.phase === 'MIXED_DOUBLES' ? 'Mixed' : 'Gender'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {filteredRoundsForTeamScores.map((round) => {
                const allRoundMatches = [
                  ...(round.archivedMatches || []),
                  ...round.matches,
                ];
                return (
                <div
                  key={round.roundNumber}
                  className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 font-display">
                      Round {round.roundNumber} ·{' '}
                      {round.phase === 'MIXED_DOUBLES'
                        ? 'Phase 2: Mixed Doubles'
                        : 'Phase 1: Gender Doubles'}
                    </h4>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {allRoundMatches.filter((m) => m.completed).length} /{' '}
                      {allRoundMatches.length} Completed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allRoundMatches.map((match) => {
                      const pA1 = playerMap[match.teamA[0]]?.name || 'Player';
                      const pA2 = playerMap[match.teamA[1]]?.name || 'Player';
                      const pB1 = playerMap[match.teamB[0]]?.name || 'Player';
                      const pB2 = playerMap[match.teamB[1]]?.name || 'Player';
                      const sA = match.scoreA ?? 0;
                      const sB = match.scoreB ?? 0;
                      const teamAWon = match.completed && sA > sB;
                      const teamBWon = match.completed && sB > sA;

                      return (
                        <div
                          key={match.id}
                          className="bg-white border border-slate-200 rounded-md p-3.5 flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                            <span className="font-semibold text-slate-900">
                              {match.courtName}
                            </span>
                            <span className="text-slate-500 font-mono">
                              {match.mode === 'MENS_DOUBLES'
                                ? "Men's Doubles"
                                : match.mode === 'WOMENS_DOUBLES'
                                ? "Women's Doubles"
                                : match.mode === 'MIXED_DOUBLES'
                                ? 'Mixed Doubles'
                                : 'Open Doubles'}
                            </span>
                          </div>

                          {/* Team 1 Row */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1 text-xs">
                              <div className="text-[11px] font-mono text-slate-400">
                                Team 1 {teamAWon ? '· WINNER' : ''}
                              </div>
                              <div
                                className={`truncate ${
                                  teamAWon
                                    ? 'font-bold text-emerald-700'
                                    : 'text-slate-800'
                                }`}
                              >
                                {pA1} &amp; {pA2}
                              </div>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              aria-label={`${match.courtName} Team 1 Score`}
                              value={match.scoreA ?? ''}
                              placeholder="11"
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? null
                                    : Math.max(
                                        0,
                                        parseInt(e.target.value, 10) || 0
                                      );
                                onUpdateMatchScore(
                                  round.roundNumber,
                                  match.id,
                                  val,
                                  match.scoreB,
                                  match.completed
                                );
                              }}
                              className="w-16 px-2 py-1 text-center text-sm font-mono tabular-nums font-semibold bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                          </div>

                          {/* Team 2 Row */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1 text-xs">
                              <div className="text-[11px] font-mono text-slate-400">
                                Team 2 {teamBWon ? '· WINNER' : ''}
                              </div>
                              <div
                                className={`truncate ${
                                  teamBWon
                                    ? 'font-bold text-emerald-700'
                                    : 'text-slate-800'
                                }`}
                              >
                                {pB1} &amp; {pB2}
                              </div>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              aria-label={`${match.courtName} Team 2 Score`}
                              value={match.scoreB ?? ''}
                              placeholder="8"
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? null
                                    : Math.max(
                                        0,
                                        parseInt(e.target.value, 10) || 0
                                      );
                                onUpdateMatchScore(
                                  round.roundNumber,
                                  match.id,
                                  match.scoreA,
                                  val,
                                  match.completed
                                );
                              }}
                              className="w-16 px-2 py-1 text-center text-sm font-mono tabular-nums font-semibold bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                          </div>

                          {/* Match Score Actions */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-xs font-mono tabular-nums text-slate-500">
                              {match.completed
                                ? `Final: ${sA} - ${sB}`
                                : 'In Progress'}
                            </span>

                            {!match.completed ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateMatchScore(
                                    round.roundNumber,
                                    match.id,
                                    match.scoreA ?? 11,
                                    match.scoreB ?? 8,
                                    true
                                  )
                                }
                                className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                              >
                                <Check className="w-3 h-3" />
                                <span>Save &amp; Complete</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateMatchScore(
                                    round.roundNumber,
                                    match.id,
                                    match.scoreA,
                                    match.scoreB,
                                    false
                                  )
                                }
                                className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Edit Score</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
