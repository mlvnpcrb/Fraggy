# M00 validation

Scope: uploaded `Fraggy_GitHub_Vercel_M00_Scaffold.zip`, root Expo scaffold only. Earlier feature implementation was preserved outside the checkout and is not included in this milestone.

## Corrections

- Upgraded the uploaded SDK 54 pins together to SDK 57, matching the user's iPhone Expo Go. Used Expo's bundled native dependency map for React Native, React, router/runtime, Font, Constants, Linking, Reanimated, Worklets and Gesture Handler. Explicit Worklets/Reanimated pins prevent npm from selecting native peer versions unsupported by this SDK.
- Added missing Font/Router dependencies and generated a frozen npm lockfile. No backend/product dependencies were carried over from earlier work.
- Preserved native bundle identifiers and application structure. Kept explicit Metro static web export; Vercel uses clean URLs for the generated HTML files and does not rewrite all routes to a single SPA document.
- Replaced web-incompatible alert-only form feedback with inline demo feedback, and rejected blank/nonfinite remaining volumes. The Add form still does not save anything.
- Added Node 22 CI, frozen install, compatibility/type/build checks, native bundle exports and the web artifact. Excluded environment files, signing credentials, Vercel local state and generated files from Git/upload.

## Executed locally

The final dependency/build sequence ran with Node 22 via an isolated npm-provided Node binary, matching `.nvmrc` and Vercel's documented Node setting. Each underlying command completed successfully:

- `npm install` — generated `package-lock.json`.
- `npm ci` — clean install using the final lockfile.
- `npm run typecheck`.
- `EXPO_OFFLINE=1 npx expo install --check` — installed SDK compatibility map, not online metadata.
- `npm run build:web -- --max-workers 2` — generated `dist/index.html`, `discover.html`, `trades.html`, `profile.html` and `add.html` plus assets and router auxiliary pages.
- `npx expo export --platform android --platform ios --output-dir dist-native --max-workers 2` — both Android and iOS Hermes/JavaScript bundles generated.
- `npm run web -- --offline --port 8085` — development web server returned the rendered shelf.
- Chromium static-export smoke check — opened all four tab routes and direct `/add`, navigated to Add, verified validation and demo-only confirmation, with no uncaught JavaScript errors. Extensionless routes were served locally with static `.html` resolution matching the documented Vercel clean-URL setup.
- Git-ignore probes — environment/signing files, local Vercel state and generated outputs excluded; blank `.env.example` remains addable. Manifest dependencies match the lockfile.

`npx expo-doctor` passed 19/21 checks. The Expo config schema and React Native Directory metadata checks could not reach their external services. They are not counted as passing or replaced by offline dependency checks. Existing dependency deprecation warnings do not indicate a successful native binary/device test.

## Remote checks and limits

Local results do not establish remote GitHub Actions or Vercel success; inspect the PR checks and preview deployment after pushing. The repository has an existing Vercel GitHub integration. Preview deployment must use the feature branch while `main` stays unchanged. No automatic merge or production deployment was requested by this milestone.

No real iPhone/Android device, simulator, native binary or EAS validation was performed. No authentication/database/trading/billing/camera feature was added. M00 needs no application secrets. Expo's cloud tunnel timed out in earlier work; local same-network Expo Go usage remains the documented route for actual device testing.
