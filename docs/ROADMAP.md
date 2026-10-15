# Fraggy incremental roadmap

Work on only one milestone at a time. Each milestone gets a GitHub issue, `feature/...` branch, pull request, and Vercel preview. Merge to `main` only when acceptance criteria pass.

## M00 — Repository and preview (NOW)
- [ ] Push scaffold to `mlvnpcrb/Fraggy` on `feature/m00-vercel-scaffold` and open a PR against `main`
- [ ] Install dependencies and verify `npm run typecheck`
- [ ] Verify `npm run web`
- [ ] Verify `npm run build:web` creates `dist/`
- [ ] Connect GitHub repo to Vercel and verify the feature-branch preview (production waits for merge approval)
- [ ] Verify GitHub Actions passes

## M01 — Native design system and navigation
- [ ] Match Figma typography, palette, spacing and safe areas
- [ ] Implement reusable button, input, card and bottle components
- [ ] Implement Shelf, Explore, Trades and Profile navigation
- [ ] Responsive web preview and mobile screenshots

## M02 — Auth and profiles
- [ ] Supabase project and schema migration
- [ ] Email/password auth, session restoration, logout
- [ ] Profiles and row-level security tests

## M03 — My Shelf
- [ ] Create/edit/delete bottles with photos
- [ ] Full/partial/decant validation
- [ ] Free 7-entry limit enforced in database transaction
- [ ] Default shelf and premium-safe data retention

## M04 — Catalog and wishlist
- [ ] Catalog adapter and manual entry
- [ ] Search/filter and wishlists
- [ ] Confirm catalog data/image licensing

## M05 — Trading
- [ ] Listings, trade offers and counteroffers
- [ ] Distinct active requester counts
- [ ] Prevent conflicting accepted trades
- [ ] Dual confirmation and moderation

## M06 — Premium
- [ ] Monthly/annual product configuration
- [ ] RevenueCat verified entitlements
- [ ] Custom shelves and expiry handling

## M07 — Beta
- [ ] Device builds, notifications, accessibility
- [ ] App store privacy disclosures, security review
- [ ] TestFlight and Play internal testing
