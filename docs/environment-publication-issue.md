# Codex Cloud publication failure — support investigation packet

Checked: 2026-10-17 14:47 Asia/Manila (06:47 UTC).

## User-reported failure

Project: Fraggy / FraggyAPI.

Settings: Internet enabled, custom domains only, 16 additional allowed domains, no network secrets, no environment variables, privacy “Only me.”

Publication error: “Couldn't publish environment. Try publishing again. If it still fails, report the issue.”

The environment remains “Needs attention” and the Retry button is disabled. These UI/publication observations come from the user; the available tools do not expose publication job status or logs.

## Backend configuration evidence

Two read-only draft reads returned the same revision; no configuration change or publication retry was performed during this investigation.

- Draft ID: `f41b2dcb-3188-4454-a0df-84004b77b1bf~cecfgdraft_6ad3163c0a6881949b9d75c6f5b2274f`
- Draft revision: `9`
- Base version ID: `f41b2dcb-3188-4454-a0df-84004b77b1bf~cecfgver_6ad3135c4df881949533540b512b0e98`
- Network type: `restricted`
- Custom rules: 16 unique hostnames, all valid ASCII hostname syntax.
- Selected presets: none. Resolved preset rules: none.
- Secret requirements: none.
- Runtime requirements: none.
- Pending runtime requirements reported by the draft API: none.

Persisted custom domains:

```text
basenotes.com
fragrancex.com
fragrantica.com
luckyscent.com
osmoz.com
parfumo.com
perfume.com
wikiparfum.com
www.basenotes.com
www.fragrancex.com
www.fragrantica.com
www.luckyscent.com
www.osmoz.com
www.parfumo.com
www.perfume.com
www.wikiparfum.com
```

This confirms domain-list persistence in the editable configuration. It does **not** establish that publication validation succeeded, a snapshot was created, the version was activated, or runtime egress rules were applied.

## Fresh runtime tests

Tests used the existing environment proxy and default TLS verification; no direct access, identity rotation, DNS override, CAPTCHA workaround or authentication bypass was attempted.

At 2026-10-17 06:47:36 UTC:

| Request | Result |
| --- | --- |
| `GET https://pypi.org/simple/httpx/` | HTTP 200; response header `server: envoy` |
| `GET https://www.fragrantica.com/robots.txt` | httpx `ProxyError: 403 Forbidden` at HTTPS CONNECT |
| `GET https://www.parfumo.com/robots.txt` | httpx `ProxyError: 403 Forbidden` at HTTPS CONNECT |

Earlier read-only probes in the same task also found CONNECT denials for all eight catalog sources. The fresh probes confirm the problem persists after the user reported publication failure. These pre-source failures are not evidence of Fragrantica/Parfumo HTTP restrictions or robots policy.

Package-host access despite the current custom-only draft is a useful active-versus-draft discrepancy for platform investigation, but does not alone prove stale policy: platform infrastructure/package exceptions or other effective rules may exist and are not visible here.

## Local checks

- Git object integrity: `git fsck --no-reflogs` passed.
- Root filesystem: 32 GiB total, approximately 6.5 GiB used, 24 GiB available (22% used).
- `/tmp`: approximately 17 GiB available.
- Checkout: approximately 99 MiB, including the virtual environment.
- No Unix socket files found inside the checkout.
- Application files remain present; no reset, cleanup, repository replacement or credential change was performed.

These checks found no obvious local disk/Git failure. They cannot rule out server-side snapshot quotas, storage errors or publication validation failures.

## Available controls and limits

The session exposes draft read/update tools, but no publication-job logs, operation ID lookup, effective runtime egress-status API, publication retry, cancellation, or stuck-state reset control. A draft update cannot publish or repair a failed publication job. Re-saving the same hostnames would not demonstrate runtime activation, so it was not done. No access policy was broadened.

The repository metadata uses a platform repository ID and default empty mount-path field while the checkout is `/workspace/Fraggy`. This was not altered or classified as invalid: the platform may resolve that default internally. If repository/snapshot validation is the failing stage, please inspect that resolution in the server logs rather than assuming the network list caused the error.

## Requested platform investigation

1. Locate the failed publication operation associated with the draft/base version above; return its operation/request ID, failing stage and underlying error code.
2. Distinguish configuration validation, snapshot capture/upload, version activation, and runtime/network-policy application failures.
3. Confirm all 16 custom hostnames pass publication validation and identify any rule rejected downstream, if applicable.
4. Inspect the active egress-policy revision on the attached running instance and explain the CONNECT denials for explicitly listed hosts.
5. Explain why publication is stuck at “Needs attention” while Retry is disabled; recover/reset the operation through supported platform controls without deleting project state.
6. After repair, verify the active configuration and retry a permitted robots request through the standard proxy. Do not treat a saved draft as proof of propagation.

The generic UI error is insufficient to identify the root cause. Publication failure and runtime CONNECT denials are both confirmed/reported symptoms, but their causal relationship remains unproven without platform logs. No ticket has been filed automatically; this packet is ready for the user to submit through OpenAI Support.
