# Google Play Data safety correction — 2026-08-11

## Status

**Submitted for Google Play review on 2026-08-11.**

The corrected Data safety questionnaire was saved and submitted from Publishing overview. Managed publishing was enabled at submission time.

The submitted disclosure includes:

### Data shared

- Approximate location — Analytics; Advertising or marketing; Fraud prevention, security, and compliance
- Diagnostics — Analytics; Advertising or marketing; Fraud prevention, security, and compliance
- App interactions — Analytics; Advertising or marketing; Fraud prevention, security, and compliance
- Device or other IDs — Analytics; Advertising or marketing; Fraud prevention, security, and compliance

### Data collected

- User IDs — Optional; App functionality; Account management
- Approximate location — Analytics; Advertising or marketing; Fraud prevention, security, and compliance
- Diagnostics — Analytics; Advertising or marketing; Fraud prevention, security, and compliance
- App interactions — Analytics; Advertising or marketing; Fraud prevention, security, and compliance
- Other user-generated content — Optional; App functionality
- Other actions — App functionality; Analytics
- Device or other IDs — Analytics; Advertising or marketing; Fraud prevention, security, and compliance

Data is declared encrypted in transit, and the existing data-deletion request URL remains supplied in the Play form.

## Why these disclosures are required

The Android build contains Google Mobile Ads SDK 25.4.0 and the app also sends queue data to the backend.

Google’s current SDK disclosure says the Mobile Ads SDK automatically collects and shares:

- IP address (which may be used to estimate approximate location)
- user/app interactions
- diagnostic information
- device/account identifiers, including advertising ID/app set ID when available

Google lists advertising/marketing, analytics, and fraud prevention/security/compliance as purposes for this SDK data. The SDK encrypts this data in transit.

## Let’s Q first-party/backend data

The app also transmits data off-device to operate queues:

- **Other user-generated content — App functionality:** Host event/booth/queue names, a Queuer’s required private secret code (stored only as a protected hash server-side), and the optional short service request.
- **User IDs — App functionality / account management:** a random Neon-backed Host device identifier and private bearer token are created only when a device uses Host features. Queuers do not create an account merely by opening or joining a queue.
- **App interactions / Other actions — App functionality and analytics:** queue joins, ticket state transitions, no-show handling, and optional anonymous ratings are processed to run the service and produce aggregate Host reports.

Queue data is transmitted over encrypted connections. The public privacy policy should stay aligned with the Play form.

Re-check the form whenever the ads SDK, analytics SDKs, authentication model, or backend data model changes.

Primary references:

- Google Mobile Ads Android Data disclosure: https://developers.google.com/admob/android/privacy/play-data-disclosure
- Google Play Data safety form guidance: https://support.google.com/googleplay/android-developer/answer/10787469
