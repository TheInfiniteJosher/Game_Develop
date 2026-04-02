import Phaser from "phaser"
import { musicManager, MENU_KEYS } from "./MusicTrackManager.js"
import { AudioManager } from "./AudioManager.js"
import { AudioStorageDB } from "./AudioStorageDB.js"
import { SupabaseMusicManager } from "./SupabaseMusicManager.js"

/**
 * BGMManager - Global background music manager
 * Handles music playback across all scenes with smooth transitions
 */
class BGMManagerClass {
  constructor() {
    this.currentBgm = null
    this.currentAudioKey = null
    this.currentScene = null
    this.currentLevelKey = null // Track which level the music is for
    this.volume = AudioManager.getMusicVolume() // Use AudioManager for initial volume
    this.baseVolume = this.volume // Store base volume before ducking
    this.isDucked = false // Track if volume is currently ducked
    this.isDevMode = false // Flag to track if we're in dev mode menus
  }

  /**
   * Initialize the manager with a scene reference
   */
  init(scene) {
    this.currentScene = scene
  }

  /**
   * Play menu music for a specific menu type
   * @param {Phaser.Scene} scene - The scene to play music in
   * @param {string} menuKey - The menu key from MENU_KEYS
   */
  async playMenuMusic(scene, menuKey) {
    // Ensure Supabase is initialized before checking for assignments
    if (!SupabaseMusicManager.isInitialized) {
      console.log(`[BGMManager] Waiting for Supabase to initialize for menu: ${menuKey}`)
      try {
        await SupabaseMusicManager.initialize()
      } catch (e) {
        console.warn(`[BGMManager] Supabase init failed:`, e)
      }
    }
    
    // Check Supabase for a track assignment (highest priority)
    const supabaseAssignment = SupabaseMusicManager.getLevelTrack(menuKey)
    console.log(`[BGMManager] Supabase assignment for ${menuKey}:`, supabaseAssignment)
    
    if (supabaseAssignment?.track?.file_url) {
      // Validate the URL before attempting to use it
      const fileUrl = supabaseAssignment.track.file_url
      if (fileUrl && typeof fileUrl === 'string' && fileUrl.trim() !== '') {
        console.log(`[BGMManager] Playing Supabase track for menu ${menuKey}: ${supabaseAssignment.track.name}`)
        const audioKey = `supabase_menu_bgm_${supabaseAssignment.trackId}`
        const volume = supabaseAssignment.volume || 0.6
        
        // Temporarily set volume for this track
        const originalVolume = this.volume
        this.volume = volume * AudioManager.getMusicVolume()
        
        this.playMusic(scene, audioKey, fileUrl, supabaseAssignment.loop !== false)
        
        // Restore original volume setting
        this.volume = originalVolume
        return
      } else {
        console.warn(`[BGMManager] Supabase track for ${menuKey} has invalid URL, falling back`)
      }
    }
    
    // Fall back to local storage (IndexedDB)
    if (musicManager.isMenuMusicInStorage(menuKey)) {
      const storageValue = musicManager.getMenuMusicStorageValue(menuKey)
      const storageKey = storageValue.replace("indexeddb:", "")
      
      try {
        // Load from IndexedDB and cache the blob URL
        const blobUrl = await AudioStorageDB.getAudioUrl(storageKey)
        if (blobUrl) {
          musicManager.setMenuMusicBlobUrl(menuKey, blobUrl)
          console.log(`[BGMManager] Loaded menu music from IndexedDB: ${menuKey}`)
        }
      } catch (error) {
        console.error(`[BGMManager] Failed to load menu music from IndexedDB:`, error)
        this.stop()
        return
      }
    }
    
    const audioUrl = musicManager.getMenuMusic(menuKey)
    
    if (!audioUrl) {
      // No menu music assigned, stop any current music
      console.log(`[BGMManager] No music assigned for menu: ${menuKey}`)
      this.stop()
      return
    }

    const audioKey = `menu_bgm_${menuKey}`
    this.playMusic(scene, audioKey, audioUrl, true)
  }

  /**
   * Play level background music
   * @param {Phaser.Scene} scene - The scene to play music in
   * @param {string} levelKey - The level scene key
   */
  async playLevelMusic(scene, levelKey) {
    // If music for this level is already playing, don't restart it
    if (this.shouldContinueMusicForLevel(levelKey)) {
      console.log(`[BGMManager] Music for ${levelKey} already playing, continuing...`)
      // Update scene reference in case it changed
      this.currentScene = scene
      // Unduck volume when returning to gameplay
      this.unduckVolume()
      return
    }
    
    // First, check Supabase for a track assignment (highest priority)
    const supabaseAssignment = SupabaseMusicManager.getLevelTrack(levelKey)
    
    if (supabaseAssignment?.track?.file_url) {
      console.log(`[BGMManager] Playing Supabase track for ${levelKey}: ${supabaseAssignment.track.name}`)
      const audioKey = `supabase_bgm_${supabaseAssignment.trackId}`
      const volume = supabaseAssignment.volume || 0.6
      
      // Temporarily set volume for this track
      const originalVolume = this.volume
      this.volume = volume * AudioManager.getMusicVolume()
      
      this.playMusic(scene, audioKey, supabaseAssignment.track.file_url, supabaseAssignment.loop !== false)
      this.currentLevelKey = levelKey
      
      // Restore original volume setting
      this.volume = originalVolume
      return
    }
    
    // Fall back to local track database
    const levelTrack = musicManager.getTrackForLevel(levelKey)
    
    if (!levelTrack) {
      console.log(`No track assigned for ${levelKey}`)
      this.stop()
      return
    }
    
    // Check if we need to load from IndexedDB
    if (levelTrack.storageKey) {
      try {
        const blobUrl = await AudioStorageDB.getAudioUrl(levelTrack.storageKey)
        if (blobUrl) {
          levelTrack.audioUrl = blobUrl
          console.log(`[BGMManager] Loaded level music from IndexedDB: ${levelKey}`)
        }
      } catch (error) {
        console.error(`[BGMManager] Failed to load level music from IndexedDB:`, error)
      }
    }
    
    if (!levelTrack.audioUrl) {
      console.log(`No background music assigned for ${levelKey}`)
      this.stop()
      return
    }

    const audioKey = `level_bgm_${levelTrack.id}`
    this.playMusic(scene, audioKey, levelTrack.audioUrl, true)
    this.currentLevelKey = levelKey
  }

  /**
   * Core music playback method
   */
  playMusic(scene, audioKey, audioUrl, loop = true) {
    // If same music is already playing, don't restart
    if (this.currentAudioKey === audioKey && this.currentBgm && this.currentBgm.isPlaying) {
      return
    }

    // Validate URL before attempting to load
    if (!audioUrl || typeof audioUrl !== 'string' || audioUrl.trim() === '') {
      console.warn(`[BGMManager] Invalid audio URL for ${audioKey}, skipping`)
      return
    }

    // Stop current music
    this.stop()

    // Store reference to current scene
    this.currentScene = scene

    // Check if audio is already cached
    if (scene.cache.audio.exists(audioKey)) {
      this.startPlayback(scene, audioKey, loop)
    } else {
      // Track if this specific file had a load error
      let loadFailed = false
      
      // Load dynamically
      scene.load.audio(audioKey, audioUrl)
      
      // Handle file-specific errors - use silent warning instead of error
      const onFileError = (file) => {
        if (file.key === audioKey) {
          loadFailed = true
          // Log as warning, not error - music failing to load shouldn't alarm users
          console.warn(`[BGMManager] Music unavailable: ${audioKey} - continuing without music`)
        }
      }
      scene.load.once("loaderror", onFileError)
      
      scene.load.once("complete", () => {
        // Clean up the error listener
        scene.load.off("loaderror", onFileError)
        
        // Only start playback if the file loaded successfully
        if (!loadFailed && scene.cache.audio.exists(audioKey)) {
          this.startPlayback(scene, audioKey, loop)
        }
        // Silently continue if music failed - game works fine without it
      })
      scene.load.start()
    }
  }

  /**
   * Start playback of loaded audio
   */
  startPlayback(scene, audioKey, loop) {
    // Double-check the audio exists in cache before playing
    if (!scene.cache.audio.exists(audioKey)) {
      console.error(`[BGMManager] Cannot play audio - key "${audioKey}" not found in cache`)
      return
    }
    
    // Always use the latest volume from AudioManager
    this.volume = AudioManager.getMusicVolume()
    this.baseVolume = this.volume
    this.isDucked = false
    
    try {
      this.currentBgm = scene.sound.add(audioKey, { volume: this.volume, loop })
      this.currentBgm.play()
      this.currentAudioKey = audioKey
    } catch (error) {
      console.error(`[BGMManager] Error playing audio ${audioKey}:`, error)
      this.currentBgm = null
      this.currentAudioKey = null
    }
  }

  /**
   * Stop current background music
   */
  stop() {
    if (this.currentBgm) {
      this.currentBgm.stop()
      this.currentBgm.destroy()
      this.currentBgm = null
      this.currentAudioKey = null
      this.currentLevelKey = null
      this.isDucked = false
    }
  }

  /**
   * Pause current background music
   */
  pause() {
    if (this.currentBgm && this.currentBgm.isPlaying) {
      this.currentBgm.pause()
    }
  }

  /**
   * Resume paused background music
   */
  resume() {
    if (this.currentBgm && this.currentBgm.isPaused) {
      this.currentBgm.resume()
    }
  }

  /**
   * Set volume
   */
  setVolume(volume) {
    this.volume = volume
    this.baseVolume = volume
    if (this.currentBgm) {
      // If ducked, apply the duck ratio to the new volume
      if (this.isDucked) {
        this.currentBgm.setVolume(volume * 0.8) // 20% duck
      } else {
        this.currentBgm.setVolume(volume)
      }
    }
  }

  /**
   * Duck the volume by 20% (for victory screens, etc.)
   */
  duckVolume() {
    if (!this.isDucked && this.currentBgm) {
      this.isDucked = true
      const duckedVolume = this.volume * 0.8 // 20% reduction
      this.currentBgm.setVolume(duckedVolume)
    }
  }

  /**
   * Restore volume to normal (unduck)
   */
  unduckVolume() {
    if (this.isDucked && this.currentBgm) {
      this.isDucked = false
      this.currentBgm.setVolume(this.volume)
    }
  }

  /**
   * Get the current level key that music is playing for
   */
  getCurrentLevelKey() {
    return this.currentLevelKey
  }

  /**
   * Check if music should continue for a given level key
   * (i.e., if we're retrying the same level)
   */
  shouldContinueMusicForLevel(levelKey) {
    return this.currentLevelKey === levelKey && this.currentBgm && (this.currentBgm.isPlaying || this.currentBgm.isPaused)
  }

  /**
   * Check if music is currently playing
   */
  isPlaying() {
    return this.currentBgm && this.currentBgm.isPlaying
  }

  /**
   * Check if music is paused
   */
  isPaused() {
    return this.currentBgm && this.currentBgm.isPaused
  }

  /**
   * Get current BGM reference (for victory screen to take control)
   */
  getCurrentBgm() {
    return this.currentBgm
  }

  /**
   * Transfer BGM control to another handler (for victory screen)
   * Returns the current BGM and clears local reference so it won't be stopped
   */
  transferControl() {
    const bgm = this.currentBgm
    this.currentBgm = null
    this.currentAudioKey = null
    return bgm
  }

  /**
   * Set dev mode flag (affects which scenes play menu vs level music)
   */
  setDevMode(isDevMode) {
    this.isDevMode = isDevMode
  }

  /**
   * Check if in dev mode
   */
  getDevMode() {
    return this.isDevMode
  }
}

// Singleton instance
export const BGMManager = new BGMManagerClass()
export { MENU_KEYS }
