# Sonary

Sonary is a music diary for personal audio recordings, impressions of music, and personal collections. Version **0.1 — Security Update** builds on the first public development release.

## Features

- Email-verified registration, login, and logout with password hashing, sessions, and CSRF protection.
- Optional authenticator (TOTP) and email OTP two-factor authentication, with one-time recovery codes.
- Password/factor Security Gate and a 120-second recent-verification window for security settings.
- Shared six-digit OTP controls, password visibility toggles, and localized authentication flows.
- MP3/WAV uploads with cover art, descriptions, entry dates, ratings, and predefined moods.
- A diary, entry calendar, profile, and activity heatmap.
- Regular playlists, Liked Tracks, and system mood playlists.
- Track and playlist privacy with protected delivery of user media.
- A shared audio player with play/pause, previous/next, seeking, volume control, and normalization.
- A playback queue with reordering, mobile gestures, and uninterrupted playback during navigation.
- Mood filtering and diary sorting by rating or duration.
- A responsive interface with RU/EN localization and System/Light/Dark themes.

Some elements intended for future functionality remain as placeholders. General settings (theme and language) and Security are available; Edit Profile is a separate interface. Telegram authentication, social login, moderation, password reset, and general notifications are not implemented.

## Tech Stack

Python 3.12+, Flask/Jinja, PostgreSQL (psycopg 3), Flask-WTF, HTML/CSS/JavaScript, Pillow, Mutagen, imageio-ffmpeg, pyotp, and qrcode. SMTP uses Python’s standard library. Bootstrap Icons and some client-side libraries are loaded from a CDN and therefore require network access.

## Installation

Python, PostgreSQL, and the `psql` client are required. A modern, supported PostgreSQL version is recommended. Python packages are listed in `requirements.txt`; the virtual environment is not included in the repository.

1. Clone your repository or extract the source archive, then open the project root.
2. Create a virtual environment:

```sh
python -m venv .venv
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Windows cmd:

```bat
.venv\Scripts\activate.bat
```

macOS/Linux (use `python3` if required):

```sh
source .venv/bin/activate
```

3. Install the dependencies:

```sh
python -m pip install -r requirements.txt
```

4. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` on macOS/Linux). Enter the values for your database. Generate a persistent random `SECRET_KEY`:

```sh
python -c "import secrets; print(secrets.token_hex(32))"
```

Store the result only in your local `.env` file. Do not publish it. Use `SESSION_COOKIE_SECURE=false` for local HTTP and `true` when using HTTPS.

Configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM`, and the provider’s credentials (`MAIL_USERNAME`, `MAIL_PASSWORD`) locally. Use STARTTLS (`MAIL_USE_TLS=true`, `MAIL_USE_SSL=false`) or implicit TLS (`MAIL_USE_TLS=false`, `MAIL_USE_SSL=true`), never both. `MAIL_TIMEOUT` defaults to 10 seconds. New registrations require successful email verification and therefore working SMTP. See [Security Update deployment notes](SECURITY_UPDATE.md) for configuration and failure behavior.

5. Configure PostgreSQL. Connect with `psql -U postgres` (or another available local administrator). Create a dedicated owner and a **new empty database**:

```sql
CREATE ROLE sonary LOGIN;
\password sonary
CREATE DATABASE sonary OWNER sonary;
\q
```

The `\password` command prompts for a password interactively. Enter the same password in `DB_PASSWORD` in your `.env` file. Apply the schema:

```sh
psql -h localhost -U sonary -d sonary -v ON_ERROR_STOP=1 -f schema.sql
psql -h localhost -U sonary -d sonary -v ON_ERROR_STOP=1 -f migrations/006_security.sql
psql -h localhost -U sonary -d sonary -v ON_ERROR_STOP=1 -f migrations/007_registration_verification.sql
```

`schema.sql` contains the baseline structure of five tables, including constraints and indexes, with **no data**. It initializes a new database; it is not an upgrade or reset tool for an existing database. It already includes the changes from `migrations/001–005`, so those migrations do not need to be reapplied to a fresh installation. The older migrations are retained for historical reference. Apply 006 and then 007 after the baseline, as shown above. The application creates system playlists for registered users.

For an **existing installation** already at migrations 001–005, back up the database and apply only missing migrations 006 and 007 in order. Do not run `schema.sql` against it. Migrations are not run automatically; do not reapply an already-applied migration. Existing accounts retain access, and their historical email addresses are not marked verified automatically. No database is modified as part of release packaging.

6. Start the application:

```sh
python app.py
```

Open http://127.0.0.1:5000. Create your own account; no predefined users or test password are provided. The Flask development server is not intended for public production deployments.

## FFmpeg

The code uses `imageio_ffmpeg.get_ffmpeg_exe()` for audio analysis and normalization to approximately −14 LUFS with peak limiting. Standard `imageio-ffmpeg` wheels for supported Windows/macOS/Linux platforms include FFmpeg, so a separate system installation is usually unnecessary. If no bundled binary is available for your platform, install FFmpeg and set `IMAGEIO_FFMPEG_EXE` as described in the imageio-ffmpeg documentation. This is an optional dependency setting, not a required Sonary configuration value.

## Storage and Privacy

User files are stored in `instance/avatars`, `instance/tracks/audio`, `instance/tracks/covers`, and `instance/playlists/covers`. Only empty directories with `.gitkeep` files are included; the application requires write access to them. The legacy `uploads/` directory is also empty and ignored by Git.

The repository does not contain user music files, accounts, or private data from the local development database. Users are responsible for having the necessary rights to uploaded materials. Bundled images and short interface sounds are located in `static/` and are not part of a user music collection.

## Project Structure

```text
Sonary/
├── app.py / config.py / database.py / permissions.py
├── auth/
├── diary/
├── main/
├── playlists/
├── profile_backend/
├── templates/
├── static/
├── instance/                  # runtime media, ignored
├── migrations/
├── models/                    # preserved legacy helpers
├── tests/
├── schema.sql
├── requirements.txt
├── requirements-dev.txt
├── requirements-tools.txt
├── .env.example
└── .github/
```

## Development Tools

Useful Python and Node tests are retained, but they were not run as part of release packaging. Python test dependencies are listed in `requirements-dev.txt`; use a separate disposable PostgreSQL database. Node tests use the built-in `node:test` module. This release does not claim that the entire inherited test suite passes.

`console.py`, `developer_console.py`, and `models/` are retained unchanged as separate tools and legacy prototypes; they are not required for `python app.py`. Optional desktop console dependencies are listed in `requirements-tools.txt`; the GUI requires Tk. The main frontend makes requests to a local debug console at `127.0.0.1:5001`. Do not expose the developer console to the internet. Console models may modify database data, so use them only with a separate development database.

## Project Status

Sonary is an early public **0.x** development release under active development. Version 0.1 includes the security and registration changes documented in [CHANGELOG.md](CHANGELOG.md). Future development plans do not imply that the corresponding features are already available; a public hosted deployment requires separate preparation.

## License

No license has been selected yet, and a LICENSE file was not added automatically. Before distributing the project, define the licensing terms for the code and verify the rights to all bundled graphic and audio materials.
