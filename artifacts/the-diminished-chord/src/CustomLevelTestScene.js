import Phaser from "phaser"
import { TeddyPlayer } from "./TeddyPlayer.js"
import { MusicFragment, LevelGoal, SpeedRunStopwatch } from "./MusicFragment.js"
import { getMergedControls } from "./MobileControlsScene.js"
import { WorldManager } from "./WorldManager.js"
import { PlatformRenderer } from "./PlatformRenderer.js"
import { BGMManager } from "./BGMManager.js"
import { SupabaseMusicManager } from "./SupabaseMusicManager.js"

/**
 * CustomLevelTestScene - Test custom levels created in the Level Designer
 * Now returns to designer with state preserved
 */
export class CustomLevelTestScene extends Phaser.Scene {
  constructor() {
    super({ key: "CustomLevelTestScene" })
  }

  create() {
    // Get level data from registry
    const levelData = this.registry.get("customLevelData")
    if (!levelData) {
      this.scene.start("LevelDesignerScene")
      return
    }

    // Initialize
    this.tileSize = 64
    this.mapWidth = levelData.mapWidth * this.tileSize
    this.mapHeight = levelData.mapHeight * this.tileSize
    this.gameCompleted = false
    
    // Timer state for speed run
    this.hasStopwatch = false
    this.stopwatch = null
    this.timerStarted = false
    this.startTime = null
    
    // Store level data for style reference
    this.levelData = levelData
    
    // Create unified platform renderer
    this.platformRenderer = new PlatformRenderer(this, this.tileSize)

    // Groups
    this.platforms = this.add.group()
    this.hazards = this.add.group()
    this.fragments = this.add.group()
    this.slowZones = this.add.group()  // For cables that slow player

    // Create background
    this.createBackground()

    // Process level objects
    this.processLevelData(levelData)

    // Set world bounds
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight, true, true, true, false)

    // Camera
    if (this.player) {
      this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight)
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    }

    // Collisions
    this.setupCollisions()

    // Input
    this.cursors = this.input.keyboard.createCursorKeys()
    // Add space for running (B button on mobile)
    this.cursors.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    // Back to designer button
    this.createBackButton()
    
    // Launch mobile controls if on touch device
    this.launchMobileControls()

    // UI
    this.createTestUI()
    
    // Music controls - setup based on levelData settings
    this.setupMusicControls()
  }

  createBackground() {
    // Get world-specific background based on styleWorld setting
    const styleWorld = this.levelData?.styleWorld ?? 1
    const worldBackgrounds = {
      1: "detroit_winter_background",
      2: "world2_berlin_background",
      3: "world3_tokyo_background",
      4: "world4_london_background",
      5: "world5_festival_background",
      6: "world6_reykjavik_background",
      7: "world7_la_background",
      8: "world8_sydney_background",
      9: "world9_nyc_background",
      10: "world10_contract_trap_background",
      11: "world11_doubt_background",
      12: "world12_time_fracture_background",
      13: "world13_noise_collapse_background",
      14: "world14_clarity_background",
      15: "world15_diminished_chord_background"
    }
    
    let bgKey = worldBackgrounds[styleWorld] || "detroit_winter_background"
    
    // Fallback to metroid_cavern if world background doesn't exist
    if (!this.textures.exists(bgKey)) {
      bgKey = "metroid_cavern_background"
    }
    
    if (this.textures.exists(bgKey)) {
      const bg = this.add.image(0, 0, bgKey)
      bg.setOrigin(0, 0)
      const scale = this.mapHeight / bg.height
      bg.setScale(scale)
      bg.setScrollFactor(0.2)
      bg.setDepth(-10)
      
      // Apply brightness/contrast settings from level data
      this.applyBackgroundVisualSettings(bg)
    } else {
      // Fallback: Create a gradient background
      this.cameras.main.setBackgroundColor(0x0a0a15)
      
      // Create atmospheric gradient layers
      const gradientBg = this.add.graphics()
      gradientBg.setScrollFactor(0.1)
      gradientBg.setDepth(-10)
      
      // Dark gradient from top to bottom
      for (let i = 0; i < 20; i++) {
        const alpha = 0.1 - (i * 0.005)
        gradientBg.fillStyle(0x1a2a4a, alpha)
        gradientBg.fillRect(0, i * (this.mapHeight / 20), this.mapWidth * 2, this.mapHeight / 20)
      }
    }
  }
  
  /**
   * Apply brightness/contrast settings to a background image
   * Uses tint to simulate brightness/contrast adjustment
   */
  applyBackgroundVisualSettings(bg) {
    // Get settings from level data (skip if using world settings)
    const useWorldSettings = this.levelData?.useWorldBackgroundSettings ?? true
    
    // If using world settings, don't apply custom brightness/contrast
    // (world settings would be fetched from Supabase in a full implementation)
    if (useWorldSettings) {
      return
    }
    
    const brightness = this.levelData?.backgroundBrightness ?? 1.0
    const contrast = this.levelData?.backgroundContrast ?? 1.0
    
    // Calculate tint color based on brightness
    // brightness 0.0 = 0x000000 (black), brightness 1.0 = 0xFFFFFF (no tint/full brightness)
    const clampedBrightness = Phaser.Math.Clamp(brightness, 0, 1)
    const brightnessInt = Math.round(clampedBrightness * 255)
    
    // Apply as a grey tint (affects all RGB channels equally)
    const tintValue = (brightnessInt << 16) | (brightnessInt << 8) | brightnessInt
    
    // Apply brightness tint (only if not at full brightness)
    if (brightness < 1.0) {
      bg.setTint(tintValue)
    } else {
      bg.clearTint()
    }
    
    // For contrast, use alpha to simulate reduced contrast
    if (contrast < 1.0) {
      // Map contrast 0.0-1.0 to alpha range (0.3-1.0)
      const minAlpha = 0.3
      const alpha = minAlpha + (contrast * (1.0 - minAlpha))
      bg.setAlpha(alpha)
    } else {
      bg.setAlpha(1.0)
    }
  }

  processLevelData(levelData) {
    let spawnX = 2 * this.tileSize
    let spawnY = (levelData.mapHeight - 2) * this.tileSize
    let spawnFacingDirection = "right"  // Default facing direction
    let goalX = (levelData.mapWidth - 2) * this.tileSize
    let goalY = (levelData.mapHeight - 2) * this.tileSize

    levelData.objects.forEach(obj => {
      switch (obj.type) {
        case "platform":
          this.createPlatform(obj)
          break
        case "spike":
          this.createSpikes(obj)
          break
        case "saw":
        case "saw_h":
        case "saw_v":
        case "saw_c":
          this.createSawBlades(obj)
          break
        case "cables":
          this.createCables(obj)
          break
        case "fragment_drums":
        case "fragment_bass":
        case "fragment_guitar":
        case "fragment_keyboard":
        case "fragment_microphone":
        case "fragment_note":
        case "bonus_mixtape":
        case "bonus_cd":
        case "bonus_vinyl":
        case "bonus_waveform":
        case "bonus_recordDeal":
        case "demo_fragment":
          this.createFragment(obj)
          break
        case "spawn":
          spawnX = (obj.x + 0.5) * this.tileSize
          spawnY = (obj.y + 1) * this.tileSize
          spawnFacingDirection = obj.facingDirection || "right"
          break
        case "goal":
          goalX = (obj.x + 0.5) * this.tileSize
          goalY = (obj.y + 1) * this.tileSize
          break
        case "stopwatch":
          this.createStopwatch(obj)
          break
      }
    })

    // Check if we have a shifted spawn point from a previous test session
    const shiftedSpawn = this.registry.get("shiftedSpawnPoint")
    
    // Use shifted spawn if available, otherwise use level's original spawn
    const effectiveSpawnX = shiftedSpawn?.x ?? spawnX
    const effectiveSpawnY = shiftedSpawn?.y ?? spawnY
    
    // Check if we have saved player state from a previous test session
    const savedPlayerState = this.registry.get("testPlayerState")
    
    if (savedPlayerState && savedPlayerState.x !== undefined) {
      // Restore player at saved position
      this.player = new TeddyPlayer(this, savedPlayerState.x, savedPlayerState.y)
      
      // Restore velocity after a short delay to let physics initialize
      this.time.delayedCall(50, () => {
        if (this.player && this.player.body) {
          this.player.body.setVelocity(savedPlayerState.velocityX || 0, savedPlayerState.velocityY || 0)
          if (savedPlayerState.facingDirection === "left") {
            this.player.facingDirection = "left"
            this.player.setFlipX(true)
          }
        }
      })
      
      // Store spawn point (use shifted spawn if available)
      this.spawnPoint = { x: effectiveSpawnX, y: effectiveSpawnY }
      // Also store original spawn for reference
      this.originalSpawnPoint = { x: spawnX, y: spawnY }
      
      // Set player's spawn facing direction for respawns
      this.player.spawnFacingDirection = spawnFacingDirection
    } else {
      // Create player at effective spawn (shifted or original)
      this.player = new TeddyPlayer(this, effectiveSpawnX, effectiveSpawnY)
      this.spawnPoint = { x: effectiveSpawnX, y: effectiveSpawnY }
      this.originalSpawnPoint = { x: spawnX, y: spawnY }
      
      // Set initial facing direction from spawn point
      if (spawnFacingDirection === "left") {
        this.player.facingDirection = "left"
        this.player.setFlipX(true)
      }
      
      // Set player's spawn facing direction for respawns
      this.player.spawnFacingDirection = spawnFacingDirection
    }
    
    // Store spawn facing direction for respawns
    this.spawnFacingDirection = spawnFacingDirection

    // Create goal
    this.goal = new LevelGoal(this, goalX, goalY - 32, 64, 64)
  }

  createPlatform(obj) {
    const x = obj.x * this.tileSize
    const y = obj.y * this.tileSize
    const width = obj.width * this.tileSize
    const height = obj.height * this.tileSize

    // Use unified PlatformRenderer - this ensures TEST and GAMEPLAY look IDENTICAL
    // Get style world from level data (set in Level Designer)
    // If styleWorld is null/"auto", default to World 1 for testing (detroit_winter_tileset)
    const styleWorld = this.levelData?.styleWorld ?? 1
    const stylePreset = this.levelData?.stylePreset || "auto"
    
    this.platformRenderer.createPlatform(x, y, width, height, {
      styleWorld,
      stylePreset
    })
    
    // Create collision body as a separate invisible rectangle
    this.platformRenderer.createCollider(x, y, width, height, this.platforms)
  }

  createSpikes(obj) {
    for (let i = 0; i < obj.width; i++) {
      for (let j = 0; j < obj.height; j++) {
        const x = (obj.x + i + 0.5) * this.tileSize
        const y = (obj.y + j + 1) * this.tileSize

        const spike = this.physics.add.image(x, y, "spike_hazard")
        spike.setOrigin(0.5, 1)
        const targetHeight = this.tileSize * 0.5
        spike.setScale(targetHeight / spike.height)
        spike.body.setAllowGravity(false)
        spike.body.setImmovable(true)
        spike.body.setSize(spike.width * 0.6, spike.height * 0.5)
        spike.body.setOffset(spike.width * 0.2, spike.height * 0.5)
        this.hazards.add(spike)
      }
    }
  }

  createSawBlades(obj) {
    for (let i = 0; i < obj.width; i++) {
      for (let j = 0; j < obj.height; j++) {
        const x = (obj.x + i + 0.5) * this.tileSize
        const y = (obj.y + j + 0.5) * this.tileSize

        const saw = this.physics.add.image(x, y, "saw_blade_hazard")
        saw.setOrigin(0.5, 0.5)
        const targetSize = this.tileSize * 0.7
        saw.setScale(targetSize / saw.height)
        saw.body.setAllowGravity(false)
        saw.body.setImmovable(true)
        saw.body.setCircle(saw.width * 0.4)
        saw.body.setOffset(saw.width * 0.1, saw.height * 0.1)

        // Rotation animation
        this.tweens.add({
          targets: saw,
          angle: 360,
          duration: 1000,
          repeat: -1,
          ease: "Linear"
        })

        // Apply movement if specified
        if (obj.movement) {
          this.applySawMovement(saw, x, y, obj.movement)
        }

        this.hazards.add(saw)
      }
    }
  }

  /**
   * Apply movement pattern to a saw blade
   * @param {Phaser.GameObjects.Image} saw - The saw blade sprite
   * @param {number} startX - Starting X position
   * @param {number} startY - Starting Y position  
   * @param {object} movement - Movement configuration
   */
  applySawMovement(saw, startX, startY, movement) {
    const { type, distance, speed, delay } = movement
    const duration = speed || 2000  // Default 2 seconds per cycle
    const moveDistance = (distance || 3) * this.tileSize  // Default 3 tiles
    
    switch (type) {
      case "horizontal":
        this.tweens.add({
          targets: saw,
          x: startX + moveDistance,
          duration: duration,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: delay || 0
        })
        break
        
      case "vertical":
        this.tweens.add({
          targets: saw,
          y: startY + moveDistance,
          duration: duration,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: delay || 0
        })
        break
        
      case "circular":
        // Circular motion using path following
        const radius = moveDistance / 2
        const centerX = startX
        const centerY = startY
        let angle = 0
        
        this.time.addEvent({
          delay: 16,  // ~60fps
          callback: () => {
            angle += (2 * Math.PI) / (duration / 16)
            saw.x = centerX + Math.cos(angle) * radius
            saw.y = centerY + Math.sin(angle) * radius
            // Update physics body position
            saw.body.reset(saw.x, saw.y)
          },
          loop: true
        })
        break
        
      case "diagonal":
        // Diagonal movement (both X and Y)
        this.tweens.add({
          targets: saw,
          x: startX + moveDistance,
          y: startY + moveDistance,
          duration: duration,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: delay || 0
        })
        break
    }
  }

  createFragment(obj) {
    // Convert editor type to MusicFragment type
    let type = obj.type
    if (type.startsWith("fragment_")) {
      type = type.replace("fragment_", "")
    } else if (type.startsWith("bonus_")) {
      type = type.replace("bonus_", "")
    } else if (type === "demo_fragment") {
      type = "demoFragment"
    }
    
    const x = (obj.x + 0.5) * this.tileSize
    const y = (obj.y + 0.5) * this.tileSize
    const fragment = new MusicFragment(this, x, y, type, this.fragments.children.size)
    this.fragments.add(fragment)
  }

  /**
   * Create a metronome for speed run timing
   */
  createStopwatch(obj) {
    const x = (obj.x + 0.5) * this.tileSize
    const y = (obj.y + 0.5) * this.tileSize
    
    this.stopwatch = new SpeedRunStopwatch(this, x, y)
    this.hasStopwatch = true
    this.timerStarted = false
    
    // Listen for metronome collection
    this.events.on("stopwatchCollected", this.onStopwatchCollected, this)
  }
  
  /**
   * Handle metronome collection - starts the speed run timer
   */
  onStopwatchCollected() {
    console.log("[CustomLevelTestScene] Metronome collected - starting speed run timer!")
    this.timerStarted = true
    this.startTime = this.time.now
  }

  setupCollisions() {
    // Player vs platforms
    this.physics.add.collider(this.player, this.platforms)

    // Player vs hazards
    this.physics.add.overlap(
      this.player,
      this.hazards,
      (player) => player.hitHazard(),
      null,
      this
    )

    // Player vs slow zones (cables) - slows player movement
    this.physics.add.overlap(
      this.player,
      this.slowZones,
      (player, zone) => {
        if (!player.inSlowZone) {
          player.inSlowZone = true
          player.originalWalkSpeed = player.walkSpeed
          player.originalRunSpeed = player.runSpeed || player.walkSpeed * 1.5
          player.walkSpeed = player.originalWalkSpeed * 0.4  // 40% speed
          player.runSpeed = player.originalRunSpeed * 0.4
        }
        player.slowZoneTimer = 100  // Reset timer while overlapping
      },
      null,
      this
    )

    // Player vs fragments
    this.physics.add.overlap(
      this.player,
      this.fragments,
      (player, fragment) => fragment.collect(),
      null,
      this
    )

    // Player vs goal
    this.physics.add.overlap(
      this.player,
      this.goal,
      this.onReachGoal,
      null,
      this
    )
    
    // Player vs metronome (if present) - starts speed run timer
    if (this.stopwatch) {
      this.physics.add.overlap(
        this.player,
        this.stopwatch,
        (player, metronome) => {
          if (!metronome.active || metronome.isCollected) return
          metronome.collect()
        },
        null,
        this
      )
    }
  }

  /**
   * Create cables (slow zone) terrain
   */
  createCables(obj) {
    for (let i = 0; i < obj.width; i++) {
      for (let j = 0; j < obj.height; j++) {
        const x = (obj.x + i + 0.5) * this.tileSize
        const y = (obj.y + j + 0.5) * this.tileSize

        // Create visual representation of tangled cables
        const cableContainer = this.add.container(x, y)
        
        // Draw tangled cable mess using graphics
        const graphics = this.add.graphics()
        const cableColor = 0x8844aa
        const highlightColor = 0xaa66cc
        
        // Draw multiple tangled cables using Phaser 3's stroke methods
        graphics.lineStyle(4, cableColor, 0.8)
        
        // Cable 1 - create curved path using spline curve
        const curve1 = new Phaser.Curves.Spline([
          new Phaser.Math.Vector2(-25, -20),
          new Phaser.Math.Vector2(-10, 15),
          new Phaser.Math.Vector2(10, -15),
          new Phaser.Math.Vector2(25, 20)
        ])
        curve1.draw(graphics, 32)
        
        // Cable 2 - different curve
        graphics.lineStyle(3, highlightColor, 0.7)
        const curve2 = new Phaser.Curves.Spline([
          new Phaser.Math.Vector2(-20, 25),
          new Phaser.Math.Vector2(5, -10),
          new Phaser.Math.Vector2(-5, 10),
          new Phaser.Math.Vector2(20, -25)
        ])
        curve2.draw(graphics, 32)
        
        // Cable 3 - wrapped (using line segments)
        graphics.lineStyle(3, cableColor, 0.6)
        graphics.beginPath()
        graphics.moveTo(-15, -15)
        graphics.lineTo(0, 0)
        graphics.lineTo(15, -10)
        graphics.lineTo(5, 15)
        graphics.lineTo(-10, 10)
        graphics.strokePath()
        
        // Add some connector dots
        graphics.fillStyle(0x666666, 0.9)
        graphics.fillCircle(-25, -20, 4)
        graphics.fillCircle(25, 20, 4)
        graphics.fillCircle(-20, 25, 4)
        graphics.fillCircle(20, -25, 4)
        
        cableContainer.add(graphics)
        cableContainer.setDepth(5)  // Above platforms but below player
        
        // Create slow zone collider
        const zone = this.add.zone(x, y, this.tileSize * 0.8, this.tileSize * 0.8)
        this.physics.add.existing(zone, true)
        zone.body.setAllowGravity(false)
        this.slowZones.add(zone)
      }
    }
  }

  createBackButton() {
    const btn = this.add.text(20, 20, "< BACK TO DESIGNER ( ; )", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888",
      backgroundColor: "#00000088",
      padding: { x: 10, y: 5 }
    })
    btn.setScrollFactor(0)
    btn.setDepth(100)
    btn.setInteractive({ useHandCursor: true })
    btn.on("pointerover", () => btn.setColor("#ffffff"))
    btn.on("pointerout", () => btn.setColor("#888888"))
    btn.on("pointerdown", () => this.backToDesigner())

    // Use semicolon key for quick back-to-designer (more ergonomic for rapid iteration)
    this.input.keyboard.on("keydown-SEMICOLON", () => this.backToDesigner())

    // Sprint Mode button - enter timed trial mode
    const sprintBtn = this.add.text(20, 55, "⚡ SPRINT MODE (S)", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff00ff",
      backgroundColor: "#00000088",
      padding: { x: 10, y: 5 }
    })
    sprintBtn.setScrollFactor(0)
    sprintBtn.setDepth(100)
    sprintBtn.setInteractive({ useHandCursor: true })
    sprintBtn.on("pointerover", () => sprintBtn.setColor("#ffffff"))
    sprintBtn.on("pointerout", () => sprintBtn.setColor("#ff00ff"))
    sprintBtn.on("pointerdown", () => this.enterSprintMode())

    // S key to enter sprint mode
    this.input.keyboard.on("keydown-S", () => this.enterSprintMode())
  }

  /**
   * Enter Sprint Mode for timed trial runs with ghost recording
   */
  enterSprintMode() {
    // Get current level data
    const levelData = this.registry.get("customLevelData")
    if (!levelData) return

    // Launch sprint mode scene with level data
    this.scene.start("SprintModeScene", {
      levelData: levelData,
      levelTitle: levelData.title || "Test Level",
      levelId: null,
      targetAnyTimeMs: levelData.speedRunAnyTargetMs || null,
      target100TimeMs: levelData.speedRun100TargetMs || null
    })
  }

  createTestUI() {
    // Get level data for title display
    const levelData = this.registry.get("customLevelData")
    const levelTitle = levelData?.title || "Test Level"
    
    // Show level title
    const titleLabel = this.add.text(this.cameras.main.width / 2, 15, levelTitle, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 12, y: 4 }
    })
    titleLabel.setOrigin(0.5, 0)
    titleLabel.setScrollFactor(0)
    titleLabel.setDepth(100)
    
    const testLabel = this.add.text(this.cameras.main.width / 2, 42, "TEST MODE", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff00ff",
      backgroundColor: "#00000088",
      padding: { x: 10, y: 3 }
    })
    testLabel.setOrigin(0.5, 0)
    testLabel.setScrollFactor(0)
    testLabel.setDepth(100)

    // Pulsing animation
    this.tweens.add({
      targets: testLabel,
      alpha: 0.6,
      duration: 500,
      yoyo: true,
      repeat: -1
    })

    // Restart hint
    const restartHint = this.add.text(this.cameras.main.width / 2, 68, "R=restart | /=respawn | Q=shift spawn here", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    })
    restartHint.setOrigin(0.5, 0)
    restartHint.setScrollFactor(0)
    restartHint.setDepth(100)

    // Spawn shift indicator (shows when spawn has been shifted)
    this.spawnShiftIndicator = this.add.text(this.cameras.main.width - 20, 20, "", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffaa00",
      backgroundColor: "#00000088",
      padding: { x: 8, y: 4 }
    })
    this.spawnShiftIndicator.setOrigin(1, 0)
    this.spawnShiftIndicator.setScrollFactor(0)
    this.spawnShiftIndicator.setDepth(100)
    
    // Check if spawn has been shifted
    const shiftedSpawn = this.registry.get("shiftedSpawnPoint")
    if (shiftedSpawn) {
      this.spawnShiftIndicator.setText("⚑ SPAWN SHIFTED")
      this.spawnShiftIndicator.setVisible(true)
    } else {
      this.spawnShiftIndicator.setVisible(false)
    }

    // R to restart level (full restart clears saved position AND shifted spawn)
    this.input.keyboard.on("keydown-R", () => {
      this.registry.set("testPlayerState", null)
      this.registry.set("shiftedSpawnPoint", null)
      this.scene.restart()
    })

    // "/" to respawn at current spawn point (shifted or original)
    this.input.keyboard.on("keydown-FORWARD_SLASH", () => {
      this.resetPlayerToSpawn()
    })

    // Q to shift spawn point to current player position
    this.input.keyboard.on("keydown-Q", () => {
      this.shiftSpawnPoint()
    })
  }

  /**
   * Shift spawn point to current player position
   * This is the "spawn-shifting" feature for rapid iteration testing
   * (Future: Will be a premium/unlockable feature in actual gameplay)
   */
  shiftSpawnPoint() {
    if (this.gameCompleted || !this.player || this.player.isDead) return
    
    // Get current player position
    const newSpawnX = this.player.x
    const newSpawnY = this.player.y
    
    // Update the spawn point
    this.spawnPoint = { x: newSpawnX, y: newSpawnY }
    
    // Save to registry so it persists across test iterations
    this.registry.set("shiftedSpawnPoint", { x: newSpawnX, y: newSpawnY })
    
    // Visual feedback
    this.showSpawnShiftFeedback(newSpawnX, newSpawnY)
    
    // Update indicator
    this.spawnShiftIndicator.setText("⚑ SPAWN SHIFTED")
    this.spawnShiftIndicator.setVisible(true)
    
    // Brief flash effect on indicator
    this.tweens.add({
      targets: this.spawnShiftIndicator,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 2
    })
    
    // Play sound effect
    if (this.sound.get("checkpoint_sound")) {
      this.sound.play("checkpoint_sound", { volume: 0.4 })
    } else {
      this.sound.play("ui_confirm_sound", { volume: 0.4 })
    }
  }

  /**
   * Show visual feedback when spawn point is shifted
   */
  showSpawnShiftFeedback(x, y) {
    // Create a flag/marker at the new spawn point
    const marker = this.add.container(x, y)
    marker.setDepth(50)
    
    // Flag pole
    const pole = this.add.rectangle(0, -20, 3, 40, 0xffaa00)
    marker.add(pole)
    
    // Flag
    const flag = this.add.triangle(12, -35, 0, 0, 0, 20, 20, 10, 0xffaa00)
    marker.add(flag)
    
    // Pulse effect
    this.tweens.add({
      targets: marker,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0.7,
      duration: 200,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        // Fade out the marker after a moment
        this.tweens.add({
          targets: marker,
          alpha: 0,
          duration: 1000,
          delay: 1500,
          onComplete: () => marker.destroy()
        })
      }
    })
    
    // Show text feedback
    const feedbackText = this.add.text(x, y - 60, "SPAWN SHIFTED!", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffaa00",
      backgroundColor: "#000000aa",
      padding: { x: 6, y: 3 }
    })
    feedbackText.setOrigin(0.5)
    feedbackText.setDepth(100)
    
    // Float up and fade out
    this.tweens.add({
      targets: feedbackText,
      y: y - 100,
      alpha: 0,
      duration: 1500,
      onComplete: () => feedbackText.destroy()
    })
  }

  /**
   * Reset player to spawn point (manual respawn)
   * Also clears saved player state so next test starts fresh from spawn
   */
  resetPlayerToSpawn() {
    if (this.gameCompleted || !this.player || this.player.isDead) return
    
    // Clear saved player state - "/" means "start fresh"
    this.registry.set("testPlayerState", null)
    
    // Reset to spawn point
    if (this.spawnPoint) {
      this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y)
      this.player.body.setVelocity(0, 0)
      
      // Apply spawn facing direction (from level data)
      const facingDirection = this.spawnFacingDirection || "right"
      this.player.facingDirection = facingDirection
      this.player.setFlipX(facingDirection === "left")
    } else {
      this.player.respawn()
    }
  }

  onReachGoal() {
    if (this.gameCompleted) return
    this.gameCompleted = true

    this.player.body.setVelocity(0, 0)
    this.player.body.setAllowGravity(false)

    // Check if this is a tutorial level being played from Tutorial World
    const tutorialLevelId = this.registry.get("playingTutorialLevelId")
    const returnToTutorialWorld = this.registry.get("returnToTutorialWorld")
    
    if (tutorialLevelId) {
      // Mark tutorial level as completed
      WorldManager.completeTutorialLevel(tutorialLevelId)
      console.log(`[CustomLevelTestScene] Completed tutorial: ${tutorialLevelId}`)
      
      // Clear the tutorial registry flags
      this.registry.set("playingTutorialLevelId", null)
    }

    // Show completion message - different text depending on context
    const returnText = returnToTutorialWorld 
      ? "TUTORIAL COMPLETE!\n\nClick to continue"
      : "LEVEL COMPLETE!\n\nClick to return to designer"
    
    const completeText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      returnText,
      {
        fontFamily: "RetroPixel",
        fontSize: "24px",
        color: "#00ff88",
        backgroundColor: "#000000cc",
        padding: { x: 30, y: 20 },
        align: "center"
      }
    )
    completeText.setOrigin(0.5)
    completeText.setScrollFactor(0)
    completeText.setDepth(100)

    this.sound.play("ui_confirm_sound", { volume: 0.4 })

    // Return to appropriate scene
    if (returnToTutorialWorld) {
      this.registry.set("returnToTutorialWorld", false)
      this.input.once("pointerdown", () => this.scene.start("TutorialWorldScene"))
    } else {
      this.input.once("pointerdown", () => this.backToDesigner())
    }
  }

  backToDesigner() {
    // Save player state to registry so it persists across test sessions
    if (this.player && this.player.active && !this.player.isDead) {
      this.registry.set("testPlayerState", {
        x: this.player.x,
        y: this.player.y,
        velocityX: this.player.body.velocity.x,
        velocityY: this.player.body.velocity.y,
        facingDirection: this.player.facingDirection || "right"
      })
    } else {
      // Clear saved state if player is dead or inactive
      this.registry.set("testPlayerState", null)
    }
    
    // Clean up event listeners
    this.events.off("stopwatchCollected", this.onStopwatchCollected, this)
    
    // Stop any music before returning
    BGMManager.stop()
    
    // Return to designer with flag to restore state
    this.scene.start("LevelDesignerScene", { returnFromTest: true })
  }

  /**
   * Launch mobile controls overlay if on a touch device
   */
  launchMobileControls() {
    // Check if touch device
    const isTouchDevice = (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    )
    
    if (isTouchDevice) {
      // Launch mobile controls scene as overlay
      if (!this.scene.isActive("MobileControlsScene")) {
        this.scene.launch("MobileControlsScene", { gameSceneKey: this.scene.key })
      }
    }
  }

  /**
   * Open pause menu - can be called by mobile controls
   */
  openPauseMenu() {
    // For test scene, go back to designer instead of pausing
    this.backToDesigner()
  }

  update(time, delta) {
    if (this.gameCompleted) return
    
    // Get merged controls (keyboard + touch)
    const controls = getMergedControls(this.cursors, this.registry)
    
    this.player.update(controls, time)
    
    // Handle slow zone timeout - restore speed when player leaves cables
    if (this.player.inSlowZone) {
      this.player.slowZoneTimer -= delta
      if (this.player.slowZoneTimer <= 0) {
        this.player.inSlowZone = false
        this.player.walkSpeed = this.player.originalWalkSpeed || 260
        this.player.runSpeed = this.player.originalRunSpeed || 390
      }
    }
  }

  // ==========================================
  // MUSIC AUDITION CONTROLS
  // ==========================================

  /**
   * Setup music controls for test mode
   * Allows toggling between: Assigned track, Dev Mode music, or Off
   */
  async setupMusicControls() {
    // Default to "dev" so the dev-mode music keeps playing uninterrupted
    // "assigned" is an explicit audition choice the user makes
    this.testMusicMode = this.levelData?.testMusicMode || "dev"
    
    // Create music control UI
    this.createMusicControlUI()
    
    // Start playing based on mode
    await this.applyMusicMode()
  }

  /**
   * Create the music control UI elements
   */
  createMusicControlUI() {
    const uiX = 20
    const uiY = this.cameras.main.height - 50
    
    // Music icon
    this.musicIcon = this.add.text(uiX, uiY, "🎵", {
      fontSize: "16px"
    }).setScrollFactor(0).setDepth(100)
    
    // Mode toggle button
    this.musicModeBtn = this.add.text(uiX + 25, uiY, this.getMusicModeLabel(), {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: this.getMusicModeColor(),
      backgroundColor: "#00000088",
      padding: { x: 6, y: 3 }
    }).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true })
    
    this.musicModeBtn.on("pointerdown", () => {
      this.cycleMusicMode()
    })
    
    this.musicModeBtn.on("pointerover", () => this.musicModeBtn.setColor("#ffffff"))
    this.musicModeBtn.on("pointerout", () => this.musicModeBtn.setColor(this.getMusicModeColor()))
    
    // Keyboard shortcut (M key to cycle modes)
    this.input.keyboard.on("keydown-M", () => {
      this.cycleMusicMode()
    })
    
    // Track name display (shows what's playing)
    this.trackNameText = this.add.text(uiX + 25, uiY + 18, "", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setScrollFactor(0).setDepth(100)
    
    this.updateTrackNameDisplay()
  }

  /**
   * Get display label for current music mode
   */
  getMusicModeLabel() {
    switch (this.testMusicMode) {
      case "assigned": return "[ASSIGNED]"
      case "dev": return "[DEV MODE]"
      case "off": return "[MUSIC OFF]"
      default: return "[ASSIGNED]"
    }
  }

  /**
   * Get color for current music mode
   */
  getMusicModeColor() {
    switch (this.testMusicMode) {
      case "assigned": return "#ff69b4"
      case "dev": return "#ffaa00"
      case "off": return "#666666"
      default: return "#ff69b4"
    }
  }

  /**
   * Cycle through music modes: assigned -> dev -> off -> assigned
   */
  async cycleMusicMode() {
    // Cycle through modes
    switch (this.testMusicMode) {
      case "assigned":
        this.testMusicMode = "dev"
        break
      case "dev":
        this.testMusicMode = "off"
        break
      case "off":
      default:
        this.testMusicMode = "assigned"
        break
    }
    
    // Update UI
    this.musicModeBtn.setText(this.getMusicModeLabel())
    this.musicModeBtn.setColor(this.getMusicModeColor())
    
    // Update the level data so it persists when returning to designer
    if (this.levelData) {
      this.levelData.testMusicMode = this.testMusicMode
    }
    
    // Play feedback sound
    this.sound.play("ui_select_sound", { volume: 0.2 })
    
    // Apply the new music mode
    await this.applyMusicMode()
    
    // Update track name display
    this.updateTrackNameDisplay()
  }

  /**
   * Apply the current music mode (play appropriate track or stop)
   */
  async applyMusicMode() {
    switch (this.testMusicMode) {
      case "dev":
        // Dev-mode music should be kept playing uninterrupted.
        // Only restart it if something stopped it externally.
        if (!BGMManager.isPlaying() && !BGMManager.isPaused()) {
          await BGMManager.playMenuMusic(this, "developer_menu")
        }
        break
      case "assigned":
        // Stop whatever is playing (including dev music) and audition the level track
        BGMManager.stop()
        await this.playAssignedTrack()
        break
      case "off":
        BGMManager.stop()
        break
    }
  }

  /**
   * Play the assigned track for this level
   */
  async playAssignedTrack() {
    const trackId = this.levelData?.assignedTrackId
    if (!trackId) {
      console.log("[CustomLevelTestScene] No assigned track for this level")
      return
    }
    
    // Ensure Supabase music manager is initialized
    if (!SupabaseMusicManager.isInitialized) {
      await SupabaseMusicManager.initialize()
    }
    
    const track = SupabaseMusicManager.getTrack(trackId)
    if (track && track.fileUrl) {
      BGMManager.playMusic(this, `test_assigned_${track.id}`, track.fileUrl, true)
      console.log(`[CustomLevelTestScene] Playing assigned track: ${track.name}`)
    } else {
      console.warn(`[CustomLevelTestScene] Track not found or no URL: ${trackId}`)
    }
  }

  /**
   * Update the track name display based on current mode
   */
  updateTrackNameDisplay() {
    if (!this.trackNameText) return
    
    switch (this.testMusicMode) {
      case "assigned":
        const trackName = this.levelData?.assignedTrackName
        this.trackNameText.setText(trackName ? `♪ ${trackName}` : "(No track assigned)")
        break
      case "dev":
        this.trackNameText.setText("♪ Developer Mode Music")
        break
      case "off":
        this.trackNameText.setText("")
        break
    }
  }
}
