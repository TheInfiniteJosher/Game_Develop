/**
 * CustomLevelManager - Manages user-created custom levels (marketplace)
 * 
 * Features:
 * - Create/edit/delete custom levels
 * - Publish levels to marketplace
 * - Browse/search published levels
 * - Rate and review levels
 */

import { supabase } from "./integrations/supabase/client.js"
import { AuthManager } from "./AuthManager.js"
import { UserProfileManager } from "./UserProfileManager.js"

// Sort options for marketplace
export const SORT_OPTIONS = {
  NEWEST: 'newest',
  POPULAR: 'popular',
  TOP_RATED: 'top_rated',
  MOST_PLAYED: 'most_played'
}

// Publish status
export const PUBLISH_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  PUBLISHED: 'published',
  UNLISTED: 'unlisted',
  REJECTED: 'rejected'
}

class CustomLevelManagerClass {
  constructor() {
    this.myLevels = new Map() // id -> level data
    this.browseCache = new Map() // cacheKey -> levels
    this.isInitialized = false
    this.initPromise = null
  }

  /**
   * Initialize the custom level manager
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
      await this.loadMyLevels()
    }

    // Listen for auth changes
    AuthManager.onAuthStateChange(async (event, session, user) => {
      if (event === 'SIGNED_IN' && user) {
        await this.loadMyLevels()
      } else if (event === 'SIGNED_OUT') {
        this.myLevels.clear()
      }
    })

    this.isInitialized = true
    console.log("[CustomLevelManager] Initialized")
  }

  /**
   * Load user's own custom levels
   */
  async loadMyLevels() {
    const userId = AuthManager.getUserId()
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('custom_levels')
        .select('*')
        .eq('creator_id', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.warn("[CustomLevelManager] Load my levels error:", error.message)
        return
      }

      if (data) {
        data.forEach(level => {
          this.myLevels.set(level.id, this.dbRowToLevel(level))
        })
        console.log("[CustomLevelManager] Loaded", this.myLevels.size, "custom levels")
      }
    } catch (e) {
      console.error("[CustomLevelManager] Load error:", e)
    }
  }

  /**
   * Convert database row to level data format
   */
  dbRowToLevel(row) {
    return {
      id: row.id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      schemaVersion: row.schema_version,
      settings: row.settings,
      spawn: row.spawn,
      goal: row.goal,
      platforms: row.platforms || [],
      hazards: row.hazards || [],
      movingPlatforms: row.moving_platforms || [],
      fragments: row.fragments || [],
      checkpoints: row.checkpoints || [],
      enemies: row.enemies || [],
      triggers: row.triggers || [],
      difficulty: row.difficulty,
      estimatedTime: row.estimated_time_seconds,
      tags: row.tags || [],
      thumbnailUrl: row.thumbnail_url,
      musicTrackId: row.music_track_id,
      musicUrl: row.music_url,
      publishStatus: row.publish_status,
      publishedAt: row.published_at,
      isFeatured: row.is_featured,
      playCount: row.play_count,
      completionCount: row.completion_count,
      likeCount: row.like_count,
      dislikeCount: row.dislike_count,
      averageRating: row.average_rating,
      ratingCount: row.rating_count,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  /**
   * Convert level data to database row format
   */
  levelToDbRow(level) {
    return {
      title: level.title,
      description: level.description,
      schema_version: level.schemaVersion || 1,
      settings: level.settings,
      spawn: level.spawn,
      goal: level.goal,
      platforms: level.platforms || [],
      hazards: level.hazards || [],
      moving_platforms: level.movingPlatforms || [],
      fragments: level.fragments || [],
      checkpoints: level.checkpoints || [],
      enemies: level.enemies || [],
      triggers: level.triggers || [],
      difficulty: level.difficulty || 'Medium',
      estimated_time_seconds: level.estimatedTime,
      tags: level.tags || [],
      thumbnail_url: level.thumbnailUrl,
      music_track_id: level.musicTrackId,
      music_url: level.musicUrl
    }
  }

  // ==========================================
  // CRUD Operations
  // ==========================================

  /**
   * Create a new custom level
   */
  async createLevel(levelData) {
    if (!AuthManager.isLoggedIn()) {
      return { success: false, error: "Login required" }
    }

    const userId = AuthManager.getUserId()

    try {
      const { data, error } = await supabase
        .from('custom_levels')
        .insert({
          creator_id: userId,
          ...this.levelToDbRow(levelData),
          publish_status: PUBLISH_STATUS.DRAFT
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      const newLevel = this.dbRowToLevel(data)
      this.myLevels.set(newLevel.id, newLevel)

      console.log("[CustomLevelManager] Created level:", newLevel.id)
      return { success: true, level: newLevel }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Update an existing custom level
   */
  async updateLevel(levelId, updates) {
    if (!AuthManager.isLoggedIn()) {
      return { success: false, error: "Login required" }
    }

    const userId = AuthManager.getUserId()
    const existing = this.myLevels.get(levelId)

    // Can only update own levels (unless admin)
    if (existing && existing.creatorId !== userId && !UserProfileManager.isAdmin()) {
      return { success: false, error: "Not authorized" }
    }

    try {
      // Increment version if published
      const versionUpdate = existing?.publishStatus === PUBLISH_STATUS.PUBLISHED
        ? { version: (existing.version || 1) + 1 }
        : {}

      const { data, error } = await supabase
        .from('custom_levels')
        .update({
          ...this.levelToDbRow(updates),
          ...versionUpdate,
          updated_at: new Date().toISOString()
        })
        .eq('id', levelId)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      const updatedLevel = this.dbRowToLevel(data)
      this.myLevels.set(levelId, updatedLevel)

      console.log("[CustomLevelManager] Updated level:", levelId)
      return { success: true, level: updatedLevel }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Delete a custom level (draft only)
   */
  async deleteLevel(levelId) {
    if (!AuthManager.isLoggedIn()) {
      return { success: false, error: "Login required" }
    }

    const existing = this.myLevels.get(levelId)
    if (existing && existing.publishStatus !== PUBLISH_STATUS.DRAFT && !UserProfileManager.isAdmin()) {
      return { success: false, error: "Can only delete draft levels" }
    }

    try {
      const { error } = await supabase
        .from('custom_levels')
        .delete()
        .eq('id', levelId)

      if (error) {
        return { success: false, error: error.message }
      }

      this.myLevels.delete(levelId)
      console.log("[CustomLevelManager] Deleted level:", levelId)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Get a specific level by ID
   */
  async getLevel(levelId) {
    // Check local cache first
    const cached = this.myLevels.get(levelId)
    if (cached) return cached

    try {
      const { data, error } = await supabase
        .from('custom_levels')
        .select('*')
        .eq('id', levelId)
        .single()

      if (error) return null

      return this.dbRowToLevel(data)
    } catch (e) {
      return null
    }
  }

  /**
   * Get all of current user's levels
   */
  getMyLevels() {
    return Array.from(this.myLevels.values())
  }

  // ==========================================
  // Publishing
  // ==========================================

  /**
   * Publish a level to the marketplace
   */
  async publishLevel(levelId) {
    if (!AuthManager.isLoggedIn()) {
      return { success: false, error: "Login required" }
    }

    if (!UserProfileManager.canPublishLevels()) {
      return { success: false, error: "Publishing permission required" }
    }

    try {
      const { data, error } = await supabase
        .from('custom_levels')
        .update({
          publish_status: PUBLISH_STATUS.PUBLISHED,
          published_at: new Date().toISOString()
        })
        .eq('id', levelId)
        .eq('creator_id', AuthManager.getUserId())
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      const level = this.dbRowToLevel(data)
      this.myLevels.set(levelId, level)

      console.log("[CustomLevelManager] Published level:", levelId)
      return { success: true, level }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Unpublish a level (make it unlisted)
   */
  async unpublishLevel(levelId) {
    if (!AuthManager.isLoggedIn()) {
      return { success: false, error: "Login required" }
    }

    try {
      const { data, error } = await supabase
        .from('custom_levels')
        .update({ publish_status: PUBLISH_STATUS.UNLISTED })
        .eq('id', levelId)
        .eq('creator_id', AuthManager.getUserId())
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      const level = this.dbRowToLevel(data)
      this.myLevels.set(levelId, level)

      return { success: true, level }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ==========================================
  // Marketplace Browsing
  // ==========================================

  /**
   * Browse published levels
   */
  async browseLevels(options = {}) {
    const {
      sort = SORT_OPTIONS.NEWEST,
      difficulty = null,
      tags = [],
      search = null,
      page = 1,
      limit = 20
    } = options

    try {
      let query = supabase
        .from('custom_levels')
        .select(`
          *,
          profiles:creator_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('publish_status', PUBLISH_STATUS.PUBLISHED)

      // Apply filters
      if (difficulty) {
        query = query.eq('difficulty', difficulty)
      }

      if (tags.length > 0) {
        query = query.contains('tags', tags)
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
      }

      // Apply sorting
      switch (sort) {
        case SORT_OPTIONS.NEWEST:
          query = query.order('published_at', { ascending: false })
          break
        case SORT_OPTIONS.POPULAR:
          query = query.order('play_count', { ascending: false })
          break
        case SORT_OPTIONS.TOP_RATED:
          query = query.order('average_rating', { ascending: false })
          break
        case SORT_OPTIONS.MOST_PLAYED:
          query = query.order('completion_count', { ascending: false })
          break
      }

      // Pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.warn("[CustomLevelManager] Browse error:", error.message)
        return { levels: [], total: 0 }
      }

      const levels = data.map(row => ({
        ...this.dbRowToLevel(row),
        creator: row.profiles ? {
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url
        } : null
      }))

      return { levels, total: count || levels.length }
    } catch (e) {
      console.error("[CustomLevelManager] Browse error:", e)
      return { levels: [], total: 0 }
    }
  }

  /**
   * Get featured levels
   */
  async getFeaturedLevels(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('custom_levels')
        .select(`
          *,
          profiles:creator_id (
            username,
            display_name
          )
        `)
        .eq('publish_status', PUBLISH_STATUS.PUBLISHED)
        .eq('is_featured', true)
        .order('feature_order', { ascending: true })
        .limit(limit)

      if (error) return []

      return data.map(row => ({
        ...this.dbRowToLevel(row),
        creator: row.profiles
      }))
    } catch (e) {
      return []
    }
  }

  /**
   * Get levels by a specific creator
   */
  async getLevelsByCreator(creatorId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('custom_levels')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('publish_status', PUBLISH_STATUS.PUBLISHED)
        .order('published_at', { ascending: false })
        .limit(limit)

      if (error) return []

      return data.map(row => this.dbRowToLevel(row))
    } catch (e) {
      return []
    }
  }

  // ==========================================
  // Ratings & Stats
  // ==========================================

  /**
   * Rate a level
   */
  async rateLevel(levelId, rating, liked = null, reviewText = null) {
    if (!AuthManager.isLoggedIn()) {
      return { success: false, error: "Login required" }
    }

    const userId = AuthManager.getUserId()

    // Can't rate own level
    const level = await this.getLevel(levelId)
    if (level?.creatorId === userId) {
      return { success: false, error: "Cannot rate your own level" }
    }

    try {
      const { data, error } = await supabase
        .from('level_ratings')
        .upsert({
          level_id: levelId,
          user_id: userId,
          rating,
          liked,
          review_text: reviewText
        }, { onConflict: 'level_id,user_id' })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, rating: data }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Get user's rating for a level
   */
  async getMyRating(levelId) {
    if (!AuthManager.isLoggedIn()) return null

    try {
      const { data, error } = await supabase
        .from('level_ratings')
        .select('*')
        .eq('level_id', levelId)
        .eq('user_id', AuthManager.getUserId())
        .single()

      if (error) return null

      return {
        rating: data.rating,
        liked: data.liked,
        reviewText: data.review_text
      }
    } catch (e) {
      return null
    }
  }

  /**
   * Increment play count for a level
   */
  async incrementPlayCount(levelId) {
    try {
      await supabase.rpc('increment_play_count', { level_uuid: levelId })
    } catch (e) {
      // Silent fail - not critical
    }
  }

  /**
   * Get reviews for a level
   */
  async getReviews(levelId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('level_ratings')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('level_id', levelId)
        .not('review_text', 'is', null)
        .order('helpful_count', { ascending: false })
        .limit(limit)

      if (error) return []

      return data.map(row => ({
        id: row.id,
        rating: row.rating,
        liked: row.liked,
        reviewText: row.review_text,
        helpfulCount: row.helpful_count,
        createdAt: row.created_at,
        user: row.profiles ? {
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url
        } : null
      }))
    } catch (e) {
      return []
    }
  }

  // ==========================================
  // Utility
  // ==========================================

  /**
   * Validate level data before saving
   */
  validateLevel(levelData) {
    const errors = []

    if (!levelData.title || levelData.title.trim().length === 0) {
      errors.push("Title is required")
    }

    if (!levelData.settings?.width || !levelData.settings?.height) {
      errors.push("Level dimensions are required")
    }

    if (!levelData.spawn?.x || !levelData.spawn?.y) {
      errors.push("Spawn point is required")
    }

    if (!levelData.goal?.x || !levelData.goal?.y) {
      errors.push("Goal is required")
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Clear browse cache
   */
  clearCache() {
    this.browseCache.clear()
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
export const CustomLevelManager = new CustomLevelManagerClass()

// Auto-initialize
CustomLevelManager.initialize()
