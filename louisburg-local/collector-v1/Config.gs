const LL_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1RTDm9bc53_KbttK2uxkW5kKwV3i0SMwMNSO0Tc8rfOo',
  TZ: 'America/Chicago',
  SHEETS: {
    ENDPOINTS: 'Source Endpoints',
    STATE: 'Collector State',
    LOG: 'Collector Log',
    VERIFY: 'Verification Queue',
    FEED: 'Hub Feed',
    SHERLOCK: 'Sherlock Notes'
  },

  // V1 remains conservative: DIRECT public sources only.
  ALLOWED_ACCESS_METHODS: ['DIRECT'],
  MAX_ENDPOINTS_PER_RUN: 20,
  LOCK_WAIT_MS: 5000,
  RETRY_COUNT: 2,
  RETRY_BASE_MS: 750,
  MAX_BODY_CHARS: 250000,
  USER_AGENT: 'LouisburgLocalCollector/1.1 (+public-source-monitor)',

  KEYWORDS: [
    'special', 'deal', 'sale', 'discount', 'today', 'tonight', 'tomorrow',
    'live music', 'music', 'event', 'register', 'registration', 'class',
    'opening', 'grand opening', 'closing', 'closed', 'closure', 'hours',
    'hiring', 'now hiring', 'fundraiser', 'festival', 'market', 'menu',
    'new product', 'launch', 'cancelled', 'canceled', 'postponed', 'delayed',
    'moved', 'weather', 'sold out', 'rescheduled'
  ],
  LOUISBURG_TERMS: [
    'louisburg', 'louisburg ks', 'louisburg, ks', 'louisburg kansas', '66053'
  ],

  HIGH_INTERVAL_HOURS: 6,
  MEDIUM_INTERVAL_HOURS: 24,
  LOW_INTERVAL_HOURS: 168,
  SOURCE_BOOST_DAYS: 7,

  // Sherlock-triggered rechecks are intentionally faster than normal scans.
  SHERLOCK_RECHECK_LIMIT_PER_RUN: 10,
  SHERLOCK_TRUST_OWNER_ORGANIZER: 90,
  SHERLOCK_TRUST_VERIFIED_COMMUNITY: 65,
  SHERLOCK_TRUST_ANONYMOUS: 25,

  // Retention guidance. Public UI must never expose submitter keys.
  RETENTION_DAYS_REJECTED_SHERLOCK: 30,
  RETENTION_DAYS_VALID_SHERLOCK: 180,
  RETENTION_DAYS_REACTION_KEYS: 90
});
