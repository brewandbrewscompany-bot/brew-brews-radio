# Security Policy

## Reporting a security issue

Please do **not** open a public issue containing credentials, tokens, private URLs, personal information, security bypass details, or other sensitive information.

Use a private GitHub security report when available, or contact the repository owner privately.

If a credential or token is suspected to be exposed, treat it as compromised: revoke or rotate it first, then remove it from the current code and repository history as appropriate.

## Repository rules

- Never commit passwords, API keys, access tokens, private keys, service-account files, webhook secrets, or local `.env` files.
- Store runtime secrets in GitHub Actions Secrets or the platform-specific secret store.
- Public web code must not contain server-side credentials or internal-only collection logic.
- Internal automation, collection logic, discovery/recovery logic, and operational notes should live in private repositories.
- Changes to production automation should be tested before deployment and kept reversible.
