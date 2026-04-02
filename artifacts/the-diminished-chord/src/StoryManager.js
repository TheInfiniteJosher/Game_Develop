/**
 * StoryManager - Manages cutscenes, story progression, and cinematic content
 * 
 * Types of story content:
 * - Post-World Cutscenes: Short animated scenes after completing each world boss
 * - Post-Act Cinematics: Longer, more impactful scenes at the end of each 5-world Act
 * - Unlockable Lore: Text/image content discovered through gameplay
 * 
 * Content is designed to be easily uploaded/managed by the developer
 * through a drag-and-drop interface (ContentUploaderScene)
 */

// Story beat types
export const STORY_TYPES = {
  POST_WORLD: "post_world",      // After beating a world boss
  POST_ACT: "post_act",          // After completing an act (5 worlds)
  INTRO: "intro",                // Game intro
  ENDING: "ending",              // Game ending
  LORE: "lore"                   // Unlockable lore pieces
}

// Post-world cutscene templates (to be populated via ContentUploader)
export const WORLD_CUTSCENES = {
  // World 1: First Music Video
  1: {
    id: "world_1_cutscene",
    title: "First Video",
    description: "After World 1: The artist makes their first punk rock music video. Behind the scenes mixed with iconic rock star moments. Think Avril Lavigne's 'Sk8er Boi'.",
    type: STORY_TYPES.POST_WORLD,
    worldNum: 1,
    duration: 45, // seconds
    frames: [], // Array of { imageUrl, duration, text, animation }
    audioUrl: null,
    isUnlocked: false,
    hasContent: false // Set to true when content is uploaded
  },
  2: {
    id: "world_2_cutscene",
    title: "TBD - World 2 Story",
    description: "After World 2: Story beat to be defined",
    type: STORY_TYPES.POST_WORLD,
    worldNum: 2,
    duration: 30,
    frames: [],
    audioUrl: null,
    isUnlocked: false,
    hasContent: false
  },
  3: {
    id: "world_3_cutscene",
    title: "TBD - World 3 Story",
    description: "After World 3: Story beat to be defined",
    type: STORY_TYPES.POST_WORLD,
    worldNum: 3,
    duration: 30,
    frames: [],
    audioUrl: null,
    isUnlocked: false,
    hasContent: false
  },
  4: {
    id: "world_4_cutscene",
    title: "TBD - World 4 Story",
    description: "After World 4: Story beat to be defined",
    type: STORY_TYPES.POST_WORLD,
    worldNum: 4,
    duration: 30,
    frames: [],
    audioUrl: null,
    isUnlocked: false,
    hasContent: false
  },
  5: {
    id: "world_5_cutscene",
    title: "TBD - World 5 Story",
    description: "After World 5: Story beat to be defined",
    type: STORY_TYPES.POST_WORLD,
    worldNum: 5,
    duration: 30,
    frames: [],
    audioUrl: null,
    isUnlocked: false,
    hasContent: false
  },
  // Add more worlds as needed (6-15)
  6: { id: "world_6_cutscene", title: "TBD", description: "After World 6", type: STORY_TYPES.POST_WORLD, worldNum: 6, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  7: { id: "world_7_cutscene", title: "TBD", description: "After World 7", type: STORY_TYPES.POST_WORLD, worldNum: 7, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  8: { id: "world_8_cutscene", title: "TBD", description: "After World 8", type: STORY_TYPES.POST_WORLD, worldNum: 8, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  9: { id: "world_9_cutscene", title: "TBD", description: "After World 9", type: STORY_TYPES.POST_WORLD, worldNum: 9, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  10: { id: "world_10_cutscene", title: "TBD", description: "After World 10", type: STORY_TYPES.POST_WORLD, worldNum: 10, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  11: { id: "world_11_cutscene", title: "TBD", description: "After World 11", type: STORY_TYPES.POST_WORLD, worldNum: 11, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  12: { id: "world_12_cutscene", title: "TBD", description: "After World 12", type: STORY_TYPES.POST_WORLD, worldNum: 12, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  13: { id: "world_13_cutscene", title: "TBD", description: "After World 13", type: STORY_TYPES.POST_WORLD, worldNum: 13, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  14: { id: "world_14_cutscene", title: "TBD", description: "After World 14", type: STORY_TYPES.POST_WORLD, worldNum: 14, duration: 30, frames: [], audioUrl: null, isUnlocked: false, hasContent: false },
  15: { id: "world_15_cutscene", title: "TBD", description: "After World 15 - Final", type: STORY_TYPES.POST_WORLD, worldNum: 15, duration: 60, frames: [], audioUrl: null, isUnlocked: false, hasContent: false }
}

// Post-Act cinematics (longer, more impactful)
export const ACT_CINEMATICS = {
  1: {
    id: "act_1_cinematic",
    title: "Rise from the Underground",
    description: "End of Act I: The artist breaks through from underground to recognition. Major story milestone.",
    type: STORY_TYPES.POST_ACT,
    actNum: 1,
    triggerAfterWorld: 5,
    duration: 120, // 2 minutes
    frames: [],
    audioUrl: null,
    isUnlocked: false,
    hasContent: false
  },
  2: {
    id: "act_2_cinematic", 
    title: "Industry Reckoning",
    description: "End of Act II: Confronting the music industry machine. Pivotal story moment.",
    type: STORY_TYPES.POST_ACT,
    actNum: 2,
    triggerAfterWorld: 10,
    duration: 150, // 2.5 minutes
    frames: [],
    audioUrl: null,
    isUnlocked: false,
    hasContent: false
  },
  3: {
    id: "act_3_cinematic",
    title: "The Final Chord",
    description: "End of Act III / Game Ending: Ultimate resolution of the story.",
    type: STORY_TYPES.POST_ACT,
    actNum: 3,
    triggerAfterWorld: 15,
    duration: 180, // 3 minutes
    frames: [],
    audioUrl: null,
    isUnlocked: false,
    hasContent: false
  }
}

// Game intro cinematic
export const INTRO_CINEMATIC = {
  id: "game_intro",
  title: "The Beginning",
  description: "Game introduction - sets up the story and character",
  type: STORY_TYPES.INTRO,
  duration: 60,
  frames: [],
  audioUrl: null,
  hasContent: false
}

/**
 * StoryManager class - Singleton for managing story progression
 */
class StoryManagerClass {
  constructor() {
    this.unlockedCutscenes = new Set()
    this.watchedCutscenes = new Set()
    this.customContent = {} // Developer-uploaded content overrides
    this.loadProgress()
    this.loadCustomContent()
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem("diminished_chord_story_progress")
      if (saved) {
        const data = JSON.parse(saved)
        this.unlockedCutscenes = new Set(data.unlockedCutscenes || [])
        this.watchedCutscenes = new Set(data.watchedCutscenes || [])
      }
    } catch (e) {
      console.error("[StoryManager] Failed to load progress:", e)
    }
  }

  saveProgress() {
    try {
      const data = {
        unlockedCutscenes: Array.from(this.unlockedCutscenes),
        watchedCutscenes: Array.from(this.watchedCutscenes)
      }
      localStorage.setItem("diminished_chord_story_progress", JSON.stringify(data))
    } catch (e) {
      console.error("[StoryManager] Failed to save progress:", e)
    }
  }

  /**
   * Load custom content uploaded by developer
   */
  loadCustomContent() {
    try {
      const saved = localStorage.getItem("diminished_chord_custom_story_content")
      if (saved) {
        this.customContent = JSON.parse(saved)
      }
    } catch (e) {
      console.error("[StoryManager] Failed to load custom content:", e)
    }
  }

  /**
   * Save custom content
   */
  saveCustomContent() {
    try {
      localStorage.setItem("diminished_chord_custom_story_content", JSON.stringify(this.customContent))
    } catch (e) {
      console.error("[StoryManager] Failed to save custom content:", e)
    }
  }

  /**
   * Unlock a cutscene when player beats a world boss
   */
  unlockWorldCutscene(worldNum) {
    const cutsceneId = `world_${worldNum}_cutscene`
    this.unlockedCutscenes.add(cutsceneId)
    this.saveProgress()
    
    return this.getWorldCutscene(worldNum)
  }

  /**
   * Get world cutscene data (with custom content merged)
   */
  getWorldCutscene(worldNum) {
    const base = WORLD_CUTSCENES[worldNum]
    if (!base) return null

    const custom = this.customContent[base.id] || {}
    return {
      ...base,
      ...custom,
      isUnlocked: this.unlockedCutscenes.has(base.id),
      hasBeenWatched: this.watchedCutscenes.has(base.id)
    }
  }

  /**
   * Get act cinematic data
   */
  getActCinematic(actNum) {
    const base = ACT_CINEMATICS[actNum]
    if (!base) return null

    const custom = this.customContent[base.id] || {}
    return {
      ...base,
      ...custom,
      isUnlocked: this.unlockedCutscenes.has(base.id),
      hasBeenWatched: this.watchedCutscenes.has(base.id)
    }
  }

  /**
   * Check if player should see a cutscene after beating a world
   */
  shouldPlayCutscene(worldNum) {
    const cutscene = this.getWorldCutscene(worldNum)
    if (!cutscene) return { playWorld: false, playAct: false }

    // Check for Act cinematic trigger (worlds 5, 10, 15)
    const actNum = Math.ceil(worldNum / 5)
    const actCinematic = this.getActCinematic(actNum)
    const playAct = actCinematic && 
                    actCinematic.triggerAfterWorld === worldNum && 
                    actCinematic.hasContent

    return {
      playWorld: cutscene.hasContent && !this.watchedCutscenes.has(cutscene.id),
      playAct: playAct && !this.watchedCutscenes.has(actCinematic.id),
      worldCutscene: cutscene,
      actCinematic: actCinematic
    }
  }

  /**
   * Mark a cutscene as watched
   */
  markAsWatched(cutsceneId) {
    this.watchedCutscenes.add(cutsceneId)
    this.saveProgress()
  }

  /**
   * Update custom content for a cutscene (developer upload)
   */
  updateCustomContent(cutsceneId, contentData) {
    this.customContent[cutsceneId] = {
      ...this.customContent[cutsceneId],
      ...contentData,
      hasContent: true,
      lastModified: Date.now()
    }
    this.saveCustomContent()
  }

  /**
   * Add a frame to a cutscene
   */
  addCutsceneFrame(cutsceneId, frameData) {
    if (!this.customContent[cutsceneId]) {
      this.customContent[cutsceneId] = { frames: [] }
    }
    if (!this.customContent[cutsceneId].frames) {
      this.customContent[cutsceneId].frames = []
    }
    
    this.customContent[cutsceneId].frames.push({
      id: `frame_${Date.now()}`,
      imageUrl: frameData.imageUrl || null,
      duration: frameData.duration || 3000, // ms
      text: frameData.text || "",
      animation: frameData.animation || "fade", // fade, slide, zoom
      ...frameData
    })
    
    this.customContent[cutsceneId].hasContent = true
    this.saveCustomContent()
  }

  /**
   * Remove a frame from a cutscene
   */
  removeCutsceneFrame(cutsceneId, frameIndex) {
    if (this.customContent[cutsceneId]?.frames) {
      this.customContent[cutsceneId].frames.splice(frameIndex, 1)
      this.saveCustomContent()
    }
  }

  /**
   * Reorder frames in a cutscene
   */
  reorderCutsceneFrames(cutsceneId, fromIndex, toIndex) {
    if (this.customContent[cutsceneId]?.frames) {
      const frames = this.customContent[cutsceneId].frames
      const [removed] = frames.splice(fromIndex, 1)
      frames.splice(toIndex, 0, removed)
      this.saveCustomContent()
    }
  }

  /**
   * Get all available cutscenes for content management
   */
  getAllCutscenesForManagement() {
    const cutscenes = []
    
    // Intro
    cutscenes.push({
      ...INTRO_CINEMATIC,
      ...this.customContent[INTRO_CINEMATIC.id],
      category: "intro"
    })
    
    // World cutscenes
    Object.values(WORLD_CUTSCENES).forEach(cutscene => {
      cutscenes.push({
        ...cutscene,
        ...this.customContent[cutscene.id],
        category: "world"
      })
    })
    
    // Act cinematics
    Object.values(ACT_CINEMATICS).forEach(cinematic => {
      cutscenes.push({
        ...cinematic,
        ...this.customContent[cinematic.id],
        category: "act"
      })
    })
    
    return cutscenes
  }

  /**
   * Get summary of story content status
   */
  getContentStatus() {
    const allCutscenes = this.getAllCutscenesForManagement()
    const withContent = allCutscenes.filter(c => c.hasContent)
    const watched = allCutscenes.filter(c => this.watchedCutscenes.has(c.id))
    
    return {
      total: allCutscenes.length,
      withContent: withContent.length,
      watched: watched.length,
      needsContent: allCutscenes.length - withContent.length
    }
  }

  /**
   * Reset progress (dev function)
   */
  resetProgress() {
    this.unlockedCutscenes = new Set()
    this.watchedCutscenes = new Set()
    this.saveProgress()
  }

  /**
   * Clear custom content (dev function)
   */
  clearCustomContent() {
    this.customContent = {}
    this.saveCustomContent()
  }
}

// Singleton export
export const StoryManager = new StoryManagerClass()
export default StoryManager
