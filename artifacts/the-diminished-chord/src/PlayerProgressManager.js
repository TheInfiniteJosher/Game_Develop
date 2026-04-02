/**
 * PlayerProgressManager - Manages player progress synced with Supabase
 * 
 * Features:
 * - Track level completion, times, fragments
 * - Sync progress to Supabase for logged-in users
 * - Fall back to localStorage for guests
 * - World progress tracking
 */

import { supabase } from "./integrations/supabase/client.js"
import { AuthManager } from "./AuthManager.js"
import { WorldManager, parseLevelId, getLevelId, LEVEL_TYPES } from "./WorldManager.js"

// localStorage key for guest progress
const GUEST_PROGRESS_KEY = "diminished_chord_guest_progress"
const GUEST_WORLD_PROGRESS_KEY = "diminished_chord_guest_world_progress"

class PlayerProgressManagerClass {
  constructor() {
    this.levelProgress = new Map() // levelId -> progress data
    this.worldProgress = new Map() // worldNumber -> progress data
    this.isInitialized = false
    this.initPromise = null
    this.pendingSync = new Set() // Level IDs pending sync
    this.syncTimer = null
  }

  /**
   * Initialize the progress manager
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
      await this.loadFromSupabase()
    } else {
      this.loadFromLocalStorage()
    }

    // Listen for auth changes
    AuthManager.onAuthStateChange(async (event, session, user) => {
      if (event === 'SIGNED_IN' && user) {
        // Merge guest progress into user progress
        await this.mergeGuestProgress()
        await this.loadFromSupabase()
      } else if (event === 'SIGNED_OUT') {
        // Clear and reload from localStorage
        this.levelProgress.clear()
        this.worldProgress.clear()
        this.loadFromLocalStorage()
      }
    })

    // Set up periodic sync
    this.startSyncTimer()

    this.isInitialized = true
    console.log("[PlayerProgressManager] Initialized with", this.levelProgress.size, "levels")
  }

  /**
   * Load progress from Supabase
   */
  async loadFromSupabase() {
    const userId = AuthManager.getUserId()
    if (!userId) return

    try {
      // Load level progress
      const { data: levelData, error: levelError } = await supabase
        .from('player_progress')
        .select('*')
        .eq('user_id', userId)

      if (levelError) {
        console.warn("[PlayerProgressManager] Level progress load error:", levelError.message)
      } else if (levelData) {
        levelData.forEach(row => {
          // fragments_collected in DB represents best single-run count (not cumulative)
          // It may be stored as a number or array depending on when it was saved
          const fragmentsValue = row.fragments_collected
          const bestFragmentsCollected = typeof fragmentsValue === 'number' 
            ? fragmentsValue 
            : (Array.isArray(fragmentsValue) ? fragmentsValue.length : 0)
          
          this.levelProgress.set(row.level_id, {
            levelId: row.level_id,
            isCompleted: row.is_completed,
            completionCount: row.completion_count,
            bestTimeMs: row.best_time_ms,
            bestDeaths: row.best_deaths,
            fragmentsCollected: bestFragmentsCollected, // For backwards compatibility
            bestFragmentsCollected: bestFragmentsCollected, // Best single-run count
            totalFragments: row.total_fragments,
            allFragmentsCollected: row.all_fragments_collected,
            stars: row.stars,
            firstCompletedAt: row.first_completed_at,
            lastPlayedAt: row.last_played_at
          })
        })
      }

      // Load world progress
      const { data: worldData, error: worldError } = await supabase
        .from('world_progress')
        .select('*')
        .eq('user_id', userId)

      if (worldError) {
        console.warn("[PlayerProgressManager] World progress load error:", worldError.message)
      } else if (worldData) {
        worldData.forEach(row => {
          this.worldProgress.set(row.world_number, {
            worldNumber: row.world_number,
            isUnlocked: row.is_unlocked,
            bossDefeated: row.boss_defeated,
            demoTapeFound: row.demo_tape_found,
            levelsCompleted: row.levels_completed,
            bonusLevelsCompleted: row.bonus_levels_completed,
            unlockedAt: row.unlocked_at,
            bossDefeatedAt: row.boss_defeated_at
          })
        })
      }

      console.log("[PlayerProgressManager] Loaded from Supabase:", {
        levels: this.levelProgress.size,
        worlds: this.worldProgress.size
      })

      // Sync to WorldManager
      this.syncToWorldManager()
    } catch (e) {
      console.error("[PlayerProgressManager] Load error:", e)
    }
  }

  /**
   * Load progress from localStorage (for guests)
   */
  loadFromLocalStorage() {
    try {
      const levelData = localStorage.getItem(GUEST_PROGRESS_KEY)
      if (levelData) {
        const parsed = JSON.parse(levelData)
        Object.entries(parsed).forEach(([levelId, progress]) => {
          this.levelProgress.set(levelId, progress)
        })
      }

      const worldData = localStorage.getItem(GUEST_WORLD_PROGRESS_KEY)
      if (worldData) {
        const parsed = JSON.parse(worldData)
        Object.entries(parsed).forEach(([worldNum, progress]) => {
          this.worldProgress.set(parseInt(worldNum), progress)
        })
      }

      console.log("[PlayerProgressManager] Loaded from localStorage:", {
        levels: this.levelProgress.size,
        worlds: this.worldProgress.size
      })

      // Sync to WorldManager
      this.syncToWorldManager()
    } catch (e) {
      console.warn("[PlayerProgressManager] localStorage load error:", e)
    }
  }

  /**
   * Save progress to localStorage (for guests)
   */
  saveToLocalStorage() {
    try {
      const levelData = {}
      this.levelProgress.forEach((progress, levelId) => {
        levelData[levelId] = progress
      })
      localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(levelData))

      const worldData = {}
      this.worldProgress.forEach((progress, worldNum) => {
        worldData[worldNum] = progress
      })
      localStorage.setItem(GUEST_WORLD_PROGRESS_KEY, JSON.stringify(worldData))
    } catch (e) {
      console.warn("[PlayerProgressManager] localStorage save error:", e)
    }
  }

  /**
   * Sync progress data to WorldManager for runtime use
   */
  syncToWorldManager() {
    // Sync unlocked worlds
    this.worldProgress.forEach((progress, worldNum) => {
      if (progress.isUnlocked) {
        WorldManager.unlockWorld(worldNum)
      }
    })

    // Sync completed levels
    this.levelProgress.forEach((progress, levelId) => {
      if (progress.isCompleted) {
        WorldManager.completedLevels.add(levelId)
      }
    })

    WorldManager.saveProgress()
  }

  /**
   * Merge guest progress into user account when they log in
   */
  async mergeGuestProgress() {
    const userId = AuthManager.getUserId()
    if (!userId) return

    try {
      const guestLevelData = localStorage.getItem(GUEST_PROGRESS_KEY)
      if (!guestLevelData) return

      const guestProgress = JSON.parse(guestLevelData)
      
      for (const [levelId, progress] of Object.entries(guestProgress)) {
        if (progress.isCompleted) {
          // Check if user already has progress for this level
          const { data: existing } = await supabase
            .from('player_progress')
            .select('id, best_time_ms')
            .eq('user_id', userId)
            .eq('level_id', levelId)
            .single()

          if (existing) {
            // Only update if guest time is better
            if (progress.bestTimeMs && (!existing.best_time_ms || progress.bestTimeMs < existing.best_time_ms)) {
              await supabase
                .from('player_progress')
                .update({
                  best_time_ms: progress.bestTimeMs,
                  completion_count: supabase.sql`completion_count + 1`
                })
                .eq('id', existing.id)
            }
          } else {
            // Insert new progress
            await supabase
              .from('player_progress')
              .insert({
                user_id: userId,
                level_id: levelId,
                is_completed: progress.isCompleted,
                completion_count: progress.completionCount || 1,
                best_time_ms: progress.bestTimeMs,
                best_deaths: progress.bestDeaths,
                fragments_collected: progress.fragmentsCollected || [],
                total_fragments: progress.totalFragments || 0,
                all_fragments_collected: progress.allFragmentsCollected || false,
                stars: progress.stars || 0,
                first_completed_at: progress.firstCompletedAt
              })
          }
        }
      }

      // Clear guest progress after merge
      localStorage.removeItem(GUEST_PROGRESS_KEY)
      localStorage.removeItem(GUEST_WORLD_PROGRESS_KEY)
      
      console.log("[PlayerProgressManager] Merged guest progress")
    } catch (e) {
      console.error("[PlayerProgressManager] Merge error:", e)
    }
  }

  /**
   * Record level completion
   * @param {string} levelId 
   * @param {object} runData - { timeMs, deaths, fragmentsCollected }
   */
  async recordCompletion(levelId, runData = {}) {
    const existing = this.levelProgress.get(levelId) || {
      levelId,
      isCompleted: false,
      completionCount: 0,
      bestTimeMs: null,
      bestDeaths: null,
      fragmentsCollected: [],
      totalFragments: 0,
      allFragmentsCollected: false,
      stars: 0,
      firstCompletedAt: null,
      lastPlayedAt: null
    }

    const now = new Date().toISOString()
    const isFirstCompletion = !existing.isCompleted

    // Update progress
    existing.isCompleted = true
    existing.completionCount = (existing.completionCount || 0) + 1
    existing.lastPlayedAt = now

    if (isFirstCompletion) {
      existing.firstCompletedAt = now
    }

    // Update best time
    if (runData.timeMs !== undefined) {
      if (existing.bestTimeMs === null || runData.timeMs < existing.bestTimeMs) {
        existing.bestTimeMs = runData.timeMs
      }
    }

    // Update best deaths
    if (runData.deaths !== undefined) {
      if (existing.bestDeaths === null || runData.deaths < existing.bestDeaths) {
        existing.bestDeaths = runData.deaths
      }
    }

    // Update fragments - track BEST single-run collection count, not cumulative
    // The medal is earned by collecting all fragments in ONE playthrough
    if (runData.fragmentsCollected !== undefined) {
      const thisRunCount = typeof runData.fragmentsCollected === 'number' 
        ? runData.fragmentsCollected 
        : (Array.isArray(runData.fragmentsCollected) ? runData.fragmentsCollected.length : 0)
      const previousBestCount = existing.bestFragmentsCollected || 0
      
      // Track total fragments in level (from level data)
      existing.totalFragments = runData.totalFragments || existing.totalFragments || 0
      
      // Update best fragments collected if this run was better
      if (thisRunCount > previousBestCount) {
        existing.bestFragmentsCollected = thisRunCount
      }
      
      // allFragmentsCollected is true if player has EVER collected all in a single run
      if (thisRunCount >= existing.totalFragments && existing.totalFragments > 0) {
        existing.allFragmentsCollected = true
      }
      
      // Legacy support: also store fragmentsCollected for backwards compatibility
      // But now it represents "best in single run" not cumulative
      existing.fragmentsCollected = existing.bestFragmentsCollected
    }

    // Calculate stars (simplified logic)
    existing.stars = this.calculateStars(existing)

    // Save to local cache
    this.levelProgress.set(levelId, existing)

    // Update WorldManager
    WorldManager.completeLevel(levelId)

    // Sync to storage
    if (AuthManager.isLoggedIn()) {
      this.pendingSync.add(levelId)
    } else {
      this.saveToLocalStorage()
    }

    // Check for world unlocks
    await this.checkWorldUnlocks(levelId)

    console.log("[PlayerProgressManager] Recorded completion:", levelId, existing)
    return existing
  }

  /**
   * Calculate stars based on performance
   */
  calculateStars(progress) {
    let stars = 0
    
    // 1 star for completion
    if (progress.isCompleted) stars = 1
    
    // 2 stars for collecting all fragments
    if (progress.allFragmentsCollected) stars = 2
    
    // 3 stars for all fragments + good time (placeholder logic)
    if (progress.allFragmentsCollected && progress.bestDeaths !== null && progress.bestDeaths <= 3) {
      stars = 3
    }
    
    return stars
  }

  /**
   * Check and update world unlocks after level completion
   */
  async checkWorldUnlocks(levelId) {
    const parsed = parseLevelId(levelId)
    if (!parsed) return

    // Boss completion unlocks next world
    if (parsed.type === LEVEL_TYPES.BOSS && parsed.world < 15) {
      await this.unlockWorld(parsed.world + 1)
    }
  }

  /**
   * Unlock a world
   */
  async unlockWorld(worldNumber) {
    const existing = this.worldProgress.get(worldNumber) || {
      worldNumber,
      isUnlocked: false,
      bossDefeated: false,
      demoTapeFound: false,
      levelsCompleted: 0,
      bonusLevelsCompleted: 0,
      unlockedAt: null
    }

    if (existing.isUnlocked) return

    existing.isUnlocked = true
    existing.unlockedAt = new Date().toISOString()
    this.worldProgress.set(worldNumber, existing)

    // Update WorldManager
    WorldManager.unlockWorld(worldNumber)

    // Sync to storage
    if (AuthManager.isLoggedIn()) {
      await this.syncWorldProgress(worldNumber, existing)
    } else {
      this.saveToLocalStorage()
    }

    console.log("[PlayerProgressManager] Unlocked world:", worldNumber)
  }

  /**
   * Get progress for a specific level
   */
  getLevelProgress(levelId) {
    return this.levelProgress.get(levelId) || null
  }

  /**
   * Get progress for a specific world
   */
  getWorldProgress(worldNumber) {
    return this.worldProgress.get(worldNumber) || null
  }

  /**
   * Check if level is completed
   */
  isLevelCompleted(levelId) {
    const progress = this.levelProgress.get(levelId)
    return progress?.isCompleted || false
  }

  /**
   * Check if world is unlocked
   */
  isWorldUnlocked(worldNumber) {
    if (worldNumber === 1) return true // World 1 is always unlocked
    const progress = this.worldProgress.get(worldNumber)
    return progress?.isUnlocked || false
  }

  /**
   * Get total completion stats
   */
  getTotalStats() {
    let levelsCompleted = 0
    let totalStars = 0
    let totalFragments = 0

    this.levelProgress.forEach(progress => {
      if (progress.isCompleted) levelsCompleted++
      totalStars += progress.stars || 0
      totalFragments += progress.fragmentsCollected?.length || 0
    })

    return {
      levelsCompleted,
      totalLevels: 301,
      completionPercent: Math.round((levelsCompleted / 301) * 100),
      totalStars,
      maxStars: 903, // 301 * 3
      totalFragments
    }
  }

  /**
   * Start periodic sync timer
   */
  startSyncTimer() {
    this.syncTimer = setInterval(() => {
      this.syncPendingProgress()
    }, 5000) // Sync every 5 seconds
  }

  /**
   * Sync pending progress to Supabase
   */
  async syncPendingProgress() {
    if (!AuthManager.isLoggedIn() || this.pendingSync.size === 0) return

    const userId = AuthManager.getUserId()
    const toSync = Array.from(this.pendingSync)
    this.pendingSync.clear()

    for (const levelId of toSync) {
      const progress = this.levelProgress.get(levelId)
      if (!progress) continue

      try {
        // Store bestFragmentsCollected as the fragments_collected value
        // This represents best single-run count, not cumulative
        await supabase
          .from('player_progress')
          .upsert({
            user_id: userId,
            level_id: levelId,
            is_completed: progress.isCompleted,
            completion_count: progress.completionCount,
            best_time_ms: progress.bestTimeMs,
            best_deaths: progress.bestDeaths,
            fragments_collected: progress.bestFragmentsCollected || progress.fragmentsCollected || 0,
            total_fragments: progress.totalFragments,
            all_fragments_collected: progress.allFragmentsCollected,
            stars: progress.stars,
            first_completed_at: progress.firstCompletedAt,
            last_played_at: progress.lastPlayedAt
          }, { onConflict: 'user_id,level_id' })
      } catch (e) {
        // Re-add to pending if sync failed
        this.pendingSync.add(levelId)
        console.warn("[PlayerProgressManager] Sync failed for:", levelId, e)
      }
    }
  }

  /**
   * Sync world progress to Supabase
   */
  async syncWorldProgress(worldNumber, progress) {
    if (!AuthManager.isLoggedIn()) return

    const userId = AuthManager.getUserId()

    try {
      await supabase
        .from('world_progress')
        .upsert({
          user_id: userId,
          world_number: worldNumber,
          is_unlocked: progress.isUnlocked,
          boss_defeated: progress.bossDefeated,
          demo_tape_found: progress.demoTapeFound,
          levels_completed: progress.levelsCompleted,
          bonus_levels_completed: progress.bonusLevelsCompleted,
          unlocked_at: progress.unlockedAt,
          boss_defeated_at: progress.bossDefeatedAt
        }, { onConflict: 'user_id,world_number' })
    } catch (e) {
      console.warn("[PlayerProgressManager] World sync failed:", e)
    }
  }

  /**
   * Force immediate sync
   */
  async forceSync() {
    await this.syncPendingProgress()
  }

  /**
   * Reset all progress (dangerous!)
   */
  async resetAllProgress() {
    if (AuthManager.isLoggedIn()) {
      const userId = AuthManager.getUserId()
      
      // Delete from Supabase
      await supabase.from('player_progress').delete().eq('user_id', userId)
      await supabase.from('world_progress').delete().eq('user_id', userId)
      
      // Re-create world 1 as unlocked
      await supabase.from('world_progress').insert({
        user_id: userId,
        world_number: 1,
        is_unlocked: true,
        unlocked_at: new Date().toISOString()
      })
    }

    // Clear local data
    this.levelProgress.clear()
    this.worldProgress.clear()
    localStorage.removeItem(GUEST_PROGRESS_KEY)
    localStorage.removeItem(GUEST_WORLD_PROGRESS_KEY)

    // Reset WorldManager
    WorldManager.resetProgress()

    console.log("[PlayerProgressManager] All progress reset")
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }
}

// Singleton instance
export const PlayerProgressManager = new PlayerProgressManagerClass()

// Auto-initialize
PlayerProgressManager.initialize()
