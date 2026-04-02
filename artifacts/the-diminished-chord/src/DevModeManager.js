/**
 * DevModeManager - Controls developer mode access
 * 
 * Now integrates with Supabase user permissions for proper access control.
 * 
 * Access hierarchy:
 * 1. Admin users - Full access to everything
 * 2. Developer users - Access to dev tools based on permissions
 * 3. Players with permissions - Specific tools granted by admins
 * 4. Regular players - No dev access
 * 5. Legacy: DEV_MODE_ENABLED or secret code (for local development)
 */

import { UserProfileManager, PERMISSIONS } from "./UserProfileManager.js"
import { AuthManager } from "./AuthManager.js"

// ============================================================================
// MASTER TOGGLE - For local development without authentication
// Set to false for production - will then use Supabase permissions
// ============================================================================
const DEV_MODE_ENABLED = true  // Set to false for public release

// Secret code to unlock dev mode (Konami-style)
// Type this on the title screen to temporarily enable dev mode
const DEV_MODE_SECRET_CODE = "devmode"

// ============================================================================

class DevModeManagerClass {
  constructor() {
    // Local session state (for secret code unlock)
    this.sessionUnlocked = false
    this.inputBuffer = ""
    this.maxBufferLength = DEV_MODE_SECRET_CODE.length
  }

  /**
   * Check if developer mode is currently active
   * Checks in order: master toggle > session unlock > user permissions
   */
  isDevMode() {
    // Master toggle for development (highest priority)
    if (DEV_MODE_ENABLED) return true
    
    // Session unlock via secret code
    if (this.sessionUnlocked) return true
    
    // Check user permissions from Supabase
    return this.hasDevPermissions()
  }

  /**
   * Check if user has dev permissions from their profile
   */
  hasDevPermissions() {
    // Check if user is admin or developer
    if (UserProfileManager.isAdmin()) return true
    if (UserProfileManager.isDeveloper()) return true
    
    // Check specific dev menu permission
    if (UserProfileManager.canAccessDevMenu()) return true
    
    return false
  }

  /**
   * Check if dev mode is enabled by master toggle (for local development)
   */
  isMasterEnabled() {
    return DEV_MODE_ENABLED
  }

  /**
   * Check if user can access the level designer
   */
  canAccessLevelDesigner() {
    if (DEV_MODE_ENABLED) return true
    if (this.sessionUnlocked) return true
    return UserProfileManager.canAccessLevelDesigner()
  }

  /**
   * Check if user can access the track uploader
   */
  canAccessTrackUploader() {
    if (DEV_MODE_ENABLED) return true
    if (this.sessionUnlocked) return true
    return UserProfileManager.canAccessTrackUploader()
  }

  /**
   * Check if user can access the developer menu
   */
  canAccessDevMenu() {
    if (DEV_MODE_ENABLED) return true
    if (this.sessionUnlocked) return true
    return UserProfileManager.canAccessDevMenu()
  }

  /**
   * Check if user can publish levels
   */
  canPublishLevels() {
    // Publishing is typically available to all users
    // But can be restricted
    return UserProfileManager.canPublishLevels()
  }

  /**
   * Check if user can moderate content
   */
  canModerateContent() {
    return UserProfileManager.canModerateContent()
  }

  /**
   * Check if user is an admin
   */
  isAdmin() {
    return UserProfileManager.isAdmin()
  }

  /**
   * Check if user is a developer
   */
  isDeveloper() {
    return UserProfileManager.isDeveloper()
  }

  /**
   * Get user role
   */
  getUserRole() {
    return UserProfileManager.getRole()
  }

  /**
   * Unlock dev mode for this session (via secret code)
   */
  unlockForSession() {
    this.sessionUnlocked = true
    console.log("🔓 Developer Mode unlocked for this session!")
    return true
  }

  /**
   * Lock dev mode (for testing public mode)
   */
  lockForSession() {
    this.sessionUnlocked = false
    console.log("🔒 Developer Mode locked for this session")
  }

  /**
   * Process key input for secret code detection
   * Call this from scene's keyboard input handler
   * @returns {boolean} True if secret code was just entered
   */
  processKeyInput(key) {
    // Only process if dev mode is not already enabled
    if (DEV_MODE_ENABLED) return false
    if (this.hasDevPermissions()) return false

    // Add key to buffer
    this.inputBuffer += key.toLowerCase()
    
    // Keep buffer at max length
    if (this.inputBuffer.length > this.maxBufferLength) {
      this.inputBuffer = this.inputBuffer.slice(-this.maxBufferLength)
    }

    // Check for secret code
    if (this.inputBuffer === DEV_MODE_SECRET_CODE) {
      this.unlockForSession()
      this.inputBuffer = ""
      return true
    }

    return false
  }

  /**
   * Reset input buffer (call when leaving title screen)
   */
  resetInputBuffer() {
    this.inputBuffer = ""
  }

  /**
   * Get the status string for debug/display
   */
  getStatusString() {
    if (DEV_MODE_ENABLED) {
      return "Dev Mode: ON (Master)"
    } 
    
    if (this.sessionUnlocked) {
      return "Dev Mode: ON (Session)"
    }
    
    if (AuthManager.isLoggedIn()) {
      const role = UserProfileManager.getRole()
      if (UserProfileManager.isAdmin()) {
        return `Dev Mode: ON (Admin: ${UserProfileManager.getUsername()})`
      }
      if (UserProfileManager.isDeveloper()) {
        return `Dev Mode: ON (Developer: ${UserProfileManager.getUsername()})`
      }
      if (UserProfileManager.canAccessDevMenu()) {
        return `Dev Mode: ON (Granted: ${UserProfileManager.getUsername()})`
      }
      return `Logged in as: ${UserProfileManager.getDisplayName()} (${role})`
    }
    
    return "Dev Mode: OFF (Guest)"
  }

  /**
   * Get a summary of current permissions
   */
  getPermissionsSummary() {
    return {
      devMode: this.isDevMode(),
      levelDesigner: this.canAccessLevelDesigner(),
      trackUploader: this.canAccessTrackUploader(),
      devMenu: this.canAccessDevMenu(),
      publishLevels: this.canPublishLevels(),
      moderateContent: this.canModerateContent(),
      isAdmin: this.isAdmin(),
      isDeveloper: this.isDeveloper(),
      masterEnabled: DEV_MODE_ENABLED,
      sessionUnlocked: this.sessionUnlocked
    }
  }
}

// Singleton instance
export const DevModeManager = new DevModeManagerClass()
