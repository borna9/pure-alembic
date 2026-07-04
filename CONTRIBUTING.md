# Contributing to Pure Alembic

Thanks for your interest in contributing!

## Contributor License Agreement (CLA)

Pure Alembic is open source under AGPL-3.0-only, but the copyright and intellectual property are retained by a single owner (Borna <borna@firststirrings.com>). To keep ownership unified — which allows the project to relicense, dual-license, or enforce the license in the future — every contribution must be made under the following terms:

By submitting a pull request or patch, you agree that:

1. You are the sole author of the contribution and have the right to submit it.
2. You grant the project owner a perpetual, worldwide, non-exclusive, irrevocable, royalty-free license to use, reproduce, modify, sublicense, and relicense your contribution, including the right to distribute it under licenses other than the AGPL.
3. Your contribution is provided "as is", without warranties.

You retain copyright in your own contribution; you are granting the license above, not assigning ownership. If you cannot agree to these terms, please open an issue describing your proposed change instead of submitting code.

## Development

```bash
npm install
npm run web        # develop in the browser
npm test           # Jest unit tests
npm run typecheck  # TypeScript
```

## Guidelines

- The [SRS document](docs/) is the source of truth for behavior. Reference requirement IDs (e.g., FR-19a) in PR descriptions.
- Pure logic (scheduling, hours inference, recurrence, sync merge) lives in `src/logic` and `src/sync` and must stay free of React/React Native imports so it remains unit-testable.
- New behavior in `src/logic` needs unit tests (SRS §7).
- Platform-specific code is limited to integrations that require it (NFR-4).
