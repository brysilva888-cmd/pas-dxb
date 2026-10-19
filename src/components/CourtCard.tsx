import React from 'react';
import { ArrowLeftRight, ArrowRight, Check, RotateCcw, Trash2 } from 'lucide-react';
import { CourtMode, Match, Player, PlayerStats } from '../types';

interface CourtCardProps {
  match: Match;
  canRemoveCourt: boolean;
  playerMap: Record<string, Player>;
  statsMap: Record<string, PlayerStats>;
  selectedSwapPlayerId: string | null;
  onSelectSwapPlayer: (playerId: string) => void;
  onUpdateScore: (
    matchId: string,
    scoreA: number | null,
    scoreB: number | null,
    completed: boolean
  ) => void;
  onChangeCourtMode: (courtId: number, mode: CourtMode) => void;
  onRemoveCourt: (courtId: number) => void;
  onNextCourtGame: (courtId: number) => void;
}

const MODE_LABELS: Record<CourtMode, string> = {
  MENS_DOUBLES: "Men's Doubles",
  WOMENS_DOUBLES: "Women's Doubles",
  MIXED_DOUBLES: 'Mixed Doubles',
  OPEN_DOUBLES: 'Open Doubles',
};

export const CourtCard: React.FC<CourtCardProps> = ({
  match,
  canRemoveCourt,
  playerMap,
  statsMap,
  selectedSwapPlayerId,
  onSelectSwapPlayer,
  onUpdateScore,
  onChangeCourtMode,
  onRemoveCourt,
  onNextCourtGame,
}) => {
  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;

  const renderPlayerSlot = (playerId: string, sideLabel: string) => {
    const player = playerMap[playerId];
    const stats = statsMap[playerId];
    const isSelectedForSwap = selectedSwapPlayerId === playerId;
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;

    if (!player) {
      return (
        <div className="p-3 bg-[#F7F8F5] border border-[#E6EAE4] rounded-xl text-xs text-slate-400">
          Empty Slot
        </div>
      );
    }

    return (
      <div
        className={`group relative flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
          isSelectedForSwap
            ? 'bg-[#EFFCE6] border-[#65C71C]'
            : 'bg-white border-[#E6EAE4] hover:border-[#CDD5CA]'
        }`}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-[#111312] truncate block">
              {player.name}
            </span>
            <span
              title={`Session Record: ${wins} Wins, ${losses} Losses`}
              className={`text-[11px] font-mono tabular-nums shrink-0 ${
                wins > losses
                  ? 'text-[#287D0C] font-semibold'
                  : losses > wins
                  ? 'text-[#D84E34] font-medium'
                  : 'text-slate-500'
              }`}
            >
              {wins}W-{losses}L
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            <span>{player.gender === 'M' ? 'Men' : 'Women'}</span>
            <span aria-hidden="true">·</span>
            <span>{stats ? stats.gamesPlayed : 0} GP</span>
            <span aria-hidden="true">·</span>
            <span>
              {stats
                ? new Set([...stats.uniquePartners, ...stats.uniqueOpponents]).size
                : 0}{' '}
              Met
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400">{sideLabel}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectSwapPlayer(player.id)}
          title={
            isSelectedForSwap
              ? 'Cancel swap selection'
              : selectedSwapPlayerId
              ? 'Swap with selected player'
              : 'Swap this player with another court or bench'
          }
          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
            isSelectedForSwap
              ? 'bg-[#111312] text-white border-[#111312]'
              : selectedSwapPlayerId
              ? 'bg-[#FFF6D6] text-[#5C4500] border-[#F7D348] hover:bg-[#FCEB9F]'
              : 'bg-[#F7F8F5] text-slate-700 border-[#E6EAE4] hover:bg-[#EEF1EC] hover:text-[#111312]'
          }`}
        >
          <ArrowLeftRight className="w-3 h-3 shrink-0" />
          <span>
            {isSelectedForSwap
              ? 'Selected'
              : selectedSwapPlayerId
              ? 'Swap Here'
              : 'Swap'}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white border border-[#E6EAE4] rounded-2xl p-5 flex flex-col justify-between">
      {/* Court Header */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[#E6EAE4]">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <span
                className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                  match.completed
                    ? 'bg-[#98F64F] text-[#111312]'
                    : match.mode === 'MIXED_DOUBLES'
                    ? 'bg-[#F7D348] text-[#111312]'
                    : 'bg-[#111312] text-white'
                }`}
              >
                {match.courtId}
              </span>
              <h3 className="text-base font-bold text-[#111312] font-display whitespace-nowrap">
                {match.courtName}
              </h3>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                {MODE_LABELS[match.mode]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
              {match.repeatPartners === 0 && match.repeatOpponents === 0 ? (
                <span className="text-[#287D0C] font-semibold">
                  ✓ 100% First-Time Meetings (0 Repeats)
                </span>
              ) : (
                <span className="text-amber-700 font-semibold">
                  {match.noveltyScore}% Unique ·{' '}
                  {match.repeatPartners + match.repeatOpponents} Repeat Meeting
                  {match.repeatPartners + match.repeatOpponents === 1 ? '' : 's'}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span>{match.repeatOpponents} Repeat Opp</span>
              <span aria-hidden="true">·</span>
              <span>{match.repeatPartners} Repeat Partner</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              aria-label={`Change mode for ${match.courtName}`}
              value={match.mode}
              onChange={(e) =>
                onChangeCourtMode(match.courtId, e.target.value as CourtMode)
              }
              className="text-xs font-medium text-[#111312] bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg px-2.5 py-1.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#111312]"
            >
              <option value="MENS_DOUBLES">Men&apos;s Doubles</option>
              <option value="WOMENS_DOUBLES">Women&apos;s Doubles</option>
              <option value="MIXED_DOUBLES">Mixed Doubles</option>
              <option value="OPEN_DOUBLES">Open Doubles</option>
            </select>

            {canRemoveCourt && (
              <button
                type="button"
                onClick={() => onRemoveCourt(match.courtId)}
                title={`Remove ${match.courtName} and return players to bench`}
                className="p-1.5 text-slate-400 hover:text-[#D84E34] hover:bg-[#FFF0ED] border border-[#E6EAE4] rounded-lg transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Novelty Progress Strip (Hatched Bar like Reference Overview) */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Court Matchup Freshness</span>
            <span className="font-mono tabular-nums font-semibold text-[#111312]">
              {match.noveltyScore}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#EFF1ED] rounded-md overflow-hidden">
            <div
              className="h-full spectrum-hatch-bar rounded-md transition-opacity"
              style={{ width: `${Math.max(15, match.noveltyScore)}%` }}
            />
          </div>
        </div>

        {/* Architectural Court Surface */}
        <div className="mt-3.5 bg-[#F8F9F6] border border-[#E6EAE4] rounded-xl p-3.5">
          {/* Team A */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-0.5">
              <span>Team 1 (North Side)</span>
              <span className="font-mono tabular-nums">Doubles Pair A</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {renderPlayerSlot(match.teamA[0], 'Left')}
              {renderPlayerSlot(match.teamA[1], 'Right')}
            </div>
          </div>

          {/* Net Divider */}
          <div className="my-3 flex items-center gap-3">
            <div className="flex-1 border-t border-dashed border-[#D3D9D0]" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Net · Kitchen Line
            </span>
            <div className="flex-1 border-t border-dashed border-[#D3D9D0]" />
          </div>

          {/* Team B */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              {renderPlayerSlot(match.teamB[0], 'Left')}
              {renderPlayerSlot(match.teamB[1], 'Right')}
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-0.5 pt-0.5">
              <span>Team 2 (South Side)</span>
              <span className="font-mono tabular-nums">Doubles Pair B</span>
            </div>
          </div>
        </div>
      </div>

      {/* Score & Completion Controls */}
      <div className="mt-4 pt-3.5 border-t border-[#E6EAE4] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Score:</span>
          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            <input
              type="number"
              min={0}
              max={25}
              aria-label="Team 1 Score"
              value={match.scoreA ?? ''}
              placeholder="11"
              onChange={(e) => {
                const val =
                  e.target.value === ''
                    ? null
                    : Math.max(0, parseInt(e.target.value, 10) || 0);
                onUpdateScore(match.id, val, match.scoreB, match.completed);
              }}
              className="w-14 px-2 py-1 text-center text-sm font-semibold bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
            />
            <span className="text-slate-400">-</span>
            <input
              type="number"
              min={0}
              max={25}
              aria-label="Team 2 Score"
              value={match.scoreB ?? ''}
              placeholder="8"
              onChange={(e) => {
                const val =
                  e.target.value === ''
                    ? null
                    : Math.max(0, parseInt(e.target.value, 10) || 0);
                onUpdateScore(match.id, match.scoreA, val, match.completed);
              }}
              className="w-14 px-2 py-1 text-center text-sm font-semibold bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!match.completed ? (
            <>
              <button
                type="button"
                onClick={() => onUpdateScore(match.id, 11, 8, true)}
                className="px-2.5 py-1.5 text-xs font-medium text-[#111312] bg-[#F2F4F0] rounded-lg hover:bg-[#E5E9E2] transition-colors whitespace-nowrap shrink-0"
              >
                Log 11-8
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateScore(
                    match.id,
                    match.scoreA ?? 11,
                    match.scoreB ?? 9,
                    true
                  )
                }
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#111312] rounded-lg hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5 text-[#98F64F]" />
                <span>Complete Game</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#287D0C] font-mono tabular-nums">
                Final {scoreA} - {scoreB}
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateScore(match.id, match.scoreA, match.scoreB, false)
                }
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-[#F2F4F0] rounded-lg hover:bg-[#E5E9E2] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reopen</span>
              </button>
              <button
                type="button"
                onClick={() => onNextCourtGame(match.courtId)}
                className="px-3 py-1 text-xs font-medium text-white bg-[#111312] rounded-lg hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
              >
                <span>Next Game</span>
                <ArrowRight className="w-3 h-3 text-[#98F64F]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
