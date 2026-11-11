# Fraggy — the digital perfume cabinet

> **Historical specification.** The current UI/UX authority is [design.md](../design.md). This document records an earlier cabinet/local-processor iteration; its local-server instructions are not the current hosted beta architecture. See the [private beta plan](private-beta-plan.md) for live business and backend rules.

The user's correction supersedes the earlier card-grid and simulated-removal prototype scope. The core experience is **take a bottle photo → remove its background → place the actual cutout on a continuous digital shelf**. Preserve the approved green, youthful luxury identity and existing swap flows.

## Research and visual translation

References reviewed online:

- [Light oak, glass shelves and warm under-shelf lighting](https://rtdisplay.com/product/light-oak-led-lighted-perfume-display-cabinet-4-glass-shelves-fragrance-shop/).
- [Fragrance cabinets, backlit niches and glass shelving](https://www.weitudisplay.com/perfume-display-stand/).
- [Boutique niche-fragrance display](https://xtraitperfumery.com/).

Translate their shared visual cues into an original mobile cabinet: deep-green backing, a continuous frame, warm light gradients, substantial shared shelf surfaces with visible front edges and shadows, upright bottles aligned on a common baseline, and empty slots. No individual bottle cards or tilted floating bottles. Keep the header compact so shelves dominate. Tap a bottle to inspect it; tap an empty place to add one. At larger text sizes show fewer bottles per row and preserve navigation readability.

## Real photo cutouts

Add a Python local processing companion using rembg and its U2NetP CPU model. A selected/captured image is processed automatically after selection; explain before selection that it will be sent to the processor on the collector’s computer. Provide a retry action when processing fails. The server validates and resizes input, removes the background, crops to the detected foreground, and returns transparent PNG data without retaining the upload. The app previews the cutout on a cabinet surface, lets the collector retake/retry, and places the PNG on the shelf. A failed removal cannot be labeled successful or silently added as a cutout. No paid keys are required.

The processor runs on the developer's computer on port 8787. Expo LAN builds derive the development host; EXPO_PUBLIC_CUTOUT_URL can select a reachable processor explicitly. A tunnel to Metro alone does not expose this separate service. Phone connection limitations remain explicit. Glass, reflections, hands and complex backgrounds can produce imperfect masks, so review/retake is part of the flow.

## Verification

- A real inference request produces transparent pixels and a cropped bottle image, and rejects corrupt/oversized images.
- Browser photo upload → removal → preview → add displays that processed image on a shared shelf.
- Continuous rows, common bottle baselines, touch targets and narrow-screen layout are visually checked.
- Existing trading tests and TypeScript checks pass; iOS export succeeds.

This change is directly authorized by the user's request to correct the shelf concept and implement photo cutouts. No further visual-direction approval is required.
