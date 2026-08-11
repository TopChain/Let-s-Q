# Let’s Q AdMob readiness

This checklist keeps advertising subordinate to the core Let’s Q queue experience.

## App identity

- Android package: `app.letsq.queue`
- AdMob application ID in Android manifest: `ca-app-pub-5866109338835517~7237643566`
- Publisher ID used by `app-ads.txt`: `pub-5866109338835517`
- Google Play developer website: `https://soft-bonbon-62fdc2.netlify.app/`
- Expected verification file: `https://soft-bonbon-62fdc2.netlify.app/app-ads.txt`

The repository already includes the required seller line:

```text
google.com, pub-5866109338835517, DIRECT, f08c47fec0942fa0
```

The web build copies `app-ads.txt` to the deployed root. `robots.txt` explicitly permits Google's ad verification crawlers.

## Before requesting another AdMob app review

1. **Google Play Data safety:** review and correct the current declaration. The installed Google Mobile Ads SDK transmits data used for ads, measurement, diagnostics, and fraud prevention; the store declaration must reflect the actual app and all included SDKs.
2. **Privacy policy:** deploy the current policy from this branch so the public policy accurately describes banner, app-open, post-rating interstitial, optional rewarded ads, and the paid ad-free subscription.
3. **app-ads.txt:** open the expected URL in an ordinary browser and confirm it returns only the authorized seller line. In AdMob, use the app-ads.txt page's “Check for updates”/verification action after the Play listing and website are current.
4. **Store link:** confirm the AdMob app is linked to the public Google Play listing for `app.letsq.queue`, not an unpublished entry or another package.
5. **Account verification:** confirm AdMob payment/account verification is complete. A new account can stay in “Getting ready” until account verification finishes.
6. **Policy Center:** if the app says “Needs attention,” open the exact issue under the AdMob Policy Center before requesting another review. The issue text is authoritative; do not repeatedly resubmit without fixing it.
7. **Real-device test:** development builds and emulators must use Google test ad units. Do not generate repeated live impressions/clicks while testing.

## Product rule for ads

Ad availability must never determine whether a person can scan, join, cancel, check status, or whether a Host can operate a queue. Ads should appear only at natural boundaries or through an explicit optional reward action.
