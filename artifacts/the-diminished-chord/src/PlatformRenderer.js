import Phaser from "phaser"
import { WORLDS, parseLevelId } from "./WorldManager.js"

/**
 * PlatformRenderer - Unified platform rendering system
 * 
 * This module provides a SINGLE implementation of platform rendering
 * used by BOTH CustomLevelTestScene AND DynamicLevelScene.
 * 
 * The goal: What you see in test mode is EXACTLY what you see in gameplay.
 * 
 * Style System:
 * - Each platform can have an explicit style (world palette + tile styles)
 * - "auto" style: Automatically applies the destination world's palette
 * - Custom levels can override styles per-platform for artistic control
 */

// World-specific tileset keys - mapped to actual asset-pack.json tileset names
const WORLD_TILESET_KEYS = {
  1: "detroit_winter_tileset",       // World 1: Detroit Underground
  2: "berlin_techno_tileset",        // World 2: Berlin Industrial
  3: "tokyo_neon_tileset",           // World 3: Tokyo Neon
  4: "london_punk_tileset",          // World 4: London Rainy
  5: "festival_outdoor_tileset",     // World 5: Festival
  6: "reykjavik_ice_tileset",        // World 6: Reykjavik Arctic
  7: "la_studio_tileset",            // World 7: LA Corporate
  8: "sydney_opera_tileset",         // World 8: Sydney Arena
  9: "nyc_arena_tileset",            // World 9: NYC Media
  10: "corporate_trap_tileset",      // World 10: Contract Trap
  11: "doubt_mirror_tileset",        // World 11: Psychological Doubt
  12: "time_fracture_tileset",       // World 12: Time Fracture
  13: "noise_glitch_tileset",        // World 13: Noise Glitch
  14: "clarity_light_tileset",       // World 14: Clarity
  15: "diminished_finale_tileset",   // World 15: The Finale
  // Fallbacks
  tutorial: "metroid_cavern_tileset",
  default: "metroid_cavern_tileset"
}

// World-specific color palettes (for styled fallback)
const WORLD_PALETTES = {
  1: { // Underground/Detroit
    platform: 0x3a3a3a,
    accent: 0xff6b6b,
    highlight: 0x6a6a6a,
    dark: 0x2a2a2a
  },
  2: { // Industrial/Berlin
    platform: 0x555555,
    accent: 0x888888,
    highlight: 0x888888,
    dark: 0x333333
  },
  3: { // Neon/Tokyo
    platform: 0x2a2a5a,
    accent: 0x00ffff,
    highlight: 0x5a5a9a,
    dark: 0x1a1a3a
  },
  4: { // Rainy/London
    platform: 0x3a4a5a,
    accent: 0x6b8cff,
    highlight: 0x6a7a8a,
    dark: 0x2a3a4a
  },
  5: { // Festival
    platform: 0x5a4a3a,
    accent: 0xffaa00,
    highlight: 0x8a7a6a,
    dark: 0x3a2a1a
  },
  6: { // Arctic/Reykjavik
    platform: 0x4a5a6a,
    accent: 0x88ddff,
    highlight: 0x7a8a9a,
    dark: 0x3a4a5a
  },
  7: { // Corporate/LA
    platform: 0x4a4a4a,
    accent: 0xff4444,
    highlight: 0x7a7a7a,
    dark: 0x2a2a2a
  },
  8: { // Arena/Sydney
    platform: 0x5a3a4a,
    accent: 0xff69b4,
    highlight: 0x8a6a7a,
    dark: 0x3a2a3a
  },
  9: { // Media/NYC
    platform: 0x4a4a3a,
    accent: 0xffff00,
    highlight: 0x7a7a6a,
    dark: 0x2a2a1a
  },
  10: { // Contract
    platform: 0x4a3a3a,
    accent: 0x880000,
    highlight: 0x7a6a6a,
    dark: 0x2a1a1a
  },
  11: { // Psychological
    platform: 0x4a3a5a,
    accent: 0xa855f7,
    highlight: 0x7a6a8a,
    dark: 0x2a1a3a
  },
  12: { // Time Fracture
    platform: 0x3a5a4a,
    accent: 0x00ff88,
    highlight: 0x6a8a7a,
    dark: 0x1a3a2a
  },
  13: { // Glitch
    platform: 0x5a3a4a,
    accent: 0xff0088,
    highlight: 0x8a6a7a,
    dark: 0x3a1a2a
  },
  14: { // Clarity
    platform: 0x5a5a5a,
    accent: 0xffffff,
    highlight: 0x8a8a8a,
    dark: 0x3a3a3a
  },
  15: { // Finale
    platform: 0x4a3a5a,
    accent: 0xff69b4,
    highlight: 0x7a6a8a,
    dark: 0x2a1a3a
  },
  // Default/Tutorial palette
  default: {
    platform: 0x3a4a5a,
    accent: 0x4a90d9,
    highlight: 0x5a6a7a,
    dark: 0x2a3a4a
  }
}

/**
 * PlatformRenderer class - handles all platform rendering
 */
export class PlatformRenderer {
  /**
   * Create a PlatformRenderer
   * @param {Phaser.Scene} scene - The scene to render platforms in
   * @param {number} tileSize - The tile size in pixels (default 64)
   */
  constructor(scene, tileSize = 64) {
    this.scene = scene
    this.tileSize = tileSize
    this.frameCache = new Set() // Track which tilesets have frames created
  }
  
  /**
   * Determine the style world for rendering
   * Priority: platform.styleWorld > levelData.styleWorld > parsed world from levelId > default
   * @param {object} platformData - Optional platform-specific data
   * @param {object} levelData - Level data with potential styleWorld
   * @param {string} levelId - Level ID to parse world from
   * @returns {number|null} The world number to use for styling
   */
  getStyleWorld(platformData, levelData, levelId) {
    // Platform-specific override
    if (platformData?.styleWorld !== undefined) {
      return platformData.styleWorld
    }
    
    // Level-wide style setting
    if (levelData?.styleWorld !== undefined) {
      return levelData.styleWorld
    }
    
    // Parse from level ID
    if (levelId) {
      const parsed = parseLevelId(levelId)
      if (parsed?.world) {
        return parsed.world
      }
    }
    
    return null // Will use default
  }
  
  /**
   * Get the tileset key for a world
   * @param {number} worldNum - World number (1-15) or null for default
   * @returns {string} Tileset texture key
   */
  getTilesetKey(worldNum) {
    if (worldNum && WORLD_TILESET_KEYS[worldNum]) {
      return WORLD_TILESET_KEYS[worldNum]
    }
    return WORLD_TILESET_KEYS.default
  }
  
  /**
   * Get the color palette for a world
   * @param {number} worldNum - World number (1-15) or null for default
   * @returns {object} Color palette with platform, accent, highlight, dark
   */
  getPalette(worldNum) {
    if (worldNum && WORLD_PALETTES[worldNum]) {
      return WORLD_PALETTES[worldNum]
    }
    return WORLD_PALETTES.default
  }
  
  /**
   * Create a platform with proper styling
   * This is the UNIFIED rendering method used by both test and gameplay scenes.
   * 
   * @param {number} x - X position in pixels (top-left)
   * @param {number} y - Y position in pixels (top-left)
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {object} options - Rendering options
   * @param {number} options.styleWorld - World number to use for styling
   * @param {string} options.stylePreset - "auto", "minimal", or custom preset name
   * @param {object} options.tileStyles - Per-tile style overrides
   * @returns {Phaser.GameObjects.Container} The platform container
   */
  createPlatform(x, y, width, height, options = {}) {
    const styleWorld = options.styleWorld || null
    const stylePreset = options.stylePreset || "auto"
    
    // Get tileset key for this world
    const tilesetKey = this.getTilesetKey(styleWorld)
    
    // Try tileset rendering first
    if (this.scene.textures.exists(tilesetKey)) {
      return this.createTilesetPlatform(x, y, width, height, tilesetKey)
    }
    
    // Fall back to styled rectangles
    const palette = this.getPalette(styleWorld)
    return this.createStyledPlatform(x, y, width, height, palette)
  }
  
  /**
   * Create a platform using tileset tiles (9-slice style)
   * Tilesets are expected to be 192x192 (3x3 grid of 64x64 tiles)
   * or 448x448 (7x7 grid of 64x64 tiles)
   */
  createTilesetPlatform(x, y, width, height, tilesetKey) {
    const container = this.scene.add.container(x, y)
    const srcTileSize = 64 // Standard tileset tile size
    const destTileSize = this.tileSize
    const scale = destTileSize / srcTileSize
    
    const tilesWide = Math.max(1, Math.ceil(width / destTileSize))
    const tilesHigh = Math.max(1, Math.ceil(height / destTileSize))
    
    // Ensure frames exist for this tileset
    this.ensureTilesetFrames(tilesetKey, srcTileSize)
    
    for (let ty = 0; ty < tilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        // Determine which tile from the 9-slice to use
        const srcX = this.get9SliceColumn(tx, tilesWide)
        const srcY = this.get9SliceRow(ty, tilesHigh)
        
        const frameName = `${tilesetKey}_${srcX}_${srcY}`
        
        // Check if frame exists
        const texture = this.scene.textures.get(tilesetKey)
        if (!texture.has(frameName)) {
          console.warn(`[PlatformRenderer] Missing frame: ${frameName}`)
          continue
        }
        
        const tile = this.scene.add.image(
          tx * destTileSize + destTileSize / 2,
          ty * destTileSize + destTileSize / 2,
          tilesetKey,
          frameName
        )
        
        tile.setScale(scale)
        container.add(tile)
      }
    }
    
    container.setDepth(-1)
    return container
  }
  
  /**
   * Determine 9-slice column (0=left, 1=middle, 2=right)
   */
  get9SliceColumn(tileX, totalWidth) {
    if (totalWidth === 1) return 1 // Single tile uses middle
    if (tileX === 0) return 0 // Left edge
    if (tileX === totalWidth - 1) return 2 // Right edge
    return 1 // Middle fill
  }
  
  /**
   * Determine 9-slice row (0=top, 1=middle, 2=bottom)
   */
  get9SliceRow(tileY, totalHeight) {
    if (totalHeight === 1) return 1 // Single tile uses middle
    if (tileY === 0) return 0 // Top edge
    if (tileY === totalHeight - 1) return 2 // Bottom edge
    return 1 // Middle fill
  }
  
  /**
   * Ensure tileset frames are created
   */
  ensureTilesetFrames(tilesetKey, tileSize) {
    // Check cache to avoid recreating frames
    if (this.frameCache.has(tilesetKey)) {
      return
    }
    
    const texture = this.scene.textures.get(tilesetKey)
    if (!texture) {
      console.warn(`[PlatformRenderer] Tileset texture not found: ${tilesetKey}`)
      return
    }
    
    // Check if frames already exist
    const testFrameName = `${tilesetKey}_0_0`
    if (texture.has(testFrameName)) {
      this.frameCache.add(tilesetKey)
      return
    }
    
    // Create 3x3 grid frames for 9-slice platform tiles
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const frameName = `${tilesetKey}_${col}_${row}`
        try {
          texture.add(
            frameName,
            0, // Source index
            col * tileSize,
            row * tileSize,
            tileSize,
            tileSize
          )
        } catch (e) {
          console.warn(`[PlatformRenderer] Failed to create frame ${frameName}:`, e.message)
        }
      }
    }
    
    this.frameCache.add(tilesetKey)
    console.log(`[PlatformRenderer] Created 9-slice frames for: ${tilesetKey}`)
  }
  
  /**
   * Create styled platform using colored rectangles (fallback when no tileset)
   */
  createStyledPlatform(x, y, width, height, palette) {
    const container = this.scene.add.container(x, y)
    const tileSize = this.tileSize
    
    const { platform, accent, highlight, dark } = palette
    
    // Main platform body
    const mainRect = this.scene.add.rectangle(width / 2, height / 2, width, height, platform)
    mainRect.setStrokeStyle(2, accent)
    container.add(mainRect)
    
    // Top highlight (3D effect)
    const topHighlight = this.scene.add.rectangle(width / 2, 4, width - 4, 6, highlight, 0.7)
    container.add(topHighlight)
    
    // Bottom shadow
    const bottomShadow = this.scene.add.rectangle(width / 2, height - 4, width - 4, 6, dark, 0.7)
    container.add(bottomShadow)
    
    // Left edge highlight
    const leftEdge = this.scene.add.rectangle(3, height / 2, 4, height - 8, highlight, 0.4)
    container.add(leftEdge)
    
    // Right edge shadow
    const rightEdge = this.scene.add.rectangle(width - 3, height / 2, 4, height - 8, dark, 0.4)
    container.add(rightEdge)
    
    // Inner texture - horizontal lines
    for (let py = 12; py < height - 12; py += 8) {
      const hLine = this.scene.add.rectangle(width / 2, py, width - 16, 1, accent, 0.15)
      container.add(hLine)
    }
    
    // Vertical pattern for wider platforms
    const patternSpacing = 16
    for (let px = patternSpacing; px < width - patternSpacing; px += patternSpacing) {
      const line = this.scene.add.rectangle(px, height / 2, 1, height - 12, accent, 0.1)
      container.add(line)
    }
    
    // Corner rivets for larger platforms
    if (width >= tileSize * 2 && height >= tileSize) {
      const rivetSize = 4
      const rivetInset = 6
      const rivets = [
        { x: rivetInset, y: rivetInset },
        { x: width - rivetInset, y: rivetInset },
        { x: rivetInset, y: height - rivetInset },
        { x: width - rivetInset, y: height - rivetInset }
      ]
      rivets.forEach(rivet => {
        const rivetBg = this.scene.add.circle(rivet.x, rivet.y, rivetSize, dark, 0.8)
        container.add(rivetBg)
        const rivetHighlight = this.scene.add.circle(rivet.x - 1, rivet.y - 1, rivetSize - 2, highlight, 0.5)
        container.add(rivetHighlight)
      })
    }
    
    container.setDepth(-1)
    return container
  }
  
  /**
   * Create a collision body for a platform (used separately from visuals)
   * @param {number} x - X position in pixels (top-left)
   * @param {number} y - Y position in pixels (top-left)
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {Phaser.GameObjects.Group} group - Group to add collider to
   * @returns {Phaser.GameObjects.Rectangle} The collision rectangle
   */
  createCollider(x, y, width, height, group) {
    const collider = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height)
    collider.setVisible(false)
    this.scene.physics.add.existing(collider, true) // Static body
    if (group) {
      group.add(collider)
    }
    return collider
  }
}

// Export constants for use by other modules
export { WORLD_TILESET_KEYS, WORLD_PALETTES }
