# Expo prototype verification

## Implemented

- Four native tabs and bottle/detail/add/trade navigation.
- Approved green/ivory/lime design, bundled Manrope fonts, original SVG bottle illustrations, reduced-motion handling and optional haptics.
- Local photo selection/camera entry, editable bottle details and original-photo labeling. Sample cutouts are explicitly demonstrations.
- Discover filters, proposal validation, both-participant acceptance, bottle reservations and both-receipt ownership transfer. Local and shipped sample exchanges.
- Confirmation dialog, pause/problem state, illustrative chat/exchange details, and reset.

## Passing checks

- `npm run typecheck`.
- `npm test`: 19 domain cases across two files.
- Browser smoke: 390px initial check and 320px final full flow. Filters, original photo upload, canceled file selection with retained draft, sample add, invalid amounts, long names, shipping exchange, canceled receipt dialog, one-sided receipt, ownership transfer, local meetup, pause, reset. No page errors or horizontal overflow.
- Accessibility regression: 375×667 with 3× browser text scaling; both receipt buttons reachable by scrolling. Accepted trade retains acceptance after pause; proposed pause correctly says no reservation.
- `expo install --check` with offline SDK-bundled metadata: dependencies up to date. Online check blocked by proxy, so remote compatibility is not established.
- iOS development bundle: HTTP 200.
- Production iOS export: successful, 2.7 MB Hermes bundle plus bundled font/navigation assets.

## Independent review

A fresh reviewer independently reran typecheck and the domain suite. Their material finding was inaccessible receipt controls at large text sizes. A regression reproduced it with Confirm below the viewport at y=658–862; the dialog now has constrained height and scrollable contents, and the regression passes. The paused-state acceptance display and reduced-motion modal behavior were also corrected in the same pass. No findings were deferred.

## Implementation decisions

- Used the existing `work` branch in the shared workspace, preserving prior design files.
- Used npm's SDK 58 template and its native dependency map. The cloud npm/Expo caches were redirected to writable temporary folders.
- Integrated dependent screens and domain code into one feature commit to avoid broken navigation imports in intermediate commits. Tests were run failing before the domain implementation, then passed.
- Used bundled procedural SVG illustrations for sample bottles; real photo upload keeps its original background.
- Used the documented local launch fallback after both cloud tunnel methods failed. Signed Expo tunnel needs login; ngrok timed out. The prototype does not claim an externally reachable QR.

## Still needs device verification

Physical iPhone execution, native Camera/Photos permission prompts and denial behavior, actual Dynamic Type, VoiceOver, keyboard/safe-area behavior and haptics. Browser tests and successful native compilation do not establish these.

To test on a phone, follow README.md on a Mac/PC with Expo Go SDK 58 support and a reachable LAN or authenticated tunnel. Backend users, actual cutout processing, persistence and live trading remain outside this prototype.
