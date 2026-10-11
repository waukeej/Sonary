# Sonary 0.1 — Security Update

## Existing installation

Back up an existing installation before applying missing migrations. Apply
`006_security.sql` followed by `007_registration_verification.sql` once, after
the baseline schema (migrations 001–005). For a fresh database, follow README.
Do not run the baseline schema against an existing database or reapply migrations.
Release packaging does not execute SQL. Migration 007 adds nullable
`email_verified_at` / `email_verified_address` columns
and separate pending-registration and rate-limit tables. Existing accounts retain
access with null verification metadata; their historical emails are not marked verified.
The existing requirements include pyotp, qrcode and Pillow; no new dependency is
needed for SMTP, which uses Python's standard library.

## SMTP configuration

Set the following values locally in `.env` or in the deployment environment.
Use `.env.example` as a reference, not as a replacement for an existing `.env`.

- `MAIL_HOST`: the provider's SMTP hostname.
- `MAIL_PORT`: SMTP port, normally 587 for STARTTLS or 465 for implicit TLS.
- `MAIL_FROM`: a sender address authorized by the provider.
- `MAIL_USERNAME`: SMTP login, if required.
- `MAIL_PASSWORD`: SMTP password or provider-issued application credential.
- `MAIL_USE_TLS`: `true` for STARTTLS.
- `MAIL_USE_SSL`: `true` for implicit TLS.
- `MAIL_TIMEOUT`: connection/socket timeout in seconds; default 10, allowed range
  greater than zero and at most 60.

Use `MAIL_USE_TLS=true` and `MAIL_USE_SSL=false` for STARTTLS, or
`MAIL_USE_TLS=false` and `MAIL_USE_SSL=true` for implicit TLS. Do not enable both.
TLS certificate verification is enabled. SMTP authentication without TLS is
refused. Boolean settings accept `true` / `false`.

SMTP settings are validated when sending, not during application startup.
Missing host/sender, invalid settings, authentication errors, connection errors
and recipient refusal result in a temporary mail-unavailable response, not a
fake success. The user sees “Не удалось отправить письмо. Попробуйте позже.”
The SMTP server must accept the message; acceptance does not guarantee inbox
delivery. OTPs, SMTP passwords and raw SMTP exception details are not logged or
returned by the API.

To connect a real provider later: obtain its SMTP settings, authorize the sender
(and configure domain DNS if required by that provider), populate the local
environment and restart the application. No source-code change is required.
Never commit `.env` or share real credentials. A VPS or custom domain is not
required for local SMTP use if the provider permits the chosen sender.

## Available security mechanisms

- Email OTP: cryptographically generated six-digit code with a ten-minute
  lifetime, one-time use, a sixty-second resend cooldown and account-level
  attempt limits. A successful resend replaces the previous challenge.
  A failed SMTP send does not replace an existing valid challenge or enable a
  method, and does not start a successful-delivery cooldown.
- TOTP: pyotp authenticator codes work without email. The secret is generated
  securely, and a pending secret becomes active only after code confirmation.
  QR generation is local. The existing provisioning issuer is unchanged.
- Recovery codes: one-time, account-bound codes stored only as keyed hashes.
  Consumption is atomic. The initial codes are shown once; Settings has no
  manual regeneration UI.
- Security Gate: password first, then the current primary factor (or recovery
  code) when 2FA is enabled. Settings state is protected server-side.
- Recent verification: a 120-second, session-bound server-validated grant.
  Security changes preserve only its remaining lifetime, not a fresh window.
  Logout clears the session; another account cannot use the grant.
- Login challenges withhold authentication until the required factor succeeds.
  Missing SMTP does not bypass an enabled email factor; recovery codes remain
  usable.

Five failed verifications lock security verification for fifteen minutes.
Raw email OTPs and recovery codes are not stored in PostgreSQL. TOTP secrets must
remain available to the verifier, so database and backup access must be restricted.
Keep `SECRET_KEY` secret and stable: it protects sessions and keyed code hashes.

Email codes are issued for ten minutes; access also requires a valid surrounding
security session. In Settings, expiry of the shorter recent-verification grant
requires identity confirmation again. TOTP setup and non-email challenges retain
their existing five-minute lifetime. Email resend cooldown, OTP expiry and recent
verification lifetime are independent. Switching tabs does not renew verification.

## Without SMTP

Ordinary password login for existing accounts without 2FA remains available.
Authenticator setup/sign-in, recovery-code use and non-email security management
work without SMTP. An account whose primary method is email must use a recovery
code if mail is unavailable.

Sending Email OTP, enabling email-based 2FA, confirming an email login with a
new mailed code, and completing new registrations require working SMTP.
No verified-email status is invented.

## Completion and deferred work

Before deploying 0.1, configure an SMTP provider in the deployment environment and
confirm delivery with a designated account. No real mail is sent during release
packaging. Production deployment additionally needs HTTPS and
`SESSION_COOKIE_SECURE=true`.

## Registration verification and shared auth controls

New registration is held outside `users` for up to 24 hours. Only a correct
registration-purpose OTP inserts an active account and records verification.
Passwords are hashed before pending storage; OTPs have purpose-bound keyed hashes.
The session holds only an opaque pending-registration token. Refresh resumes the
same pending registration. The user can return to correct the address.
Pending records do not reserve email addresses or usernames. Existing case-insensitive
UNIQUE indexes are checked again at the final insert, including concurrent registration.

Email codes expire after ten minutes. Successful sends have a sixty-second
cooldown; five incorrect guesses lock a pending registration for fifteen minutes.
Additional database-backed request limits apply per email and source IP, using
keyed hashes rather than raw IPs. Deployment must supply a trustworthy remote
address; untrusted forwarded headers are not used. Expired pending records and
rate-limit buckets are cleaned on subsequent registration requests.

All auth/security OTPs use one Jinja macro with one real input and six visual
slots, backed by `auth-inputs.js` / `auth-inputs.css`. Recovery codes use plain
text inputs. The same script adds accessible password visibility buttons without
storing password values. Registration and login use the existing auth card;
Settings retains its fixed shell.

Mandatory verification after changing an existing account's email and Connections
remain outside this update. `email_verified_address` identifies the address actually
verified; a historical timestamp alone must not be treated as proof for another address.
Telegram remains unavailable.
