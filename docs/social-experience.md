# Fraggy public collector experience

Approved direction, 13 November 2026: a social app for fragrance collectors, with bottles and continuous cabinet shelves at the center. Public profiles and posts replace the earlier assumption of an exclusively private community. Existing collections, originals, chat, contact details and exchange addresses stay private. Sharing is explicit, never retroactive.

The home feed should show a collector, their shared bottle or shelf, a short caption, and compact like/comment actions. Following and latest are separate views. Keep management and filters in sheets. Avoid competing full-width buttons above the first shelf. Use racing green, ivory, Manrope and restrained lime; shelves provide visual depth rather than extra cards.

Public sharing publishes only a chosen cutout, brand and fragrance name, with the collector's public handle/name/bio. It excludes original photographs, condition images, private notes, city, trade snapshots and contact information. A collector explicitly enables their public page before posting. A post is a snapshot: subsequent ownership changes cannot expose a new owner's replacement photo. Remove-post and hide-public-page actions revoke future access, but previously downloaded public content cannot be recalled. Logged-in blocks hide interactions; signing out can still reveal public posts.

Members can post up to six selected bottles as a shelf, follow public collectors, like posts and comment. Public visitors can browse; joining and trading remain invitation-based. Changes must retain server authorization, moderation and the two-receipt trade rule. No algorithmic ranking, stories, payments or automatic image recognition are implied.

Scento lookup remains optional and separate from background removal: search, inspect the profile and apply notes. Demo mode must clearly identify fixtures and never imply it called Scento. The user's latest clarification identifies clutter as the immediate problem; a previous successful upstream test is not a live-app integration test.

Verification must cover anonymous feed/photo allowlists, private original denial, posting another owner's bottle, duplicate likes/follows, blocks, suspended accounts, hidden pages, removed posts and immutable media. Browser checks at 360, 390 and 430 pixels should show bottle content promptly and keep secondary actions in a sheet. Physical phone and authenticated hosted Scento checks remain required before claiming those paths work.

## Deployment and validation

The public social migration `20261113002555_public_collector_social.sql` was applied to the existing Supabase project on 13 November 2026. A hosted anonymous-role `social_read()` query returned the expected empty public feed. No existing collection was published. Local database checks exercise anonymous cutout storage reads and original denial, public projection, unauthorized posting, duplicate interactions, comments, blocks, privacy changes, suspension and immutable media. RPC-only tables deliberately deny direct table access. Security-advisor notices for RLS without client policies and signed-in SECURITY DEFINER operations are expected for this design; authorization tests remain necessary.

The social client still needs an Expo update published from the owner's authenticated Mac. The previous published update `47d7f965-4d1b-45a5-89a8-bef51942b866` predates this social redesign. Do not describe screenshots or mocked browser tests as a physical-device or authenticated hosted Scento pass.

Rollback: hide public pages before withdrawing public browsing, restore the prior mobile update, and preserve the additive tables and historical cutout references. Do not revert storage to a public bucket.

Verification results: 61 Vitest tests and TypeScript checks passed; web/iOS/Android exports passed. Local database suites including public sharing passed. Mocked live browser flows, the isolated demo's social and trading/capture flows at 360×800, 390×844 and 430×932, and public guest flows at all three sizes passed. Public guest tests verify no posting actions and no publishable key in the Authorization header. Screenshots remain local in ignored `artifacts/`.

Scento UI changes: search opens directly for a new fragrance; manual entry is an alternative; provider profile review precedes apply; saved notes stay collapsed until requested. The user clarified clutter as the current issue. This release does not claim a newly reproduced or repaired upstream outage. The existing live provider verifier passed on the owner's Mac; live authenticated catalog behavior on physical devices remains to be checked.
