// Louisburg Local fair-rotation layer.
// Run AFTER relevance/rank scoring and BEFORE returning the public feed.
// It never deletes valid activity; it only changes primary-feed order.

function fairRotateFeed_(items) {
  const pool = (items || []).slice().sort(function(a,b) {
    return Number(b.rankScore || 0) - Number(a.rankScore || 0);
  });
  const out = [];
  const orgCounts = {};
  let lastCategory = '';

  while (pool.length) {
    const pos = out.length;
    let bestIndex = -1;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      const org = normalizeRotationKey_(item.organization);
      const category = normalizeRotationCategory_(item.category);
      const seen = orgCounts[org] || 0;
      const critical = isRotationOverride_(item);

      // Normal exposure guardrails:
      // first 8 cards -> normally one ordinary item per organization
      // first 20 cards -> normally two ordinary items per organization
      if (!critical && pos < 8 && seen >= 1) continue;
      if (!critical && pos < 20 && seen >= 2) continue;

      let adjusted = Number(item.rankScore || 0);

      // Repeated organizations remain eligible, but lose placement strength.
      if (!critical) adjusted -= seen * 22;

      // Prefer category variety when two candidates are otherwise close.
      if (!critical && lastCategory && category === lastCategory) adjusted -= 8;

      // Stable tie breaker keeps higher original rank ahead.
      adjusted -= i * 0.0001;

      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIndex = i;
      }
    }

    // If the caps temporarily block every remaining item, relax them rather
    // than hiding valid Louisburg activity.
    if (bestIndex < 0) bestIndex = 0;

    const chosen = pool.splice(bestIndex,1)[0];
    const chosenOrg = normalizeRotationKey_(chosen.organization);
    orgCounts[chosenOrg] = (orgCounts[chosenOrg] || 0) + 1;
    lastCategory = normalizeRotationCategory_(chosen.category);
    out.push(chosen);
  }

  return out;
}

function normalizeRotationKey_(value) {
  return String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function normalizeRotationCategory_(value) {
  const raw = String(value || '').toLowerCase();
  if (/food|dining|coffee|drink|restaurant/.test(raw)) return 'food-drink';
  if (/music|entertain/.test(raw)) return 'music-entertainment';
  if (/shop|sale|promotion|deal|product/.test(raw)) return 'shopping-promotions';
  if (/sport|soccer|football|athletic/.test(raw)) return 'sports';
  if (/kid|family|school|youth/.test(raw)) return 'family-youth';
  if (/city|public|community|notice/.test(raw)) return 'community';
  if (/event|festival/.test(raw)) return 'events';
  return raw || 'other';
}

function isRotationOverride_(item) {
  const text = [item.category,item.headline,item.summary,item.lifecycleState,item.activityType]
    .join(' ').toLowerCase();
  return /emergency|closure|closed|cancelled|canceled|weather|safety|critical|major schedule change|urgent/.test(text);
}
