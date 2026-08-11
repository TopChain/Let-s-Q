# Google Play Data safety correction — 2026-08-11

The current Play listing must **not** say that Let’s Q collects no data. The Android build contains Google Mobile Ads SDK 25.4.0 and the app also sends queue data to the backend.

## Minimum disclosures required by Google Mobile Ads SDK 25.4.0

Google’s current SDK disclosure says the Mobile Ads SDK automatically collects and shares:

- IP address (which may be used to estimate approximate location)
- user/app interactions
- diagnostic information
- device/account identifiers, including advertising ID/app set ID when available

Google lists advertising/marketing, analytics, and fraud prevention/security/compliance as purposes for this SDK data. The SDK encrypts this data in transit.

In the Play Data safety taxonomy this means the form must at minimum account for:

- **Approximate location** when IP-derived location applies
- **App interactions**
- **Diagnostics**
- **Device or other IDs**

The app developer remains responsible for the final form answers and for any configuration-dependent exceptions.

## Let’s Q first-party/backend data

The app also transmits data off-device to operate queues. Review and disclose the following in the form as applicable:

- **Other user-generated content — App functionality:** Host event/booth/queue names, a Queuer’s required private secret code (stored only as a protected hash server-side), and the optional short service request. The optional request is optional; the queue/secret-code fields are part of core functionality.
- **User IDs — App functionality / account management:** a random anonymous Supabase Host account identifier is created only when a device uses Host features. Queuers do not create an Auth account merely by opening or joining a queue.
- **App interactions / Other actions — App functionality and analytics:** queue joins, ticket state transitions, no-show handling, and optional anonymous ratings are processed to run the service and produce aggregate Host reports.

Queue data is transmitted over encrypted connections. The public privacy policy describes the same behavior and should stay aligned with the Play form.

## Console action

In Google Play Console, open the Let’s Q **Data safety** form under App content and replace the current “no data collected/shared” declaration with answers that match the SDK and backend behavior above. Re-check the form whenever the ads SDK, analytics SDKs, authentication model, or backend data model changes.

Primary references:

- Google Mobile Ads Android Data disclosure: https://developers.google.com/admob/android/privacy/play-data-disclosure
- Google Play Data safety form guidance: https://support.google.com/googleplay/android-developer/answer/10787469
