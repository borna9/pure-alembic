# Deployment guide — publishing Pure Alembic with free services

Cost summary, stated plainly:

| Target | Service | Cost |
|---|---|---|
| Web app | GitHub Pages | **$0** |
| Android APK (direct download) | GitHub Releases + Actions | **$0** |
| Backend (accounts, sync) | Supabase free tier | **$0** |
| Google Play listing | Google Play Console | $25 one-time (optional) |
| iOS App Store / TestFlight | Apple Developer Program | $99/year (optional — there is **no** fully free way to distribute a public iOS app) |

## 0. Publish the repository (one-time)

```bash
# from the pure-alembic directory
gh repo create pure-alembic --public --source . --push
# or create an empty public repo on github.com and:
git remote add origin git@github.com:<you>/pure-alembic.git
git push -u origin main
```

The repo ships with the AGPL-3.0 license and copyright notice already in place.

Then add the build-time variables (all public-safe) under **Settings → Secrets and variables → Actions → Variables**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` (any subset; missing ones just disable that feature). See [SETUP.md](SETUP.md) to obtain them.

## 1. Web — GitHub Pages ($0)

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the **Deploy web** workflow manually). The included [`deploy-web.yml`](../.github/workflows/deploy-web.yml) exports the static site and publishes it.
3. Your app is live at `https://<you>.github.io/pure-alembic/`.

Custom domain (still free with a domain you own): set it in the Pages settings and delete the `EXPO_BASE_URL` line from the workflow.

*Alternatives:* Netlify / Vercel / Cloudflare Pages free tiers also work: build command `npx expo export -p web`, output directory `dist`, no base URL needed.

## 2. Android — APK on GitHub Releases ($0)

1. (Recommended, once) Create a permanent signing key and store it as a secret so every release is signed with the same key:
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias androiddebugkey \
     -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000
   base64 -i release.keystore   # → repo secret ANDROID_KEYSTORE_BASE64
   ```
2. Tag a release:
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```
3. [`android-release.yml`](../.github/workflows/android-release.yml) builds the APK and attaches it to the GitHub Release. Users download it and enable "Install unknown apps" — no store, no fee.

Optional paid path: a Google Play listing costs $25 once; upload an `.aab` built with `cd android && ./gradlew bundleRelease`.

Also worth knowing: [F-Droid](https://f-droid.org/en/docs/Inclusion_How-To/) will build and distribute FOSS apps for free if you submit an inclusion request (AGPL qualifies).

## 3. iOS

**Free (personal / from source):** anyone with a Mac and Xcode can run the app on their own iPhone:
```bash
npm install
npx expo prebuild -p ios
npx expo run:ios --device
```
With a free Apple ID the app must be re-installed every 7 days (Apple's limit for free provisioning). This is the only $0 iOS option, and it is per-device — good for you and contributors, not for public distribution.

**Public distribution (requires the $99/yr [Apple Developer Program](https://developer.apple.com/programs/)):**
1. Enroll, then create an App ID `com.firststirrings.purealembic` and an app record in App Store Connect.
2. Enable **Sign in with Apple** for the App ID, create a Services ID, and configure the Apple provider in Supabase (SETUP.md §1.5) — App Store review requires Apple sign-in because Google/Microsoft sign-in are offered (ACC-2).
3. Build and submit — easiest with Expo's EAS (free tier includes a small monthly build quota; `npx eas build -p ios` then `npx eas submit -p ios`), or locally with Xcode: `npx expo prebuild -p ios`, open `ios/`, Archive → Distribute.
4. TestFlight (included) lets up to 10,000 testers install pre-release builds.

## 4. Backend — Supabase free tier

Covered in [SETUP.md](SETUP.md). Free-tier limits (500 MB database, 50k monthly active users, 500k edge-function calls) are far beyond a personal planning app's needs. The project pauses after a week of inactivity on the free tier; it resumes on first request.

## 5. Release checklist

- [ ] `npm test` and `npm run typecheck` green (CI enforces this)
- [ ] Supabase migration applied; edge functions deployed
- [ ] Repo variables set; web deploy workflow green; site loads
- [ ] Tag pushed; APK attached to the GitHub Release and installs
- [ ] README badges/links point at your live URLs
