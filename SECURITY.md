# Security Policy

## Goods practices to follow

⚠️You must never store credentials information into source code or config file in a GitHub repository

- Block sensitive data being pushed to GitHub by git-secrets or its likes as a git pre-commit hook
- Audit for slipped secrets with dedicated tools
- Use environment variables for secrets in CI/CD (e.g. GitHub Secrets) and secret managers in production

## Supported Versions

Only the latest released version of this project currently receives security updates.

| Version | Supported |
| ------- | --------- |
| Latest  | ✅        |
| Older versions | ❌ |

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

To report a vulnerability, use GitHub's private vulnerability reporting feature:

**Security → Report a vulnerability**

If private vulnerability reporting is unavailable, contact: security@opensource.thalesgroup.com

Please include, when possible:

- a description of the vulnerability;
- the affected version;
- steps to reproduce the issue;
- its potential impact;
- any suggested mitigation or fix.

Please allow the maintainers reasonable time to investigate and release a correction before publicly disclosing the vulnerability.

## Disclosure Process

The maintainers will:

1. acknowledge receipt of the report;
2. investigate and assess its severity;
3. prepare and test a correction when necessary;
4. coordinate disclosure with the reporter;
5. publish a security advisory when appropriate.

Thank you for helping keep this project and its users secure.
