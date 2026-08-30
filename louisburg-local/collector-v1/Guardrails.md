# Louisburg Local — Sherlock & Public Interaction Guardrails

## Product boundary
Sherlock Notes are factual correction/confirmation reports tied to a specific Louisburg Local feed item. They are not public comments, reviews, discussion threads, or social posts.

Reactions are limited to lightweight positive feedback such as Like and Heart. There are no public replies to reactions.

## Sherlock report types
- Cancelled / canceled
- Wrong date
- Wrong time
- Location changed
- Delayed / postponed / rescheduled
- Sold out / promotion ended
- Still happening / confirmed
- Other factual correction

## Public display rules
- A single unverified report never silently changes or removes a feed item.
- Pending reports may show a neutral status such as “Sherlock update being checked” when appropriate.
- Confirmed changes update the feed item and preserve the original source relationship.
- No submitter email, phone, device/session key, IP address, or other private identifier is shown publicly.
- No public reply threads, arguments, quote replies, follower counts, or social ranking.

## Moderation
Reject or quarantine:
- profanity or obscenity
- threats, harassment, insults, or personal attacks
- private/personal information
- unrelated politics or advocacy
- advertising/self-promotion unrelated to the feed item
- spam, repeated characters, duplicate flooding, bot-like behavior
- content unrelated to the specific event/deal/update
- unsupported accusations about people or businesses
- attempts to use Sherlock as a review/comment section

Automated moderation may reject obvious violations, but ambiguous factual reports should be held for verification rather than automatically published.

## Trust
Suggested starting trust weights:
- verified owner/organizer correction: 90
- verified community contributor with good history: 65
- anonymous/new contributor: 25

Trust increases only from historically accurate factual reports. Repeated false, abusive, or manipulated reports are throttled or blocked.

Owner/organizer status is not a social/business account. It is simply a faster verified correction path for the item they are responsible for.

## Verification
Sherlock can trigger an immediate source recheck. Verification should consider:
1. original organizer/business source
2. another reliable Louisburg source
3. matching independent Sherlock reports
4. verified owner/organizer correction

High-impact claims such as cancellation, relocation, or major time/date changes should not be auto-confirmed from one anonymous report.

## Reactions
- LIKE and HEART only for V1.
- One reaction of each type per pseudonymous session/user key per item.
- Duplicate/flood behavior is invalidated.
- Reaction identifiers are not public and are retained only as long as needed for abuse/duplicate control.

## Retention defaults
- rejected Sherlock submitter keys: 30 days
- valid Sherlock submitter keys: 180 days
- reaction session/duplicate keys: 90 days

The factual correction record and aggregate counts may remain after private/pseudonymous keys are cleared if needed for feed integrity and auditability.

## Release gate
Before public launch:
1. seed Collector State without publishing baseline content as new
2. run collector in staging for at least one full day
3. inspect Collector Log and Verification Queue
4. test cancellation, wrong time/date, weather delay, moved event, sold-out deal, multi-day event, deleted original post, and duplicate-source scenarios
5. confirm no private facility reservations or non-Louisburg content are surfaced
6. confirm public UI never exposes internal trust/session/moderation fields
