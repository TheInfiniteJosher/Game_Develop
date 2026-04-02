/**
 * UserProfileManager - Manages user profile data and permissions
 * 
 * Features:
 * - Load/save user profile from Supabase
 * - Permission checking (dev mode, level designer, etc.)
 * - Role management
 * - Stats tracking
 */

import { supabase } from "./integrations/supabase/client.js"
import { AuthManager } from "./AuthManager.js"

// Permission flags that can be toggled
export const PERMISSIONS = {
  ACCESS_LEVEL_DESIGNER: 'can_access_level_designer',
  ACCESS_TRACK_UPLOADER: 'can_access_track_uploader',
  ACCESS_DEV_MENU: 'can_access_dev_menu',
  PUBLISH_LEVELS: 'can_publish_levels',
  MODERATE_CONTENT: 'can_moderate_content'
}

// User roles
export const ROLES = {
  PLAYER: 'player',
  DEVELOPER: 'developer',
  ADMIN: 'admin'
}

class UserProfileManagerClass {
  constructor() {
    this.currentProfile = null
    this.isInitialized = false
    this.initPromise = null
    this.profileListeners = new Set()
  }

  /**
   * Initialize the profile manager
   */
  async initialize() {
    if (this.isInitialized) return this.currentProfile
    if (this.initPromise) return this.initPromise

    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  async _doInitialize() {
    // Wait for auth to be ready
    await AuthManager.waitForReady()

    // Load profile if logged in
    if (AuthManager.isLoggedIn()) {
      await this.loadProfile()
    }

    // Listen for auth changes
    AuthManager.onAuthStateChange(async (event, session, user) => {
      if (event === 'SIGNED_IN' && user) {
        await this.loadProfile()
      } else if (event === 'SIGNED_OUT') {
        this.currentProfile = null
        this.notifyListeners()
      }
    })

    this.isInitialized = true
    return this.currentProfile
  }

  /**
   * Load the current user's profile from Supabase
   */
  async loadProfile() {
    const userId = AuthManager.getUserId()
    if (!userId) {
      this.currentProfile = null
      return null
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn("[UserProfileManager] Load error:", error.message)
        return null
      }

      this.currentProfile = data
      console.log("[UserProfileManager] Profile loaded:", {
        username: data.username,
        role: data.role,
        permissions: {
          devMenu: data.can_access_dev_menu,
          levelDesigner: data.can_access_level_designer,
          trackUploader: data.can_access_track_uploader
        }
      })

      this.notifyListeners()
      return this.currentProfile
    } catch (e) {
      console.error("[UserProfileManager] Load error:", e)
      return null
    }
  }

  /**
   * Get the current profile
   */
  getProfile() {
    return this.currentProfile
  }

  /**
   * Get username
   */
  getUsername() {
    return this.currentProfile?.username || null
  }

  /**
   * Get display name
   */
  getDisplayName() {
    return this.currentProfile?.display_name || this.currentProfile?.username || 'Guest'
  }

  /**
   * Get user role
   */
  getRole() {
    return this.currentProfile?.role || ROLES.PLAYER
  }

  /**
   * Check if user is a developer
   */
  isDeveloper() {
    return this.currentProfile?.role === ROLES.DEVELOPER || this.isAdmin()
  }

  /**
   * Check if user is an admin
   */
  isAdmin() {
    return this.currentProfile?.role === ROLES.ADMIN
  }

  /**
   * Check if user has a specific permission
   * @param {string} permission - One of PERMISSIONS values
   */
  hasPermission(permission) {
    if (!this.currentProfile) return false
    
    // Admins have all permissions
    if (this.isAdmin()) return true
    
    // Developers have most permissions
    if (this.isDeveloper() && permission !== PERMISSIONS.MODERATE_CONTENT) return true
    
    // Check specific permission flag
    return this.currentProfile[permission] === true
  }

  /**
   * Check if user can access dev menu
   */
  canAccessDevMenu() {
    return this.hasPermission(PERMISSIONS.ACCESS_DEV_MENU)
  }

  /**
   * Check if user can access level designer
   */
  canAccessLevelDesigner() {
    return this.hasPermission(PERMISSIONS.ACCESS_LEVEL_DESIGNER)
  }

  /**
   * Check if user can access track uploader
   */
  canAccessTrackUploader() {
    return this.hasPermission(PERMISSIONS.ACCESS_TRACK_UPLOADER)
  }

  /**
   * Check if user can publish levels
   */
  canPublishLevels() {
    return this.hasPermission(PERMISSIONS.PUBLISH_LEVELS)
  }

  /**
   * Check if user can moderate content
   */
  canModerateContent() {
    return this.hasPermission(PERMISSIONS.MODERATE_CONTENT)
  }

  /**
   * Check if user has premium status
   */
  isPremium() {
    if (!this.currentProfile) return false
    
    if (!this.currentProfile.is_premium) return false
    
    // Check if premium has expired
    if (this.currentProfile.premium_expires_at) {
      const expiresAt = new Date(this.currentProfile.premium_expires_at)
      if (expiresAt < new Date()) return false
    }
    
    return true
  }

  /**
   * Check if user has spawn shifting unlocked
   */
  hasSpawnShifting() {
    return this.currentProfile?.has_spawn_shifting || this.isPremium()
  }

  /**
   * Check if user has auto-ricochet unlocked
   * Auto-ricochet allows continuous wall jumps while holding the jump button (turbo mode)
   */
  hasAutoRicochet() {
    return this.currentProfile?.has_auto_ricochet || this.isPremium()
  }

  /**
   * Update profile data
   * @param {object} updates - Fields to update
   */
  async updateProfile(updates) {
    const userId = AuthManager.getUserId()
    if (!userId) return { success: false, error: "Not logged in" }

    try {
      // Filter out fields that users shouldn't be able to update directly
      const allowedUpdates = {
        username: updates.username,
        display_name: updates.display_name,
        avatar_url: updates.avatar_url
      }

      // Remove undefined values
      Object.keys(allowedUpdates).forEach(key => {
        if (allowedUpdates[key] === undefined) delete allowedUpdates[key]
      })

      const { data, error } = await supabase
        .from('profiles')
        .update(allowedUpdates)
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      this.currentProfile = data
      this.notifyListeners()
      
      return { success: true, profile: data }
    } catch (e) {
      console.error("[UserProfileManager] Update error:", e)
      return { success: false, error: e.message }
    }
  }

  /**
   * Update last seen timestamp
   */
  async updateLastSeen() {
    const userId = AuthManager.getUserId()
    if (!userId) return

    try {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
    } catch (e) {
      // Silent fail - not critical
    }
  }

  /**
   * Increment playtime
   * @param {number} seconds 
   */
  async addPlaytime(seconds) {
    const userId = AuthManager.getUserId()
    if (!userId || !this.currentProfile) return

    try {
      const newTotal = (this.currentProfile.total_playtime_seconds || 0) + seconds
      
      await supabase
        .from('profiles')
        .update({ total_playtime_seconds: newTotal })
        .eq('id', userId)

      this.currentProfile.total_playtime_seconds = newTotal
    } catch (e) {
      console.warn("[UserProfileManager] Playtime update failed:", e)
    }
  }

  /**
   * Get a user's public profile by ID
   * @param {string} userId 
   */
  async getPublicProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, levels_completed, levels_created')
        .eq('id', userId)
        .single()

      if (error) return null
      return data
    } catch (e) {
      return null
    }
  }

  /**
   * Search for users by username
   * @param {string} query 
   */
  async searchUsers(query) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .ilike('username', `%${query}%`)
        .limit(20)

      if (error) return []
      return data
    } catch (e) {
      return []
    }
  }

  /**
   * Add profile change listener
   * @param {function} listener 
   */
  onProfileChange(listener) {
    this.profileListeners.add(listener)
    return () => this.profileListeners.delete(listener)
  }

  /**
   * Notify all listeners of profile change
   */
  notifyListeners() {
    this.profileListeners.forEach(listener => {
      try {
        listener(this.currentProfile)
      } catch (e) {
        console.error("[UserProfileManager] Listener error:", e)
      }
    })
  }

  /**
   * Wait for initialization
   */
  async waitForReady() {
    if (this.isInitialized) return
    if (this.initPromise) await this.initPromise
  }

  /**
   * Check if ready
   */
  isReady() {
    return this.isInitialized
  }

  // ==========================================
  // Admin Functions
  // ==========================================

  /**
   * Grant a permission to a user (admin only)
   * @param {string} userId 
   * @param {string} permission 
   */
  async grantPermission(userId, permission) {
    if (!this.isAdmin()) {
      return { success: false, error: "Admin access required" }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [permission]: true })
        .eq('id', userId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Revoke a permission from a user (admin only)
   * @param {string} userId 
   * @param {string} permission 
   */
  async revokePermission(userId, permission) {
    if (!this.isAdmin()) {
      return { success: false, error: "Admin access required" }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [permission]: false })
        .eq('id', userId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Set user role (admin only)
   * @param {string} userId 
   * @param {string} role 
   */
  async setUserRole(userId, role) {
    if (!this.isAdmin()) {
      return { success: false, error: "Admin access required" }
    }

    if (!Object.values(ROLES).includes(role)) {
      return { success: false, error: "Invalid role" }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)

      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
}

// Singleton instance
export const UserProfileManager = new UserProfileManagerClass()

// Auto-initialize
UserProfileManager.initialize()
