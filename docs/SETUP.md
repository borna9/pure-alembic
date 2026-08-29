# Setup guide — backend & service credentials

Everything here is **free**. The app runs fully offline with zero setup; each section below unlocks one optional capability. All values you collect go into `.env` locally (copy `.env.example`) and into GitHub → repo → Settings → Secrets and variables → Actions → **Variables** for CI builds.

## 1. Supabase — accounts & cross-device sync

1. Create a free account at [supabase.com](https://supabase.com) and a new project (free tier).
2. In the project: **Settings → API** — copy the **Project URL** and **anon public key** into `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Apply the database schema: **SQL Editor → New query**, paste the contents of [`supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql), run it.
   (Or with the CLI: `npx supabase link --project-ref <ref> && npx supabase db push`.)
4. Deploy the edge functions (needs the [Supabase CLI](https://supabase.com/docs/guides/cli), free):
   ```bash
   npx supabase functions deploy delete-account
   npx supabase functions deploy caldav-proxy
   ```
5. Enable sign-in providers under **Authentication → Providers**:
   - **Google**: create an OAuth client (see §2 — you can reuse the same Google Cloud project; add the callback URL Supabase shows you, `https://<ref>.supabase.co/auth/v1/callback`).
   - **Azure (Microsoft)**: use the app registration from §3; add the same Supabase callback URL as a redirect URI.
   - **Apple**: requires an Apple Developer account ($99/yr) to create a Services ID — skip until you have one. Google/Microsoft sign-in works without it.

## 2. Google Calendar (OAuth, free)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project (free, no billing needed).
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** (now called the **Google Auth Platform**) → click **Get started** and complete the wizard: App information → **Audience: External** → Contact information → Create. Then, in the **Audience** section of the sidebar, add your own Google account under **Test users**; that is enough for personal use while the app is in "Testing". (Publishing to all users later requires Google's verification review — still free, just paperwork.)
4. **Clients → Create client** (or the classic **Credentials → Create credentials → OAuth client ID**):
   - Type **Web application** for the web build. Authorized redirect URIs: your deployed web origin (e.g. `https://<you>.github.io`) and `http://localhost:8081` for development.
   - For Android/iOS builds create additional Android/iOS client IDs with the package name `com.firststirrings.purealembic` (and the custom scheme redirect `purealembic:/oauth`).
5. Put the client ID in `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

## 3. Microsoft — Outlook Calendar & To Do (OAuth, free)

1. Go to [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID → App registrations → New registration** (a free personal Microsoft account works).
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
3. Redirect URIs (platform **Single-page application** for web, **Mobile and desktop** for native):
   - your web origin(s), e.g. `https://<you>.github.io` and `http://localhost:8081`
   - `purealembic:/oauth` for the mobile apps
4. **API permissions** → Microsoft Graph → Delegated → add `Calendars.ReadWrite`, `Tasks.ReadWrite`, `offline_access`.
5. Copy the **Application (client) ID** into `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`.

## 4. Apple

- **On iOS builds**, iCloud Calendar and Apple Reminders use the system EventKit permission dialog — nothing to configure.
- **On Android/web**, iCloud sync uses CalDAV: each user generates an app-specific password at [account.apple.com](https://account.apple.com) (Sign-In and Security → App-Specific Passwords) and enters it in the app under Settings → Calendar & Reminders. No developer registration needed.

## 5. Local development

```bash
cp .env.example .env    # fill in whatever you have; all optional
npm install
npm run web
```
