/**
 * AdSkipManager - Manages ad-skip credits earned through gameplay achievements
 * 
 * Credits can be earned by:
 * 1. Hole-in-one: Completing a level without dying (first attempt)
 * 2. Speedrun: Completing a level under the target time
 * 
 * Credits can be spent to skip interstitial ads between levels
 */

import gameConfig from "./gameConfig.json"

const STORAGE_KEY = "diminished_chord_ad_skip_credits"
const ACHIEVEMENTS_KEY = "diminished_chord_level_achievements"

export const AdSkipManager = {
  /**
   * Get current ad-skip credit balance
   * @returns {number}
   */
  getCredits() {
    try {
      const credits = localStorage.getItem(STORAGE_KEY)
      return credits ? parseInt(credits, 10) : 0
    } catch (e) {
      console.error("Error reading ad-skip credits:", e)
      return 0
    }
  },

  /**
   * Set ad-skip credit balance
   * @param {number} amount
   */
  setCredits(amount) {
    try {
      localStorage.setItem(STORAGE_KEY, Math.max(0, amount).toString())
    } catch (e) {
      console.error("Error saving ad-skip credits:", e)
    }
  },

  /**
   * Add credits to the balance
   * @param {number} amount
   */
  addCredits(amount = 1) {
    const current = this.getCredits()
    this.setCredits(current + amount)
  },

  /**
   * Use a credit to skip an ad
   * @returns {boolean} True if credit was used, false if none available
   */
  useCredit() {
    const current = this.getCredits()
    if (current > 0) {
      this.setCredits(current - 1)
      return true
    }
    return false
  },

  /**
   * Check if player has credits available
   * @returns {boolean}
   */
  hasCredits() {
    return this.getCredits() > 0
  },

  // ==========================================
  // Achievement Tracking
  // ==========================================

  /**
   * Get all level achievements
   * @returns {object}
   */
  getAchievements() {
    try {
      const data = localStorage.getItem(ACHIEVEMENTS_KEY)
      return data ? JSON.parse(data) : {}
    } catch (e) {
      console.error("Error reading achievements:", e)
      return {}
    }
  },

  /**
   * Save achievements
   * @param {object} achievements
   */
  saveAchievements(achievements) {
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements))
    } catch (e) {
      console.error("Error saving achievements:", e)
    }
  },

  /**
   * Check if hole-in-one was already achieved for a level
   * @param {string} levelKey
   * @returns {boolean}
   */
  hasHoleInOne(levelKey) {
    const achievements = this.getAchievements()
    return achievements[levelKey]?.holeInOne === true
  },

  /**
   * Check if speedrun was already achieved for a level
   * @param {string} levelKey
   * @returns {boolean}
   */
  hasSpeedrun(levelKey) {
    const achievements = this.getAchievements()
    return achievements[levelKey]?.speedrun === true
  },

  /**
   * Record a hole-in-one achievement
   * @param {string} levelKey
   * @returns {boolean} True if this is a NEW achievement (credit awarded)
   */
  recordHoleInOne(levelKey) {
    if (!gameConfig.adConfig.holeInOneEnabled.value) {
      return false
    }

    if (this.hasHoleInOne(levelKey)) {
      return false // Already achieved
    }

    const achievements = this.getAchievements()
    if (!achievements[levelKey]) {
      achievements[levelKey] = {}
    }
    achievements[levelKey].holeInOne = true
    this.saveAchievements(achievements)

    // Award credit
    this.addCredits(gameConfig.adConfig.adSkipCreditsPerReward.value)
    return true
  },

  /**
   * Record a speedrun achievement
   * @param {string} levelKey
   * @param {number} timeSeconds - Time taken to complete the level
   * @returns {boolean} True if this is a NEW achievement (credit awarded)
   */
  recordSpeedrun(levelKey, timeSeconds) {
    if (!gameConfig.adConfig.speedrunEnabled.value) {
      return false
    }

    // Get target time for this level
    const targetConfig = gameConfig.speedrunTargets[levelKey]
    if (!targetConfig) {
      return false
    }

    const targetTime = targetConfig.value
    if (timeSeconds > targetTime) {
      return false // Didn't beat the target
    }

    if (this.hasSpeedrun(levelKey)) {
      return false // Already achieved
    }

    const achievements = this.getAchievements()
    if (!achievements[levelKey]) {
      achievements[levelKey] = {}
    }
    achievements[levelKey].speedrun = true
    achievements[levelKey].bestTime = timeSeconds
    this.saveAchievements(achievements)

    // Award credit
    this.addCredits(gameConfig.adConfig.adSkipCreditsPerReward.value)
    return true
  },

  /**
   * Get the speedrun target time for a level
   * @param {string} levelKey
   * @returns {number|null}
   */
  getSpeedrunTarget(levelKey) {
    const targetConfig = gameConfig.speedrunTargets[levelKey]
    return targetConfig ? targetConfig.value : null
  },

  /**
   * Get best time for a level
   * @param {string} levelKey
   * @returns {number|null}
   */
  getBestTime(levelKey) {
    const achievements = this.getAchievements()
    return achievements[levelKey]?.bestTime || null
  },

  /**
   * Check and award achievements after level completion
   * @param {string} levelKey
   * @param {number} deathCount
   * @param {number} timeSeconds
   * @returns {object} { holeInOne: boolean, speedrun: boolean, creditsEarned: number }
   */
  checkAndAwardAchievements(levelKey, deathCount, timeSeconds) {
    const result = {
      holeInOne: false,
      speedrun: false,
      creditsEarned: 0,
      newHoleInOne: false,
      newSpeedrun: false
    }

    // Check hole-in-one (no deaths)
    if (deathCount === 0) {
      result.holeInOne = true
      result.newHoleInOne = this.recordHoleInOne(levelKey)
      if (result.newHoleInOne) {
        result.creditsEarned += gameConfig.adConfig.adSkipCreditsPerReward.value
      }
    }

    // Check speedrun
    const targetTime = this.getSpeedrunTarget(levelKey)
    if (targetTime && timeSeconds <= targetTime) {
      result.speedrun = true
      result.newSpeedrun = this.recordSpeedrun(levelKey, timeSeconds)
      if (result.newSpeedrun) {
        result.creditsEarned += gameConfig.adConfig.adSkipCreditsPerReward.value
      }
    }

    return result
  },

  /**
   * Check if ads should be shown (based on config)
   * @returns {boolean}
   */
  shouldShowAds() {
    return gameConfig.adConfig.showInterstitialAds.value
  },

  /**
   * Reset all achievements and credits (for testing)
   */
  reset() {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ACHIEVEMENTS_KEY)
  }
}
