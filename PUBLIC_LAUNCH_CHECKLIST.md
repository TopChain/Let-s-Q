# Let's Q public-launch checklist

## Product promise

- Queuers join with a queue number and a user-chosen secret code only.
- Do not require a name, phone number, email address, social login, or contact access.
- Show one clearly labelled, three-second opening sponsor screen each time the app opens. After it ends, the free version uses only a small bottom banner.
- Sell direct/contextual sponsorships; do not use behavioural advertising or advertising IDs.
- Offer one $1/month ad-free plan: remove bottom banners from both Host and Queuer screens on the subscribed device and include aggregate Host analytics. The opening sponsor still appears for everyone.

## Must be complete before a public release

- Use a real-time backend with secure access rules so tickets persist and cannot be read or edited by another queue.
- Generate a random ticket access token; do not rely on a short secret code alone as authorization.
- Rate-limit joins and secret-code attempts to prevent abuse without collecting identity.
- Delete optional notes immediately when a ticket is served or cancelled.
- Set and publish a short retention period for closed-ticket operational records.
- Make notifications strictly optional, with a useful in-app fallback if permission is declined.
- Publish a privacy policy that lists every backend, crash-reporting, analytics, notification, and advertising provider actually used.
- Complete the Apple privacy label and Google Play Data Safety declaration from the final implementation, not from assumptions.
- Test QR scanning, loss of connection, refresh/reopen, duplicate scans, cancellation, no-show flow, and full queues on real phones.
- Test English and every supported language with native speakers before listing that language publicly.
- Test with screen readers, text scaling, keyboard navigation, and poor network conditions.

## Suggested launch sequence

1. Private pilot: 3–10 organizers, no ads, one event category.
2. Fix observed reliability and queue-management issues.
3. Limited public release with a clearly labelled opening sponsor, direct/contextual bottom banners for free use, and the single ad-free + analytics plan only after the queue flow is stable.
4. Broader release after privacy, accessibility, and performance reviews pass.
