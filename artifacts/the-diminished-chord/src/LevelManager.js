// Level Manager - Manages level order and progression
// 11 levels with increasing difficulty

export const LEVEL_ORDER = [
  "Level1Scene",   // Tutorial Basics
  "Level2Scene",   // Longer Gaps
  "Level3Scene",   // Vertical Challenge
  "Level4Scene",   // Tight Corridors
  "Level5Scene",   // The Gauntlet
  "Level6Scene",   // The Tower
  "Level7Scene",   // Saw Blade Alley
  "Level8Scene",   // The Labyrinth
  "Level9Scene",   // Precision Nightmare
  "Level10Scene",  // Pit of Despair
  "Level11Scene"   // The Finale
]

// Level metadata for UI displays
export const LEVEL_METADATA = {
  "Level1Scene": {
    name: "Tutorial Basics",
    difficulty: "Easy",
    description: "Learn the basics of running, jumping, and wall jumping",
    trackId: "track_001"
  },
  "Level2Scene": {
    name: "Longer Gaps",
    difficulty: "Easy",
    description: "Longer gaps and multiple wall jumps",
    trackId: "track_002"
  },
  "Level3Scene": {
    name: "Vertical Challenge",
    difficulty: "Medium",
    description: "Ascend through challenging vertical platforms",
    trackId: "track_003"
  },
  "Level4Scene": {
    name: "Tight Corridors",
    difficulty: "Medium",
    description: "Navigate narrow corridors and tight spaces",
    trackId: "track_004"
  },
  "Level5Scene": {
    name: "The Gauntlet",
    difficulty: "Medium-Hard",
    description: "Long horizontal challenge with spike pits",
    trackId: "track_005"
  },
  "Level6Scene": {
    name: "The Tower",
    difficulty: "Hard",
    description: "Vertical ascent requiring wall jump mastery",
    trackId: "track_006"
  },
  "Level7Scene": {
    name: "Saw Blade Alley",
    difficulty: "Hard",
    description: "Timing-based hazard dodging",
    trackId: "track_007"
  },
  "Level8Scene": {
    name: "The Labyrinth",
    difficulty: "Hard",
    description: "Complex multi-path level requiring exploration",
    trackId: "track_008"
  },
  "Level9Scene": {
    name: "Precision Nightmare",
    difficulty: "Very Hard",
    description: "Pixel-perfect jumps with minimal platforms",
    trackId: "track_009"
  },
  "Level10Scene": {
    name: "Pit of Despair",
    difficulty: "Very Hard",
    description: "Deep vertical descent and ascent with spike pit",
    trackId: "track_010"
  },
  "Level11Scene": {
    name: "The Finale",
    difficulty: "Expert",
    description: "Ultimate challenge combining all mechanics",
    trackId: "track_011"
  }
}

export const LevelManager = {
  getCurrentLevelIndex(levelKey) {
    return LEVEL_ORDER.indexOf(levelKey)
  },

  getNextLevel(currentLevelKey) {
    const currentIndex = this.getCurrentLevelIndex(currentLevelKey)
    if (currentIndex < LEVEL_ORDER.length - 1) {
      return LEVEL_ORDER[currentIndex + 1]
    }
    return null
  },

  getPreviousLevel(currentLevelKey) {
    const currentIndex = this.getCurrentLevelIndex(currentLevelKey)
    if (currentIndex > 0) {
      return LEVEL_ORDER[currentIndex - 1]
    }
    return null
  },

  isLastLevel(levelKey) {
    return LEVEL_ORDER.indexOf(levelKey) === LEVEL_ORDER.length - 1
  },

  isFirstLevel(levelKey) {
    return LEVEL_ORDER.indexOf(levelKey) === 0
  },

  getFirstLevel() {
    return LEVEL_ORDER[0]
  },

  getTotalLevels() {
    return LEVEL_ORDER.length
  },

  getLevelMetadata(levelKey) {
    return LEVEL_METADATA[levelKey] || {
      name: "Unknown Level",
      difficulty: "Unknown",
      description: "No description available"
    }
  },

  getLevelNumber(levelKey) {
    return this.getCurrentLevelIndex(levelKey) + 1
  },

  getAllLevelMetadata() {
    return LEVEL_ORDER.map((levelKey, index) => ({
      key: levelKey,
      number: index + 1,
      ...this.getLevelMetadata(levelKey)
    }))
  }
}
