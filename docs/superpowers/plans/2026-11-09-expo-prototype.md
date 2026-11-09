# Fraggy Expo Prototype Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement task-by-task. Track steps below.

**Goal:** Deliver an iPhone-testable Expo Go prototype of Fraggy with the approved Gen Z luxury design.

**Architecture:** React Native screens share theme tokens and local collection/trade state. Pure domain transitions enforce mutual acceptance and receipt. System photo selection stays local; sample cutout processing is explicitly simulated.

**Tech Stack:** Expo, React Native, TypeScript, Expo Image Picker, Expo Font, Manrope, React Navigation, Vitest for pure domain logic. Select the stable SDK compatible with the current iOS Expo Go at implementation time; use expo install for native dependencies.

**Spec:** docs/superpowers/specs/2026-11-09-fraggy-design.md

## Global Constraints

- Racing green #103D2B, ivory #F6F3EB, lime #D5F66A, ink #18261F, muted ink #56645B.
- Bold sans-serif typography, no champagne accents or serif titles.
- Four tabs: My Shelf, Discover, Trades, Profile. Native safe areas; no phone frames.
- Buttons at least 48 units high; touch targets at least 44 units. Support larger text and reduced motion.
- No payments or real accounts. No photo uploads. Trade counterpart actions explicitly simulated.
- Ownership transfers only after both acceptance and both receipt confirmations.

## Review Focus

- Missing camera/library permission: retain entered details, explain access, allow retry or cancellation.
- Canceled photo selection: no empty bottle and no lost form state.
- One-sided confirmation or repeated taps: never transfer early or twice.
- Long fragrance names and larger text: wrap without blocking controls.
- Remote iPhone connectivity: distinguish a reachable Expo Go link from local-only Metro.

## File Structure

- App.tsx: providers and root navigation.
- src/theme.ts: palette, spacing, typography.
- src/components/{Screen,Button,Bottle,EmptyState}.tsx: reusable primitives.
- src/domain/{types,collection,trades}.ts: local data and immutable transitions.
- src/domain/{collection,trades}.test.ts: meaningful state and validation checks.
- src/data/demo.ts: resettable sample bottles and collectors, no real addresses.
- src/state/DemoProvider.tsx: shared state and reset.
- src/screens/{Shelf,AddBottle,Discover,BottleDetail,Trades,TradeDetail,Profile}Screen.tsx.
- assets/: licensed font assets and transparent illustrated sample bottles.
- README.md: run commands, supported Expo SDK, simulation limits, phone connection instructions.

### Task 1: Branded, navigable shell

**Produces:** theme; Screen, Button, Bottle, EmptyState components; four tabs and add/detail routes.

- [ ] Scaffold Expo TypeScript in the existing project without replacing docs or mockups. Load Manrope Regular, Medium, ExtraBold and bundled transparent sample bottle artwork.
- [ ] Implement theme values from the spec, safe-area screen containers and semantic button labels. Provide a loading state while fonts load.
- [ ] Build ShelfScreen with “Your scent rotation,” sample shelf rows, count, All bottles/Open to swap filter, lime Add action, and empty state. Implement ProfileScreen with clearly labeled demo status and reset.
- [ ] Verify tab navigation, filters, empty/reset states and long-name wrapping in a browser preview at 390px width and larger text. Run TypeScript check and Expo dependency validation.
- [ ] Commit independently reviewable branded shell.

### Task 2: Add a bottle locally

**Interfaces:** Bottle { id, ownerId, brand, name, sizeMl, remainingPercent, imageUri, imageKind: 'original'|'sample-cutout', tradeAvailable }; addBottle(input: BottleInput): Bottle returns a validated bottle or throws a user-readable validation error.

- [ ] Write collection tests: reject whitespace-only names, sizes <= 0, non-finite numeric inputs, remainingPercent outside 0–100; accept a valid original image without relabeling it a cutout. Run tests and observe failures before implementation.
- [ ] Implement collection validation and DemoProvider.addBottle(input). Keep sample IDs stable and generated local IDs unique.
- [ ] Implement AddBottleScreen: camera/library selection, review original image, editable bottle details, swap toggle, submit. Canceling selection preserves details. Permission denial displays retry/settings guidance. A separate labeled sample cutout demonstrates the intended future removal step.
- [ ] Verify tests pass. Manually exercise permission denial, selection cancel, invalid details and successful add; confirm added bottle appears on the shelf and is never falsely marked background removed.
- [ ] Commit photo/form flow.

### Task 3: Discover and propose a swap

**Interfaces:** Trade { id, offeredBottleId, requestedBottleId, method: 'local'|'shipping', acceptedBy: string[], receivedBy: string[], status: 'proposed'|'in-progress'|'paused'|'complete' }; proposeTrade(input, bottles): Trade.

- [ ] Write failing tests: reject offering someone else's bottle, self-trades, duplicate bottle IDs, and a reserved bottle; valid proposal starts with proposer acceptance only.
- [ ] Implement proposal validation and Discover/BottleDetail screens with “Find your next obsession,” method filters, approximate sample locations, and bottle picker. Only own available bottles can be offered.
- [ ] Verify proposal appears under Trades and an empty eligible collection explains how to add or enable a bottle. Verify long names remain readable. Run tests and TypeScript check.
- [ ] Commit discovery/proposal flow.

### Task 4: Mutual confirmation and ownership

**Interfaces:** acceptTrade(trade, actorId, bottles): result; confirmReceipt(trade, actorId, bottles): result; pauseTrade(trade): Trade. result contains updated trade and bottles. Participant IDs are derived from owners of the proposed bottles and retained for the trade lifetime.

- [ ] Write failing tests: receipt before mutual acceptance rejected; unrelated actor rejected; one receipt preserves ownership; both receipts transfer exactly once; duplicate confirmations idempotent; conflicting reservation rejected; paused exchange cannot complete. Reset restores original sample ownership.
- [ ] Implement immutable transitions and reservations in the local provider. Disable offer editing after acceptance in this prototype. Add a clearly labeled demo action to simulate the counterpart's acceptance and receipt.
- [ ] Build bold bottle-versus-bottle TradeDetail screen, separate acceptance and receipt steps, local/shipping examples, explicit confirmation dialog before receipt, report-problem pause, illustrative message/tracking panels. Success updates Shelf immediately.
- [ ] Run tests and manually exercise both confirmation orders, repeat taps, pause, reset, and cancellation of receipt dialog.
- [ ] Commit trade flow.

### Task 5: Polish and Expo Go handoff

- [ ] Add restrained 160–220 ms transitions, optional bottle placement spring and platform-supported haptics; honor reduced motion.
- [ ] Review accessibility labels, contrast, keyboard behavior, safe areas and large text across screens. Run TypeScript check, unit tests and Expo dependency validation once final edits are complete.
- [ ] Start Metro; attempt a supported Expo tunnel if the cloud host cannot be reached directly. Verify the issued URL and bundling; do not substitute a localhost address for a phone-accessible link.
- [ ] Document the exact Expo Go SDK requirement and connection method. If tunnel access is blocked, report the specific blocker and provide a runnable local checkout with exact start commands; do not claim physical iPhone verification.
- [ ] Perform a final independent review, fix material findings, and share the Expo link/QR when reachable with a concise explanation of simulated features.

## Self-review

The tasks cover all four tabs, photo review and permission states, sample discovery, two-party trade acceptance/receipt, demo reset, typography, motion and phone handoff. Background removal and connected users remain outside the prototype. External phone connectivity must be verified during execution.
