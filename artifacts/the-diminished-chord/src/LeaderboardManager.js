/**
 * LeaderboardManager - Manages speed run leaderboards and ghost runs
 * 
 * Features:
 * - Submit speed run times
 * - Fetch leaderboards per level
 * - Ghost run recording and playback
 * - Personal best tracking
 */

import { supabase } from "./integrations/supabase/client.js"
import { AuthManager } from "./AuthManager.js"

class LeaderboardManagerClass {
  constructor() {
    this.leaderboardCache = new Map() // levelId -> leaderboard entries
    this.personalBests = new Map() // levelId -> personal best entry
    this.isInitialized = false
    this.initPromise = null
    this.cacheDuration = 60000 // Cache for 1 minute
    this.cacheTimestamps = new Map()
  }

  /**
   * Initialize the leaderboard manager
   */
  async initialize() {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  async _doInitialize() {
    await AuthManager.waitForReady()

    if (AuthManager.isLoggedIn()) {
      await this.loadPersonalBests()
    }

    // Listen for auth changes
    AuthManager.onAuthStateChange(async (event, session, user) => {
      if (event === 'SIGNED_IN' && user) {
        await this.loadPersonalBests()
      } else if (event === 'SIGNED_OUT') {
        this.personalBests.clear()
      }
    })

    this.isInitialized = true
    console.log("[LeaderboardManager] Initialized")
  }

  /**
   * Load user's personal bests for all levels
   */
  async loadPersonalBests() {
    const userId = AuthManager.getUserId()
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('user_id', userId)

      if (error) {
        console.warn("[LeaderboardManager] Load PBs error:", error.message)
        return
      }

      if (data) {
        // Group by level and find best time per level
        const bestByLevel = new Map()
        data.forEach(entry => {
          const existing = bestByLevel.get(entry.level_id)
          if (!existing || entry.time_ms < existing.time_ms) {
            bestByLevel.set(entry.level_id, entry)
          }
        })

        bestByLevel.forEach((entry, levelId) => {
          this.personalBests.set(levelId, {
            id: entry.id,
            levelId: entry.level_id,
            timeMs: entry.time_ms,
            deaths: entry.deaths,
            fragmentsCollected: entry.fragments_collected,
            achievedAt: entry.achieved_at,
            ghostRunId: entry.ghost_run_id
          })
        })

        console.log("[LeaderboardManager] Loaded", this.personalBests.size, "personal bests")
      }
    } catch (e) {
      console.error("[LeaderboardManager] Load PBs error:", e)
    }
  }

  /**
   * Submit a speed run time
   * @param {string} levelId 
   * @param {object} runData - { timeMs, deaths, fragmentsCollected, ghostData, allFragmentsCollected }
   * @param {number} levelVersion - Schema version of the level
   */
  async submitTime(levelId, runData, levelVersion = 1) {
    if (!AuthManager.isLoggedIn()) {
      return { 
        success: false, 
        error: "Login required to submit to leaderboard",
        isPersonalBest: false
      }
    }

    const userId = AuthManager.getUserId()
    
    // Determine run category based on whether all fragments were collected
    const runCategory = runData.allFragmentsCollected ? '100' : 'any'
    
    // Check PB for this specific category
    const pbKey = `${levelId}_${runCategory}`
    const existingPB = this.personalBests.get(pbKey)
    const isPersonalBest = !existingPB || runData.timeMs < existingPB.timeMs

    try {
      // Save ghost run if provided
      let ghostRunId = null
      if (runData.ghostData) {
        const ghostResult = await this.saveGhostRun(levelId, runData.timeMs, runData.ghostData, levelVersion)
        if (ghostResult.success) {
          ghostRunId = ghostResult.id
        }
      }

      // Insert leaderboard entry with category
      const { data, error } = await supabase
        .from('leaderboards')
        .insert({
          level_id: levelId,
          user_id: userId,
          time_ms: runData.timeMs,
          deaths: runData.deaths || 0,
          fragments_collected: runData.fragmentsCollected || 0,
          level_version: levelVersion,
          ghost_run_id: ghostRunId,
          run_category: runCategory,
          achieved_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message, isPersonalBest: false }
      }

      // Update personal best cache for this category
      if (isPersonalBest) {
        this.personalBests.set(pbKey, {
          id: data.id,
          levelId: data.level_id,
          timeMs: data.time_ms,
          deaths: data.deaths,
          fragmentsCollected: data.fragments_collected,
          achievedAt: data.achieved_at,
          ghostRunId: data.ghost_run_id,
          runCategory: runCategory
        })
      }

      // Invalidate leaderboard cache for both categories
      this.leaderboardCache.delete(`${levelId}_any`)
      this.leaderboardCache.delete(`${levelId}_100`)
      this.cacheTimestamps.delete(`${levelId}_any`)
      this.cacheTimestamps.delete(`${levelId}_100`)

      // Get rank for this category
      const rank = await this.getRank(levelId, runData.timeMs, runCategory)

      console.log("[LeaderboardManager] Submitted time:", {
        levelId,
        timeMs: runData.timeMs,
        runCategory,
        isPersonalBest,
        rank
      })

      return {
        success: true,
        isPersonalBest,
        rank,
        runCategory,
        entry: data
      }
    } catch (e) {
      console.error("[LeaderboardManager] Submit error:", e)
      return { success: false, error: e.message, isPersonalBest: false }
    }
  }

  /**
   * Get leaderboard for a level
   * @param {string} levelId 
   * @param {number} limit 
   * @param {string} category - 'any' for Any% (default), '100' for 100% runs
   */
  async getLeaderboard(levelId, limit = 100, category = 'any') {
    // Check cache with category-aware key
    const cacheKey = `${levelId}_${category}`
    const cached = this.leaderboardCache.get(cacheKey)
    const cacheTime = this.cacheTimestamps.get(cacheKey)
    
    if (cached && cacheTime && Date.now() - cacheTime < this.cacheDuration) {
      return cached.slice(0, limit)
    }

    try {
      const { data, error } = await supabase
        .from('leaderboard_with_rank')
        .select('*')
        .eq('level_id', levelId)
        .eq('run_category', category)
        .order('time_ms', { ascending: true })
        .limit(limit)

      if (error) {
        console.warn("[LeaderboardManager] Get leaderboard error:", error.message)
        return []
      }

      const entries = data.map(row => ({
        id: row.id,
        rank: row.rank,
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        timeMs: row.time_ms,
        deaths: row.deaths,
        fragmentsCollected: row.fragments_collected,
        achievedAt: row.achieved_at,
        isVerified: row.is_verified,
        ghostRunId: row.ghost_run_id,
        runCategory: row.run_category
      }))

      // Cache results
      this.leaderboardCache.set(cacheKey, entries)
      this.cacheTimestamps.set(cacheKey, Date.now())

      return entries
    } catch (e) {
      console.error("[LeaderboardManager] Get leaderboard error:", e)
      return []
    }
  }

  /**
   * Get top 3 times for both categories
   * @param {string} levelId 
   */
  async getTopTimesForBothCategories(levelId) {
    const [anyPercent, hundredPercent] = await Promise.all([
      this.getLeaderboard(levelId, 3, 'any'),
      this.getLeaderboard(levelId, 3, '100')
    ])
    
    return {
      any: anyPercent,
      hundred: hundredPercent
    }
  }

  /**
   * Get user's rank for a specific time
   * @param {string} levelId 
   * @param {number} timeMs 
   * @param {string} category - 'any' or '100'
   */
  async getRank(levelId, timeMs, category = 'any') {
    try {
      const { count, error } = await supabase
        .from('leaderboards')
        .select('*', { count: 'exact', head: true })
        .eq('level_id', levelId)
        .eq('run_category', category)
        .lt('time_ms', timeMs)

      if (error) return null
      return (count || 0) + 1
    } catch (e) {
      return null
    }
  }

  /**
   * Get personal best for a level
   */
  getPersonalBest(levelId) {
    return this.personalBests.get(levelId) || null
  }

  /**
   * Get top N times for a level
   */
  async getTopTimes(levelId, count = 10) {
    return this.getLeaderboard(levelId, count)
  }

  /**
   * Get times around user's rank
   */
  async getTimesAroundUser(levelId, range = 5) {
    const pb = this.getPersonalBest(levelId)
    if (!pb) return []

    const rank = await this.getRank(levelId, pb.timeMs)
    if (!rank) return []

    const start = Math.max(1, rank - range)
    const end = rank + range

    try {
      const { data, error } = await supabase
        .from('leaderboard_with_rank')
        .select('*')
        .eq('level_id', levelId)
        .gte('rank', start)
        .lte('rank', end)
        .order('time_ms', { ascending: true })

      if (error) return []

      return data.map(row => ({
        rank: row.rank,
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        timeMs: row.time_ms,
        isCurrentUser: row.user_id === AuthManager.getUserId()
      }))
    } catch (e) {
      return []
    }
  }

  // ==========================================
  // Ghost Run Management
  // ==========================================

  /**
   * Save a ghost run
   */
  async saveGhostRun(levelId, timeMs, ghostData, levelVersion = 1) {
    if (!AuthManager.isLoggedIn()) {
      return { success: false, error: "Login required" }
    }

    const userId = AuthManager.getUserId()
    const existingPB = this.personalBests.get(levelId)
    const isPersonalBest = !existingPB || timeMs < existingPB.timeMs

    try {
      const { data, error } = await supabase
        .from('ghost_runs')
        .insert({
          user_id: userId,
          level_id: levelId,
          time_ms: timeMs,
          input_data: ghostData.inputs,
          positions_data: ghostData.positions,
          level_version: levelVersion,
          is_personal_best: isPersonalBest
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      // If this is a new PB, mark old PB ghost as not personal best
      if (isPersonalBest && existingPB?.ghostRunId) {
        await supabase
          .from('ghost_runs')
          .update({ is_personal_best: false })
          .eq('id', existingPB.ghostRunId)
      }

      return { success: true, id: data.id }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Get ghost run by ID
   */
  async getGhostRun(ghostRunId) {
    try {
      const { data, error } = await supabase
        .from('ghost_runs')
        .select('*')
        .eq('id', ghostRunId)
        .single()

      if (error) return null

      return {
        id: data.id,
        userId: data.user_id,
        levelId: data.level_id,
        timeMs: data.time_ms,
        inputs: data.input_data,
        positions: data.positions_data,
        levelVersion: data.level_version,
        isPersonalBest: data.is_personal_best,
        isWorldRecord: data.is_world_record
      }
    } catch (e) {
      return null
    }
  }

  /**
   * Get world record ghost for a level
   */
  async getWorldRecordGhost(levelId) {
    try {
      // Get the top time's ghost run
      const leaderboard = await this.getLeaderboard(levelId, 1)
      if (leaderboard.length === 0 || !leaderboard[0].ghostRunId) {
        return null
      }

      return this.getGhostRun(leaderboard[0].ghostRunId)
    } catch (e) {
      return null
    }
  }

  /**
   * Get user's personal best ghost for a level
   */
  async getPersonalBestGhost(levelId) {
    const pb = this.getPersonalBest(levelId)
    if (!pb?.ghostRunId) return null

    return this.getGhostRun(pb.ghostRunId)
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get user's overall leaderboard stats
   */
  async getUserStats(userId = null) {
    const targetUserId = userId || AuthManager.getUserId()
    if (!targetUserId) return null

    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('id', targetUserId)
        .single()

      if (error) return null

      return {
        userId: data.id,
        username: data.username,
        displayName: data.display_name,
        role: data.role,
        totalPlaytimeSeconds: data.total_playtime_seconds,
        levelsCompleted: data.levels_completed,
        levelsCreated: data.levels_created,
        leaderboardEntries: data.leaderboard_entries,
        customLevelsPublished: data.custom_levels_published
      }
    } catch (e) {
      return null
    }
  }

  /**
   * Get global statistics
   */
  async getGlobalStats() {
    try {
      // Get total leaderboard entries
      const { count: totalEntries } = await supabase
        .from('leaderboards')
        .select('*', { count: 'exact', head: true })

      // Get unique players
      const { data: uniquePlayers } = await supabase
        .from('leaderboards')
        .select('user_id')
        .limit(10000)

      const uniquePlayerCount = new Set(uniquePlayers?.map(p => p.user_id) || []).size

      return {
        totalEntries: totalEntries || 0,
        uniquePlayers: uniquePlayerCount
      }
    } catch (e) {
      return { totalEntries: 0, uniquePlayers: 0 }
    }
  }

  // ==========================================
  // Utility
  // ==========================================

  /**
   * Format time in milliseconds to display string
   */
  formatTime(timeMs) {
    if (!timeMs) return "--:--.---"
    
    const minutes = Math.floor(timeMs / 60000)
    const seconds = Math.floor((timeMs % 60000) / 1000)
    const ms = timeMs % 1000

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  /**
   * Clear cache for a level
   */
  clearCache(levelId = null) {
    if (levelId) {
      this.leaderboardCache.delete(levelId)
      this.cacheTimestamps.delete(levelId)
    } else {
      this.leaderboardCache.clear()
      this.cacheTimestamps.clear()
    }
  }

  /**
   * Wait for initialization
   */
  async waitForReady() {
    if (this.isInitialized) return
    if (this.initPromise) await this.initPromise
  }
}

// Singleton instance
export const LeaderboardManager = new LeaderboardManagerClass()

// Auto-initialize
LeaderboardManager.initialize()
