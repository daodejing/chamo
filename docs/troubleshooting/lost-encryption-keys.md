# Lost Encryption Keys Troubleshooting

Per-user end-to-end encryption means the server never stores or replays your private key. If the browser loses that key (new device, cache cleared, incognito session expired), Chamo cannot decrypt historical content until you provision a fresh key.

## When the warning appears

- Authenticated session succeeds but `hasPrivateKey(user.id)` returns `false`.
- The Lost Key modal (`lostKey.*` translations) appears on first load within the last 24 hours.
- Browser devtools show empty IndexedDB database `chamo_encryption › userKeys`.

## Immediate actions

1. **Stay calm** – current chat access still works; only historical decrypts are affected.
2. **Acknowledge the modal** – click _Continue_ to proceed with limited functionality while you recover.
3. **Check other devices** – if another logged-in browser still has the key, keep it open. Future recovery tooling will rely on that device exporting the key.

## Recovering access

| Scenario | Recommended path |
| --- | --- |
| **Same device, same session** | Refresh the page; if you recently registered or verified email, `maybeHydratePendingFamilyKey` will restore the key from `pending_family_key`/`pending_family_invite` in `localStorage`. |
| **Same device, storage cleared** | Ask a family admin to resend an invite that embeds the family key (Story 1.5 dependency). Use _Join Existing Family_ → paste the invite code with key → the client rehydrates IndexedDB. |
| **New device** | Complete email verification or login, then coordinate with an admin to reissue an invite envelope. Until then, expect read-only access to newly sent messages only. |

## Preventing future loss

- Avoid clearing browser storage for the domain unless you have another trusted device with the key.
- Log out only when necessary; logout intentionally keeps IndexedDB intact for privacy.
- Track which browser/profile you used during registration; that instance holds the canonical private key until export tooling ships.

## Developer references

- Modal source: `src/components/auth/lost-key-modal.tsx`
- Detection logic: `src/lib/contexts/auth-context.tsx` (`hasPrivateKey`, `markLostKeyModalShown`)
- Pending family key hydration: `getPendingFamilySecrets`, `maybeHydratePendingFamilyKey`

Document owner: Story 1.9 implementation team. Update this file when new recovery tooling or UX flows ship.
