import { jsPDF } from 'jspdf';
import { Player, PlayerStats, Round } from '../types';

export interface PdfPlayerRow {
  rank: number;
  player: Player;
  completedGames: number;
  scheduledGames: number;
  wins: number;
  losses: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

interface MixedPairSummary {
  pairName: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointDiff: number;
}

export function downloadDashboardStatsPdf(
  players: Player[],
  statsMap: Record<string, PlayerStats>,
  rounds: Round[]
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190

  // Map players by ID
  const playerMap: Record<string, Player> = {};
  for (const p of players) {
    playerMap[p.id] = p;
  }

  // Compute exact player stats across all completed matches in all rounds
  const completedStatsByPlayer: Record<
    string,
    {
      completedGames: number;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  > = {};

  for (const p of players) {
    completedStatsByPlayer[p.id] = {
      completedGames: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
  }

  let totalScheduledMatches = 0;
  let totalCompletedMatches = 0;
  let completedRoundsCount = 0;
  let totalPointsScored = 0;

  const mixedPairMap: Record<
    string,
    {
      pairName: string;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  > = {};

  const completedRoundSummaries: Array<{
    roundNumber: number;
    phaseLabel: string;
    matches: Array<{
      courtName: string;
      modeLabel: string;
      teamANames: string;
      teamBNames: string;
      scoreA: number;
      scoreB: number;
    }>;
  }> = [];

  for (const round of rounds) {
    const allMatches = [...(round.archivedMatches || []), ...round.matches];
    totalScheduledMatches += allMatches.length;

    const completedInRound = allMatches.filter(
      (m) => m.completed && m.scoreA !== null && m.scoreB !== null
    );

    if (allMatches.length > 0 && completedInRound.length === allMatches.length) {
      completedRoundsCount += 1;
    } else if (completedInRound.length > 0 && round.matches.every((m) => m.completed)) {
      completedRoundsCount += 1;
    }

    if (completedInRound.length > 0) {
      completedRoundSummaries.push({
        roundNumber: round.roundNumber,
        phaseLabel:
          round.phase === 'MIXED_DOUBLES' ? 'Mixed Doubles' : 'Gender Doubles',
        matches: completedInRound.map((m) => {
          const pA1 = playerMap[m.teamA[0]]?.name || 'TBD';
          const pA2 = playerMap[m.teamA[1]]?.name || 'TBD';
          const pB1 = playerMap[m.teamB[0]]?.name || 'TBD';
          const pB2 = playerMap[m.teamB[1]]?.name || 'TBD';
          return {
            courtName: m.courtName,
            modeLabel:
              m.mode === 'MENS_DOUBLES'
                ? 'Men'
                : m.mode === 'WOMENS_DOUBLES'
                ? 'Women'
                : 'Mixed',
            teamANames: `${pA1} & ${pA2}`,
            teamBNames: `${pB1} & ${pB2}`,
            scoreA: m.scoreA ?? 0,
            scoreB: m.scoreB ?? 0,
          };
        }),
      });
    }

    for (const match of completedInRound) {
      totalCompletedMatches += 1;
      const sA = match.scoreA ?? 0;
      const sB = match.scoreB ?? 0;
      totalPointsScored += sA + sB;

      const aWon = sA > sB;
      const bWon = sB > sA;

      for (const pid of match.teamA) {
        if (completedStatsByPlayer[pid]) {
          completedStatsByPlayer[pid].completedGames += 1;
          completedStatsByPlayer[pid].pointsFor += sA;
          completedStatsByPlayer[pid].pointsAgainst += sB;
          if (aWon) completedStatsByPlayer[pid].wins += 1;
          else if (bWon) completedStatsByPlayer[pid].losses += 1;
        }
      }

      for (const pid of match.teamB) {
        if (completedStatsByPlayer[pid]) {
          completedStatsByPlayer[pid].completedGames += 1;
          completedStatsByPlayer[pid].pointsFor += sB;
          completedStatsByPlayer[pid].pointsAgainst += sA;
          if (bWon) completedStatsByPlayer[pid].wins += 1;
          else if (aWon) completedStatsByPlayer[pid].losses += 1;
        }
      }

      // Track Mixed Doubles pairs for Crown Champion card
      if (match.mode === 'MIXED_DOUBLES' || round.phase === 'MIXED_DOUBLES') {
        const recordMixed = (
          team: [string, string],
          myScore: number,
          oppScore: number
        ) => {
          const p1 = playerMap[team[0]];
          const p2 = playerMap[team[1]];
          if (!p1 || !p2) return;
          const ordered =
            p1.gender === 'M' && p2.gender === 'F'
              ? [p1, p2]
              : p2.gender === 'M' && p1.gender === 'F'
              ? [p2, p1]
              : [p1, p2].sort((a, b) => a.id.localeCompare(b.id));
          const key = `${ordered[0].id}__${ordered[1].id}`;
          if (!mixedPairMap[key]) {
            mixedPairMap[key] = {
              pairName: `${ordered[0].name} & ${ordered[1].name}`,
              wins: 0,
              losses: 0,
              pointsFor: 0,
              pointsAgainst: 0,
            };
          }
          mixedPairMap[key].pointsFor += myScore;
          mixedPairMap[key].pointsAgainst += oppScore;
          if (myScore > oppScore) mixedPairMap[key].wins += 1;
          if (oppScore > myScore) mixedPairMap[key].losses += 1;
        };
        recordMixed(match.teamA, sA, sB);
        recordMixed(match.teamB, sB, sA);
      }
    }
  }

  // Build sorted player rows
  const sortedRows: PdfPlayerRow[] = players
    .map((player) => {
      const cStats = completedStatsByPlayer[player.id];
      const fallbackStats = statsMap[player.id];
      const wins = cStats ? cStats.wins : fallbackStats?.wins || 0;
      const losses = cStats ? cStats.losses : fallbackStats?.losses || 0;
      const completedGames = cStats
        ? cStats.completedGames
        : wins + losses;
      const pointsFor = cStats
        ? cStats.pointsFor
        : fallbackStats?.pointsFor || 0;
      const pointsAgainst = cStats
        ? cStats.pointsAgainst
        : fallbackStats?.pointsAgainst || 0;
      const pointDiff = pointsFor - pointsAgainst;
      const winPct =
        completedGames > 0 ? Math.round((wins / completedGames) * 100) : 0;

      return {
        rank: 0,
        player,
        completedGames,
        scheduledGames: fallbackStats?.gamesPlayed || 0,
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
      if (b.completedGames !== a.completedGames) {
        return b.completedGames - a.completedGames;
      }
      return a.player.name.localeCompare(b.player.name);
    })
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  // Determine Crown Champions (only when pointsFor > 0)
  const menByScore = [...sortedRows]
    .filter((r) => r.player.gender === 'M' && r.pointsFor > 0)
    .sort((a, b) => {
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointDiff - a.pointDiff;
    });
  const topMan = menByScore[0] || null;

  const womenByScore = [...sortedRows]
    .filter((r) => r.player.gender === 'F' && r.pointsFor > 0)
    .sort((a, b) => {
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointDiff - a.pointDiff;
    });
  const topWoman = womenByScore[0] || null;

  const mixedRanked: MixedPairSummary[] = Object.values(mixedPairMap)
    .filter((m) => m.pointsFor > 0)
    .map((m) => ({
      pairName: m.pairName,
      wins: m.wins,
      losses: m.losses,
      pointsFor: m.pointsFor,
      pointDiff: m.pointsFor - m.pointsAgainst,
    }))
    .sort((a, b) => {
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointDiff - a.pointDiff;
    });
  const topMixed = mixedRanked[0] || null;

  const menCount = players.filter((p) => p.gender === 'M').length;
  const womenCount = players.filter((p) => p.gender === 'F').length;
  const completionPct =
    totalScheduledMatches > 0
      ? Math.round((totalCompletedMatches / totalScheduledMatches) * 100)
      : 0;

  const paintPageBackground = () => {
    doc.setFillColor(245, 246, 243); // #F5F6F3
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const drawPageHeader = (isContinuation = false) => {
    // Jet-Black Dashboard Banner Card (#111312)
    doc.setFillColor(17, 19, 18);
    doc.roundedRect(margin, 8, contentWidth, isContinuation ? 18 : 26, 3.5, 3.5, 'F');

    // Electric-Lime Pill Badge (#98F64F)
    doc.setFillColor(152, 246, 79);
    doc.roundedRect(margin + 5, 11.5, 48, 5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(17, 19, 18);
    doc.text('LIVE TELEMETRY REPORT', margin + 29, 15, { align: 'center' });

    // Main Brand Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isContinuation ? 12 : 14.5);
    doc.setTextColor(255, 255, 255);
    doc.text(
      'PICKLE & SMASH DXB Open Play',
      isContinuation ? margin + 57 : margin + 5,
      isContinuation ? 15.5 : 23.5
    );

    if (!isContinuation) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(185, 192, 184);
      doc.text(
        'Official Player Roster Standings, Total Games Played, W-L Records & Point Differentials',
        margin + 5,
        29.5
      );
    }

    // Right-hand Timestamp & Match Counter Pill
    const dateStr = new Date().toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(152, 246, 79);
    doc.text(
      `${totalCompletedMatches} / ${totalScheduledMatches} Matches Completed`,
      pageWidth - margin - 5,
      isContinuation ? 14.5 : 17,
      { align: 'right' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(185, 192, 184);
    doc.text(
      `Exported: ${dateStr}`,
      pageWidth - margin - 5,
      isContinuation ? 19.5 : 23,
      { align: 'right' }
    );
  };

  // --- PAGE 1 ---
  paintPageBackground();
  drawPageHeader(false);

  // 1. 4-Card KPI Telemetry Row (y = 37, h = 19)
  const kpiY = 37;
  const kpiGap = 3.5;
  const kpiW = (contentWidth - kpiGap * 3) / 4;
  const kpiH = 19;

  const kpis = [
    {
      label: 'PLAYER ROSTER',
      value: `${players.length}`,
      sub: `${menCount} Men · ${womenCount} Women`,
      pillText: 'Active',
      pillBg: [152, 246, 79] as [number, number, number],
      pillFg: [17, 19, 18] as [number, number, number],
    },
    {
      label: 'COMPLETED ROUNDS',
      value: `${completedRoundsCount} / ${rounds.length}`,
      sub: `${totalCompletedMatches} recorded games`,
      pillText: `${completionPct}% Done`,
      pillBg: [240, 100, 73] as [number, number, number],
      pillFg: [255, 255, 255] as [number, number, number],
    },
    {
      label: 'TOTAL POINTS SCORED',
      value: `${totalPointsScored}`,
      sub:
        totalCompletedMatches > 0
          ? `Avg ${(totalPointsScored / totalCompletedMatches).toFixed(1)} pts/match`
          : 'Awaiting scores',
      pillText: 'PTS',
      pillBg: [247, 211, 72] as [number, number, number],
      pillFg: [17, 19, 18] as [number, number, number],
    },
    {
      label: 'DIVISION FORMAT',
      value: '2-Phase',
      sub: 'Gender & Mixed Doubles',
      pillText: 'Balanced',
      pillBg: [215, 247, 184] as [number, number, number],
      pillFg: [30, 94, 8] as [number, number, number],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (kpiW + kpiGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(230, 234, 228);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, kpiY, kpiW, kpiH, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3.5, kpiY + 5);

    // Pill badge
    const pillW = 13.5;
    doc.setFillColor(kpi.pillBg[0], kpi.pillBg[1], kpi.pillBg[2]);
    doc.roundedRect(x + kpiW - pillW - 3, kpiY + 2.2, pillW, 4.2, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(kpi.pillFg[0], kpi.pillFg[1], kpi.pillFg[2]);
    doc.text(kpi.pillText, x + kpiW - pillW / 2 - 3, kpiY + 5, {
      align: 'center',
    });

    // Metric value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 19, 18);
    doc.text(kpi.value, x + 3.5, kpiY + 12.2);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, x + 3.5, kpiY + 16.5);
  });

  // 2. Crown Champions Showcase Box (y = 59, h = 27)
  const champY = 59;
  const champH = 27;
  doc.setFillColor(17, 19, 18);
  doc.setDrawColor(247, 211, 72); // Warm Gold Border #F7D348
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, champY, contentWidth, champH, 3, 3, 'FD');

  // Crown header bar
  doc.setFillColor(247, 211, 72);
  doc.roundedRect(margin + 4, champY + 2.5, 4.5, 4.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(17, 19, 18);
  doc.text('★', margin + 6.25, champY + 5.8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(247, 211, 72);
  doc.text('CROWN CHAMPIONS · HIGHEST SCORE PODIUM', margin + 10.5, champY + 5.8);

  const cCardGap = 3.5;
  const cCardW = (contentWidth - 8 - cCardGap * 2) / 3;
  const cCardY = champY + 8.5;
  const cCardH = 16;

  const champCards = [
    {
      badge: 'MEN CHAMPION',
      name: topMan ? topMan.player.name : '—',
      pts: topMan ? `${topMan.pointsFor} PTS` : '0 PTS',
      record: topMan
        ? `${topMan.wins}W - ${topMan.losses}L  |  Diff: ${
            topMan.pointDiff > 0 ? `+${topMan.pointDiff}` : topMan.pointDiff
          }`
        : '0W - 0L  |  Diff: 0',
      bg: [255, 250, 224] as [number, number, number],
      border: [247, 211, 72] as [number, number, number],
      badgeFg: [247, 211, 72] as [number, number, number],
      ptsBg: [152, 246, 79] as [number, number, number],
    },
    {
      badge: 'WOMEN CHAMPION',
      name: topWoman ? topWoman.player.name : '—',
      pts: topWoman ? `${topWoman.pointsFor} PTS` : '0 PTS',
      record: topWoman
        ? `${topWoman.wins}W - ${topWoman.losses}L  |  Diff: ${
            topWoman.pointDiff > 0
              ? `+${topWoman.pointDiff}`
              : topWoman.pointDiff
          }`
        : '0W - 0L  |  Diff: 0',
      bg: [255, 250, 224] as [number, number, number],
      border: [247, 211, 72] as [number, number, number],
      badgeFg: [247, 211, 72] as [number, number, number],
      ptsBg: [247, 211, 72] as [number, number, number],
    },
    {
      badge: 'MIXED DOUBLE CHAMPION',
      name: topMixed ? topMixed.pairName : '—',
      pts: topMixed ? `${topMixed.pointsFor} PTS` : '0 PTS',
      record: topMixed
        ? `${topMixed.wins}W - ${topMixed.losses}L  |  Diff: ${
            topMixed.pointDiff > 0
              ? `+${topMixed.pointDiff}`
              : topMixed.pointDiff
          }`
        : '0W - 0L  |  Diff: 0',
      bg: [238, 252, 224] as [number, number, number],
      border: [152, 246, 79] as [number, number, number],
      badgeFg: [152, 246, 79] as [number, number, number],
      ptsBg: [152, 246, 79] as [number, number, number],
    },
  ];

  champCards.forEach((cc, idx) => {
    const cx = margin + 4 + idx * (cCardW + cCardGap);
    doc.setFillColor(cc.bg[0], cc.bg[1], cc.bg[2]);
    doc.setDrawColor(cc.border[0], cc.border[1], cc.border[2]);
    doc.setLineWidth(0.45);
    doc.roundedRect(cx, cCardY, cCardW, cCardH, 2, 2, 'FD');

    // Badge
    doc.setFillColor(17, 19, 18);
    doc.roundedRect(cx + 2.5, cCardY + 2, 29, 3.8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.3);
    doc.setTextColor(cc.badgeFg[0], cc.badgeFg[1], cc.badgeFg[2]);
    doc.text(cc.badge, cx + 17, cCardY + 4.5, { align: 'center' });

    // PTS Pill
    doc.setFillColor(cc.ptsBg[0], cc.ptsBg[1], cc.ptsBg[2]);
    doc.roundedRect(cx + cCardW - 15.5, cCardY + 1.8, 13, 4.2, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(17, 19, 18);
    doc.text(cc.pts, cx + cCardW - 9, cCardY + 4.5, { align: 'center' });

    // Champion Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(17, 19, 18);
    const maxNameChars = 24;
    const displayName =
      cc.name.length > maxNameChars
        ? `${cc.name.slice(0, maxNameChars - 1)}…`
        : cc.name;
    doc.text(displayName, cx + 2.5, cCardY + 10.2);

    // Record & Diff
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(71, 85, 105);
    doc.text(cc.record, cx + 2.5, cCardY + 14.2);
  });

  // 3. Player Roster Standings Dashboard Table
  let currentY = 89.5;

  const drawTableSectionHeader = (yPos: number, isCont = false) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(230, 234, 228);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, yPos, contentWidth, 9.5, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(17, 19, 18);
    doc.text(
      isCont
        ? 'PLAYER ROSTER STANDINGS (CONTINUED)'
        : 'PLAYER ROSTER STANDINGS · COMPLETED ROUNDS SUMMARY',
      margin + 4,
      yPos + 6.1
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Ranked by Wins → Point Differential → Points For',
      pageWidth - margin - 4,
      yPos + 6.1,
      { align: 'right' }
    );

    const headerRowY = yPos + 10.5;
    doc.setFillColor(17, 19, 18);
    doc.roundedRect(margin, headerRowY, contentWidth, 7, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);

    doc.text('RANK', margin + 3.5, headerRowY + 4.7);
    doc.text('PLAYER NAME', margin + 17, headerRowY + 4.7);
    doc.text('DIVISION', margin + 74, headerRowY + 4.7);
    doc.text('GAMES PLAYED', margin + 103, headerRowY + 4.7, {
      align: 'center',
    });
    doc.text('WINS (WIN %)', margin + 129, headerRowY + 4.7, {
      align: 'center',
    });
    doc.text('LOSSES', margin + 149, headerRowY + 4.7, { align: 'center' });
    doc.text('PTS (PF-PA)', margin + 166, headerRowY + 4.7, {
      align: 'center',
    });
    doc.text('POINT DIFF', pageWidth - margin - 3.5, headerRowY + 4.7, {
      align: 'right',
    });

    return headerRowY + 8;
  };

  currentY = drawTableSectionHeader(currentY, false);

  const rowHeight = 6.8;
  const bottomLimit = pageHeight - 16;

  sortedRows.forEach((row, index) => {
    if (currentY + rowHeight > bottomLimit) {
      doc.addPage();
      paintPageBackground();
      drawPageHeader(true);
      currentY = drawTableSectionHeader(29, true);
    }

    // Alternating card row background
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 246);
    }
    doc.setDrawColor(232, 236, 230);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, currentY, contentWidth, rowHeight - 0.5, 1.2, 1.2, 'FD');

    const textY = currentY + 4.3;

    // 1. Rank Badge
    const isTop3WithScore = row.rank <= 3 && row.pointsFor > 0;
    if (isTop3WithScore) {
      const rankBg =
        row.rank === 1
          ? [247, 211, 72]
          : row.rank === 2
          ? [216, 222, 214]
          : [242, 186, 136];
      doc.setFillColor(rankBg[0], rankBg[1], rankBg[2]);
      doc.roundedRect(margin + 2.5, currentY + 1.1, 9, 4.2, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(17, 19, 18);
      doc.text(`#${row.rank}`, margin + 7, textY, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`#${row.rank}`, margin + 4, textY);
    }

    // 2. Player Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(17, 19, 18);
    const cleanName =
      row.player.name.length > 26
        ? `${row.player.name.slice(0, 25)}…`
        : row.player.name;
    doc.text(cleanName, margin + 17, textY);

    if (!row.player.active) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(148, 163, 184);
      doc.text('(Inactive)', margin + 56, textY);
    }

    // 3. Division Pill
    const isMen = row.player.gender === 'M';
    if (isMen) {
      doc.setFillColor(17, 19, 18);
      doc.roundedRect(margin + 73, currentY + 1.1, 13.5, 4.2, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(255, 255, 255);
      doc.text('Men', margin + 79.75, textY - 0.1, { align: 'center' });
    } else {
      doc.setFillColor(252, 229, 146);
      doc.roundedRect(margin + 73, currentY + 1.1, 15.5, 4.2, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(92, 69, 0);
      doc.text('Women', margin + 80.75, textY - 0.1, { align: 'center' });
    }

    // 4. Total Games Played
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(17, 19, 18);
    doc.text(`${row.completedGames}`, margin + 103, textY, {
      align: 'center',
    });

    // 5. Wins (Win %)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(21, 128, 61);
    doc.text(`${row.wins}  (${row.winPct}%)`, margin + 129, textY, {
      align: 'center',
    });

    // 6. Losses
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${row.losses}`, margin + 149, textY, { align: 'center' });

    // 7. Points For - Points Against
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(`${row.pointsFor} - ${row.pointsAgainst}`, margin + 166, textY, {
      align: 'center',
    });

    // 8. Point Differential Pill
    const diffStr =
      row.pointDiff > 0 ? `+${row.pointDiff}` : `${row.pointDiff}`;
    const diffPillW = 13.5;
    const diffPillX = pageWidth - margin - diffPillW - 2.5;
    if (row.pointDiff > 0) {
      doc.setFillColor(220, 252, 231);
      doc.setTextColor(21, 128, 61);
    } else if (row.pointDiff < 0) {
      doc.setFillColor(254, 226, 226);
      doc.setTextColor(185, 28, 28);
    } else {
      doc.setFillColor(241, 245, 249);
      doc.setTextColor(71, 85, 105);
    }
    doc.roundedRect(diffPillX, currentY + 1.1, diffPillW, 4.2, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text(diffStr, diffPillX + diffPillW / 2, textY, { align: 'center' });

    currentY += rowHeight;
  });

  // 4. Optional Completed Rounds Match Results Breakdown if any completed matches exist
  if (completedRoundSummaries.length > 0) {
    currentY += 4;
    if (currentY + 28 > bottomLimit) {
      doc.addPage();
      paintPageBackground();
      drawPageHeader(true);
      currentY = 29;
    }

    doc.setFillColor(17, 19, 18);
    doc.roundedRect(margin, currentY, contentWidth, 7.5, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(152, 246, 79);
    doc.text(
      'COMPLETED ROUNDS MATCH SCORE LOG',
      margin + 4,
      currentY + 5
    );
    currentY += 9.5;

    for (const rSum of completedRoundSummaries) {
      const neededHeight = 6 + Math.ceil(rSum.matches.length / 2) * 7.5;
      if (currentY + neededHeight > bottomLimit) {
        doc.addPage();
        paintPageBackground();
        drawPageHeader(true);
        currentY = 29;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(17, 19, 18);
      doc.text(
        `Round ${rSum.roundNumber} · ${rSum.phaseLabel}`,
        margin + 2,
        currentY + 4
      );
      currentY += 5.5;

      const colGap = 3.5;
      const colW = (contentWidth - colGap) / 2;

      rSum.matches.forEach((m, mIdx) => {
        const colIdx = mIdx % 2;
        const mX = margin + colIdx * (colW + colGap);
        const mY = currentY;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(230, 234, 228);
        doc.setLineWidth(0.25);
        doc.roundedRect(mX, mY, colW, 6.5, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.3);
        doc.setTextColor(17, 19, 18);
        doc.text(`${m.courtName} (${m.modeLabel})`, mX + 2.5, mY + 4.3);

        const matchupText = `${m.teamANames}  ${m.scoreA} - ${m.scoreB}  ${m.teamBNames}`;
        const clippedMatchup =
          matchupText.length > 44
            ? `${matchupText.slice(0, 43)}…`
            : matchupText;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(51, 65, 85);
        doc.text(clippedMatchup, mX + colW - 2.5, mY + 4.3, {
          align: 'right',
        });

        if (colIdx === 1 || mIdx === rSum.matches.length - 1) {
          currentY += 7.3;
        }
      });

      currentY += 2;
    }
  }

  // Stamp footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 226, 218);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'PICKLE & SMASH DXB Open Play · Tournament Dashboard Report',
      margin,
      pageHeight - 6
    );
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  doc.save('pickle_and_smash_dxb_stats.pdf');
}
