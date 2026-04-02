import Phaser from "phaser"
import { BGMManager } from "./BGMManager.js"
import { LevelDataManager } from "./LevelDataManager.js"
import { PlatformRenderer } from "./PlatformRenderer.js"
import { levelConfig } from "./gameConfig.json"

/**
 * GhostReplayScene - Replays ALL attempts simultaneously
 * 
 * Shows every death run and the successful run starting at the same time.
 * Failed ghosts fade out at their death points, leaving only the winner.
 * Creates an entertaining "battle royale" style replay visualization.
 */
export class GhostReplayScene extends Phaser.Scene {
  constructor() {
    super({ key: "GhostReplayScene" })
  }

  init(data) {
    this.levelId = data.levelId || "Tutorial"
    this.deathReplays = data.deathReplays || [] // Array of failed attempt position data
    this.successfulRun = data.successfulRun || [] // The winning run's positions
    this.completionTimeMs = data.completionTimeMs || 0
    this.returnScene = data.returnScene || "VictoryUIScene"
    this.returnData = data.returnData || {}
  }

  create() {
    this.tileSize = levelConfig.tileSize.value

    // Get level data to recreate the level visuals
    const rawLevelData = LevelDataManager.getLevel(this.levelId)
    this.levelData = rawLevelData ? this.normalizeLevelData(rawLevelData) : this.getDefaultLevelData()

    // Set up map dimensions
    this.mapWidth = this.levelData.mapWidth
    this.mapHeight = this.levelData.mapHeight

    // Create platform renderer
    this.platformRenderer = new PlatformRenderer(this, this.tileSize)

    // Create the level visuals (background, platforms)
    this.createBackground()
    this.createPlatforms()

    // Create ghost sprites for all attempts
    this.ghosts = []
    this.createGhosts()

    // Check if we have any ghost data to replay
    if (this.ghosts.length === 0) {
      console.warn("[GhostReplayScene] No ghost data to replay!")
      this.showNoDataMessage()
      return
    }

    // Setup camera
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight)
    
    // Follow the successful run ghost if it exists
    if (this.successfulGhost) {
      this.cameras.main.startFollow(this.successfulGhost, true, 0.1, 0.1)
    }

    // Create UI overlay
    this.createUI()

    // Setup input
    this.setupInput()

    // Start playback
    this.playbackStartTime = this.time.now
    this.isPlaying = true
    this.playbackSpeed = 1.0
    this.isPaused = false

    // Play level music at reduced volume
    BGMManager.playLevelMusic(this, this.levelId)
    BGMManager.duckVolume()
  }

  /**
   * Show a message when there's no ghost data to replay
   */
  showNoDataMessage() {
    const { width, height } = this.cameras.main

    const container = this.add.container(width / 2, height / 2)
      .setScrollFactor(0)
      .setDepth(300)

    const bg = this.add.rectangle(0, 0, 400, 180, 0x0a0a1a, 0.95)
      .setStrokeStyle(3, 0xff6666)

    const title = this.add.text(0, -50, "⚠️ NO GHOST DATA", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff6666"
    }).setOrigin(0.5)

    const message = this.add.text(0, 0, "Ghost replay data was not recorded\nfor this run. This can happen if the\nlevel was completed very quickly.", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#aaaaaa",
      align: "center"
    }).setOrigin(0.5)

    const exitHint = this.add.text(0, 55, "Press any key to return", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)

    container.add([bg, title, message, exitHint])

    // Allow exit with any key or click
    this.input.keyboard.once("keydown", () => this.exitReplay())
    this.input.once("pointerdown", () => this.exitReplay())
  }

  normalizeLevelData(rawData) {
    if (rawData.settings) {
      return {
        mapWidth: rawData.settings.width || 1920,
        mapHeight: rawData.settings.height || 768,
        platforms: (rawData.platforms || []).map(p => ({
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height || 32
        })),
        spawnPoint: rawData.spawn || { x: 100, y: 600 },
        styleWorld: rawData.styleWorld || null
      }
    }
    return {
      mapWidth: (rawData.mapWidth || 30) * this.tileSize,
      mapHeight: (rawData.mapHeight || 12) * this.tileSize,
      platforms: rawData.platforms || [],
      spawnPoint: rawData.spawnPoint || { x: 100, y: 600 },
      styleWorld: null
    }
  }

  getDefaultLevelData() {
    return {
      mapWidth: 1920,
      mapHeight: 768,
      platforms: [],
      spawnPoint: { x: 100, y: 600 },
      styleWorld: null
    }
  }

  createBackground() {
    // Dark background
    this.add.rectangle(0, 0, this.mapWidth, this.mapHeight, 0x0a0a1a)
      .setOrigin(0, 0)
      .setDepth(-10)

    // Try to load world-specific background
    const bgKey = this.getBackgroundKey()
    if (this.textures.exists(bgKey)) {
      const bg = this.add.image(0, this.mapHeight, bgKey)
        .setOrigin(0, 1)
        .setDepth(-5)
      
      // Scale to fit map height
      const scale = this.mapHeight / bg.height
      bg.setScale(scale)
      
      // Tile if needed
      if (bg.displayWidth < this.mapWidth) {
        const numTiles = Math.ceil(this.mapWidth / bg.displayWidth)
        for (let i = 1; i < numTiles; i++) {
          const bgTile = this.add.image(bg.displayWidth * i, this.mapHeight, bgKey)
            .setOrigin(0, 1)
            .setScale(scale)
            .setDepth(-5)
        }
      }
      
      // Apply ghost replay tint (darker, more dramatic)
      bg.setTint(0x666688)
    }
  }

  getBackgroundKey() {
    // Try to determine background from level ID
    const worldNum = this.extractWorldNum(this.levelId)
    const bgKeys = [
      "metroid_cavern_background",
      "detroit_winter_background",
      "world2_berlin_background",
      "world3_tokyo_background",
      "world4_london_background",
      "world5_festival_background",
      "world6_reykjavik_background",
      "world7_la_background",
      "world8_sydney_background",
      "world9_nyc_background",
      "world10_contract_trap_background",
      "world11_doubt_background",
      "world12_time_fracture_background",
      "world13_noise_collapse_background",
      "world14_clarity_background",
      "world15_diminished_chord_background"
    ]
    return bgKeys[worldNum] || bgKeys[0]
  }

  extractWorldNum(levelId) {
    const match = levelId.match(/W(\d+)/)
    return match ? parseInt(match[1]) - 1 : 0
  }

  createPlatforms() {
    this.platforms = this.add.group()

    // Render platforms
    this.levelData.platforms.forEach(platform => {
      const rendered = this.platformRenderer.createPlatform(
        platform.x,
        platform.y,
        platform.width,
        platform.height,
        { styleWorld: this.levelData.styleWorld || 1 }
      )
      if (rendered) {
        rendered.setDepth(0)
      }
    })
  }

  createGhosts() {
    const spawnX = this.levelData.spawnPoint.x
    const spawnY = this.levelData.spawnPoint.y

    // Calculate character scale
    const standardHeight = 1.5 * 64
    this.characterScale = standardHeight / 560

    // Create ghosts for each death replay
    this.deathReplays.forEach((replay, index) => {
      const ghost = this.createGhostSprite(spawnX, spawnY, index, false)
      ghost.positionData = this.decompressPositions(replay.positions || replay)
      ghost.deathTime = replay.deathTime || (ghost.positionData.length > 0 ? 
        ghost.positionData[ghost.positionData.length - 1].t : 0)
      ghost.isDead = false
      ghost.isWinner = false
      this.ghosts.push(ghost)
    })

    // Create the successful run ghost (the winner!)
    // successfulRun can be: 
    //   - an object with { positions: [...] } 
    //   - or an array directly [...] 
    const successPositions = this.successfulRun?.positions || this.successfulRun
    if (successPositions && successPositions.length > 0) {
      const winnerGhost = this.createGhostSprite(spawnX, spawnY, -1, true)
      winnerGhost.positionData = this.decompressPositions(successPositions)
      winnerGhost.isDead = false
      winnerGhost.isWinner = true
      this.ghosts.push(winnerGhost)
      this.successfulGhost = winnerGhost
    }

    // Update ghost count display
    this.totalGhosts = this.ghosts.length
    this.activeGhosts = this.totalGhosts
  }

  createGhostSprite(x, y, index, isWinner) {
    const ghost = this.add.sprite(x, y, "teddy_idle_frame1")
    ghost.setScale(this.characterScale)
    ghost.setOrigin(0.5, 1)
    ghost.setDepth(isWinner ? 20 : 10)
    
    // Winner is solid, deaths are semi-transparent with varying tints
    if (isWinner) {
      ghost.setAlpha(1)
      ghost.setTint(0xffffff) // Full color for winner
    } else {
      ghost.setAlpha(0.5)
      // Give each ghost a slightly different tint for visual variety
      const hue = (index * 0.618033988749895) % 1 // Golden ratio for good distribution
      const tint = Phaser.Display.Color.HSLToColor(hue, 0.6, 0.7).color
      ghost.setTint(tint)
    }

    ghost.playbackIndex = 0
    ghost.lastAnim = null

    return ghost
  }

  /**
   * Decompress position data from storage format
   * Handles both compressed (delta) and raw formats
   */
  decompressPositions(data) {
    if (!data || data.length === 0) return []

    // Check if data is already in raw format (has x, y directly)
    if (data[0] && data[0].x !== undefined && data[0].dx === undefined) {
      return data
    }

    // Decompress delta-encoded data
    const positions = [data[0]]
    let lastAnim = data[0].a
    let lastFlip = data[0].f

    for (let i = 1; i < data.length; i++) {
      const delta = data[i]
      const prev = positions[i - 1]

      if (delta.a !== undefined) lastAnim = delta.a
      if (delta.f !== undefined) lastFlip = delta.f

      positions.push({
        t: delta.t,
        x: delta.dx !== undefined ? prev.x + delta.dx / 10 : delta.x,
        y: delta.dy !== undefined ? prev.y + delta.dy / 10 : delta.y,
        a: lastAnim,
        f: lastFlip
      })
    }

    return positions
  }

  createUI() {
    const { width, height } = this.cameras.main

    // Top bar
    this.add.rectangle(width / 2, 25, width, 50, 0x000000, 0.7)
      .setScrollFactor(0)
      .setDepth(100)

    // Title
    this.add.text(width / 2, 15, "👻 GHOST REPLAY", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff69b4"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    // Ghost count
    this.ghostCountText = this.add.text(width / 2, 38, `${this.totalGhosts || 0} ghosts remaining`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#aaaaaa"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    // Time display
    this.timeText = this.add.text(width - 20, 25, "0.000s", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ff88"
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(101)

    // Speed display
    this.speedText = this.add.text(20, 25, "1.0x", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffaa00"
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101)

    // Controls hint
    this.add.text(width / 2, height - 20, "SPACE: Pause | ←/→: Speed | ESC: Exit", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    // Pause overlay (hidden initially)
    this.pauseOverlay = this.add.container(width / 2, height / 2)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false)

    const pauseBg = this.add.rectangle(0, 0, 200, 80, 0x000000, 0.9)
      .setStrokeStyle(2, 0xff69b4)
    const pauseText = this.add.text(0, 0, "⏸ PAUSED", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    this.pauseOverlay.add([pauseBg, pauseText])
  }

  setupInput() {
    // Pause/Resume
    this.input.keyboard.on("keydown-SPACE", () => {
      this.togglePause()
    })

    // Speed controls
    this.input.keyboard.on("keydown-LEFT", () => {
      this.playbackSpeed = Math.max(0.25, this.playbackSpeed - 0.25)
      this.speedText.setText(`${this.playbackSpeed.toFixed(2)}x`)
    })

    this.input.keyboard.on("keydown-RIGHT", () => {
      this.playbackSpeed = Math.min(4, this.playbackSpeed + 0.25)
      this.speedText.setText(`${this.playbackSpeed.toFixed(2)}x`)
    })

    // Exit
    this.input.keyboard.on("keydown-ESC", () => {
      this.exitReplay()
    })

    // Click to pause
    this.input.on("pointerdown", () => {
      this.togglePause()
    })
  }

  togglePause() {
    this.isPaused = !this.isPaused
    this.pauseOverlay.setVisible(this.isPaused)

    if (!this.isPaused) {
      // Adjust start time to account for pause duration
      this.playbackStartTime = this.time.now - (this.currentPlaybackTime / this.playbackSpeed)
    }
  }

  exitReplay() {
    BGMManager.unduckVolume()
    
    // Return to victory screen
    this.scene.start("VictoryUIScene", {
      ...this.returnData,
      currentLevelKey: "DynamicLevelScene",
      levelId: this.levelId
    })
  }

  update(time, delta) {
    if (this.isPaused || !this.isPlaying) return

    // Calculate current playback time
    this.currentPlaybackTime = (time - this.playbackStartTime) * this.playbackSpeed

    // Update time display
    const displayTime = (this.currentPlaybackTime / 1000).toFixed(3)
    this.timeText.setText(`${displayTime}s`)

    // Update each ghost
    let stillActiveCount = 0

    this.ghosts.forEach(ghost => {
      if (!ghost.active || ghost.isDead) return

      const position = this.getGhostPosition(ghost, this.currentPlaybackTime)

      if (position) {
        stillActiveCount++
        
        // Update position
        ghost.setPosition(position.x, position.y)

        // Update animation
        if (position.a && position.a !== ghost.lastAnim) {
          ghost.lastAnim = position.a
          // Try to play the animation if it exists
          if (this.anims.exists(position.a)) {
            ghost.play(position.a, true)
          }
        }

        // Update flip
        if (position.f !== undefined) {
          ghost.setFlipX(position.f === 1)
        }
      } else if (!ghost.isWinner) {
        // Ghost has reached end of its data (death point)
        this.ghostDeath(ghost)
      }
    })

    // Update active ghost count
    if (stillActiveCount !== this.activeGhosts) {
      this.activeGhosts = stillActiveCount
      this.ghostCountText.setText(`${this.activeGhosts} ghost${this.activeGhosts !== 1 ? 's' : ''} remaining`)
    }

    // Check if replay is complete
    // Only complete if we actually had ghosts to begin with
    if (this.totalGhosts > 0 && (
        this.activeGhosts === 0 || 
        (this.successfulGhost && this.successfulGhost.isDead))) {
      this.onReplayComplete()
    }
  }

  getGhostPosition(ghost, playbackTime) {
    const positions = ghost.positionData
    if (!positions || positions.length === 0) return null

    // Find position at current time
    while (
      ghost.playbackIndex < positions.length - 1 &&
      positions[ghost.playbackIndex + 1].t <= playbackTime
    ) {
      ghost.playbackIndex++
    }

    // Check if we've gone past all data
    if (ghost.playbackIndex >= positions.length - 1) {
      const lastPos = positions[positions.length - 1]
      if (playbackTime > lastPos.t + 100) {
        return null // Signal end of data
      }
      return lastPos
    }

    // Interpolate between current and next position for smooth movement
    const current = positions[ghost.playbackIndex]
    const next = positions[ghost.playbackIndex + 1]
    const t = (playbackTime - current.t) / (next.t - current.t)

    return {
      x: Phaser.Math.Linear(current.x, next.x, t),
      y: Phaser.Math.Linear(current.y, next.y, t),
      a: current.a,
      f: current.f
    }
  }

  ghostDeath(ghost) {
    if (ghost.isDead) return
    ghost.isDead = true

    // Play death animation if available
    if (this.anims.exists("teddy_death_anim")) {
      ghost.play("teddy_death_anim")
    }

    // Dramatic fade out
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: ghost.scaleX * 0.5,
      scaleY: ghost.scaleY * 0.5,
      duration: 500,
      ease: "Quad.easeOut",
      onComplete: () => {
        ghost.setVisible(false)
        ghost.setActive(false)
      }
    })

    // Create death particles
    this.createDeathParticles(ghost.x, ghost.y, ghost.tintTopLeft)
  }

  createDeathParticles(x, y, tint) {
    const particles = []
    const numParticles = 8

    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * Math.PI * 2
      const particle = this.add.circle(x, y, 4, tint || 0xff6666)
        .setDepth(15)

      particles.push(particle)

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 50,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0,
        duration: 400,
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy()
      })
    }
  }

  onReplayComplete() {
    if (this.replayCompleted) return
    this.replayCompleted = true

    const { width, height } = this.cameras.main

    // Show completion message
    const completeContainer = this.add.container(width / 2, height / 2)
      .setScrollFactor(0)
      .setDepth(300)

    const bg = this.add.rectangle(0, 0, 350, 150, 0x0a0a1a, 0.95)
      .setStrokeStyle(3, 0x00ff88)

    const title = this.add.text(0, -40, "🏆 REPLAY COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#00ff88"
    }).setOrigin(0.5)

    const statsText = this.add.text(0, 0, 
      `Total attempts: ${this.totalGhosts}\nWinner time: ${(this.completionTimeMs / 1000).toFixed(3)}s`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5)

    const exitHint = this.add.text(0, 45, "Press SPACE or ESC to exit", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)

    completeContainer.add([bg, title, statsText, exitHint])

    // Animate in
    completeContainer.setScale(0)
    this.tweens.add({
      targets: completeContainer,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: "Back.easeOut"
    })

    // Allow exit
    this.input.keyboard.once("keydown-SPACE", () => this.exitReplay())
    this.input.keyboard.once("keydown-ESC", () => this.exitReplay())
    this.input.once("pointerdown", () => this.exitReplay())
  }
}
