import Phaser from "phaser"
import { WORLDS, WorldManager, getLevelId, LEVEL_TYPES, BONUS_PURPOSES, getLevelSceneKey } from "./WorldManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"
import { CutsceneFlowManager } from "./CutsceneFlowManager.js"
import { LevelDataManager } from "./LevelDataManager.js"
import { PlayerProgressManager } from "./PlayerProgressManager.js"
import { SupabaseMusicManager } from "./SupabaseMusicManager.js"

/**
 * WorldLevelSelectScene - Level select within a world
 * Features:
 * - Teddy character that walks from node to node
 * - Tileset-based background
 * - Serpentine layout: 14 levels in 2 rows of 7, bonus row, boss at end
 * - Lock icons on locked levels
 */
export class WorldLevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "WorldLevelSelectScene" })
  }

  init(data) {
    this.worldNum = data.worldNum || 1
    this.world = WORLDS[this.worldNum]
    this.skipIntroCutscene = data.skipIntroCutscene || false
  }

  create() {
    // Check if this is the first time entering this world and if a cutscene exists
    if (!this.skipIntroCutscene && CutsceneFlowManager.shouldPlayWorldIntro(this.worldNum)) {
      // Play the intro cutscene first
      const sceneKey = CutsceneFlowManager.getWorldIntroSceneKey(this.worldNum)
      if (sceneKey) {
        BGMManager.stop()
        this.scene.start(sceneKey, {
          returnScene: "WorldLevelSelectScene",
          returnData: { worldNum: this.worldNum, skipIntroCutscene: true }
        })
        return
      }
    }
    const { width, height } = this.cameras.main
    this.centerX = width / 2
    this.centerY = height / 2

    // Get world theme colors
    this.themeColors = this.getThemeColors()

    // Set background color based on world theme
    this.cameras.main.setBackgroundColor(this.themeColors.background)

    // Play world-specific overworld music (if assigned)
    const worldMusicKey = `world_${this.worldNum}`
    BGMManager.playMenuMusic(this, worldMusicKey)

    // Create tileset background
    this.createTilesetBackground()

    // Create header with world info
    this.createHeader()

    // Calculate level positions
    this.levelPositions = this.calculateLevelPositions()

    // Create node-based level map
    this.createNodeMap()

    // Create teddy character
    this.createTeddyCharacter()

    // Create info panel
    this.createInfoPanel()

    // Create navigation
    this.createNavigation()

    // Setup input
    this.setupInput()

    // Initialize selection - find first unlocked level
    this.selectedLevelIndex = this.findFirstUnlockedIndex()
    this.updateSelection()
    this.moveTeddyToLevel(this.selectedLevelIndex, false) // Instant move
  }

  getThemeColors() {
    const themes = {
      underground: { background: 0x0a0815, accent: 0xff6b6b, path: 0x442222 },
      industrial: { background: 0x0f0f15, accent: 0x888899, path: 0x333344 },
      neon: { background: 0x050520, accent: 0x00ffff, path: 0x003355 },
      rainy: { background: 0x080a15, accent: 0x6b8cff, path: 0x223355 },
      festival: { background: 0x15100a, accent: 0xffaa00, path: 0x443322 },
      arctic: { background: 0x081520, accent: 0x88ddff, path: 0x224455 },
      corporate: { background: 0x100810, accent: 0xff4444, path: 0x442233 },
      arena: { background: 0x150810, accent: 0xff69b4, path: 0x553344 },
      media: { background: 0x0f100a, accent: 0xffff00, path: 0x444422 },
      contract: { background: 0x100505, accent: 0xcc0000, path: 0x441111 },
      psychological: { background: 0x100515, accent: 0xa855f7, path: 0x442255 },
      time: { background: 0x051010, accent: 0x00ff88, path: 0x224433 },
      glitch: { background: 0x0f0510, accent: 0xff0088, path: 0x552244 },
      clarity: { background: 0x0f0f12, accent: 0xffffff, path: 0x444455 },
      finale: { background: 0x0a0510, accent: 0xff69b4, path: 0x442244 }
    }
    return themes[this.world?.theme] || themes.underground
  }

  createTilesetBackground() {
    const { width, height } = this.cameras.main
    
    // Get world-specific background and tileset keys
    const assets = this.getWorldAssets()
    
    // Try to add world-specific background image
    if (assets.background && this.textures.exists(assets.background)) {
      // Add the background image, scaled to cover the screen
      const bg = this.add.image(width / 2, height / 2, assets.background)
      const scaleX = width / bg.width
      const scaleY = height / bg.height
      const scale = Math.max(scaleX, scaleY) // Cover the entire screen
      bg.setScale(scale)
      bg.setAlpha(0.6) // Semi-transparent to keep UI readable
      bg.setDepth(0)
      
      // Add a dark overlay to improve readability
      const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.4)
      overlay.setDepth(0)
    } else {
      // Fallback to graphics-based background
      const graphics = this.add.graphics()
      graphics.fillStyle(this.themeColors.path, 0.1)
      
      const tileSize = 32
      for (let x = 0; x < width; x += tileSize) {
        for (let y = 0; y < height; y += tileSize) {
          if ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) {
            graphics.fillRect(x, y, tileSize, tileSize)
          }
        }
      }
    }
    
    // Try to add tileset as decorative border/pattern
    if (assets.tileset && this.textures.exists(assets.tileset)) {
      this.createTilesetDecoration(assets.tileset)
    }

    // Add some atmospheric elements based on theme
    this.createAtmosphericElements(this.add.graphics())
    
    // Path graphics for connecting levels
    this.pathGraphics = this.add.graphics()
    this.pathGraphics.setDepth(1)
  }
  
  getWorldAssets() {
    // Map world numbers to their specific background and tileset keys
    const worldAssets = {
      1: { background: "detroit_winter_background", tileset: "detroit_winter_tileset" },
      2: { background: "world2_berlin_background", tileset: "berlin_techno_tileset" },
      3: { background: "world3_tokyo_background", tileset: "tokyo_neon_tileset" },
      4: { background: "world4_london_background", tileset: "london_punk_tileset" },
      5: { background: "world5_festival_background", tileset: "festival_outdoor_tileset" },
      6: { background: "world6_reykjavik_background", tileset: "reykjavik_ice_tileset" },
      7: { background: "world7_la_background", tileset: "la_studio_tileset" },
      8: { background: "world8_sydney_background", tileset: "sydney_opera_tileset" },
      9: { background: "world9_nyc_background", tileset: "nyc_arena_tileset" },
      10: { background: "world10_contract_trap_background", tileset: "corporate_trap_tileset" },
      11: { background: "world11_doubt_background", tileset: "doubt_mirror_tileset" },
      12: { background: "world12_time_fracture_background", tileset: "time_fracture_tileset" },
      13: { background: "world13_noise_collapse_background", tileset: "noise_glitch_tileset" },
      14: { background: "world14_clarity_background", tileset: "clarity_light_tileset" },
      15: { background: "world15_diminished_chord_background", tileset: "diminished_finale_tileset" }
    }
    
    return worldAssets[this.worldNum] || { background: null, tileset: null }
  }
  
  createTilesetDecoration(tilesetKey) {
    const { width, height } = this.cameras.main
    
    // Create decorative border using tileset tiles at the bottom
    // The tileset is 448x448 with 64x64 tiles (7x7 grid)
    const tileSize = 64
    const borderY = height - tileSize
    
    // Add a row of tiles along the bottom as a decorative ground element
    for (let x = 0; x < width + tileSize; x += tileSize) {
      const tile = this.add.image(x, borderY + tileSize / 2, tilesetKey)
      tile.setScale(0.15) // Scale down the tileset image to use as decoration
      tile.setAlpha(0.3)
      tile.setDepth(0)
      
      // Use different parts of the tileset by setting crop
      // This creates variety in the decoration
    }
  }

  createAtmosphericElements(graphics) {
    const { width, height } = this.cameras.main
    
    // Add subtle colored orbs/particles based on theme
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(50, width - 50)
      const y = Phaser.Math.Between(100, height - 100)
      const radius = Phaser.Math.Between(20, 60)
      graphics.fillStyle(this.themeColors.accent, 0.02)
      graphics.fillCircle(x, y, radius)
    }
  }

  createHeader() {
    const { width, height } = this.cameras.main
    const accentColor = Phaser.Display.Color.IntegerToColor(this.themeColors.accent).rgba

    // World number badge
    const badge = this.add.container(70, 40)
    const badgeBg = this.add.circle(0, 0, 25, 0x1a1a2e, 0.9)
    badgeBg.setStrokeStyle(2, this.themeColors.accent)
    const badgeNum = this.add.text(0, 0, `W${this.worldNum}`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: accentColor
    }).setOrigin(0.5)
    badge.add([badgeBg, badgeNum])

    // World name
    this.add.text(110, 28, this.world.name.toUpperCase(), {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: accentColor
    })

    // Location and act
    this.add.text(110, 52, `${this.world.location} • Act ${this.world.act}`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })

    // Progress display
    const progress = WorldManager.getWorldProgress(this.worldNum)
    
    this.add.text(width - 30, 35, `${progress.completed}/${progress.total}`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: accentColor
    }).setOrigin(1, 0.5)

    this.add.text(width - 30, 52, `${progress.percent}% Complete`, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(1, 0.5)
  }

  calculateLevelPositions() {
    const { width, height } = this.cameras.main
    const positions = []

    // Layout:
    // Row 1: Levels 1-7 (left to right)
    // Row 2: Levels 8-14 (right to left) - serpentine
    // Row 3: Bonus levels B1-B5 (centered, smaller)
    // Boss: At the end on the right

    const startY = 140
    const rowHeight = 100
    const nodeSpacing = 130
    const startX = 80

    // Row 1: Levels 1-7 (left to right)
    for (let i = 0; i < 7; i++) {
      positions.push({
        x: startX + i * nodeSpacing,
        y: startY,
        level: i + 1,
        type: LEVEL_TYPES.NORMAL
      })
    }

    // Row 2: Levels 8-14 (right to left - serpentine)
    for (let i = 0; i < 7; i++) {
      positions.push({
        x: startX + (6 - i) * nodeSpacing,
        y: startY + rowHeight,
        level: i + 8,
        type: LEVEL_TYPES.NORMAL
      })
    }

    // Row 3: Bonus levels B1-B5 (centered, spaced)
    const bonusStartX = (width - 5 * 100) / 2 + 40
    for (let i = 0; i < 5; i++) {
      positions.push({
        x: bonusStartX + i * 100,
        y: startY + rowHeight * 2 + 30,
        level: i + 1,
        type: LEVEL_TYPES.BONUS
      })
    }

    // Boss: Right side, below normal levels
    positions.push({
      x: width - 100,
      y: startY + rowHeight * 2.5,
      level: 0,
      type: LEVEL_TYPES.BOSS
    })

    return positions
  }

  createNodeMap() {
    const { width, height } = this.cameras.main
    this.levelButtons = []

    // Draw connecting paths
    this.drawPaths()

    // Create level nodes based on positions
    this.levelPositions.forEach((pos, index) => {
      if (pos.type === LEVEL_TYPES.NORMAL) {
        const levelId = getLevelId(this.worldNum, pos.level, LEVEL_TYPES.NORMAL)
        const button = this.createLevelNode(pos.x, pos.y, pos.level, levelId, LEVEL_TYPES.NORMAL)
        this.levelButtons.push(button)
      } else if (pos.type === LEVEL_TYPES.BONUS) {
        const levelId = getLevelId(this.worldNum, pos.level, LEVEL_TYPES.BONUS)
        const button = this.createLevelNode(pos.x, pos.y, `B${pos.level}`, levelId, LEVEL_TYPES.BONUS, BONUS_PURPOSES[`b${pos.level}`])
        this.levelButtons.push(button)
      } else if (pos.type === LEVEL_TYPES.BOSS) {
        const bossLevelId = getLevelId(this.worldNum, 0, LEVEL_TYPES.BOSS)
        const button = this.createBossNode(pos.x, pos.y, bossLevelId)
        this.levelButtons.push(button)
      }
    })

    // Add row labels
    this.add.text(30, 140, "LEVELS 1-7", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#444444"
    })
    this.add.text(30, 240, "LEVELS 8-14", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#444444"
    })
    this.add.text(30, 370, "BONUS", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#ffaa00"
    })
  }

  drawPaths() {
    this.pathGraphics.clear()

    // Draw paths between normal levels (serpentine)
    // Row 1: 1-7 (left to right)
    for (let i = 0; i < 6; i++) {
      const from = this.levelPositions[i]
      const to = this.levelPositions[i + 1]
      this.drawPathSegment(from, to, i + 1, i + 2)
    }

    // Connection from level 7 to level 8 (going down)
    const level7 = this.levelPositions[6]
    const level8 = this.levelPositions[7]
    this.drawPathSegment(level7, level8, 7, 8)

    // Row 2: 8-14 (right to left - serpentine continues)
    for (let i = 7; i < 13; i++) {
      const from = this.levelPositions[i]
      const to = this.levelPositions[i + 1]
      this.drawPathSegment(from, to, i + 1, i + 2)
    }

    // Connection from level 14 to boss (direct path - no bonus connections!)
    const level14 = this.levelPositions[13]
    const boss = this.levelPositions[19] // Boss is last
    this.drawPathSegment(level14, boss, 14, "boss")

    // Bonus levels are isolated - no connecting paths to normal progression
    // They have their own unlock criteria and are displayed separately
    // Only draw a subtle glow/border around unlocked bonus levels
  }

  drawPathSegment(from, to, fromLevel, toLevel) {
    const fromCompleted = fromLevel === "boss" ? false : 
      WorldManager.isLevelCompleted(getLevelId(this.worldNum, fromLevel, LEVEL_TYPES.NORMAL))
    const toUnlocked = toLevel === "boss" ?
      this.areAllNormalLevelsComplete() :
      WorldManager.isLevelUnlocked(getLevelId(this.worldNum, toLevel, LEVEL_TYPES.NORMAL))

    let color = this.themeColors.path
    let alpha = 0.3

    if (fromCompleted && toUnlocked) {
      color = this.themeColors.accent
      alpha = 0.5
    }

    this.pathGraphics.lineStyle(3, color, alpha)
    this.pathGraphics.beginPath()
    this.pathGraphics.moveTo(from.x, from.y)
    this.pathGraphics.lineTo(to.x, to.y)
    this.pathGraphics.strokePath()
  }

  drawDashedLine(x1, y1, x2, y2, color, alpha) {
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)
    const dashLength = 5
    const gapLength = 5
    const dashCount = Math.floor(distance / (dashLength + gapLength))
    const unitX = dx / distance
    const unitY = dy / distance

    this.pathGraphics.lineStyle(2, color, alpha)

    let currentX = x1
    let currentY = y1

    for (let i = 0; i <= dashCount; i++) {
      const dashEndX = currentX + unitX * dashLength
      const dashEndY = currentY + unitY * dashLength

      this.pathGraphics.beginPath()
      this.pathGraphics.moveTo(currentX, currentY)
      this.pathGraphics.lineTo(dashEndX, dashEndY)
      this.pathGraphics.strokePath()

      currentX = dashEndX + unitX * gapLength
      currentY = dashEndY + unitY * gapLength

      if (Math.abs(currentX - x1) > Math.abs(dx)) break
    }
  }

  areAllNormalLevelsComplete() {
    for (let i = 1; i <= 14; i++) {
      if (!WorldManager.isLevelCompleted(getLevelId(this.worldNum, i, LEVEL_TYPES.NORMAL))) {
        return false
      }
    }
    return true
  }

  createLevelNode(x, y, label, levelId, levelType, bonusPurpose = null) {
    const container = this.add.container(x, y)
    container.setDepth(2)

    const isUnlocked = WorldManager.isLevelUnlocked(levelId)
    const isCompleted = WorldManager.isLevelCompleted(levelId)
    const isBonus = levelType === LEVEL_TYPES.BONUS
    
    // Check for full completion (all 3 trophies: collectibles, no deaths, speed run)
    const isFullyCompleted = this.checkFullCompletion(levelId)

    // Node size
    const nodeRadius = isBonus ? 20 : 24

    // Background circle
    let bgColor = 0x1a1a2e
    let borderColor = isCompleted ? this.themeColors.accent : 
      (isUnlocked ? 0x666688 : 0x333344)

    if (isCompleted) {
      bgColor = 0x2a2a4e
    }
    if (isFullyCompleted) {
      bgColor = 0x3a3a5e // Brighter for full completion
    }
    if (isBonus) {
      borderColor = isCompleted ? 0xffaa00 : (isUnlocked ? 0x886600 : 0x444422)
    }

    const bg = this.add.circle(0, 0, nodeRadius, bgColor, 0.95)
    bg.setStrokeStyle(isCompleted ? 3 : 2, borderColor)

    container.add([bg])

    // Content: either level number or lock icon
    if (!isUnlocked) {
      // Show lock icon for locked levels
      const lockIcon = this.add.image(0, 0, "lock_icon")
      lockIcon.setScale(0.03)
      lockIcon.setTint(0x555555)
      container.add(lockIcon)
    } else {
      // Level number for unlocked levels
      const labelColor = isCompleted ? 
        (isBonus ? "#ffaa00" : Phaser.Display.Color.IntegerToColor(this.themeColors.accent).rgba) : 
        "#ffffff"
      
      const labelText = this.add.text(0, 0, `${label}`, {
        fontFamily: "RetroPixel",
        fontSize: isBonus ? "11px" : "14px",
        color: labelColor
      }).setOrigin(0.5)
      container.add(labelText)
      container.labelText = labelText
    }

    // Full Completion star (golden) - only shown when ALL trophies are earned
    // This replaces the old "basic completion" star
    if (isFullyCompleted) {
      const star = this.add.text(nodeRadius - 3, -nodeRadius + 3, "★", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ffd700" // Golden for full completion
      }).setOrigin(0.5)
      container.add(star)
      
      // Add glow effect for fully completed levels
      this.tweens.add({
        targets: star,
        alpha: { from: 0.7, to: 1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    }

    // Store data
    container.levelId = levelId
    container.levelType = levelType
    container.isUnlocked = isUnlocked
    container.isCompleted = isCompleted
    container.isFullyCompleted = isFullyCompleted
    container.bg = bg
    container.bonusPurpose = bonusPurpose
    container.nodeRadius = nodeRadius
    container.nodeX = x
    container.nodeY = y

    // Make interactive
    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true })
      bg.on("pointerdown", () => {
        const index = this.levelButtons.indexOf(container)
        if (index !== -1) {
          if (this.selectedLevelIndex === index) {
            this.selectLevel(container)
          } else {
            this.selectedLevelIndex = index
            this.updateSelection()
            this.moveTeddyToLevel(index)
            this.sound.play("ui_select_sound", { volume: 0.2 })
          }
        }
      })
    }

    return container
  }

  /**
   * Check if a level has full completion (all 3 trophies)
   * - All collectibles found
   * - Hole-in-one (0 deaths)
   * - Speed run goal met
   */
  checkFullCompletion(levelId) {
    const progress = PlayerProgressManager.getLevelProgress(levelId)
    if (!progress || !progress.isCompleted) return false
    
    const levelData = LevelDataManager.getLevel(levelId)
    const goalTime = levelData?.settings?.parTime
    
    // Trophy 1: All collectibles
    const allCollectibles = progress.allFragmentsCollected === true
    
    // Trophy 2: Hole-in-one (0 deaths)
    const holeInOne = progress.bestDeaths === 0
    
    // Trophy 3: Speed run (if goal time is set)
    // If no goal time is set, we only require the first two trophies
    const speedRun = !goalTime || (progress.bestTimeMs !== null && progress.bestTimeMs <= goalTime * 1000)
    
    return allCollectibles && holeInOne && speedRun
  }

  createBossNode(x, y, levelId) {
    const container = this.add.container(x, y)
    container.setDepth(2)

    const isUnlocked = WorldManager.isLevelUnlocked(levelId)
    const isCompleted = WorldManager.isLevelCompleted(levelId)
    const isFullyCompleted = this.checkFullCompletion(levelId)

    // Boss node is larger
    const nodeRadius = 35

    // Outer glow ring
    const glowRing = this.add.circle(0, 0, nodeRadius + 6, 0x000000, 0)
    glowRing.setStrokeStyle(3, isFullyCompleted ? 0xffd700 : (isCompleted ? 0xff69b4 : (isUnlocked ? 0xff4444 : 0x440000)), 0.3)

    // Main background
    let bgColor = isFullyCompleted ? 0x3a2a1a : (isCompleted ? 0x3a1a2a : (isUnlocked ? 0x2a0a0a : 0x150505))
    let borderColor = isFullyCompleted ? 0xffd700 : (isCompleted ? 0xff69b4 : (isUnlocked ? 0xff4444 : 0x440000))

    const bg = this.add.circle(0, 0, nodeRadius, bgColor, 0.95)
    bg.setStrokeStyle(3, borderColor)

    container.add([glowRing, bg])

    // Content: Boss icon or lock
    if (!isUnlocked) {
      const lockIcon = this.add.image(0, -5, "lock_icon")
      lockIcon.setScale(0.05)
      lockIcon.setTint(0x444444)
      container.add(lockIcon)
      
      const label = this.add.text(0, 18, "BOSS", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#440000"
      }).setOrigin(0.5)
      container.add(label)
    } else {
      // Boss icon
      const icon = this.add.text(0, -5, "👑", {
        fontSize: "24px"
      }).setOrigin(0.5)
      container.add(icon)

      // Boss label
      const label = this.add.text(0, 18, "BOSS", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: isFullyCompleted ? "#ffd700" : (isCompleted ? "#ff69b4" : "#ff4444")
      }).setOrigin(0.5)
      container.add(label)
    }

    // Boss name below
    const bossName = this.add.text(0, nodeRadius + 15, isUnlocked ? this.world.bossName : "???", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: isUnlocked ? "#ff6666" : "#444444"
    }).setOrigin(0.5)
    container.add(bossName)

    // Full completion indicator (golden star) - only shown when all trophies earned
    if (isFullyCompleted) {
      const crown = this.add.text(nodeRadius - 8, -nodeRadius + 8, "★", {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#ffd700"
      }).setOrigin(0.5)
      container.add(crown)
      
      // Glow effect for fully completed boss
      this.tweens.add({
        targets: crown,
        alpha: { from: 0.7, to: 1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    }

    // Pulsing animation for unlocked boss
    if (isUnlocked && !isCompleted) {
      this.tweens.add({
        targets: glowRing,
        scale: { from: 1, to: 1.1 },
        alpha: { from: 0.3, to: 0.1 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    }

    // Store data
    container.levelId = levelId
    container.levelType = LEVEL_TYPES.BOSS
    container.isUnlocked = isUnlocked
    container.isCompleted = isCompleted
    container.bg = bg
    container.isBoss = true
    container.nodeRadius = nodeRadius
    container.nodeX = x
    container.nodeY = y

    // Make interactive
    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true })
      bg.on("pointerdown", () => {
        const index = this.levelButtons.indexOf(container)
        if (index !== -1) {
          if (this.selectedLevelIndex === index) {
            this.selectLevel(container)
          } else {
            this.selectedLevelIndex = index
            this.updateSelection()
            this.moveTeddyToLevel(index)
            this.sound.play("ui_select_sound", { volume: 0.2 })
          }
        }
      })
    }

    return container
  }

  createTeddyCharacter() {
    // Create teddy at first position
    const startPos = this.levelPositions[0]
    
    this.teddy = this.add.sprite(startPos.x, startPos.y - 35, "teddy_idle_frame1")
    this.teddy.setScale(0.1)
    this.teddy.setDepth(10)
    this.teddy.setOrigin(0.5, 1)

    // Create idle animation if not exists
    if (!this.anims.exists("teddy_idle_menu")) {
      this.anims.create({
        key: "teddy_idle_menu",
        frames: [
          { key: "teddy_idle_frame1", duration: 600 },
          { key: "teddy_idle_frame2", duration: 600 }
        ],
        repeat: -1
      })
    }

    // Create walk animation if not exists
    if (!this.anims.exists("teddy_run_menu")) {
      this.anims.create({
        key: "teddy_run_menu",
        frames: [
          { key: "teddy_run_frame1", duration: 150 },
          { key: "teddy_run_frame2", duration: 150 }
        ],
        repeat: -1
      })
    }

    // Play idle animation
    this.teddy.play("teddy_idle_menu")

    // Subtle bounce effect
    this.tweens.add({
      targets: this.teddy,
      y: this.teddy.y - 3,
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  moveTeddyToLevel(levelIndex, animate = true) {
    const targetPos = this.levelPositions[levelIndex]
    if (!targetPos) return

    const targetX = targetPos.x
    const targetY = targetPos.y - 35

    // Always stop any existing tweens first
    this.tweens.killTweensOf(this.teddy)

    if (animate) {
      // Flip based on direction
      const goingRight = targetX > this.teddy.x
      this.teddy.setFlipX(!goingRight)

      // Play run animation
      this.teddy.play("teddy_run_menu")

      // Animate movement
      this.tweens.add({
        targets: this.teddy,
        x: targetX,
        y: targetY,
        duration: 300,
        ease: "Power2",
        onComplete: () => {
          // Back to idle
          this.teddy.play("teddy_idle_menu")
          // Resume bounce at new position
          this.tweens.add({
            targets: this.teddy,
            y: targetY - 3,
            duration: 800,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1
          })
        }
      })
    } else {
      // Instant move - set position and start bounce at new location
      this.teddy.setPosition(targetX, targetY)
      // Start bounce effect at new position
      this.tweens.add({
        targets: this.teddy,
        y: targetY - 3,
        duration: 800,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      })
    }
  }

  createInfoPanel() {
    const { width, height } = this.cameras.main
    const accentColorHex = Phaser.Display.Color.IntegerToColor(this.themeColors.accent).rgba

    // Main info panel container at bottom
    this.infoPanel = this.add.container(width / 2, height - 45)
    this.infoPanel.setDepth(10)

    // Level info background (smaller, just for title/description)
    const infoBg = this.add.rectangle(0, 0, 700, 55, 0x0a0a15, 0.95)
    infoBg.setStrokeStyle(2, this.themeColors.accent, 0.5)

    // Level name
    this.infoLevelName = this.add.text(-330, -12, "", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    })

    // Level type/description
    this.infoLevelType = this.add.text(-330, 10, "", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888",
      wordWrap: { width: 400 }
    })

    this.infoPanel.add([infoBg, this.infoLevelName, this.infoLevelType])

    // ==========================================
    // TROPHY DASHBOARD (positioned above info panel)
    // Redesigned: 50% left for medals, 50% right for leaderboard
    // ==========================================
    this.trophyDashboard = this.add.container(width / 2, height - 130)
    this.trophyDashboard.setDepth(10)

    // Dashboard background - wider to accommodate expanded layout
    const dashboardBg = this.add.rectangle(0, 0, 750, 110, 0x0a0a15, 0.95)
    dashboardBg.setStrokeStyle(2, this.themeColors.accent, 0.3)
    this.trophyDashboard.add(dashboardBg)

    // Vertical divider between medals and leaderboard
    const divider = this.add.rectangle(0, 0, 2, 90, 0x333344, 0.5)
    this.trophyDashboard.add(divider)

    // ==========================================
    // LEFT SIDE: ACHIEVEMENTS & MEDALS (50%)
    // ==========================================
    const leftSideX = -185  // Center of left half
    
    // Section title for achievements
    const achievementsTitle = this.add.text(leftSideX, -45, "ACHIEVEMENTS", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5, 0)
    this.trophyDashboard.add(achievementsTitle)

    // Create trophy slots container (centered in left half)
    const trophyContainer = this.add.container(leftSideX, 10)
    this.trophyDashboard.add(trophyContainer)

    const trophySpacing = 70
    const trophyStartX = -(trophySpacing * 1.5)  // Center 4 trophies
    
    // Trophy 1: Collectibles (clickable - opens mini MP3 player for level track)
    this.collectibleTrophy = this.createTrophySlot(
      trophyStartX, 0, "♪", "ITEMS", trophyContainer, 
      true, // isClickable
      (slot) => this.openTrackPlayer(slot)
    )
    
    // Trophy 2: No Deaths
    this.holeInOneTrophy = this.createTrophySlot(trophyStartX + trophySpacing, 0, "★", "FIRST TRY", trophyContainer)
    
    // Trophy 3: Any% Speed Run
    this.speedRunAnyTrophy = this.createTrophySlot(trophyStartX + trophySpacing * 2, 0, "⚡", "ANY%", trophyContainer)
    
    // Trophy 4: 100% Speed Run
    this.speedRun100Trophy = this.createTrophySlot(trophyStartX + trophySpacing * 3, 0, "⚡", "100%", trophyContainer)

    // Stats text (completion info) - below achievements
    this.statsText = this.add.text(leftSideX, 42, "", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#555555"
    }).setOrigin(0.5, 0)
    this.trophyDashboard.add(this.statsText)

    // ==========================================
    // RIGHT SIDE: LEADERBOARD (50%)
    // Expanded space for better readability
    // ==========================================
    const rightSideX = 185  // Center of right half
    this.leaderboardContainer = this.add.container(rightSideX, 0)
    this.trophyDashboard.add(this.leaderboardContainer)

    const lbTitle = this.add.text(0, -45, "TOP 3 LEADERBOARD", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5, 0)
    this.leaderboardContainer.add(lbTitle)

    // Create leaderboard entry slots with expanded spacing
    // Now using wider layout: rank | name (left aligned) | time (right aligned)
    this.leaderboardEntries = []
    const lbEntryStartY = -18
    const lbEntrySpacing = 22
    const lbRankX = -155     // Rank on far left
    const lbNameX = -130     // Name starts after rank
    const lbTimeX = 155      // Time on far right
    
    for (let i = 0; i < 3; i++) {
      const y = lbEntryStartY + (i * lbEntrySpacing)
      const rankColor = i === 0 ? "#ffd700" : (i === 1 ? "#c0c0c0" : "#cd7f32")
      
      const entry = {
        rank: this.add.text(lbRankX, y, `${i + 1}.`, {
          fontFamily: "RetroPixel",
          fontSize: "11px",
          color: rankColor
        }).setOrigin(0, 0.5),
        name: this.add.text(lbNameX, y, "---", {
          fontFamily: "RetroPixel",
          fontSize: "11px",
          color: "#888888"
        }).setOrigin(0, 0.5),
        time: this.add.text(lbTimeX, y, "--:--.---", {
          fontFamily: "RetroPixel",
          fontSize: "11px",
          color: "#888888"
        }).setOrigin(1, 0.5)
      }
      this.leaderboardContainer.add([entry.rank, entry.name, entry.time])
      this.leaderboardEntries.push(entry)
    }

    // Personal best display - below leaderboard entries
    this.personalBestText = this.add.text(0, 52, "Your Best: --:--.---", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: accentColorHex
    }).setOrigin(0.5, 0.5)
    this.leaderboardContainer.add(this.personalBestText)
  }

  /**
   * Create a trophy slot with icon and label
   * @param {boolean} isClickable - If true, slot can be clicked (for track unlock trophy)
   * @param {function} onClick - Callback when clicked
   */
  createTrophySlot(x, y, icon, label, container, isClickable = false, onClick = null) {
    const slot = {
      x, y,
      container: this.add.container(x, y),
      isClickable,
      onClick
    }
    
    // Trophy background circle (silhouette when not earned)
    slot.bg = this.add.circle(0, -5, 20, 0x222233, 0.8)
    slot.bg.setStrokeStyle(2, 0x333344)
    
    // Trophy icon
    slot.icon = this.add.text(0, -5, icon, {
      fontSize: "18px",
      color: "#333344" // Silhouette color (dark)
    }).setOrigin(0.5)
    
    // Label below
    slot.label = this.add.text(0, 22, label, {
      fontFamily: "RetroPixel",
      fontSize: "7px",
      color: "#444444"
    }).setOrigin(0.5)
    
    slot.container.add([slot.bg, slot.icon, slot.label])
    container.add(slot.container)
    
    // Make clickable if specified
    if (isClickable) {
      slot.bg.setInteractive({ useHandCursor: true })
      slot.bg.on("pointerover", () => {
        slot.bg.setStrokeStyle(3, 0xff69b4)
      })
      slot.bg.on("pointerout", () => {
        // Reset stroke based on earned state
        if (slot.isEarned) {
          slot.bg.setStrokeStyle(2, 0xffd700)
        } else {
          slot.bg.setStrokeStyle(2, 0x333344)
        }
      })
      slot.bg.on("pointerdown", () => {
        if (onClick) {
          this.sound.play("ui_select_sound", { volume: 0.2 })
          onClick(slot)
        }
      })
    }
    
    return slot
  }

  /**
   * Update trophy slot appearance based on earned status
   */
  updateTrophySlot(slot, earned, partial = false, progressText = "") {
    const accentColor = this.themeColors.accent
    const accentColorHex = Phaser.Display.Color.IntegerToColor(accentColor).rgba
    
    // Store earned state on slot for hover interactions
    slot.isEarned = earned
    
    if (earned) {
      // Fully earned - bright and golden
      slot.bg.setFillStyle(0x2a2a3a, 0.9)
      slot.bg.setStrokeStyle(2, 0xffd700)
      slot.icon.setColor("#ffd700")
      slot.label.setColor(accentColorHex)
    } else if (partial) {
      // Partial progress - dimmed accent color
      slot.bg.setFillStyle(0x1a1a2a, 0.8)
      slot.bg.setStrokeStyle(2, accentColor, 0.5)
      slot.icon.setColor(accentColorHex)
      slot.icon.setAlpha(0.5)
      slot.label.setColor("#666666")
    } else {
      // Not earned - silhouette
      slot.bg.setFillStyle(0x222233, 0.8)
      slot.bg.setStrokeStyle(2, 0x333344)
      slot.icon.setColor("#333344")
      slot.icon.setAlpha(1)
      slot.label.setColor("#444444")
    }
    
    // Update label with progress if provided
    if (progressText) {
      const baseLabel = slot.label.text.split("\n")[0]
      slot.label.setText(`${baseLabel}\n${progressText}`)
    }
  }

  /**
   * Open mini MP3 player for level track
   * Shows unlocked track if earned, or locked state if not
   */
  openTrackPlayer(slot) {
    const selectedLevel = this.levelButtons[this.selectedLevelIndex]
    if (!selectedLevel) return

    const levelId = selectedLevel.levelId
    const progress = PlayerProgressManager.getLevelProgress(levelId)
    const isTrackUnlocked = progress?.allFragmentsCollected === true

    // Get track info from level data
    const levelData = LevelDataManager.getLevel(levelId)
    const trackInfo = levelData?.settings?.trackInfo
    
    // Check for assigned track from SupabaseMusicManager
    let trackToPlay = null
    if (SupabaseMusicManager.isInitialized) {
      trackToPlay = SupabaseMusicManager.getLevelAssignment(levelId)?.track
    }
    
    // Fallback to trackInfo if no Supabase assignment
    if (!trackToPlay && trackInfo) {
      trackToPlay = {
        name: trackInfo.title || `Track for ${levelId}`,
        artist: trackInfo.artist || "The Diminished Chord",
        fileUrl: trackInfo.audioUrl
      }
    }

    this.showMiniMp3Player(isTrackUnlocked, trackToPlay)
  }

  /**
   * Show the mini MP3 player overlay
   */
  showMiniMp3Player(isUnlocked, trackInfo) {
    // Close any existing player
    if (this.miniPlayerContainer) {
      this.closeMiniMp3Player()
      return
    }

    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    this.miniPlayerContainer = this.add.container(centerX, centerY)
    this.miniPlayerContainer.setDepth(100)

    // Overlay background
    const overlay = this.add.rectangle(0, 0, 400, 280, 0x0a0a1a, 0.98)
      .setStrokeStyle(3, isUnlocked ? 0xff69b4 : 0x444466)
    this.miniPlayerContainer.add(overlay)

    // Close button
    const closeBtn = this.add.text(180, -120, "✕", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff4444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    closeBtn.on("pointerdown", () => this.closeMiniMp3Player())
    this.miniPlayerContainer.add(closeBtn)

    if (isUnlocked && trackInfo) {
      // Title
      const title = this.add.text(0, -95, "🎵 TRACK UNLOCKED", {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#ff69b4"
      }).setOrigin(0.5)
      this.miniPlayerContainer.add(title)

      // Track name
      const trackName = this.add.text(0, -60, `"${trackInfo.name || "Level Track"}"`, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ffffff"
      }).setOrigin(0.5)
      this.miniPlayerContainer.add(trackName)

      // Artist
      const artist = this.add.text(0, -35, `by ${trackInfo.artist || "The Diminished Chord"}`, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#888888"
      }).setOrigin(0.5)
      this.miniPlayerContainer.add(artist)

      // Player controls
      const hasAudio = trackInfo.fileUrl
      
      // Play/Pause button
      this.miniPlayerIsPlaying = false
      const playBtn = this.add.rectangle(0, 20, 80, 50, 0xff69b4, 0.9)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true })
      this.miniPlayerContainer.add(playBtn)

      const playText = this.add.text(0, 20, hasAudio ? "▶" : "—", {
        fontFamily: "RetroPixel",
        fontSize: "24px",
        color: "#ffffff"
      }).setOrigin(0.5)
      this.miniPlayerContainer.add(playText)

      if (hasAudio) {
        playBtn.on("pointerdown", () => {
          if (this.miniPlayerIsPlaying) {
            this.pauseMiniPlayer()
            playText.setText("▶")
          } else {
            this.playMiniPlayer(trackInfo)
            playText.setText("⏸")
          }
        })

        // Stop/Restart button
        const stopBtn = this.add.rectangle(60, 20, 40, 40, 0x444444)
          .setStrokeStyle(1, 0x666666)
          .setInteractive({ useHandCursor: true })
        const stopText = this.add.text(60, 20, "◼", {
          fontFamily: "RetroPixel",
          fontSize: "16px",
          color: "#ff4444"
        }).setOrigin(0.5)
        stopBtn.on("pointerdown", () => {
          this.stopMiniPlayer()
          playText.setText("▶")
        })
        this.miniPlayerContainer.add([stopBtn, stopText])

        // Restart button
        const restartBtn = this.add.rectangle(-60, 20, 40, 40, 0x444444)
          .setStrokeStyle(1, 0x666666)
          .setInteractive({ useHandCursor: true })
        const restartText = this.add.text(-60, 20, "⟲", {
          fontFamily: "RetroPixel",
          fontSize: "16px",
          color: "#00ffff"
        }).setOrigin(0.5)
        restartBtn.on("pointerdown", () => {
          this.restartMiniPlayer(trackInfo)
          playText.setText("⏸")
        })
        this.miniPlayerContainer.add([restartBtn, restartText])
      } else {
        const noAudioText = this.add.text(0, 70, "No audio file available", {
          fontFamily: "RetroPixel",
          fontSize: "10px",
          color: "#666666"
        }).setOrigin(0.5)
        this.miniPlayerContainer.add(noAudioText)
      }

      // Status text
      this.miniPlayerStatus = this.add.text(0, 85, "Click to listen", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#666666"
      }).setOrigin(0.5)
      this.miniPlayerContainer.add(this.miniPlayerStatus)

    } else {
      // Locked state
      const lockIcon = this.add.text(0, -40, "🔒", {
        fontSize: "40px"
      }).setOrigin(0.5)
      this.miniPlayerContainer.add(lockIcon)

      const lockTitle = this.add.text(0, 20, "TRACK LOCKED", {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#666666"
      }).setOrigin(0.5)
      this.miniPlayerContainer.add(lockTitle)

      const lockHint = this.add.text(0, 55, "Collect all level fragments\nto unlock this track", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#555555",
        align: "center"
      }).setOrigin(0.5)
      this.miniPlayerContainer.add(lockHint)
    }

    // ESC to close
    this.miniPlayerEscKey = this.input.keyboard.addKey("ESC")
    this.miniPlayerEscKey.once("down", () => this.closeMiniMp3Player())
  }

  /**
   * Play track in mini player, pausing world music
   */
  playMiniPlayer(trackInfo) {
    if (!trackInfo.fileUrl) return
    
    // Pause current background music with fade
    BGMManager.duckVolume(0.1)
    
    // Play the track
    BGMManager.playMusic(this, `mini_player_${trackInfo.name}`, trackInfo.fileUrl, true)
    this.miniPlayerIsPlaying = true
    
    if (this.miniPlayerStatus) {
      this.miniPlayerStatus.setText("Now Playing...")
    }
  }

  /**
   * Pause mini player
   */
  pauseMiniPlayer() {
    BGMManager.pause()
    this.miniPlayerIsPlaying = false
    
    if (this.miniPlayerStatus) {
      this.miniPlayerStatus.setText("Paused")
    }
  }

  /**
   * Stop mini player
   */
  stopMiniPlayer() {
    BGMManager.stop()
    this.miniPlayerIsPlaying = false
    
    if (this.miniPlayerStatus) {
      this.miniPlayerStatus.setText("Stopped")
    }
  }

  /**
   * Restart track from beginning
   */
  restartMiniPlayer(trackInfo) {
    this.stopMiniPlayer()
    this.playMiniPlayer(trackInfo)
  }

  /**
   * Close mini MP3 player and restore world music
   */
  closeMiniMp3Player() {
    // Stop any playing track
    if (this.miniPlayerIsPlaying) {
      this.stopMiniPlayer()
    }
    
    // Destroy container
    if (this.miniPlayerContainer) {
      this.miniPlayerContainer.destroy()
      this.miniPlayerContainer = null
    }
    
    // Remove ESC key listener
    if (this.miniPlayerEscKey) {
      this.miniPlayerEscKey.destroy()
      this.miniPlayerEscKey = null
    }
    
    // Restore world music with fade in
    BGMManager.unduckVolume()
    
    // Restart world music if it was stopped
    this.time.delayedCall(300, () => {
      const worldTrack = SupabaseMusicManager.getLevelAssignment(`world_${this.worldNum}`)
      if (worldTrack?.track?.fileUrl) {
        BGMManager.playMusic(this, `world_${this.worldNum}_bgm`, worldTrack.track.fileUrl, true)
      }
    })
  }

  createNavigation() {
    const { width, height } = this.cameras.main
    const accentColor = Phaser.Display.Color.IntegerToColor(this.themeColors.accent).rgba

    // Back to world select
    this.backBtn = this.add.text(30, height - 25, "< WORLD MAP", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    })
    this.backBtn.setInteractive({ useHandCursor: true })
    this.backBtn.on("pointerover", () => { if (this.navFocusState !== "back") this.backBtn.setColor(accentColor) })
    this.backBtn.on("pointerout", () => { if (this.navFocusState !== "back") this.backBtn.setColor("#666666") })
    this.backBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("UniverseSelectScene")
    })

    // Watch Cutscene button (only if cutscene is available)
    this.cutsceneBtn = null
    const sceneKey = CutsceneFlowManager.getWorldIntroSceneKey(this.worldNum)
    if (sceneKey) {
      this.cutsceneBtn = this.add.text(width - 30, height - 25, "WATCH CUTSCENE >", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#666666"
      }).setOrigin(1, 0)
      this.cutsceneBtn.setInteractive({ useHandCursor: true })
      this.cutsceneBtn.on("pointerover", () => { if (this.navFocusState !== "cutscene") this.cutsceneBtn.setColor("#ff69b4") })
      this.cutsceneBtn.on("pointerout", () => { if (this.navFocusState !== "cutscene") this.cutsceneBtn.setColor("#666666") })
      this.cutsceneBtn.on("pointerdown", () => {
        this.playCutscene()
      })
    }

    // Controller nav focus state (null = level nodes, "back" = back btn, "cutscene" = cutscene btn)
    this.navFocusState = null
  }

  setNavButtonFocus(type) {
    this.clearNavButtonFocus()
    this.navFocusState = type
    const accentColor = Phaser.Display.Color.IntegerToColor(this.themeColors.accent).rgba
    if (type === "back" && this.backBtn) {
      this.backBtn.setColor(accentColor)
    } else if (type === "cutscene" && this.cutsceneBtn) {
      this.cutsceneBtn.setColor("#ff69b4")
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
  }

  clearNavButtonFocus() {
    if (this.navFocusState === "back" && this.backBtn) {
      this.backBtn.setColor("#666666")
    } else if (this.navFocusState === "cutscene" && this.cutsceneBtn) {
      this.cutsceneBtn.setColor("#666666")
    }
    this.navFocusState = null
  }

  playCutscene() {
    const sceneKey = CutsceneFlowManager.getWorldIntroSceneKey(this.worldNum)
    if (!sceneKey) return

    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    BGMManager.stop()

    // Fade out and start cutscene
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(300, () => {
      this.scene.start(sceneKey, {
        returnScene: "WorldLevelSelectScene",
        returnData: { worldNum: this.worldNum, skipIntroCutscene: true }
      })
    })
  }

  setupInput() {
    // Arrow key navigation - intuitive directional controls
    // The arrow key direction matches the visual direction of travel
    this.input.keyboard.on("keydown-LEFT", () => this.navigateDirection("left"))
    this.input.keyboard.on("keydown-RIGHT", () => this.navigateDirection("right"))
    this.input.keyboard.on("keydown-UP", () => this.navigateDirection("up"))
    this.input.keyboard.on("keydown-DOWN", () => this.navigateDirection("down"))

    // Select
    this.input.keyboard.on("keydown-ENTER", () => this.selectCurrentLevel())
    this.input.keyboard.on("keydown-SPACE", () => this.selectCurrentLevel())

    // ESC still navigates directly back (standard escape behavior)
    this.input.keyboard.on("keydown-ESC", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("UniverseSelectScene")
    })

    // "/" key (L shoulder button) moves the cursor/focus TO the back button — press Enter to confirm
    this.input.keyboard.on("keydown-FORWARD_SLASH", () => {
      this.setNavButtonFocus("back")
    })

    // "Q" key (R shoulder button) moves the cursor/focus TO the cutscene button — press Enter to confirm
    this.input.keyboard.on("keydown-Q", () => {
      if (this.cutsceneBtn) this.setNavButtonFocus("cutscene")
    })
  }

  /**
   * Navigate based on visual direction - arrow keys match the direction of travel
   * This is more intuitive than abstract "next/previous" navigation
   * @param {string} direction - "left", "right", "up", or "down"
   */
  navigateDirection(direction) {
    // If a nav button is focused, let vertical or opposing direction return to level grid
    if (this.navFocusState === "back") {
      if (direction === "right" || direction === "up" || direction === "down") {
        this.clearNavButtonFocus()
      }
      return
    }
    if (this.navFocusState === "cutscene") {
      if (direction === "left" || direction === "up" || direction === "down") {
        this.clearNavButtonFocus()
      }
      return
    }

    const currentPos = this.levelPositions[this.selectedLevelIndex]
    if (!currentPos) return

    let bestIndex = -1
    let bestScore = Infinity

    for (let i = 0; i < this.levelButtons.length; i++) {
      if (i === this.selectedLevelIndex) continue
      if (!this.levelButtons[i].isUnlocked) continue

      const pos = this.levelPositions[i]
      const dx = pos.x - currentPos.x
      const dy = pos.y - currentPos.y

      // Check if this level is in the requested direction
      let isValidDirection = false
      let score = Infinity

      switch (direction) {
        case "left":
          if (dx < -20) { // Must be significantly to the left
            isValidDirection = true
            // Prefer levels that are more directly left (less vertical offset)
            score = Math.abs(dx) + Math.abs(dy) * 2
          }
          break
        case "right":
          if (dx > 20) { // Must be significantly to the right
            isValidDirection = true
            score = Math.abs(dx) + Math.abs(dy) * 2
          }
          break
        case "up":
          if (dy < -20) { // Must be significantly above
            isValidDirection = true
            // Prefer levels that are more directly above
            score = Math.abs(dy) + Math.abs(dx) * 2
          }
          break
        case "down":
          if (dy > 20) { // Must be significantly below
            isValidDirection = true
            score = Math.abs(dy) + Math.abs(dx) * 2
          }
          break
      }

      if (isValidDirection && score < bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    if (bestIndex !== -1) {
      this.selectedLevelIndex = bestIndex
      this.updateSelection()
      this.moveTeddyToLevel(bestIndex)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    } else {
      // Hit the edge - focus the relevant nav button so d-pad always reaches navigation
      if (direction === "left") {
        this.setNavButtonFocus("back")
      } else if (direction === "right" && this.cutsceneBtn) {
        this.setNavButtonFocus("cutscene")
      }
    }
  }

  /**
   * Legacy method for simple horizontal navigation (kept for compatibility)
   */
  navigateLevel(delta) {
    this.navigateDirection(delta > 0 ? "right" : "left")
  }

  /**
   * Legacy method for simple vertical navigation (kept for compatibility)
   */
  navigateLevelVertical(delta) {
    this.navigateDirection(delta > 0 ? "down" : "up")
  }

  findFirstUnlockedIndex() {
    // Priority 1 (session memory): Return to the last level played this session
    const sessionKey = `lastLevelIndex_W${this.worldNum}`
    const lastPlayedRaw = sessionStorage.getItem(sessionKey)
    if (lastPlayedRaw !== null) {
      const lastPlayed = parseInt(lastPlayedRaw, 10)
      if (!isNaN(lastPlayed) && this.levelButtons[lastPlayed] && this.levelButtons[lastPlayed].isUnlocked) {
        return lastPlayed
      }
    }

    // Priority 2 (new session): Start at the first level of this world (index 0)
    if (this.levelButtons[0] && this.levelButtons[0].isUnlocked) {
      return 0
    }

    // Fallback: first unlocked level by progression
    for (let i = 0; i < this.levelButtons.length; i++) {
      if (this.levelButtons[i] && this.levelButtons[i].isUnlocked) {
        return i
      }
    }

    return 0
  }

  updateSelection() {
    // Update node visuals
    this.levelButtons.forEach((button, index) => {
      const isSelected = index === this.selectedLevelIndex
      
      if (button.isUnlocked) {
        const borderColor = button.isCompleted ? this.themeColors.accent : 
          (button.isBoss ? 0xff4444 : 0x666688)
        button.bg.setStrokeStyle(isSelected ? 4 : (button.isCompleted ? 3 : 2), 
          isSelected ? 0xffffff : borderColor)
        button.setScale(isSelected ? 1.1 : 1)
      }
    })

    // Update info panel
    const selected = this.levelButtons[this.selectedLevelIndex]
    if (selected) {
      // Try to get custom name from LevelDataManager
      const levelData = LevelDataManager.getLevel(selected.levelId)
      const hasCustomName = levelData?.metadata?.name && 
          levelData.metadata.name !== selected.levelId && 
          !levelData.metadata.name.startsWith("W") &&
          !levelData.metadata.name.includes(" - Stage ");

      if (hasCustomName) {
        // Use custom name from Level Designer
        this.infoLevelName.setText(levelData.metadata.name.toUpperCase())
        this.infoLevelType.setText(levelData.metadata.description || 
          (selected.isCompleted ? "✓ Completed" : "Ready to play"))
      } else if (selected.isBoss) {
        this.infoLevelName.setText(`BOSS: ${this.world.bossName}`)
        this.infoLevelType.setText("Defeat the boss to complete this world!")
      } else if (selected.levelType === LEVEL_TYPES.BONUS) {
        const bonusNum = this.selectedLevelIndex - 13 // Bonus starts at index 14
        this.infoLevelName.setText(`BONUS LEVEL ${bonusNum}`)
        this.infoLevelType.setText(selected.bonusPurpose || "Special challenge level")
      } else {
        const levelNum = this.selectedLevelIndex + 1
        this.infoLevelName.setText(`LEVEL ${levelNum}`)
        this.infoLevelType.setText(selected.isCompleted ? "✓ Completed" : "Ready to play")
      }

      // Update trophy dashboard with level stats (async)
      this.updateTrophyDashboard(selected.levelId, levelData)
    }
  }

  /**
   * Update the trophy dashboard with level completion stats
   */
  async updateTrophyDashboard(levelId, levelData) {
    // Get player progress for this level
    const progress = PlayerProgressManager.getLevelProgress(levelId)
    
    // Get level settings for speed run target times
    const speedRunAnyTargetMs = levelData?.settings?.speedRunAnyTargetMs || levelData?.speed_run_any_target_ms || null
    const speedRun100TargetMs = levelData?.settings?.speedRun100TargetMs || levelData?.speed_run_100_target_ms || null
    const totalFragments = levelData?.fragments?.length || progress?.totalFragments || 0
    
    // Collectibles trophy
    // Use bestFragmentsCollected (best single-run count) not cumulative
    // fragmentsCollected may be a number or array for backwards compatibility
    let fragmentsCollected = progress?.bestFragmentsCollected 
      || (typeof progress?.fragmentsCollected === 'number' ? progress.fragmentsCollected : 0)
      || (Array.isArray(progress?.fragmentsCollected) ? progress.fragmentsCollected.length : 0)
    
    // Clamp fragmentsCollected to totalFragments (level may have been modified)
    if (totalFragments > 0 && fragmentsCollected > totalFragments) {
      fragmentsCollected = totalFragments
    }
    
    const allFragmentsCollected = progress?.allFragmentsCollected || false
    const hasPartialFragments = fragmentsCollected > 0 && !allFragmentsCollected
    
    this.updateTrophySlot(
      this.collectibleTrophy, 
      allFragmentsCollected, 
      hasPartialFragments,
      totalFragments > 0 ? `${fragmentsCollected}/${totalFragments}` : ""
    )
    
    // Hole-in-One trophy (0 deaths)
    const bestDeaths = progress?.bestDeaths
    const holeInOne = bestDeaths === 0
    const hasAttempted = bestDeaths !== null && bestDeaths !== undefined
    
    this.updateTrophySlot(
      this.holeInOneTrophy, 
      holeInOne, 
      hasAttempted && !holeInOne,
      hasAttempted ? `Best: ${bestDeaths}` : ""
    )
    
    // Any% Speed Run trophy
    const bestTime = progress?.bestTimeMs
    const hasTime = bestTime !== null && bestTime !== undefined
    const beatAnyTarget = hasTime && speedRunAnyTargetMs && bestTime <= speedRunAnyTargetMs
    
    let anyTimeText = ""
    if (speedRunAnyTargetMs) {
      anyTimeText = this.formatTimeShort(speedRunAnyTargetMs)
    }
    
    this.updateTrophySlot(
      this.speedRunAnyTrophy, 
      beatAnyTarget, 
      hasTime && !beatAnyTarget,
      anyTimeText ? `< ${anyTimeText}` : ""
    )
    
    // 100% Speed Run trophy
    const beat100Target = hasTime && allFragmentsCollected && speedRun100TargetMs && bestTime <= speedRun100TargetMs
    
    let fullTimeText = ""
    if (speedRun100TargetMs) {
      fullTimeText = this.formatTimeShort(speedRun100TargetMs)
    }
    
    this.updateTrophySlot(
      this.speedRun100Trophy, 
      beat100Target, 
      hasTime && allFragmentsCollected && !beat100Target,
      fullTimeText ? `< ${fullTimeText}` : ""
    )
    
    // Update stats text
    if (progress?.isCompleted) {
      const completions = progress.completionCount || 1
      this.statsText.setText(`Completed ${completions}x • First: ${this.formatDate(progress.firstCompletedAt)}`)
    } else {
      this.statsText.setText("Not yet completed")
    }
    
    // Update personal best
    if (hasTime) {
      this.personalBestText.setText(`Your Best: ${this.formatTimeFull(bestTime)}`)
    } else {
      this.personalBestText.setText("Your Best: --:--.---")
    }
    
    // Fetch and display leaderboard
    await this.updateLeaderboardDisplay(levelId)
  }

  /**
   * Update leaderboard display with top 3 times
   */
  async updateLeaderboardDisplay(levelId) {
    try {
      // Import LeaderboardManager if needed
      const { LeaderboardManager } = await import("./LeaderboardManager.js")
      await LeaderboardManager.waitForReady()
      
      // Get top 3 times (default to Any% category)
      const topTimes = await LeaderboardManager.getLeaderboard(levelId, 3, 'any')
      
      // Update display
      for (let i = 0; i < 3; i++) {
        const entry = this.leaderboardEntries[i]
        const leaderEntry = topTimes[i]
        
        if (leaderEntry) {
          const displayName = leaderEntry.displayName || leaderEntry.username || "Anonymous"
          // Expanded layout allows longer names (up to 18 characters)
          const shortName = displayName.length > 18 ? displayName.substring(0, 18) + "..." : displayName
          entry.name.setText(shortName)
          entry.name.setColor("#ffffff")
          entry.time.setText(this.formatTimeFull(leaderEntry.timeMs))
          entry.time.setColor("#00ff88")
        } else {
          entry.name.setText("---")
          entry.name.setColor("#444444")
          entry.time.setText("--:--.---")
          entry.time.setColor("#444444")
        }
      }
    } catch (e) {
      console.warn("[WorldLevelSelect] Leaderboard fetch error:", e)
      // Reset to placeholder state
      for (let i = 0; i < 3; i++) {
        const entry = this.leaderboardEntries[i]
        entry.name.setText("---")
        entry.name.setColor("#444444")
        entry.time.setText("--:--.---")
        entry.time.setColor("#444444")
      }
    }
  }

  /**
   * Format time in milliseconds to short display (e.g., "45.5s" or "1:30")
   */
  formatTimeShort(timeMs) {
    if (!timeMs) return ""
    const totalSeconds = timeMs / 1000
    if (totalSeconds < 60) {
      return `${totalSeconds.toFixed(1)}s`
    }
    const mins = Math.floor(totalSeconds / 60)
    const secs = Math.floor(totalSeconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  /**
   * Format time in milliseconds to full display (e.g., "00:45.500")
   */
  formatTimeFull(timeMs) {
    if (!timeMs) return "--:--.---"
    const minutes = Math.floor(timeMs / 60000)
    const seconds = Math.floor((timeMs % 60000) / 1000)
    const ms = timeMs % 1000
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

  /**
   * Format date for display
   */
  formatDate(isoString) {
    if (!isoString) return "—"
    const date = new Date(isoString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  selectCurrentLevel() {
    // If a nav button is focused, activate it instead
    if (this.navFocusState === "back") {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("UniverseSelectScene")
      return
    }
    if (this.navFocusState === "cutscene") {
      this.playCutscene()
      return
    }
    const selected = this.levelButtons[this.selectedLevelIndex]
    if (selected && selected.isUnlocked) {
      this.selectLevel(selected)
    }
  }

  selectLevel(levelButton) {
    if (!levelButton.isUnlocked) return

    this.sound.play("ui_confirm_sound", { volume: 0.3 })

    // Remember which level was last played in this world (session memory)
    const currentIndex = this.levelButtons.indexOf(levelButton)
    if (currentIndex !== -1) {
      sessionStorage.setItem(`lastLevelIndex_W${this.worldNum}`, String(currentIndex))
    }

    // Fade out and start level
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(300, () => {
      const sceneKey = getLevelSceneKey(levelButton.levelId)
      console.log(`Starting level: ${sceneKey} (${levelButton.levelId})`)
      this.scene.start(sceneKey, { levelId: levelButton.levelId })
    })
  }
}
