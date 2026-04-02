/**
 * WorldManager - Manages the 15 World × 20 Level hierarchy
 * 
 * Structure:
 * - Tutorial (Level 0)
 * - 15 Worlds, each with 20 levels:
 *   - 14 Normal levels (1-14)
 *   - 5 Bonus levels (b1-b5)
 *   - 1 Boss level
 * 
 * Total: 1 + (15 × 20) = 301 levels
 */

// World definitions following the 3-Act narrative arc
export const WORLDS = {
  // === ACT I: THE UNDERGROUND (Worlds 1-5) ===
  1: {
    id: 1,
    name: "Basement Show",
    location: "Detroit",
    act: 1,
    theme: "underground",
    description: "DIY grind. Small venues. Raw sound.",
    mechanicFocus: "Basic jump physics, wall jump intro, spike hazards",
    musicComplexity: "simple", // 3-4 fragments
    environmentHazards: ["spikes", "pits"],
    unlockRequirement: null, // Starting world
    bossName: "Rival Garage Band",
    bossMechanic: "Outrun collapsing stage platforms"
  },
  2: {
    id: 2,
    name: "Industrial Warehouse",
    location: "Berlin",
    act: 1,
    theme: "industrial",
    description: "Cold concrete. Harsh beats. Moving machinery.",
    mechanicFocus: "Moving platforms, timed crushers, rhythm-synced hazards",
    musicComplexity: "simple",
    environmentHazards: ["crushers", "moving_platforms", "spikes"],
    unlockRequirement: { world: 1, boss: true },
    bossName: "The Machine",
    bossMechanic: "Navigate synchronized crushing pistons"
  },
  3: {
    id: 3,
    name: "Neon Rooftops",
    location: "Tokyo",
    act: 1,
    theme: "neon",
    description: "High-rise chaos. Neon lights. Fast pacing.",
    mechanicFocus: "Air control mastery, mid-air hazard dodging",
    musicComplexity: "medium",
    environmentHazards: ["lasers", "drones", "wind"],
    unlockRequirement: { world: 2, boss: true },
    bossName: "Spotlight Drones",
    bossMechanic: "Stealth-platform hybrid, avoid detection"
  },
  4: {
    id: 4,
    name: "Rain-Slick Streets",
    location: "London",
    act: 1,
    theme: "rainy",
    description: "Slippery surfaces. Punk roots. Tight windows.",
    mechanicFocus: "Slippery friction surfaces, downward momentum precision",
    musicComplexity: "medium",
    environmentHazards: ["slippery_surfaces", "rain", "puddles"],
    unlockRequirement: { world: 3, boss: true },
    bossName: "The Critics",
    bossMechanic: "Dodge review scores while climbing"
  },
  5: {
    id: 5,
    name: "Festival Breakthrough",
    location: "Festival Grounds",
    act: 1,
    theme: "festival",
    description: "Act I climax. Massive stage. The breakthrough.",
    mechanicFocus: "All Act I mechanics combined",
    musicComplexity: "full",
    environmentHazards: ["pyrotechnics", "crowd_surge", "stage_collapse"],
    unlockRequirement: { world: 4, boss: true },
    bossName: "The Headliner",
    bossMechanic: "Massive stage structure collapsing in phases"
  },

  // === ACT II: THE INDUSTRY (Worlds 6-10) ===
  6: {
    id: 6,
    name: "Arctic Isolation",
    location: "Reykjavik",
    act: 2,
    theme: "arctic",
    description: "Low-gravity. Momentum carry. Atmospheric breakdowns.",
    mechanicFocus: "Low-gravity jumps, momentum preservation",
    musicComplexity: "atmospheric",
    environmentHazards: ["ice", "wind", "crevasses"],
    unlockRequirement: { world: 5, boss: true },
    bossName: "The Silence",
    bossMechanic: "Navigate in near-complete darkness"
  },
  7: {
    id: 7,
    name: "Label Headquarters",
    location: "Los Angeles",
    act: 2,
    theme: "corporate",
    description: "Laser grids. Pattern-reading. Corporate maze.",
    mechanicFocus: "Laser grids, pattern recognition, tight corridors",
    musicComplexity: "distorted",
    environmentHazards: ["lasers", "security", "contracts"],
    unlockRequirement: { world: 6, boss: true },
    bossName: "Algorithm Engine",
    bossMechanic: "Boss reacts to player timing patterns"
  },
  8: {
    id: 8,
    name: "Arena Tour",
    location: "Sydney",
    act: 2,
    theme: "arena",
    description: "Multi-path routing. Speedrun incentive. Peak fame.",
    mechanicFocus: "Multiple paths, optional shortcuts, speed focus",
    musicComplexity: "full",
    environmentHazards: ["pyrotechnics", "crowd", "equipment"],
    unlockRequirement: { world: 7, boss: true },
    bossName: "The Encore",
    bossMechanic: "Survive increasingly demanding encore requests"
  },
  9: {
    id: 9,
    name: "Media Storm",
    location: "New York City",
    act: 2,
    theme: "media",
    description: "Rapid transitions. Forced climbs. Chaos pacing.",
    mechanicFocus: "Camera transitions, vertical climbs, chaos",
    musicComplexity: "layered",
    environmentHazards: ["cameras", "paparazzi", "headlines"],
    unlockRequirement: { world: 8, boss: true },
    bossName: "The Interview",
    bossMechanic: "Dodge loaded questions that manifest as projectiles"
  },
  10: {
    id: 10,
    name: "Contract Trap",
    location: "Corporate Tower",
    act: 2,
    theme: "contract",
    description: "Narrative heavy. Creative crisis. The trap springs.",
    mechanicFocus: "Rhythmic platforms, beat-synced gameplay",
    musicComplexity: "distorted",
    environmentHazards: ["contracts", "fine_print", "golden_cages"],
    unlockRequirement: { world: 9, boss: true },
    bossName: "Auto-Tune Entity",
    bossMechanic: "Platforms appear on beat, mistiming causes collapse"
  },

  // === ACT III: INTERNAL BATTLE (Worlds 11-15) ===
  11: {
    id: 11,
    name: "Doubt",
    location: "Inner Mind",
    act: 3,
    theme: "psychological",
    description: "Mirror worlds. Fake platforms. Illusory hazards.",
    mechanicFocus: "Illusions, fake platforms, mirror mechanics",
    musicComplexity: "detuned",
    environmentHazards: ["mirrors", "illusions", "shadows"],
    unlockRequirement: { world: 10, boss: true },
    bossName: "The Reflection",
    bossMechanic: "Fight your own shadow that mimics movements"
  },
  12: {
    id: 12,
    name: "Time Fracture",
    location: "Temporal Void",
    act: 3,
    theme: "time",
    description: "Slow-motion zones. Speed-up zones. Split-second timing.",
    mechanicFocus: "Time manipulation, tempo changes",
    musicComplexity: "stretched",
    environmentHazards: ["time_zones", "paradoxes", "loops"],
    unlockRequirement: { world: 11, boss: true },
    bossName: "The Metronome",
    bossMechanic: "Survive constantly shifting time speeds"
  },
  13: {
    id: 13,
    name: "Noise Collapse",
    location: "Static Realm",
    act: 3,
    theme: "glitch",
    description: "Glitching geometry. Environmental distortion. Harsh remix.",
    mechanicFocus: "Glitch mechanics, unstable platforms",
    musicComplexity: "harsh",
    environmentHazards: ["glitches", "corruption", "static"],
    unlockRequirement: { world: 12, boss: true },
    bossName: "The Feedback Loop",
    bossMechanic: "Escape infinitely spawning noise"
  },
  14: {
    id: 14,
    name: "Clarity",
    location: "Pure Space",
    act: 3,
    theme: "clarity",
    description: "Pure skill. No gimmicks. Fast but readable.",
    mechanicFocus: "Pure platforming mastery",
    musicComplexity: "clean",
    environmentHazards: ["precision_only"],
    unlockRequirement: { world: 13, boss: true },
    bossName: "The Perfectionist",
    bossMechanic: "Flawless execution gauntlet"
  },
  15: {
    id: 15,
    name: "The Diminished Chord",
    location: "Core of Self",
    act: 3,
    theme: "finale",
    description: "Final psychological space. The ultimate test.",
    mechanicFocus: "All mechanics combined, multi-phase boss",
    musicComplexity: "masterpiece",
    environmentHazards: ["everything"],
    unlockRequirement: { world: 14, boss: true },
    bossName: "Self-Doubt Manifestation",
    bossMechanic: "Phase 1: movement, Phase 2: platforming+rhythm, Phase 3: speedrun gauntlet"
  }
}

// Level types within each world
export const LEVEL_TYPES = {
  NORMAL: "normal",      // 14 per world
  BONUS: "bonus",        // 5 per world (b1-b5)
  BOSS: "boss"           // 1 per world
}

// Bonus level purposes and unlock criteria
// B1: Unlocks when boss is defeated (world completion)
// B2: Unlocks when special hidden item is found in a designated level
// B3: Unlocks when 100% fragments collected from all normal levels
// B4: Unlocks when all normal levels have been speed-run (met target time)
// B5: Unlocks when the entire game is completed (all 15 world bosses defeated)
export const BONUS_PURPOSES = {
  b1: { name: "World Complete Bonus", reward: "remix_fragment", unlockMethod: "boss_defeated" },
  b2: { name: "Secret Discovery", reward: "live_version", unlockMethod: "hidden_item" },
  b3: { name: "Collector's Challenge", reward: "instrumental_variant", unlockMethod: "all_fragments" },
  b4: { name: "Speedrunner's Dream", reward: "hardcore_stem", unlockMethod: "all_speedruns" },
  b5: { name: "Universe Complete", reward: "acoustic_demo", unlockMethod: "game_complete" }
}

/**
 * Generate level ID from world and level number
 * Format: W{world}L{level} or W{world}B{bonus} or W{world}BOSS
 */
export function getLevelId(worldNum, levelNum, levelType = LEVEL_TYPES.NORMAL) {
  if (worldNum === 0) return "Tutorial"
  
  switch (levelType) {
    case LEVEL_TYPES.BOSS:
      return `W${worldNum}BOSS`
    case LEVEL_TYPES.BONUS:
      return `W${worldNum}B${levelNum}`
    default:
      return `W${worldNum}L${levelNum}`
  }
}

/**
 * Parse level ID back to components
 */
export function parseLevelId(levelId) {
  if (levelId === "Tutorial") {
    return { world: 0, level: 0, type: LEVEL_TYPES.NORMAL }
  }
  
  const bossMatch = levelId.match(/^W(\d+)BOSS$/)
  if (bossMatch) {
    return { world: parseInt(bossMatch[1]), level: 0, type: LEVEL_TYPES.BOSS }
  }
  
  const bonusMatch = levelId.match(/^W(\d+)B(\d+)$/)
  if (bonusMatch) {
    return { world: parseInt(bonusMatch[1]), level: parseInt(bonusMatch[2]), type: LEVEL_TYPES.BONUS }
  }
  
  const normalMatch = levelId.match(/^W(\d+)L(\d+)$/)
  if (normalMatch) {
    return { world: parseInt(normalMatch[1]), level: parseInt(normalMatch[2]), type: LEVEL_TYPES.NORMAL }
  }
  
  return null
}

/**
 * Generate all level IDs for a world
 */
export function getWorldLevelIds(worldNum) {
  const levels = []
  
  // 14 normal levels
  for (let i = 1; i <= 14; i++) {
    levels.push(getLevelId(worldNum, i, LEVEL_TYPES.NORMAL))
  }
  
  // 5 bonus levels
  for (let i = 1; i <= 5; i++) {
    levels.push(getLevelId(worldNum, i, LEVEL_TYPES.BONUS))
  }
  
  // 1 boss level
  levels.push(getLevelId(worldNum, 0, LEVEL_TYPES.BOSS))
  
  return levels
}

/**
 * Generate ALL level IDs in the game (301 total)
 */
export function getAllLevelIds() {
  const levels = ["Tutorial"]
  
  for (let world = 1; world <= 15; world++) {
    levels.push(...getWorldLevelIds(world))
  }
  
  return levels
}

/**
 * Get scene key for a level ID
 * All world levels use DynamicLevelScene, which receives the levelId via init data
 */
export function getLevelSceneKey(levelId) {
  // All levels from the World Tour system use DynamicLevelScene
  // The levelId is passed via scene.start(key, { levelId }) 
  return "DynamicLevelScene"
}

/**
 * WorldManager class for runtime operations
 */
class WorldManagerClass {
  constructor() {
    this.currentWorld = 1
    this.currentLevel = null
    this.unlockedWorlds = new Set([1])
    this.completedLevels = new Set()
    this.loadProgress()
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem("diminished_chord_world_progress")
      if (saved) {
        const data = JSON.parse(saved)
        this.unlockedWorlds = new Set(data.unlockedWorlds || [1])
        this.completedLevels = new Set(data.completedLevels || [])
        this.currentWorld = data.currentWorld || 1
      }
    } catch (e) {
      console.error("[WorldManager] Failed to load progress:", e)
    }
  }

  saveProgress() {
    try {
      const data = {
        unlockedWorlds: Array.from(this.unlockedWorlds),
        completedLevels: Array.from(this.completedLevels),
        currentWorld: this.currentWorld
      }
      localStorage.setItem("diminished_chord_world_progress", JSON.stringify(data))
    } catch (e) {
      console.error("[WorldManager] Failed to save progress:", e)
    }
  }

  getWorld(worldNum) {
    return WORLDS[worldNum] || null
  }

  isWorldUnlocked(worldNum) {
    return this.unlockedWorlds.has(worldNum)
  }

  unlockWorld(worldNum) {
    this.unlockedWorlds.add(worldNum)
    this.saveProgress()
  }

  completeLevel(levelId) {
    this.completedLevels.add(levelId)
    
    // Check if this unlocks a new world
    const parsed = parseLevelId(levelId)
    if (parsed && parsed.type === LEVEL_TYPES.BOSS) {
      const nextWorld = parsed.world + 1
      if (nextWorld <= 15) {
        this.unlockWorld(nextWorld)
      }
    }
    
    this.saveProgress()
  }

  isLevelCompleted(levelId) {
    // If clean slate mode is active, no levels are completed
    if (this.isCleanSlateMode()) {
      return false
    }
    return this.completedLevels.has(levelId)
  }
  
  /**
   * Check if Clean Slate Mode is active (for testing)
   * When active, the game behaves as if the player has no progress
   */
  isCleanSlateMode() {
    return localStorage.getItem("clean_slate_mode") === "true"
  }

  isLevelUnlocked(levelId) {
    // If clean slate mode is active, only Tutorial and W1L1 are unlocked
    if (this.isCleanSlateMode()) {
      if (levelId === "Tutorial") return true
      const parsed = parseLevelId(levelId)
      if (parsed && parsed.world === 1 && parsed.type === LEVEL_TYPES.NORMAL && parsed.level === 1) {
        return true
      }
      return false
    }
    
    if (levelId === "Tutorial") return true
    
    const parsed = parseLevelId(levelId)
    if (!parsed) return false
    
    // World must be unlocked
    if (!this.isWorldUnlocked(parsed.world)) return false
    
    // Normal level 1 is always unlocked in an unlocked world
    if (parsed.type === LEVEL_TYPES.NORMAL && parsed.level === 1) return true
    
    // Other levels require previous level completion
    if (parsed.type === LEVEL_TYPES.NORMAL) {
      const prevLevel = getLevelId(parsed.world, parsed.level - 1, LEVEL_TYPES.NORMAL)
      return this.isLevelCompleted(prevLevel)
    }
    
    // Bonus level unlock criteria:
    // B1: Unlocks when boss is defeated (world completion)
    // B2: Unlocks when special hidden item is found in designated level
    // B3: Unlocks when 100% fragments collected from all normal levels
    // B4: Unlocks when all normal levels have been speed-run
    // B5: Unlocks when entire game is completed (all 15 bosses defeated)
    if (parsed.type === LEVEL_TYPES.BONUS) {
      return this.isBonusLevelUnlocked(parsed.world, parsed.level)
    }
    
    // Boss requires all 14 normal levels completed
    if (parsed.type === LEVEL_TYPES.BOSS) {
      for (let i = 1; i <= 14; i++) {
        if (!this.isLevelCompleted(getLevelId(parsed.world, i, LEVEL_TYPES.NORMAL))) {
          return false
        }
      }
      return true
    }
    
    return false
  }

  getNextLevel(currentLevelId) {
    const parsed = parseLevelId(currentLevelId)
    if (!parsed) return null
    
    if (currentLevelId === "Tutorial") {
      return getLevelId(1, 1, LEVEL_TYPES.NORMAL)
    }
    
    if (parsed.type === LEVEL_TYPES.NORMAL && parsed.level < 14) {
      return getLevelId(parsed.world, parsed.level + 1, LEVEL_TYPES.NORMAL)
    }
    
    if (parsed.type === LEVEL_TYPES.NORMAL && parsed.level === 14) {
      // After level 14, go to boss
      return getLevelId(parsed.world, 0, LEVEL_TYPES.BOSS)
    }
    
    if (parsed.type === LEVEL_TYPES.BOSS && parsed.world < 15) {
      // After boss, go to next world
      return getLevelId(parsed.world + 1, 1, LEVEL_TYPES.NORMAL)
    }
    
    return null // End of game
  }

  getWorldProgress(worldNum) {
    let completed = 0
    let total = 20
    
    // Count completed normal levels
    for (let i = 1; i <= 14; i++) {
      if (this.isLevelCompleted(getLevelId(worldNum, i, LEVEL_TYPES.NORMAL))) {
        completed++
      }
    }
    
    // Count completed bonus levels
    for (let i = 1; i <= 5; i++) {
      if (this.isLevelCompleted(getLevelId(worldNum, i, LEVEL_TYPES.BONUS))) {
        completed++
      }
    }
    
    // Count boss
    if (this.isLevelCompleted(getLevelId(worldNum, 0, LEVEL_TYPES.BOSS))) {
      completed++
    }
    
    return { completed, total, percent: Math.round((completed / total) * 100) }
  }

  getTotalProgress() {
    let completed = 0
    const total = 301
    
    if (this.isLevelCompleted("Tutorial")) completed++
    
    for (let world = 1; world <= 15; world++) {
      const worldProgress = this.getWorldProgress(world)
      completed += worldProgress.completed
    }
    
    return { completed, total, percent: Math.round((completed / total) * 100) }
  }

  resetProgress() {
    this.unlockedWorlds = new Set([1])
    this.completedLevels = new Set()
    this.currentWorld = 1
    // Also reset hidden item found tracking
    this.hiddenItemsFound = new Set()
    this.speedRunsCompleted = new Map()
    this.fragmentsComplete = new Set()
    this.saveProgress()
  }

  // Dev mode: unlock all
  unlockAll() {
    for (let world = 1; world <= 15; world++) {
      this.unlockedWorlds.add(world)
    }
    this.saveProgress()
  }

  /**
   * Check if a specific bonus level is unlocked based on its unlock criteria
   * @param {number} worldNum - World number (1-15)
   * @param {number} bonusNum - Bonus level number (1-5)
   * @returns {boolean}
   */
  isBonusLevelUnlocked(worldNum, bonusNum) {
    switch (bonusNum) {
      case 1:
        // B1: Unlocks when boss is defeated (world completion)
        return this.isLevelCompleted(getLevelId(worldNum, 0, LEVEL_TYPES.BOSS))
      
      case 2:
        // B2: Unlocks when special hidden item is found in designated level
        return this.isHiddenItemFoundForWorld(worldNum)
      
      case 3:
        // B3: Unlocks when 100% fragments collected from all normal levels in this world
        return this.areAllFragmentsCollectedInWorld(worldNum)
      
      case 4:
        // B4: Unlocks when all normal levels have been speed-run (met target time)
        return this.areAllSpeedRunsCompletedInWorld(worldNum)
      
      case 5:
        // B5: Unlocks when entire game is completed (all 15 bosses defeated)
        return this.isGameComplete()
      
      default:
        return false
    }
  }

  /**
   * Check if the hidden item for a world's B2 level has been found
   * @param {number} worldNum
   * @returns {boolean}
   */
  isHiddenItemFoundForWorld(worldNum) {
    // Check localStorage/memory for hidden item collection
    // Hidden items are tracked separately from regular fragments
    const hiddenItemKey = `hidden_item_w${worldNum}`
    return this.hiddenItemsFound?.has(hiddenItemKey) || 
           localStorage.getItem(hiddenItemKey) === 'true'
  }
  
  /**
   * Get the hidden item configuration for a world (which level and what item type)
   * @param {number} worldNum
   * @returns {{ level: number, itemType: string }}
   */
  getHiddenItemConfig(worldNum) {
    const config = localStorage.getItem(`hidden_item_config_w${worldNum}`)
    if (config) {
      try {
        return JSON.parse(config)
      } catch (e) {
        console.warn("[WorldManager] Invalid hidden item config for world", worldNum)
      }
    }
    // Defaults for each world (varied for interest)
    const defaults = {
      1: { level: 5, itemType: "record_deal" },
      2: { level: 9, itemType: "vinyl" },
      3: { level: 3, itemType: "mixtape" },
      4: { level: 12, itemType: "cd" },
      5: { level: 7, itemType: "golden_note" },
      6: { level: 11, itemType: "record_deal" },
      7: { level: 2, itemType: "vinyl" },
      8: { level: 14, itemType: "mixtape" },
      9: { level: 6, itemType: "cd" },
      10: { level: 10, itemType: "golden_note" },
      11: { level: 4, itemType: "record_deal" },
      12: { level: 13, itemType: "vinyl" },
      13: { level: 8, itemType: "mixtape" },
      14: { level: 1, itemType: "cd" },
      15: { level: 9, itemType: "golden_note" }
    }
    return defaults[worldNum] || { level: 5, itemType: "record_deal" }
  }
  
  /**
   * Check if a specific level should contain the hidden B2 unlock item
   * @param {string} levelId
   * @returns {{ hasHiddenItem: boolean, itemType: string | null }}
   */
  levelHasHiddenItem(levelId) {
    const parsed = parseLevelId(levelId)
    if (!parsed || parsed.type !== LEVEL_TYPES.NORMAL) {
      return { hasHiddenItem: false, itemType: null }
    }
    
    const config = this.getHiddenItemConfig(parsed.world)
    if (config.level === parsed.level) {
      return { hasHiddenItem: true, itemType: config.itemType }
    }
    return { hasHiddenItem: false, itemType: null }
  }

  /**
   * Mark a hidden item as found for a world
   * @param {number} worldNum
   */
  foundHiddenItem(worldNum) {
    if (!this.hiddenItemsFound) {
      this.hiddenItemsFound = new Set()
    }
    const hiddenItemKey = `hidden_item_w${worldNum}`
    this.hiddenItemsFound.add(hiddenItemKey)
    localStorage.setItem(hiddenItemKey, 'true')
    console.log(`[WorldManager] Hidden item found for World ${worldNum}! B2 unlocked.`)
  }

  /**
   * Check if all fragments have been collected in all normal levels of a world
   * This requires PlayerProgressManager data
   * @param {number} worldNum
   * @returns {boolean}
   */
  areAllFragmentsCollectedInWorld(worldNum) {
    // This needs to be checked via PlayerProgressManager
    // For now, check a cached/stored value
    const key = `all_fragments_w${worldNum}`
    return this.fragmentsComplete?.has(key) ||
           localStorage.getItem(key) === 'true'
  }

  /**
   * Mark all fragments as collected for a world (called by PlayerProgressManager)
   * @param {number} worldNum
   */
  markAllFragmentsCollected(worldNum) {
    if (!this.fragmentsComplete) {
      this.fragmentsComplete = new Set()
    }
    const key = `all_fragments_w${worldNum}`
    this.fragmentsComplete.add(key)
    localStorage.setItem(key, 'true')
    console.log(`[WorldManager] All fragments collected for World ${worldNum}! B3 unlocked.`)
  }

  /**
   * Check if all normal levels have had their speedrun targets met
   * @param {number} worldNum
   * @returns {boolean}
   */
  areAllSpeedRunsCompletedInWorld(worldNum) {
    const key = `all_speedruns_w${worldNum}`
    return this.speedRunsCompleted?.has(key) ||
           localStorage.getItem(key) === 'true'
  }

  /**
   * Mark all speedruns as completed for a world
   * @param {number} worldNum
   */
  markAllSpeedRunsCompleted(worldNum) {
    if (!this.speedRunsCompleted) {
      this.speedRunsCompleted = new Set()
    }
    const key = `all_speedruns_w${worldNum}`
    this.speedRunsCompleted.add(key)
    localStorage.setItem(key, 'true')
    console.log(`[WorldManager] All speedruns completed for World ${worldNum}! B4 unlocked.`)
  }

  /**
   * Check if the entire game is complete (all 15 world bosses defeated)
   * @returns {boolean}
   */
  isGameComplete() {
    for (let world = 1; world <= 15; world++) {
      if (!this.isLevelCompleted(getLevelId(world, 0, LEVEL_TYPES.BOSS))) {
        return false
      }
    }
    return true
  }

  /**
   * Check if tutorial world is completed
   * Tutorial world is completed when at least one tutorial level has been completed
   * This is required to unlock World Tour in Story Mode
   * @returns {boolean}
   */
  isTutorialWorldCompleted() {
    // Check if any level starting with "T" or the "Tutorial" level is completed
    for (const levelId of this.completedLevels) {
      if (levelId === "Tutorial" || levelId.startsWith("tutorial_") || levelId.match(/^T\d+$/)) {
        return true
      }
    }
    return false
  }

  /**
   * Mark a tutorial level as completed
   * @param {string} levelId - The tutorial level ID (e.g., "tutorial_123" or "T1")
   */
  completeTutorialLevel(levelId) {
    this.completedLevels.add(levelId)
    this.saveProgress()
    console.log(`[WorldManager] Completed tutorial level: ${levelId}`)
  }

  /**
   * Get the number of completed tutorial levels
   * @returns {number}
   */
  getCompletedTutorialCount() {
    let count = 0
    for (const levelId of this.completedLevels) {
      if (levelId === "Tutorial" || levelId.startsWith("tutorial_") || levelId.match(/^T\d+$/)) {
        count++
      }
    }
    return count
  }
}

// Singleton instance
export const WorldManager = new WorldManagerClass()
