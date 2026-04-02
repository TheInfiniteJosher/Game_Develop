/**
 * CollectibleTypes - Comprehensive collectible system for The Diminished Chord
 * 
 * STANDARD LEVELS:
 * - 5 Required Instruments: drums, guitar, bass, keyboard, microphone (exactly 1 each)
 * - Variable Notes: 0-45 music notes per level
 * - Max Total: 50 collectibles per level (5 instruments + up to 45 notes)
 * 
 * BONUS LEVELS (1 special item per bonus level type):
 * - B1: Mixtape (cassette tape)
 * - B2: CD (compact disc)
 * - B3: Vinyl (record)
 * - B4: Waveform (digital audio waveform icon)
 * - B5: RecordDeal (contract paper with signatures)
 * 
 * WORLD COLLECTIBLES:
 * - DemoTapeFragment: 1 hidden per world, 5 total per Act (Worlds 1-5, 6-10, 11-15)
 * - Collecting all 5 fragments unlocks "The Studio" at end of each Act
 */

// Required instruments - exactly 1 of each per standard level
export const REQUIRED_INSTRUMENTS = {
  drums: {
    key: "drums",
    name: "Drums",
    description: "The heartbeat of every track",
    color: 0xffa500,  // Orange
    textureKey: "music_fragment_drums",
    required: true,
    maxPerLevel: 1
  },
  guitar: {
    key: "guitar",
    name: "Guitar",
    description: "The soul of rock and roll",
    color: 0x9932cc,  // Purple
    textureKey: "music_fragment_guitar",
    required: true,
    maxPerLevel: 1
  },
  bass: {
    key: "bass",
    name: "Bass",
    description: "The groove foundation",
    color: 0x00ffff,  // Cyan
    textureKey: "music_fragment_bass",
    required: true,
    maxPerLevel: 1
  },
  keyboard: {
    key: "keyboard",
    name: "Keyboard",
    description: "Keys to unlock new sounds",
    color: 0x00ff88,  // Green
    textureKey: "music_fragment_keyboard",
    required: true,
    maxPerLevel: 1
  },
  microphone: {
    key: "microphone",
    name: "Microphone",
    description: "Where the voice finds power",
    color: 0xff69b4,  // Pink
    textureKey: "music_fragment_microphone",
    required: true,
    maxPerLevel: 1
  }
}

// Music notes - variable quantity per level (0-45)
export const NOTE_COLLECTIBLE = {
  key: "note",
  name: "Music Note",
  description: "A piece of the melody",
  color: 0xffff00,  // Yellow
  textureKey: "music_fragment_note",
  required: false,
  maxPerLevel: 45
}

// Bonus level special collectibles (1 per bonus level type)
export const BONUS_COLLECTIBLES = {
  mixtape: {
    key: "mixtape",
    name: "Mixtape",
    description: "A cassette tape from the underground days",
    color: 0x8B4513,  // Brown
    textureKey: "collectible_mixtape",
    bonusLevel: 1,  // B1
    reward: "remix_fragment"
  },
  cd: {
    key: "cd",
    name: "CD",
    description: "A shiny compact disc from the studio era",
    color: 0xC0C0C0,  // Silver
    textureKey: "collectible_cd",
    bonusLevel: 2,  // B2
    reward: "live_version"
  },
  vinyl: {
    key: "vinyl",
    name: "Vinyl Record",
    description: "A classic vinyl pressing - pure analog warmth",
    color: 0x1a1a1a,  // Black
    textureKey: "collectible_vinyl",
    bonusLevel: 3,  // B3
    reward: "instrumental_variant"
  },
  waveform: {
    key: "waveform",
    name: "Waveform",
    description: "Digital audio visualization - the modern format",
    color: 0x00ff00,  // Bright green
    textureKey: "collectible_waveform",
    bonusLevel: 4,  // B4
    reward: "hardcore_stem"
  },
  recordDeal: {
    key: "recordDeal",
    name: "Record Deal",
    description: "A signed contract - fame or trap?",
    color: 0xffd700,  // Gold
    textureKey: "collectible_record_deal",
    bonusLevel: 5,  // B5
    reward: "acoustic_demo"
  }
}

// Demo tape fragment - 1 hidden per world, 5 per Act
export const DEMO_FRAGMENT = {
  key: "demoFragment",
  name: "Demo Tape Fragment",
  description: "A broken piece of unreleased music - find all 5 to unlock The Studio",
  color: 0xff00ff,  // Magenta
  textureKey: "collectible_demo_fragment",
  perWorld: 1,
  perAct: 5
}

// Metronome - triggers level timer to start when collected
// One per level, optional - if present, timer starts on collection; if absent, timer starts at level load
// Internal key remains "stopwatch" for backwards compatibility with saved levels
export const SPEED_RUN_STOPWATCH = {
  key: "stopwatch",
  name: "Metronome",
  description: "Collect to start the speed run timer! Place near level start for fair timing.",
  color: 0x00ffff,  // Cyan
  textureKey: "collectible_metronome",
  maxPerLevel: 1,
  isTimerTrigger: true
}

// Level validation rules
export const LEVEL_RULES = {
  standard: {
    requiredInstruments: Object.keys(REQUIRED_INSTRUMENTS),
    minNotes: 0,
    maxNotes: 45,
    maxTotal: 50
  },
  bonus: {
    requiredInstruments: Object.keys(REQUIRED_INSTRUMENTS),
    minNotes: 0,
    maxNotes: 45,
    maxTotal: 50,
    specialCollectible: true  // Plus 1 bonus-specific collectible
  },
  boss: {
    requiredInstruments: [],  // Boss levels may have different rules
    minNotes: 0,
    maxNotes: 10,
    maxTotal: 10
  }
}

/**
 * Get all collectible types for the level designer palette
 */
export function getAllCollectibleTypes() {
  const types = []
  
  // Required instruments
  Object.values(REQUIRED_INSTRUMENTS).forEach(inst => {
    types.push({
      key: `fragment_${inst.key}`,
      label: inst.name,
      color: inst.color,
      category: "instrument",
      required: true,
      maxPerLevel: 1
    })
  })
  
  // Music notes
  types.push({
    key: "fragment_note",
    label: NOTE_COLLECTIBLE.name,
    color: NOTE_COLLECTIBLE.color,
    category: "note",
    required: false,
    maxPerLevel: 45
  })
  
  // Bonus collectibles
  Object.values(BONUS_COLLECTIBLES).forEach(bonus => {
    types.push({
      key: `bonus_${bonus.key}`,
      label: bonus.name,
      color: bonus.color,
      category: "bonus",
      required: false,
      bonusLevel: bonus.bonusLevel
    })
  })
  
  // Demo fragment
  types.push({
    key: "demo_fragment",
    label: DEMO_FRAGMENT.name,
    color: DEMO_FRAGMENT.color,
    category: "special",
    required: false,
    maxPerWorld: 1
  })
  
  // Metronome (starts speed run timer)
  types.push({
    key: "stopwatch",  // Internal key unchanged for backwards compatibility
    label: SPEED_RUN_STOPWATCH.name,
    color: SPEED_RUN_STOPWATCH.color,
    category: "timer",
    required: false,
    maxPerLevel: 1,
    isTimerTrigger: true
  })
  
  return types
}

/**
 * Validate level collectibles before saving
 * @param {Array} placedObjects - Array of placed objects in the level
 * @param {string} levelType - 'normal', 'bonus', or 'boss'
 * @param {number} bonusLevelNum - If bonus level, which number (1-5)
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateLevelCollectibles(placedObjects, levelType = 'normal', bonusLevelNum = null) {
  const errors = []
  const warnings = []
  
  // Count collectibles by type
  const counts = {}
  placedObjects.forEach(obj => {
    if (obj.type.startsWith('fragment_') || obj.type.startsWith('bonus_') || obj.type === 'demo_fragment') {
      counts[obj.type] = (counts[obj.type] || 0) + 1
    }
  })
  
  // Check required instruments for standard and bonus levels
  if (levelType === 'normal' || levelType === 'bonus') {
    Object.keys(REQUIRED_INSTRUMENTS).forEach(instKey => {
      const fragmentKey = `fragment_${instKey}`
      const count = counts[fragmentKey] || 0
      
      if (count === 0) {
        errors.push(`Missing required instrument: ${REQUIRED_INSTRUMENTS[instKey].name}`)
      } else if (count > 1) {
        errors.push(`Too many ${REQUIRED_INSTRUMENTS[instKey].name}: ${count} placed (max 1)`)
      }
    })
    
    // Check notes
    const noteCount = counts['fragment_note'] || 0
    if (noteCount > 45) {
      errors.push(`Too many Music Notes: ${noteCount} placed (max 45)`)
    }
    
    // Check total
    const totalCollectibles = Object.values(counts).reduce((a, b) => a + b, 0)
    if (totalCollectibles > 50) {
      errors.push(`Too many collectibles: ${totalCollectibles} (max 50)`)
    }
    
    // Check demo fragment (optional, max 1)
    const demoCount = counts['demo_fragment'] || 0
    if (demoCount > 1) {
      errors.push(`Too many Demo Fragments: ${demoCount} placed (max 1 per world)`)
    }
  }
  
  // Check bonus level special collectible
  if (levelType === 'bonus' && bonusLevelNum) {
    const bonusType = Object.values(BONUS_COLLECTIBLES).find(b => b.bonusLevel === bonusLevelNum)
    if (bonusType) {
      const bonusKey = `bonus_${bonusType.key}`
      const bonusCount = counts[bonusKey] || 0
      
      if (bonusCount === 0) {
        warnings.push(`Bonus level B${bonusLevelNum} should include a ${bonusType.name}`)
      } else if (bonusCount > 1) {
        errors.push(`Too many ${bonusType.name}: ${bonusCount} placed (max 1)`)
      }
    }
  }
  
  // Boss level validation
  if (levelType === 'boss') {
    const noteCount = counts['fragment_note'] || 0
    if (noteCount > 10) {
      errors.push(`Boss levels have max 10 notes: ${noteCount} placed`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Count collectibles in a level for UI display
 * @param {Array} placedObjects - Array of placed objects
 * @returns {Object} { instruments: {}, notes: number, bonus: string|null, demoFragment: boolean, total: number }
 */
export function countLevelCollectibles(placedObjects) {
  const result = {
    instruments: {},
    notes: 0,
    bonus: null,
    demoFragment: false,
    stopwatch: false,
    total: 0
  }
  
  placedObjects.forEach(obj => {
    if (obj.type.startsWith('fragment_')) {
      const subType = obj.type.replace('fragment_', '')
      if (subType === 'note') {
        result.notes++
      } else if (REQUIRED_INSTRUMENTS[subType]) {
        result.instruments[subType] = (result.instruments[subType] || 0) + 1
      }
      result.total++
    } else if (obj.type.startsWith('bonus_')) {
      result.bonus = obj.type.replace('bonus_', '')
      result.total++
    } else if (obj.type === 'demo_fragment') {
      result.demoFragment = true
      result.total++
    } else if (obj.type === 'stopwatch') {
      result.stopwatch = true
      // Stopwatch doesn't count toward collectible total - it's a utility item
    }
  })
  
  return result
}

/**
 * Get collectible summary string for level display
 * @param {Array} placedObjects - Array of placed objects
 * @returns {string} Summary like "5 Instruments + 12 Notes = 17 Total"
 */
export function getCollectibleSummary(placedObjects) {
  const counts = countLevelCollectibles(placedObjects)
  const instrumentCount = Object.values(counts.instruments).reduce((a, b) => a + b, 0)
  
  let summary = `${instrumentCount}/5 Instruments`
  if (counts.notes > 0) {
    summary += ` + ${counts.notes} Notes`
  }
  if (counts.bonus) {
    const bonusInfo = BONUS_COLLECTIBLES[counts.bonus]
    summary += ` + ${bonusInfo ? bonusInfo.name : counts.bonus}`
  }
  if (counts.demoFragment) {
    summary += ` + Demo Fragment`
  }
  summary += ` = ${counts.total} Total`
  
  return summary
}

/**
 * Check if a specific collectible type can be added to the level
 * @param {string} collectibleType - The type to add (e.g., 'fragment_drums')
 * @param {Array} placedObjects - Current placed objects
 * @returns {Object} { canAdd: boolean, reason: string|null }
 */
export function canAddCollectible(collectibleType, placedObjects) {
  const counts = countLevelCollectibles(placedObjects)
  
  // Check instruments
  if (collectibleType.startsWith('fragment_') && collectibleType !== 'fragment_note') {
    const instKey = collectibleType.replace('fragment_', '')
    if (REQUIRED_INSTRUMENTS[instKey]) {
      const currentCount = counts.instruments[instKey] || 0
      if (currentCount >= 1) {
        return {
          canAdd: false,
          reason: `${REQUIRED_INSTRUMENTS[instKey].name} is already placed in this level (max 1)`
        }
      }
    }
  }
  
  // Check notes
  if (collectibleType === 'fragment_note') {
    if (counts.notes >= 45) {
      return {
        canAdd: false,
        reason: `Maximum 45 Music Notes allowed per level`
      }
    }
  }
  
  // Check demo fragment
  if (collectibleType === 'demo_fragment') {
    if (counts.demoFragment) {
      return {
        canAdd: false,
        reason: `Demo Fragment already placed (max 1 per world)`
      }
    }
  }
  
  // Check bonus collectibles
  if (collectibleType.startsWith('bonus_')) {
    if (counts.bonus) {
      const existingBonus = BONUS_COLLECTIBLES[counts.bonus]
      return {
        canAdd: false,
        reason: `${existingBonus ? existingBonus.name : 'Bonus item'} is already placed (only 1 bonus collectible per level)`
      }
    }
  }
  
  // Check metronome (max 1 per level)
  if (collectibleType === 'stopwatch') {
    if (counts.stopwatch) {
      return {
        canAdd: false,
        reason: `Metronome is already placed (max 1 per level)`
      }
    }
  }
  
  // Check total
  if (counts.total >= 50) {
    return {
      canAdd: false,
      reason: `Maximum 50 collectibles per level reached`
    }
  }
  
  return { canAdd: true, reason: null }
}

// Export default for easy import
export default {
  REQUIRED_INSTRUMENTS,
  NOTE_COLLECTIBLE,
  BONUS_COLLECTIBLES,
  DEMO_FRAGMENT,
  SPEED_RUN_STOPWATCH,
  LEVEL_RULES,
  getAllCollectibleTypes,
  validateLevelCollectibles,
  countLevelCollectibles,
  getCollectibleSummary,
  canAddCollectible
}
