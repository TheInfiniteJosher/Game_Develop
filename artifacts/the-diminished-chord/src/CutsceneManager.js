/**
 * CutsceneManager - Manages cutscenes loaded from Supabase
 * 
 * Features:
 * - Loads cutscene data from Supabase (cutscenes, cutscene_shots, cutscene_dialogue tables)
 * - Tracks which cutscenes have been watched (local storage)
 * - Provides first-time watch detection for auto-play on world entry
 * - Supports replaying cutscenes from world select and gallery
 */

import { supabase } from "./integrations/supabase/client.js"

// Cutscene types matching database enum
export const CUTSCENE_TYPES = {
  INTRO: "intro",
  WORLD_INTRO: "world_intro",
  POST_BOSS: "post_boss",
  END_OF_ACT: "end_of_act",
  EPILOGUE: "epilogue",
  BONUS_UNLOCK: "bonus_unlock",
  SPECIAL: "special"
}

// Fallback cutscene definitions (used if database unavailable)
const FALLBACK_CUTSCENES = {
  game_intro: {
    id: "game_intro",
    cutscene_key: "game_intro",
    cutscene_type: "intro",
    title: "The Beginning",
    description: "The story begins... Teddy sets off on his journey to become a music legend",
    estimated_duration_seconds: 60,
    is_skippable: false
  }
}

/**
 * CutsceneManager class - Singleton for managing cutscene data and progress
 */
class CutsceneManagerClass {
  constructor() {
    this.watchedCutscenes = new Set()
    this.cutsceneCache = new Map() // Cache loaded cutscenes
    this.shotsCache = new Map() // Cache cutscene shots
    this.dialogueCache = new Map() // Cache cutscene dialogue
    this.isLoaded = false
    this.loadProgress()
  }

  // ============ Local Progress Management ============

  loadProgress() {
    try {
      const saved = localStorage.getItem("diminished_chord_cutscene_progress")
      if (saved) {
        const data = JSON.parse(saved)
        this.watchedCutscenes = new Set(data.watchedCutscenes || [])
      }
    } catch (e) {
      console.error("[CutsceneManager] Failed to load progress:", e)
    }
  }

  saveProgress() {
    try {
      const data = {
        watchedCutscenes: Array.from(this.watchedCutscenes)
      }
      localStorage.setItem("diminished_chord_cutscene_progress", JSON.stringify(data))
    } catch (e) {
      console.error("[CutsceneManager] Failed to save progress:", e)
    }
  }

  // ============ Supabase Data Loading ============

  /**
   * Load all cutscenes from Supabase
   */
  async loadAllCutscenes() {
    try {
      const { data, error } = await supabase
        .from("cutscenes")
        .select("*")
        .order("sort_order", { ascending: true })

      if (error) throw error

      // Cache cutscenes by key
      this.cutsceneCache.clear()
      for (const cutscene of data || []) {
        this.cutsceneCache.set(cutscene.cutscene_key, cutscene)
      }

      this.isLoaded = true
      console.log(`[CutsceneManager] Loaded ${this.cutsceneCache.size} cutscenes`)
      return data

    } catch (e) {
      console.error("[CutsceneManager] Failed to load cutscenes:", e)
      return []
    }
  }

  /**
   * Load shots for a specific cutscene
   */
  async loadCutsceneShots(cutsceneId) {
    // Check cache first
    if (this.shotsCache.has(cutsceneId)) {
      return this.shotsCache.get(cutsceneId)
    }

    try {
      const { data, error } = await supabase
        .from("cutscene_shots")
        .select("*")
        .eq("cutscene_id", cutsceneId)
        .order("shot_order", { ascending: true })

      if (error) throw error

      this.shotsCache.set(cutsceneId, data || [])
      return data || []

    } catch (e) {
      console.error("[CutsceneManager] Failed to load shots:", e)
      return []
    }
  }

  /**
   * Load dialogue for a specific shot
   */
  async loadShotDialogue(shotId) {
    // Check cache first
    if (this.dialogueCache.has(shotId)) {
      return this.dialogueCache.get(shotId)
    }

    try {
      const { data, error } = await supabase
        .from("cutscene_dialogue")
        .select("*")
        .eq("shot_id", shotId)
        .order("dialogue_order", { ascending: true })

      if (error) throw error

      this.dialogueCache.set(shotId, data || [])
      return data || []

    } catch (e) {
      console.error("[CutsceneManager] Failed to load dialogue:", e)
      return []
    }
  }

  /**
   * Load complete cutscene with all shots and dialogue
   */
  async loadCompleteCutscene(cutsceneKey) {
    // Ensure cutscenes are loaded
    if (!this.isLoaded) {
      await this.loadAllCutscenes()
    }

    const cutscene = this.cutsceneCache.get(cutsceneKey)
    if (!cutscene) {
      console.warn(`[CutsceneManager] Cutscene not found: ${cutsceneKey}`)
      return null
    }

    // Load shots
    const shots = await this.loadCutsceneShots(cutscene.id)

    // Load dialogue for each shot
    const shotsWithDialogue = await Promise.all(
      shots.map(async (shot) => {
        const dialogue = await this.loadShotDialogue(shot.id)
        return { ...shot, dialogue }
      })
    )

    return {
      ...cutscene,
      shots: shotsWithDialogue
    }
  }

  // ============ Cutscene Queries ============

  /**
   * Get cutscene by key (from cache or fallback)
   */
  getCutscene(cutsceneKey) {
    if (this.cutsceneCache.has(cutsceneKey)) {
      return this.cutsceneCache.get(cutsceneKey)
    }
    return FALLBACK_CUTSCENES[cutsceneKey] || null
  }

  /**
   * Get world intro cutscene
   */
  getWorldIntroCutscene(worldNum) {
    const key = `world_${worldNum}_intro`
    return this.getCutscene(key)
  }

  /**
   * Get post-boss cutscene
   */
  getPostBossCutscene(worldNum) {
    const key = `world_${worldNum}_post_boss`
    return this.getCutscene(key)
  }

  /**
   * Get end of act cutscene
   */
  getEndOfActCutscene(actNum) {
    const key = `act_${actNum}_end`
    return this.getCutscene(key)
  }

  /**
   * Get all cutscenes of a specific type
   */
  getCutscenesByType(type) {
    const results = []
    for (const cutscene of this.cutsceneCache.values()) {
      if (cutscene.cutscene_type === type) {
        results.push({
          ...cutscene,
          isWatched: this.watchedCutscenes.has(cutscene.cutscene_key),
          isPublished: cutscene.is_published
        })
      }
    }
    return results.sort((a, b) => a.sort_order - b.sort_order)
  }

  /**
   * Get all cutscenes for the gallery
   */
  getAllCutscenesForGallery() {
    const results = []
    for (const cutscene of this.cutsceneCache.values()) {
      results.push({
        ...cutscene,
        isWatched: this.watchedCutscenes.has(cutscene.cutscene_key),
        isPlayable: cutscene.is_published
      })
    }
    return results.sort((a, b) => a.sort_order - b.sort_order)
  }

  // ============ Watch Progress ============

  /**
   * Check if a cutscene has been watched
   */
  hasWatched(cutsceneKey) {
    return this.watchedCutscenes.has(cutsceneKey)
  }

  /**
   * Check if a world intro cutscene has been watched
   */
  hasWatchedWorldIntro(worldNum) {
    return this.hasWatched(`world_${worldNum}_intro`)
  }

  /**
   * Check if a post-boss cutscene has been watched
   */
  hasWatchedPostBoss(worldNum) {
    return this.hasWatched(`world_${worldNum}_post_boss`)
  }

  /**
   * Mark a cutscene as watched
   */
  markWatched(cutsceneKey) {
    this.watchedCutscenes.add(cutsceneKey)
    this.saveProgress()
  }

  /**
   * Mark a world intro cutscene as watched
   */
  markWorldIntroWatched(worldNum) {
    this.markWatched(`world_${worldNum}_intro`)
  }

  /**
   * Mark a post-boss cutscene as watched
   */
  markPostBossWatched(worldNum) {
    this.markWatched(`world_${worldNum}_post_boss`)
  }

  // ============ Playability Checks ============

  /**
   * Check if a world has a playable intro cutscene
   */
  hasPlayableWorldIntro(worldNum) {
    const cutscene = this.getWorldIntroCutscene(worldNum)
    return cutscene && cutscene.is_published
  }

  /**
   * Check if a world has a playable post-boss cutscene
   */
  hasPlayablePostBoss(worldNum) {
    const cutscene = this.getPostBossCutscene(worldNum)
    return cutscene && cutscene.is_published
  }

  /**
   * Check if should auto-play world intro (first time entering world)
   */
  shouldAutoPlayWorldIntro(worldNum) {
    return this.hasPlayableWorldIntro(worldNum) && !this.hasWatchedWorldIntro(worldNum)
  }

  /**
   * Check if should auto-play post-boss cutscene
   */
  shouldAutoPlayPostBoss(worldNum) {
    return this.hasPlayablePostBoss(worldNum) && !this.hasWatchedPostBoss(worldNum)
  }

  // ============ Statistics ============

  /**
   * Get count of watched cutscenes
   */
  getWatchedCount() {
    let count = 0
    for (const cutscene of this.cutsceneCache.values()) {
      if (cutscene.is_published && this.watchedCutscenes.has(cutscene.cutscene_key)) {
        count++
      }
    }
    return count
  }

  /**
   * Get total number of published cutscenes
   */
  getTotalPublishedCount() {
    let count = 0
    for (const cutscene of this.cutsceneCache.values()) {
      if (cutscene.is_published) {
        count++
      }
    }
    return count
  }

  // ============ Cache Management ============

  /**
   * Clear all caches (for refresh)
   */
  clearCache() {
    this.cutsceneCache.clear()
    this.shotsCache.clear()
    this.dialogueCache.clear()
    this.isLoaded = false
  }

  /**
   * Reset all watched progress (for dev/testing)
   */
  resetProgress() {
    this.watchedCutscenes = new Set()
    this.saveProgress()
  }
}

// Singleton instance
export const CutsceneManager = new CutsceneManagerClass()

// Also export the class for type hints
export { CutsceneManagerClass }
