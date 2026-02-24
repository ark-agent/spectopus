# Contributing to spectopus

Thanks for wanting to make spectopus better. Here's how.

## Philosophy

Two non-negotiable principles guide every decision in this codebase:

**1. Zero runtime dependencies.** The core library ships with no required runtime dependencies — not lodash, not axios, not anything. Zod is an optional peer dependency; even it is not required. New adapters for Joi, Valibot, etc. should be optional subpath exports. If you're about to `npm install` something for a runtime use case, stop and ask whether it can be a peer dep or eliminated entirely.

**2. Colocation is the point.** Every API decision should reinforce the principle that documentation lives *with* the code that proves it correct. Resist any feature that encourages users to maintain a parallel representation of their types. If a feature makes it easier to copy your schema into a separate doc definition, it's probably wrong. If a feature makes the schema itself the doc, it's probably right.

## Getting Started

```bash
git clone https://github.com/spectopus/spectopus.git
cd spectopus
npm install
npm test       # run all tests
npm run dev    # watch mode
npm run typecheck
```

## Project Structure

```
src/
├── builder/       # Core fluent builders (SpecBuilder, OperationBuilder, etc.)
├── adapters/      # Optional schema adapters (zod, joi, valibot...)
├── llm/           # LLM output adapters (openai, anthropic, compact)
├── decorators/    # Class-based controller decorators
├── types/         # OpenAPI 3.1 TypeScript type definitions
└── utils/         # Merge, validate, etc.
tests/             # Vitest tests (colocated by concern)
examples/          # Runnable examples
```

## Tests

We use [Vitest](https://vitest.dev/). Every new feature needs tests.

```bash
npm test                # run once
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

Test files live in `tests/`. Name them `<concern>.test.ts`.

## Adding a New Schema Adapter

1. Create `src/adapters/<name>.ts`
2. Export a single function: `<name>ToOpenAPI(schema) → SchemaObject`
3. The adapter must have no required runtime deps beyond the peer dep it adapts
4. Add a `tests/<name>.test.ts` with thorough coverage of the schema type
5. Add the subpath export to `package.json` exports map
6. Document it in the README

Example structure:
```ts
// src/adapters/valibot.ts
export function valibotToOpenAPI(schema: ValibotSchema): SchemaObject {
  // ...
}
```

## Code Style

- TypeScript strict mode — no `any` unless genuinely unavoidable
- Prefer immutability (builders return new instances)
- JSDoc on every public API surface
- Clear, self-documenting names over abbreviations
- Comments explain *why*, code explains *what*

## Pull Requests

1. Fork and create a branch: `git checkout -b feature/my-feature`
2. Write your code and tests
3. Run `npm test` and `npm run typecheck` — both must pass
4. Write a clear PR description explaining the motivation
5. Link any related issues

## Releases

Maintainers handle releases. We follow semver strictly:
- `patch` — bug fixes, no API changes
- `minor` — new features, backward compatible
- `major` — breaking changes (rare, discussed first)

## Issues

Bug reports and feature requests welcome via GitHub Issues. For bugs, include:
- spectopus version
- Node.js version  
- Minimal reproduction case
- Expected vs actual behavior

## Questions?

Open a GitHub Discussion. We're friendly.
