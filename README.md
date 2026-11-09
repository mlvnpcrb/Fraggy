# Fraggy

A React Native / Expo Go prototype for fragrance collectors. Racing green, ivory, and lime; bold Manrope typography; illustrated bottles and a local trading simulation.

## Test on an iPhone with Expo Go

Requires Node.js 22.13+ (or a newer supported LTS), npm, and the current **Expo Go with SDK 58 support** from the App Store. Expo SDK 58 / React Native 0.88.1 / React 19.3.0 are pinned in the lockfile. If your installed Expo Go reports an incompatible SDK, update it; do not independently upgrade React Native packages.

1. Download/unzip the source project on your computer and open a terminal in its folder.
2. Run `npm ci`.
3. Run `npx expo start --lan`.
4. Connect the computer and iPhone to the same Wi-Fi.
5. Scan the terminal QR with the iPhone Camera and choose **Open in Expo Go**.

If the devices cannot reach each other over Wi-Fi, use `npx expo login` followed by `npx expo start --tunnel`. Alternatively, `npx expo start --tunnel ngrok` selects Expo's ngrok adapter (included as a dev dependency). The computer and development server must stay running.

**Cloud handoff limitation:** This workspace successfully compiled the SDK 58 iOS manifest and bundle, but did not obtain a phone-accessible tunnel. The signed tunnel requires Expo login, and the ngrok alternative timed out. No QR from this cloud workspace is currently usable on an external iPhone. Localhost links are only for workspace/browser testing. Physical-device testing is still needed.

## Try these flows

- **My Shelf:** filter all bottles/open to swap, inspect bottles, then tap +.
- **Add a Bottle:** choose a photo or use the camera; enter details and add it. Original photos stay local and are **not** presented as background-removed. “Try a sample cutout” loads an explicitly illustrated demonstration.
- **Discover:** choose Mojave Ghost, select Shipping, offer Santal 33, and propose the swap.
- **Trade:** simulate Alex accepting, confirm your receipt, then simulate Alex receiving. Ownership transfers only when both receipts exist; check your shelf afterward.
- **Local meetup:** open the existing Jazz Club ↔ Hwyl trade and simulate Sam accepting. Report a problem to pause it and keep bottles reserved.
- **Profile:** reset the demo to restore the original collection.

## Scope

This is a session-local prototype. It has no real accounts, background-removal service, backend, chat, shipment tracking, payments, or live trades. Reloading/restarting resets the sample state; added photos are not persisted across sessions. All bottles are original illustrations, not product photography. Camera/library permissions and haptics need an iPhone check. Expo Go uses its own native permission descriptions; app-specific permission copy applies in a custom development/standalone build.

## Developer checks

```sh
npm run typecheck
npm test
npx expo install --check
npm run web
```

The online Expo dependency check was blocked by cloud network policy. The offline check against the SDK-bundled dependency map passes, but does not establish the latest remote Expo Go availability.

An optional browser smoke test uses Playwright and a Chromium installation:

```sh
npm install --no-save playwright
# Start the web server separately, then:
TEST_URL=http://localhost:8081 CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-smoke.cjs
```

The smoke test covers filters, sample and original-photo adds, form validation, long names, shipping exchange, canceled receipt confirmation, one-sided receipt, ownership completion, local meetup, pause and reset. Domain tests exercise authorization, reservations and idempotency. Tests do not imply native physical-device verification.

## Project map

- `src/theme.ts`: visual tokens.
- `src/components`: native UI primitives, bottle artwork, reduced-motion handling.
- `src/screens`: shelf, capture, discovery, trade and profile flows.
- `src/domain`: validated immutable collection/trade transitions and tests.
- `src/state/DemoProvider.tsx`: session-local demo state.
- `docs/superpowers`: approved design and implementation plan.

No keys, secrets, or external services are needed to run this prototype.
