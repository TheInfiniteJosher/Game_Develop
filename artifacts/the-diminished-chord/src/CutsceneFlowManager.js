/**
 * CutsceneFlowManager - Central manager for cutscene triggering throughout the game
 * 
 * Handles:
 * - World intro cutscenes (triggered on first world entry)
 * - Post-boss cutscenes (triggered after boss defeat)
 * - End of act cutscenes (triggered after defeating act-ending bosses: W5, W10, W15)
 * - Epilogue (triggered after completing World 15)
 * - Bonus unlock cutscenes
 * 
 * Integrates with CutsceneManager for data and watched tracking
 */

import { CutsceneManager, CUTSCENE_TYPES } from "./CutsceneManager.js"
import { WORLDS } from "./WorldManager.js"

// Map scene keys to their cutscene types
export const CUTSCENE_SCENE_KEYS = {
  // World Intro Scenes
  world_1_intro: "World1IntroScene",
  world_2_intro: "World2IntroScene",
  world_3_intro: "World3IntroScene",
  world_4_intro: "World4IntroScene",
  world_5_intro: "World5IntroScene",
  world_6_intro: "World6IntroScene",
  world_7_intro: "World7IntroScene",
  world_8_intro: "World8IntroScene",
  world_9_intro: "World9IntroScene",
  world_10_intro: "World10IntroScene",
  world_11_intro: "World11IntroScene",
  world_12_intro: "World12IntroScene",
  world_13_intro: "World13IntroScene",
  world_14_intro: "World14IntroScene",
  world_15_intro: "World15IntroScene",
  
  // Post-Boss Scenes
  world_1_post_boss: "World1PostBossScene",
  world_2_post_boss: "World2PostBossScene",
  world_3_post_boss: "World3PostBossScene",
  world_4_post_boss: "World4PostBossScene",
  world_5_post_boss: "World5PostBossScene",
  world_6_post_boss: "World6PostBossScene",
  world_7_post_boss: "World7PostBossScene",
  world_8_post_boss: "World8PostBossScene",
  world_9_post_boss: "World9PostBossScene",
  world_10_post_boss: "World10PostBossScene",
  world_11_post_boss: "World11PostBossScene",
  world_12_post_boss: "World12PostBossScene",
  world_13_post_boss: "World13PostBossScene",
  world_14_post_boss: "World14PostBossScene",
  world_15_post_boss: "World15PostBossScene",
  
  // End of Act Scenes
  act_1_end: "Act1EndScene",
  act_2_end: "Act2EndScene",
  act_3_end: "Act3EndScene",
  
  // Special Scenes
  game_intro: "IntroScene",
  epilogue: "EpilogueScene",
  bonus_unlock_1: "BonusUnlock1Scene",
  bonus_unlock_2: "BonusUnlock2Scene"
}

// Reverse map for scene key to cutscene key lookup
const SCENE_TO_CUTSCENE_KEY = Object.entries(CUTSCENE_SCENE_KEYS).reduce((acc, [key, value]) => {
  acc[value] = key
  return acc
}, {})

/**
 * CutsceneFlowManager - Singleton class for managing cutscene flow
 */
class CutsceneFlowManagerClass {
  constructor() {
    this.devMode = false // Set to true to bypass watched checks
  }

  /**
   * Enable developer mode to view all cutscenes regardless of progress
   */
  setDevMode(enabled) {
    this.devMode = enabled
  }

  /**
   * Check if developer mode is enabled
   */
  isDevMode() {
    return this.devMode
  }

  // ============ Scene Key Helpers ============

  /**
   * Get the Phaser scene key for a cutscene
   */
  getSceneKey(cutsceneKey) {
    return CUTSCENE_SCENE_KEYS[cutsceneKey] || null
  }

  /**
   * Get the cutscene key for a Phaser scene
   */
  getCutsceneKey(sceneKey) {
    return SCENE_TO_CUTSCENE_KEY[sceneKey] || null
  }

  /**
   * Get world intro scene key
   */
  getWorldIntroSceneKey(worldNum) {
    return CUTSCENE_SCENE_KEYS[`world_${worldNum}_intro`] || null
  }

  /**
   * Get post-boss scene key
   */
  getPostBossSceneKey(worldNum) {
    return CUTSCENE_SCENE_KEYS[`world_${worldNum}_post_boss`] || null
  }

  /**
   * Get end of act scene key
   */
  getActEndSceneKey(actNum) {
    return CUTSCENE_SCENE_KEYS[`act_${actNum}_end`] || null
  }

  // ============ Cutscene Playability Checks ============

  /**
   * Check if a world intro should be played (first time entering world)
   */
  shouldPlayWorldIntro(worldNum) {
    if (this.devMode) return true
    
    // Check if cutscene exists and is published
    const cutscene = CutsceneManager.getWorldIntroCutscene(worldNum)
    if (!cutscene || !cutscene.is_published) return false
    
    // Check if not already watched
    return !CutsceneManager.hasWatchedWorldIntro(worldNum)
  }

  /**
   * Check if a post-boss cutscene should be played
   */
  shouldPlayPostBoss(worldNum) {
    if (this.devMode) return true
    
    const cutscene = CutsceneManager.getPostBossCutscene(worldNum)
    if (!cutscene || !cutscene.is_published) return false
    
    return !CutsceneManager.hasWatchedPostBoss(worldNum)
  }

  /**
   * Check if an end of act cutscene should be played
   */
  shouldPlayActEnd(actNum) {
    if (this.devMode) return true
    
    const cutscene = CutsceneManager.getEndOfActCutscene(actNum)
    if (!cutscene || !cutscene.is_published) return false
    
    return !CutsceneManager.hasWatched(`act_${actNum}_end`)
  }

  /**
   * Check if the epilogue should be played
   */
  shouldPlayEpilogue() {
    if (this.devMode) return true
    
    const cutscene = CutsceneManager.getCutscene("epilogue")
    if (!cutscene || !cutscene.is_published) return false
    
    return !CutsceneManager.hasWatched("epilogue")
  }

  // ============ World and Act Structure ============

  /**
   * Get which act a world belongs to
   */
  getWorldAct(worldNum) {
    const world = WORLDS[worldNum]
    return world ? world.act : 0
  }

  /**
   * Check if a world is the last world of its act
   */
  isActEndingWorld(worldNum) {
    // Act 1 ends with World 5
    // Act 2 ends with World 10
    // Act 3 ends with World 15
    return worldNum === 5 || worldNum === 10 || worldNum === 15
  }

  /**
   * Get the act that ends with this world (if any)
   */
  getActEndingWith(worldNum) {
    switch (worldNum) {
      case 5: return 1
      case 10: return 2
      case 15: return 3
      default: return null
    }
  }

  /**
   * Check if world 15 boss was just defeated (triggers epilogue)
   */
  isGameComplete(worldNum) {
    return worldNum === 15
  }

  // ============ Cutscene Flow Logic ============

  /**
   * Determine what cutscenes to play after a boss is defeated
   * Returns an array of scenes to play in order
   */
  getPostBossCutsceneSequence(worldNum) {
    const sequence = []

    // 1. Post-boss cutscene for this world
    if (this.shouldPlayPostBoss(worldNum)) {
      sequence.push({
        type: "post_boss",
        worldNum: worldNum,
        sceneKey: this.getPostBossSceneKey(worldNum),
        cutsceneKey: `world_${worldNum}_post_boss`
      })
    }

    // 2. End of act cutscene if this is an act-ending world
    const actNum = this.getActEndingWith(worldNum)
    if (actNum && this.shouldPlayActEnd(actNum)) {
      sequence.push({
        type: "act_end",
        actNum: actNum,
        sceneKey: this.getActEndSceneKey(actNum),
        cutsceneKey: `act_${actNum}_end`
      })
    }

    // 3. Epilogue if this is the final world
    if (this.isGameComplete(worldNum) && this.shouldPlayEpilogue()) {
      sequence.push({
        type: "epilogue",
        sceneKey: "EpilogueScene",
        cutsceneKey: "epilogue"
      })
    }

    return sequence
  }

  /**
   * Get all cutscenes organized by category for the gallery
   */
  getAllCutscenesForGallery() {
    const gallery = {
      special: [],      // Intro, epilogue
      worldIntros: [],  // World intro cutscenes (1-15)
      postBoss: [],     // Post-boss cutscenes (1-15)
      actEnds: [],      // End of act cutscenes (1-3)
      bonusUnlocks: []  // Bonus unlock cutscenes
    }

    // Game Intro
    const introCutscene = CutsceneManager.getCutscene("game_intro")
    if (introCutscene) {
      gallery.special.push({
        ...introCutscene,
        sceneKey: "IntroScene",
        isWatched: CutsceneManager.hasWatched("game_intro"),
        isPlayable: introCutscene.is_published || this.devMode
      })
    }

    // World Intros and Post-Boss
    for (let worldNum = 1; worldNum <= 15; worldNum++) {
      // World intro
      const intro = CutsceneManager.getWorldIntroCutscene(worldNum)
      gallery.worldIntros.push({
        worldNum,
        cutsceneKey: `world_${worldNum}_intro`,
        sceneKey: this.getWorldIntroSceneKey(worldNum),
        title: intro?.title || `World ${worldNum} Intro`,
        isWatched: CutsceneManager.hasWatchedWorldIntro(worldNum),
        isPlayable: (intro && intro.is_published) || this.devMode,
        world: WORLDS[worldNum]
      })

      // Post-boss
      const postBoss = CutsceneManager.getPostBossCutscene(worldNum)
      gallery.postBoss.push({
        worldNum,
        cutsceneKey: `world_${worldNum}_post_boss`,
        sceneKey: this.getPostBossSceneKey(worldNum),
        title: postBoss?.title || `World ${worldNum} Boss Defeated`,
        isWatched: CutsceneManager.hasWatchedPostBoss(worldNum),
        isPlayable: (postBoss && postBoss.is_published) || this.devMode,
        world: WORLDS[worldNum]
      })
    }

    // Act Ends
    for (let actNum = 1; actNum <= 3; actNum++) {
      const actEnd = CutsceneManager.getEndOfActCutscene(actNum)
      gallery.actEnds.push({
        actNum,
        cutsceneKey: `act_${actNum}_end`,
        sceneKey: this.getActEndSceneKey(actNum),
        title: actEnd?.title || `Act ${actNum} Complete`,
        isWatched: CutsceneManager.hasWatched(`act_${actNum}_end`),
        isPlayable: (actEnd && actEnd.is_published) || this.devMode
      })
    }

    // Epilogue
    const epilogue = CutsceneManager.getCutscene("epilogue")
    if (epilogue) {
      gallery.special.push({
        ...epilogue,
        sceneKey: "EpilogueScene",
        isWatched: CutsceneManager.hasWatched("epilogue"),
        isPlayable: epilogue.is_published || this.devMode
      })
    }

    // Bonus unlock cutscenes
    const bonusKeys = ["bonus_unlock_1", "bonus_unlock_2"]
    for (const key of bonusKeys) {
      const bonus = CutsceneManager.getCutscene(key)
      if (bonus) {
        gallery.bonusUnlocks.push({
          ...bonus,
          cutsceneKey: key,
          sceneKey: CUTSCENE_SCENE_KEYS[key],
          isWatched: CutsceneManager.hasWatched(key),
          isPlayable: bonus.is_published || this.devMode
        })
      }
    }

    return gallery
  }

  /**
   * Get statistics for gallery display
   */
  getGalleryStats() {
    const gallery = this.getAllCutscenesForGallery()
    let total = 0
    let watched = 0
    let playable = 0

    // Count all cutscenes
    const allCutscenes = [
      ...gallery.special,
      ...gallery.worldIntros,
      ...gallery.postBoss,
      ...gallery.actEnds,
      ...gallery.bonusUnlocks
    ]

    for (const cutscene of allCutscenes) {
      if (cutscene.isPlayable) {
        playable++
        if (cutscene.isWatched) watched++
      }
      total++
    }

    return { total, watched, playable }
  }

  // ============ Utility Functions ============

  /**
   * Mark a cutscene as watched by scene key
   */
  markWatchedBySceneKey(sceneKey) {
    const cutsceneKey = this.getCutsceneKey(sceneKey)
    if (cutsceneKey) {
      CutsceneManager.markWatched(cutsceneKey)
    }
  }
}

// Export singleton
export const CutsceneFlowManager = new CutsceneFlowManagerClass()
