# Contributing

Thanks for your interest in Acre. This project is an early open-source real estate brokerage operations toolkit, so clear issues, focused pull requests, and documentation improvements are especially valuable.

## Ways to Contribute

- Fix bugs in existing workflows.
- Improve tests around permissions, transactions, listings, contacts, and office operations.
- Clarify setup, environment, and extension documentation.
- Improve UI consistency using existing `@acre/ui` primitives.
- Suggest workflow improvements through issues before starting large changes.

## Development Setup

```bash
git clone https://github.com/johnrebirth5-web/acre-office-warm-ui.git
cd acre-office-warm-ui
npm install
cp .env.example .env.local
npm run docker:dev:up
npm run dev
```

The local web app defaults to `http://localhost:3105`.

## Pull Request Guidelines

- Keep pull requests focused on one bug, feature, or documentation improvement.
- Avoid unrelated refactors.
- Do not change business logic, database schema, or application architecture unless the issue or PR explicitly calls for it.
- Do not commit `.env.local`, credentials, tokens, private deployment paths, local machine paths, or production-only operational notes.
- Update documentation when changing setup, scripts, public APIs, environment variables, permissions, or user-visible workflows.
- Add or update tests for changes that affect behavior.

## Validation

Run the most relevant checks before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run build
```

If you change database-related code, also consider:

```bash
npm run db:generate
npm run db:validate
```

If you change the Chrome extension:

```bash
npm run lint --workspace=@acre/extension
npm run build --workspace=@acre/extension
```

## Issue Guidelines

Bug reports should include:

- what happened
- what you expected
- steps to reproduce
- environment details
- screenshots or logs when helpful

Feature requests should explain:

- the workflow problem
- who needs it
- why existing behavior is not enough
- any constraints or edge cases

## Security

Do not include exploit details or secrets in public issues. See [SECURITY.md](SECURITY.md).
