# Let's Q: Android public-release path

This is the path from the current browser simulation to a Google Play release. The simulation is a product prototype, not yet an Android app or an installable release.

## 1. Build the real Android app first

- Keep the queuer flow account-free: QR code, randomly generated ticket access token, queue number, and user-chosen display/verification code.
- Give organizers authenticated access on their own device. Queuers must never be able to open organizer controls merely by switching a tab.
- Use a real-time backend with server-side authorization rules. A secret code alone must not grant read/write access to a ticket.
- Store only operational data: queue ID, ticket ID, queue number, secret-code verifier, status, timestamps, and optional short request. Do not collect name, phone number, email, contacts, or location.
- Delete optional requests immediately when the ticket is served or cancelled. Choose a short, documented deletion window for closed-ticket operational data.
- Make notifications optional. The first public version can simply omit waitlist notifications; this avoids collecting notification tokens before the core queue experience is proven.
- Use a clearly labelled, three-second direct or contextual opening sponsor each time the app launches, then only a small bottom banner in the free version. Do not add an ad-network SDK or advertising ID while the product promise is “no personal profile.”
- Offer one $1/month ad-free plan through Google Play Billing. It removes bottom banners from both Host and Queuer screens on the subscribed device and includes aggregate Host analytics; the opening sponsor remains for everyone under the current product rule.

## 2. Required release artifacts

- Android App Bundle (`.aab`), signed through Play App Signing.
- Unique package name, version code, version name, adaptive app icon, and a release keystore strategy.
- Public support contact and a hosted privacy-policy URL.
- Store-listing text, feature graphic, and phone screenshots that match the final app—not this prototype.
- A review QR code and simple instructions that let Google Play review the queuer and organizer flows.

Google Play requires new apps to use Android App Bundles and Play App Signing. [Android publishing guide](https://developer.android.com/studio/publish/), [upload guide](https://developer.android.com/studio/publish/upload-bundle)

## 3. Play policy and privacy gate

- Before upload, check the current target-SDK requirement. The currently published baseline is Android 15 / API 35 or higher for new Play submissions; verify it again on the day of upload because it changes. [Target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
- Publish a privacy policy both in Play Console and inside the app. It must name the developer, explain all data handling, sharing, security, retention, and deletion. [Google Play privacy policy rules](https://support.google.com/googleplay/android-developer/answer/17105854)
- Complete the Data Safety form from the actual final build, including every backend, crash-reporting library, analytics package, notification provider, and ad SDK. Google requires the disclosure even when collection comes from an SDK. [Data Safety requirements](https://support.google.com/googleplay/android-developer/answer/10787469)
- Complete the Ads and content-rating declarations accurately. If the target audience includes children, advertising requirements become stricter; do not launch to children without a dedicated policy review. [Content rating requirements](https://support.google.com/googleplay/android-developer/answer/9859655)

## 4. Test before public production

Test these flows on real Android devices, slow networks, and with the app reopened:

1. Scan valid, expired, and wrong-queue QR codes.
2. Join, duplicate code rejection, cancel, queue full, call next, present, skip, and no-show.
3. Two organizer devices and two queuer devices observing the same queue in real time.
4. Refresh/reinstall and ticket recovery using the safe ticket access mechanism.
5. Text scaling, TalkBack, keyboard use, colour contrast, and six-language support before advertising those languages.
6. The three-second opening sponsor is clearly labelled, has a declared destination, and does not mislead or block app controls beyond its stated duration. After it ends, the free-version sponsor banner stays at the bottom, is clearly labelled, never blocks a queue action, and opens only a declared destination.

For a new personal Play developer account, a closed test requires at least 12 opted-in testers for 14 continuous days before applying for production access. [Google Play testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465)

## 5. Recommended release order

1. Build the Android MVP with no ads and no notifications.
2. Run internal testing, then a private pilot with real event organizers.
3. Fix reliability and usability issues, then run the required closed test.
4. Add the clearly labelled opening sponsor, contextual bottom banners, and the single ad-free + analytics plan only after the queue flow is stable and disclosures are reviewed.
5. Submit the production release with real screenshots, privacy policy, Data Safety form, content rating, review QR code, and support contact.
