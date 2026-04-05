/**
 * LevelDataManager - Manages level design data persistence
 * 
 * PERSISTENCE MODEL:
 * - PRIMARY: Supabase database (permanent, synced across all sessions)
 * - FALLBACK: localStorage (temporary, per-browser cache)
 * - Bundled levels in src/levels/*.js used as defaults for unpublished levels
 */

import { getAllLevelIds, parseLevelId, WORLDS, LEVEL_TYPES, BONUS_PURPOSES } from "./WorldManager.js"
import { SavedLevelsManager } from "./SavedLevelsManager.js"
import { LEVEL_DATA, hasPublishedLevel } from "./levels/index.js"
import { supabase } from "./integrations/supabase/client.js"

/**
 * Seeded random number generator (Mulberry32)
 * Produces deterministic "random" numbers based on a seed
 * This ensures the same level ID always generates the same layout
 */
function createSeededRandom(seed) {
  let state = seed
  return function() {
    state |= 0
    state = state + 0x6D2B79F5 | 0
    let t = Math.imul(state ^ state >>> 15, 1 | state)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/**
 * Convert a string (level ID) to a numeric seed
 */
function stringToSeed(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Default level template
const DEFAULT_LEVEL_DATA = {
  version: 1,
  metadata: {
    name: "",
    description: "",
    difficulty: "Medium",
    author: "The Diminished Chord",
    created: null,
    modified: null
  },
  settings: {
    width: 1920,           // Level width in pixels
    height: 768,           // Level height in pixels
    tileSize: 32,          // Tile size
    gravity: 1200,         // Player gravity
    backgroundColor: "#1a1a2e",
    musicTrackId: null,    // Assigned music track
    timeLimit: null,       // Optional time limit in seconds
    parTime: null          // Par time for speedrun
  },
  spawn: {
    x: 100,
    y: 600
  },
  goal: {
    x: 1800,
    y: 600,
    width: 64,
    height: 64
  },
  // Tile layers
  layers: {
    background: [],        // Visual background tiles
    terrain: [],           // Solid collision tiles
    hazards: [],           // Damage-dealing tiles (spikes, etc.)
    decoration: [],        // Non-collision visual elements
    foreground: []         // Foreground overlay
  },
  // Platform definitions
  platforms: [],
  // Hazard definitions
  hazards: [],
  // Moving platform definitions
  movingPlatforms: [],
  // Collectible music fragments
  fragments: [],
  // Checkpoints
  checkpoints: [],
  // Special objects (switches, doors, etc.)
  objects: [],
  // Enemy spawns
  enemies: [],
  // Triggers (events, dialogues, etc.)
  triggers: []
}

// Platform types
export const PLATFORM_TYPES = {
  SOLID: "solid",
  PASSTHROUGH: "passthrough",
  CRUMBLING: "crumbling",
  BOUNCY: "bouncy",
  ICY: "icy",
  STICKY: "sticky"
}

// Hazard types
export const HAZARD_TYPES = {
  SPIKE: "spike",
  SAW: "saw",
  LASER: "laser",
  FIRE: "fire",
  CRUSHER: "crusher",
  PIT: "pit"
}

// Fragment types (music stems)
export const FRAGMENT_TYPES = {
  INTRO_RIFF: "intro_riff",
  VERSE_STEM: "verse_stem",
  CHORUS_HOOK: "chorus_hook",
  BRIDGE_LAYER: "bridge_layer",
  VOCAL_HARMONY: "vocal_harmony",
  DRUM_FILL: "drum_fill"
}

/**
 * LevelDataManager class
 */
class LevelDataManagerClass {
  constructor() {
    this.levelCache = new Map()
    this.modifiedLevels = new Set()
    this.supabaseLevels = new Set() // Track which levels are in Supabase
    this.loadedFromStorage = false
    this.initPromise = null
    this.supabaseAvailable = false
  }

  /**
   * Initialize level data for all 301 levels
   * Returns a promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.loadedFromStorage) return Promise.resolve()
    if (this.initPromise) return this.initPromise
    
    this.initPromise = this._doInitialize()
    return this.initPromise
  }
  
  async _doInitialize() {
    // Wait for SavedLevelsManager to initialize first
    await SavedLevelsManager.initialize()
    
    // 1. Load bundled level data from files (lowest priority - defaults)
    await this.loadBundledLevels()
    
    // 2. Load World Tour levels from SavedLevelsManager (localStorage - medium priority)
    // Only loads levels NOT already in Supabase
    this.loadFromSavedLevelsManager()
    
    // 3. Load from Supabase LAST (highest priority - overwrites everything)
    await this.loadFromSupabase()
    
    this.loadedFromStorage = true
    console.log("[LevelDataManager] Initialization complete", {
      supabaseAvailable: this.supabaseAvailable,
      supabaseLevels: this.supabaseLevels.size,
      totalCached: this.levelCache.size
    })
  }
  
  /**
   * Load all levels from Supabase database (HIGHEST PRIORITY)
   * This runs LAST and overwrites any data from bundled files or localStorage
   */
  async loadFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
      
      if (error) {
        console.warn("[LevelDataManager] Supabase query error:", error.message)
        return
      }
      
      if (data && data.length > 0) {
        this.supabaseAvailable = true
        data.forEach(row => {
          // Convert database row to level data format
          const levelData = this.dbRowToLevelData(row)
          // OVERWRITE any existing data - Supabase is the source of truth
          this.levelCache.set(row.id, levelData)
          this.supabaseLevels.add(row.id)
          console.log(`[LevelDataManager] Loaded level from Supabase (overwriting local): ${row.id}`, {
            platforms: levelData.platforms?.length || 0,
            fragments: levelData.fragments?.length || 0,
            width: levelData.settings?.width
          })
        })
        console.log(`[LevelDataManager] Loaded ${data.length} levels from Supabase (these take priority)`)
      } else {
        this.supabaseAvailable = true
        console.log("[LevelDataManager] Supabase connected, no levels yet")
      }
    } catch (e) {
      console.warn("[LevelDataManager] Supabase not available:", e.message)
      this.supabaseAvailable = false
    }
  }
  
  /**
   * Convert database row to level data format
   */
  dbRowToLevelData(row) {
    // Extract stopwatch from settings if present (stored in settings JSONB column)
    const settings = row.settings || {
      width: 1920,
      height: 768,
      tileSize: 32,
      gravity: 1200,
      backgroundColor: "#1a1a2e"
    }
    const stopwatch = settings.stopwatch || null
    
    return {
      version: 1,
      metadata: {
        name: row.name,
        description: row.description || "",
        difficulty: row.difficulty || "Medium",
        author: row.author || "The Diminished Chord",
        created: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        modified: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
        isTutorialLevel: row.level_type === "tutorial"  // Read tutorial flag from database
      },
      settings: settings,
      spawn: row.spawn || { x: 100, y: 600 },
      goal: row.goal || { x: 1800, y: 600, width: 64, height: 64 },
      // Stopwatch for speed run timer - stored at top level for easy access
      stopwatch: stopwatch,
      layers: {
        background: [],
        terrain: [],
        hazards: [],
        decoration: [],
        foreground: []
      },
      platforms: row.platforms || [],
      hazards: row.hazards || [],
      movingPlatforms: row.moving_platforms || [],
      fragments: row.fragments || [],
      checkpoints: row.checkpoints || [],
      objects: [],
      enemies: row.enemies || [],
      triggers: row.triggers || [],
      // Style fields for the unified level architecture
      styleWorld: row.style_world || row.world_number || null,
      stylePreset: row.style_preset || "auto",
      tileStyles: row.tile_styles || [],
      // Background visual settings - stored in settings JSONB for flexibility
      backgroundBrightness: settings.backgroundBrightness ?? undefined,
      backgroundContrast: settings.backgroundContrast ?? undefined,
      useWorldBackgroundSettings: settings.useWorldBackgroundSettings ?? true
    }
  }
  
  /**
   * Convert level data to database row format
   */
  levelDataToDbRow(levelId, levelData) {
    const parsed = parseLevelId(levelId)
    
    // Determine level_type: use isTutorialLevel flag if set, otherwise derive from levelId
    let levelType = parsed?.type || null
    if (levelData.metadata?.isTutorialLevel) {
      levelType = "tutorial"
    } else if (levelId === "Tutorial") {
      levelType = "tutorial"
    }
    
    // Include stopwatch and background visual settings in settings JSONB
    const settings = { ...(levelData.settings || {}) }
    if (levelData.stopwatch) {
      settings.stopwatch = levelData.stopwatch
    }
    if (levelData.backgroundBrightness !== undefined) {
      settings.backgroundBrightness = levelData.backgroundBrightness
    }
    if (levelData.backgroundContrast !== undefined) {
      settings.backgroundContrast = levelData.backgroundContrast
    }
    if (levelData.useWorldBackgroundSettings !== undefined) {
      settings.useWorldBackgroundSettings = levelData.useWorldBackgroundSettings
    }
    
    return {
      id: levelId,
      name: levelData.metadata?.name || levelId,
      description: levelData.metadata?.description || null,
      difficulty: levelData.metadata?.difficulty || "Medium",
      author: levelData.metadata?.author || "The Diminished Chord",
      world_number: parsed?.world || null,
      level_number: parsed?.level || null,
      level_type: levelType,
      settings: settings,
      spawn: levelData.spawn,
      goal: levelData.goal,
      platforms: levelData.platforms || [],
      hazards: levelData.hazards || [],
      moving_platforms: levelData.movingPlatforms || [],
      fragments: levelData.fragments || [],
      checkpoints: levelData.checkpoints || [],
      enemies: levelData.enemies || [],
      triggers: levelData.triggers || [],
      is_published: true,
      // Style fields for the unified level architecture
      style_world: levelData.styleWorld || parsed?.world || null,
      style_preset: levelData.stylePreset || "auto",
      tile_styles: levelData.tileStyles || []
    }
  }
  
  /**
   * Check if initialization is complete
   */
  isReady() {
    return this.loadedFromStorage
  }
  
  /**
   * Wait for initialization to complete
   */
  async waitForReady() {
    if (this.loadedFromStorage) return
    if (this.initPromise) await this.initPromise
  }

  /**
   * Load level data from SavedLevelsManager (which loads from JSON file)
   */
  loadFromSavedLevelsManager() {
    try {
      const worldTourLevels = SavedLevelsManager.getAllWorldTourLevels()
      Object.entries(worldTourLevels).forEach(([levelId, levelData]) => {
        this.levelCache.set(levelId, levelData)
        this.modifiedLevels.add(levelId) // Mark as modified since it was custom saved
      })
      console.log(`[LevelDataManager] Loaded ${Object.keys(worldTourLevels).length} World Tour levels from JSON`)
    } catch (e) {
      console.error("[LevelDataManager] Failed to load from SavedLevelsManager:", e)
    }
  }

  /**
   * Save level to persistent storage (JSON file via SavedLevelsManager)
   */
  saveToStorage() {
    // SavedLevelsManager handles the actual file writing
    console.log(`[LevelDataManager] Persisted ${this.modifiedLevels.size} modified levels`)
  }

  /**
   * Load published level data from src/levels/*.js files
   * These are the "official" level files that are part of the codebase
   */
  async loadBundledLevels() {
    // First, load any published levels from src/levels/
    Object.entries(LEVEL_DATA).forEach(([levelId, levelData]) => {
      // Published levels take priority over SavedLevelsManager (which is just localStorage cache)
      this.levelCache.set(levelId, levelData)
      console.log(`[LevelDataManager] Loaded published level: ${levelId}`)
    })
    
    // Generate default data for any levels that don't have published files yet
    const allLevelIds = getAllLevelIds()
    for (const levelId of allLevelIds) {
      if (!this.levelCache.has(levelId)) {
        this.levelCache.set(levelId, this.generateDefaultLevel(levelId))
      }
    }
    
    console.log(`[LevelDataManager] Loaded ${Object.keys(LEVEL_DATA).length} published levels, generated defaults for the rest`)
  }

  /**
   * Generate default level data based on level ID
   */
  generateDefaultLevel(levelId) {
    const parsed = parseLevelId(levelId)
    const levelData = JSON.parse(JSON.stringify(DEFAULT_LEVEL_DATA))
    
    levelData.metadata.created = Date.now()
    levelData.metadata.modified = Date.now()
    
    if (levelId === "Tutorial") {
      levelData.metadata.name = "Tutorial"
      levelData.metadata.description = "Learn the basics of running, jumping, and wall jumping"
      levelData.metadata.difficulty = "Tutorial"
      levelData.settings.width = 1920
      return this.addTutorialContent(levelData)
    }
    
    const world = WORLDS[parsed.world]
    if (!world) return levelData
    
    // Set metadata based on world and level type
    if (parsed.type === LEVEL_TYPES.NORMAL) {
      levelData.metadata.name = `${world.location} - Stage ${parsed.level}`
      levelData.metadata.description = `Normal level ${parsed.level} of ${world.name}`
      levelData.metadata.difficulty = this.getDifficultyForWorld(parsed.world, parsed.level)
    } else if (parsed.type === LEVEL_TYPES.BONUS) {
      const bonus = BONUS_PURPOSES[`b${parsed.level}`]
      levelData.metadata.name = `${world.location} - ${bonus.name}`
      levelData.metadata.description = `Bonus level: ${bonus.name}`
      levelData.metadata.difficulty = "Hard"
    } else if (parsed.type === LEVEL_TYPES.BOSS) {
      levelData.metadata.name = `${world.location} - ${world.bossName}`
      levelData.metadata.description = world.bossMechanic
      levelData.metadata.difficulty = "Boss"
    }
    
    // Scale level size based on world
    levelData.settings.width = 1920 + (parsed.world - 1) * 320 // Levels get longer
    
    // Create a seeded random generator for this specific level
    // This ensures the same level ID always produces the same layout
    const seed = stringToSeed(levelId)
    const seededRandom = createSeededRandom(seed)
    
    // Add basic platforms using seeded random
    levelData.platforms = this.generateBasicPlatforms(levelData.settings.width, levelData.settings.height, parsed, seededRandom)
    
    // Add fragments based on world complexity
    levelData.fragments = this.generateFragments(levelData, parsed.world)
    
    return levelData
  }

  getDifficultyForWorld(worldNum, levelNum) {
    const difficulties = ["Easy", "Easy", "Medium", "Medium", "Medium-Hard", "Hard", "Hard", "Very Hard", "Very Hard", "Expert"]
    const baseIndex = Math.min(worldNum - 1, 9)
    const levelModifier = Math.floor(levelNum / 5)
    const finalIndex = Math.min(baseIndex + levelModifier, 9)
    return difficulties[finalIndex]
  }

  addTutorialContent(levelData) {
    // Add tutorial-specific platforms and guides
    levelData.platforms = [
      { x: 0, y: 700, width: 400, height: 32, type: PLATFORM_TYPES.SOLID },
      { x: 500, y: 650, width: 200, height: 32, type: PLATFORM_TYPES.SOLID },
      { x: 800, y: 600, width: 200, height: 32, type: PLATFORM_TYPES.SOLID },
      { x: 1100, y: 550, width: 200, height: 32, type: PLATFORM_TYPES.SOLID },
      { x: 1400, y: 500, width: 200, height: 32, type: PLATFORM_TYPES.SOLID },
      { x: 1600, y: 700, width: 300, height: 32, type: PLATFORM_TYPES.SOLID }
    ]
    
    levelData.fragments = [
      { x: 250, y: 650, type: FRAGMENT_TYPES.INTRO_RIFF },
      { x: 600, y: 600, type: FRAGMENT_TYPES.VERSE_STEM },
      { x: 900, y: 550, type: FRAGMENT_TYPES.CHORUS_HOOK },
      { x: 1200, y: 500, type: FRAGMENT_TYPES.DRUM_FILL }
    ]
    
    levelData.triggers = [
      { x: 50, y: 600, width: 100, height: 200, type: "tutorial_text", message: "Use ARROW KEYS to move" },
      { x: 450, y: 600, width: 100, height: 200, type: "tutorial_text", message: "Press SPACE to jump" },
      { x: 1050, y: 500, width: 100, height: 200, type: "tutorial_text", message: "Jump against walls to WALL JUMP" }
    ]
    
    return levelData
  }

  generateBasicPlatforms(width, height, parsed, seededRandom) {
    const platforms = []
    const groundY = height - 64
    
    // Starting platform
    platforms.push({
      x: 0, y: groundY, width: 300, height: 64, type: PLATFORM_TYPES.SOLID
    })
    
    // Generate middle platforms using seeded random for consistent layouts
    const numPlatforms = Math.floor(width / 300)
    for (let i = 1; i < numPlatforms - 1; i++) {
      const x = i * 300 + seededRandom() * 100
      const y = groundY - seededRandom() * 200 - 50
      const platformWidth = 150 + seededRandom() * 150
      
      platforms.push({
        x, y, width: platformWidth, height: 32, type: PLATFORM_TYPES.SOLID
      })
    }
    
    // End platform
    platforms.push({
      x: width - 300, y: groundY, width: 300, height: 64, type: PLATFORM_TYPES.SOLID
    })
    
    return platforms
  }

  generateFragments(levelData, worldNum) {
    const fragments = []
    const numFragments = Math.min(3 + Math.floor(worldNum / 3), 6)
    
    const fragmentTypes = Object.values(FRAGMENT_TYPES)
    const usedTypes = new Set()
    
    for (let i = 0; i < numFragments && i < fragmentTypes.length; i++) {
      let type = fragmentTypes[i]
      
      // Place fragment on or near a platform
      const platform = levelData.platforms[Math.min(i + 1, levelData.platforms.length - 1)]
      if (platform) {
        fragments.push({
          x: platform.x + platform.width / 2,
          y: platform.y - 50,
          type
        })
      }
    }
    
    return fragments
  }

  /**
   * Get level data by ID
   */
  getLevel(levelId) {
    if (!this.levelCache.has(levelId)) {
      this.levelCache.set(levelId, this.generateDefaultLevel(levelId))
    }
    return this.levelCache.get(levelId)
  }

  /**
   * Save/update level data - caches to localStorage (temporary)
   * Use publishLevel() to permanently save to the codebase
   */
  saveLevel(levelId, levelData) {
    levelData.metadata.modified = Date.now()
    this.levelCache.set(levelId, levelData)
    this.modifiedLevels.add(levelId)
    
    // Save to SavedLevelsManager (localStorage cache)
    SavedLevelsManager.saveWorldTourLevel(levelId, levelData)
    
    console.log(`[LevelDataManager] Cached level to localStorage: ${levelId}`)
  }
  
  /**
   * PUBLISH level data - saves to Supabase database
   * This makes changes permanent and synced across all sessions
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async publishLevel(levelId, levelData) {
    levelData.metadata.modified = Date.now()
    this.levelCache.set(levelId, levelData)
    
    // Try Supabase first (primary storage)
    try {
      const dbRow = this.levelDataToDbRow(levelId, levelData)
      
      console.log(`[LevelDataManager] Publishing level to Supabase: ${levelId}`, {
        rowId: dbRow.id,
        name: dbRow.name,
        platformCount: dbRow.platforms?.length || 0,
        fragmentCount: dbRow.fragments?.length || 0,
        spawn: dbRow.spawn,
        goal: dbRow.goal,
        settings: dbRow.settings,
        // Log first few platforms to verify coordinates
        samplePlatforms: dbRow.platforms?.slice(0, 3)
      })
      
      const { data, error, status, statusText } = await supabase
        .from('levels')
        .upsert(dbRow, { onConflict: 'id' })
        .select()
      
      if (error) {
        console.error(`[LevelDataManager] Supabase error details:`, {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status,
          statusText
        })
        throw new Error(error.message)
      }
      
      console.log(`[LevelDataManager] Successfully published level to Supabase: ${levelId}`, {
        returnedData: data,
        status,
        statusText
      })
      this.supabaseLevels.add(levelId)
      this.modifiedLevels.delete(levelId)
      
      // Also save to localStorage as backup
      SavedLevelsManager.saveWorldTourLevel(levelId, levelData)
      
      return { 
        success: true, 
        message: `Level "${levelData.metadata?.name || levelId}" published to database!` 
      }
    } catch (e) {
      console.error(`[LevelDataManager] Supabase publish error:`, e)
      
      // Fall back to localStorage save
      SavedLevelsManager.saveWorldTourLevel(levelId, levelData)
      this.modifiedLevels.add(levelId)
      
      return { 
        success: false, 
        message: `Database unavailable (${e.message}). Saved to browser storage instead.`
      }
    }
  }
  
  /**
   * Delete a level from Supabase
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteLevel(levelId) {
    try {
      const { error } = await supabase
        .from('levels')
        .delete()
        .eq('id', levelId)
      
      if (error) {
        throw new Error(error.message)
      }
      
      this.supabaseLevels.delete(levelId)
      this.levelCache.delete(levelId)
      console.log(`[LevelDataManager] Deleted level from Supabase: ${levelId}`)
      
      return { success: true, message: `Level "${levelId}" deleted` }
    } catch (e) {
      console.error(`[LevelDataManager] Delete error:`, e)
      return { success: false, message: e.message }
    }
  }
  
  /**
   * Check if a level exists in Supabase
   */
  isPublishedToSupabase(levelId) {
    return this.supabaseLevels.has(levelId)
  }

  /**
   * Check if level has been modified from default
   */
  isLevelModified(levelId) {
    return this.modifiedLevels.has(levelId)
  }

  /**
   * Reset level to default
   */
  resetLevel(levelId) {
    const defaultData = this.generateDefaultLevel(levelId)
    this.levelCache.set(levelId, defaultData)
    this.modifiedLevels.delete(levelId)
    
    // Remove from SavedLevelsManager as well
    const worldTourLevels = SavedLevelsManager.getAllWorldTourLevels()
    delete worldTourLevels[levelId]
    
    console.log(`[LevelDataManager] Reset level to default: ${levelId}`)
  }

  /**
   * Export level data as JSON (for bundling into game)
   */
  exportLevel(levelId) {
    const levelData = this.getLevel(levelId)
    return JSON.stringify(levelData, null, 2)
  }

  /**
   * Export all modified levels as a single JSON
   */
  exportAllModified() {
    const exported = {}
    this.modifiedLevels.forEach(levelId => {
      exported[levelId] = this.getLevel(levelId)
    })
    return JSON.stringify(exported, null, 2)
  }

  /**
   * Export ALL levels (for full game build)
   */
  exportAll() {
    const exported = {}
    this.levelCache.forEach((data, levelId) => {
      exported[levelId] = data
    })
    return JSON.stringify(exported, null, 2)
  }

  /**
   * Import level data from JSON
   */
  importLevel(levelId, jsonString) {
    try {
      const levelData = JSON.parse(jsonString)
      this.saveLevel(levelId, levelData)
      return true
    } catch (e) {
      console.error("[LevelDataManager] Failed to import level:", e)
      return false
    }
  }

  /**
   * Import multiple levels from JSON
   */
  importLevels(jsonString) {
    try {
      const data = JSON.parse(jsonString)
      Object.entries(data).forEach(([levelId, levelData]) => {
        this.saveLevel(levelId, levelData)
      })
      return true
    } catch (e) {
      console.error("[LevelDataManager] Failed to import levels:", e)
      return false
    }
  }

  /**
   * Get level count statistics
   */
  getStatistics() {
    return {
      total: this.levelCache.size,
      modified: this.modifiedLevels.size,
      tutorial: this.levelCache.has("Tutorial") ? 1 : 0,
      worlds: 15,
      levelsPerWorld: 20
    }
  }

  /**
   * Get all tutorial levels from Supabase database
   * @returns {Promise<Array>} Array of tutorial level objects with tutorialCode property
   */
  async getTutorialLevels() {
    try {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('level_type', 'tutorial')
        .order('created_at', { ascending: true })
      
      if (error) {
        console.warn("[LevelDataManager] Error fetching tutorial levels:", error.message)
        return []
      }
      
      if (!data || data.length === 0) {
        console.log("[LevelDataManager] No tutorial levels found in database")
        return []
      }
      
      // Convert to format expected by TutorialWorldScene
      const tutorialLevels = data.map((row, index) => {
        const levelData = this.dbRowToLevelData(row)
        return {
          id: row.id,
          title: row.name || row.id,
          description: row.description || "",
          tutorialCode: `T${index + 1}`,
          data: levelData,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      })
      
      console.log(`[LevelDataManager] Loaded ${tutorialLevels.length} tutorial levels from database`)
      return tutorialLevels
    } catch (e) {
      console.error("[LevelDataManager] Failed to fetch tutorial levels:", e)
      return []
    }
  }

  /**
   * Get all levels from cache that match a specific type
   * @param {string} levelType - "tutorial", "normal", "bonus", "boss"
   * @returns {Array} Array of level objects
   */
  getLevelsByType(levelType) {
    const results = []
    this.levelCache.forEach((levelData, levelId) => {
      if (levelData.metadata?.isTutorialLevel && levelType === "tutorial") {
        results.push({ id: levelId, ...levelData })
      }
    })
    return results
  }

  /**
   * SEED ALL LEVELS TO SUPABASE
   * This generates default data for all 301 levels and publishes them to the database.
   * Use this to initialize the database with all level data.
   * @param {function} progressCallback - Optional callback(current, total, levelId) for progress updates
   * @returns {Promise<{success: boolean, message: string, stats: object}>}
   */
  async seedAllLevelsToSupabase(progressCallback = null) {
    const allLevelIds = getAllLevelIds()
    const totalLevels = allLevelIds.length
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0
    const errors = []

    console.log(`[LevelDataManager] Starting database seed: ${totalLevels} levels`)

    for (let i = 0; i < allLevelIds.length; i++) {
      const levelId = allLevelIds[i]
      
      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, totalLevels, levelId)
      }

      try {
        // Check if level already exists in Supabase
        if (this.supabaseLevels.has(levelId)) {
          console.log(`[LevelDataManager] Skipping ${levelId} - already in database`)
          skippedCount++
          continue
        }

        // Get or generate level data
        let levelData = this.levelCache.get(levelId)
        if (!levelData) {
          levelData = this.generateDefaultLevel(levelId)
          this.levelCache.set(levelId, levelData)
        }

        // Convert to database format
        const dbRow = this.levelDataToDbRow(levelId, levelData)

        // Upsert to Supabase
        const { error } = await supabase
          .from('levels')
          .upsert(dbRow, { onConflict: 'id' })

        if (error) {
          throw new Error(error.message)
        }

        this.supabaseLevels.add(levelId)
        successCount++
        console.log(`[LevelDataManager] Seeded ${levelId} (${i + 1}/${totalLevels})`)

        // Small delay to avoid overwhelming the database
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      } catch (e) {
        errorCount++
        errors.push({ levelId, error: e.message })
        console.error(`[LevelDataManager] Failed to seed ${levelId}:`, e.message)
      }
    }

    const stats = {
      total: totalLevels,
      success: successCount,
      skipped: skippedCount,
      errors: errorCount
    }

    console.log(`[LevelDataManager] Database seed complete:`, stats)

    if (errorCount > 0) {
      return {
        success: false,
        message: `Seeded ${successCount}/${totalLevels} levels. ${errorCount} errors, ${skippedCount} skipped.`,
        stats,
        errors
      }
    }

    return {
      success: true,
      message: `Successfully seeded ${successCount} levels to database! (${skippedCount} already existed)`,
      stats
    }
  }

  /**
   * FORCE SEED ALL LEVELS TO SUPABASE
   * Like seedAllLevelsToSupabase but overwrites existing levels
   * @param {function} progressCallback - Optional callback(current, total, levelId) for progress updates
   * @returns {Promise<{success: boolean, message: string, stats: object}>}
   */
  async forceSeedAllLevelsToSupabase(progressCallback = null) {
    const allLevelIds = getAllLevelIds()
    const totalLevels = allLevelIds.length
    let successCount = 0
    let errorCount = 0
    const errors = []

    console.log(`[LevelDataManager] Starting FORCE database seed: ${totalLevels} levels (will overwrite)`)

    for (let i = 0; i < allLevelIds.length; i++) {
      const levelId = allLevelIds[i]
      
      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, totalLevels, levelId)
      }

      try {
        // Get or generate level data
        let levelData = this.levelCache.get(levelId)
        if (!levelData) {
          levelData = this.generateDefaultLevel(levelId)
          this.levelCache.set(levelId, levelData)
        }

        // Convert to database format
        const dbRow = this.levelDataToDbRow(levelId, levelData)

        // Upsert to Supabase (will overwrite existing)
        const { error } = await supabase
          .from('levels')
          .upsert(dbRow, { onConflict: 'id' })

        if (error) {
          throw new Error(error.message)
        }

        this.supabaseLevels.add(levelId)
        successCount++
        console.log(`[LevelDataManager] Force seeded ${levelId} (${i + 1}/${totalLevels})`)

        // Small delay to avoid overwhelming the database
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      } catch (e) {
        errorCount++
        errors.push({ levelId, error: e.message })
        console.error(`[LevelDataManager] Failed to seed ${levelId}:`, e.message)
      }
    }

    const stats = {
      total: totalLevels,
      success: successCount,
      errors: errorCount
    }

    console.log(`[LevelDataManager] Force database seed complete:`, stats)

    if (errorCount > 0) {
      return {
        success: false,
        message: `Force seeded ${successCount}/${totalLevels} levels. ${errorCount} errors.`,
        stats,
        errors
      }
    }

    return {
      success: true,
      message: `Successfully force seeded all ${successCount} levels to database!`,
      stats
    }
  }

  /**
   * Get count of levels in Supabase database
   * @returns {number}
   */
  getSupabaseLevelCount() {
    return this.supabaseLevels.size
  }

  /**
   * Get all level IDs that exist in Supabase
   * @returns {string[]}
   */
  getSupabaseLevelIds() {
    return Array.from(this.supabaseLevels)
  }
  
  // ==========================================
  // VERSION HISTORY METHODS
  // ==========================================
  
  /**
   * Get version history for a level
   * @param {string} levelId - The level ID
   * @returns {Promise<Array>} Array of version objects sorted by version_number desc
   */
  async getLevelVersionHistory(levelId) {
    try {
      const { data, error } = await supabase
        .from('level_versions')
        .select('*')
        .eq('level_id', levelId)
        .order('version_number', { ascending: false })
      
      if (error) {
        console.error(`[LevelDataManager] Error fetching version history:`, error.message)
        return []
      }
      
      return data || []
    } catch (e) {
      console.error(`[LevelDataManager] Failed to fetch version history:`, e)
      return []
    }
  }
  
  /**
   * Get a specific version of a level
   * @param {string} levelId - The level ID
   * @param {number} versionNumber - The version number to retrieve
   * @returns {Promise<object|null>} The version data or null if not found
   */
  async getLevelVersion(levelId, versionNumber) {
    try {
      const { data, error } = await supabase
        .from('level_versions')
        .select('*')
        .eq('level_id', levelId)
        .eq('version_number', versionNumber)
        .single()
      
      if (error) {
        console.error(`[LevelDataManager] Error fetching version:`, error.message)
        return null
      }
      
      return data
    } catch (e) {
      console.error(`[LevelDataManager] Failed to fetch version:`, e)
      return null
    }
  }
  
  /**
   * Revert a level to a previous version
   * @param {string} levelId - The level ID
   * @param {number} versionNumber - The version to revert to
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async revertLevelToVersion(levelId, versionNumber) {
    try {
      // Get the version data
      const versionData = await this.getLevelVersion(levelId, versionNumber)
      if (!versionData) {
        return { success: false, message: `Version ${versionNumber} not found` }
      }
      
      // Convert version row back to level data format
      const levelData = {
        version: 1,
        metadata: {
          name: versionData.name,
          description: versionData.description || "",
          difficulty: versionData.difficulty || "Medium",
          author: versionData.author || "The Diminished Chord",
          created: versionData.published_at ? new Date(versionData.published_at).getTime() : Date.now(),
          modified: Date.now(),
          isTutorialLevel: versionData.level_type === "tutorial"
        },
        settings: versionData.settings,
        spawn: versionData.spawn,
        goal: versionData.goal,
        platforms: versionData.platforms || [],
        hazards: versionData.hazards || [],
        movingPlatforms: versionData.moving_platforms || [],
        fragments: versionData.fragments || [],
        checkpoints: versionData.checkpoints || [],
        enemies: versionData.enemies || [],
        triggers: versionData.triggers || [],
        styleWorld: versionData.style_world,
        stylePreset: versionData.style_preset || "auto",
        tileStyles: versionData.tile_styles || []
      }
      
      // Publish as a new version (this will auto-create a new version entry)
      const result = await this.publishLevel(levelId, levelData)
      
      if (result.success) {
        return { 
          success: true, 
          message: `Reverted to version ${versionNumber} (new version created)` 
        }
      }
      
      return result
    } catch (e) {
      console.error(`[LevelDataManager] Failed to revert level:`, e)
      return { success: false, message: e.message }
    }
  }
  
  /**
   * Get the latest version number for a level
   * @param {string} levelId - The level ID
   * @returns {Promise<number>} The latest version number or 0 if no versions
   */
  async getLatestVersionNumber(levelId) {
    try {
      const { data, error } = await supabase
        .from('level_versions')
        .select('version_number')
        .eq('level_id', levelId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()
      
      if (error || !data) {
        return 0
      }
      
      return data.version_number
    } catch (e) {
      return 0
    }
  }
}

// Singleton instance
export const LevelDataManager = new LevelDataManagerClass()

// Initialize on import
LevelDataManager.initialize()
