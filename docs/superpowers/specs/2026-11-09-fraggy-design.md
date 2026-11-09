# Fraggy — Gen Z Luxury

Status: Approved direction — clean and cool, with playful moments.

**Collection/capture update:** The user's shelf correction supersedes the card layout and simulated background-removal scope below. See [the current shelf design](../../shelf-redesign.md): continuous cabinet shelves and real local CPU photo removal are implemented. Trading scope remains as described here.

## Intent

Fraggy is a mobile app for fragrance collectors. Its signature is green and its experience should feel luxurious and expensive. Users photograph bottles for a digital shelf and exchange bottles locally or by shipping. There are no payments in the first version.

## Approaches

The user refined the original Emerald Atelier recommendation toward Gen Z luxury and accepted the recommended clean-and-cool approach with playful moments. The direction combines a fashion editorial with the collectible appeal of a sneaker app. A louder, playful-everywhere alternative was considered; restraint better preserves the expensive feel. Traditional serif styling and champagne accents are replaced by bold sans-serif typography and selective lime accents.

Implementation recommendation: React Native with Expo and TypeScript for iPhone and Android. The next deliverable is an Expo Go prototype with local sample data. It is not a connected trading service.

## Foundations

- Brand racing green: #103D2B. Used for primary actions, selected navigation, and signature header areas.
- Canvas ivory: #F6F3EB. Main collection background, chosen to keep both dark and clear bottles visible.
- Ink: #18261F. Primary text on ivory.
- Muted ink: #56645B. Secondary information on light surfaces.
- Electric lime: #D5F66A. Used sparingly for the Add action, selected filters, and celebratory details. Use dark green text on lime; never lime body text on ivory.
- Surface: #FFFDF8. Forms and raised panels.
- Divider: #DEDCD2. Quiet separation on light surfaces.
- Error: #943E35. Always accompanied by a written explanation.
- Typography recommendation: Manrope ExtraBold for oversized headlines and the lowercase wordmark; Manrope Regular and Medium for names, controls, and metadata. Use actual loaded font assets. Body text 16, metadata 13–14, screen titles 36–40 with tight spacing. Support larger system text and wrapping rather than clipping.
- Spacing uses 4, 8, 12, 16, 24, 32, and 48 units. Screen gutters 24. Buttons have at least 48 units of height and 44-unit touch targets.
- Shapes: 12-unit button radius, 16-unit panel radius, pill shapes only for compact filters. Avoid nested cards and excessive badges.
- Icons: consistent medium-weight outline icons with text labels for navigation.

These detailed tokens and font choices are the builder's proposals, rather than separately agreed user requirements.

## Screen language

### My Shelf

A racing-green masthead carries the bold lowercase fraggy wordmark, the headline “Your scent rotation,” a small collection count, and a lime Add bottle action. The main canvas is ivory. Oversized bottle cutouts sit above subtle ledges, with generous breathing room, soft contact shadows, and occasional slight rotation for collectible energy. Names and remaining amounts sit below the bottles. Shelf rows adapt to screen width and larger text instead of shrinking text. All bottles and Open to swap filters use a compact segmented control. Empty shelves explain how to add the first bottle.

### Add a Bottle

Use a clear sequence: choose or take photo, review cutout, confirm details, add to shelf. Keep the image large. Show a neutral preview background and an explicit adjustment or retake action. Ask users to confirm fragrance name, brand, bottle size, remaining amount, and trade availability; photo capture must not imply automatic identification. Processing, permission refusal, and removal failure need understandable states and retry choices.

In the Expo prototype, choose/take a photo using the system photo interface, preserve the original image locally, and clearly label background removal as a demonstration using a supplied sample cutout. Never label an unprocessed user photo as background removed. No photo is uploaded in this prototype.

### Discover

Use the same ivory canvas with the headline “Find your next obsession,” large bottle images, and concise fragrance information. Sample cards show collector, approximate location, remaining amount, and local/shipping availability. Give the list useful filters without making it resemble a discount marketplace. A bottle detail screen offers Propose swap with a bottle from the collector's own shelf.

### Trades

Present the offered and requested bottles in a bold bottle-versus-bottle composition with equal visual weight. Show delivery method, both acceptance states, and both receipt states as readable text. Racing green denotes progress; lime highlights the next available action. Separate accepting a proposal from confirming receipt. Confirming receipt requires an explicit final confirmation to prevent accidental completion. Playful copy never replaces precise trade status.

The proposed exchange transitions are Proposed → Accepted by both → Exchange in progress → Received by both → Complete. Both bottles are reserved after mutual acceptance. Neither transfers ownership until both receipt confirmations exist. In a connected version these transitions must be atomic and checked on the server; one bottle cannot be reserved for concurrent accepted trades. Changing an offer resets acceptance. A problem pauses completion and offers contact/support; no payment, escrow, or shipping guarantee is implied.

In the prototype, the other collector's actions are clearly marked simulation controls. Include local meetup and shipping examples. Shipping instructions/tracking and chat are illustrative. Completion updates the sample shelf; resetting the demo restores sample ownership.

## Navigation and motion

Four bottom tabs: My Shelf, Discover, Trades, Profile. Add bottle opens a dedicated flow. Use safe areas and native keyboard behavior. Avoid decorative phone frames in the real mobile prototype.

Transitions use quick 160–220 ms fades and small translations. Adding a bottle may settle it onto a ledge with a brief spring and subtle haptic feedback. Respect reduced motion. Never animate indefinitely or hide progress behind decorative motion.

## Voice

Short, confident, conversational copy: “Your scent rotation,” “Shelf-worthy,” and “Find your next obsession.” Avoid forced slang, luxury cliches, excessive emojis, and childish gamification. Error messages and trade confirmations remain literal and clear.

## Goals and acceptance

- The app reads as green, Gen Z, and luxurious through bold typography, restraint, and collectible bottle presentation.
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
