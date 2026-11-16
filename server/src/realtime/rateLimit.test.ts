import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rateLimit.ts';

describe('rate limiter', () => {
    it('allows a burst and then closes the window', () => {
        const limiter = new RateLimiter(3, 1000);

        expect(limiter.allow('socket', 0)).toBe(true);
        expect(limiter.allow('socket', 10)).toBe(true);
        expect(limiter.allow('socket', 20)).toBe(true);
        expect(limiter.allow('socket', 30)).toBe(false);
        expect(limiter.allow('socket', 1100)).toBe(true);
        expect(limiter.allow('other', 30)).toBe(true);
    });
});
