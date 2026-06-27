# Census Chat Agent — public demo

Live: https://krishnachaitanyakc.github.io/census-chat-agent-demo/

Static, client-side demo that runs the **real** agent logic (guardrails, planner,
conversation context — bundled from the source repo) against a census sample
(US + California, Texas, Florida, New York). It shows the interaction model,
guardrails (off-topic / unsafe / prompt-injection), multi-turn follow-ups,
unsupported-metric clarification, and graceful degradation.

The full server application — LLM-based natural-language planning, the Snowflake
SafeGraph dataset, the live US Census API, structured logging, and rate limiting —
is in the main private repository and deploys to Vercel/Render.

`app.js` is generated from `web/main.ts` in the main repo via esbuild.
