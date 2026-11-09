# Fraggy

A green, Gen Z luxury fragrance-collector app built with React Native and Expo. The collection is a digital perfume cabinet: continuous illuminated shelves, upright bottles, and real photo cutouts.

## Test with Expo Go on your iPhone

Requires Node 22.13+ or supported newer LTS, Python 3.12+, and Expo Go with SDK 58 support.

1. Download/unzip the project on a Mac or PC and run `npm ci` in its folder.
2. In one terminal, run `npm run cutout`. First launch creates a local Python environment and installs the photo processor. Its first cutout downloads the 4.6 MB U2NetP model; later requests reuse it.
3. In a second terminal, run `npx expo start --lan`.
4. Keep both terminals running, connect your iPhone to the same Wi-Fi, and scan the Expo QR with the iPhone Camera. Open it in Expo Go.
5. Tap + or an empty shelf slot, take/choose a photo, let Fraggy remove its background automatically, review the actual transparent cutout, fill bottle details, and add it to your shelf.

The app derives the processor address from the Expo LAN computer. If needed, set `EXPO_PUBLIC_CUTOUT_URL=http://YOUR_COMPUTER_IP:8787` in `.env.local` and restart Expo. This is a public service address, not a secret. When using a Metro tunnel, the separate processor must also have a phone-reachable address; a tunnel to Expo alone does not expose it.

**Cloud limitation:** the app and processor run in this workspace and the iOS bundle compiles, but there is no external-phone tunnel. Signed Expo tunnels require login and the ngrok alternative timed out. No remote QR or physical iPhone test is claimed. Use the local computer setup above.

## Photo cutouts

The app sends a resized JPEG when you choose or take a photo, to the Fraggy processor on your computer. It runs local CPU segmentation using [rembg](https://github.com/danielgatis/rembg), returns a tightly cropped transparent PNG, and closes the uploaded temporary file. No third-party image API, paid key, or retained upload is involved. The app stores the resulting cutout in its session-local collection.

Use one upright bottle against a contrasting plain background, with the cap and base visible and no hands in frame. Clear glass, reflections, and busy backgrounds can affect cutout quality. Review the preview and retake if needed. Failed processing never silently adds an original photo as a successful cutout.

The processor is a local development companion; production hosting and persistent photo storage are separate work. Sample bottles remain clearly illustrated and sample collectors/trades are simulated.

## Shelf and trade flows

- Continuous green cabinet shelves with shared ledges, contact shadows and empty places to add bottles. Tap a bottle for details.
- Discover available bottles and propose a local or shipped exchange using a bottle from your shelf.
- Simulate the other collector accepting and receiving. Both must accept; ownership moves only after both confirm receipt. Repeated confirmations are idempotent.
- Report a problem to pause an exchange. Reset the collection from Profile.

No payments, real users, live chat, tracking, or durable persistence are connected. Restarting the app resets the demo collection and discards session-added cutouts.

## Checks

```sh
npm run typecheck
npm test
npx expo install --check
# Python checks, after installing pytest and httpx into the cutout environment:
python -m pytest server -q
```

Optional browser verification requires Playwright and Chromium. Start the web preview and processor, then run:

```sh
TEST_URL=http://localhost:8081 node scripts/browser-smoke.cjs
TEST_URL=http://localhost:8081 node scripts/accessibility-smoke.cjs
```

The browser smoke test performs a real photo upload → CPU inference → cutout preview → shelf placement, plus collection filters and swap completion/pause/reset. The accessibility regression exercises the receipt dialog at 3× browser text. Native camera permission, haptics, VoiceOver and Dynamic Type still require device verification.

## Design references

See [shelf research and redesign](docs/shelf-redesign.md), the [design spec](docs/superpowers/specs/2026-11-09-fraggy-design.md), and [verification report](docs/verification.md). The shelf correction supersedes the original card-grid and simulated-removal scope.
