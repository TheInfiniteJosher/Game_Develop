/**
 * TrackDataManager - Manages music track data and assignments for 301 levels
 * 
 * Tracks can be assigned via:
 * 1. External URLs (hosted on CDN) - Persists for all users
 * 2. Bundled in public/assets/audio/ - Persists for all users
 * 3. IndexedDB (local uploads) - Only works for current browser
 * 
 * For production: Export track assignments as JSON and host audio on CDN
 */

import { getAllLevelIds, parseLevelId, WORLDS, LEVEL_TYPES } from "./WorldManager.js"
import { AudioStorageDB } from "./AudioStorageDB.js"

// Track assignment storage
const TRACK_ASSIGNMENTS = {}

// Default track metadata template
const DEFAULT_TRACK_META = {
  title: "Untitled Track",
  artist: "The Diminished Chord",
  album: "Volume 1",
  genre: "Punk Rock",
  duration: "0:00",
  audioUrl: null,
  storageKey: null,  // For IndexedDB stored files
  fileName: null,
  isUnlocked: false
}

/**
 * Generate track ID from level ID
 */
export function getTrackIdForLevel(levelId) {
  return `track_${levelId}`
}

/**
 * TrackDataManager class
 */
class TrackDataManagerClass {
  constructor() {
    this.tracks = new Map()
    this.menuMusic = {
      intro: null,
      main_menu: null,
      dev_mode: null,
      music_library: null
    }
    this.menuMusicBlobUrls = {} // Runtime blob URLs
    this.initialized = false
  }

  /**
   * Initialize track data for all 301 levels
   */
  async initialize() {
    if (this.initialized) return
    
    // Generate default track entries for all levels
    const allLevelIds = getAllLevelIds()
    for (const levelId of allLevelIds) {
      const trackId = getTrackIdForLevel(levelId)
      this.tracks.set(trackId, this.generateDefaultTrack(levelId, trackId))
    }

    // Load saved assignments from localStorage
    this.loadFromLocalStorage()

    // Load audio URLs from IndexedDB for any stored tracks
    await this.loadStoredAudioUrls()

    this.initialized = true
    console.log(`[TrackDataManager] Initialized ${this.tracks.size} tracks`)
  }

  /**
   * Generate default track metadata based on level
   */
  generateDefaultTrack(levelId, trackId) {
    const parsed = parseLevelId(levelId)
    const track = { ...DEFAULT_TRACK_META }
    
    if (levelId === "Tutorial") {
      track.title = "First Steps"
      track.genre = "Acoustic"
      return track
    }
    
    const world = WORLDS[parsed.world]
    if (!world) return track
    
    // Generate track name based on world and level
    if (parsed.type === LEVEL_TYPES.NORMAL) {
      track.title = `${world.location} - Part ${parsed.level}`
      track.genre = this.getGenreForWorld(parsed.world)
    } else if (parsed.type === LEVEL_TYPES.BONUS) {
      const bonusNames = ["Remix", "Live Cut", "Instrumental", "Hardcore Mix", "Demo Session"]
      track.title = `${world.location} ${bonusNames[parsed.level - 1] || "Bonus"}`
      track.genre = "Bonus"
    } else if (parsed.type === LEVEL_TYPES.BOSS) {
      track.title = `${world.bossName} Theme`
      track.genre = "Boss Battle"
    }
    
    track.album = `Act ${world.act}`
    
    return track
  }

  getGenreForWorld(worldNum) {
    const genres = [
      "Garage Rock",    // Detroit
      "Industrial",     // Berlin
      "J-Rock",         // Tokyo
      "Punk",           // London
      "Festival Rock",  // Festival
      "Post-Rock",      // Reykjavik
      "Pop Metal",      // LA
      "Arena Rock",     // Sydney
      "Alternative",    // NYC
      "Dark Wave",      // Contract
      "Psychedelic",    // Doubt
      "Progressive",    // Time
      "Noise Rock",     // Noise
      "Acoustic",       // Clarity
      "Epic Metal"      // Finale
    ]
    return genres[worldNum - 1] || "Rock"
  }

  /**
   * Load saved assignments from localStorage
   */
  loadFromLocalStorage() {
    try {
      // Load track assignments
      const saved = localStorage.getItem("tdc_track_assignments")
      if (saved) {
        const data = JSON.parse(saved)
        Object.entries(data).forEach(([trackId, assignment]) => {
          if (this.tracks.has(trackId)) {
            const track = this.tracks.get(trackId)
            Object.assign(track, assignment)
          }
        })
      }
      
      // Load menu music assignments
      const menuSaved = localStorage.getItem("tdc_menu_music")
      if (menuSaved) {
        Object.assign(this.menuMusic, JSON.parse(menuSaved))
      }
      
      console.log("[TrackDataManager] Loaded from localStorage")
    } catch (e) {
      console.error("[TrackDataManager] Failed to load from localStorage:", e)
    }
  }

  /**
   * Save assignments to localStorage
   */
  saveToLocalStorage() {
    try {
      // Save track assignments (only modified ones)
      const assignments = {}
      this.tracks.forEach((track, trackId) => {
        if (track.audioUrl || track.storageKey || track.title !== DEFAULT_TRACK_META.title) {
          assignments[trackId] = {
            title: track.title,
            artist: track.artist,
            album: track.album,
            genre: track.genre,
            duration: track.duration,
            audioUrl: track.audioUrl && !track.audioUrl.startsWith("blob:") ? track.audioUrl : null,
            storageKey: track.storageKey,
            fileName: track.fileName,
            isUnlocked: track.isUnlocked
          }
        }
      })
      localStorage.setItem("tdc_track_assignments", JSON.stringify(assignments))
      
      // Save menu music
      localStorage.setItem("tdc_menu_music", JSON.stringify(this.menuMusic))
      
      console.log("[TrackDataManager] Saved to localStorage")
    } catch (e) {
      console.error("[TrackDataManager] Failed to save to localStorage:", e)
    }
  }

  /**
   * Load blob URLs from IndexedDB for stored tracks
   */
  async loadStoredAudioUrls() {
    const tracksWithStorage = []
    
    this.tracks.forEach((track, trackId) => {
      if (track.storageKey) {
        tracksWithStorage.push({ trackId, storageKey: track.storageKey })
      }
    })
    
    // Also check menu music
    Object.entries(this.menuMusic).forEach(([menuKey, value]) => {
      if (value && value.startsWith("indexeddb:")) {
        tracksWithStorage.push({ 
          menuKey, 
          storageKey: value.replace("indexeddb:", "")
        })
      }
    })
    
    for (const item of tracksWithStorage) {
      try {
        const blobUrl = await AudioStorageDB.getAudioUrl(item.storageKey)
        if (blobUrl) {
          if (item.trackId) {
            const track = this.tracks.get(item.trackId)
            if (track) track.audioUrl = blobUrl
          } else if (item.menuKey) {
            this.menuMusicBlobUrls[item.menuKey] = blobUrl
          }
        }
      } catch (e) {
        console.warn(`[TrackDataManager] Failed to load stored audio: ${item.storageKey}`)
      }
    }
  }

  /**
   * Get track data by track ID
   */
  getTrack(trackId) {
    return this.tracks.get(trackId) || null
  }

  /**
   * Get track for a level
   */
  getTrackForLevel(levelId) {
    const trackId = getTrackIdForLevel(levelId)
    return this.getTrack(trackId)
  }

  /**
   * Set track audio URL (external URL)
   */
  setTrackUrl(trackId, url) {
    const track = this.tracks.get(trackId)
    if (track) {
      track.audioUrl = url
      track.storageKey = null // Clear storage key when using URL
      this.saveToLocalStorage()
    }
  }

  /**
   * Store track audio in IndexedDB
   */
  async storeTrackAudio(trackId, file) {
    const track = this.tracks.get(trackId)
    if (!track) return false
    
    const storageKey = `audio_${trackId}`
    
    try {
      await AudioStorageDB.storeAudio(storageKey, file, "track", {
        fileName: file.name,
        trackId
      })
      
      const blobUrl = await AudioStorageDB.getAudioUrl(storageKey)
      
      track.audioUrl = blobUrl
      track.storageKey = storageKey
      track.fileName = file.name
      
      this.saveToLocalStorage()
      return true
    } catch (e) {
      console.error(`[TrackDataManager] Failed to store track audio:`, e)
      return false
    }
  }

  /**
   * Update track metadata
   */
  updateTrackMeta(trackId, meta) {
    const track = this.tracks.get(trackId)
    if (track) {
      Object.assign(track, meta)
      this.saveToLocalStorage()
    }
  }

  /**
   * Get menu music URL
   */
  getMenuMusic(menuKey) {
    // Return blob URL if available (for IndexedDB stored audio)
    if (this.menuMusicBlobUrls[menuKey]) {
      return this.menuMusicBlobUrls[menuKey]
    }
    
    const value = this.menuMusic[menuKey]
    // Don't return indexeddb: markers
    if (value && value.startsWith("indexeddb:")) {
      return null
    }
    return value
  }

  /**
   * Set menu music URL
   */
  setMenuMusic(menuKey, url) {
    this.menuMusic[menuKey] = url
    this.saveToLocalStorage()
  }

  /**
   * Store menu music in IndexedDB
   */
  async storeMenuMusic(menuKey, file) {
    const storageKey = `menu_${menuKey}`
    
    try {
      await AudioStorageDB.storeAudio(storageKey, file, "menu", {
        fileName: file.name,
        menuKey
      })
      
      const blobUrl = await AudioStorageDB.getAudioUrl(storageKey)
      
      this.menuMusic[menuKey] = `indexeddb:${storageKey}`
      this.menuMusicBlobUrls[menuKey] = blobUrl
      
      this.saveToLocalStorage()
      return true
    } catch (e) {
      console.error(`[TrackDataManager] Failed to store menu music:`, e)
      return false
    }
  }

  /**
   * Export all track assignments as JSON (for bundling)
   */
  exportAssignments() {
    const data = {
      tracks: {},
      menuMusic: { ...this.menuMusic }
    }
    
    this.tracks.forEach((track, trackId) => {
      // Only export if has URL (not blob URLs or storage keys)
      if (track.audioUrl && !track.audioUrl.startsWith("blob:")) {
        data.tracks[trackId] = {
          title: track.title,
          artist: track.artist,
          album: track.album,
          genre: track.genre,
          duration: track.duration,
          audioUrl: track.audioUrl,
          fileName: track.fileName
        }
      }
    })
    
    // Clean menu music of indexeddb: markers
    Object.keys(data.menuMusic).forEach(key => {
      if (data.menuMusic[key] && data.menuMusic[key].startsWith("indexeddb:")) {
        data.menuMusic[key] = null
      }
    })
    
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import track assignments from JSON
   */
  importAssignments(jsonString) {
    try {
      const data = JSON.parse(jsonString)
      
      if (data.tracks) {
        Object.entries(data.tracks).forEach(([trackId, trackData]) => {
          if (this.tracks.has(trackId)) {
            Object.assign(this.tracks.get(trackId), trackData)
          }
        })
      }
      
      if (data.menuMusic) {
        Object.assign(this.menuMusic, data.menuMusic)
      }
      
      this.saveToLocalStorage()
      return true
    } catch (e) {
      console.error("[TrackDataManager] Failed to import assignments:", e)
      return false
    }
  }

  /**
   * Get all tracks as array (for listing)
   */
  getAllTracks() {
    return Array.from(this.tracks.entries()).map(([id, data]) => ({
      id,
      ...data
    }))
  }

  /**
   * Get tracks for a specific world
   */
  getTracksForWorld(worldNum) {
    const tracks = []
    
    // Normal levels
    for (let i = 1; i <= 14; i++) {
      const levelId = `W${worldNum}L${i}`
      const trackId = getTrackIdForLevel(levelId)
      const track = this.tracks.get(trackId)
      if (track) tracks.push({ id: trackId, levelId, type: "normal", ...track })
    }
    
    // Bonus levels
    for (let i = 1; i <= 5; i++) {
      const levelId = `W${worldNum}B${i}`
      const trackId = getTrackIdForLevel(levelId)
      const track = this.tracks.get(trackId)
      if (track) tracks.push({ id: trackId, levelId, type: "bonus", ...track })
    }
    
    // Boss level
    const bossLevelId = `W${worldNum}BOSS`
    const bossTrackId = getTrackIdForLevel(bossLevelId)
    const bossTrack = this.tracks.get(bossTrackId)
    if (bossTrack) tracks.push({ id: bossTrackId, levelId: bossLevelId, type: "boss", ...bossTrack })
    
    return tracks
  }

  /**
   * Get total track count
   */
  getTotalTracks() {
    return this.tracks.size
  }

  /**
   * Get count of tracks with assigned audio
   */
  getAssignedCount() {
    let count = 0
    this.tracks.forEach(track => {
      if (track.audioUrl) count++
    })
    return count
  }
}

// Singleton instance
export const TrackDataManager = new TrackDataManagerClass()
