import { promises as fs } from "fs"
import path from "path"

import { Analysis } from "@domain/analysis"
import { Category, CategoryType } from "@domain/category"

import { AppPaths } from "../utils/app-paths"

/**
 * Cache entry for storing analyzed commit results
 */
interface CacheEntry {
  hash: string
  timestamp: number
  analysis: {
    category: string
    summary: string
    description: string
  }
}

/**
 * Service for caching analyzed commit results
 */
export class CacheService {
  private static readonly DEFAULT_TTL_DAYS = 30
  private static readonly CACHE_FILE_PREFIX = "commit-"
  
  private readonly cacheDir: string
  private readonly ttlMs: number
  private cacheEnabled: boolean = true

  constructor(
    baseDir: string = process.cwd(),
    ttlDays: number = CacheService.DEFAULT_TTL_DAYS
  ) {
    this.cacheDir = AppPaths.getCacheDir(baseDir)
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled
  }

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    if (!this.cacheEnabled) {
      return
    }

    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
    } catch (error) {
      console.warn("Failed to initialize cache directory:", error)
      this.cacheEnabled = false
    }
  }

  /**
   * Get cached analysis result for a commit hash
   */
  async get(commitHash: string): Promise<Analysis | null> {
    if (!this.cacheEnabled) {
      return null
    }

    try {
      const cacheFilePath = this.getCacheFilePath(commitHash)
      
      // Check if cache file exists
      const stat = await fs.stat(cacheFilePath)
      const now = Date.now()
      
      // Check if cache entry is expired
      if (now - stat.mtimeMs > this.ttlMs) {
        await this.delete(commitHash)
        return null
      }

      // Read and parse cache entry
      const cacheData = await fs.readFile(cacheFilePath, "utf-8")
      const entry: CacheEntry = JSON.parse(cacheData)

      // Verify hash matches
      if (entry.hash !== commitHash) {
        await this.delete(commitHash)
        return null
      }

      // Reconstruct Analysis object
      const category = Category.create(entry.analysis.category as CategoryType)
      return new Analysis(
        category,
        entry.analysis.summary,
        entry.analysis.description
      )
    } catch {
      // Cache miss or error - return null
      return null
    }
  }

  /**
   * Store analysis result in cache
   */
  async set(commitHash: string, analysis: Analysis): Promise<void> {
    if (!this.cacheEnabled) {
      return
    }

    try {
      await this.initialize()
      
      const entry: CacheEntry = {
        hash: commitHash,
        timestamp: Date.now(),
        analysis: {
          category: analysis.getCategory().getValue(),
          summary: analysis.getSummary(),
          description: analysis.getDescription(),
        },
      }

      const cacheFilePath = this.getCacheFilePath(commitHash)
      await fs.writeFile(cacheFilePath, JSON.stringify(entry, null, 2))
    } catch (error) {
      // Silent fail for cache writes
      console.warn(`Failed to cache analysis for ${commitHash}:`, error)
    }
  }

  /**
   * Delete cached entry for a commit hash
   */
  async delete(commitHash: string): Promise<void> {
    if (!this.cacheEnabled) {
      return
    }

    try {
      const cacheFilePath = this.getCacheFilePath(commitHash)
      await fs.unlink(cacheFilePath)
    } catch {
      // Silent fail for cache deletes
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (!this.cacheEnabled) {
      return
    }

    try {
      const files = await fs.readdir(this.cacheDir)
      const cacheFiles = files.filter(file => 
        file.startsWith(CacheService.CACHE_FILE_PREFIX)
      )
      
      await Promise.all(
        cacheFiles.map(file => 
          fs.unlink(path.join(this.cacheDir, file)).catch(() => {})
        )
      )
    } catch {
      // Silent fail for cache clear
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number
    totalSize: number
    oldestEntry: Date | null
    newestEntry: Date | null
  }> {
    if (!this.cacheEnabled) {
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      }
    }

    try {
      const files = await fs.readdir(this.cacheDir)
      const cacheFiles = files.filter(file => 
        file.startsWith(CacheService.CACHE_FILE_PREFIX)
      )

      let totalSize = 0
      let oldestTime = Number.MAX_SAFE_INTEGER
      let newestTime = 0

      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file)
        const stat = await fs.stat(filePath)
        totalSize += stat.size
        oldestTime = Math.min(oldestTime, stat.mtimeMs)
        newestTime = Math.max(newestTime, stat.mtimeMs)
      }

      return {
        totalEntries: cacheFiles.length,
        totalSize,
        oldestEntry: cacheFiles.length > 0 ? new Date(oldestTime) : null,
        newestEntry: cacheFiles.length > 0 ? new Date(newestTime) : null,
      }
    } catch {
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      }
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpired(): Promise<number> {
    if (!this.cacheEnabled) {
      return 0
    }

    try {
      const files = await fs.readdir(this.cacheDir)
      const cacheFiles = files.filter(file => 
        file.startsWith(CacheService.CACHE_FILE_PREFIX)
      )

      const now = Date.now()
      let cleanedCount = 0

      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file)
        try {
          const stat = await fs.stat(filePath)
          if (now - stat.mtimeMs > this.ttlMs) {
            await fs.unlink(filePath)
            cleanedCount++
          }
        } catch {
          // Skip files that can't be processed
        }
      }

      return cleanedCount
    } catch {
      return 0
    }
  }

  private getCacheFilePath(commitHash: string): string {
    return path.join(
      this.cacheDir,
      `${CacheService.CACHE_FILE_PREFIX}${commitHash}.json`
    )
  }
}