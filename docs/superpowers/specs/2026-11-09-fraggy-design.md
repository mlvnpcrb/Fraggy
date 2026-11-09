# Fraggy — Emerald Atelier

Status: Direction selected; detailed design ready for review.

## Intent

Fraggy is a mobile app for fragrance collectors. Its signature is green and its experience should feel luxurious and expensive. Users photograph bottles for a digital shelf and exchange bottles locally or by shipping. There are no payments in the first version.

## Approaches

The user selected the recommended Emerald Atelier direction: evergreen, warm ivory, restrained champagne accents, and editorial typography. Midnight Conservatory offered dramatic dark screens at the cost of bottle visibility. Modern Heirloom offered warm ivory and walnut with a less prominent green identity.

Implementation recommendation: React Native with Expo and TypeScript for iPhone and Android. The next deliverable is an Expo Go prototype with local sample data. It is not a connected trading service.

## Foundations

- Brand evergreen: #123D31. Used for primary actions, selected navigation, and signature header areas.
- Canvas ivory: #F6F3EB. Main collection background, chosen to keep both dark and clear bottles visible.
- Ink: #18261F. Primary text on ivory.
- Muted ink: #56645B. Secondary information on light surfaces.
- Champagne: #B69A65. Decorative rules and small accents only; never small essential text on ivory.
- Surface: #FFFDF8. Forms and raised panels.
- Divider: #DEDCD2. Quiet separation on light surfaces.
- Error: #943E35. Always accompanied by a written explanation.
- Typography recommendation: Cormorant Garamond Medium for titles and fragrance names, paired with Manrope for controls and metadata. Use actual loaded font assets, not platform-dependent serif substitutes. Body text 16, metadata 13–14, screen titles 32–36. Support larger system text.
- Spacing uses 4, 8, 12, 16, 24, 32, and 48 units. Screen gutters 24. Buttons have at least 48 units of height and 44-unit touch targets.
- Shapes: 12-unit button radius, 16-unit panel radius, pill shapes only for compact filters. Avoid nested cards and excessive badges.
- Icons: consistent thin outline icons with text labels for navigation.

These detailed tokens and font choices are the builder's proposals, rather than separately agreed user requirements.

## Screen language

### My Shelf

An evergreen masthead carries the lowercase fraggy wordmark, a small collection count, and a clear Add bottle action. The main canvas is ivory. Bottle cutouts sit above fine architectural ledges, with generous breathing room and soft contact shadows. Names and remaining amounts sit below the bottles. Shelf rows adapt to screen width and larger text instead of shrinking text. All bottles and Open to swap filters use a quiet segmented control. Empty shelves explain how to add the first bottle.

### Add a Bottle

Use a clear sequence: choose or take photo, review cutout, confirm details, add to shelf. Keep the image large. Show a neutral preview background and an explicit adjustment or retake action. Ask users to confirm fragrance name, brand, bottle size, remaining amount, and trade availability; photo capture must not imply automatic identification. Processing, permission refusal, and removal failure need understandable states and retry choices.

In the Expo prototype, choose/take a photo using the system photo interface, preserve the original image locally, and clearly label background removal as a demonstration using a supplied sample cutout. Never label an unprocessed user photo as background removed. No photo is uploaded in this prototype.

### Discover

Use the same ivory canvas with large bottle images and concise fragrance information. Sample cards show collector, approximate location, remaining amount, and local/shipping availability. Give the list useful filters without making it resemble a discount marketplace. A bottle detail screen offers Propose swap with a bottle from the collector's own shelf.

### Trades

Present the offered and requested bottles with equal visual weight. Show delivery method, both acceptance states, and both receipt states as readable text. Evergreen denotes progress; champagne is decorative. Separate accepting a proposal from confirming receipt. Confirming receipt requires an explicit final confirmation to prevent accidental completion.

The proposed exchange transitions are Proposed → Accepted by both → Exchange in progress → Received by both → Complete. Both bottles are reserved after mutual acceptance. Neither transfers ownership until both receipt confirmations exist. In a connected version these transitions must be atomic and checked on the server; one bottle cannot be reserved for concurrent accepted trades. Changing an offer resets acceptance. A problem pauses completion and offers contact/support; no payment, escrow, or shipping guarantee is implied.

In the prototype, the other collector's actions are clearly marked simulation controls. Include local meetup and shipping examples. Shipping instructions/tracking and chat are illustrative. Completion updates the sample shelf; resetting the demo restores sample ownership.

## Navigation and motion

Four bottom tabs: My Shelf, Discover, Trades, Profile. Add bottle opens a dedicated flow. Use safe areas and native keyboard behavior. Avoid decorative phone frames in the real mobile prototype.

Transitions use restrained 180–260 ms fades and small translations. Adding a bottle may gently settle it onto a ledge. Respect reduced motion. Never animate indefinitely or hide progress behind decorative motion.

## Goals and acceptance

- The app reads as green and luxurious through typography, space, and bottle presentation.
- A collector can navigate the Expo Go prototype on an iPhone.
- A collector can add a locally selected photo and see it in the shelf without a false removal claim.
- The sample trade cannot complete from one participant's receipt alone.
- Both simulated confirmations complete a swap and update sample ownership.
- Essential labels remain readable, controls have adequate targets, and color never carries status alone.
- Loading, empty, permission-denied, and error states match the visual language.

## Non-goals and constraints

No payments, real chat, live users, production accounts, shipping integrations, authenticity verification, guaranteed photo recognition, or actual background removal service in this prototype. No live addresses or credentials in sample data. Local data is resettable and no durability across reinstalls is promised.

The production app will need authentication, storage, photo processing, database-backed trade locking, reporting/blocking, and an explicit policy for incomplete or disputed exchanges. Those are separate implementation decisions before live trading.

## Delivery

First produce this design specification, then an implementation plan after design approval, then the Expo prototype. Validate navigation, photo permission handling, and both-confirmation behavior. Provide an Expo Go QR/link using an accessible development connection; verify connectivity before claiming it is available. TestFlight and App Store distribution are outside this prototype.
