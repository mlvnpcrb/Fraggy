# Fraggy — Milestone 00

Native-first Android/iOS fragrance app scaffold using Expo SDK 57, React Native 0.86, Expo Router and strict TypeScript. The same routes export a static web preview for Vercel.

**Demo only:** the four tabs and Add Perfume form use sample data. The form validates input but does not save it. No authentication, database, photo uploads, live catalog, trading or billing is implemented in M00. SDK 57 matches the user's iPhone Expo Go; the uploaded scaffold's SDK 54 pins were updated together using Expo's compatibility map.

## Local development

Use Node **22.13 or newer** (Node 22 is selected by `.nvmrc`) and npm. From the repository root:

```sh
npm install
npm run typecheck
npm run web
```

`package-lock.json` is committed. Use `npm ci` for a clean, repeatable install; use `npm install` when intentionally changing dependencies and commit the resulting lockfile.

For an iPhone/Android device with SDK 57-compatible Expo Go:

```sh
npm start -- --go
```

Keep the computer and phone on the same network and scan the Expo QR code. `npm run ios`/`npm run android` need the corresponding local simulator/emulator. Device execution and native app binaries are separate from JavaScript bundle checks; neither is claimed by a successful web build.

## Production web export

```sh
npm run build:web
```

`app.json` explicitly selects Metro with `web.output: static`. `dist/` contains pre-rendered HTML for `/`, `/discover`, `/trades`, `/profile` and `/add`, plus JavaScript and assets. Generated output stays out of Git. Do not open the HTML directly with `file://`; serve it with an HTTP server that supports extensionless HTML routes.

For native JavaScript export checks (not native binary builds):

```sh
npx expo export --platform android --platform ios --output-dir dist-native --max-workers 2
```

## GitHub and pull request

The feature branch is `feature/m00-vercel-scaffold`, targeting the existing `main` branch of `mlvnpcrb/Fraggy`. Open/review the PR and inspect its **Scaffold checks** workflow. Do not merge until approved. The workflow runs a frozen install, TypeScript, the SDK's bundled dependency compatibility check, static web build and both native JavaScript exports. It uploads `dist/` as a downloadable Actions artifact.

Local results and any remote-access blockers are recorded in [docs/M00_VALIDATION.md](docs/M00_VALIDATION.md). Local success does not establish that hosted GitHub Actions or a Vercel deployment has passed.

## Vercel preview

1. In Vercel, choose **Add New → Project** and import **mlvnpcrb/Fraggy**. Authorize Vercel's GitHub integration for that repository if needed.
2. Keep **Root Directory** at the repository root (`.`), **Framework Preset** at **Other**, and Node.js at **22.x**. `vercel.json` specifies install `npm ci`, build `npm run build:web`, output `dist`, and clean URLs.
3. Keep the production branch as `main`. Create a **preview** deployment from `feature/m00-vercel-scaffold`, or use the PR's preview deployment after the Git integration is connected. Deploy the feature branch as a preview while `main` remains unmerged. A repository imported before the scaffold exists on the selected branch will contain only the old README.
4. Check the returned Vercel preview URL: open the four tabs, reload `/profile` and `/add` directly, and check the demo form. Do not add a catch-all SPA rewrite: this app emits actual static pages.
5. After review and explicit merge approval, merging the PR can trigger the production deployment from `main`.

Alternatively, from an authenticated local checkout run `npx vercel` for a preview. **Do not use `--prod` for M00 review.** Vercel CLI uploads must honor `.vercelignore`; never upload local credentials. Vercel hosts the web preview; native store builds use a separate native build workflow later.

No environment variables or secrets are needed to build or run M00. Vercel connection/account access is required to deploy; GitHub integration is not created by checking in `vercel.json`.

## Configuration and security

`.gitignore` excludes `.env`, `.env.*` (except the blank `.env.example`), Vercel local state, credentials, dependency folders and generated build output. `.vercelignore` also excludes local environment files and credentials from CLI uploads. Do not commit actual values or manually force-add ignored files. Expo `EXPO_PUBLIC_*` values are bundled into clients and must never contain service-role keys or other secrets. The example variables are unused placeholders for a future milestone.

## Cloud machine notes

The onboarding machine has a read-only home directory. Set writable CLI/cache paths when using this machine:

```sh
export npm_config_cache=/workspace/.npm-cache
export __UNSAFE_EXPO_HOME_DIRECTORY=/workspace/.expo-user
export XDG_CACHE_HOME=/workspace/.cache
export EXPO_NO_TELEMETRY=1
```

Use `npm run web -- --offline` when Expo metadata endpoints are unavailable. `EXPO_OFFLINE=1 npx expo install --check` uses the installed SDK's compatibility map; it does not replace online Expo Doctor checks. No TLS or checksum verification is disabled. Each task already has an isolated checkout: do not create a Git worktree unless explicitly requested.

## Scope

Stop at M00. Read [docs/CODEX_M00.md](docs/CODEX_M00.md), [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/PRODUCT_DECISIONS.md](docs/PRODUCT_DECISIONS.md) before subsequent work. The Figma link in those references is a future design reference; this scaffold does not claim a completed design implementation.
