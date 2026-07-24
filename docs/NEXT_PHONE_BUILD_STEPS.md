# Let’s Q: next phone-build steps

## What is already done

- Android project: `android/`
- iPhone/iPad project: `ios/`
- Shared web app used by both: `www/` (built from the root web files)
- App name: Let’s Q
- Provisional package ID: `app.letsq.queue` — confirm availability before any public store upload.

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

Create a Supabase account and a new project. Do not put any private payment or server keys in the app. Codex will then guide you through applying `supabase/schema.sql` and connecting only the public project URL and anonymous key.
