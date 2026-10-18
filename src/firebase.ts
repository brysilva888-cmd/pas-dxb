import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Player, Round } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export const DEFAULT_SESSION_ID = 'dxb-open-play-live';

export interface CloudSessionState {
  title: string;
  visibility: 'shared' | 'private';
  courtCount: number;
  menCourtsPhase1: number;
  genderGamesTarget: number;
  mixedGamesTarget: number;
  activeRoundNumber: number;
  players: Player[];
  rounds: Round[];
  ownerId: string;
  updatedAt?: Date | null;
}

function clampInt(val: number, min: number, max: number): number {
  const n = Math.round(Number(val) || min);
  return Math.max(min, Math.min(max, n));
}

export function serializeRosterToMap(
  players: Player[]
): Record<string, Record<string, unknown>> {
  const map: Record<string, Record<string, unknown>> = {};
  const boundedPlayers = players.slice(0, 150);
  boundedPlayers.forEach((p, index) => {
    const safeId = String(p.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    map[safeId] = {
      id: p.id,
      name: String(p.name || 'Player').slice(0, 80),
      gender: p.gender === 'F' ? 'F' : 'M',
      active: Boolean(p.active),
      orderIndex: index,
    };
  });
  return map;
}

export function deserializeMapToRoster(
  rosterMap: Record<string, any> | undefined | null
): Player[] {
  if (!rosterMap || typeof rosterMap !== 'object') return [];
  return Object.values(rosterMap)
    .filter((item) => item && typeof item === 'object' && item.id)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((item) => ({
      id: String(item.id),
      name: String(item.name || 'Player'),
      gender: item.gender === 'F' ? 'F' : 'M',
      active: Boolean(item.active),
    }));
}

export function serializeRoundsToMap(
  rounds: Round[]
): Record<string, Record<string, unknown>> {
  const map: Record<string, Record<string, unknown>> = {};
  const boundedRounds = rounds.slice(0, 50);
  for (const r of boundedRounds) {
    const rKey = `r_${clampInt(r.roundNumber, 1, 50)}`;
    map[rKey] = {
      roundNumber: clampInt(r.roundNumber, 1, 50),
      phase: r.phase === 'MIXED_DOUBLES' ? 'MIXED_DOUBLES' : 'GENDER_SPLIT',
      benchPlayerIds: (r.benchPlayerIds || []).slice(0, 150),
      matches: (r.matches || []).map((m) => ({
        id: String(m.id),
        roundNumber: clampInt(m.roundNumber, 1, 50),
        courtId: Number(m.courtId) || 1,
        courtName: String(m.courtName || `Court ${m.courtId}`),
        mode: m.mode,
        teamA: [String(m.teamA[0]), String(m.teamA[1])],
        teamB: [String(m.teamB[0]), String(m.teamB[1])],
        noveltyScore: Number(m.noveltyScore) || 100,
        scoreA: typeof m.scoreA === 'number' ? m.scoreA : null,
        scoreB: typeof m.scoreB === 'number' ? m.scoreB : null,
        completed: Boolean(m.completed),
      })),
      archivedMatches: (r.archivedMatches || []).map((m) => ({
        id: String(m.id),
        roundNumber: clampInt(m.roundNumber, 1, 50),
        courtId: Number(m.courtId) || 1,
        courtName: String(m.courtName || `Court ${m.courtId}`),
        mode: m.mode,
        teamA: [String(m.teamA[0]), String(m.teamA[1])],
        teamB: [String(m.teamB[0]), String(m.teamB[1])],
        noveltyScore: Number(m.noveltyScore) || 100,
        scoreA: typeof m.scoreA === 'number' ? m.scoreA : null,
        scoreB: typeof m.scoreB === 'number' ? m.scoreB : null,
        completed: Boolean(m.completed),
      })),
    };
  }
  return map;
}

export function deserializeMapToRounds(
  roundsMap: Record<string, any> | undefined | null
): Round[] {
  if (!roundsMap || typeof roundsMap !== 'object') return [];
  return Object.values(roundsMap)
    .filter((r) => r && typeof r === 'object' && typeof r.roundNumber === 'number')
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((r) => ({
      roundNumber: Number(r.roundNumber),
      phase: r.phase === 'MIXED_DOUBLES' ? 'MIXED_DOUBLES' : 'GENDER_SPLIT',
      benchPlayerIds: Array.isArray(r.benchPlayerIds) ? r.benchPlayerIds : [],
      matches: Array.isArray(r.matches)
        ? r.matches.map((m: any) => ({
            id: String(m.id),
            roundNumber: Number(m.roundNumber),
            courtId: Number(m.courtId),
            courtName: String(m.courtName),
            mode: m.mode,
            teamA: [String(m.teamA?.[0] || ''), String(m.teamA?.[1] || '')] as [
              string,
              string,
            ],
            teamB: [String(m.teamB?.[0] || ''), String(m.teamB?.[1] || '')] as [
              string,
              string,
            ],
            noveltyScore: Number(m.noveltyScore ?? 100),
            scoreA: typeof m.scoreA === 'number' ? m.scoreA : null,
            scoreB: typeof m.scoreB === 'number' ? m.scoreB : null,
            completed: Boolean(m.completed),
          }))
        : [],
      archivedMatches: Array.isArray(r.archivedMatches)
        ? r.archivedMatches.map((m: any) => ({
            id: String(m.id),
            roundNumber: Number(m.roundNumber),
            courtId: Number(m.courtId),
            courtName: String(m.courtName),
            mode: m.mode,
            teamA: [String(m.teamA?.[0] || ''), String(m.teamA?.[1] || '')] as [
              string,
              string,
            ],
            teamB: [String(m.teamB?.[0] || ''), String(m.teamB?.[1] || '')] as [
              string,
              string,
            ],
            noveltyScore: Number(m.noveltyScore ?? 100),
            scoreA: typeof m.scoreA === 'number' ? m.scoreA : null,
            scoreB: typeof m.scoreB === 'number' ? m.scoreB : null,
            completed: Boolean(m.completed),
          }))
        : [],
    }));
}

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };

export async function saveCloudSession(
  sessionId: string,
  state: {
    title?: string;
    visibility?: 'shared' | 'private';
    courtCount: number;
    menCourtsPhase1: number;
    genderGamesTarget: number;
    mixedGamesTarget: number;
    activeRoundNumber: number;
    players: Player[];
    rounds: Round[];
  }
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const cleanSessionId =
    sessionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) ||
    DEFAULT_SESSION_ID;
  const path = `sessions/${cleanSessionId}`;
  const docRef = doc(db, 'sessions', cleanSessionId);

  const rosterMap = serializeRosterToMap(state.players);
  const roundsMap = serializeRoundsToMap(state.rounds);
  const safeCourtCount = clampInt(state.courtCount, 1, 16);
  const safeMenCourts = clampInt(state.menCourtsPhase1, 0, 16);
  const safeGenderTarget = clampInt(state.genderGamesTarget, 1, 20);
  const safeMixedTarget = clampInt(state.mixedGamesTarget, 0, 20);
  const safeActiveRound = clampInt(state.activeRoundNumber, 1, 50);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (!existingSnap.exists()) {
    try {
      await setDoc(docRef, {
        title: String(state.title || 'PICKLE & SMASH DXB Open Play').slice(
          0,
          120
        ),
        visibility: state.visibility === 'private' ? 'private' : 'shared',
        courtCount: safeCourtCount,
        menCourtsPhase1: safeMenCourts,
        genderGamesTarget: safeGenderTarget,
        mixedGamesTarget: safeMixedTarget,
        activeRoundNumber: safeActiveRound,
        rosterMap,
        roundsMap,
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(docRef, {
        courtCount: safeCourtCount,
        menCourtsPhase1: safeMenCourts,
        genderGamesTarget: safeGenderTarget,
        mixedGamesTarget: safeMixedTarget,
        activeRoundNumber: safeActiveRound,
        rosterMap,
        roundsMap,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

export function subscribeToCloudSession(
  sessionId: string,
  onData: (data: CloudSessionState | null) => void,
  onError?: (err: unknown) => void
): () => void {
  const cleanSessionId =
    sessionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) ||
    DEFAULT_SESSION_ID;
  const path = `sessions/${cleanSessionId}`;
  const docRef = doc(db, 'sessions', cleanSessionId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const raw = snapshot.data();
      const players = deserializeMapToRoster(raw.rosterMap);
      const rounds = deserializeMapToRounds(raw.roundsMap);
      const updatedAt =
        raw.updatedAt instanceof Timestamp ? raw.updatedAt.toDate() : null;

      onData({
        title: String(raw.title || 'PICKLE & SMASH DXB Open Play'),
        visibility: raw.visibility === 'private' ? 'private' : 'shared',
        courtCount: Number(raw.courtCount) || 4,
        menCourtsPhase1: Number(raw.menCourtsPhase1 ?? 2),
        genderGamesTarget: Number(raw.genderGamesTarget) || 4,
        mixedGamesTarget: Number(raw.mixedGamesTarget ?? 1),
        activeRoundNumber: Number(raw.activeRoundNumber) || 1,
        players,
        rounds,
        ownerId: String(raw.ownerId || ''),
        updatedAt,
      });
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}
