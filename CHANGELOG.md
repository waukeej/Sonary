# Changelog

## 0.1 — Security Update

### Added

- TOTP authenticator and email OTP two-factor authentication, with primary-method selection.
- One-time recovery codes stored as keyed hashes and consumed atomically.
- Password/factor Security Gate with a session-bound, server-validated 120-second recent-verification grant.
- Email verification before account creation. Pending registrations expire after 24 hours.
- SMTP delivery through Python's standard library, with TLS validation and explicit delivery-failure handling.
- Shared six-digit OTP input, password visibility controls, resend feedback, and RU/EN security translations.
- Security settings within a fixed-size Settings shell.
- Migrations 006 (security methods, challenges, recovery codes) and 007 (verification metadata, pending registrations, rate limits).
- pyotp 2.9.0 and qrcode 8.2 dependencies.
- Focused security and registration-verification test files.

### Changed

- Enabled second factors must succeed before login establishes an authenticated session.
- Email OTPs expire after ten minutes; successful sends have a sixty-second resend cooldown.
- Failed verification attempts and registration requests are rate-limited.
- Final registration still handles case-insensitive username/email uniqueness races.
- Email changes are blocked while 2FA is enabled.
- Security state and sensitive actions require server-side verification.

### Upgrade notes

- Keep existing secrets and user media outside Git. Configure SMTP in the deployment environment.
- Apply only missing migrations 006–007 in order; do not reset the database or rerun the baseline schema.
- Existing accounts remain usable; historical email addresses are not automatically marked verified.
- New registration requires working SMTP. Existing password-only login and TOTP/recovery-code flows do not require mail delivery.
- Telegram authentication and mandatory verification after changing an existing account's email remain outside this release.

## Initial public release

- Personal music diary, playlists, moods, protected media, continuous player and queue.
- RU/EN localization and System/Light/Dark themes.
