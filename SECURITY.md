# Security Policy

## Supported Versions

Acre is an early open-source release. Security fixes are expected to target the current `main` branch unless maintainers document release branches in the future.

## Reporting a Vulnerability

Please do not open a public issue with exploit details, credentials, tokens, private keys, or sensitive user data.

Preferred reporting path:

1. Use GitHub private vulnerability reporting if it is enabled for this repository.
2. If private reporting is not available, open a minimal public issue asking for maintainer contact without including exploit details.

Include enough information for the maintainer to understand scope and impact:

- affected area or route
- high-level description
- reproduction steps without real secrets
- impact assessment
- suggested fix, if known

## Secret Handling

- Never commit `.env`, `.env.local`, credentials, API keys, tokens, private keys, production database URLs, or private deployment paths.
- Use `.env.example` for safe placeholders only.
- Run `npm run scan:secrets` before sharing changes that touch configuration, scripts, or docs.

## Expectations

Maintainers will make a best effort to acknowledge valid reports, investigate impact, and publish fixes or guidance. Because this is an early open-source project, response times are not guaranteed.
