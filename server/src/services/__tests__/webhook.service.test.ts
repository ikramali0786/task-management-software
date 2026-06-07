import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { signWebhookPayload, generateWebhookSecret } from '../webhook.service';
import { generateApiToken, hashToken, TOKEN_PREFIX } from '../../middleware/apiAuth.middleware';

describe('signWebhookPayload', () => {
  it('produces a stable HMAC-SHA256 hex matching the canonical algorithm', () => {
    const secret = 'whsec_test';
    const payload = '{"event":"ping"}';
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(signWebhookPayload(secret, payload)).toBe(expected);
  });

  it('changes when the payload changes (tamper detection)', () => {
    const secret = 'whsec_test';
    const a = signWebhookPayload(secret, '{"a":1}');
    const b = signWebhookPayload(secret, '{"a":2}');
    expect(a).not.toBe(b);
  });

  it('changes when the secret changes', () => {
    const payload = '{"a":1}';
    expect(signWebhookPayload('s1', payload)).not.toBe(signWebhookPayload('s2', payload));
  });
});

describe('generateWebhookSecret', () => {
  it('is prefixed and high-entropy', () => {
    const s = generateWebhookSecret();
    expect(s.startsWith('whsec_')).toBe(true);
    expect(s.length).toBeGreaterThan(20);
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });
});

describe('generateApiToken / hashToken', () => {
  it('returns a tf_-prefixed token, a matching hash, and display fragments', () => {
    const { token, prefix, last4, hash } = generateApiToken();
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(hash).toBe(hashToken(token));
    expect(token.startsWith(prefix)).toBe(true);
    expect(token.endsWith(last4)).toBe(true);
  });

  it('hash is deterministic and unique per token', () => {
    const t1 = generateApiToken();
    const t2 = generateApiToken();
    expect(t1.token).not.toBe(t2.token);
    expect(t1.hash).not.toBe(t2.hash);
    expect(hashToken(t1.token)).toBe(t1.hash);
  });
});
