/**
 * AudioManager - Global audio settings manager
 * Handles SFX and Music volume separately with persistence
 */
class AudioManagerClass {
  constructor() {
    // Default volumes
    this.sfxVolume = 0.5
    this.musicVolume = 0.6
    
    // Load saved settings
    this.loadSettings()
  }

  /**
   * Load audio settings from localStorage
   */
  loadSettings() {
    const saved = localStorage.getItem("diminished_chord_audio_settings")
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        this.sfxVolume = settings.sfxVolume ?? 0.5
        this.musicVolume = settings.musicVolume ?? 0.6
      } catch (e) {
        console.error("[AudioManager] Failed to load settings:", e)
      }
    }
  }

  /**
   * Save audio settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem("diminished_chord_audio_settings", JSON.stringify({
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume
      }))
    } catch (e) {
      console.error("[AudioManager] Failed to save settings:", e)
    }
  }

  /**
   * Get SFX volume (0-1)
   */
  getSfxVolume() {
    return this.sfxVolume
  }

  /**
   * Set SFX volume (0-1)
   */
  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume))
    this.saveSettings()
  }

  /**
   * Get music volume (0-1)
   */
  getMusicVolume() {
    return this.musicVolume
  }

  /**
   * Set music volume (0-1) and update BGM if playing
   */
  setMusicVolume(volume, bgmManager = null) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    this.saveSettings()
    
    // Update currently playing BGM if manager is provided
    if (bgmManager) {
      bgmManager.setVolume(this.musicVolume)
    }
  }

  /**
   * Play a sound effect with proper volume scaling
   * @param {Phaser.Scene} scene - The scene to play sound in
   * @param {string} key - The audio key
   * @param {number} baseVolume - Base volume (will be scaled by sfxVolume)
   * @param {object} config - Additional sound config
   */
  playSfx(scene, key, baseVolume = 0.5, config = {}) {
    const finalVolume = baseVolume * this.sfxVolume
    scene.sound.play(key, { ...config, volume: finalVolume })
  }

  /**
   * Get scaled SFX volume for manual playback
   * @param {number} baseVolume - The base volume to scale
   * @returns {number} Scaled volume
   */
  getScaledSfxVolume(baseVolume = 0.5) {
    return baseVolume * this.sfxVolume
  }
}

// Singleton instance
export const AudioManager = new AudioManagerClass()
