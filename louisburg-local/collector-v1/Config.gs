const LL_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1RTDm9bc53_KbttK2uxkW5kKwV3i0SMwMNSO0Tc8rfOo',
  TZ: 'America/Chicago',
  SHEETS: {
    ENDPOINTS: 'Source Endpoints', STATE: 'Collector State', LOG: 'Collector Log',
    VERIFY: 'Verification Queue', FEED: 'Hub Feed', SHERLOCK: 'Sherlock Notes'
  },
  ALLOWED_ACCESS_METHODS: ['DIRECT'],
  FORCE_SCAN_ACCESS_METHODS: ['DIRECT', 'SURFACE'],
  MAX_ENDPOINTS_PER_RUN: 20,
  FORCE_SCAN_MAX_ENDPOINTS: 100,
  LOCK_WAIT_MS: 5000,
  RETRY_COUNT: 2,
  RETRY_BASE_MS: 750,
  MAX_BODY_CHARS: 250000,
  USER_AGENT: 'LouisburgLocalCollector/2.1 (+public-activity-monitor)',

  KEYWORDS: [
    'daily special','special today','today only','tonight','tomorrow','this weekend','limited time',
    'deal','discount','coupon','promotion','on sale','sale ends','available now','sold out',
    'live music','concert','register now','registration open','workshop','grand opening','now open',
    'closing early','closed today','closure','now hiring','fundraiser','festival',
    'new product','new coffee','new drink','new menu','launch','release','freshly roasted',
    'cancelled','canceled','postponed','delayed','moved','rescheduled','tickets','sign up','signup'
  ],
  LOUISBURG_TERMS: ['louisburg','louisburg ks','louisburg, ks','louisburg kansas','66053'],
  BOILERPLATE_TERMS: ['privacy policy','all rights reserved','toggle navigation','skip to main content','pointer-events','font-size','background-color','artifactid','fingerprint','metasiteid','wixdevelopersanalytics','siteassetstestmoduleversion'],
  EVERGREEN_TERMS: ['office hours','directions & hours','contact us','our menu','about us','services','privacy policy','all rights reserved','we cater any event','fund raisers, open houses','weddings, birthdays, fundraisers','upcoming events for event announcements'],
  TESTIMONIAL_TERMS: ['testimonial','verified client','got married','our planner','everything was absolutely perfect','cancelled the rest after','canceled the rest after','five star','5 star','review'],
  NAVIGATION_TERMS: ['menu welcome','events promotions vendors','public calendar astronomical events','sign up for updates','follow us','view events','click here to begin','contact menu'],

  HIGH_INTERVAL_HOURS: 6,
  MEDIUM_INTERVAL_HOURS: 24,
  LOW_INTERVAL_HOURS: 168,
  SOURCE_BOOST_DAYS: 7,
  ACTIVITY_SNIPPET_BEFORE: 100,
  ACTIVITY_SNIPPET_AFTER: 220,
  ACTIVITY_MAX_SNIPPETS: 8,
  MIN_ACTIVITY_SCORE: 5,
  MAX_PAST_DAYS: 2,
  REQUIRE_DATE_FOR_GENERIC_ACTIVITY: true,

  SHERLOCK_RECHECK_LIMIT_PER_RUN: 10,
  SHERLOCK_TRUST_OWNER_ORGANIZER: 90,
  SHERLOCK_TRUST_VERIFIED_COMMUNITY: 65,
  SHERLOCK_TRUST_ANONYMOUS: 25,
  RETENTION_DAYS_REJECTED_SHERLOCK: 30,
  RETENTION_DAYS_VALID_SHERLOCK: 180,
  RETENTION_DAYS_REACTION_KEYS: 90
});
