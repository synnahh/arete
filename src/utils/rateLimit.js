// ─── rateLimit.js — Token bucket rate limiter ─────────────────────────────────
// Protects API credentials from abuse if keys are ever extracted from the app.
// Each service gets its own bucket; calls that exceed the limit throw rather than
// silently succeed, so callers can surface a useful error to the user.

const _buckets = {};

function _getBucket(service, maxPerMinute) {
  if (!_buckets[service]) {
    _buckets[service] = {
      tokens:    maxPerMinute,
      max:       maxPerMinute,
      lastRefil: Date.now(),
    };
  }
  return _buckets[service];
}

function _refil(bucket) {
  const now     = Date.now();
  const elapsed = (now - bucket.lastRefil) / 60000; // fraction of a minute
  const added   = elapsed * bucket.max;
  bucket.tokens = Math.min(bucket.max, bucket.tokens + added);
  bucket.lastRefil = now;
}

/**
 * Consume one token for `service`. Throws if the rate limit is exceeded.
 * @param {string} service      - e.g. 'claude'
 * @param {number} maxPerMinute - max requests allowed per minute
 */
export function consumeToken(service, maxPerMinute) {
  const bucket = _getBucket(service, maxPerMinute);
  _refil(bucket);
  if (bucket.tokens < 1) {
    throw new Error(`Rate limit reached for ${service}. Please wait a moment.`);
  }
  bucket.tokens -= 1;
}

// Per-service convenience wrappers — call before each API request
export const rateLimitClaude      = () => consumeToken('claude',      10);
export const rateLimitFinnhub     = () => consumeToken('finnhub',     30);
