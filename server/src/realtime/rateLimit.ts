/**
 * Small per-socket token window. It is not a security boundary against many
 * connections, but it stops one socket from hammering a handler.
 */
export class RateLimiter {
    private readonly hits = new Map<string, number[]>();

    constructor(
        private readonly limit: number,
        private readonly windowMs: number
    ) {}

    allow(key: string, now = Date.now()): boolean {
        const recent = (this.hits.get(key) ?? []).filter(
            timestamp => now - timestamp < this.windowMs
        );

        if (recent.length >= this.limit) {
            this.hits.set(key, recent);
            return false;
        }

        recent.push(now);
        this.hits.set(key, recent);
        return true;
    }
}
