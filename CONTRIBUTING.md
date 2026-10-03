# Contributing

## Source of truth

TypeScript is the canonical source language for application and Convex code.
New implementation files must use `.ts` or `.tsx`. Existing JavaScript files
are compatibility leftovers and should be migrated to TypeScript before being
changed; do not create new `.js`/`.jsx` counterparts.

Generated files under `src/convex/_generated/` are committed Convex output and
must not be hand-edited.

## Verification

Run `bun install`, `bun run lint`, `bun run build`, and `bun run test:convex`
with a configured Convex deployment before opening a pull request.
