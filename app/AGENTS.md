# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable product direction

- Selected visual direction: the first Product Design mock, “奶油云朵信箱”.
- Preserve the warm cream, muted peach, cocoa-brown, and small sage palette; hand-drawn watercolor/colored-pencil illustration style; rounded but adult-friendly UI; and generous whitespace.
- Product language should feel gentle and unhurried without making medical claims or looking childish.
- Registered visitors are clients by default. They never choose the admin role themselves. Admin access is server-controlled.
- In conversation views, administrators see only the generated anonymous alias, not the user's email or login identity.
- AI-assisted emotion observation is optional per conversation and requires an explicit, unchecked-by-default client choice.
- AI output is admin-only guidance: use tentative language, never diagnose, never auto-send replies, and always keep chat usable when AI is unavailable.
- Urgent AI safety signals require human review and should surface the school escalation path plus 12356 and emergency contacts.
- The local prototype uses browser storage for runnable cross-role demos. Keep auth and chat storage behind service modules so they can later move to Netlify Identity, Functions, and Database without rewriting the page UI.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
