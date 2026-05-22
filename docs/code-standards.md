# Code Standards

_Last updated: 2026-05-22_

## Core Principles

- Keep changes minimal, coherent, and directly tied to user intent
- Apply YAGNI, KISS, and DRY
- Prefer updating existing modules over adding parallel versions
- Make behavior real; do not stub around missing logic

## Language and Module Conventions

- Use JavaScript ESM across app code
- Prefer `@/` imports for code under `src/`
- Keep file names in kebab-case or existing project conventions
- Avoid large multipurpose files when a focused module is practical

## Next.js Conventions

- Put user-facing pages in `src/app/`
- Put HTTP handlers in `src/app/api/**/route.js`
- Keep route handlers thin; move shared logic into `src/lib`, `src/sse`, or `open-sse`
- Use server code by default; add `"use client"` only where browser interactivity is required

## Persistence Conventions

- Treat `src/lib/db/*` as the canonical state layer
- Add schema changes through `src/lib/db/migrations/*` and keep `schema.js` aligned
- Prefer repository helpers in `src/lib/db/repos/*` over ad hoc SQL in route handlers
- Keep compatibility with runtime DB adapter fallback

## Provider and Routing Conventions

- Add provider metadata in `src/shared/constants/providers.js`
- Keep provider-specific execution details inside `open-sse/executors/*` or provider services
- Keep request/response translation in `open-sse/translator/*`
- Preserve client-facing compatibility contracts when changing `/v1/*` behavior

## UI Conventions

- Reuse shared components before introducing new primitives
- Use Tailwind utilities plus existing CSS variables from `src/app/globals.css`
- Preserve the current 9Router visual language unless a deliberate design change is requested
- Keep dashboard interactions direct and operational, not marketing-heavy

## State and Side Effects

- Keep Zustand stores focused on one concern
- Avoid duplicating persisted state in multiple stores
- Contain long-running process orchestration inside `src/shared/services` or `src/lib/*`

## Error Handling

- Fail with explicit messages on invalid config, missing credentials, and unsupported provider paths
- Do not swallow exceptions unless best-effort cleanup is the intent
- Keep user-facing API errors consistent and machine-readable where possible

## Documentation Rules

- Update `/docs` when architecture, behavior, deployment, or contracts change
- Prefer concise factual wording over aspirational copy
- If repo metadata is stale, treat implementation-backed docs as canonical until corrected
