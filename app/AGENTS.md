# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable product direction

- Selected visual direction: the first mock from the 2026-09-15 visual exploration, “云层传送门”. Recreate its cinematic luminous portal, floating letters, deep watercolor cloud world, and tactile bear/mailbox scene, then layer the working UI on refined frosted acrylic surfaces. This is a site-wide system, not a homepage-only treatment: public information, authentication, client dashboard, chat, and admin workbench must all retain the same cloud world, acrylic material, warm palette, and motion language, with calmer contrast on task-heavy screens.
- Preserve the warm cream, muted peach, cocoa-brown, and small sage palette; hand-drawn watercolor/colored-pencil illustration style; rounded but adult-friendly UI; and generous whitespace.
- Product language should feel gentle and unhurried without making medical claims or looking childish.
- Motion should create an immediate sense of entering a living cloud world while remaining calm: use deep pointer/scroll parallax, independently drifting letters and light motes, a slow cinematic background push, tactile acrylic hover feedback, unified easing, and viewer-relative chat motion; avoid abrupt jumps or playful excess, and always support reduced-motion preferences.
- Accessibility and reading comfort are part of the core product, not a separate theme. Keep a persistent reading-assistance menu with large text, enhanced contrast, and reduced motion; every route needs a keyboard skip link, one clear page-level heading, route-change focus/announcement, visible focus states, and chat transcripts exposed as labelled live logs. Preserve readable helper text and touch targets on mobile, while avoiding claims of full WCAG conformance without a dedicated audit.
- Mobile admin navigation should feel like one floating warm acrylic surface, with borderless icon-and-label tabs and a softly lifted peach active state; avoid dark outlined system-button styling.
- Message micro-actions such as quote reply and dismiss should explicitly remove browser-default borders, using soft peach icon surfaces and lightweight acrylic controls consistent with the mobile navigation.
- Registered visitors are clients by default. They never choose the admin role themselves. Admin access is server-controlled.
- In conversation views, administrators see only the generated anonymous alias, not the user's email or login identity.
- AI-assisted emotion observation is optional per conversation and requires an explicit, unchecked-by-default client choice.
- Clients must be able to see the exact AI analysis scope and consent state, withdraw consent at any time, and permanently delete their own conversation. Withdrawing consent deletes AI results but keeps the chat; permanent deletion covers messages, images, AI results, and administrator-only metadata. Administrators must never perform this deletion on a client's behalf.
- Closed conversations use a 90-day retention period, followed by scheduled deletion. Private image deletion must be retryable so a temporary blob-storage failure cannot silently orphan an uploaded image.
- AI output is admin-only guidance: use tentative language, never diagnose, never auto-send replies, and always keep chat usable when AI is unavailable.
- Keep the AI panel's first scan consistent: emotion cue, risk reminder, then recommended response. "Use suggestion" may only place text into the reply draft and must state that it will not send automatically.
- The administrator inbox should prioritize pinned conversations, then AI risk, unread client messages, and recency. Search, unread markers, pins, and organizer tags are administrator-only state and must never be shown to clients.
- Urgent AI safety signals require human review and should surface the school escalation path plus 12356 and emergency contacts.
- High-risk handling must use an explicit, auditable handoff flow: human review, direct safety check, connection to school support, optional trusted-person/emergency steps, and a final "handoff completed" state. Never label a case "risk resolved" or let AI complete steps automatically.
- The local prototype uses browser storage for runnable cross-role demos. Keep auth and chat storage behind service modules so they can later move to Netlify Identity, Functions, and Database without rewriting the page UI.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
