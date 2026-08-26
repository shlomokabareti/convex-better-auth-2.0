# Contributing

## Development Setup

- Node.js >= 18
- pnpm 10.25.0 (managed by `packageManager` in `package.json`)

```bash
pnpm install
```

## Common Commands

```bash
pnpm run check       # lint + format check
pnpm run typecheck   # TypeScript check
pnpm run build       # build all packages
pnpm run test        # run all tests
pnpm run fix         # auto-fix lint and format
```

## Pull Request Process

1. Open an issue to discuss large changes before writing code.
2. Branch from the latest `main`.
3. Keep changes focused and well-scoped.
4. Add or update tests for behavior changes.
5. Run the full proof suite: `pnpm run check && pnpm run typecheck && pnpm run build && pnpm run test`.
6. Squash or clean up commits so the history is easy to follow.
7. Open a pull request with a clear description and link any related issues.

## Code Style

- Use `unknown` and narrow instead of `any`.
- Do not disable lint or type checks with `eslint-disable`, `biome-ignore`, or `@ts-ignore`.
- Follow the existing package conventions and naming.
