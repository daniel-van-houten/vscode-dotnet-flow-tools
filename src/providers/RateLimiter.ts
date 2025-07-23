/**
 * Rate limiter for AI provider requests
 * Simple implementation without external dependencies
 */
export class RateLimiter {
  private running = 0;
  private maxConcurrency: number;
  private waitQueue: Array<() => void> = [];
  private static instance: RateLimiter;

  private constructor(concurrency: number = 2) {
    this.maxConcurrency = concurrency;
  }

  /**
   * Get singleton instance of rate limiter
   */
  static getInstance(concurrency: number = 2): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter(concurrency);
    }
    return RateLimiter.instance;
  }

  /**
   * Add a task to the rate-limited queue
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeTask = async (): Promise<void> => {
        if (this.running >= this.maxConcurrency) {
          return new Promise<void>((resolveWait) => {
            this.waitQueue.push(resolveWait);
          }).then(() => executeTask());
        }

        this.running++;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          if (this.waitQueue.length > 0) {
            const next = this.waitQueue.shift();
            next?.();
          }
        }
      };

      executeTask().catch(reject);
    });
  }

  /**
   * Get current queue size
   */
  get size(): number {
    return this.waitQueue.length;
  }

  /**
   * Get number of pending tasks
   */
  get pending(): number {
    return this.running;
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.waitQueue.forEach(resolve => resolve());
    this.waitQueue = [];
  }

  /**
   * Check if queue is idle
   */
  get isIdle(): boolean {
    return this.waitQueue.length === 0 && this.running === 0;
  }
}