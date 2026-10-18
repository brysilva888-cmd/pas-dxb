import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileText,
  Flame,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Gender, Player, PlayerStats } from '../types';
import {
  generateSampleTxtContent,
  ParsedBulkPlayer,
  parseBulkNamesText,
} from '../utils/scheduler';

interface PlayerRosterViewProps {
  players: Player[];
  statsMap: Record<string, PlayerStats>;
  currentCourtCount: number;
  currentMenCourtsPhase1: number;
  currentGenderRoundsCount: number;
  currentMixedRoundsCount: number;
  onAddPlayer: (name: string, gender: Gender) => Player;
  onBulkImportPlayers: (
    parsedPlayers: ParsedBulkPlayer[],
    mode: 'REPLACE' | 'APPEND'
  ) => void;
  onToggleActive: (playerId: string) => void;
  onDeletePlayer: (playerId: string) => void;
  onBulkDeletePlayers: (playerIds: string[]) => void;
  onClearAllPlayers: () => void;
  onResetRoundsKeepRoster: () => void;
  onRebuildWithCurrentRoster: (
    targetMenCount: number,
    targetWomenCount: number,
    courtCount: number,
    menCourtsPhase1: number,
    genderRounds: number,
    mixedRounds: number
  ) => void;
  onResetToDefaultSample: () => void;
}

export const PlayerRosterView: React.FC<PlayerRosterViewProps> = ({
  players,
  statsMap,
  currentCourtCount,
  currentMenCourtsPhase1,
  currentGenderRoundsCount,
  currentMixedRoundsCount,
  onAddPlayer,
  onBulkImportPlayers,
  onToggleActive,
  onDeletePlayer,
  onBulkDeletePlayers,
  onClearAllPlayers,
  onResetRoundsKeepRoster,
  onRebuildWithCurrentRoster,
  onResetToDefaultSample,
}) => {
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<Gender>('M');
  const [filterGender, setFilterGender] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    new Set()
  );

  // Bulk .txt File & Paste State
  const [importMode, setImportMode] = useState<'REPLACE' | 'APPEND'>('REPLACE');
  const [bulkText, setBulkText] = useState('');
  const [bulkDefaultGender, setBulkDefaultGender] = useState<Gender>('M');
  const combinedFileInputRef = useRef<HTMLInputElement | null>(null);
  const menFileInputRef = useRef<HTMLInputElement | null>(null);
  const womenFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentMenCount = players.filter((p) => p.gender === 'M').length;
  const currentWomenCount = players.filter((p) => p.gender === 'F').length;
  const activePlayersCount = players.filter((p) => p.active).length;

  // Session Generator Form State (synced with current uploaded roster & active court config)
  const [menCountInput, setMenCountInput] = useState(currentMenCount);
  const [womenCountInput, setWomenCountInput] = useState(currentWomenCount);
  const [courtCountInput, setCourtCountInput] = useState(currentCourtCount);
  const [menCourtsPhase1Input, setMenCourtsPhase1Input] = useState(
    currentMenCourtsPhase1
  );
  const [genderRoundsInput, setGenderRoundsInput] = useState(
    currentGenderRoundsCount
  );
  const [mixedRoundsInput, setMixedRoundsInput] = useState(
    currentMixedRoundsCount
  );

  useEffect(() => {
    setMenCountInput(currentMenCount);
    setWomenCountInput(currentWomenCount);
  }, [currentMenCount, currentWomenCount]);

  useEffect(() => {
    setCourtCountInput(currentCourtCount);
    setMenCourtsPhase1Input(Math.min(currentCourtCount, currentMenCourtsPhase1));
  }, [currentCourtCount, currentMenCourtsPhase1]);

  useEffect(() => {
    setGenderRoundsInput(currentGenderRoundsCount);
    setMixedRoundsInput(currentMixedRoundsCount);
  }, [currentGenderRoundsCount, currentMixedRoundsCount]);

  const triggerAddPlayer = () => {
    const fallbackNumber =
      players.filter((p) => p.gender === newGender).length + 1;
    const cleanName =
      newName.trim() ||
      `${newGender === 'M' ? 'Men' : 'Women'} Player ${fallbackNumber}`;

    const created = onAddPlayer(cleanName, newGender);
    setNewName('');
    setRecentlyAddedId(created.id);
    setAddedFeedback(
      `Added ${created.name} to the active ${
        created.gender === 'M' ? 'Men' : 'Women'
      } rotation and updated upcoming rounds.`
    );
  };

  const handleAddFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerAddPlayer();
  };

  const handleTxtFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    defaultGender: Gender
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const parsed = parseBulkNamesText(content, defaultGender);
      if (parsed.length === 0) {
        setAddedFeedback(
          `No valid player names found in "${file.name}". Please ensure there is one name per line.`
        );
        return;
      }

      onBulkImportPlayers(parsed, importMode);
      const mCount = parsed.filter((p) => p.gender === 'M').length;
      const wCount = parsed.filter((p) => p.gender === 'F').length;
      setSelectedPlayerIds(new Set());
      setAddedFeedback(
        `Imported ${parsed.length} players (${mCount} Men, ${wCount} Women) from "${
          file.name
        }" (${
          importMode === 'REPLACE'
            ? 'replaced roster and rebuilt schedule'
            : 'appended to roster'
        }).`
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePasteBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    const parsed = parseBulkNamesText(bulkText, bulkDefaultGender);
    if (parsed.length === 0) return;

    onBulkImportPlayers(parsed, importMode);
    const mCount = parsed.filter((p) => p.gender === 'M').length;
    const wCount = parsed.filter((p) => p.gender === 'F').length;
    setBulkText('');
    setSelectedPlayerIds(new Set());
    setAddedFeedback(
      `Imported ${parsed.length} players (${mCount} Men, ${wCount} Women) from bulk text (${
        importMode === 'REPLACE'
          ? 'replaced roster and rebuilt schedule'
          : 'appended to roster'
      }).`
    );
  };

  const handleDownloadTxtTemplate = () => {
    const txtContent = generateSampleTxtContent(players);
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pickleball_open_play_roster.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredPlayers = players.filter((p) =>
    filterGender === 'ALL' ? true : p.gender === filterGender
  );

  const allShownSelected =
    filteredPlayers.length > 0 &&
    filteredPlayers.every((p) => selectedPlayerIds.has(p.id));

  const handleToggleSelectAllShown = () => {
    if (allShownSelected) {
      const next = new Set(selectedPlayerIds);
      filteredPlayers.forEach((p) => next.delete(p.id));
      setSelectedPlayerIds(next);
    } else {
      const next = new Set(selectedPlayerIds);
      filteredPlayers.forEach((p) => next.add(p.id));
      setSelectedPlayerIds(next);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedPlayerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPlayerIds(next);
  };

  const handleRemoveSelected = () => {
    if (selectedPlayerIds.size === 0) return;
    const count = selectedPlayerIds.size;
    onBulkDeletePlayers(Array.from(selectedPlayerIds));
    setSelectedPlayerIds(new Set());
    setAddedFeedback(`Removed ${count} selected player(s) from the roster.`);
  };

  const handleRemoveAllActive = () => {
    const activeIds = players.filter((p) => p.active).map((p) => p.id);
    if (activeIds.length === 0) return;
    onBulkDeletePlayers(activeIds);
    setSelectedPlayerIds(new Set());
    setAddedFeedback(
      `Removed all ${activeIds.length} active player(s) from the roster.`
    );
  };

  const handleClearEntireRoster = () => {
    onClearAllPlayers();
    setSelectedPlayerIds(new Set());
    setAddedFeedback(
      'Cleared entire player roster. Upload a .txt file or add players to build a new schedule.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Bulk .txt File Import & Paste Section */}
      <div className="bg-white border border-[#E6EAE4] rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6EAE4]">
          <div>
            <h2 className="text-lg font-bold text-[#111312] font-display flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#287D0C]" />
              <span>Bulk Import Players from .txt File</span>
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Upload a <span className="font-mono text-xs">.txt</span> file with one player name per line (supports <span className="font-mono text-xs">Men:</span> and <span className="font-mono text-xs">Women:</span> sections, <span className="font-mono text-xs">Name, M</span> / <span className="font-mono text-xs">Name, W</span>, or separate Men &amp; Women files).
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadTxtTemplate}
            className="px-3.5 py-2 text-xs font-medium text-[#111312] bg-[#F2F4F0] rounded-xl hover:bg-[#E5E9E2] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 self-start md:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .txt Template / Roster</span>
          </button>
        </div>

        {/* Import Mode & .txt Upload Buttons */}
        <div className="pt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700">
                When Importing:
              </span>
              <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-xl">
                <button
                  type="button"
                  onClick={() => setImportMode('REPLACE')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    importMode === 'REPLACE'
                      ? 'bg-[#111312] text-white'
                      : 'text-slate-600 hover:text-[#111312]'
                  }`}
                >
                  Replace Roster &amp; Rebuild Courts
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('APPEND')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    importMode === 'APPEND'
                      ? 'bg-[#111312] text-white'
                      : 'text-slate-600 hover:text-[#111312]'
                  }`}
                >
                  Add to Existing Roster
                </button>
              </div>
            </div>

            {/* Hidden File Inputs */}
            <input
              ref={combinedFileInputRef}
              type="file"
              accept=".txt,.csv,text/plain"
              onChange={(e) => handleTxtFileUpload(e, 'M')}
              className="hidden"
            />
            <input
              ref={menFileInputRef}
              type="file"
              accept=".txt,.csv,text/plain"
              onChange={(e) => handleTxtFileUpload(e, 'M')}
              className="hidden"
            />
            <input
              ref={womenFileInputRef}
              type="file"
              accept=".txt,.csv,text/plain"
              onChange={(e) => handleTxtFileUpload(e, 'F')}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => combinedFileInputRef.current?.click()}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#111312] rounded-xl hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-[#98F64F]" />
                <span>Upload Combined .txt (Men &amp; Women)</span>
              </button>
              <button
                type="button"
                onClick={() => menFileInputRef.current?.click()}
                className="px-3 py-2 text-xs font-medium text-[#111312] bg-[#F2F4F0] border border-[#E6EAE4] rounded-xl hover:bg-[#E5E9E2] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Men .txt</span>
              </button>
              <button
                type="button"
                onClick={() => womenFileInputRef.current?.click()}
                className="px-3 py-2 text-xs font-medium text-[#111312] bg-[#F2F4F0] border border-[#E6EAE4] rounded-xl hover:bg-[#E5E9E2] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Women .txt</span>
              </button>
            </div>
          </div>

          {/* Or Paste Bulk Names Directly */}
          <form
            onSubmit={handlePasteBulkSubmit}
            className="pt-3 border-t border-slate-200 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="bulk-paste-textarea"
                className="text-xs font-medium text-slate-700"
              >
                Or Paste Bulk Names Directly (one name per line):
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Default Division:</span>
                <select
                  value={bulkDefaultGender}
                  onChange={(e) => setBulkDefaultGender(e.target.value as Gender)}
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="M">Men (unless tagged W/Women)</option>
                  <option value="F">Women (unless tagged M/Men)</option>
                </select>
              </div>
            </div>

            <textarea
              id="bulk-paste-textarea"
              rows={4}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Men:\nLiam Carter\nNoah Bennett\n\nWomen:\nOlivia Chen\nEmma Rodriguez`}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Tip: Include <span className="font-mono">Men:</span> and{' '}
                <span className="font-mono">Women:</span> headers, or write{' '}
                <span className="font-mono">Name, M</span> /{' '}
                <span className="font-mono">Name, W</span>.
              </span>
              <button
                type="submit"
                disabled={!bulkText.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                Import Pasted Names
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Add Individual Player + Roster Management & Bulk Remove */}
      <div className="bg-white border border-[#E6EAE4] rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6EAE4]">
          <div>
            <h2 className="text-lg font-bold text-[#111312] font-display">
              Player Roster &amp; Bulk Remove / Reset
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Add individual players, select multiple rows to delete, bulk-remove active players, or reset the roster.
            </p>
          </div>

          {/* Bulk Reset & Remove Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedPlayerIds.size > 0 && (
              <button
                type="button"
                onClick={handleRemoveSelected}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#F06449] rounded-lg hover:bg-[#D84E34] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Selected ({selectedPlayerIds.size})</span>
              </button>
            )}

            <button
              type="button"
              disabled={activePlayersCount === 0}
              onClick={handleRemoveAllActive}
              className="px-3 py-1.5 text-xs font-medium text-[#D84E34] bg-[#FFF0ED] border border-[#F8B4A6] rounded-lg hover:bg-[#FFE3DC] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Active Players ({activePlayersCount})</span>
            </button>

            <button
              type="button"
              disabled={players.length === 0}
              onClick={handleClearEntireRoster}
              className="px-3 py-1.5 text-xs font-medium text-[#111312] bg-[#F2F4F0] border border-[#E6EAE4] rounded-lg hover:bg-[#E5E9E2] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Roster</span>
            </button>

            <button
              type="button"
              disabled={players.length === 0}
              onClick={() => {
                onResetRoundsKeepRoster();
                setAddedFeedback(
                  'Reset all round history and stats back to Round 1 using your current uploaded roster.'
                );
              }}
              className="px-3 py-1.5 text-xs font-medium text-[#111312] bg-[#F2F4F0] border border-[#E6EAE4] rounded-lg hover:bg-[#E5E9E2] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Stats (Keep Roster)</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleAddFormSubmit}
          className="pt-4 flex flex-wrap items-end gap-3 pb-5 border-b border-[#E6EAE4]"
        >
          <div className="flex-1 min-w-[220px]">
            <label
              htmlFor="add-player-name-input"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Player Name
            </label>
            <input
              id="add-player-name-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter player name (or leave blank to auto-number)"
              className="w-full px-3 py-2 text-xs bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
            />
          </div>

          <div>
            <label
              htmlFor="add-player-gender-select"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Division
            </label>
            <select
              id="add-player-gender-select"
              value={newGender}
              onChange={(e) => setNewGender(e.target.value as Gender)}
              className="px-3 py-2 text-xs bg-[#F7F8F5] border border-[#E6EAE4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111312]"
            >
              <option value="M">Men</option>
              <option value="F">Women</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#111312] rounded-xl hover:bg-[#272B29] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#98F64F]" />
            <span>Add Player</span>
          </button>
        </form>

        {addedFeedback && (
          <div className="mt-4 px-3.5 py-2.5 bg-[#EFFCE6] border border-[#BCEE94] rounded-xl flex items-center justify-between gap-3 text-xs text-[#111312]">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#287D0C] shrink-0" />
              <span>{addedFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setAddedFeedback(null)}
              className="text-[#287D0C] hover:text-[#111312] font-semibold whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Controls */}
        <div className="py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-xl">
            <button
              type="button"
              onClick={() => setFilterGender('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                filterGender === 'ALL'
                  ? 'bg-[#111312] text-white'
                  : 'text-slate-600 hover:text-[#111312]'
              }`}
            >
              All ({players.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('M')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                filterGender === 'M'
                  ? 'bg-[#111312] text-white'
                  : 'text-slate-600 hover:text-[#111312]'
              }`}
            >
              Men ({currentMenCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('F')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                filterGender === 'F'
                  ? 'bg-[#111312] text-white'
                  : 'text-slate-600 hover:text-[#111312]'
              }`}
            >
              Women ({currentWomenCount})
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {activePlayersCount} Checked In ·{' '}
            {players.filter((p) => !p.active).length} Paused
          </span>
        </div>

        {/* High-Density Roster Table */}
        {filteredPlayers.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#CFD7CC] rounded-xl space-y-3">
            <p className="text-sm font-medium text-[#111312]">
              No players in this view.
            </p>
            <p className="text-xs text-slate-500">
              Upload a <span className="font-mono">.txt</span> file above, add individual players, or load the default sample roster.
            </p>
            <button
              type="button"
              onClick={onResetToDefaultSample}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#111312] rounded-xl hover:bg-[#272B29] transition-colors"
            >
              Load Default Sample Roster (25 Men + 20 Women)
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E6EAE4] rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F7F8F5] border-b border-[#E6EAE4] text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all shown players"
                      checked={allShownSelected}
                      onChange={handleToggleSelectAllShown}
                      className="rounded border-slate-300 text-[#111312] focus:ring-[#111312]"
                    />
                  </th>
                  <th className="py-2.5 px-3">Player Name</th>
                  <th className="py-2.5 px-3">Division</th>
                  <th className="py-2.5 px-3 text-right">Games Played</th>
                  <th className="py-2.5 px-3 text-right">Gender / Mixed</th>
                  <th className="py-2.5 px-3 text-right">Unique Opponents</th>
                  <th className="py-2.5 px-3 text-right">Unique Partners</th>
                  <th className="py-2.5 px-3 text-right">W - L</th>
                  <th className="py-2.5 px-4 text-right">Status / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredPlayers.map((player) => {
                  const st = statsMap[player.id];
                  const winStreak = st?.currentWinStreak || 0;
                  const isOnWinStreak = winStreak >= 3;
                  const isNew = player.id === recentlyAddedId;
                  const isChecked = selectedPlayerIds.has(player.id);
                  return (
                    <tr
                      key={player.id}
                      className={`transition-colors ${
                        isChecked
                          ? 'bg-amber-50/60'
                          : isNew
                          ? 'bg-emerald-50/70'
                          : !player.active
                          ? 'opacity-60 bg-slate-50/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${player.name}`}
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(player.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{player.name}</span>
                          {isOnWinStreak && (
                            <span
                              title={`${winStreak}-game win streak`}
                              className="inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums font-semibold text-amber-600 shrink-0"
                            >
                              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <span>{winStreak}W</span>
                            </span>
                          )}
                          {isNew && (
                            <span className="text-[11px] font-mono text-emerald-700">
                              · Just Added
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {player.gender === 'M' ? 'Men' : 'Women'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                        {st?.gamesPlayed || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {st?.genderGamesPlayed || 0}G / {st?.mixedGamesPlayed || 0}M
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {st?.uniqueOpponents.length || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {st?.uniquePartners.length || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {st?.wins || 0} - {st?.losses || 0}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleActive(player.id)}
                            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                              player.active
                                ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {player.active ? (
                              <>
                                <UserCheck className="w-3 h-3 text-emerald-600" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3 text-amber-600" />
                                <span>Paused</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePlayer(player.id)}
                            title="Remove player"
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule & Court Format Configurator (Uses Current Uploaded Roster!) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-display">
              Auto-Generate by Player Counts &amp; Court Format
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Uses your <span className="font-semibold text-slate-900">current uploaded roster ({currentMenCount} Men, {currentWomenCount} Women)</span> to build Phase 1 (Gender Doubles) and Phase 2 (Mixed Doubles) rounds.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setMenCountInput(currentMenCount);
              setWomenCountInput(currentWomenCount);
              setAddedFeedback(
                `Synced counts with current uploaded roster (${currentMenCount} Men, ${currentWomenCount} Women).`
              );
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            Fetch Current Roster Counts ({currentMenCount} Men / {currentWomenCount} Women)
          </button>
        </div>

        <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Men Players (Roster: {currentMenCount})
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={menCountInput}
              onChange={(e) =>
                setMenCountInput(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Women Players (Roster: {currentWomenCount})
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={womenCountInput}
              onChange={(e) =>
                setWomenCountInput(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Total Courts
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={courtCountInput}
              onChange={(e) => {
                const c = Math.max(
                  1,
                  Math.min(20, parseInt(e.target.value, 10) || 4)
                );
                setCourtCountInput(c);
                if (menCourtsPhase1Input > c) setMenCourtsPhase1Input(c);
              }}
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Phase 1 Split (Men / Women)
            </label>
            <select
              value={menCourtsPhase1Input}
              onChange={(e) =>
                setMenCourtsPhase1Input(parseInt(e.target.value, 10))
              }
              className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {Array.from({ length: courtCountInput + 1 }, (_, mCourts) => {
                const wCourts = courtCountInput - mCourts;
                return (
                  <option key={mCourts} value={mCourts}>
                    {mCourts} Men / {wCourts} Women Courts
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Gender Games / Player
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={genderRoundsInput}
              onChange={(e) =>
                setGenderRoundsInput(
                  Math.max(1, parseInt(e.target.value, 10) || 4)
                )
              }
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mixed Games / Player
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={mixedRoundsInput}
              onChange={(e) =>
                setMixedRoundsInput(
                  Math.max(0, parseInt(e.target.value, 10) || 0)
                )
              }
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Schedules every active player for {genderRoundsInput} Gender Doubles games and {mixedRoundsInput} Mixed Doubles {mixedRoundsInput === 1 ? 'game' : 'games'}.
          </span>
          <button
            type="button"
            onClick={() =>
              onRebuildWithCurrentRoster(
                menCountInput,
                womenCountInput,
                courtCountInput,
                menCourtsPhase1Input,
                genderRoundsInput,
                mixedRoundsInput
              )
            }
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Rebuild Schedule Using Current Roster ({menCountInput} Men + {womenCountInput} Women)
          </button>
        </div>
      </div>
    </div>
  );
};
