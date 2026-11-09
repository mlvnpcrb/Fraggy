# Fraggy shelf and photo-cutout verification

## Automatic capture clarification

Photo selection/capture starts removal immediately. There is no Remove background choice. During processing the app shows automatic progress; Retry cutout appears only when that attempt fails, and adding an unprocessed photo is disabled. `scripts/automatic-cutout-smoke.cjs` verifies automatic inference without a second click, placement of the result, failure-only retry, and blocked unprocessed Add. This regression failed against the former optional-looking button, then passed after the UI correction. TypeScript also passes.

## Current behavior

The collection is now a continuous green cabinet with three or more shared shelf rows, warm lighting, substantial shelf fronts, upright bottle cutouts, contact shadows and empty add slots. The previous individual-card collection has been replaced.

Taking/selecting a photo automatically sends a resized JPEG to the local processor. Actual U2NetP CPU inference removes its background, crops the detected foreground with a small transparent margin, and returns a PNG. The app previews the processed image and preserves its aspect ratio and base alignment when placing it on the shelf. Failed processing retains the original for retry and prevents adding it as a completed cutout. Sample illustrations are not substituted for user uploads.

## Evidence

- TypeScript checks pass.
- 24 JS domain/config tests pass: existing collection/trade cases plus processor LAN/explicit URL/tunnel configuration cases.
- Five Python checks pass, including real model inference yielding a cropped RGBA PNG with transparent corners, corrupt/oversized input rejection, and an actual HTTP upload/processing response. The test image is a generated bottle image, not a user photo.
- Browser flow at 320px: photo chooser cancellation retains the draft; automatic removal handles a simulated HTML 503 with a clear error; original photo cannot be added before processing; retry hits the real local CPU model; processed PNG is added to the shelf. Collection filters and shipping/local swap, cancellation, both receipt confirmations, pause and reset also pass.
- Header layout regression at 320px and 2× browser text passes. Receipt modal regression at 375×667 and 3× browser text passes. These stress tests do not establish native Dynamic Type behavior.
- Current production iOS export succeeds with the added Expo image-manipulator and constants dependencies.
- Visual screenshots: `fraggy-digital-shelves.png`, `fraggy-cutout-preview.png`, `fraggy-photo-on-shelf.png` in the workspace. Browser rendering is not physical-device verification.

## Independent review and fixes

Fresh review found no critical or important issue for the local prototype. Two minor issues were reproduced failing and fixed: shelf header overflow under larger text, and raw JSON parsing errors from non-JSON gateway failures. Their browser regressions now pass. No findings are deferred.

## Research

The original cabinet composition draws on the shared visual features of [illuminated glass perfume shelving](https://rtdisplay.com/product/light-oak-led-lighted-perfume-display-cabinet-4-glass-shelves-fragrance-shop/) and [boutique fragrance displays](https://xtraitperfumery.com/). See `docs/shelf-redesign.md` for the revised design authority.

## Remaining limits

The cutout server must be running and reachable from the phone. Expo LAN can use the same computer's port 8787; a Metro-only tunnel does not expose the processor. The workspace still has no external-phone Expo tunnel. No usable external QR or physical iPhone testing is claimed.

Camera permission behavior, native Dynamic Type, VoiceOver, keyboard/safe areas and haptics need an iPhone check. Broad cutout quality across real transparent-glass bottles, hands, reflections and busy backgrounds is not established by the test fixture. The preview and retake flow supports reviewing those results.

Photos are processed on the configured computer, not a paid image API, and uploads are closed without retention there. The resulting cutout lives in the app's session-local collection; restarting resets the prototype. Real accounts, live trading, chat, shipping and durable storage remain outside scope.
