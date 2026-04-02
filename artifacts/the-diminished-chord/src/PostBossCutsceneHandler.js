import Phaser from "phaser"
import { CutsceneFlowManager } from "./CutsceneFlowManager.js"
import { CutsceneManager } from "./CutsceneManager.js"
import { BGMManager } from "./BGMManager.js"

/**
 * PostBossCutsceneHandler - Manages the sequence of cutscenes after boss defeat
 * 
 * Handles playing multiple cutscenes in sequence:
 * 1. Post-boss cutscene for the world
 * 2. End of act cutscene (if applicable)
 * 3. Epilogue (if World 15)
 * 
 * After all cutscenes are played, navigates to appropriate destination
 */
export class PostBossCutsceneHandler extends Phaser.Scene {
  constructor() {
    super({ key: "PostBossCutsceneHandler" })
  }

  init(data) {
    this.worldNum = data.worldNum || 1
  }

  create() {
    // Get the cutscene sequence and current index from registry
    const sequence = this.registry.get("pendingCutsceneSequence") || []
    let currentIndex = this.registry.get("cutsceneSequenceIndex") || 0

    // Mark the previous cutscene as watched (if coming back from one)
    if (currentIndex > 0 && currentIndex <= sequence.length) {
      const prevCutscene = sequence[currentIndex - 1]
      if (prevCutscene && prevCutscene.cutsceneKey) {
        CutsceneManager.markWatched(prevCutscene.cutsceneKey)
      }
    }

    // Check if there are more cutscenes to play
    if (currentIndex < sequence.length) {
      const nextCutscene = sequence[currentIndex]
      
      // Update the index for next time
      this.registry.set("cutsceneSequenceIndex", currentIndex + 1)
      
      // Start the next cutscene
      this.scene.start(nextCutscene.sceneKey, {
        returnScene: "PostBossCutsceneHandler",
        returnData: { worldNum: this.worldNum }
      })
    } else {
      // All cutscenes played - go to appropriate destination
      this.finishCutsceneSequence()
    }
  }

  finishCutsceneSequence() {
    // Clean up registry
    const bossVictoryData = this.registry.get("bossVictoryData") || {}
    this.registry.remove("pendingCutsceneSequence")
    this.registry.remove("cutsceneSequenceIndex")
    this.registry.remove("bossVictoryData")

    // Determine where to go next
    if (this.worldNum === 15) {
      // Game complete - go to game complete scene
      this.scene.start("GameCompleteUIScene", {
        currentLevelKey: "DynamicLevelScene",
        levelId: bossVictoryData.levelId,
        isBoss: true,
        worldNum: this.worldNum,
        deathCount: bossVictoryData.deathCount || 0,
        completionTime: bossVictoryData.completionTime || 0,
        allFragments: bossVictoryData.allFragments || false,
        collectedCount: bossVictoryData.collectedCount || 0,
        totalCollectibles: bossVictoryData.totalCollectibles || 0
      })
    } else {
      // Go back to universe select to choose next world
      this.scene.start("UniverseSelectScene")
    }
  }
}
