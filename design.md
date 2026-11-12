# Fraggy design specification

**Status:** Approved target for the demo and live app; implementation and device acceptance are pending.  
**Research reviewed:** 12 November 2026, Philippine time.  
**Audience:** Designers, engineers, Codex, Antigravity, and beta reviewers.

This is the authoritative UI/UX specification for the Luxury Gen Z redesign. It defines what to build, its rationale, interaction states, and acceptance checks. It does not certify the current app against these requirements. In particular, `admin/admin` is a **planned isolated demo login**, not an existing founder credential.

The [private beta plan](docs/private-beta-plan.md) remains authoritative for business rules, privacy, quotas, and trade transitions. The [deployment runbook](docs/private-beta-deployment.md) and [verification report](docs/private-beta-verification.md) describe operational configuration and observed evidence. This document supersedes earlier visual/prototype specifications; it does not replace server-enforced rules. Preserve Expo SDK 58 and the private-beta architecture. No new paid service, database migration, or live authentication bypass is part of this redesign.

## 1. Product intent and evidence

### Signature journey

**Photograph → automatic cutout → inspect → place on shelf → optionally trade.**

The audience is Philippine fragrance collectors. A successful experience lets someone recognize their collection, add a bottle without understanding image-processing infrastructure, and arrange a one-for-one exchange with clear consent and ownership status. The shelf is the product's primary identity; photographing and organizing bottles must remain useful without trading.

### Evidence categories

| Category | Meaning | Fraggy examples |
|---|---|---|
| Research-supported requirement | A sourced usability or accessibility principle, translated into an explicit product rule. | Label navigation, communicate processing states, support enlarged text and non-drag alternatives. |
| Approved brand preference | A direction chosen by the founder, not a universal research result. | Racing green, ivory, restrained lime, Manrope, continuous illuminated shelves, Luxury Gen Z voice. |
| Design hypothesis | A specific composition or interaction choice to evaluate with collectors. | Shelf-first layout, the 400-pixel first-ledge target, a two-column discovery grid, restrained depth conveying a premium feel. |

Contemporary styling must serve recognition, readability, and control. Research does not prove that a particular green, font, radius, or animation feels luxurious to every collector. Validate that perception separately from task completion.

### Current Playwright audit

The existing production web export was inspected at **390 × 844 CSS pixels** using Playwright and an intercepted fixture API. The audit covered authentication, Shelf, Discover, and trade navigation. It established:

- Large page headings and stacked full-width controls delay the first shelf row.
- Discover places a long filter form before its bottle results.
- Multiple repeated empty-slot buttons compete with the primary capture action.
- The inspected page had no horizontal overflow; the main buttons measured 48 CSS pixels high. Retain these strengths while checking all controls.
- Fixture images were unavailable in the mocked state. Those placeholders do **not** establish a live cutout, upload, or storage failure.

These are expert inspection observations, not findings from collector usability sessions. Browser emulation does not establish native permission, keyboard, safe-area, screen-reader, or photo-processing behavior.

## 2. Research-to-design matrix

All sources below were reviewed on **12 November 2026**. Earlier publication dates remain earlier dates; foundational guidance is not presented as newly published 2026 research. Source IDs are used in the requirements and checks below.

| ID and principle | Primary source | Fraggy decision | Acceptance evidence |
|---|---|---|---|
| R1 — Visibility, recognition, error prevention and recovery | [NN/G: 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | Keep bottle names, privacy and trade state visible; explain consequences before confirmation; preserve work and offer actionable recovery. | State fixtures and task tests show what happened, what remains, and the next available action. |
| R2 — Progressive disclosure | [NN/G: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Lead with the collection/results. Put secondary filters and shelf-management controls in clearly labelled secondary views. | Bottles precede expanded filters; secondary actions remain discoverable and their active values are summarized. |
| R3 — Predictable navigation | [Apple: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Four persistent, labelled destinations. Capture is a separate action above the bar, not a fifth tab or an action embedded among tab items. | Tab order/labels stay stable; switching tabs restores navigation and scroll state; empty destinations remain available. |
| R4 — Scoped modal tasks | [Apple: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) | Sheets handle filters and shelf management. Capture is a full-screen flow. Open one sheet at a time with an explicit exit. | Dismissal returns to the originating context, retains expected state, and restores focus. No nested sheet stack. |
| R5 — Honest progress | [Apple: Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) | Show named stages and an indeterminate indicator for unknown durations. Percentages require measurable progress. | Slow/stalled/error fixtures never show invented percentages or countdowns; drafts remain resumable. |
| R6 — Comfortable touch targets | [Google: Touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en) | Adopt 48 × 48 logical-unit interactive targets and normally 8 units between adjacent targets. Small icons can have larger hit regions without overlap. | Layout measurements and native accessibility inspection verify target bounds and separation. |
| R7 — Text contrast | [W3C: Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Normal text reaches 4.5:1; large text reaches 3:1 under WCAG's definition. Check actual foreground/background pairs. | Calculated token checks plus rendered review on all relevant surfaces. |
| R8 — Perceivable controls | [W3C: Understanding SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | Essential control/state cues and meaningful graphics reach 3:1 against adjacent colours; decorative dividers are not input or focus indicators. | Component states remain identifiable without their low-contrast decoration. |
| R9 — Alternatives to dragging | [W3C: Understanding SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Shelf movement has tap controls. Any later drag interaction retains a non-drag path. | A collector can rearrange/move a bottle using taps alone. Keyboard support does not replace the tap alternative. |
| R10 — Accessible authentication | [W3C: Understanding SC 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) | Permit paste, autofill/password managers and password visibility control; make invitation input pasteable. | Login works with pasted/autofilled values, persistent field labels and accessible errors. |
| R11 — Adaptability and multiple cues | [Apple: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Support enlarged text, assistive technology and reduced motion. Status uses text/icon cues in addition to colour. | Native large-text, VoiceOver, TalkBack and reduced-motion checks. |

WCAG supplies measurable benchmarks for the browser preview and informs the native design. A Playwright or contrast pass alone is not a claim of native accessibility compliance. The 48-unit target is Fraggy's adopted product default informed by Android guidance; it is not described as WCAG's universal minimum.

## 3. Visual foundations

### Semantic colours

| Token | Value | Approved role |
|---|---|---|
| `brand.primary` | `#103D2B` | Main actions, selected navigation and strong text on light surfaces. |
| `canvas.default` | `#F6F3EB` | Main ivory screen background. |
| `surface.default` | `#FFFDF8` | Forms, sheets and raised utility surfaces. |
| `cabinet.back` | `#0C291F` | Shelf interiors, with restrained green depth gradients. |
| `accent.lime` | `#D5F66A` | Capture emphasis, small active accents and short success moments; pair with dark green text. |
| `text.primary` | `#18261F` | Main text on ivory/light surfaces. |
| `text.secondary` | `#56645B` | Secondary text on light surfaces. |
| `text.onCabinet` | `#D7DFC9` | Readable bottle labels on the cabinet. |
| `border.decorative` | `#DEDCD2` | Nonessential separation on light surfaces. |
| `control.outline` | `#56645B` | Identifiable input boundaries on ivory/light surfaces. |
| `focus.ring` | `#103D2B` | A 2-unit external focus ring on light surfaces; use ivory on dark cabinet surfaces. |
| `status.error` | `#943E35` | Error text/icon on ivory, always accompanied by an explanation. |

Calculated using WCAG relative luminance on solid sRGB colours, rounded here for reporting:

| Pair | Approximate contrast | Rule |
|---|---:|---|
| Green / ivory | 10.98:1 | Approved for essential text. |
| Green / lime | 9.99:1 | Approved for action labels. |
| Secondary text / ivory | 5.62:1 | Approved for normal text. |
| Cabinet label / cabinet back | 11.30:1 | Approved for essential shelf labels. |
| Error / ivory | 6.31:1 | Approved for error text. |
| Lime / ivory | 1.10:1 | Decoration only; never essential text or the sole control/state indicator. |
| Decorative divider / ivory | 1.24:1 | Never the sole input boundary, selection marker or focus indicator. |

Test full-precision contrast values without rounding a failure into a pass. Opacity, gradients, image backdrops and overlays change the actual pair; token ratios do not automatically validate those combinations. Photograph labels embedded in an image do not replace accessible product-name text.

### Type, spacing and shape

- Use the existing bundled **Manrope Regular, Medium and ExtraBold** weights. Prefer Medium for controls, ExtraBold for concise headings, and Regular for body copy. Do not add a second font family.
- Default hierarchy in React Native logical units: **display 32; screen title 24; section title 20; body 17; label 14; metadata 13**. Use roughly 1.4× line height for body copy, generous field spacing, and natural wrapping.
- Reserve display type for welcome/empty-state moments. Shelf and Discover use compact screen titles. Do not shrink meaningful shelf labels into decorative microtype to fit more bottles.
- Support system text scaling to at least 200% in verification. Essential instructions/actions must not be clipped or hidden by fixed-height containers. Reflow rather than cap text scaling.
- Use an eight-point spacing rhythm: 8, 16, 24, 32 and 48, with 4-unit optical adjustments. **20-unit screen gutters** are the explicit layout exception. Maintain a minimum 48-unit target even when the visible symbol is smaller.
- Use 16-unit cards/inputs, 24-unit sheets/cabinet outer corners, and pills only for compact selectors/filter summaries. Avoid placing every item inside another card.
- Give cabinet surfaces shared ledges, warm restrained lighting and contact shadows. Use subtle elevation on utility surfaces. Restrict rotation, bounce and visual novelty so the bottle's upright identity remains clear.

## 4. Navigation and layout rules

- Persistent destination order: **Shelf · Discover · Trades · Profile**, each with an icon and a visible label. Keep the existing icon family consistent.
- Put a labelled **Capture** action above the bar on Shelf and Discover, visually separated from tab destinations. Its visible height is 56 units and its touch region is at least 56 × 56. Add content padding so it never covers a bottle, result, message, or form control. Hide it during full-screen capture and trade conversation tasks.
- Keep the selected destination and screen title clear. Opening a modal does not select a new tab. Returning restores the origin's shelf/filter/scroll position.
- Respect native safe areas. The tab bar and keyboard must not obscure focused controls or confirmation content. Scroll pages as a whole; avoid nested cabinet scrolling inside page scrolling.
- At **390 × 844 CSS pixels with default text**, target the first physical shelf ledge's top edge at **y ≤ 400**, measured from the viewport top after content settles. This is a composition target, not a research standard. Enlarged text, validation messages and accessibility take priority.
- Use two discovery columns and three shelf columns at normal text where space permits. Switch to a single discovery column and two shelf columns at font scales above 1.3; reduce further if essential content cannot fit. Do not shrink text to preserve column count.
- Sheets use clear titles, Close/Cancel and Apply/Done as appropriate. Keep one active sheet. Move keyboard focus into the sheet, constrain background interaction, and return focus to its opener on dismissal. Android Back and web Escape dismiss non-destructive sheets. Never discard edited data silently.

## 5. Screen specifications

Wireframes show information order and annotations, not final pixel-perfect artwork. Product names and cities below are illustrative labels, not prescribed live records.

### 5.1 Welcome, sign-in, invitation and recovery

```text
[fraggy.]                               [1: concise brand header]
Your collection. On display.            [2: one short welcome line]
Username or email                       [3: persistent field label]
[                                      ]
Password                          [Show]
[                                      ]
[ Sign in ]                             [4: primary action]
Join beta                 Need help?    [5: separate routes]
Try the demo: admin / admin              [6: explicit sample access]
```

**Hierarchy/actions:** Sign in is primary. Join beta and recovery have their own focused screens rather than three large competing mode buttons. Real accounts use email; `admin` is the reserved local demo username. Invitation entry collects code, email/password, handle, name and Philippine city in short steps with preserved values. Recovery explains the existing founder-assisted process.

**Navigation:** Successful live login opens Shelf; successful demo login opens the same redesigned Shelf in demo mode. Authentication assistance returns to the form without losing non-secret values. Never echo passwords in errors or logs.

| State | Presentation and behavior |
|---|---|
| Default | Visible labels, appropriate keyboards, paste/autofill and password visibility control. |
| Submitting | Disable duplicate submission; label the action with its actual pending task. |
| Invalid demo credentials | Local, field-associated error; no fallback to live authentication. |
| Live validation/auth error | Explain what to correct or retry without displaying raw server errors. Preserve email, clear sensitive fields when appropriate. |
| Offline | Explain that live sign-in needs connectivity. The explicitly local demo remains available. |
| Success | Enter the correct mode; no intermediate fake loading or administrator-elevation claim. |

### 5.2 Shelf and shelf management

```text
fraggy.                         [Inbox] [1: compact header]
My collection                 Private  [2: count/privacy summary]
[ Daily rotation v ]        [Arrange]  [3: selector + secondary control]
┌────────────────────────────────────┐
│    bottle     bottle     bottle    │ [4: actual upright cutouts]
╞════════ shared illuminated ledge ══╡
│    name       name       name      │ [5: readable labels + remaining]
│    bottle     [+ Add]              │ [6: one clear next add position]
╞════════ shared illuminated ledge ══╡
└────────────────────────────────────┘
                          [ + Capture ] [7: separate action; no overlap]
Shelf    Discover    Trades    Profile
```

**Hierarchy/actions:** Bottles dominate. Capture is primary; tapping a bottle opens details. Shelf selection, arrangement and inbox are secondary. Keep continuous cabinet backing, common ledges and bottle baselines. Render only the rows needed for content and the next add position; do not fill the first screen with repeated empty calls to action. Bottle names, volume and remaining amount remain legible and available to assistive technology.

**Management:** A sheet contains named-shelf creation/rename and bottle movement. Arrange mode offers visible Move earlier, Move later and Move to shelf controls. A later drag interaction is optional and cannot remove these controls. Reserved bottles explain why editing/movement is unavailable. Saving returns to the affected shelf and position.

| State | Presentation and behavior |
|---|---|
| Loading | Preserve cabinet structure; use finite placeholders, not sample live bottles. |
| Empty | A calm cabinet with one clear add invitation and concise guidance. |
| Populated | Stable positions, real images and a single next add slot. |
| Unfinished capture | Compact resumable status item near the selector; do not stack several full-width primary buttons above the cabinet. |
| Offline | Show the cached collection with a quiet offline label; explain actions requiring connectivity. |
| Photo unavailable | Show a labelled neutral placeholder; retain the bottle's details and retry path. Never substitute a sample image. |
| Save/move failure | Keep the prior confirmed position and edited input; offer retry. |
| Success | Settle the real cutout on its ledge and announce the saved/moved state; respect reduced motion. |

### 5.3 Full-screen capture, processing and bottle entry

```text
[Close]                     Add bottle [1: exit preserves draft]
┌────────────────────────────────────┐
│         camera / original /        │ [2: dominant image region]
│         actual PNG preview         │
└────────────────────────────────────┘
Removing the background…               [3: actual stage + indicator]
Your photo is saved. Return later.      [4: truthful recovery guidance]
[Green background] [Checkerboard]       [5: inspection when ready]
[ Continue to bottle details ]          [6: available only when ready]
```

**Flow:** Camera/library selection → automatic upload/removal → actual cutout inspection → bottle details → save to chosen shelf. Never ask whether to remove the background. Never imply automatic fragrance identification. Permission prompts occur when the relevant camera/library action is chosen, with a useful explanation if access is denied.

**Details:** Use progressive sections for fragrance identity, size/remaining amount, condition/cap/box, and exchange preferences. Mandatory fields remain obvious; secondary controls are discoverable and retain values. Match field limits to server constraints, including **80 characters for fragrance name**. Use native keyboards and field-associated validation. The final action reads **Place on shelf**.

**Navigation:** Close returns to the originating screen and retains the draft. Closing is not labelled Cancel processing when the hosted job continues. Inspection supports retry/retake without silently losing the previous original. Saving opens the selected shelf with the new bottle visible.

| State | Presentation and behavior |
|---|---|
| Before selection | Camera and library choices, plus concise framing advice. |
| Permission denied | Explain how to grant access; retain any existing draft and offer the other available source. |
| Uploading | Show the original and an honest upload state. Only show a percentage if upload progress is actually measured. |
| Waking / queued | Explain that processing is preparing/waiting; use an indeterminate indicator and retain a route back to the draft. |
| Processing | Show the named stage in a stable position. No invented completion percentage or countdown. |
| Ready | Show the actual transparent PNG, inspection backgrounds and a clear quality check before saving. |
| Failed / disconnected | Retain original and form values; explain Retry or Retake. Do not label the original or a fixture as a completed cutout. |
| Saved | Show confirmation and the durable bottle on its shelf. Duplicate taps cannot create duplicates. |

Demo capture is a separate, clearly labelled **Try sample capture** demonstration using a bundled cutout. It does not accept a real photograph and pretend to process it.

### 5.4 Discover and filters

```text
Discover                         Inbox [1: compact destination header]
[ Search fragrance or brand       ]    [2: persistent search]
[ Filters (2) ]  Cebu · Shipping        [3: summary of active filters]
┌────────────────┬─────────────────┐
│ bottle cutout  │ bottle cutout   │    [4: results lead the page]
│ brand / name   │ brand / name    │
│ remaining/city │ remaining/city  │
└────────────────┴─────────────────┘
                          [ + Capture ]
Shelf    Discover    Trades    Profile
```

**Hierarchy/actions:** Browsing and opening a bottle are primary. Filters are secondary. Listing cards contain image, brand/name, remaining amount and city; exchange availability is concise. Use a two-column grid normally, a single column for large text. Full condition and collector details belong on the bottle screen.

**Filter sheet:** City, local meetup/shipping and minimum remaining amount; show current selections, Clear all, Apply filters and Cancel. Edits stay local until Apply. Cancel preserves the applied filter set. Show the applied count/summary outside the sheet so hidden settings are not forgotten. Preserve search, applied filters and scroll position when returning from a bottle.

| State | Presentation and behavior |
|---|---|
| Initial loading | Search and grid structure remain visible with labelled loading behavior. |
| Results | Bottles appear before expanded filters; reserved/unavailable listings follow current server visibility rules. |
| No matches | Repeat the meaningful query/filter context; offer Clear filters or Edit search. |
| No listings yet | Explain the difference from a failed request and link to adding a trade-available bottle. |
| Offline / error | Do not present missing results as an empty marketplace; explain connectivity/retry. Do not cache other collectors' private shelves as an offline collection. |

### 5.5 Bottle detail and proposal selection

```text
[Back]                    Bottle       [1: return to previous context]
            large cutout               [2: collector's actual image]
Brand                                  [3: identity before decoration]
Fragrance name
100 ml · 80% remaining · Good           [4: decision-relevant condition]
Cap included · No box
[Original photo] [Condition photo]
Collector · City · Reviews              [5: profile route]
[ Propose swap ]                       [6: primary action]
```

**Hierarchy/actions:** Actual photography and condition lead. Others' bottles offer Propose swap; owned bottles offer Edit when permitted. Secondary actions include original/condition photos, collector profile, move/edit or report as authorized. The proposal step shows the collector's available bottles, the selected pair and a mutually offered exchange method before sending.

**Navigation:** Back restores the origin. A successful proposal opens its private trade conversation. No action suggests payment, authenticity verification, guaranteed shipping or automatic fragrance recognition.

| State | Presentation and behavior |
|---|---|
| Available | One clear proposal action with the necessary condition information. |
| No eligible owned bottle | Explain how to add/mark a bottle available; keep the requested bottle context. |
| Own reserved bottle | Explain the reservation and link to the trade; do not expose editable fields as if they will save. |
| Listing changed/private/unavailable | Explain the change and offer a return to discovery rather than a broken empty detail. |
| Photo failure | Preserve textual details and clearly identify the missing image. |
| Proposal pending/error/success | Prevent duplicate sends, retain selection on failure, and open the real conversation only after confirmation. |

### 5.6 Trade inbox, conversation and receipt

```text
Trades                                  [1: stable destination]
[Offers] [Exchanges] [History]           [2: local views, not extra tabs]
Bottle A ↔ Bottle B                     [3: identifiable agreed pair]
Collector · Waiting for your response   [4: precise status + unread cue]
──────────────────────────────────────
Trade detail:
[Back]                 Exchange details [5: private logistics sheet]
Bottle A       ↔       Bottle B         [6: immutable agreed details]
Offer → Both agreed → Exchange → Receipt
Conversation and latest status          [7: messages stay central]
[ Contextual next action ]              [8: one primary next step]
```

**Hierarchy/actions:** Inbox rows show agreed bottles, collector, precise state and unread messages. Trade detail presents the agreed snapshot, both participants' acceptance/receipt states, chat, and the viewer's next permitted action. The exchange sheet contains private meetup/shipping instructions, address/contact and tracking; these never appear in discovery, profile summaries or notification text.

**Receipt confirmation:** Use a focused confirmation dialog naming the incoming bottle and explaining that both receipts transfer ownership. Require an explicit acknowledgement and a labelled **Confirm my receipt** action, with an equally clear way back. Prevent duplicate submission and await the actual server result. Do not imply that tracking, elapsed time, or a single receipt completes the exchange.

| State | Presentation and behavior |
|---|---|
| No trades | Explain how to start from an available listing; no sample conversation in live mode. |
| Proposal | Show who has agreed, the seven-day deadline and the viewer's accept/decline/withdraw action as permitted. |
| Both agreed | Identify both bottles as reserved; expose exchange coordination. |
| Exchange / one receipt | Show dispatch/receipt per collector; explain whose confirmation is still pending. |
| Paused unanswered offer | Keep its decline/withdraw/expiry semantics; do not describe it as a mutually accepted reservation. |
| Accepted dispute / cancellation request | Explain the pause, reservation and required next agreement; preserve access needed for resolution. |
| Offline / sending failure | Retain typed text, identify unsent messages, and do not simulate acceptance or receipt. |
| Complete | Confirm both receipts and updated shelves; offer the permitted review and reporting actions. |

### 5.7 Collector and own profile

```text
Profile                         Settings [1: separate management route]
Avatar · Display name · @handle           [2: identity]
City · Bio
Collection count · Completed trades      [3: meaningful statistics]
Reviews                                  [4: actual review content]
[Shared shelf / privacy explanation]      [5: visibility boundary]
Own profile: [Edit profile] [Privacy]
Other profile: [Report] [Block]
```

**Hierarchy/actions:** Identity and collector context lead. Own profile offers editing, shelf-sharing controls and settings. Another collector's profile shows only authorized information, reviews and a full shelf only when sharing is enabled. Completed-trade count and review count are distinct facts. Founder utilities are accessed from own settings, not a normal collector-facing tab.

| State | Presentation and behavior |
|---|---|
| Default | Accurate identity/stats, understandable privacy status and appropriate actions. |
| No reviews / private shelf | Explain each state without fabricated ratings or inaccessible shelf previews. |
| Editing | Label fields, respect limits, support keyboard navigation and preserve unsaved values on validation failure. |
| Sharing saved | Explain the actual audience; existing available listings remain discoverable according to the beta rules. |
| Blocked/unavailable/deleted | Show an appropriate explanation and route back; preserve accepted-trade resolution access. |
| Offline/error | Distinguish cached own profile from a failed live refresh; do not claim a change saved before confirmation. |

### 5.8 Notifications and founder administration

```text
Notifications:                         Administration:
[Back] Notifications                   [Back] Founder tools
Unread marker · event                  Usage / processing health
Agreed bottles · time                  [Invitations] [Reports]
[Open relevant trade]                  [Members] [Processing]
                                       Selected item + scoped action
```

**Notifications:** Event meaning and the relevant trade lead. Marking read and opening the destination must preserve context. Empty, unread, read, loading, offline and unavailable-target states are explicit. Announce important updates accessibly without repeatedly interrupting a screen reader for every refresh.

**Administration:** Use the same typography and controls with a restrained utility layout. Invitations, reports, member/listing restrictions and failed jobs are separate groups. Show quota figures with units and thresholds. Give restriction/restore actions explicit target names and confirmation when consequential. Keep codes/secrets out of general notifications and screenshots. No moderation control may confirm receipt or transfer ownership.

| State | Presentation and behavior |
|---|---|
| Loading/default | Clear section titles and labelled metrics/actions; no ornamental collector cabinet around operational tables. |
| Empty report/job list | Indicate the scoped empty state, not overall system health. |
| Unauthorized | Deny the view and return to the normal app; hiding a menu is not authorization. |
| Pending/failure | Prevent duplicate action and explain retry; retain relevant non-secret input. |
| Success | Reflect confirmed server state and the precise affected account/listing/report. |
| Demo administration | Persistent Demo label; all codes, metrics and moderation effects are local simulations with no live authority. |

## 6. Component, copy and feedback rules

### Component contracts

| Component | Required anatomy and behavior |
|---|---|
| Primary button | One clear verb per task, readable label, ≥48-unit target, visible pressed/focus/disabled/pending states; keep pending label and dimensions stable. |
| Secondary/destructive action | Lower visual emphasis than the primary action; destructive effects named in text and confirmed when irreversible. |
| Field | Persistent label, hint when useful, correct keyboard/autofill, field-associated error, preserved input, visible focus and distinguishable boundary. Placeholder text is not a label. |
| Bottle slot | Actual image or explicit missing-image state, common baseline, full accessible bottle identity, readable name/remaining amount; reservation shown with text/icon. |
| Listing card | One coherent open-detail target with image and concise identity/condition context; avoid nested competing tap areas. |
| Sheet | Named task, one active modal, explicit dismissal, appropriate Apply/Done behavior, safe-area/keyboard accommodation and restored focus. |
| Status label | Plain meaning with icon/text; colour is supplementary. Differentiate loading, unavailable, offline and empty. |
| Notification row | Event, relevant object and time; unread indicator has an accessible equivalent; no private address or message-body leakage. |
| Confirmation dialog | Named object, consequence, explicit confirm verb and an exit; focus enters the dialog and returns appropriately. |

### Shared state matrix

| State | Visual, interaction and accessibility response |
|---|---|
| Default | Clear label, hierarchy and operable semantics. |
| Pressed | Immediate restrained visual feedback; no layout jump. |
| Focused | Visible contrast-compliant focus ring; focus is not hidden behind sticky UI or the keyboard. |
| Disabled | Communicate why the action is unavailable when not obvious. Do not rely on reduced opacity alone; do not shrink text/targets. |
| Loading | Identify the actual task, suppress duplicate action, retain existing useful content and announce meaningful state changes. |
| Empty | Explain the scoped absence and offer the relevant first action. |
| Offline | Identify cached/unsent state and what can be retried when connected. |
| Error | Plain-language problem plus a recovery action; retain safe input and avoid raw SQL/HTTP/SDK messages. |
| Success | Acknowledge the confirmed result, expose its destination, and avoid excessive interruption. |

### Voice and sample copy

Use short, confident and warm language, with fragrance personality in low-risk moments. Errors, permissions, privacy and trade commitments remain literal. Avoid forced slang, luxury claims, excessive emoji, unexplained abbreviations and internal infrastructure jargon.

| Situation | Example |
|---|---|
| First bottle | “Make room for your first bottle.” |
| Processing preparation | “Preparing your photo. This can take longer after inactivity.” |
| Removal | “Removing the background…” |
| Recoverable failure | “We couldn't finish the cutout. Your original is saved. Retry or take another photo.” |
| Offline shelf | “You're offline. Showing your saved collection.” |
| Awaiting other receipt | “You confirmed receipt. Waiting for the other collector.” |
| Demo | “Demo · sample collection” |

Use an example only when its statement is true for the actual state. An unsaved upload must not claim that its original is safely stored. Closing a view must not imply that the server job was cancelled.

### Motion and haptics

Use approximately 180 ms opacity/translation transitions for ordinary UI and a restrained, brief bottle-settle animation after a confirmed save. Keep status indicators functional rather than decorative. Respect system reduced motion by removing movement/spring effects and retaining clear static state changes. Optional haptics accompany confirmed actions; never make vibration or sound the sole feedback channel. Do not add dependencies or native capabilities incompatible with Expo Go to obtain a visual effect.

## 7. Demo/live boundary and screen-data contract

This defines presentation responsibilities, not a new server API or authentication method.

| Interface responsibility | Required behavior |
|---|---|
| `mode` | Explicit `demo` or `live`; available to shared screens for visible labelling and capability selection. |
| `viewer` | Screen-facing identity, independent of a fabricated Supabase session. No real administrator role is inferred from the word `admin`. |
| Collection/trade state | Shared normalized presentation shape, including actual per-party acceptance/receipt and reservation state. Demo records have separate identities and storage. |
| Actions | Mode-specific implementations for the existing screen operations; unsupported demo actions fail locally, with no live fallback. |
| Media resolution | Live uses authorized private media and caching. Demo resolves bundled assets; it never uses private live image URLs as fixtures. |
| Capture capabilities | Live supports real camera/library and automatic jobs. Demo explicitly supports a sample-capture demonstration only. |

### Startup and authentication

- Resolve persisted application mode before importing the auto-refreshing live API client or mounting its provider. Shared/demo screens must not statically import modules that instantiate that client.
- On a clean install show a provider-independent sign-in screen. The reserved username is `admin` (trimmed and case-insensitive); the demo password is exactly `admin`. Successful demo entry loads only the local adapter. An incorrect demo password stays local.
- Real identities continue using email/password. Load live authentication only for live sign-in/join/recovery or restoration of a legitimate existing session. Supporting other live usernames is outside this design.
- Preserve valid pre-redesign live sessions: when no mode preference exists, detect existing local session storage without initializing the network client, then restore through the live boundary. Do not copy a session into demo state.
- Enter the demo from signed-out authentication. A live collector signs out before entering it. Exit demo clears its session/mode and returns to sign-in; it does not sign into or grant access to a real founder account.

### Isolation and persistence

- Keep demo mode/state in a distinct local namespace such as `fraggy.demo.v1.*`. Retain demo edits across restart until Reset demo. Reset requires confirmation and restores the bundled fixtures; it cannot touch live caches.
- Show a persistent Demo badge on every demo destination, sheet and confirmation. Simulated counterpart actions and sample administration are explicitly labelled.
- Restoring the demo must not mount live providers, refresh live sessions, subscribe to live channels, or call Fraggy Supabase/Render endpoints. Expo bundle/asset delivery is distinct from application-backend traffic.
- Demo fixtures contain no real credentials, contacts, addresses or users. Sample capture never uploads a user photograph or labels a substituted sample as that photograph's cutout.
- Live private storage, quotas, session isolation and server-controlled trade operations remain unchanged. UI confirmation is not a substitute for server authorization or both receipt confirmations.

## 8. Verification and acceptance

### Automated and browser checks

Use controlled fixtures, a stable export/revision and Playwright at **360 × 800**, **390 × 844**, and **430 × 932**. Repeat with enlarged text and reduced motion. Record whether each result uses mocked or real services.

Capture authentication, empty/populated Shelf, missing media, Discover/results/filters, capture stages/failure, bottle detail, trade inbox/receipt confirmation, profile, notifications and administration. Check:

1. No unintended horizontal overflow; text and essential actions remain visible and readable.
2. Targets meet adopted dimensions, adjacent hit areas do not overlap, and focus is visible.
3. The first-ledge target is met at 390 × 844/default text; large-text layouts reflow without enforcing this target.
4. Search/results remain visible before filter expansion; Apply/Cancel and back navigation preserve the documented context.
5. Dialog/sheet focus, Escape/Back dismissal, keyboard operation and restored focus work as specified.
6. Contrast passes on actual surfaces and states; automated checks are supplemented with manual image/gradient review.
7. Unknown-duration processing has no invented percentage; failures retain the original/draft when the actual persistence state permits that claim.
8. `admin/admin`, incorrect demo passwords, restart, reset, exit and sample capture respect isolation. Block/record Fraggy backend requests and fail if the demo attempts one.
9. Real email authentication and existing live collection/trade regressions continue to pass independently. No sample fixtures enter live state or caches.

Use layout assertions for measurable rules and controlled screenshots for visual regression. A screenshot alone cannot prove target accessibility, data isolation or real background removal. Browser text resizing is a useful layout stress test, not proof of native Dynamic Type support.

### Physical-device checks

Record device, OS, Expo Go version, revision, text settings, date and result. On physical iPhone and Android verify VoiceOver/TalkBack reading order and labels, enlarged text (including 200%), keyboard avoidance/autofill/paste, permission refusal/recovery, reduced motion and optional haptics. Exercise actual camera/library upload, automatic hosted removal, real transparent PNG preview, draft/restart recovery and the receipt dialog. These checks remain pending until performed; no browser pass substitutes for them.

### Five-collector usability study

Recruit five fragrance collectors from the intended audience, with consent. Give task goals rather than instructions naming the UI control. Observe:

| Task | Evidence to record |
|---|---|
| Add a bottle to a named shelf | Completion, hesitation, validation errors, wait-state understanding and recovery. |
| Find a suitable trade listing | Search/filter discovery, result relevance and back-navigation retention. |
| Propose a swap | Understanding of the selected pair, method and commitment. |
| Explain receipt confirmation | Whether the participant understands actual receipt, the consequence and the requirement for both collectors. |
| Distinguish demo and live | Whether sample data/actions and real account authority are understood. |

Project acceptance targets: **at least four of five** complete the core add/find/propose tasks without coaching; **all five** correctly identify demo status and explain the two-party receipt requirement. Record assistance and retry attempts rather than silently counting them as unassisted success. These are project decision thresholds, not universal research findings or statistically representative proof.

Separately ask what feels premium, youthful, confusing or visually excessive. Treat that qualitative feedback as evidence about brand hypotheses; attractive ratings do not override task or safety failures. Rework misunderstandings and repeat affected tasks before expanding the invitation group.

### Handoff and release checklist

- [ ] Every major screen has the specified hierarchy, actions, navigation and state coverage.
- [ ] Tokens and copy are shared by demo/live screens and checked against the actual rendered combinations.
- [ ] Demo entry/restoration is isolated before live-client initialization.
- [ ] Capture truthfulness, private media and both-party trade semantics remain intact.
- [ ] Browser and existing application/database/worker regressions pass for the intended revision.
- [ ] Physical-device and collector-study evidence is recorded with unresolved issues.
- [ ] Retain SDK 58, publish a new verified Expo Go revision, and keep the previous compatible preview available for rollback.

The documentation phase does not check these boxes by itself. Implementation, accessibility validation, user research and release approval produce the evidence.

## Implementation reference: complete app and catalog

The [complete-app release notes](docs/complete-app-release.md) describe the implemented shared demo/live routes, staged capture, Scento/custom fragrance entry, private wishlist, privacy preview and proposal checklist. The [implementation plan](docs/superpowers/plans/2026-11-12-fraggy-complete-app-scento.md) extends this design. Device acceptance and collector studies remain release gates; these specifications do not establish that they passed.
