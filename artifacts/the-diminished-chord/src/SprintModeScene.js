import Phaser from "phaser"
import { TeddyPlayer } from "./TeddyPlayer.js"
import { MusicFragment, LevelGoal, SpeedRunStopwatch } from "./MusicFragment.js"
import { getMergedControls } from "./MobileControlsScene.js"
import { PlatformRenderer } from "./PlatformRenderer.js"
import { ghostRunManager } from "./GhostRunManager.js"
import { LeaderboardManager } from "./LeaderboardManager.js"

/**
 * SprintModeScene - Time trial mode for Level Designer
 * Features:
 * - 3-2-1 countdown with drag racing lights
 * - Level timer
 * - Ghost run recording
 * - Record setting for Any% and 100% categories
 * - Auto-tracking of best times with configurable targets
 */
export class SprintModeScene extends Phaser.Scene {
  constructor() {
    super({ key: "SprintModeScene" })
  }

  init(data) {
    // Level data from designer
    this.levelData = data.levelData || this.registry.get("customLevelData")
    this.levelTitle = data.levelTitle || "Untitled Level"
    this.levelId = data.levelId || null
    
    // Existing record times (in milliseconds)
    this.bestAnyTimeMs = data.bestAnyTimeMs || null
    this.best100TimeMs = data.best100TimeMs || null
    
    // Configured target times (what developer sets as "beatable" requirement)
    this.targetAnyTimeMs = data.targetAnyTimeMs || null
    this.target100TimeMs = data.target100TimeMs || null
    
    // Ghost data from previous best runs
    this.bestAnyGhostData = data.bestAnyGhostData || null
    this.best100GhostData = data.best100GhostData || null
  }

  create() {
    if (!this.levelData) {
      console.error("[SprintModeScene] No level data provided")
      this.scene.start("LevelDesignerScene")
      return
    }

    // Initialize state
    this.tileSize = 64
    this.mapWidth = this.levelData.mapWidth * this.tileSize
    this.mapHeight = this.levelData.mapHeight * this.tileSize
    this.gameStarted = false
    this.gameCompleted = false
    this.startTime = 0
    this.elapsedTimeMs = 0
    this.deathCount = 0
    this.collectedCount = 0
    this.totalCollectibles = 0
    
    // Ghost recording
    this.isRecordingGhost = false
    this.currentRunGhostData = null
    
    // Death replay data - stores position snapshots from all attempts
    this.deathReplays = []
    this.currentAttemptPositions = []

    // Create platform renderer
    this.platformRenderer = new PlatformRenderer(this, this.tileSize)

    // Groups
    this.platforms = this.add.group()
    this.hazards = this.add.group()
    this.fragments = this.add.group()
    this.slowZones = this.add.group()

    // Create background
    this.createBackground()

    // Process level objects
    this.processLevelData(this.levelData)

    // Set world bounds
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight, true, true, true, false)

    // Camera setup
    if (this.player) {
      this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight)
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    }

    // Setup collisions
    this.setupCollisions()

    // Input setup
    this.cursors = this.input.keyboard.createCursorKeys()
    this.cursors.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    // Create sprint mode UI
    this.createSprintUI()

    // If level has a stopwatch, show instruction instead of countdown
    // Timer starts when player collects stopwatch
    if (this.hasStopwatch) {
      this.showStopwatchInstruction()
    } else {
      // No stopwatch - use traditional countdown
      this.showCountdown()
    }

    // Launch mobile controls if on touch device
    this.launchMobileControls()
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
      this.cameras.main.setBackgroundColor(0x0a0a15)
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
          this.totalCollectibles++
          break
        case "spawn":
          spawnX = (obj.x + 0.5) * this.tileSize
          spawnY = (obj.y + 1) * this.tileSize
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

    // Store spawn point for respawning
    this.spawnPoint = { x: spawnX, y: spawnY }

    // Create player at spawn
    this.player = new TeddyPlayer(this, spawnX, spawnY)
    
    // Freeze player until countdown completes
    this.player.body.setAllowGravity(false)
    this.player.body.setVelocity(0, 0)

    // Create goal
    this.goal = new LevelGoal(this, goalX, goalY - 32, 64, 64)
  }

  createPlatform(obj) {
    const x = obj.x * this.tileSize
    const y = obj.y * this.tileSize
    const width = obj.width * this.tileSize
    const height = obj.height * this.tileSize

    // Get style world from level data (set in Level Designer)
    // If styleWorld is null/"auto", default to World 1 for testing (detroit_winter_tileset)
    const styleWorld = this.levelData?.styleWorld ?? 1
    const stylePreset = this.levelData?.stylePreset || "auto"

    this.platformRenderer.createPlatform(x, y, width, height, { styleWorld, stylePreset })
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

        this.tweens.add({
          targets: saw,
          angle: 360,
          duration: 1000,
          repeat: -1,
          ease: "Linear"
        })

        this.hazards.add(saw)
      }
    }
  }

  createCables(obj) {
    for (let i = 0; i < obj.width; i++) {
      for (let j = 0; j < obj.height; j++) {
        const x = (obj.x + i + 0.5) * this.tileSize
        const y = (obj.y + j + 0.5) * this.tileSize

        const zone = this.add.zone(x, y, this.tileSize * 0.8, this.tileSize * 0.8)
        this.physics.add.existing(zone, true)
        zone.body.setAllowGravity(false)
        this.slowZones.add(zone)
      }
    }
  }

  createFragment(obj) {
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

  createStopwatch(obj) {
    const x = (obj.x + 0.5) * this.tileSize
    const y = (obj.y + 0.5) * this.tileSize
    this.stopwatch = new SpeedRunStopwatch(this, x, y)
    this.hasStopwatch = true
  }

  setupCollisions() {
    this.physics.add.collider(this.player, this.platforms)
    
    this.physics.add.overlap(
      this.player,
      this.hazards,
      () => this.onPlayerDeath(),
      null,
      this
    )

    this.physics.add.overlap(
      this.player,
      this.slowZones,
      (player, zone) => {
        if (!player.inSlowZone) {
          player.inSlowZone = true
          player.originalWalkSpeed = player.walkSpeed
          player.originalRunSpeed = player.runSpeed || player.walkSpeed * 1.5
          player.walkSpeed = player.originalWalkSpeed * 0.4
          player.runSpeed = player.originalRunSpeed * 0.4
        }
        player.slowZoneTimer = 100
      },
      null,
      this
    )

    this.physics.add.overlap(
      this.player,
      this.fragments,
      (player, fragment) => {
        // Guard against multiple collision calls for the same fragment
        if (!fragment.active || fragment.isCollected) return
        fragment.collect()
        this.collectedCount++
        this.updateCollectibleDisplay()
      },
      null,
      this
    )

    this.physics.add.overlap(
      this.player,
      this.goal,
      () => this.onReachGoal(),
      null,
      this
    )
    
    // Stopwatch collision (if present)
    if (this.stopwatch) {
      this.physics.add.overlap(
        this.player,
        this.stopwatch,
        () => this.onCollectStopwatch(),
        null,
        this
      )
    }
  }

  onCollectStopwatch() {
    if (!this.stopwatch || !this.stopwatch.active || this.stopwatch.isCollected) return
    
    // Collect the stopwatch
    this.stopwatch.collect()
    
    // Start the race!
    this.startRace()
  }

  createSprintUI() {
    // Sprint mode banner
    this.sprintBanner = this.add.text(this.cameras.main.width / 2, 20, "⚡ SPRINT MODE ⚡", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff00ff",
      backgroundColor: "#000000cc",
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100)

    // Timer display
    this.timerText = this.add.text(this.cameras.main.width / 2, 55, "00:00.000", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ffff",
      backgroundColor: "#000000aa",
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100)

    // Best time comparison
    let bestTimeText = "Best: --:--"
    if (this.bestAnyTimeMs) {
      bestTimeText = `Best: ${this.formatTime(this.bestAnyTimeMs)}`
    }
    this.bestTimeDisplay = this.add.text(this.cameras.main.width / 2, 95, bestTimeText, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100)

    // Collectibles display
    this.collectibleText = this.add.text(20, 20, `Fragments: 0/${this.totalCollectibles}`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffaa00",
      backgroundColor: "#000000aa",
      padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(100)

    // Death counter
    this.deathText = this.add.text(20, 50, "Deaths: 0", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff4444"
    }).setScrollFactor(0).setDepth(100)

    // Back button
    const backBtn = this.add.text(this.cameras.main.width - 20, 20, "✕ EXIT", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff4444",
      backgroundColor: "#000000aa",
      padding: { x: 10, y: 5 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100)
      .setInteractive({ useHandCursor: true })
    
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#ff4444"))
    backBtn.on("pointerdown", () => this.exitSprintMode())

    // ESC to exit
    this.input.keyboard.on("keydown-ESC", () => this.exitSprintMode())
  }

  updateCollectibleDisplay() {
    this.collectibleText.setText(`Fragments: ${this.collectedCount}/${this.totalCollectibles}`)
    
    if (this.collectedCount >= this.totalCollectibles) {
      this.collectibleText.setColor("#00ff88")
    }
  }

  /**
   * Show instruction for stopwatch-based timer start
   * Player can move immediately but timer doesn't start until they collect the stopwatch
   */
  showStopwatchInstruction() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Enable player immediately - they can explore before starting timer
    this.player.body.setAllowGravity(true)
    
    // But race hasn't started yet
    this.gameStarted = false

    // Show instruction overlay briefly
    const instructionBg = this.add.rectangle(centerX, centerY, 450, 120, 0x000000, 0.85)
      .setStrokeStyle(3, 0x00ffff).setScrollFactor(0).setDepth(200)

    const instructionText = this.add.text(centerX, centerY - 15, "⏱ COLLECT THE STOPWATCH TO START!", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ffff",
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201)

    const subText = this.add.text(centerX, centerY + 25, "Timer begins when you grab the stopwatch", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201)

    // Fade out after a moment
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: [instructionBg, instructionText, subText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          instructionBg.destroy()
          instructionText.destroy()
          subText.destroy()
        }
      })
    })

    // Update timer display to show waiting state
    this.timerText.setColor("#888888")
    this.timerText.setText("--:--.---")
  }

  showCountdown() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Dark overlay during countdown
    this.countdownOverlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(200)

    // Create traffic light style indicator
    this.lightContainer = this.add.container(centerX, centerY - 50).setScrollFactor(0).setDepth(201)

    const lightBg = this.add.rectangle(0, 0, 80, 200, 0x222222, 0.95).setStrokeStyle(3, 0x444444)
    this.lightContainer.add(lightBg)

    // Three lights (red, yellow, green)
    this.redLight = this.add.circle(0, -60, 25, 0x330000)
    this.yellowLight = this.add.circle(0, 0, 25, 0x333300)
    this.greenLight = this.add.circle(0, 60, 25, 0x003300)
    this.lightContainer.add([this.redLight, this.yellowLight, this.greenLight])

    // Countdown number text
    this.countdownText = this.add.text(centerX, centerY + 120, "3", {
      fontFamily: "RetroPixel",
      fontSize: "72px",
      color: "#ff4444"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201)

    // Start countdown sequence
    this.runCountdown()
  }

  runCountdown() {
    // 3 - Red light
    this.redLight.setFillStyle(0xff0000)
    this.sound.play("ui_select_sound", { volume: 0.5 })

    this.time.delayedCall(1000, () => {
      // 2 - Yellow light (red stays)
      this.yellowLight.setFillStyle(0xffff00)
      this.countdownText.setText("2").setColor("#ffff00")
      this.sound.play("ui_select_sound", { volume: 0.5 })
    })

    this.time.delayedCall(2000, () => {
      // 1 - All lights dim, preparing
      this.countdownText.setText("1").setColor("#ffffff")
      this.sound.play("ui_select_sound", { volume: 0.5 })
    })

    this.time.delayedCall(3000, () => {
      // GO! - Green light
      this.redLight.setFillStyle(0x330000)
      this.yellowLight.setFillStyle(0x333300)
      this.greenLight.setFillStyle(0x00ff00)
      this.countdownText.setText("GO!").setColor("#00ff00")
      this.sound.play("ui_confirm_sound", { volume: 0.6 })

      // Start the game
      this.startRace()
    })

    this.time.delayedCall(3500, () => {
      // Clean up countdown UI
      this.countdownOverlay.destroy()
      this.lightContainer.destroy()
      this.countdownText.destroy()
    })
  }

  startRace() {
    // Prevent double-starting
    if (this.gameStarted) return
    
    this.gameStarted = true
    this.startTime = this.time.now

    // Enable player physics (may already be enabled if using stopwatch mode)
    this.player.body.setAllowGravity(true)

    // Update timer display
    this.timerText.setColor("#00ffff")
    this.timerText.setText("00:00.000")

    // Start ghost recording
    ghostRunManager.startRecording()
    this.isRecordingGhost = true

    // Start recording death replay positions
    this.currentAttemptPositions = []
    
    console.log("[SprintModeScene] Race started!")
  }

  onPlayerDeath() {
    if (!this.gameStarted || this.gameCompleted) return

    this.deathCount++
    this.deathText.setText(`Deaths: ${this.deathCount}`)

    // Save current attempt positions for death replay
    if (this.currentAttemptPositions.length > 0) {
      this.deathReplays.push([...this.currentAttemptPositions])
    }

    // Reset for new attempt (don't stop ghost recording - continues across deaths)
    this.currentAttemptPositions = []

    // Respawn player
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y)
    this.player.body.setVelocity(0, 0)
    this.player.facingDirection = "right"
    this.player.setFlipX(false)

    // Flash effect
    this.cameras.main.flash(200, 255, 0, 0, false)
    this.sound.play("player_die_sound", { volume: 0.4 })
  }

  onReachGoal() {
    if (!this.gameStarted || this.gameCompleted) return
    this.gameCompleted = true

    // Stop timer and ghost recording
    this.elapsedTimeMs = this.time.now - this.startTime
    
    // Stop ghost recording and get data
    if (this.isRecordingGhost) {
      this.currentRunGhostData = ghostRunManager.stopRecording()
      this.isRecordingGhost = false
    }

    // Save final attempt positions
    if (this.currentAttemptPositions.length > 0) {
      this.deathReplays.push([...this.currentAttemptPositions])
    }

    // Freeze player
    this.player.body.setVelocity(0, 0)
    this.player.body.setAllowGravity(false)

    // Play completion sound
    this.sound.play("ui_confirm_sound", { volume: 0.5 })

    // Check if this is a new record
    const allFragments = this.collectedCount >= this.totalCollectibles
    const isNewAnyRecord = !this.bestAnyTimeMs || this.elapsedTimeMs < this.bestAnyTimeMs
    const isNew100Record = allFragments && (!this.best100TimeMs || this.elapsedTimeMs < this.best100TimeMs)

    // Show completion dialog
    this.showCompletionDialog(allFragments, isNewAnyRecord, isNew100Record)
  }

  showCompletionDialog(allFragments, isNewAnyRecord, isNew100Record) {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Array to track all dialog elements for cleanup
    this.dialogElements = []

    // Overlay - visual only, don't make interactive as it can block clicks to dialog
    const overlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.85)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(300)
    this.dialogElements.push(overlay)

    // Store overlay reference for cleanup
    this.completionOverlay = overlay
    
    // Disable game input during dialog
    this.input.keyboard.enabled = false

    // Background panel - using screen coordinates with setScrollFactor(0)
    const panelHeight = 420
    const bg = this.add.rectangle(centerX, centerY, 500, panelHeight, 0x1a1a2e, 0.98)
      .setStrokeStyle(3, 0x00ff88)
      .setScrollFactor(0)
      .setDepth(301)
    this.dialogElements.push(bg)

    // Title
    const title = this.add.text(centerX, centerY - 180, "⚡ SPRINT COMPLETE! ⚡", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
    this.dialogElements.push(title)

    // Time display
    const timeText = this.add.text(centerX, centerY - 130, this.formatTime(this.elapsedTimeMs), {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#00ffff"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
    this.dialogElements.push(timeText)

    // Stats
    const fragmentColor = allFragments ? "#00ff88" : "#ffaa00"
    const fragmentStatus = allFragments ? "100% COLLECTED!" : `${this.collectedCount}/${this.totalCollectibles}`
    
    const statsText = this.add.text(centerX, centerY - 85, `Fragments: ${fragmentStatus}\nDeaths: ${this.deathCount}`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
    this.dialogElements.push(statsText)

    // Record status
    let recordY = centerY - 35
    if (isNewAnyRecord) {
      const anyRecordText = this.add.text(centerX, recordY, "🏆 NEW ANY% RECORD!", {
        fontFamily: "RetroPixel",
        fontSize: "18px",
        color: "#ffff00"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
      this.dialogElements.push(anyRecordText)
      recordY += 30
    }
    
    if (isNew100Record) {
      const record100Text = this.add.text(centerX, recordY, "🏆 NEW 100% RECORD!", {
        fontFamily: "RetroPixel",
        fontSize: "18px",
        color: "#ff69b4"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
      this.dialogElements.push(record100Text)
    }

    // Set Target Time buttons - only show if a new record was set
    const buttonY = centerY + 20
    
    // Show "Set as Target" buttons when a new record is achieved
    if (isNewAnyRecord) {
      const setAnyTargetBtn = this.createStandaloneButton(centerX - 120, buttonY, "SET AS\nANY% TARGET", 0x00ffff, () => {
        this.setRecordTime("any", this.elapsedTimeMs, this.currentRunGhostData)
        // Visual feedback
        setAnyTargetBtn.bg.setFillStyle(0x004444)
        setAnyTargetBtn.text.setText("TARGET SET!")
      })
      this.dialogElements.push(setAnyTargetBtn.bg, setAnyTargetBtn.text)
    }

    if (isNew100Record) {
      const set100TargetBtn = this.createStandaloneButton(centerX + 120, buttonY, "SET AS\n100% TARGET", 0xff69b4, () => {
        this.setRecordTime("100", this.elapsedTimeMs, this.currentRunGhostData)
        // Visual feedback
        set100TargetBtn.bg.setFillStyle(0x440044)
        set100TargetBtn.text.setText("TARGET SET!")
      })
      this.dialogElements.push(set100TargetBtn.bg, set100TargetBtn.text)
    }

    // Target time info section
    const targetLabel = this.add.text(centerX, centerY + 80, "─── CURRENT LEVEL TARGETS ───", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
    this.dialogElements.push(targetLabel)

    // Current/configured targets display
    const anyTargetStr = this.targetAnyTimeMs ? this.formatTime(this.targetAnyTimeMs) : "Not set"
    const target100Str = this.target100TimeMs ? this.formatTime(this.target100TimeMs) : "Not set"
    
    const anyTargetText = this.add.text(centerX - 120, centerY + 110, `Any% Target:\n${anyTargetStr}`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#00ffff",
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
    this.dialogElements.push(anyTargetText)

    const fullTargetText = this.add.text(centerX + 120, centerY + 110, `100% Target:\n${target100Str}`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff69b4",
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
    this.dialogElements.push(fullTargetText)

    // Explanation text
    if (!isNewAnyRecord && !isNew100Record) {
      const noRecordText = this.add.text(centerX, buttonY, "No new records to set as target", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#666666"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302)
      this.dialogElements.push(noRecordText)
    }

    // Bottom action buttons - RETRY and EXIT
    const retryBtn = this.createStandaloneButton(centerX - 100, centerY + 165, "🔄 RETRY", 0xffaa00, () => {
      this.cleanupDialog()
      // Pass current level data to restart so it doesn't lose the level
      this.scene.restart({
        levelData: this.levelData,
        levelTitle: this.levelTitle,
        levelId: this.levelId,
        bestAnyTimeMs: this.bestAnyTimeMs,
        best100TimeMs: this.best100TimeMs,
        targetAnyTimeMs: this.targetAnyTimeMs,
        target100TimeMs: this.target100TimeMs,
        bestAnyGhostData: this.bestAnyGhostData,
        best100GhostData: this.best100GhostData
      })
    })
    this.dialogElements.push(retryBtn.bg, retryBtn.text)

    const exitBtn = this.createStandaloneButton(centerX + 100, centerY + 165, "🚪 EXIT", 0xff4444, () => {
      this.cleanupDialog()
      this.exitSprintMode()
    })
    this.dialogElements.push(exitBtn.bg, exitBtn.text)
  }

  /**
   * Create a standalone button (not in a container) for reliable pointer events
   */
  createStandaloneButton(x, y, label, color, callback, disabled = false) {
    const btnBg = this.add.rectangle(x, y, 120, 50, disabled ? 0x333333 : 0x222244, 0.9)
      .setStrokeStyle(2, disabled ? 0x444444 : color)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(303)
    
    const btnText = this.add.text(x, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: disabled ? "#666666" : Phaser.Display.Color.IntegerToColor(color).rgba,
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(304)

    if (!disabled) {
      btnBg.setInteractive({ useHandCursor: true })
      btnBg.on("pointerover", () => {
        btnBg.setStrokeStyle(3, 0xffffff)
        btnText.setColor("#ffffff")
      })
      btnBg.on("pointerout", () => {
        btnBg.setStrokeStyle(2, color)
        btnText.setColor(Phaser.Display.Color.IntegerToColor(color).rgba)
      })
      btnBg.on("pointerdown", () => {
        // Play sound safely
        try {
          if (this.sound.get("ui_confirm_sound") || this.cache.audio.exists("ui_confirm_sound")) {
            this.sound.play("ui_confirm_sound", { volume: 0.3 })
          }
        } catch (e) {
          console.warn("[SprintModeScene] Could not play ui_confirm_sound:", e)
        }
        callback()
      })
    }

    return { bg: btnBg, text: btnText }
  }

  /**
   * Clean up dialog elements and re-enable keyboard
   */
  cleanupDialog() {
    this.input.keyboard.enabled = true
    if (this.dialogElements) {
      this.dialogElements.forEach(el => {
        if (el && el.destroy) el.destroy()
      })
      this.dialogElements = []
    }
  }

  setRecordTime(category, timeMs, ghostData) {
    // Store the record in registry for Level Designer to pick up
    const recordData = {
      category,
      timeMs,
      ghostData,
      timestamp: Date.now()
    }

    if (category === "any") {
      this.registry.set("sprintAnyRecord", recordData)
      this.bestAnyTimeMs = timeMs
      this.bestAnyGhostData = ghostData
    } else {
      this.registry.set("sprint100Record", recordData)
      this.best100TimeMs = timeMs
      this.best100GhostData = ghostData
    }

    // Show confirmation
    const confirmText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 220, 
      `${category === "any" ? "Any%" : "100%"} record set: ${this.formatTime(timeMs)}`, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#00ff88",
        backgroundColor: "#000000cc",
        padding: { x: 15, y: 8 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(400)

    this.tweens.add({
      targets: confirmText,
      alpha: 0,
      y: confirmText.y - 30,
      delay: 1500,
      duration: 500,
      onComplete: () => confirmText.destroy()
    })
  }

  exitSprintMode() {
    // Store death replays and ghost data in registry for potential playback
    this.registry.set("sprintDeathReplays", this.deathReplays)
    
    // Return to designer
    this.scene.start("LevelDesignerScene", { returnFromTest: true })
  }

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`
  }

  launchMobileControls() {
    const isTouchDevice = (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    )

    if (isTouchDevice && !this.scene.isActive("MobileControlsScene")) {
      this.scene.launch("MobileControlsScene", { gameSceneKey: this.scene.key })
    }
  }

  update(time, delta) {
    if (!this.gameStarted || this.gameCompleted) return

    // Update timer
    this.elapsedTimeMs = time - this.startTime
    this.timerText.setText(this.formatTime(this.elapsedTimeMs))

    // Color timer based on comparison to best time
    if (this.bestAnyTimeMs) {
      if (this.elapsedTimeMs > this.bestAnyTimeMs) {
        this.timerText.setColor("#ff4444")
      } else {
        this.timerText.setColor("#00ff88")
      }
    }

    // Get merged controls
    const controls = getMergedControls(this.cursors, this.registry)

    // Update player
    this.player.update(controls, time, delta)

    // Record ghost position
    if (this.isRecordingGhost) {
      const runTime = time - this.startTime
      ghostRunManager.recordPosition(
        runTime,
        this.player.x,
        this.player.y,
        this.player.anims.currentAnim?.key,
        this.player.flipX
      )

      // Record input state
      ghostRunManager.recordInput(runTime, {
        left: controls.left.isDown,
        right: controls.right.isDown,
        up: controls.up.isDown,
        down: controls.down?.isDown || false,
        jump: controls.up.isDown || controls.space?.isDown
      })

      // Store position for death replay
      if (runTime % 50 < delta) { // Sample every ~50ms
        this.currentAttemptPositions.push({
          t: runTime,
          x: this.player.x,
          y: this.player.y,
          anim: this.player.anims.currentAnim?.key,
          flipX: this.player.flipX
        })
      }
    }

    // Handle slow zone timeout
    if (this.player.inSlowZone) {
      this.player.slowZoneTimer -= delta
      if (this.player.slowZoneTimer <= 0) {
        this.player.inSlowZone = false
        this.player.walkSpeed = this.player.originalWalkSpeed || 260
        this.player.runSpeed = this.player.originalRunSpeed || 390
      }
    }

    // Check for death by falling
    if (this.player.y > this.mapHeight + 100) {
      this.onPlayerDeath()
    }
  }
}
