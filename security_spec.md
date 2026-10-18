# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched (`/sessions/{sessionId}`, `/admins/{adminId}`) are unconditionally denied.
2. **Authentication & Email Verification**: All reads and writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Every `{sessionId}` and `{adminId}` path parameter must match `^[a-zA-Z0-9_\-]+$` with `size() >= 1 && size() <= 128`.
4. **Strict Key & Schema Enforcement (`isValidSession`)**:
   - Required & allowed keys: `['title', 'visibility', 'courtCount', 'menCourtsPhase1', 'genderGamesTarget', 'mixedGamesTarget', 'activeRoundNumber', 'rosterMap', 'roundsMap', 'ownerId', 'createdAt', 'updatedAt']`.
   - `ownerId` must equal `request.auth.uid` on creation and remain immutable on update.
   - `createdAt` must equal `request.time` on creation and remain immutable on update.
   - `updatedAt` must equal `request.time` on creation and update.
   - `rosterMap` (`size() <= 150`) and `roundsMap` (`size() <= 50`) must be native maps.
5. **PII Isolation**: No user email, phone number, or address is stored in `/sessions/{sessionId}`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/sessions/live-dxb` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', token: { email: 'brysilva888@gmail.com', email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Owner Spoofing on Create**: `auth.uid = 'u1'`, payload `ownerId: 'u2'` -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection**: Payload includes `isAdmin: true` or `extraField: 'hack'` -> `PERMISSION_DENIED`.
5. **Immutable Owner Mutation on Update**: Updating `ownerId` from `'u1'` to `'u2'` -> `PERMISSION_DENIED`.
6. **Immutable `createdAt` Mutation on Update**: Changing `createdAt` during an update -> `PERMISSION_DENIED`.
7. **Forged Client `updatedAt` Timestamp**: Supplying a past or future timestamp instead of `request.time` -> `PERMISSION_DENIED`.
8. **Path ID Poisoning**: Creating `/sessions/invalid id with spaces!` -> `PERMISSION_DENIED`.
9. **Title String Overflow**: Setting `title` to a 500-character string (`maxLength: 120`) -> `PERMISSION_DENIED`.
10. **Invalid Enum Value**: Setting `visibility: 'public_world'` (not in `['shared', 'private']`) -> `PERMISSION_DENIED`.
11. **Out-of-Bounds Court Count**: Setting `courtCount: 999` (`max: 16`) or `0` -> `PERMISSION_DENIED`.
12. **Unauthorized Private Session Read**: User `'u2'` attempting `get` on `/sessions/priv-1` where `ownerId == 'u1'` and `visibility == 'private'` -> `PERMISSION_DENIED`.
