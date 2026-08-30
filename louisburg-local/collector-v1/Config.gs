const LL_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1RTDm9bc53_KbttK2uxkW5kKwV3i0SMwMNSO0Tc8rfOo',
  TZ: 'America/Chicago',
  SHEETS: {
    ENDPOINTS: 'Source Endpoints',
    STATE: 'Collector State',
    LOG: 'Collector Log',
    VERIFY: 'Verification Queue',
    FEED: 'Hub Feed'
  },
  // V1 is intentionally conservative: DIRECT sources only.
  ALLOWED_ACCESS_METHODS: ['DIRECT'],
  REQUEST_TIMEOUT_MS: 20000,
  MAX_BODY_CHARS: 250000,
  USER_AGENT: 'LouisburgLocalCollector/1.0 (+public-source-monitor)',
  KEYWORDS: [
    'special', 'deal', 'sale', 'discount', 'today', 'tonight', 'tomorrow',
    'live music', 'music', 'event', 'register', 'registration', 'class',
    'opening', 'grand opening', 'closing', 'closed', 'closure', 'hours',
    'hiring', 'now hiring', 'fundraiser', 'festival', 'market', 'menu',
    'new product', 'launch', 'cancelled', 'canceled', 'postponed'
  ],
  LOUISBURG_TERMS: [
    'louisburg', 'louisburg ks', 'louisburg, ks', 'louisburg kansas',
    '66053'
  ],
  HIGH_INTERVAL_HOURS: 6,
  MEDIUM_INTERVAL_HOURS: 24,
  LOW_INTERVAL_HOURS: 168
});
