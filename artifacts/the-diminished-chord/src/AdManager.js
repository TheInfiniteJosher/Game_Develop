/**
 * AdManager - Runtime ad management system
 * 
 * Handles:
 * - Loading ad configuration from Supabase
 * - Triggering interstitial ads at appropriate times
 * - Managing rewarded ad flows
 * - Ad-skip credit consumption
 * - Premium/subscription ad removal
 * - Integration with Google AdSense for Games (H5 Games Ads)
 * 
 * Usage:
 *   await AdManager.initialize()
 *   if (AdManager.shouldShowInterstitial()) {
 *     await AdManager.showInterstitial()
 *   }
 */

import { supabase } from "./integrations/supabase/client.js"
import { AdSkipManager } from "./AdSkipManager.js"

class AdManagerClass {
  constructor() {
    this.config = new Map()
    this.isInitialized = false
    this.initPromise = null
    
    // Runtime state
    this.levelsPlayedSinceAd = 0
    this.lastAdTime = 0
    this.totalLevelsPlayed = 0
    this.isPremium = false
    this.recentPurchaseTime = 0
  }

  /**
   * Initialize by loading config from Supabase
   */
  async initialize() {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  async _doInitialize() {
    try {
      const { data, error } = await supabase
        .from('ad_config')
        .select('*')
        .eq('is_active', true)

      if (error) {
        console.warn("[AdManager] Failed to load config from Supabase:", error.message)
        this.loadDefaultConfig()
      } else if (data) {
        data.forEach(item => {
          this.config.set(item.config_key, item.config_value)
        })
        console.log(`[AdManager] Loaded ${data.length} config settings from Supabase`)
      }

      this.isInitialized = true
      
      // Check premium status
      await this.checkPremiumStatus()
      
    } catch (e) {
      console.error("[AdManager] Initialization error:", e)
      this.loadDefaultConfig()
      this.isInitialized = true
    }
  }

  loadDefaultConfig() {
    // Fallback defaults if Supabase is unavailable
    this.config.set('ads_enabled', { enabled: true })
    this.config.set('interstitial_enabled', { enabled: true })
    this.config.set('interstitial_frequency', { levels: 3 })
    this.config.set('min_time_between_ads', { seconds: 120 })
    this.config.set('first_ad_delay', { levels: 2 })
    this.config.set('ad_skip_enabled', { enabled: true })
    this.config.set('rewarded_ads_enabled', { enabled: true })
    this.config.set('premium_removes_ads', { enabled: true })
    console.log("[AdManager] Using default config (offline mode)")
  }

  /**
   * Check if user has premium subscription
   */
  async checkPremiumStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        this.isPremium = false
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, premium_expires_at')
        .eq('id', user.id)
        .single()

      if (profile) {
        // Check if premium and not expired
        if (profile.is_premium) {
          if (profile.premium_expires_at) {
            this.isPremium = new Date(profile.premium_expires_at) > new Date()
          } else {
            this.isPremium = true // Lifetime premium
          }
        }
      }

      console.log(`[AdManager] Premium status: ${this.isPremium}`)
    } catch (e) {
      console.warn("[AdManager] Could not check premium status:", e)
      this.isPremium = false
    }
  }

  /**
   * Get a config value
   */
  getConfig(key, defaultValue = null) {
    const config = this.config.get(key)
    return config || defaultValue
  }

  /**
   * Check if ads are globally enabled
   */
  areAdsEnabled() {
    const config = this.getConfig('ads_enabled', { enabled: true })
    return config.enabled === true
  }

  /**
   * Check if premium removes ads
   */
  premiumRemovesAds() {
    if (!this.isPremium) return false
    const config = this.getConfig('premium_removes_ads', { enabled: true })
    return config.enabled === true
  }

  /**
   * Check if enough time has passed since last ad
   */
  hasAdCooldownPassed() {
    const config = this.getConfig('min_time_between_ads', { seconds: 120 })
    const minTime = config.seconds * 1000 // Convert to ms
    return (Date.now() - this.lastAdTime) >= minTime
  }

  /**
   * Check if player is in post-purchase ad-free period
   */
  isInPurchaseCooldown() {
    const config = this.getConfig('ad_cooldown_after_purchase', { hours: 24 })
    const cooldownMs = config.hours * 60 * 60 * 1000
    return (Date.now() - this.recentPurchaseTime) < cooldownMs
  }

  /**
   * Record that a level was completed (for frequency tracking)
   */
  recordLevelComplete() {
    this.levelsPlayedSinceAd++
    this.totalLevelsPlayed++
  }

  /**
   * Check if an interstitial ad should be shown
   */
  shouldShowInterstitial() {
    // Master switch
    if (!this.areAdsEnabled()) return false
    
    // Premium removes ads
    if (this.premiumRemovesAds()) return false
    
    // Check if interstitials are enabled
    const interstitialConfig = this.getConfig('interstitial_enabled', { enabled: true })
    if (!interstitialConfig.enabled) return false
    
    // Check first ad delay
    const firstAdDelay = this.getConfig('first_ad_delay', { levels: 2 })
    if (this.totalLevelsPlayed < firstAdDelay.levels) return false
    
    // Check frequency
    const frequency = this.getConfig('interstitial_frequency', { levels: 3 })
    if (this.levelsPlayedSinceAd < frequency.levels) return false
    
    // Check time cooldown
    if (!this.hasAdCooldownPassed()) return false
    
    // Check purchase cooldown
    if (this.isInPurchaseCooldown()) return false
    
    return true
  }

  /**
   * Try to use an ad-skip credit
   * @returns {boolean} True if credit was used
   */
  tryUseSkipCredit() {
    const skipConfig = this.getConfig('ad_skip_enabled', { enabled: true })
    if (!skipConfig.enabled) return false
    
    return AdSkipManager.useCredit()
  }

  /**
   * Get the number of ad-skip credits available
   */
  getSkipCredits() {
    return AdSkipManager.getCredits()
  }

  /**
   * Show an interstitial ad
   * @param {Phaser.Scene} scene - The current scene
   * @returns {Promise<boolean>} True if ad was shown
   */
  async showInterstitial(scene) {
    if (!this.shouldShowInterstitial()) {
      return false
    }

    // Check if player wants to use a skip credit
    if (this.getSkipCredits() > 0) {
      // This will be handled by the InterstitialAdScene UI
    }

    return new Promise((resolve) => {
      // Launch the interstitial ad scene
      scene.scene.launch("InterstitialAdScene", {
        onComplete: (wasShown) => {
          if (wasShown) {
            this.lastAdTime = Date.now()
            this.levelsPlayedSinceAd = 0
          }
          resolve(wasShown)
        },
        onSkip: () => {
          // Credit was used to skip
          resolve(false)
        }
      })
    })
  }

  /**
   * Show a rewarded ad
   * @param {string} rewardType - Type of reward (extra_life, double_fragments, etc.)
   * @param {Phaser.Scene} scene - The current scene
   * @returns {Promise<boolean>} True if ad was watched and reward earned
   */
  async showRewardedAd(rewardType, scene) {
    const rewardedConfig = this.getConfig('rewarded_ads_enabled', { enabled: true })
    if (!rewardedConfig.enabled) return false

    // Check specific reward type is enabled
    const rewardConfig = this.getConfig(`rewarded_${rewardType}`, { enabled: true })
    if (!rewardConfig.enabled) return false

    return new Promise((resolve) => {
      // Trigger actual ad via AdSense H5 Games API
      if (typeof window.adBreak === 'function') {
        window.adBreak({
          type: 'reward',
          name: rewardType,
          beforeReward: (showAdFn) => {
            // Ad is ready - show it
            showAdFn()
          },
          adDismissed: () => {
            // User closed ad before completion
            resolve(false)
          },
          adViewed: () => {
            // User watched the full ad
            this.lastAdTime = Date.now()
            resolve(true)
          },
          adBreakDone: (placementInfo) => {
            console.log("[AdManager] Rewarded ad break done:", placementInfo)
          }
        })
      } else {
        // AdSense not available - simulate for testing
        console.log("[AdManager] AdSense not available - simulating rewarded ad")
        scene.time.delayedCall(1000, () => resolve(true))
      }
    })
  }

  /**
   * Trigger an interstitial ad via AdSense H5 Games API
   * @returns {Promise<boolean>} True if ad was shown
   */
  async triggerAdSenseInterstitial() {
    return new Promise((resolve) => {
      if (typeof window.adBreak === 'function') {
        window.adBreak({
          type: 'next',  // Interstitial between levels
          name: 'level-complete',
          beforeAd: () => {
            console.log("[AdManager] Ad starting...")
          },
          afterAd: () => {
            console.log("[AdManager] Ad finished")
            this.lastAdTime = Date.now()
            this.levelsPlayedSinceAd = 0
            resolve(true)
          },
          adBreakDone: (placementInfo) => {
            // Called when ad break is complete (shown or not)
            if (placementInfo.breakStatus !== 'viewed') {
              console.log("[AdManager] Ad not shown:", placementInfo.breakStatus)
              resolve(false)
            }
          }
        })
      } else {
        console.log("[AdManager] AdSense not available")
        resolve(false)
      }
    })
  }

  /**
   * Record a purchase (triggers ad cooldown)
   */
  recordPurchase() {
    this.recentPurchaseTime = Date.now()
    console.log("[AdManager] Purchase recorded - ad cooldown started")
  }

  /**
   * Set premium status (called after subscription purchase)
   */
  setPremiumStatus(isPremium) {
    this.isPremium = isPremium
    console.log(`[AdManager] Premium status set to: ${isPremium}`)
  }

  /**
   * Reload config from Supabase (for live updates)
   */
  async reloadConfig() {
    this.isInitialized = false
    this.initPromise = null
    this.config.clear()
    await this.initialize()
  }

  /**
   * Get summary of current ad state (for debugging/UI)
   */
  getAdState() {
    return {
      adsEnabled: this.areAdsEnabled(),
      isPremium: this.isPremium,
      premiumRemovesAds: this.premiumRemovesAds(),
      levelsPlayedSinceAd: this.levelsPlayedSinceAd,
      totalLevelsPlayed: this.totalLevelsPlayed,
      skipCredits: this.getSkipCredits(),
      lastAdTime: this.lastAdTime,
      shouldShowInterstitial: this.shouldShowInterstitial(),
      configCount: this.config.size
    }
  }
}

export const AdManager = new AdManagerClass()
