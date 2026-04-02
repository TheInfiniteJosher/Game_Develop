/**
 * DemoTapeManager - Manages Demo Tape Fragment collection and Studio assembly
 * 
 * Structure:
 * - 1 Demo Fragment hidden per world
 * - 5 fragments per Act (Worlds 1-5, 6-10, 11-15)
 * - Collecting all 5 unlocks "The Studio" at end of each Act
 * - In The Studio, players arrange fragments in correct order
 * - Correct assembly unlocks the track for download/library
 */

// Act definitions
export const ACTS = {
  1: { worlds: [1, 2, 3, 4, 5], name: "Act I: The Underground", unlockWorld: 5 },
  2: { worlds: [6, 7, 8, 9, 10], name: "Act II: The Industry", unlockWorld: 10 },
  3: { worlds: [11, 12, 13, 14, 15], name: "Act III: Internal Battle", unlockWorld: 15 }
}

// Demo tape configuration per Act
export const DEMO_TAPES = {
  act1: {
    title: "Underground Anthem",
    artist: "The Diminished Chord",
    fragments: [
      { id: "act1_frag1", world: 1, name: "Intro Riff", order: 1, audioUrl: null, duration: 8 },
      { id: "act1_frag2", world: 2, name: "Verse A", order: 2, audioUrl: null, duration: 12 },
      { id: "act1_frag3", world: 3, name: "Pre-Chorus", order: 3, audioUrl: null, duration: 6 },
      { id: "act1_frag4", world: 4, name: "Chorus Hook", order: 4, audioUrl: null, duration: 16 },
      { id: "act1_frag5", world: 5, name: "Bridge/Outro", order: 5, audioUrl: null, duration: 10 }
    ],
    completeTrackUrl: null,
    coverArtUrl: null,
    unlockReward: "Full track download + Album art"
  },
  act2: {
    title: "Industry Standard",
    artist: "The Diminished Chord",
    fragments: [
      { id: "act2_frag1", world: 6, name: "Cold Open", order: 1, audioUrl: null, duration: 6 },
      { id: "act2_frag2", world: 7, name: "Building Tension", order: 2, audioUrl: null, duration: 14 },
      { id: "act2_frag3", world: 8, name: "The Drop", order: 3, audioUrl: null, duration: 10 },
      { id: "act2_frag4", world: 9, name: "Breakdown", order: 4, audioUrl: null, duration: 12 },
      { id: "act2_frag5", world: 10, name: "Resolution", order: 5, audioUrl: null, duration: 8 }
    ],
    completeTrackUrl: null,
    coverArtUrl: null,
    unlockReward: "Full track download + Behind-the-scenes content"
  },
  act3: {
    title: "The Final Movement",
    artist: "The Diminished Chord",
    fragments: [
      { id: "act3_frag1", world: 11, name: "Inner Voice", order: 1, audioUrl: null, duration: 10 },
      { id: "act3_frag2", world: 12, name: "Time Signature", order: 2, audioUrl: null, duration: 14 },
      { id: "act3_frag3", world: 13, name: "Chaos Theory", order: 3, audioUrl: null, duration: 12 },
      { id: "act3_frag4", world: 14, name: "Clarity", order: 4, audioUrl: null, duration: 8 },
      { id: "act3_frag5", world: 15, name: "The Diminished Chord", order: 5, audioUrl: null, duration: 20 }
    ],
    completeTrackUrl: null,
    coverArtUrl: null,
    unlockReward: "Full track download + Exclusive ending content"
  }
}

/**
 * DemoTapeManager class - Singleton for tracking fragment collection
 */
class DemoTapeManagerClass {
  constructor() {
    this.collectedFragments = new Set()
    this.assembledTracks = new Set()
    this.loadProgress()
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem("diminished_chord_demo_progress")
      if (saved) {
        const data = JSON.parse(saved)
        this.collectedFragments = new Set(data.collectedFragments || [])
        this.assembledTracks = new Set(data.assembledTracks || [])
      }
    } catch (e) {
      console.error("[DemoTapeManager] Failed to load progress:", e)
    }
  }

  saveProgress() {
    try {
      const data = {
        collectedFragments: Array.from(this.collectedFragments),
        assembledTracks: Array.from(this.assembledTracks)
      }
      localStorage.setItem("diminished_chord_demo_progress", JSON.stringify(data))
    } catch (e) {
      console.error("[DemoTapeManager] Failed to save progress:", e)
    }
  }

  /**
   * Collect a demo fragment from a world
   */
  collectFragment(worldNum) {
    const act = this.getActForWorld(worldNum)
    if (!act) return null

    const actKey = `act${act}`
    const demoTape = DEMO_TAPES[actKey]
    const fragment = demoTape.fragments.find(f => f.world === worldNum)
    
    if (fragment && !this.collectedFragments.has(fragment.id)) {
      this.collectedFragments.add(fragment.id)
      this.saveProgress()
      
      return {
        fragment,
        actKey,
        isActComplete: this.isActComplete(act)
      }
    }
    
    return null
  }

  /**
   * Check if a fragment has been collected
   */
  hasFragment(worldNum) {
    const act = this.getActForWorld(worldNum)
    if (!act) return false

    const actKey = `act${act}`
    const demoTape = DEMO_TAPES[actKey]
    const fragment = demoTape.fragments.find(f => f.world === worldNum)
    
    return fragment ? this.collectedFragments.has(fragment.id) : false
  }

  /**
   * Get the Act number for a world
   */
  getActForWorld(worldNum) {
    for (const [actNum, actData] of Object.entries(ACTS)) {
      if (actData.worlds.includes(worldNum)) {
        return parseInt(actNum)
      }
    }
    return null
  }

  /**
   * Get collected fragments for an Act
   */
  getActFragments(actNum) {
    const actKey = `act${actNum}`
    const demoTape = DEMO_TAPES[actKey]
    if (!demoTape) return []

    return demoTape.fragments.map(frag => ({
      ...frag,
      collected: this.collectedFragments.has(frag.id)
    }))
  }

  /**
   * Check if all fragments for an Act are collected
   */
  isActComplete(actNum) {
    const actKey = `act${actNum}`
    const demoTape = DEMO_TAPES[actKey]
    if (!demoTape) return false

    return demoTape.fragments.every(frag => this.collectedFragments.has(frag.id))
  }

  /**
   * Check if The Studio is unlocked for an Act
   */
  isStudioUnlocked(actNum) {
    return this.isActComplete(actNum)
  }

  /**
   * Check if a track has been correctly assembled
   */
  isTrackAssembled(actNum) {
    return this.assembledTracks.has(`act${actNum}`)
  }

  /**
   * Attempt to assemble a track with the given order
   * @param {number} actNum - Act number
   * @param {Array} orderedFragmentIds - Array of fragment IDs in player's order
   * @returns {Object} { success: boolean, message: string }
   */
  attemptAssembly(actNum, orderedFragmentIds) {
    const actKey = `act${actNum}`
    const demoTape = DEMO_TAPES[actKey]
    if (!demoTape) {
      return { success: false, message: "Invalid act" }
    }

    // Get correct order
    const correctOrder = demoTape.fragments
      .sort((a, b) => a.order - b.order)
      .map(f => f.id)

    // Check if player's order matches
    const isCorrect = orderedFragmentIds.length === correctOrder.length &&
      orderedFragmentIds.every((id, i) => id === correctOrder[i])

    if (isCorrect) {
      this.assembledTracks.add(actKey)
      this.saveProgress()
      return { 
        success: true, 
        message: `You've assembled "${demoTape.title}"! Track unlocked for your library.`,
        trackTitle: demoTape.title,
        reward: demoTape.unlockReward
      }
    } else {
      return { 
        success: false, 
        message: "That doesn't sound quite right... Try a different order."
      }
    }
  }

  /**
   * Get progress summary
   */
  getProgressSummary() {
    const summary = {
      act1: {
        collected: this.getActFragments(1).filter(f => f.collected).length,
        total: 5,
        studioUnlocked: this.isStudioUnlocked(1),
        trackAssembled: this.isTrackAssembled(1)
      },
      act2: {
        collected: this.getActFragments(2).filter(f => f.collected).length,
        total: 5,
        studioUnlocked: this.isStudioUnlocked(2),
        trackAssembled: this.isTrackAssembled(2)
      },
      act3: {
        collected: this.getActFragments(3).filter(f => f.collected).length,
        total: 5,
        studioUnlocked: this.isStudioUnlocked(3),
        trackAssembled: this.isTrackAssembled(3)
      }
    }
    
    summary.totalFragments = summary.act1.collected + summary.act2.collected + summary.act3.collected
    summary.totalPossible = 15
    
    return summary
  }

  /**
   * Reset all progress (dev function)
   */
  resetProgress() {
    this.collectedFragments = new Set()
    this.assembledTracks = new Set()
    this.saveProgress()
  }
}

// Singleton export
export const DemoTapeManager = new DemoTapeManagerClass()
export default DemoTapeManager
