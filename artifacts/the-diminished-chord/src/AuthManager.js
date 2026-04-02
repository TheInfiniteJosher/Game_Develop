/**
 * AuthManager - Handles user authentication with Supabase Auth
 * 
 * Features:
 * - Email/password authentication
 * - Session management
 * - Auth state change listeners
 * - Integration with UserProfileManager
 */

import { supabase } from "./integrations/supabase/client.js"

class AuthManagerClass {
  constructor() {
    this.currentUser = null
    this.currentSession = null
    this.isInitialized = false
    this.initPromise = null
    this.authStateListeners = new Set()
  }

  /**
   * Initialize the auth manager and restore session
   */
  async initialize() {
    if (this.isInitialized) return this.currentUser
    if (this.initPromise) return this.initPromise

    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  async _doInitialize() {
    try {
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.warn("[AuthManager] Session error:", error.message)
      }

      if (session) {
        this.currentSession = session
        this.currentUser = session.user
        console.log("[AuthManager] Session restored for:", this.currentUser.email)
      }

      // Set up auth state change listener
      supabase.auth.onAuthStateChange((event, session) => {
        console.log("[AuthManager] Auth state changed:", event)
        
        this.currentSession = session
        this.currentUser = session?.user || null

        // Notify all listeners
        this.authStateListeners.forEach(listener => {
          try {
            listener(event, session, this.currentUser)
          } catch (e) {
            console.error("[AuthManager] Listener error:", e)
          }
        })
      })

      this.isInitialized = true
      return this.currentUser
    } catch (e) {
      console.error("[AuthManager] Init error:", e)
      this.isInitialized = true
      return null
    }
  }

  /**
   * Sign up a new user with email and password
   * @param {string} email 
   * @param {string} password 
   * @param {object} metadata - Additional user metadata (username, display_name)
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async signUp(email, password, metadata = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: metadata.username || null,
            display_name: metadata.displayName || metadata.username || null
          }
        }
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return { 
          success: true, 
          user: data.user,
          message: "Please check your email to confirm your account."
        }
      }

      return { success: true, user: data.user }
    } catch (e) {
      console.error("[AuthManager] Sign up error:", e)
      return { success: false, error: e.message }
    }
  }

  /**
   * Sign in with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { success: false, error: error.message }
      }

      this.currentUser = data.user
      this.currentSession = data.session
      
      return { success: true, user: data.user }
    } catch (e) {
      console.error("[AuthManager] Sign in error:", e)
      return { success: false, error: e.message }
    }
  }

  /**
   * Sign out the current user
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        return { success: false, error: error.message }
      }

      this.currentUser = null
      this.currentSession = null
      
      return { success: true }
    } catch (e) {
      console.error("[AuthManager] Sign out error:", e)
      return { success: false, error: e.message }
    }
  }

  /**
   * Send password reset email
   * @param {string} email 
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, message: "Password reset email sent." }
    } catch (e) {
      console.error("[AuthManager] Reset password error:", e)
      return { success: false, error: e.message }
    }
  }

  /**
   * Update user password (when logged in)
   * @param {string} newPassword 
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (e) {
      console.error("[AuthManager] Update password error:", e)
      return { success: false, error: e.message }
    }
  }

  /**
   * Sign in with OAuth provider
   * Uses standard redirect flow
   * @param {string} provider - 'google', 'facebook', 'apple', 'spotify', 'twitch'
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async signInWithProvider(provider) {
    try {
      // For OAuth to work, the redirect URL must be whitelisted in:
      // 1. Google Cloud Console (or other provider)
      // 2. Supabase Dashboard > Auth > URL Configuration
      // 
      // In preview environments, the URL changes with each build, making OAuth difficult.
      // We let Supabase use its default callback handling - don't specify redirectTo
      // and Supabase will use the Site URL configured in the dashboard.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          queryParams: provider === 'spotify' ? {
            scope: 'user-read-email'
          } : undefined
        }
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // The page will redirect to the OAuth provider
      // When it comes back, Supabase client will automatically pick up the session
      return { success: true }
    } catch (e) {
      console.error(`[AuthManager] ${provider} sign in error:`, e)
      return { success: false, error: e.message }
    }
  }

  /**
   * Get list of supported OAuth providers
   * Priority: Spotify (music-relevant), Google, Twitch, Facebook
   * Note: Apple auth removed - requires paid subscription
   * @returns {Array<{id: string, name: string, color: string, icon: string}>}
   */
  getOAuthProviders() {
    return [
      { id: 'spotify', name: 'Spotify', color: '#1DB954', icon: '♪' },
      { id: 'google', name: 'Google', color: '#4285F4', icon: 'G' },
      { id: 'twitch', name: 'Twitch', color: '#9146FF', icon: '▶' },
      { id: 'facebook', name: 'Facebook', color: '#1877F2', icon: 'f' }
    ]
  }

  /**
   * Check if user is currently logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.currentUser !== null
  }

  /**
   * Check if user is playing as guest (no account)
   * @returns {boolean}
   */
  isGuest() {
    return sessionStorage.getItem('guest_mode') === 'true'
  }

  /**
   * Get current user
   * @returns {object|null}
   */
  getUser() {
    return this.currentUser
  }

  /**
   * Get current user ID
   * @returns {string|null}
   */
  getUserId() {
    return this.currentUser?.id || null
  }

  /**
   * Get current session
   * @returns {object|null}
   */
  getSession() {
    return this.currentSession
  }

  /**
   * Add auth state change listener
   * @param {function} listener - Called with (event, session, user)
   * @returns {function} Unsubscribe function
   */
  onAuthStateChange(listener) {
    this.authStateListeners.add(listener)
    
    // Return unsubscribe function
    return () => {
      this.authStateListeners.delete(listener)
    }
  }

  /**
   * Wait for initialization to complete
   */
  async waitForReady() {
    if (this.isInitialized) return
    if (this.initPromise) await this.initPromise
  }

  /**
   * Check if manager is ready
   */
  isReady() {
    return this.isInitialized
  }
}

// Singleton instance
export const AuthManager = new AuthManagerClass()

// Auto-initialize on import
AuthManager.initialize()
