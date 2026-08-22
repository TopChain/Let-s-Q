# Let’s Q: next phone-build steps

## What is already done

- Android project: `android/`
- iPhone/iPad project: `ios/`
- Shared web app used by both: `www/` (built from the root web files)
- App name: Let’s Q
- Store package/bundle ID: `app.letsq.queue`.

## One action needed on this Mac now

Xcode is installed, but Apple requires its licence to be accepted before the iPhone/iPad app can build.

1. Open **Terminal** from Applications → Utilities.
2. Paste: `sudo xcodebuild -license`
3. Enter your Mac password. Nothing appears while you type; that is normal.
4. Read/scroll to the end, then type `agree` when asked.
5. Return to Codex and say: **Xcode licence accepted.**

## Android preparation after that

Android needs Android Studio (which includes the Java and Android SDK tools). Install it from the official Android developer website, open it once, and finish its standard setup. Then tell Codex: **Android Studio is ready.**

## Before real queues can work across phones

Apply `neon/schema.sql`, `neon/legacy-schema.sql`, and the private legacy export to the existing Let’s Q Neon project, then configure `DATABASE_URL` and `RATE_LIMIT_SECRET` only in Netlify Functions. Do not put database or payment secrets in the app.
