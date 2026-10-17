# Render + Supabase approval checklist

## Verified in this workspace

- [x] Export/source package audited; original inline migration logic retained.
- [x] All 73 baseline tests retained; four deployment tests added.
- [x] Existing APIs, canonical matching, source ratings and shelf references preserved.
- [x] API-only launcher uses assigned PORT and binds 0.0.0.0.
- [x] Read-only startup mode requires pre-migrated schema, performs no DDL.
- [x] No scheduler, import, worker or paid service added to web startup.
- [x] Secret-free template, operator-only import/backup and frontend guides supplied.

## Must complete before deployment approval is executed

- [ ] Review docs/render-free-settings.json and current Render/Supabase Free terms.
- [ ] Confirm every dashboard cost is ₱0; no billing upgrade/disk/worker/cron.
- [ ] Confirm Render Free Docker, health checks and secret CA files are available.
- [ ] Owner explicitly approves service/project creation and deployment.
- [ ] Publish reviewed backend source to the intended repository without secrets.
- [ ] Supabase Free project created; session-pooler IPv4 endpoint/5432 confirmed.
- [ ] Trusted CA downloaded and verify-full TLS succeeds from operator and Render.
- [ ] Dedicated owner/reader credentials and effective permissions audited.
- [ ] Secure backup and restoration drill completed; explicit migrations run once.
- [ ] Actual web reader can serve health/search/attribution without write rights.
- [ ] Exact frontend CORS origin known; secrets entered only in secure settings.
- [ ] Both scraping gates empty; automatic deploys off; one instance; no workers.
- [ ] Approved HTTPS deployment smoke checks pass; cold start handled.

## Separate future import authorization

- [ ] Owner supplies 1–10 actual URLs from one source plus permission details.
- [ ] Allowed outbound HTTPS, robots policy and source restrictions verified.
- [ ] Fresh confirmed backup and durable receipt directory available.
- [ ] Attended import's committed/verified real records reviewed separately.
- [ ] Actual source pages manually compared; repeated sync has no duplicates.
- [ ] Unattended scraping remains disabled.

Provider and live-source validation have not been replaced by synthetic tests.
Do not describe this checklist as complete while external boxes remain unchecked.
