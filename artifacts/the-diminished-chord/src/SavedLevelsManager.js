/**
 * SavedLevelsManager - Manages saved custom levels
 * 
 * PERSISTENCE MODEL:
 * - PRIMARY: Supabase custom_levels table (permanent, persists across sessions)
 * - FALLBACK: localStorage for runtime caching when Supabase unavailable
 * - Levels are saved to public/levels/saved-levels.json as backup
 */

import { supabase } from "./integrations/supabase/client.js"

const STORAGE_KEY = "diminished_chord_saved_levels"
const BUILTIN_LEVELS_KEY = "diminished_chord_builtin_levels"
// Use absolute path to ensure correct loading from any route
const LEVELS_JSON_PATH = "/levels/saved-levels.json"

// In-memory cache of level data
let levelsCache = null
let worldTourLevelsCache = {}
let builtinOverridesCache = {}
let isInitialized = false
let initPromise = null
let supabaseAvailable = false

/**
 * Load custom levels from Supabase custom_levels table
 * This is the primary data source for "My Levels"
 */
async function loadCustomLevelsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('custom_levels')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.warn("[SavedLevelsManager] Supabase query error:", error.message)
      return []
    }
    
    if (data && data.length > 0) {
      supabaseAvailable = true
      console.log(`[SavedLevelsManager] Loaded ${data.length} custom levels from Supabase`)
      
      // Convert Supabase format to local format
      return data.map(row => ({
        id: row.id,
        title: row.title || "Untitled",
        levelNumber: 0, // Will be reassigned
        data: {
          mapWidth: row.settings?.width ? row.settings.width / 64 : 30,
          mapHeight: row.settings?.height ? row.settings.height / 64 : 12,
          objects: convertFromSupabaseFormat(row)
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        description: row.description,
        difficulty: row.difficulty
      }))
    } else {
      supabaseAvailable = true
      console.log("[SavedLevelsManager] Supabase connected, no custom levels yet")
      return []
    }
  } catch (e) {
    console.warn("[SavedLevelsManager] Supabase not available:", e.message)
    supabaseAvailable = false
    return []
  }
}

/**
 * Convert Supabase row to level designer objects format
 */
function convertFromSupabaseFormat(row) {
  const objects = []
  const tileSize = 64
  
  // Convert platforms
  if (row.platforms) {
    row.platforms.forEach(p => {
      objects.push({
        type: "platform",
        x: p.x / tileSize,
        y: p.y / tileSize,
        width: p.width / tileSize,
        height: (p.height || tileSize) / tileSize
      })
    })
  }
  
  // Convert spawn
  if (row.spawn) {
    objects.push({
      type: "spawn",
      x: Math.floor(row.spawn.x / tileSize),
      y: Math.floor(row.spawn.y / tileSize),
      width: 1,
      height: 1
    })
  }
  
  // Convert goal
  if (row.goal) {
    objects.push({
      type: "goal",
      x: Math.floor(row.goal.x / tileSize),
      y: Math.floor(row.goal.y / tileSize),
      width: 1,
      height: 1
    })
  }
  
  // Convert hazards
  if (row.hazards) {
    row.hazards.forEach(h => {
      objects.push({
        type: h.type || "spike",
        x: h.x / tileSize,
        y: h.y / tileSize,
        width: 1,
        height: 1
      })
    })
  }
  
  // Convert fragments
  if (row.fragments) {
    row.fragments.forEach(f => {
      objects.push({
        type: f.type?.startsWith("fragment_") ? f.type : `fragment_${f.type || "note"}`,
        x: Math.floor(f.x / tileSize),
        y: Math.floor(f.y / tileSize),
        width: 1,
        height: 1
      })
    })
  }
  
  return objects
}

/**
 * Convert level designer format to Supabase format
 */
function convertToSupabaseFormat(levelData) {
  const tileSize = 64
  const objects = levelData.objects || []
  
  const platforms = []
  const hazards = []
  const fragments = []
  let spawn = { x: 100, y: 600 }
  let goal = { x: 1800, y: 600, width: 64, height: 64 }
  
  objects.forEach(obj => {
    switch (obj.type) {
      case "platform":
        platforms.push({
          x: obj.x * tileSize,
          y: obj.y * tileSize,
          width: obj.width * tileSize,
          height: (obj.height || 1) * tileSize
        })
        break
      case "spawn":
        spawn = {
          x: (obj.x + 0.5) * tileSize,
          y: (obj.y + 1) * tileSize
        }
        break
      case "goal":
        goal = {
          x: (obj.x + 0.5) * tileSize,
          y: (obj.y + 1) * tileSize,
          width: 64,
          height: 64
        }
        break
      case "spike":
      case "saw":
      case "saw_h":
      case "saw_v":
      case "saw_c":
        hazards.push({
          type: obj.type,
          x: (obj.x + 0.5) * tileSize,
          y: (obj.y + 1) * tileSize
        })
        break
      default:
        if (obj.type?.startsWith("fragment_") || obj.type?.startsWith("bonus_") || obj.type === "demo_fragment") {
          fragments.push({
            type: obj.type,
            x: (obj.x + 0.5) * tileSize,
            y: (obj.y + 0.5) * tileSize
          })
        }
        break
    }
  })
  
  return {
    settings: {
      width: (levelData.mapWidth || 30) * tileSize,
      height: (levelData.mapHeight || 12) * tileSize,
      tileSize: tileSize,
      gravity: 1200,
      backgroundColor: "#1a1a2e"
    },
    platforms,
    hazards,
    fragments,
    spawn,
    goal
  }
}

/**
 * Load levels data from Supabase, JSON file and localStorage
 * Supabase takes priority (source of truth for custom levels)
 */
async function loadLevelsFromFile() {
  // First, load from localStorage (this is always the most up-to-date in preview mode)
  let localCustomLevels = []
  let localBuiltinOverrides = {}
  let localWorldTourLevels = {}
  
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    localCustomLevels = data ? JSON.parse(data) : []
    
    const builtinData = localStorage.getItem(BUILTIN_LEVELS_KEY)
    localBuiltinOverrides = builtinData ? JSON.parse(builtinData) : {}
    
    const worldTourData = localStorage.getItem("diminished_chord_level_data")
    localWorldTourLevels = worldTourData ? JSON.parse(worldTourData) : {}
    
    console.log("[SavedLevelsManager] Loaded from localStorage:", {
      customLevels: localCustomLevels.length,
      worldTourLevels: Object.keys(localWorldTourLevels).length,
      builtinOverrides: Object.keys(localBuiltinOverrides).length
    })
  } catch (e) {
    console.warn("[SavedLevelsManager] Could not load from localStorage:", e)
  }
  
  // Then try to load from JSON file
  let jsonCustomLevels = []
  let jsonBuiltinOverrides = {}
  let jsonWorldTourLevels = {}
  let jsonLoaded = false
  
  try {
    // Add cache-busting to ensure we get the latest file
    const cacheBuster = `?t=${Date.now()}`
    const response = await fetch(LEVELS_JSON_PATH + cacheBuster)
    if (response.ok) {
      const data = await response.json()
      jsonCustomLevels = data.customLevels || []
      jsonWorldTourLevels = data.worldTourLevels || {}
      jsonBuiltinOverrides = data.builtinOverrides || {}
      jsonLoaded = true
      console.log("[SavedLevelsManager] Loaded from JSON file:", {
        customLevels: jsonCustomLevels.length,
        worldTourLevels: Object.keys(jsonWorldTourLevels).length,
        builtinOverrides: Object.keys(jsonBuiltinOverrides).length
      })
    } else {
      console.warn("[SavedLevelsManager] JSON file fetch returned:", response.status)
    }
  } catch (e) {
    console.warn("[SavedLevelsManager] Could not load from JSON file:", e)
  }
  
  // Load from Supabase LAST (highest priority for custom levels)
  const supabaseCustomLevels = await loadCustomLevelsFromSupabase()
  
  // Use Supabase levels if available, otherwise fall back to localStorage/JSON
  if (supabaseCustomLevels.length > 0) {
    levelsCache = supabaseCustomLevels
    // Reassign level numbers
    levelsCache.forEach((level, index) => {
      level.levelNumber = index + 1
    })
  } else {
    // Merge: localStorage takes priority over JSON file
    levelsCache = localCustomLevels.length > 0 ? localCustomLevels : jsonCustomLevels
  }
  
  // For world tour levels and builtin overrides, merge with localStorage taking priority
  worldTourLevelsCache = { ...jsonWorldTourLevels, ...localWorldTourLevels }
  builtinOverridesCache = { ...jsonBuiltinOverrides, ...localBuiltinOverrides }
  
  console.log("[SavedLevelsManager] Final merged data:", {
    customLevels: levelsCache.length,
    worldTourLevels: Object.keys(worldTourLevelsCache).length,
    builtinOverrides: Object.keys(builtinOverridesCache).length,
    supabaseAvailable
  })
  
  return jsonLoaded
}

/**
 * Save all level data to the JSON file via download
 * This triggers a file download that the user can use to replace the JSON file
 */
function saveLevelsToFile() {
  const data = {
    version: 1,
    lastModified: new Date().toISOString(),
    customLevels: levelsCache || [],
    worldTourLevels: worldTourLevelsCache || {},
    builtinOverrides: builtinOverridesCache || {}
  }
  
  const jsonString = JSON.stringify(data, null, 2)
  
  // Also save to localStorage as backup/cache
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levelsCache))
    localStorage.setItem(BUILTIN_LEVELS_KEY, JSON.stringify(builtinOverridesCache))
    localStorage.setItem("diminished_chord_level_data", JSON.stringify(worldTourLevelsCache))
  } catch (e) {
    console.warn("[SavedLevelsManager] Could not save to localStorage:", e)
  }
  
  // Write to file system using File System Access API (if available)
  // or download the file for manual replacement
  writeToFile(jsonString)
}

/**
 * Write data to the levels JSON file
 * Uses fetch POST to Vite dev server endpoint
 */
async function writeToFile(jsonString) {
  // Try to write directly to file via the Vite plugin endpoint
  try {
    const response = await fetch('/__write_levels__', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: 'public/levels/saved-levels.json',
        content: jsonString
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log("[SavedLevelsManager] Saved levels to JSON file:", result)
      return true
    } else {
      console.warn("[SavedLevelsManager] File write failed with status:", response.status)
    }
  } catch (e) {
    console.warn("[SavedLevelsManager] File write endpoint not available:", e.message)
  }
  
  // Fallback: localStorage is already saved, just log
  console.log("[SavedLevelsManager] Using localStorage fallback for persistence")
  return false
}

/**
 * Download levels data as JSON file
 */
function downloadLevelsJson() {
  const data = {
    version: 1,
    lastModified: new Date().toISOString(),
    customLevels: levelsCache || [],
    worldTourLevels: worldTourLevelsCache || {},
    builtinOverrides: builtinOverridesCache || {}
  }
  
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = 'saved-levels.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  console.log("[SavedLevelsManager] Downloaded saved-levels.json")
}

export const SavedLevelsManager = {
  /**
   * Initialize the manager - load from JSON file
   * Returns a promise that resolves when initialization is complete
   */
  async initialize() {
    if (isInitialized) return Promise.resolve()
    if (initPromise) return initPromise
    
    initPromise = loadLevelsFromFile().then(() => {
      isInitialized = true
      console.log("[SavedLevelsManager] Initialization complete")
    })
    
    return initPromise
  },
  
  /**
   * Check if initialization is complete
   */
  isReady() {
    return isInitialized
  },
  
  /**
   * Wait for initialization to complete
   */
  async waitForReady() {
    if (isInitialized) return
    if (initPromise) await initPromise
  },

  /**
   * Get all saved custom levels
   * @returns {Array} Array of saved level objects
   */
  getAllSavedLevels() {
    if (levelsCache === null) {
      // Synchronous fallback if not initialized
      try {
        const data = localStorage.getItem(STORAGE_KEY)
        levelsCache = data ? JSON.parse(data) : []
      } catch (e) {
        levelsCache = []
      }
    }
    return levelsCache
  },

  /**
   * Save a new custom level to Supabase and local cache
   * @param {string} title - The level title
   * @param {object} levelData - The level data (mapWidth, mapHeight, objects)
   * @returns {Promise<object>} The saved level object
   */
  async saveLevel(title, levelData) {
    const levels = this.getAllSavedLevels()
    
    // Generate a unique ID and level number
    const id = crypto.randomUUID ? crypto.randomUUID() : `custom_${Date.now()}`
    const levelNumber = this.getNextLevelNumber()
    
    const savedLevel = {
      id,
      title,
      levelNumber,
      data: levelData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Try to save to Supabase first
    try {
      const supabaseData = convertToSupabaseFormat(levelData)
      const { data, error } = await supabase
        .from('custom_levels')
        .insert({
          id,
          title,
          description: levelData.description || "",
          difficulty: levelData.difficulty || "Medium",
          settings: supabaseData.settings,
          platforms: supabaseData.platforms,
          hazards: supabaseData.hazards,
          fragments: supabaseData.fragments,
          spawn: supabaseData.spawn,
          goal: supabaseData.goal,
          publish_status: 'draft'
        })
        .select()
      
      if (error) {
        console.error("[SavedLevelsManager] Supabase save error:", error.message)
      } else {
        console.log("[SavedLevelsManager] Saved custom level to Supabase:", id)
        supabaseAvailable = true
      }
    } catch (e) {
      console.warn("[SavedLevelsManager] Could not save to Supabase:", e.message)
    }
    
    // Also save to local cache
    levels.push(savedLevel)
    levelsCache = levels
    saveLevelsToFile()
    
    return savedLevel
  },

  /**
   * Update an existing saved level in Supabase and local cache
   * @param {string} id - The level ID
   * @param {object} updates - Object with title and/or data to update
   * @returns {Promise<boolean>} Success status
   */
  async updateLevel(id, updates) {
    const levels = this.getAllSavedLevels()
    const index = levels.findIndex(l => l.id === id)
    
    if (index === -1) return false
    
    if (updates.title !== undefined) {
      levels[index].title = updates.title
    }
    if (updates.data !== undefined) {
      levels[index].data = updates.data
    }
    levels[index].updatedAt = new Date().toISOString()
    
    // Try to update in Supabase
    try {
      const updateData = {
        updated_at: new Date().toISOString()
      }
      
      if (updates.title !== undefined) {
        updateData.title = updates.title
      }
      
      if (updates.data !== undefined) {
        const supabaseData = convertToSupabaseFormat(updates.data)
        updateData.settings = supabaseData.settings
        updateData.platforms = supabaseData.platforms
        updateData.hazards = supabaseData.hazards
        updateData.fragments = supabaseData.fragments
        updateData.spawn = supabaseData.spawn
        updateData.goal = supabaseData.goal
      }
      
      const { error } = await supabase
        .from('custom_levels')
        .update(updateData)
        .eq('id', id)
      
      if (error) {
        console.error("[SavedLevelsManager] Supabase update error:", error.message)
      } else {
        console.log("[SavedLevelsManager] Updated custom level in Supabase:", id)
      }
    } catch (e) {
      console.warn("[SavedLevelsManager] Could not update in Supabase:", e.message)
    }
    
    levelsCache = levels
    saveLevelsToFile()
    return true
  },

  /**
   * Delete a saved level from Supabase and local cache
   * @param {string} id - The level ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteLevel(id) {
    const levels = this.getAllSavedLevels()
    const filtered = levels.filter(l => l.id !== id)
    
    if (filtered.length === levels.length) return false
    
    // Try to delete from Supabase
    try {
      const { error } = await supabase
        .from('custom_levels')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error("[SavedLevelsManager] Supabase delete error:", error.message)
      } else {
        console.log("[SavedLevelsManager] Deleted custom level from Supabase:", id)
      }
    } catch (e) {
      console.warn("[SavedLevelsManager] Could not delete from Supabase:", e.message)
    }
    
    // Re-number remaining levels
    filtered.forEach((level, index) => {
      level.levelNumber = index + 1
    })
    
    levelsCache = filtered
    saveLevelsToFile()
    return true
  },

  /**
   * Get a specific level by ID
   * @param {string} id - The level ID
   * @returns {object|null} The level object or null
   */
  getLevel(id) {
    const levels = this.getAllSavedLevels()
    return levels.find(l => l.id === id) || null
  },

  /**
   * Get the next available level number
   * @returns {number}
   */
  getNextLevelNumber() {
    const levels = this.getAllSavedLevels()
    if (levels.length === 0) return 1
    return Math.max(...levels.map(l => l.levelNumber)) + 1
  },

  /**
   * Save levels array to storage
   * @param {Array} levels
   */
  saveLevelsToStorage(levels) {
    levelsCache = levels
    saveLevelsToFile()
  },

  /**
   * Get count of saved levels
   * @returns {number}
   */
  getSavedLevelCount() {
    return this.getAllSavedLevels().length
  },

  /**
   * Clear all saved levels (use with caution!)
   */
  clearAllSavedLevels() {
    levelsCache = []
    saveLevelsToFile()
  },

  /**
   * Export all levels as JSON string (for backup)
   * @returns {string}
   */
  exportAllLevels() {
    return JSON.stringify(this.getAllSavedLevels(), null, 2)
  },

  /**
   * Import levels from JSON string (for restore)
   * @param {string} jsonString
   * @returns {boolean} Success status
   */
  importLevels(jsonString) {
    try {
      const levels = JSON.parse(jsonString)
      if (!Array.isArray(levels)) return false
      levelsCache = levels
      saveLevelsToFile()
      return true
    } catch (e) {
      console.error("Error importing levels:", e)
      return false
    }
  },

  /**
   * Download all levels as a JSON file
   * Use this to get the file that should replace public/levels/saved-levels.json
   */
  downloadLevelsJson,

  // ==========================================
  // Built-in Level Overrides Management
  // ==========================================

  /**
   * Get all built-in level overrides
   * @returns {object} Object with level keys as keys
   */
  getBuiltinOverrides() {
    return builtinOverridesCache || {}
  },

  /**
   * Save a built-in level override
   * @param {string} levelKey - e.g., "Level1Scene"
   * @param {object} levelData - The custom level data
   */
  saveBuiltinOverride(levelKey, levelData) {
    builtinOverridesCache[levelKey] = {
      data: levelData,
      updatedAt: new Date().toISOString()
    }
    saveLevelsToFile()
  },

  /**
   * Get a built-in level override
   * @param {string} levelKey
   * @returns {object|null}
   */
  getBuiltinOverride(levelKey) {
    return builtinOverridesCache[levelKey] || null
  },

  /**
   * Delete a built-in level override (restore to default)
   * @param {string} levelKey
   */
  deleteBuiltinOverride(levelKey) {
    delete builtinOverridesCache[levelKey]
    saveLevelsToFile()
  },

  /**
   * Check if a built-in level has an override
   * @param {string} levelKey
   * @returns {boolean}
   */
  hasBuiltinOverride(levelKey) {
    return levelKey in builtinOverridesCache
  },

  // ==========================================
  // World Tour Levels Management
  // ==========================================

  /**
   * Get a World Tour level by ID
   * @param {string} levelId - e.g., "W1L1", "W2B3", "W3BOSS"
   * @returns {object|null}
   */
  getWorldTourLevel(levelId) {
    return worldTourLevelsCache[levelId] || null
  },

  /**
   * Save a World Tour level
   * @param {string} levelId
   * @param {object} levelData
   */
  saveWorldTourLevel(levelId, levelData) {
    worldTourLevelsCache[levelId] = levelData
    saveLevelsToFile()
    console.log(`[SavedLevelsManager] Saved World Tour level: ${levelId}`)
  },

  /**
   * Get all World Tour levels
   * @returns {object}
   */
  getAllWorldTourLevels() {
    return worldTourLevelsCache || {}
  },

  // ==========================================
  // Custom Level Names Management
  // ==========================================

  /**
   * Storage key for custom level names
   */
  CUSTOM_NAMES_KEY: "diminished_chord_custom_level_names",

  /**
   * Get all custom level names
   * @returns {object} Object with level keys as keys and custom names as values
   */
  getCustomLevelNames() {
    try {
      const data = localStorage.getItem(this.CUSTOM_NAMES_KEY)
      return data ? JSON.parse(data) : {}
    } catch (e) {
      console.error("Error loading custom level names:", e)
      return {}
    }
  },

  /**
   * Set a custom name for a level (works for built-in levels)
   * @param {string} levelKey - e.g., "Level1Scene"
   * @param {string} customName - The custom name to use
   */
  setCustomLevelName(levelKey, customName) {
    const names = this.getCustomLevelNames()
    if (customName && customName.trim()) {
      names[levelKey] = customName.trim()
    } else {
      delete names[levelKey] // Remove custom name to use default
    }
    localStorage.setItem(this.CUSTOM_NAMES_KEY, JSON.stringify(names))
  },

  /**
   * Get the custom name for a level (if any)
   * @param {string} levelKey
   * @returns {string|null} The custom name or null if using default
   */
  getCustomLevelName(levelKey) {
    const names = this.getCustomLevelNames()
    return names[levelKey] || null
  },

  /**
   * Check if a level has a custom name
   * @param {string} levelKey
   * @returns {boolean}
   */
  hasCustomLevelName(levelKey) {
    const names = this.getCustomLevelNames()
    return levelKey in names
  },

  /**
   * Remove custom name for a level (revert to default)
   * @param {string} levelKey
   */
  removeCustomLevelName(levelKey) {
    const names = this.getCustomLevelNames()
    delete names[levelKey]
    localStorage.setItem(this.CUSTOM_NAMES_KEY, JSON.stringify(names))
  },

  // ==========================================
  // Tutorial Levels Management
  // ==========================================

  /**
   * Get all levels marked as tutorials, sorted by creation order
   * Tutorial levels are assigned T1, T2, T3 codes based on creation order
   * @returns {Array} Array of tutorial level objects with tutorialCode property
   */
  getTutorialLevels() {
    const levels = this.getAllSavedLevels()
    const tutorialLevels = levels
      .filter(level => level.data && level.data.isTutorialLevel === true)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((level, index) => ({
        ...level,
        tutorialCode: `T${index + 1}`
      }))
    return tutorialLevels
  },

  /**
   * Get the count of tutorial levels
   * @returns {number}
   */
  getTutorialLevelCount() {
    return this.getTutorialLevels().length
  },

  /**
   * Get a tutorial level by its tutorial code (T1, T2, etc.)
   * @param {string} tutorialCode - e.g., "T1", "T2"
   * @returns {object|null}
   */
  getTutorialLevelByCode(tutorialCode) {
    const tutorials = this.getTutorialLevels()
    return tutorials.find(t => t.tutorialCode === tutorialCode) || null
  }
}

// Auto-initialize when module loads
SavedLevelsManager.initialize()
