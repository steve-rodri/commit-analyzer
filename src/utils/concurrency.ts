/**
 * Utility for managing concurrent operations with semaphore-like behavior
 */
export class ConcurrencyManager {
  private running = 0
  private queue: (() => void)[] = []

  constructor(private readonly maxConcurrency: number) {}

  /**
   * Execute a function with concurrency control
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const runTask = async () => {
        this.running++
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.running--
          this.processQueue()
        }
      }

      if (this.running < this.maxConcurrency) {
        runTask()
      } else {
        this.queue.push(runTask)
      }
    })
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      const nextTask = this.queue.shift()!
      nextTask()
    }
  }
}

/**
 * Process items in parallel with controlled concurrency
 */
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  maxConcurrency: number = 5
): Promise<R[]> {
  const manager = new ConcurrencyManager(maxConcurrency)
  const promises = items.map((item, index) =>
    manager.execute(() => processor(item, index))
  )
  return Promise.all(promises)
}

/**
 * Process items in batches with parallel processing within each batch
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  batchSize: number = 10,
  maxConcurrencyPerBatch: number = 5
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processInParallel(
      batch,
      (item, batchIndex) => processor(item, i + batchIndex),
      maxConcurrencyPerBatch
    )
    results.push(...batchResults)
  }
  
  return results
}