/**
 * Level Data Index
 * Auto-exports all level data files for the game.
 * Add new level imports here as they are created.
 */

import { TutorialLevel } from './Tutorial.js'

// Export all levels in a map for easy access
export const LEVEL_DATA = {
  "Tutorial": TutorialLevel,
  // World 1 levels will be added here
  // "W1L1": W1L1Level,
  // etc.
}

/**
 * Get level data by ID
 * @param {string} levelId 
 * @returns {object|null}
 */
export function getLevelData(levelId) {
  return LEVEL_DATA[levelId] || null
}

/**
 * Check if a level has published data
 * @param {string} levelId 
 * @returns {boolean}
 */
export function hasPublishedLevel(levelId) {
  return levelId in LEVEL_DATA
}

/**
 * Get all published level IDs
 * @returns {string[]}
 */
export function getPublishedLevelIds() {
  return Object.keys(LEVEL_DATA)
}
