# Pure Alembic

**A life reflection and planning tool (LRPT).** Plan your time weeks or months ahead, block time for what matters, and reflect on how your time was actually spent — on iOS, Android, and the web, from a single React Native codebase.

Copyright © 2026 Borna <borna@firststirrings.com>. All rights reserved.

Licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). You may use, study, share, and modify this software; if you distribute it or host a modified version as a service, you must publish your source under the same license. The copyright and all intellectual property in this project remain with the author.

## What it does

Pure Alembic implements a guided planning session (Screen 1 of the [SRS](docs/)) in five phases:

| Phase | What you enter |
|---|---|
| **Window** | Start and end date of the period you're planning |
| **A — Daily routines** | Tasks repeated every day of the window |
| **B — Known dates** | Tasks with fixed dates, due dates, or weekly/monthly recurrence |
| **C — Need to schedule** | Tasks with an earliest/latest date — the app spreads them evenly, highest priority first, without overloading any day |
| **D — Time blocking** | Time to block off, scheduled with the same algorithm |
| **E — Review & commit** | Review everything, then commit: dated tasks with hours become **calendar events**; daily routines and undated/zero-hour tasks become **reminders** (routines never flood the calendar) |

Supported services: Google Calendar, Outlook/Office 365 Calendar, iCloud Calendar, Apple Reminders, Microsoft To Do. The app is fully usable offline and without any connected service.

Screens 2–7 (item sync view and daily/weekly/monthly/cycle/annual reflections) are placeholders in this version, per SRS v0.4.

## Tech stack

- [Expo](https://expo.dev) / React Native + TypeScript, one codebase for iOS, Android, web
- [Supabase](https://supabase.com) for accounts (social sign-in) and cross-device sync
- Offline-first local store with field-level merge and a conflict-resolution UI
- OAuth 2.0 + PKCE for Google and Microsoft; EventKit on iOS; iCloud CalDAV elsewhere

## Getting started (development)

```bash
npm install
npm run web       # run in the browser
npm run ios       # iOS simulator (macOS + Xcode)
npm run android   # Android emulator
npm test          # unit tests (scheduling & hours-inference rules)
```

Cloud sync and calendar integrations require free credentials you create yourself — see [docs/SETUP.md](docs/SETUP.md). Deployment (web hosting, Android APK, iOS) is covered in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Known gaps (v0.1)

- Passkey sign-in (SRS ACC-2) is deferred: the backend platform does not yet support WebAuthn as a first-class sign-in method. Social sign-in (Google/Microsoft, plus Apple once an Apple Developer account is configured) is implemented.
- Sign in with Apple requires an Apple Developer account to enable; the code ships ready but disabled.
- On the web, OAuth tokens are kept in browser storage (there is no OS keychain on the web); on iOS/Android they live in the Keychain/Keystore per NFR-5.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Note that contributions require agreeing to the contributor license terms so the project's ownership remains unified.
