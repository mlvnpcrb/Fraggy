# Future Cloudflare Pages PWA integration

No frontend was deployed. Static hosting should use Pages Free; decline Workers paid
features, paid domains and billing upgrades. Confirm current quotas before approval.
Expose only the **public** API base URL in the frontend build configuration, for example
`VITE_API_BASE_URL=https://YOUR-SERVICE.onrender.com` if the future app uses Vite.
The actual frontend tooling has not been selected or changed in this backend task.
Never place DATABASE_URL, Supabase service-role key, operator password or API gateway
secret in a VITE_/NEXT_PUBLIC_ variable, bundle, browser local storage or repository.

Set backend CORS_ORIGINS to the exact approved Pages origin, e.g.
`https://YOUR-PROJECT.pages.dev`. Comma-separated explicit origins are supported.
Do not allow `*` or every Pages preview domain. Add only specifically approved preview
origins when needed. CORS is a browser policy, not authentication or access control.
Use HTTPS end to end; no mixed content. Current catalog requests are public GETs.

Read endpoints retain existing response contracts:

- GET /v1/canonical-perfumes?q=NAME&brand=BRAND&limit=25&offset=0
- GET /v1/canonical-perfumes/{canonical_id}
- GET /v1/canonical-perfumes/{canonical_id}/sources
- GET /v1/perfumes (legacy source records), /v1/brands, /v1/sources

Use URLSearchParams to encode queries, page using `total`, `limit`, `offset`, and show
source attribution. Ratings remain per source; never combine differing scales into
one fabricated score. Detail `selection.canonical_id` is the stable shelf reference;
show `requires_review`, `active` and `eligible_for_trading` honestly. There is no user
login, authenticated shelf-write or trading service in this backend. Do not claim
shelves are persisted server-side; the future app must implement authenticated storage.
Keep retained inactive IDs reviewable; do not redirect silently to a different variant.

Render Free may take many seconds to wake. Show a specific 'Starting catalog service'
state, allow a 90-second first health/read request, cancel on navigation, and permit a
manual retry. Retry idempotent GET failures at most twice, with jitter and a bounded
90-second total retry budget; honor Retry-After on 429/503 (if it exceeds budget, stop
and show when to retry). Do not poll continuously to keep Free instances awake.
Never retry 400/401/403/404/422 automatically. Distinguish no results from offline,
timeout and service errors. Cached results should show their age and refresh state;
respect ETag/304 and Cache-Control. API limits are process-local, not a distributed
abuse-protection service; if future scale needs a gateway, use a separately reviewed
free option and test it, without enabling billing implicitly.

No mutation/scraping/admin HTTP routes exist. Matching, migrations and imports run on
the private operator machine. /v1/sync/status is existing public read-only status; it
cannot start work. Do not add publicly accessible admin routes without authentication
and authorization. Keep private backup files/receipts outside the web image and PWA.
