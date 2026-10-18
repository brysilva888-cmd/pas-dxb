import React, { useState } from 'react';
import { Check, Download, Plus, RotateCcw, Search, X } from 'lucide-react';
import { Player, PlayPhase, Round } from '../types';

interface ScheduleQueueViewProps {
  rounds: Round[];
  players: Player[];
  activeRoundNumber: number;
  onSelectRound: (roundNumber: number) => void;
  onAppendRound: (phase: PlayPhase) => void;
  onUpdateMatchScore: (
    roundNumber: number,
    matchId: string,
    scoreA: number | null,
    scoreB: number | null,
    completed: boolean
  ) => void;
}

export const ScheduleQueueView: React.FC<ScheduleQueueViewProps> = ({
  rounds,
  players,
  activeRoundNumber,
  onSelectRound,
  onAppendRound,
  onUpdateMatchScore,
}) => {
  const [phaseFilter, setPhaseFilter] = useState<
    'ALL' | 'GENDER_SPLIT' | 'MIXED_DOUBLES'
  >('ALL');
  const [playerFilter, setPlayerFilter] = useState('');

  const playerMap: Record<string, Player> = {};
  for (const p of players) {
    playerMap[p.id] = p;
  }

  const filteredRounds = rounds.filter((r) => {
    if (phaseFilter !== 'ALL' && r.phase !== phaseFilter) return false;
    return true;
  });

  const matchesPlayerQuery = (playerId: string) => {
    if (!playerFilter.trim()) return false;
    const p = playerMap[playerId];
    return p
      ? p.name.toLowerCase().includes(playerFilter.trim().toLowerCase())
      : false;
  };

  const handleCompleteAllInRound = (round: Round) => {
    const allMatches = [...(round.archivedMatches || []), ...round.matches];
    for (const m of allMatches) {
      if (!m.completed) {
        onUpdateMatchScore(
          round.roundNumber,
          m.id,
          m.scoreA ?? 11,
          m.scoreB ?? 8,
          true
        );
      }
    }
  };

  const handleExportScheduleCsv = () => {
    const headers = [
      'Round',
      'Phase',
      'Court',
      'Division',
      'Team 1 Player 1',
      'Team 1 Player 2',
      'Team 1 Score',
      'Team 2 Player 1',
      'Team 2 Player 2',
      'Team 2 Score',
      'Status',
      'Matchup Novelty (%)',
      'Bench / Resting Players',
    ];

    const escapeCsvField = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows: string[] = [];

    for (const round of rounds) {
      const phaseLabel =
        round.phase === 'GENDER_SPLIT'
          ? 'Phase 1: Gender Doubles'
          : round.phase === 'MIXED_DOUBLES'
          ? 'Phase 2: Mixed Doubles'
          : 'Custom Rotation';

      const benchNames = round.benchPlayerIds
        .map((id) => playerMap[id]?.name || '')
        .filter(Boolean)
        .join(' | ');

      const allRoundMatches = [
        ...(round.archivedMatches || []),
        ...round.matches,
      ];

      for (const match of allRoundMatches) {
        const divisionLabel =
          match.mode === 'MENS_DOUBLES'
            ? "Men's Doubles"
            : match.mode === 'WOMENS_DOUBLES'
            ? "Women's Doubles"
            : match.mode === 'MIXED_DOUBLES'
            ? 'Mixed Doubles'
            : 'Open Doubles';

        const pA1 = playerMap[match.teamA[0]]?.name || '';
        const pA2 = playerMap[match.teamA[1]]?.name || '';
        const pB1 = playerMap[match.teamB[0]]?.name || '';
        const pB2 = playerMap[match.teamB[1]]?.name || '';

        const scoreA = match.scoreA !== null ? match.scoreA : '';
        const scoreB = match.scoreB !== null ? match.scoreB : '';
        const statusLabel = match.completed ? 'Completed' : 'Scheduled';

        rows.push(
          [
            `Round ${round.roundNumber}`,
            phaseLabel,
            match.courtName,
            divisionLabel,
            pA1,
            pA2,
            scoreA,
            pB1,
            pB2,
            scoreB,
            statusLabel,
            `${match.noveltyScore}%`,
            benchNames,
          ]
            .map(escapeCsvField)
            .join(',')
        );
      }
    }

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pickle_and_smash_dxb_full_schedule.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Schedule Header & Controls */}
      <div className="bg-white border border-[#E6EAE4] rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6EAE4]">
          <div>
            <h2 className="text-lg font-bold text-[#111312] font-display">
              Multi-Round Open Play Schedule &amp; Match Scores
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Record and review the score for each game across Phase 1 (4 Gender Doubles games/player) and Phase 2 (1 Mixed Doubles game/player).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportScheduleCsv}
              className="px-3.5 py-2 text-xs font-semibold text-[#111312] bg-[#F7F8F5] border border-[#E6EAE4] rounded-xl hover:bg-[#ECEFE9] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#287D0C]" />
              <span>Export Schedule (.csv)</span>
            </button>
            <button
              type="button"
              onClick={() => onAppendRound('GENDER_SPLIT')}
              className="px-3 py-2 text-xs font-medium text-[#111312] bg-[#F2F4F0] rounded-xl hover:bg-[#E5E9E2] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Gender Round</span>
            </button>
            <button
              type="button"
              onClick={() => onAppendRound('MIXED_DOUBLES')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#111312] rounded-xl hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#98F64F]" />
              <span>Add Mixed Doubles Round</span>
            </button>
          </div>
        </div>

        {/* Round Completion Matrix (Inspired by the Reference Graphic's Circular History Grid) */}
        <div className="py-4 border-b border-[#E6EAE4] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#111312]">
              Round Completion Matrix
            </div>
            <p className="text-[11px] text-slate-500">
              Click any round circle to jump directly to that round on Live Courts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {rounds.map((r) => {
              const rMatches = [...(r.archivedMatches || []), ...r.matches];
              const doneCount = rMatches.filter((m) => m.completed).length;
              const allDone = rMatches.length > 0 && doneCount === rMatches.length;
              const isCurrent = r.roundNumber === activeRoundNumber;

              return (
                <button
                  key={r.roundNumber}
                  type="button"
                  onClick={() => onSelectRound(r.roundNumber)}
                  title={`Round ${r.roundNumber} (${doneCount}/${rMatches.length} completed)`}
                  className="flex flex-col items-center gap-1 group"
                >
                  <span className="text-[10px] font-mono text-slate-500">
                    R{r.roundNumber}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                      allDone
                        ? 'bg-[#98F64F]/30 border-[#7AD930] text-[#1E5E08]'
                        : isCurrent
                        ? 'bg-[#111312] border-[#111312] text-[#98F64F]'
                        : doneCount > 0
                        ? 'bg-[#FFF3CC] border-[#F7D348] text-[#5C4500]'
                        : 'bg-[#FFF0ED] border-[#F06449] text-[#F06449]'
                    }`}
                  >
                    {allDone ? (
                      <Check className="w-3 h-3" />
                    ) : isCurrent ? (
                      <span className="text-[9px] font-mono font-bold">
                        {doneCount}
                      </span>
                    ) : (
                      <X className="w-2.5 h-2.5" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-xl self-start">
            <button
              type="button"
              onClick={() => setPhaseFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                phaseFilter === 'ALL'
                  ? 'bg-[#111312] text-white'
                  : 'text-slate-600 hover:text-[#111312]'
              }`}
            >
              All Rounds ({rounds.length})
            </button>
            <button
              type="button"
              onClick={() => setPhaseFilter('GENDER_SPLIT')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                phaseFilter === 'GENDER_SPLIT'
                  ? 'bg-[#111312] text-white'
                  : 'text-slate-600 hover:text-[#111312]'
              }`}
            >
              Phase 1: Gender Doubles (
              {rounds.filter((r) => r.phase === 'GENDER_SPLIT').length})
            </button>
            <button
              type="button"
              onClick={() => setPhaseFilter('MIXED_DOUBLES')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                phaseFilter === 'MIXED_DOUBLES'
                  ? 'bg-[#111312] text-white'
                  : 'text-slate-600 hover:text-[#111312]'
              }`}
            >
              Phase 2: Mixed Doubles (
              {rounds.filter((r) => r.phase === 'MIXED_DOUBLES').length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              placeholder="Highlight player in schedule..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
            />
          </div>
        </div>
      </div>

      {/* Rounds List */}
      <div className="space-y-4">
        {filteredRounds.map((round) => {
          const isCurrent = round.roundNumber === activeRoundNumber;
          const isPastRound = round.roundNumber < activeRoundNumber;
          const allRoundMatches = [
            ...(round.archivedMatches || []),
            ...round.matches,
          ];
          const completedCount = allRoundMatches.filter(
            (m) => m.completed
          ).length;
          const isRoundAllCompleted =
            allRoundMatches.length > 0 &&
            completedCount === allRoundMatches.length;

          return (
            <div
              key={round.roundNumber}
              className={`bg-white border rounded-2xl p-5 transition-colors ${
                isCurrent ? 'border-[#111312]' : 'border-[#E6EAE4]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#E6EAE4]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`w-7 h-7 rounded-full text-xs font-mono tabular-nums font-bold flex items-center justify-center shrink-0 ${
                      isRoundAllCompleted
                        ? 'bg-[#98F64F] text-[#111312]'
                        : isCurrent
                        ? 'bg-[#111312] text-white'
                        : 'bg-[#F2F4F0] text-[#111312]'
                    }`}
                  >
                    {round.roundNumber}
                  </span>
                  <h3 className="text-base font-bold text-[#111312] font-display">
                    Round {round.roundNumber}
                  </h3>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs font-medium text-slate-600">
                    {round.phase === 'GENDER_SPLIT'
                      ? 'Phase 1: Gender Doubles Rotation'
                      : round.phase === 'MIXED_DOUBLES'
                      ? 'Phase 2: Mixed Doubles (Men + Women)'
                      : 'Custom Court Rotation'}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isRoundAllCompleted
                        ? 'text-[#287D0C] font-semibold'
                        : isPastRound
                        ? 'text-[#D84E34] font-medium'
                        : 'text-slate-500'
                    }`}
                  >
                    {completedCount}/{allRoundMatches.length} Scores Recorded
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isRoundAllCompleted && allRoundMatches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCompleteAllInRound(round)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#111312] bg-[#98F64F] rounded-lg hover:bg-[#88E63E] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Record All Round Scores</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectRound(round.roundNumber)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      isCurrent
                        ? 'bg-[#111312] text-white'
                        : 'bg-[#F2F4F0] text-[#111312] hover:bg-[#E5E9E2]'
                    }`}
                  >
                    {isCurrent ? 'Active on Live Courts' : 'Open on Live Courts'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                {allRoundMatches.map((match, matchIdx) => {
                  const pA1 = playerMap[match.teamA[0]];
                  const pA2 = playerMap[match.teamA[1]];
                  const pB1 = playerMap[match.teamB[0]];
                  const pB2 = playerMap[match.teamB[1]];
                  const sA = match.scoreA ?? 0;
                  const sB = match.scoreB ?? 0;
                  const teamAWon = match.completed && sA > sB;
                  const teamBWon = match.completed && sB > sA;
                  const isArchivedGame =
                    (round.archivedMatches?.length || 0) > 0 &&
                    matchIdx < (round.archivedMatches?.length || 0);

                  return (
                    <div
                      key={match.id}
                      className={`p-3.5 border rounded-xl flex flex-col justify-between space-y-2.5 ${
                        match.completed
                          ? 'bg-[#F3FCEB] border-[#BCEE94]'
                          : 'bg-[#F7F8F5] border-[#E6EAE4]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs border-b border-[#E6EAE4] pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#111312]">
                            {match.courtName}
                          </span>
                          {isArchivedGame && (
                            <span className="text-[11px] font-mono text-slate-500">
                              · Game {matchIdx + 1}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 font-mono tabular-nums">
                          {match.mode === 'MENS_DOUBLES'
                            ? "Men's"
                            : match.mode === 'WOMENS_DOUBLES'
                            ? "Women's"
                            : match.mode === 'MIXED_DOUBLES'
                            ? 'Mixed'
                            : 'Open'}
                        </span>
                      </div>

                      {/* Team 1 + Score Input */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5 text-xs min-w-0 flex-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            Team 1 {teamAWon ? '· WIN' : ''}
                          </div>
                          <div
                            className={`truncate ${
                              matchesPlayerQuery(match.teamA[0]) || teamAWon
                                ? 'font-bold text-[#287D0C]'
                                : 'text-[#111312]'
                            }`}
                          >
                            {pA1?.name}
                          </div>
                          <div
                            className={`truncate ${
                              matchesPlayerQuery(match.teamA[1]) || teamAWon
                                ? 'font-bold text-[#287D0C]'
                                : 'text-[#111312]'
                            }`}
                          >
                            {pA2?.name}
                          </div>
                        </div>

                        <input
                          type="number"
                          min={0}
                          max={30}
                          aria-label={`Round ${round.roundNumber} ${match.courtName} Team 1 Score`}
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
                          className="w-14 px-2 py-1 text-center text-sm font-mono tabular-nums font-semibold bg-white border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312] shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 py-0.5 border-y border-dashed border-[#D3D9D0]">
                        <span>VS</span>
                        <span
                          className={
                            match.completed
                              ? 'text-[#287D0C] font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          {match.completed
                            ? `Final: ${sA} - ${sB}`
                            : `${match.noveltyScore}% New`}
                        </span>
                      </div>

                      {/* Team 2 + Score Input */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5 text-xs min-w-0 flex-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            Team 2 {teamBWon ? '· WIN' : ''}
                          </div>
                          <div
                            className={`truncate ${
                              matchesPlayerQuery(match.teamB[0]) || teamBWon
                                ? 'font-bold text-[#287D0C]'
                                : 'text-[#111312]'
                            }`}
                          >
                            {pB1?.name}
                          </div>
                          <div
                            className={`truncate ${
                              matchesPlayerQuery(match.teamB[1]) || teamBWon
                                ? 'font-bold text-[#287D0C]'
                                : 'text-[#111312]'
                            }`}
                          >
                            {pB2?.name}
                          </div>
                        </div>

                        <input
                          type="number"
                          min={0}
                          max={30}
                          aria-label={`Round ${round.roundNumber} ${match.courtName} Team 2 Score`}
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
                          className="w-14 px-2 py-1 text-center text-sm font-mono tabular-nums font-semibold bg-white border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312] shrink-0"
                        />
                      </div>

                      {/* Record / Edit Score Footer */}
                      <div className="pt-2 border-t border-[#E6EAE4] flex items-center justify-between gap-2">
                        {!match.completed ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateMatchScore(
                                  round.roundNumber,
                                  match.id,
                                  11,
                                  8,
                                  true
                                )
                              }
                              className="px-2 py-1 text-xs font-medium text-[#111312] bg-white border border-[#E6EAE4] rounded-lg hover:bg-[#ECEFE9] transition-colors whitespace-nowrap shrink-0"
                            >
                              Log 11-8
                            </button>
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
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-[#111312] rounded-lg hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ml-auto"
                            >
                              <Check className="w-3 h-3 text-[#98F64F]" />
                              <span>Record Score</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-mono tabular-nums font-semibold text-[#287D0C]">
                              Recorded {sA} - {sB}
                            </span>
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
                              className="px-2 py-1 text-xs font-medium text-[#111312] bg-white border border-[#E6EAE4] rounded-lg hover:bg-[#ECEFE9] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </>
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
  );
};
