# iOS release status — 2026-08-11

## Core queue

The iOS bundle ID is `app.letsq.queue`. The shared web runtime can use the canonical Supabase backend once the production cutover gate is completed.

## Q Report monetization

The current native iOS project does **not** yet implement StoreKit billing or the Google Mobile Ads SDK. Therefore the production runtime must not simulate a $1 subscription purchase or a rewarded ad on iPhone.

Until native iOS monetization is implemented and configured in App Store Connect:

- Q Report remains available on native iOS at no charge.
- The fake web fallback subscription/ad buttons are hidden on native iOS by the production UI hardening layer.
- Android keeps its existing Google Play Billing / AdMob report monetization.

Before charging for Q Report on iOS, implement an Apple-compliant in-app purchase/subscription flow and restore the paid UI only after transaction verification works on device. Before showing AdMob on iOS, integrate the Google Mobile Ads SDK, consent handling, an iOS AdMob app/ad units, and the required `Info.plist` configuration.

## Privacy

The cutover branch adds `ios/App/App/PrivacyInfo.xcprivacy` and includes it in the Xcode app target. It declares the Let’s Q app’s own collection of anonymous Host user IDs, user-provided queue content, and product/queue interactions for app functionality and aggregate analytics. It declares no app-level tracking. Third-party SDK privacy manifests remain the responsibility of those SDK packages.

App Store Connect privacy answers must remain consistent with the privacy manifest, the public privacy policy, Supabase behavior, and any SDKs added later.

Primary references:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple privacy manifest requirements: https://developer.apple.com/support/third-party-SDK-requirements/
- Apple privacy manifest data collection: https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests
- Google Mobile Ads iOS setup: https://developers.google.com/admob/ios/quick-start
