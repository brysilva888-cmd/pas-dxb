/**
 * Firestore Security Rules Specification Tests (Dirty Dozen Verification)
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'get' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const dirtyDozenTestCases: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated create on /sessions/live-dxb',
    operation: 'create',
    path: '/sessions/live-dxb',
    auth: null,
    payload: { title: 'DXB Open Play' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email spoof attempt',
    operation: 'create',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'brysilva888@gmail.com', email_verified: false },
    payload: { title: 'DXB Open Play' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity spoofing ownerId on create',
    operation: 'create',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { ownerId: 'user_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow ghost field injection on update',
    operation: 'update',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { ghostField: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Mutating immutable ownerId on update',
    operation: 'update',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { ownerId: 'hacker_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Mutating immutable createdAt on update',
    operation: 'update',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Forged client updatedAt timestamp',
    operation: 'update',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { updatedAt: '2099-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid document ID characters',
    operation: 'create',
    path: '/sessions/invalid id$!',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { title: 'Bad ID' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Title string length overflow (> 120 chars)',
    operation: 'create',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { title: 'A'.repeat(200) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid visibility enum value',
    operation: 'create',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { visibility: 'world_writable' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Out-of-bounds courtCount integer',
    operation: 'update',
    path: '/sessions/live-dxb',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { courtCount: 99 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Non-owner reading private session',
    operation: 'get',
    path: '/sessions/private-session-1',
    auth: { uid: 'user_2', email: 'user2@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
