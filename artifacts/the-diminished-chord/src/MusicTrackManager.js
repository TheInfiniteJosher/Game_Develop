/**
 * MusicTrackManager - Manages tracks, fragments, and unlocking
 * Designed for easy drag-and-drop track management by the developer
 * 
 * HYBRID STORAGE MODEL:
 * - Primary: Supabase database (shared across all users)
 * - Fallback: localStorage + IndexedDB (local browser storage)
 * - Tracks from Supabase are merged with local TRACK_DATABASE
 */

import { SupabaseMusicManager } from "./SupabaseMusicManager.js"

// Track database - Easy to configure!
// Add your tracks here. Each track has fragments scattered across levels.
export const TRACK_DATABASE = {
  // Track ID -> Track Info
  "track_001": {
    title: "Chaos Theory",
    artist: "The Diminished Chord",
    album: "Volume 1",
    genre: "Punk Rock",
    duration: "3:42",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level1Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [], // Array of { label: "Spotify", url: "https://..." }
    isUnlocked: false
  },
  "track_002": {
    title: "Neon Wasteland",
    artist: "The Diminished Chord",
    album: "Volume 1",
    genre: "Metal",
    duration: "4:15",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level2Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_003": {
    title: "Vertical Assault",
    artist: "The Diminished Chord",
    album: "Volume 1",
    genre: "Thrash",
    duration: "3:58",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level3Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_004": {
    title: "Corridor of Pain",
    artist: "The Diminished Chord",
    album: "Volume 1",
    genre: "Hardcore",
    duration: "3:22",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level4Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_005": {
    title: "Gauntlet Run",
    artist: "The Diminished Chord",
    album: "Volume 1",
    genre: "Speed Metal",
    duration: "4:45",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level5Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_006": {
    title: "Tower of Doom",
    artist: "The Diminished Chord",
    album: "Volume 2",
    genre: "Doom Metal",
    duration: "5:12",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level6Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_007": {
    title: "Blade Runner",
    artist: "The Diminished Chord",
    album: "Volume 2",
    genre: "Industrial",
    duration: "4:08",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level7Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_008": {
    title: "Maze of Madness",
    artist: "The Diminished Chord",
    album: "Volume 2",
    genre: "Progressive Metal",
    duration: "6:33",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level8Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_009": {
    title: "Precision Strike",
    artist: "The Diminished Chord",
    album: "Volume 2",
    genre: "Technical Death",
    duration: "4:27",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level9Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_010": {
    title: "Descent into Darkness",
    artist: "The Diminished Chord",
    album: "Volume 3",
    genre: "Black Metal",
    duration: "5:55",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level10Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  },
  "track_011": {
    title: "The Final Chord",
    artist: "The Diminished Chord",
    album: "Volume 3",
    genre: "Epic Metal",
    duration: "7:42",
    audioUrl: null,
    previewUrl: null,
    coverUrl: null,
    levelKey: "Level11Scene",
    requiredFragments: ["drums", "bass", "guitar", "note"],
    price: 0.99,
    spotifyUrl: null,
    appleMusicUrl: null,
    bandcampUrl: null,
    externalLinks: [],
    isUnlocked: false
  }
}

// Level -> Track mapping for quick lookup
export const LEVEL_TRACKS = {
  "Level1Scene": "track_001",
  "Level2Scene": "track_002",
  "Level3Scene": "track_003",
  "Level4Scene": "track_004",
  "Level5Scene": "track_005",
  "Level6Scene": "track_006",
  "Level7Scene": "track_007",
  "Level8Scene": "track_008",
  "Level9Scene": "track_009",
  "Level10Scene": "track_010",
  "Level11Scene": "track_011"
}

/**
 * MusicTrackManager class
 */
export class MusicTrackManager {
  constructor() {
    // Track if defaults have been loaded
    this.defaultsLoaded = false
    
    // Supabase tracks merged into local database
    this.supabaseTracksLoaded = false
    
    // Load saved progress from localStorage (after defaults are loaded)
    this.loadProgress()
    
    // Current level's collected fragments
    this.currentLevelFragments = {
      drums: false,
      bass: false,
      guitar: false,
      note: false
    }
  }

  /**
   * Load track assignments from multiple sources in priority order:
   * 1. Supabase database (highest priority - shared across all users)
   * 2. Remote config URL (if set) - allows live updates
   * 3. Bundled default-track-assignments.json - fallback for production
   * 4. localStorage - user's local overrides
   * 
   * This should be called once during game initialization (e.g., in Preloader)
   */
  async loadDefaultAssignments() {
    if (this.defaultsLoaded) return
    
    // First, load from Supabase (highest priority)
    await this.loadFromSupabase()
    
    // Then, try to load from remote config URL (if set)
    const remoteConfigUrl = localStorage.getItem("tdc_remote_config_url")
    if (remoteConfigUrl) {
      try {
        console.log("[MusicTrackManager] Fetching remote config from:", remoteConfigUrl)
        const response = await fetch(remoteConfigUrl, { cache: "no-store" })
        if (response.ok) {
          const remoteConfig = await response.json()
          this.applyConfigData(remoteConfig, "remote")
          console.log("[MusicTrackManager] Remote config loaded successfully!")
        }
      } catch (e) {
        console.warn("[MusicTrackManager] Failed to fetch remote config:", e)
      }
    }
    
    // Then, load bundled defaults (won't override remote config values)
    try {
      const response = await fetch("assets/default-track-assignments.json")
      if (response.ok) {
        const defaults = await response.json()
        this.applyConfigData(defaults, "bundled")
        console.log("[MusicTrackManager] Bundled defaults loaded successfully")
      }
    } catch (e) {
      console.warn("[MusicTrackManager] Failed to load bundled defaults:", e)
    }
    
    this.defaultsLoaded = true
    
    // Finally, re-load localStorage to apply user's local overrides
    this.loadProgress()
  }
  
  /**
   * Load tracks and assignments from Supabase database
   */
  async loadFromSupabase() {
    try {
      // Initialize Supabase music manager
      await SupabaseMusicManager.initialize()
      
      // Merge Supabase tracks into local TRACK_DATABASE
      const supabaseTracks = SupabaseMusicManager.getAllTracks()
      let mergedCount = 0
      
      supabaseTracks.forEach(track => {
        // Create a local track ID based on Supabase ID
        const localTrackId = `supabase_${track.id}`
        
        // Add to TRACK_DATABASE if not already present
        if (!TRACK_DATABASE[localTrackId]) {
          TRACK_DATABASE[localTrackId] = {
            title: track.name,
            artist: track.artist || "The Diminished Chord",
            album: track.album || "Supabase Library",
            genre: track.genre || "Rock",
            duration: track.duration ? this.formatDuration(track.duration) : "0:00",
            audioUrl: track.fileUrl,
            previewUrl: null,
            coverUrl: null,
            levelKey: null,
            requiredFragments: ["drums", "bass", "guitar", "note"],
            price: 0.99,
            externalLinks: [],
            isUnlocked: track.unlockedByDefault || false,
            // Supabase-specific properties
            supabaseId: track.id,
            fromSupabase: true,
            mood: track.mood,
            bpm: track.bpm
          }
          mergedCount++
        }
      })
      
      // Load level assignments from Supabase
      SupabaseMusicManager.levelAssignments.forEach((assignment, levelId) => {
        if (assignment.track?.file_url) {
          // Find or create the corresponding local track
          const supabaseTrackId = `supabase_${assignment.trackId}`
          
          // Update LEVEL_TRACKS mapping
          LEVEL_TRACKS[levelId] = supabaseTrackId
          
          // Update track's levelKey
          if (TRACK_DATABASE[supabaseTrackId]) {
            TRACK_DATABASE[supabaseTrackId].levelKey = levelId
          }
        }
      })
      
      this.supabaseTracksLoaded = true
      console.log(`[MusicTrackManager] Merged ${mergedCount} tracks from Supabase`)
      
    } catch (e) {
      console.warn("[MusicTrackManager] Failed to load from Supabase:", e)
      this.supabaseTracksLoaded = false
    }
  }
  
  /**
   * Format seconds into MM:SS
   */
  formatDuration(seconds) {
    if (!seconds) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }
  
  /**
   * Get all Supabase tracks (for UI display)
   */
  getSupabaseTracks() {
    return SupabaseMusicManager.getAllTracks()
  }
  
  /**
   * Check if Supabase is available
   */
  isSupabaseAvailable() {
    return this.supabaseTracksLoaded && SupabaseMusicManager.isInitialized
  }
  
  /**
   * Upload a track to Supabase
   * @param {File} file - Audio file to upload
   * @param {Object} metadata - Track metadata (name, artist, genre, etc.)
   */
  async uploadToSupabase(file, metadata = {}) {
    return await SupabaseMusicManager.uploadTrack(file, metadata)
  }
  
  /**
   * Assign a Supabase track to a level
   * @param {string} levelId - Level ID (e.g., "W1-L1", "Level1Scene")
   * @param {string} trackId - Supabase track UUID
   * @param {Object} options - Assignment options (volume, loop, etc.)
   */
  async assignSupabaseTrackToLevel(levelId, trackId, options = {}) {
    const result = await SupabaseMusicManager.assignTrackToLevel(levelId, trackId, options)
    
    if (result.success) {
      // Update local LEVEL_TRACKS mapping
      const localTrackId = `supabase_${trackId}`
      LEVEL_TRACKS[levelId] = localTrackId
      
      // Update track's levelKey
      if (TRACK_DATABASE[localTrackId]) {
        TRACK_DATABASE[localTrackId].levelKey = levelId
      }
    }
    
    return result
  }
  
  /**
   * Remove a track assignment from a level (in Supabase)
   */
  async removeSupabaseTrackFromLevel(levelId) {
    const result = await SupabaseMusicManager.removeTrackFromLevel(levelId)
    
    if (result.success) {
      // Update local mapping
      const trackId = LEVEL_TRACKS[levelId]
      if (trackId && TRACK_DATABASE[trackId]) {
        TRACK_DATABASE[trackId].levelKey = null
      }
      delete LEVEL_TRACKS[levelId]
    }
    
    return result
  }
  
  /**
   * Get Supabase track assignment for a level
   */
  getSupabaseLevelTrack(levelId) {
    return SupabaseMusicManager.getLevelTrack(levelId)
  }
  
  /**
   * Reload tracks from Supabase (useful after uploads)
   */
  async reloadFromSupabase() {
    console.log("[MusicTrackManager] Reloading from Supabase...")
    
    // Use SupabaseMusicManager's forceReload which properly resets everything
    await SupabaseMusicManager.forceReload()
    
    // Re-merge Supabase tracks into local database
    await this.loadFromSupabase()
    
    console.log("[MusicTrackManager] Reload complete, tracks:", SupabaseMusicManager.getAllTracks().length)
  }

  /**
   * Apply configuration data from a config object
   * @param {Object} config - The configuration object
   * @param {string} source - Source identifier for logging ("remote", "bundled", etc.)
   */
  applyConfigData(config, source = "unknown") {
    let appliedCount = 0
    
    // Apply menu music
    if (config.menuMusic) {
      Object.entries(config.menuMusic).forEach(([menuKey, url]) => {
        // Only apply if we have a valid URL and the slot is empty
        if (url && MENU_MUSIC.hasOwnProperty(menuKey) && !MENU_MUSIC[menuKey]) {
          MENU_MUSIC[menuKey] = url
          appliedCount++
        }
      })
    }
    
    // Apply level track audio URLs
    if (config.levelTracks) {
      Object.entries(config.levelTracks).forEach(([trackId, trackData]) => {
        if (TRACK_DATABASE[trackId]) {
          const audioUrl = typeof trackData === "string" ? trackData : trackData?.audioUrl
          if (audioUrl && !TRACK_DATABASE[trackId].audioUrl) {
            TRACK_DATABASE[trackId].audioUrl = audioUrl
            appliedCount++
          }
        }
      })
    }
    
    // Apply track metadata
    if (config.trackMetadata) {
      Object.entries(config.trackMetadata).forEach(([trackId, meta]) => {
        if (TRACK_DATABASE[trackId]) {
          if (meta.title) TRACK_DATABASE[trackId].title = meta.title
          if (meta.artist) TRACK_DATABASE[trackId].artist = meta.artist
          if (meta.genre) TRACK_DATABASE[trackId].genre = meta.genre
          if (meta.duration) TRACK_DATABASE[trackId].duration = meta.duration
        }
      })
    }
    
    console.log(`[MusicTrackManager] Applied ${appliedCount} assignments from ${source} config`)
  }

  // Load unlocked tracks and track assignments from storage
  loadProgress() {
    // Load unlock progress
    const saved = localStorage.getItem("diminished_chord_progress")
    if (saved) {
      const progress = JSON.parse(saved)
      // Update track database with saved unlock states
      Object.keys(progress.unlockedTracks || {}).forEach(trackId => {
        if (TRACK_DATABASE[trackId]) {
          TRACK_DATABASE[trackId].isUnlocked = true
        }
      })
    }

    // Load track assignments (audioUrl, levelKey, storageKey) from TrackUploader
    const assignments = localStorage.getItem("diminished_chord_track_assignments")
    if (assignments) {
      const data = JSON.parse(assignments)
      Object.entries(data).forEach(([trackId, assignment]) => {
        if (TRACK_DATABASE[trackId]) {
          if (assignment.audioUrl) {
            TRACK_DATABASE[trackId].audioUrl = assignment.audioUrl
          }
          if (assignment.storageKey) {
            // Track has audio stored in IndexedDB
            TRACK_DATABASE[trackId].storageKey = assignment.storageKey
          }
          if (assignment.levelKey) {
            TRACK_DATABASE[trackId].levelKey = assignment.levelKey
            // Also update the LEVEL_TRACKS mapping
            LEVEL_TRACKS[assignment.levelKey] = trackId
          }
          if (assignment.isUnlocked) {
            TRACK_DATABASE[trackId].isUnlocked = true
          }
        }
      })
    }

    // Load menu music assignments
    const menuMusic = localStorage.getItem("diminished_chord_menu_music")
    if (menuMusic) {
      const menuData = JSON.parse(menuMusic)
      Object.entries(menuData).forEach(([menuKey, audioUrl]) => {
        if (MENU_MUSIC.hasOwnProperty(menuKey)) {
          MENU_MUSIC[menuKey] = audioUrl
        }
      })
    }

    // Load external links
    this.loadExternalLinks()

    // Load track metadata (title, artist, genre, duration, fileName)
    this.loadTrackMetadata()
  }

  // Save progress to storage
  saveProgress() {
    const unlockedTracks = {}
    Object.keys(TRACK_DATABASE).forEach(trackId => {
      if (TRACK_DATABASE[trackId].isUnlocked) {
        unlockedTracks[trackId] = true
      }
    })
    localStorage.setItem("diminished_chord_progress", JSON.stringify({
      unlockedTracks
    }))
  }

  // Get track for a level
  getTrackForLevel(levelKey) {
    const trackId = LEVEL_TRACKS[levelKey]
    if (trackId && TRACK_DATABASE[trackId]) {
      return { id: trackId, ...TRACK_DATABASE[trackId] }
    }
    return null
  }

  // Reset fragments for new level attempt
  resetLevelFragments() {
    this.currentLevelFragments = {
      drums: false,
      bass: false,
      guitar: false,
      note: false
    }
  }

  // Collect a fragment
  collectFragment(type) {
    if (this.currentLevelFragments.hasOwnProperty(type)) {
      this.currentLevelFragments[type] = true
      return true
    }
    return false
  }

  // Check if all fragments collected
  hasAllFragments() {
    return Object.values(this.currentLevelFragments).every(v => v === true)
  }

  // Get collected fragment count
  getCollectedCount() {
    return Object.values(this.currentLevelFragments).filter(v => v === true).length
  }

  // Get total fragment count
  getTotalFragments() {
    return Object.keys(this.currentLevelFragments).length
  }

  // Unlock track when level completed with all fragments
  unlockTrack(levelKey) {
    const trackId = LEVEL_TRACKS[levelKey]
    if (trackId && TRACK_DATABASE[trackId]) {
      TRACK_DATABASE[trackId].isUnlocked = true
      this.saveProgress()
      return TRACK_DATABASE[trackId]
    }
    return null
  }

  // Get all tracks for library view
  getAllTracks() {
    return Object.keys(TRACK_DATABASE).map(id => ({
      id,
      ...TRACK_DATABASE[id]
    }))
  }

  // Get unlocked tracks only
  getUnlockedTracks() {
    return this.getAllTracks().filter(track => track.isUnlocked)
  }

  // Check if track is unlocked
  isTrackUnlocked(trackId) {
    return TRACK_DATABASE[trackId]?.isUnlocked || false
  }

  // Get total unlocked count
  getUnlockedCount() {
    return Object.values(TRACK_DATABASE).filter(t => t.isUnlocked).length
  }

  // Get total track count
  getTotalTracks() {
    return Object.keys(TRACK_DATABASE).length
  }

  // Get menu music URL for a specific menu
  // Returns the playable URL (blob URL if from IndexedDB, or regular URL)
  getMenuMusic(menuKey) {
    // If we have a cached blob URL, use that (for IndexedDB stored audio)
    if (MENU_MUSIC_BLOB_URLS[menuKey]) {
      return MENU_MUSIC_BLOB_URLS[menuKey]
    }
    // Otherwise return the stored URL (could be a regular URL or indexeddb: marker)
    const stored = MENU_MUSIC[menuKey]
    // Don't return indexeddb: markers directly - they need to be loaded first
    if (stored && stored.startsWith("indexeddb:")) {
      return null // Will be loaded asynchronously
    }
    return stored || null
  }

  // Set menu music for a specific menu
  setMenuMusic(menuKey, audioUrl) {
    if (MENU_MUSIC.hasOwnProperty(menuKey)) {
      MENU_MUSIC[menuKey] = audioUrl
      this.saveMenuMusic()
      return true
    }
    return false
  }
  
  // Set the blob URL for menu music (used after loading from IndexedDB)
  setMenuMusicBlobUrl(menuKey, blobUrl) {
    if (MENU_MUSIC_BLOB_URLS.hasOwnProperty(menuKey)) {
      MENU_MUSIC_BLOB_URLS[menuKey] = blobUrl
    }
  }
  
  // Get the raw storage value for menu music (including indexeddb: markers)
  getMenuMusicStorageValue(menuKey) {
    return MENU_MUSIC[menuKey] || null
  }

  // Save menu music assignments to localStorage
  saveMenuMusic() {
    localStorage.setItem("diminished_chord_menu_music", JSON.stringify(MENU_MUSIC))
  }

  // Get all menu music assignments
  getAllMenuMusic() {
    return { ...MENU_MUSIC }
  }
  
  // Check if menu music is stored in IndexedDB
  isMenuMusicInStorage(menuKey) {
    const value = MENU_MUSIC[menuKey]
    return value && value.startsWith("indexeddb:")
  }

  // Get external links for a track
  getExternalLinks(trackId) {
    if (TRACK_DATABASE[trackId]) {
      return TRACK_DATABASE[trackId].externalLinks || []
    }
    return []
  }

  // Add an external link to a track
  addExternalLink(trackId, label, url) {
    if (TRACK_DATABASE[trackId]) {
      if (!TRACK_DATABASE[trackId].externalLinks) {
        TRACK_DATABASE[trackId].externalLinks = []
      }
      TRACK_DATABASE[trackId].externalLinks.push({ label, url })
      this.saveExternalLinks()
      return true
    }
    return false
  }

  // Remove an external link from a track by index
  removeExternalLink(trackId, index) {
    if (TRACK_DATABASE[trackId] && TRACK_DATABASE[trackId].externalLinks) {
      TRACK_DATABASE[trackId].externalLinks.splice(index, 1)
      this.saveExternalLinks()
      return true
    }
    return false
  }

  // Set all external links for a track (replaces existing)
  setExternalLinks(trackId, links) {
    if (TRACK_DATABASE[trackId]) {
      TRACK_DATABASE[trackId].externalLinks = links
      this.saveExternalLinks()
      return true
    }
    return false
  }

  // Save external links to localStorage
  saveExternalLinks() {
    const linksData = {}
    Object.keys(TRACK_DATABASE).forEach(trackId => {
      if (TRACK_DATABASE[trackId].externalLinks && TRACK_DATABASE[trackId].externalLinks.length > 0) {
        linksData[trackId] = TRACK_DATABASE[trackId].externalLinks
      }
    })
    localStorage.setItem("diminished_chord_external_links", JSON.stringify(linksData))
  }

  // Load external links from localStorage (called in loadProgress)
  loadExternalLinks() {
    const saved = localStorage.getItem("diminished_chord_external_links")
    if (saved) {
      const linksData = JSON.parse(saved)
      Object.entries(linksData).forEach(([trackId, links]) => {
        if (TRACK_DATABASE[trackId]) {
          TRACK_DATABASE[trackId].externalLinks = links
        }
      })
    }
  }

  // Save track metadata (title, artist, genre, duration, fileName) to localStorage
  saveTrackMetadata() {
    const metadataData = {}
    Object.keys(TRACK_DATABASE).forEach(trackId => {
      metadataData[trackId] = {
        title: TRACK_DATABASE[trackId].title,
        artist: TRACK_DATABASE[trackId].artist,
        genre: TRACK_DATABASE[trackId].genre,
        duration: TRACK_DATABASE[trackId].duration,
        fileName: TRACK_DATABASE[trackId].fileName || null
      }
    })
    localStorage.setItem("diminished_chord_track_metadata", JSON.stringify(metadataData))
  }

  // Load track metadata from localStorage (called in loadProgress)
  loadTrackMetadata() {
    const saved = localStorage.getItem("diminished_chord_track_metadata")
    if (saved) {
      const metadataData = JSON.parse(saved)
      Object.entries(metadataData).forEach(([trackId, metadata]) => {
        if (TRACK_DATABASE[trackId]) {
          if (metadata.title) TRACK_DATABASE[trackId].title = metadata.title
          if (metadata.artist) TRACK_DATABASE[trackId].artist = metadata.artist
          if (metadata.genre) TRACK_DATABASE[trackId].genre = metadata.genre
          if (metadata.duration) TRACK_DATABASE[trackId].duration = metadata.duration
          if (metadata.fileName) TRACK_DATABASE[trackId].fileName = metadata.fileName
        }
      })
    }
  }
}

// Menu music assignments - which audio plays on which menu/scene
// Values can be: null, a URL string, or "indexeddb:key" for stored audio
export const MENU_MUSIC = {
  "intro": null,          // Intro cinematic sequence
  "title_screen": null,   // Title Screen (logo fade-in, press start)
  "main_menu": null,      // TitleScreen (main menu)
  "dev_mode": null,       // Developer mode menus (Level Designer, Track Manager, etc.)
  "music_library": null,  // Music Library scene
  "universe_select": null, // Universe/World Tour selection screen
  // World overworld themes (15 worlds)
  "world_1": null,  // Detroit - Basement Show
  "world_2": null,  // Berlin - Industrial Warehouse
  "world_3": null,  // Tokyo - Neon Rooftops
  "world_4": null,  // London - Rain-Slick Streets
  "world_5": null,  // Festival Grounds - Festival Breakthrough
  "world_6": null,  // Reykjavik - Arctic Isolation
  "world_7": null,  // Los Angeles - Label Headquarters
  "world_8": null,  // Sydney - Arena Tour
  "world_9": null,  // New York City - Media Storm
  "world_10": null, // Corporate Tower - Contract Trap
  "world_11": null, // Inner Mind - Doubt
  "world_12": null, // Temporal Void - Time Fracture
  "world_13": null, // Static Realm - Noise Collapse
  "world_14": null, // Pure Space - Clarity
  "world_15": null  // Core of Self - The Diminished Chord
}

// Cached blob URLs for menu music (generated from IndexedDB at runtime)
export const MENU_MUSIC_BLOB_URLS = {
  "intro": null,
  "title_screen": null,
  "main_menu": null,
  "dev_mode": null,
  "music_library": null,
  "universe_select": null,
  "world_1": null,
  "world_2": null,
  "world_3": null,
  "world_4": null,
  "world_5": null,
  "world_6": null,
  "world_7": null,
  "world_8": null,
  "world_9": null,
  "world_10": null,
  "world_11": null,
  "world_12": null,
  "world_13": null,
  "world_14": null,
  "world_15": null
}

// Menu music keys for easy reference
export const MENU_KEYS = {
  INTRO: "intro",
  TITLE_SCREEN: "title_screen",
  MAIN_MENU: "main_menu",
  DEV_MODE: "dev_mode",
  MUSIC_LIBRARY: "music_library",
  UNIVERSE_SELECT: "universe_select",
  // World keys
  WORLD_1: "world_1",
  WORLD_2: "world_2",
  WORLD_3: "world_3",
  WORLD_4: "world_4",
  WORLD_5: "world_5",
  WORLD_6: "world_6",
  WORLD_7: "world_7",
  WORLD_8: "world_8",
  WORLD_9: "world_9",
  WORLD_10: "world_10",
  WORLD_11: "world_11",
  WORLD_12: "world_12",
  WORLD_13: "world_13",
  WORLD_14: "world_14",
  WORLD_15: "world_15"
}

// Singleton instance
export const musicManager = new MusicTrackManager()
