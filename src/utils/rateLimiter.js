/**
 * Rate limiter utility for Solana RPC requests
 * Prevents 429 errors by throttling requests
 */

export class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 1000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  async wait() {
    const now = Date.now();
    
    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    // If we've hit the limit, wait until we can make another request
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest) + 10; // Add 10ms buffer
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.wait(); // Recursively check again
      }
    }
    
    // Record this request
    this.requests.push(Date.now());
  }

  async execute(fn) {
    await this.wait();
    return fn();
  }
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter(8, 1000); // 8 requests per second
