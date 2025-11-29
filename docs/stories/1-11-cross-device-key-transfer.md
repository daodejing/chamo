# Story 1.11: Cross-Device Key Transfer via QR Code

Status: ready-for-dev

## Story

As a **Chamo user**,
I want **to transfer my encryption keys to another device or browser using a QR code**,
so that **I can access my encrypted messages and photos from multiple devices without losing my decryption capability**.

## Context

Story 1.9 established per-user keypairs stored in browser IndexedDB. By design, keys are device-bound and never leave the client. This creates a gap: users switching devices or browsers lose access to their encryption keys and cannot decrypt historical content.

**Design Decision:** QR-code based device-to-device transfer
- **Server-blind:** Private key never touches the server
- **Direct QR:** Key fits in QR code (~64 bytes for NaCl keypair)
- **PIN protection:** One-time PIN displayed on source device encrypts the key in QR
- **Offline-capable:** No network required for transfer

**Alternative Approaches Considered:**
1. ~~Server-relayed encrypted blob~~ - Adds complexity, requires server changes
2. ~~12-word mnemonic recovery~~ - Better UX for backup, but requires user to write down words
3. ~~Passphrase-encrypted backup~~ - User must remember passphrase; poor UX for non-tech users

**Why QR + PIN:**
- Familiar pattern (Signal, WhatsApp device linking)
- Works offline (same room transfer)
- Time-limited (PIN expires after 5 minutes)
- Visual confirmation (user scans from trusted device)

## Acceptance Criteria

- **AC1: Export Key Flow Initiation** - In Settings > Security, user can tap "Transfer Keys to Another Device" button. Flow only available when user has a private key in IndexedDB (`hasPrivateKey(userId) === true`).

- **AC2: QR Code Generation** - Source device generates QR code containing:
  - User's private key (32 bytes) encrypted with one-time PIN
  - User's public key (32 bytes) for verification
  - Encryption: AES-256-GCM with PIN-derived key (PBKDF2, 100k iterations)
  - QR displays alongside 6-digit PIN shown on screen

- **AC3: PIN Security** - PIN is:
  - 6 random digits generated client-side
  - Displayed only on source device screen (never transmitted)
  - Valid for 5 minutes (countdown timer shown)
  - Single-use (invalidated after successful transfer or timeout)

- **AC4: QR Scan & Import Flow** - Target device (logged in, missing key detected via Lost Key modal or manual trigger):
  - Option: "I have another device with my keys"
  - Opens camera to scan QR code
  - Prompts for 6-digit PIN
  - Decrypts and stores private key in IndexedDB

- **AC5: Verification & Confirmation** - After import:
  - Derive public key from imported private key
  - Compare with public key in QR payload
  - Compare with public key on server (GraphQL query)
  - If all match: Store key, show success
  - If mismatch: Show error, do not store, explain possible causes

- **AC6: Security Constraints** -
  - QR code auto-expires after 5 minutes (regenerate required)
  - Failed PIN attempts (max 3) invalidate current QR session
  - No network calls during QR display (fully offline capable)
  - QR contains encrypted data only (useless without PIN)

- **AC7: Error Handling** - Clear error messages for:
  - Camera permission denied
  - Invalid QR code (not a Chamo key transfer QR)
  - Wrong PIN (with attempt count: "Incorrect PIN. 2 attempts remaining")
  - Expired QR code
  - Key mismatch (tampering or wrong account)

- **AC8: Accessibility** -
  - Manual entry fallback for QR (base64 string copy/paste)
  - PIN announced to screen readers
  - Camera UI follows accessibility guidelines

## Tasks / Subtasks

### Task 1: Crypto Utilities for Key Transfer (AC: 2, 3, 5)

- [ ] Create `/src/lib/crypto/key-transfer.ts` module
- [ ] Implement `generateTransferPIN(): string` - 6 random digits
- [ ] Implement `deriveKeyFromPIN(pin: string, salt: Uint8Array): Promise<CryptoKey>`
  - PBKDF2 with 100k iterations
  - Salt: 16 random bytes (included in QR payload)
- [ ] Implement `encryptKeyForTransfer(privateKey: Uint8Array, publicKey: Uint8Array, pin: string): Promise<TransferPayload>`
  - Returns: `{ encryptedKey, iv, salt, publicKey, version }`
- [ ] Implement `decryptKeyFromTransfer(payload: TransferPayload, pin: string): Promise<Uint8Array>`
  - Decrypts private key using PIN
- [ ] Implement `verifyKeyPair(privateKey: Uint8Array, publicKey: Uint8Array): boolean`
  - Derive public from private, compare
- [ ] Unit tests: Round-trip encryption/decryption
- [ ] Unit tests: Wrong PIN returns error
- [ ] Unit tests: Payload format validation

### Task 2: QR Code Generation Component (AC: 1, 2, 3, 6)

- [ ] Install QR code library: `pnpm add qrcode.react`
- [ ] Create `/src/components/settings/KeyTransferExport.tsx`
- [ ] State management:
  - `pin: string | null`
  - `qrPayload: string | null`
  - `expiresAt: Date | null`
  - `isExpired: boolean`
- [ ] Generate flow:
  1. User taps "Transfer Keys"
  2. Generate PIN + encrypt key + create QR payload
  3. Display QR code + PIN + countdown timer
  4. Auto-invalidate after 5 minutes
- [ ] Regenerate button for new PIN/QR after expiry
- [ ] Security: Clear QR data from memory on unmount
- [ ] Unit tests: QR payload format
- [ ] Unit tests: Expiration logic

### Task 3: QR Code Scanner Component (AC: 4, 7, 8)

- [ ] Install QR scanner library: `pnpm add @yudiel/react-qr-scanner` or similar
- [ ] Create `/src/components/settings/KeyTransferImport.tsx`
- [ ] Camera permission request with fallback UI
- [ ] QR scan detection and validation:
  - Validate payload structure (version, required fields)
  - Show "Invalid QR code" for non-Chamo codes
- [ ] PIN entry dialog after valid scan
- [ ] PIN attempt tracking (max 3)
- [ ] Manual entry fallback (text input for base64 payload)
- [ ] E2E test: Scan → PIN → success flow
- [ ] E2E test: Wrong PIN → retry → lockout

### Task 4: Key Import & Verification Logic (AC: 5, 7)

- [ ] Implement `importTransferredKey(payload: TransferPayload, pin: string, userId: string): Promise<ImportResult>`
  - Decrypt private key
  - Verify key pair integrity
  - Fetch server public key via `getUserPublicKey(email)` query
  - Compare all three public keys
  - Store in IndexedDB if valid
- [ ] Return detailed error codes:
  - `INVALID_PIN`
  - `KEY_MISMATCH`
  - `STORAGE_FAILED`
  - `NETWORK_ERROR` (server verification)
- [ ] Integration test: Full import flow with mocked server

### Task 5: Settings UI Integration (AC: 1)

- [ ] Add "Security" section to Settings screen
- [ ] Add "Transfer Keys to Another Device" button
  - Disabled with tooltip if no private key exists
  - Opens `KeyTransferExport` modal/screen
- [ ] Add "Import Keys from Another Device" button
  - Visible when private key missing
  - Opens `KeyTransferImport` modal/screen
- [ ] Update Lost Key Modal (`LostKeyModal.tsx`):
  - Add "Transfer from another device" option alongside "Continue"
  - Link to `KeyTransferImport` flow

### Task 6: Translation Keys (AC: all)

- [ ] Add translation keys to `src/lib/translations.ts`:
  ```
  keyTransfer.exportTitle: "Transfer Keys to Another Device"
  keyTransfer.exportDescription: "Scan this QR code with your other device..."
  keyTransfer.pinLabel: "Enter this PIN on your other device"
  keyTransfer.expiresIn: "Expires in {minutes}:{seconds}"
  keyTransfer.expired: "QR code expired. Tap to generate a new one."
  keyTransfer.importTitle: "Import Keys from Another Device"
  keyTransfer.scanPrompt: "Scan the QR code displayed on your other device"
  keyTransfer.enterPin: "Enter the 6-digit PIN"
  keyTransfer.verifying: "Verifying keys..."
  keyTransfer.success: "Keys transferred successfully!"
  keyTransfer.error.invalidQR: "This doesn't look like a Chamo key transfer code"
  keyTransfer.error.wrongPin: "Incorrect PIN. {remaining} attempts remaining."
  keyTransfer.error.expired: "This QR code has expired. Generate a new one."
  keyTransfer.error.mismatch: "Key verification failed. Make sure you're logged into the same account on both devices."
  keyTransfer.error.camera: "Camera access is required to scan QR codes"
  keyTransfer.manualEntry: "Can't scan? Enter code manually"
  ```

### Task 7: E2E Tests (AC: all)

- [ ] E2E test: Export flow - verify QR contains valid encrypted payload
- [ ] E2E test: Import flow - scan QR, enter PIN, verify key stored
- [ ] E2E test: Wrong PIN lockout after 3 attempts
- [ ] E2E test: QR expiration after 5 minutes
- [ ] E2E test: Lost Key modal → Transfer option → success
- [ ] E2E test: Key mismatch scenario (different account)
- [ ] E2E test: Manual entry fallback

## Dev Notes

### Technical Implementation

- **Crypto:** Use Web Crypto API (`crypto.subtle`) for PBKDF2 and AES-256-GCM. TweetNaCl for keypair verification.
- **QR Size:** Payload ~200 bytes base64 ≈ 270 chars. Well within QR capacity (max ~4000 alphanumeric).
- **Offline:** No server calls during QR display/scan. Server verification is optional final step (graceful degradation if offline).

### Security Considerations

- PIN brute-force: 6 digits = 1M combinations. 100k PBKDF2 iterations makes offline attack expensive. 3-attempt lockout prevents online brute-force.
- QR screenshot risk: 5-minute expiry + PIN requirement mitigates. User should not share QR photo.
- Memory safety: Zero sensitive data in state after component unmount.

### Project Structure Notes

- New files follow existing patterns in `/src/lib/crypto/` and `/src/components/settings/`
- Camera permission handling follows existing patterns in photo upload
- Modal patterns from `LostKeyModal.tsx` and other auth modals

### References

- [Source: docs/stories/1-9-per-user-keypairs.md] - Keypair generation and storage implementation
- [Source: src/lib/crypto/keypair.ts] - Existing keypair utilities
- [Source: src/lib/crypto/secure-storage.ts] - IndexedDB secure storage
- [Source: docs/solution-architecture.md#1] - E2EE architecture overview
- [Source: docs/troubleshooting/lost-encryption-keys.md] - Current recovery guidance (to be updated)

### Dependencies

- **Requires:** Story 1.9 complete (per-user keypairs)
- **Blocks:** None (enhancement feature)
- **Related:** Update `docs/troubleshooting/lost-encryption-keys.md` after implementation

## Dev Agent Record

### Context Reference

- [docs/stories/1-11-cross-device-key-transfer.context.xml](1-11-cross-device-key-transfer.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List
