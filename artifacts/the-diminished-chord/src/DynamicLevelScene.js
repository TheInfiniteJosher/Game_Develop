import Phaser from "phaser"
import { TeddyPlayer } from "./TeddyPlayer.js"
import { MusicFragment, LevelGoal, SpeedRunStopwatch } from "./MusicFragment.js"
import { WORLDS, WorldManager, parseLevelId, LEVEL_TYPES, BONUS_PURPOSES, getLevelSceneKey } from "./WorldManager.js"
import { LevelDataManager } from "./LevelDataManager.js"
import { BGMManager } from "./BGMManager.js"
import { BossFightManager, BOSS_DATA } from "./BossFightSystem.js"
import { CutsceneFlowManager } from "./CutsceneFlowManager.js"
import { CutsceneManager } from "./CutsceneManager.js"
import { levelConfig } from "./gameConfig.json"
import { getMergedControls } from "./MobileControlsScene.js"
import { isSpawnShiftingActive } from "./SettingsScene.js"
import { PlatformRenderer } from "./PlatformRenderer.js"
import { PlayerProgressManager } from "./PlayerProgressManager.js"

/**
 * LevelSessionManager - Tracks collected fragments within a level session
 * Fragments persist through deaths/restarts but reset when level is completed
 * or when starting a fresh session (e.g., from level select)
 */
const LevelSessionManager = {
  // Map of levelId -> Set of collected fragment indices
  collectedFragments: new Map(),
  // Current active level session
  currentLevelId: null,
  
  /**
   * Start or continue a session for a level
   * @param {string} levelId - The level identifier
   * @param {boolean} freshStart - If true, clears any existing session data for this level
   */
  startSession(levelId, freshStart = false) {
    if (freshStart || this.currentLevelId !== levelId) {
      // Clear previous session data when starting fresh or switching levels
      if (freshStart) {
        this.collectedFragments.delete(levelId)
      }
    }
    this.currentLevelId = levelId
    
    // Initialize set for this level if it doesn't exist
    if (!this.collectedFragments.has(levelId)) {
      this.collectedFragments.set(levelId, new Set())
    }
  },
  
  /**
   * Mark a fragment as collected
   * @param {number} fragmentIndex - The index of the fragment in the level's fragment array
   */
  collectFragment(fragmentIndex) {
    if (this.currentLevelId && this.collectedFragments.has(this.currentLevelId)) {
      this.collectedFragments.get(this.currentLevelId).add(fragmentIndex)
    }
  },
  
  /**
   * Check if a fragment was already collected this session
   * @param {number} fragmentIndex - The index of the fragment
   * @returns {boolean}
   */
  isFragmentCollected(fragmentIndex) {
    if (this.currentLevelId && this.collectedFragments.has(this.currentLevelId)) {
      return this.collectedFragments.get(this.currentLevelId).has(fragmentIndex)
    }
    return false
  },
  
  /**
   * Get the count of collected fragments for the current level
   * @returns {number}
   */
  getCollectedCount() {
    if (this.currentLevelId && this.collectedFragments.has(this.currentLevelId)) {
      return this.collectedFragments.get(this.currentLevelId).size
    }
    return 0
  },
  
  /**
   * Clear session data for a level (called when level is completed)
   * @param {string} levelId - The level identifier (defaults to current level)
   */
  clearSession(levelId = null) {
    const id = levelId || this.currentLevelId
    if (id) {
      this.collectedFragments.delete(id)
    }
  },
  
  /**
   * Clear all session data (e.g., when returning to main menu)
   */
  clearAllSessions() {
    this.collectedFragments.clear()
    this.currentLevelId = null
  }
}

// Export for use in other scenes (e.g., VictoryUIScene retry button)
export { LevelSessionManager }

/**
 * DynamicLevelScene - A flexible scene that can load ANY of the 301 levels
 * Uses procedural generation with customizable overrides from LevelDataManager
 */
export class DynamicLevelScene extends Phaser.Scene {
  constructor() {
    super({ key: "DynamicLevelScene" })
  }

  init(data) {
    this.levelId = data.levelId || "Tutorial"
    this.worldNum = data.worldNum || 0
    this.levelType = data.levelType || LEVEL_TYPES.NORMAL
    
    // Check if this is a fresh start (from level select, next level, etc.) or a restart (death/retry)
    // freshStart clears collected fragments, restart preserves them
    this.isFreshStart = data.freshStart !== false // Default to true unless explicitly set to false
    
    // Check if we're in replay mode (watching ghost replay)
    this.isReplayMode = data.replayMode === true
    console.log(`[DynamicLevelScene] init - levelId: ${this.levelId}, replayMode: ${this.isReplayMode}, data:`, data)

    // Parse level info
    const parsed = parseLevelId(this.levelId)
    if (parsed) {
      this.worldNum = parsed.world
      this.levelType = parsed.type
      this.levelNum = parsed.level
    }

    // Get world data
    this.world = this.worldNum > 0 ? WORLDS[this.worldNum] : null
    
    // Initialize session - fresh start clears previous collection progress
    LevelSessionManager.startSession(this.levelId, this.isFreshStart)
  }

  create() {
    // Initialize state
    this.gameCompleted = false
    this.isProcessingDeath = false // Reset death processing flag
    this.tileSize = levelConfig.tileSize.value
    this.collectedCount = 0 // Track collected fragments for UI
    
    // Death count persists through restarts (stored in registry)
    // Only reset on fresh start (from level select, next level, etc.)
    if (this.isFreshStart) {
      this.deathCount = 0
      this.registry.set(`deathCount_${this.levelId}`, 0)
    } else {
      this.deathCount = this.registry.get(`deathCount_${this.levelId}`) || 0
    }
    
    // Timer state - will be set when metronome collected (or immediately if no metronome)
    this.startTime = null // null means timer hasn't started yet
    this.timerStarted = false
    this.hasStopwatch = false // Will be set true if level has a metronome
    
    // Ghost replay recording - track all attempts
    this.initializeGhostRecording()

    // Get level data from manager (or use defaults)
    const rawLevelData = LevelDataManager.getLevel(this.levelId)
    console.log(`[DynamicLevelScene] Loading level: ${this.levelId}`)
    console.log(`[DynamicLevelScene] Raw level data:`, rawLevelData)
    this.levelData = rawLevelData ? this.normalizeLevelData(rawLevelData) : this.generateDefaultLevelData()
    console.log(`[DynamicLevelScene] Normalized level data:`, this.levelData)

    // Setup dimensions (already in pixels from normalizeLevelData)
    this.mapWidth = this.levelData.mapWidth
    this.mapHeight = this.levelData.mapHeight
    
    // Create unified platform renderer - SAME renderer used by CustomLevelTestScene
    // This ensures TEST mode and GAMEPLAY mode render IDENTICALLY
    this.platformRenderer = new PlatformRenderer(this, this.tileSize)

    // Create background
    this.createBackground()

    // Create platforms
    this.platforms = this.add.group()
    this.createPlatforms()

    // Create player
    this.createPlayer()

    // Create fragments
    this.fragments = this.add.group()
    this.createFragments(false) // Don't emit event yet - UIScene not ready

    // Create metronome if present in level data
    this.createStopwatch()

    // Create hazards
    this.hazards = this.add.group()
    this.createHazards()

    // Create slow zones (cables)
    this.slowZones = this.add.group()
    this.createSlowZones()

    // Create goal
    this.createGoal()

    // Setup collisions
    this.setupCollisions()

    // Camera setup
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // World bounds
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight, true, true, true, false)
    this.player.body.setCollideWorldBounds(true)
    this.player.body.onWorldBounds = true

    // Input
    this.setupInputs()

    // If in replay mode, skip normal UI and game setup - go straight to replay
    if (this.isReplayMode) {
      console.log("[DynamicLevelScene] Entering replay mode branch")
      // Don't launch UIScene, don't start timer, just start the replay
      this.startGhostReplayMode()
      return
    }
    
    console.log("[DynamicLevelScene] Normal gameplay mode (not replay)")

    // Launch UI (not in replay mode)
    this.scene.launch("UIScene", { gameSceneKey: this.scene.key, levelId: this.levelId })
    
    // Launch mobile controls if on touch device
    this.launchMobileControls()

    // Emit collectiblesLoaded and deathCount events now that UIScene is launched
    // Use a short delay to ensure UIScene's create() method has completed
    this.time.delayedCall(50, () => {
      this.events.emit("collectiblesLoaded", {
        total: this.totalCollectibles || 0,
        collected: this.collectedCount || 0, // Use actual collected count from session
        counts: this.collectibleCounts || {}
      })
      // Also emit current death count (important for restarts)
      this.events.emit("updateDeathCount", this.deathCount)
    })

    // Play background music
    BGMManager.playLevelMusic(this, this.levelId)

    // Handle visibility/focus change - pause game when tab loses focus
    this.setupVisibilityHandling()

    // Boss fight setup
    if (this.levelType === LEVEL_TYPES.BOSS && this.worldNum > 0) {
      this.setupBossFight()
    }

    // Events - use 'once' pattern or ensure cleanup in shutdown
    this.events.on("fragmentCollected", this.onFragmentCollected, this)
    this.events.on("bossDefeated", this.onBossDefeated, this)
    this.events.on("stopwatchCollected", this.onStopwatchCollected, this)
    
    // Listen for shutdown to clean up
    this.events.on("shutdown", this.shutdown, this)
    
    // If no metronome in level, start timer immediately
    if (!this.hasStopwatch) {
      this.startTimer()
    }

    // Display level info
    this.showLevelIntro()
  }
  
  /**
   * Start ghost replay mode - play back recorded ghosts on the current level
   */
  startGhostReplayMode() {
    const replayData = this.registry.get("ghostReplayMode")
    
    console.log("[DynamicLevelScene] Starting ghost replay mode, replayData:", replayData)
    
    if (!replayData || !replayData.enabled) {
      console.warn("[DynamicLevelScene] No replay data found in registry!")
      // Show error message to user
      this.showReplayError("No ghost data available")
      return
    }
    
    // Clear the registry flag
    this.registry.set("ghostReplayMode", null)
    
    // Hide the real player
    if (this.player) {
      this.player.setVisible(false)
      this.player.body.enable = false
    }
    
    // Disable player input
    this.input.keyboard.enabled = false
    
    // Stop following the hidden player
    this.cameras.main.stopFollow()
    
    // Create ghost sprites
    this.ghosts = []
    this.replayStartTime = this.time.now
    this.replaySpeed = 1.0
    this.replayPaused = false
    this.replayCompleted = false
    this.replayReturnData = replayData.returnData
    this.replayCompletionTimeMs = replayData.completionTimeMs
    
    // Get spawn point
    const spawnX = this.levelData.spawnPoint?.x || 100
    const spawnY = this.levelData.spawnPoint?.y || 600
    
    console.log("[DynamicLevelScene] Ghost replay spawn point:", spawnX, spawnY)
    
    // Create death ghosts
    const deathReplays = replayData.deathReplays || []
    this.totalDeathCount = deathReplays.length // Store for UI display
    console.log("[DynamicLevelScene] Death replays count:", deathReplays.length)
    
    deathReplays.forEach((replay, index) => {
      const positions = replay.positions || replay
      console.log(`[DynamicLevelScene] Death replay ${index} positions:`, positions?.length || 0)
      const decompressedPositions = this.decompressGhostPositions(positions)
      
      // Get first position for correct starting location
      const firstPos = decompressedPositions[0]
      const startX = firstPos?.x || spawnX
      const startY = firstPos?.y || spawnY
      
      const ghost = this.createGhostSprite(startX, startY, index, false)
      ghost.positionData = decompressedPositions
      ghost.isDead = false
      ghost.isWinner = false
      this.ghosts.push(ghost)
    })
    
    // Create successful run ghost
    const successRun = replayData.successfulRun
    const successPositions = successRun?.positions || successRun
    
    console.log("[DynamicLevelScene] Successful run data:", successRun)
    console.log("[DynamicLevelScene] Successful positions count:", successPositions?.length || 0)
    
    if (successPositions && successPositions.length > 0) {
      const decompressedPositions = this.decompressGhostPositions(successPositions)
      
      // Get the first position to place the ghost at the correct starting location
      const firstPos = decompressedPositions[0]
      const startX = firstPos?.x || spawnX
      const startY = firstPos?.y || spawnY
      
      const winnerGhost = this.createGhostSprite(startX, startY, -1, true)
      winnerGhost.positionData = decompressedPositions
      winnerGhost.isDead = false
      winnerGhost.isWinner = true
      this.ghosts.push(winnerGhost)
      this.successfulGhost = winnerGhost
      
      console.log("[DynamicLevelScene] Winner ghost created at", startX, startY, "with", winnerGhost.positionData.length, "positions")
      console.log("[DynamicLevelScene] First few positions:", decompressedPositions.slice(0, 3))
      console.log("[DynamicLevelScene] Ghost visible:", winnerGhost.visible, "alpha:", winnerGhost.alpha, "scale:", winnerGhost.scale)
      console.log("[DynamicLevelScene] Camera bounds:", this.cameras.main.getBounds())
      
      // Camera follows the winner ghost
      // First, snap camera to ghost position immediately using scrollX/scrollY
      const { width: camWidth, height: camHeight } = this.cameras.main
      const targetScrollX = Math.max(0, Math.min(startX - camWidth / 2, this.mapWidth - camWidth))
      const targetScrollY = Math.max(0, Math.min(startY - camHeight / 2, this.mapHeight - camHeight))
      this.cameras.main.setScroll(targetScrollX, targetScrollY)
      
      // Then enable following
      this.cameras.main.startFollow(winnerGhost, true, 0.1, 0.1)
      
      console.log("[DynamicLevelScene] Camera position after setScroll:", this.cameras.main.scrollX, this.cameras.main.scrollY)
    } else {
      console.warn("[DynamicLevelScene] No successful run positions found!")
    }
    
    this.totalGhosts = this.ghosts.length
    this.activeGhosts = this.totalGhosts
    
    if (this.totalGhosts === 0) {
      console.warn("[DynamicLevelScene] No ghosts created!")
      this.showReplayError("No ghost data recorded for this run")
      return
    }
    
    // NOTE: No ghost culling - show ALL attempts as user requested
    // If performance becomes an issue with hundreds of ghosts, we can add an option later
    
    // Create replay UI overlay
    this.createReplayUI()
    
    // Setup replay input controls
    this.setupReplayInput()
    
    console.log(`[DynamicLevelScene] Ghost replay started with ${this.totalGhosts} total ghosts (${Math.min(this.totalGhosts - 1, this.maxVisibleDeathGhosts)} death ghosts visible)`)
  }
  
  /**
   * Apply ghost culling for performance optimization
   * - Limits visible death ghosts to maxVisibleDeathGhosts
   * - Selects ghosts that died at different points for variety
   * - Winner ghost is always visible
   */
  applyGhostCulling() {
    // Separate winner from death ghosts
    const deathGhosts = this.ghosts.filter(g => !g.isWinner)
    
    if (deathGhosts.length <= this.maxVisibleDeathGhosts) {
      // All ghosts can be shown
      return
    }
    
    // Sort death ghosts by their death time (when their data ends) for variety
    // This ensures we show ghosts that died at different points in the level
    deathGhosts.sort((a, b) => {
      const aEndTime = a.positionData[a.positionData.length - 1]?.t || 0
      const bEndTime = b.positionData[b.positionData.length - 1]?.t || 0
      return aEndTime - bEndTime
    })
    
    // Select evenly distributed ghosts across the death times
    const step = deathGhosts.length / this.maxVisibleDeathGhosts
    const selectedIndices = new Set()
    
    for (let i = 0; i < this.maxVisibleDeathGhosts; i++) {
      const index = Math.min(Math.floor(i * step), deathGhosts.length - 1)
      selectedIndices.add(index)
    }
    
    // Hide non-selected ghosts
    deathGhosts.forEach((ghost, index) => {
      if (!selectedIndices.has(index)) {
        ghost.setVisible(false)
        ghost.setActive(false)
        ghost.isCulled = true
      }
    })
    
    console.log(`[DynamicLevelScene] Culled ${deathGhosts.length - selectedIndices.size} ghosts for performance`)
  }

  showReplayError(message) {
    const { width, height } = this.cameras.main
    
    const errorContainer = this.add.container(width / 2, height / 2)
      .setScrollFactor(0)
      .setDepth(200)
    
    const bg = this.add.rectangle(0, 0, 400, 150, 0x0a0a1a, 0.95)
      .setStrokeStyle(3, 0xff4444)
    
    const title = this.add.text(0, -40, "⚠️ REPLAY ERROR", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff4444"
    }).setOrigin(0.5)
    
    const msgText = this.add.text(0, 10, message, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5)
    
    const hint = this.add.text(0, 50, "Press ESC to return", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
    
    errorContainer.add([bg, title, msgText, hint])
    
    // Setup escape to return
    this.input.keyboard.enabled = true
    this.input.keyboard.once("keydown-ESC", () => {
      this.exitReplayMode()
    })
  }
  
  createGhostSprite(x, y, index, isWinner) {
    const ghost = this.add.sprite(x, y, "teddy_idle_frame1")
    
    // Scale based on player scale (same as the actual player)
    const standardHeight = 1.5 * 64
    const characterScale = standardHeight / 560
    ghost.setScale(characterScale)
    ghost.setOrigin(0.5, 1)
    ghost.setDepth(isWinner ? 20 : 10)
    
    if (isWinner) {
      ghost.setAlpha(1)
      ghost.setTint(0xffffff)
    } else {
      ghost.setAlpha(0.5)
      const hue = (index * 0.618033988749895) % 1
      const tint = Phaser.Display.Color.HSLToColor(hue, 0.6, 0.7).color
      ghost.setTint(tint)
    }
    
    ghost.playbackIndex = 0
    ghost.lastAnim = null
    
    return ghost
  }
  
  decompressGhostPositions(data) {
    if (!data || data.length === 0) return []
    
    // Check if already in raw format
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
  
  createReplayUI() {
    const { width, height } = this.cameras.main
    
    // Top bar
    this.replayUIContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100)
    
    const topBar = this.add.rectangle(width / 2, 25, width, 50, 0x000000, 0.7)
    this.replayUIContainer.add(topBar)
    
    const title = this.add.text(width / 2, 15, "👻 GHOST REPLAY", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.replayUIContainer.add(title)
    
    // Show total deaths + successful run info
    const totalDeaths = this.totalDeathCount || 0
    const attemptsText = totalDeaths === 0 
      ? `Flawless run!`
      : `${totalDeaths} death${totalDeaths !== 1 ? 's' : ''} + winning run`
    
    this.ghostCountText = this.add.text(width / 2, 38, attemptsText, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#aaaaaa"
    }).setOrigin(0.5)
    this.replayUIContainer.add(this.ghostCountText)
    
    this.replayTimeText = this.add.text(width - 20, 25, "0.000s", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ff88"
    }).setOrigin(1, 0.5)
    this.replayUIContainer.add(this.replayTimeText)
    
    this.replaySpeedText = this.add.text(20, 25, "1.0x", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffaa00"
    }).setOrigin(0, 0.5)
    this.replayUIContainer.add(this.replaySpeedText)
    
    const hint = this.add.text(width / 2, height - 20, "SPACE: Pause | ←/→: Speed | ESC: Exit", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666"
    }).setOrigin(0.5)
    this.replayUIContainer.add(hint)
  }
  
  setupReplayInput() {
    // Re-enable keyboard for replay controls only
    this.input.keyboard.enabled = true
    
    console.log("[DynamicLevelScene] Setting up replay input controls")
    
    // Use the scene's input manager directly
    this.input.keyboard.on("keydown-SPACE", () => {
      console.log("[DynamicLevelScene] SPACE pressed - toggling pause")
      this.replayPaused = !this.replayPaused
    })
    
    this.input.keyboard.on("keydown-LEFT", () => {
      this.replaySpeed = Math.max(0.25, this.replaySpeed - 0.25)
      if (this.replaySpeedText) {
        this.replaySpeedText.setText(`${this.replaySpeed.toFixed(2)}x`)
      }
    })
    
    this.input.keyboard.on("keydown-RIGHT", () => {
      this.replaySpeed = Math.min(4, this.replaySpeed + 0.25)
      if (this.replaySpeedText) {
        this.replaySpeedText.setText(`${this.replaySpeed.toFixed(2)}x`)
      }
    })
    
    this.input.keyboard.on("keydown-ESC", () => {
      console.log("[DynamicLevelScene] ESC pressed - exiting replay")
      this.exitReplayMode()
    })
    
    // Also support gamepad B button to exit
    this.input.gamepad?.on("down", (pad, button) => {
      if (button.index === 1) { // B button
        console.log("[DynamicLevelScene] Gamepad B pressed - exiting replay")
        this.exitReplayMode()
      }
    })
  }
  
  exitReplayMode() {
    // Return to victory screen with the stored return data
    BGMManager.unduckVolume()
    this.scene.start("VictoryUIScene", {
      ...this.replayReturnData,
      currentLevelKey: "DynamicLevelScene",
      levelId: this.levelId
    })
  }
  
  shutdown() {
    // Clean up event listeners to prevent stale listeners on restart
    this.events.off("fragmentCollected", this.onFragmentCollected, this)
    this.events.off("bossDefeated", this.onBossDefeated, this)
    this.events.off("stopwatchCollected", this.onStopwatchCollected, this)
    this.events.off("shutdown", this.shutdown, this)
  }

  // ==========================================
  // GHOST REPLAY RECORDING SYSTEM
  // ==========================================

  /**
   * Initialize ghost recording for this level session
   * Loads any existing death replays from registry (persists through restarts)
   */
  initializeGhostRecording() {
    // Get existing death replays from registry (persists through level restarts)
    const existingReplays = this.registry.get(`ghostReplays_${this.levelId}`)
    
    if (this.isFreshStart || !existingReplays) {
      // Fresh start - clear all previous ghost data
      this.deathReplays = []
      this.registry.set(`ghostReplays_${this.levelId}`, [])
    } else {
      // Continuing session - restore previous death replays
      this.deathReplays = existingReplays
    }
    
    // Initialize current run recording
    this.currentRunPositions = []
    this.lastGhostRecordTime = 0
    this.ghostRecordInterval = 50 // Record position every 50ms
    this.ghostRecordStartTime = null // Will be set when timer starts
  }

  /**
   * Record player position for ghost replay
   * Called every frame from update()
   */
  recordGhostPosition(time) {
    if (!this.player || !this.player.active || this.player.isDead || this.gameCompleted) {
      return
    }
    
    // Log first recording
    if (this.currentRunPositions.length === 0) {
      console.log("[DynamicLevelScene] Starting ghost recording for run")
    }

    // Use run-relative time (from when recording started)
    if (this.ghostRecordStartTime === null) {
      this.ghostRecordStartTime = time
    }
    const relativeTime = time - this.ghostRecordStartTime

    // Only record at fixed intervals to reduce data size
    if (relativeTime - this.lastGhostRecordTime < this.ghostRecordInterval) {
      return
    }
    this.lastGhostRecordTime = relativeTime

    // Get current animation
    const currentAnim = this.player.anims?.currentAnim?.key || null

    // Record position data
    this.currentRunPositions.push({
      t: relativeTime,
      x: Math.round(this.player.x * 10) / 10, // Round to 1 decimal
      y: Math.round(this.player.y * 10) / 10,
      a: currentAnim,
      f: this.player.flipX ? 1 : 0
    })
  }

  /**
   * Save current run as a death replay
   * Called when player dies
   */
  saveDeathReplay() {
    console.log("[DynamicLevelScene] saveDeathReplay called, positions:", this.currentRunPositions.length)
    
    if (this.currentRunPositions.length > 0) {
      // Compress positions using delta encoding
      const compressedPositions = this.compressGhostPositions(this.currentRunPositions)
      
      this.deathReplays.push({
        positions: compressedPositions,
        deathTime: this.currentRunPositions[this.currentRunPositions.length - 1]?.t || 0,
        deathX: this.player?.x || 0,
        deathY: this.player?.y || 0
      })
      
      // Save to registry so it persists through restarts
      this.registry.set(`ghostReplays_${this.levelId}`, this.deathReplays)
      console.log("[DynamicLevelScene] Death replay saved, total deaths:", this.deathReplays.length)
    } else {
      console.warn("[DynamicLevelScene] No positions recorded for death replay!")
    }
    
    // Reset for next run
    this.currentRunPositions = []
    this.lastGhostRecordTime = 0
    this.ghostRecordStartTime = null
  }

  /**
   * Compress ghost positions using delta encoding
   * Reduces data size significantly for storage
   */
  compressGhostPositions(positions) {
    if (positions.length === 0) return []

    const compressed = [positions[0]] // First position is absolute

    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1]
      const curr = positions[i]

      compressed.push({
        t: curr.t,
        dx: Math.round((curr.x - prev.x) * 10), // Delta * 10 for precision
        dy: Math.round((curr.y - prev.y) * 10),
        a: curr.a !== prev.a ? curr.a : undefined, // Only store if changed
        f: curr.f !== prev.f ? curr.f : undefined
      })
    }

    return compressed
  }

  /**
   * Get all ghost replay data for VictoryUIScene
   * Returns death replays and the successful run
   */
  getGhostReplayData() {
    // Compress the successful run
    const successfulRun = this.currentRunPositions.length > 0 
      ? this.compressGhostPositions(this.currentRunPositions)
      : []

    return {
      deathReplays: this.deathReplays,
      successfulRun: {
        positions: successfulRun,
        completionTime: this.currentRunPositions[this.currentRunPositions.length - 1]?.t || 0
      }
    }
  }

  /**
   * Clear ghost replay data for this level
   * Called after level completion to free memory
   */
  clearGhostReplayData() {
    this.deathReplays = []
    this.currentRunPositions = []
    this.registry.set(`ghostReplays_${this.levelId}`, null)
  }

  generateDefaultLevelData() {
    // Generate procedural level based on world and level number
    const difficulty = this.calculateDifficulty()
    const tileSize = this.tileSize
    
    // Calculate map dimensions in tiles, then convert to pixels
    const mapWidthTiles = 30 + Math.floor(difficulty * 5)
    const mapHeightTiles = 12 + Math.floor(difficulty / 2)
    
    return {
      mapWidth: mapWidthTiles * tileSize,
      mapHeight: mapHeightTiles * tileSize,
      platforms: this.generatePlatforms(difficulty, mapWidthTiles, mapHeightTiles),
      hazards: this.generateHazards(difficulty, mapHeightTiles),
      fragments: this.generateFragmentPositions(mapWidthTiles),
      spawnPoint: { x: 2 * tileSize, y: (mapHeightTiles - 2) * tileSize },
      goalPoint: { x: (mapWidthTiles - 3) * tileSize, y: 4 * tileSize }
    }
  }

  calculateDifficulty() {
    // Difficulty scales from 0 to 10 based on progress
    let difficulty = 0
    
    if (this.worldNum > 0) {
      difficulty += (this.worldNum - 1) * 0.5
    }
    
    if (this.levelType === LEVEL_TYPES.NORMAL && this.levelNum) {
      difficulty += this.levelNum * 0.2
    }
    
    if (this.levelType === LEVEL_TYPES.BONUS) {
      difficulty += 2
    }
    
    if (this.levelType === LEVEL_TYPES.BOSS) {
      difficulty += 3
    }
    
    return Math.min(10, difficulty)
  }

  generatePlatforms(difficulty, mapWidthTiles, mapHeightTiles) {
    const platforms = []
    const tileSize = this.tileSize
    
    // Ground platform (in pixels)
    platforms.push({
      type: "platform",
      x: 0,
      y: (mapHeightTiles - 1) * tileSize,
      width: 8 * tileSize,
      height: tileSize
    })
    
    // Generate stepping platforms based on difficulty
    const numPlatforms = 5 + Math.floor(difficulty * 2)
    let currentX = 8
    let currentY = mapHeightTiles - 2
    
    for (let i = 0; i < numPlatforms; i++) {
      const gapX = 2 + Math.floor(Math.random() * (1 + difficulty / 3))
      const deltaY = Math.floor(Math.random() * 3) - 1
      
      currentX += gapX
      currentY = Phaser.Math.Clamp(currentY + deltaY, 2, mapHeightTiles - 2)
      
      if (currentX >= mapWidthTiles - 5) break
      
      const platWidth = 3 + Math.floor(Math.random() * 3)
      platforms.push({
        type: "platform",
        x: currentX * tileSize,
        y: currentY * tileSize,
        width: platWidth * tileSize,
        height: tileSize
      })
    }
    
    // Goal platform (in pixels)
    platforms.push({
      type: "platform",
      x: (mapWidthTiles - 5) * tileSize,
      y: 3 * tileSize,
      width: 5 * tileSize,
      height: tileSize
    })
    
    return platforms
  }

  generateHazards(difficulty, mapHeightTiles) {
    const hazards = []
    const tileSize = this.tileSize
    
    // Add spikes based on difficulty (in pixels)
    const numSpikes = Math.floor(difficulty * 1.5)
    
    for (let i = 0; i < numSpikes; i++) {
      hazards.push({
        type: "spike",
        x: (10 + i * 5) * tileSize,
        y: (mapHeightTiles - 1) * tileSize
      })
    }
    
    return hazards
  }

  generateFragmentPositions(mapWidthTiles) {
    // Generate fragment positions based on level type (in pixels)
    const fragments = []
    const tileSize = this.tileSize
    const numFragments = this.levelType === LEVEL_TYPES.BONUS ? 6 : 4
    
    for (let i = 0; i < numFragments; i++) {
      fragments.push({
        type: "fragment",
        x: (5 + i * 5) * tileSize,
        y: (8 - i) * tileSize
      })
    }
    
    return fragments
  }

  /**
   * Normalize level data from LevelDataManager format to DynamicLevelScene format
   * LevelDataManager uses pixel coordinates, DynamicLevelScene internal format uses tile coordinates
   * This method converts to a unified format where coordinates are already in pixels
   */
  normalizeLevelData(rawData) {
    // Check if data is in LevelDataManager format (has 'settings' object)
    if (rawData.settings) {
      // Extract metronome data - key remains "stopwatch" for backwards compatibility
      const stopwatch = rawData.stopwatch || rawData.settings?.stopwatch || null
      
      return {
        mapWidth: rawData.settings.width || 1920,
        mapHeight: rawData.settings.height || 768,
        // Platforms are already in pixels from LevelDataManager
        platforms: (rawData.platforms || []).map(p => ({
          type: "platform",
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height || 32,
          isPixels: true // Flag to indicate coordinates are already in pixels
        })),
        // Hazards are already in pixels
        hazards: (rawData.hazards || []).map(h => ({
          type: h.type || "spike",
          x: h.x,
          y: h.y,
          isPixels: true
        })),
        // Fragments are already in pixels
        fragments: (rawData.fragments || []).map(f => ({
          type: f.type || "fragment",
          x: f.x,
          y: f.y,
          isPixels: true
        })),
        // Spawn and goal in pixels - preserve facingDirection
        spawnPoint: rawData.spawn ? { x: rawData.spawn.x, y: rawData.spawn.y, facingDirection: rawData.spawn.facingDirection || "right", isPixels: true } : { x: 100, y: 600, facingDirection: "right", isPixels: true },
        goalPoint: rawData.goal ? { x: rawData.goal.x, y: rawData.goal.y, isPixels: true } : { x: 1800, y: 600, isPixels: true },
        // Metronome for speed run timing - already in pixels (key: stopwatch for backwards compatibility)
        stopwatch: stopwatch,
        // Preserve metadata for level name/description
        metadata: rawData.metadata || null,
        // Preserve style settings
        styleWorld: rawData.styleWorld || null,
        stylePreset: rawData.stylePreset || "auto",
        // Background visual settings
        backgroundBrightness: rawData.backgroundBrightness ?? 1.0,
        backgroundContrast: rawData.backgroundContrast ?? 1.0,
        useWorldBackgroundSettings: rawData.useWorldBackgroundSettings ?? true
      }
    }
    
    // Data is already in the expected format (tile coordinates), convert to pixels
    return {
      mapWidth: (rawData.mapWidth || 30) * this.tileSize,
      mapHeight: (rawData.mapHeight || 12) * this.tileSize,
      platforms: (rawData.platforms || []).map(p => ({
        type: p.type || "platform",
        x: p.x * this.tileSize,
        y: p.y * this.tileSize,
        width: p.width * this.tileSize,
        height: (p.height || 1) * this.tileSize,
        isPixels: true
      })),
      hazards: (rawData.hazards || []).map(h => ({
        type: h.type || "spike",
        x: h.x * this.tileSize,
        y: h.y * this.tileSize,
        isPixels: true
      })),
      fragments: (rawData.fragments || []).map(f => ({
        type: f.type || "fragment",
        x: f.x * this.tileSize,
        y: f.y * this.tileSize,
        isPixels: true
      })),
      spawnPoint: rawData.spawnPoint ? 
        { x: rawData.spawnPoint.x * this.tileSize, y: rawData.spawnPoint.y * this.tileSize, facingDirection: rawData.spawnPoint.facingDirection || "right", isPixels: true } : 
        { x: 100, y: 600, facingDirection: "right", isPixels: true },
      goalPoint: rawData.goalPoint ? 
        { x: rawData.goalPoint.x * this.tileSize, y: rawData.goalPoint.y * this.tileSize, isPixels: true } : 
        { x: 1800, y: 600, isPixels: true },
      // Metronome - convert from tile to pixel coordinates if present (key: stopwatch for backwards compatibility)
      stopwatch: rawData.stopwatch ? 
        { x: rawData.stopwatch.x * this.tileSize, y: rawData.stopwatch.y * this.tileSize } : null
    }
  }

  createBackground() {
    // Create themed background based on world
    const bgColor = this.getWorldBackgroundColor()
    this.cameras.main.setBackgroundColor(bgColor)

    // Add parallax elements
    this.createParallaxBackground()
  }

  getWorldBackgroundColor() {
    if (!this.world) return 0x1a1a2e
    
    const colors = {
      underground: 0x0a0a15,
      industrial: 0x0f0f1a,
      neon: 0x0a0520,
      rainy: 0x0a1015,
      festival: 0x15100a,
      arctic: 0x0a1520,
      corporate: 0x101015,
      arena: 0x150a10,
      media: 0x0f100f,
      contract: 0x100a0a,
      psychological: 0x100510,
      time: 0x05100f,
      glitch: 0x0f050a,
      clarity: 0x0f0f15,
      finale: 0x0a050f
    }
    return colors[this.world.theme] || 0x1a1a2e
  }

  /**
   * Get the background asset key for the current world
   * Maps world numbers to actual asset-pack.json background keys
   */
  getWorldBackgroundKey() {
    if (!this.worldNum) return "metroid_cavern_background"
    
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
    
    return worldBackgrounds[this.worldNum] || "metroid_cavern_background"
  }
  
  /**
   * Get the tileset asset key for the current world
   * Maps world numbers to actual asset-pack.json tileset keys
   */
  getWorldTilesetKey() {
    if (!this.worldNum) return "metroid_cavern_tileset"
    
    const worldTilesets = {
      1: "detroit_winter_tileset",
      2: "berlin_techno_tileset",
      3: "tokyo_neon_tileset",
      4: "london_punk_tileset",
      5: "festival_outdoor_tileset",
      6: "reykjavik_ice_tileset",
      7: "la_studio_tileset",
      8: "sydney_opera_tileset",
      9: "nyc_arena_tileset",
      10: "corporate_trap_tileset",
      11: "doubt_mirror_tileset",
      12: "time_fracture_tileset",
      13: "noise_glitch_tileset",
      14: "clarity_light_tileset",
      15: "diminished_finale_tileset"
    }
    
    return worldTilesets[this.worldNum] || "metroid_cavern_tileset"
  }

  createParallaxBackground() {
    // Get world-specific background key from mapping
    let bgKey = this.getWorldBackgroundKey()
    let useTint = false
    
    // Fallback to metroid cavern if the world's background doesn't exist
    if (!this.textures.exists(bgKey)) {
      console.warn(`[DynamicLevelScene] Background "${bgKey}" not found, falling back to metroid_cavern_background`)
      bgKey = "metroid_cavern_background"
      useTint = true
    }
    
    if (this.textures.exists(bgKey)) {
      const bgTexture = this.textures.get(bgKey)
      const bgWidth = bgTexture.getSourceImage().width
      const bgHeight = bgTexture.getSourceImage().height
      
      // Scale to fit map height
      const scale = this.mapHeight / bgHeight
      
      // Tile horizontally if needed (like legacy levels do)
      const scaledWidth = bgWidth * scale
      const numTiles = Math.ceil(this.mapWidth / scaledWidth) + 1
      
      // Get background visual settings (brightness/contrast)
      const bgSettings = this.getBackgroundVisualSettings()
      
      for (let i = 0; i < numTiles; i++) {
        const bg = this.add.image(i * scaledWidth, this.mapHeight, bgKey)
        bg.setOrigin(0, 1)
        bg.setScale(scale)
        bg.setScrollFactor(0.2) // Parallax effect
        bg.setDepth(-10)
        
        // Apply world-specific tint if using fallback background
        if (useTint) {
          bg.setTint(this.getWorldTintColor())
        }
        
        // Apply brightness/contrast visual adjustments
        this.applyBackgroundVisualSettings(bg, bgSettings)
      }
      
      console.log(`[DynamicLevelScene] Created background with key: ${bgKey}, brightness: ${bgSettings.brightness}, contrast: ${bgSettings.contrast}`)
    }
  }
  
  /**
   * Get background visual settings from level data or world settings
   * Priority: level-specific > world-specific > default
   */
  getBackgroundVisualSettings() {
    // Check for level-specific settings first
    const levelData = LevelDataManager.getLevel(this.levelId)
    
    // If level has its own settings and isn't using world settings
    if (levelData && levelData.useWorldBackgroundSettings === false) {
      return {
        brightness: levelData.backgroundBrightness ?? 1.0,
        contrast: levelData.backgroundContrast ?? 1.0
      }
    }
    
    // Otherwise use world defaults (could be fetched from Supabase world_metadata)
    // For now, we'll use reasonable defaults since world settings need async loading
    return {
      brightness: levelData?.backgroundBrightness ?? 1.0,
      contrast: levelData?.backgroundContrast ?? 1.0
    }
  }
  
  /**
   * Apply brightness/contrast settings to a background image
   * Uses tint to simulate brightness/contrast adjustment
   * 
   * Brightness: 0.0 = black, 1.0 = full brightness (no tint), values > 1.0 not possible with tint
   * Contrast: Simulated by blending towards grey (lower contrast) or saturating colors (higher contrast)
   */
  applyBackgroundVisualSettings(bg, settings) {
    const brightness = settings.brightness ?? 1.0
    const contrast = settings.contrast ?? 1.0
    
    // Calculate tint color based on brightness
    // brightness 0.0 = 0x000000 (black), brightness 1.0 = 0xFFFFFF (no tint/full brightness)
    // Clamp to 0-1 range since tint can only darken, not brighten
    const clampedBrightness = Phaser.Math.Clamp(brightness, 0, 1)
    const brightnessInt = Math.round(clampedBrightness * 255)
    
    // Apply as a grey tint (affects all RGB channels equally)
    const tintValue = (brightnessInt << 16) | (brightnessInt << 8) | brightnessInt
    
    // Apply brightness tint (only if not at full brightness)
    if (brightness < 1.0) {
      bg.setTint(tintValue)
    } else {
      // Clear any existing tint for full brightness
      bg.clearTint()
    }
    
    // For contrast, we use alpha to simulate reduced contrast
    // Lower contrast = more transparent (fades towards camera background color)
    // Higher contrast = full alpha (can't truly increase contrast without shaders)
    if (contrast < 1.0) {
      // Map contrast 0.0-1.0 to alpha range that looks reasonable (0.3-1.0)
      // This prevents the background from becoming completely invisible
      const minAlpha = 0.3
      const alpha = minAlpha + (contrast * (1.0 - minAlpha))
      bg.setAlpha(alpha)
    } else {
      bg.setAlpha(1.0)
    }
  }
  
  getWorldTintColor() {
    if (!this.world) return 0xffffff
    
    // Lighter tint colors that overlay nicely on the background
    const colors = {
      underground: 0xff8888,  // Red tint for Detroit basement
      industrial: 0xaaaaaa,   // Grey for Berlin
      neon: 0x88ffff,         // Cyan for Tokyo neon
      rainy: 0x8888ff,        // Blue for London rain
      festival: 0xffcc88,     // Orange for festival
      arctic: 0x88ddff,       // Ice blue for Reykjavik
      corporate: 0xff6666,    // Corporate red for LA
      arena: 0xff88ff,        // Pink for Sydney arena
      media: 0xffff88,        // Yellow for NYC media
      contract: 0xff4444,     // Dark red for contract trap
      psychological: 0xcc88ff,// Purple for doubt
      time: 0x88ffaa,         // Green for time fracture
      glitch: 0xff88cc,       // Pink glitch
      clarity: 0xffffff,      // White for clarity
      finale: 0xff88ff        // Pink for finale
    }
    return colors[this.world.theme] || 0xffffff
  }

  createPlatforms() {
    const platforms = this.levelData.platforms || []
    
    platforms.forEach(plat => {
      if (plat.type === "platform" || plat.type === "solid") {
        this.createPlatform(plat)
      }
    })
  }

  createPlatform(platData) {
    // Coordinates are already in pixels after normalization
    const x = platData.x
    const y = platData.y
    const width = platData.width
    const height = platData.height || this.tileSize

    // Use unified PlatformRenderer - SAME renderer used by CustomLevelTestScene
    // This ensures TEST mode and GAMEPLAY mode render IDENTICALLY
    // 
    // Style priority:
    // 1. Platform-specific style (platData.styleWorld) - for custom level styling
    // 2. Level data style (this.levelData.styleWorld) - set in Level Designer
    // 3. World number from level ID - default for World Tour levels
    const styleWorld = platData.styleWorld ?? this.levelData?.styleWorld ?? this.worldNum
    const stylePreset = platData.stylePreset ?? this.levelData?.stylePreset ?? "auto"
    
    this.platformRenderer.createPlatform(x, y, width, height, {
      styleWorld,
      stylePreset
    })
    
    // Create collision body using the renderer's helper
    this.platformRenderer.createCollider(x, y, width, height, this.platforms)
  }

  // Legacy color methods kept for backward compatibility with other systems
  getWorldPlatformColor() {
    if (!this.world) return 0x4a90d9
    
    const colors = {
      underground: 0x3a3a3a,
      industrial: 0x555555,
      neon: 0x2a2a5a,
      rainy: 0x3a4a5a,
      festival: 0x5a4a3a,
      arctic: 0x4a5a6a,
      corporate: 0x4a4a4a,
      arena: 0x5a3a4a,
      media: 0x4a4a3a,
      contract: 0x4a3a3a,
      psychological: 0x4a3a5a,
      time: 0x3a5a4a,
      glitch: 0x5a3a4a,
      clarity: 0x5a5a5a,
      finale: 0x4a3a5a
    }
    return colors[this.world.theme] || 0x4a90d9
  }

  getWorldAccentColor() {
    if (!this.world) return 0x00ff88
    
    const colors = {
      underground: 0xff6b6b,
      industrial: 0x888888,
      neon: 0x00ffff,
      rainy: 0x6b8cff,
      festival: 0xffaa00,
      arctic: 0x88ddff,
      corporate: 0xff4444,
      arena: 0xff69b4,
      media: 0xffff00,
      contract: 0x880000,
      psychological: 0xa855f7,
      time: 0x00ff88,
      glitch: 0xff0088,
      clarity: 0xffffff,
      finale: 0xff69b4
    }
    return colors[this.world.theme] || 0x00ff88
  }

  createPlayer() {
    const spawn = this.levelData.spawnPoint || { x: 100, y: 600, facingDirection: "right" }
    // Coordinates are already in pixels (top-left of tile) after normalization
    // Add half tile to center spawn horizontally, spawn Y is at floor level (bottom of tile)
    const spawnX = spawn.x + this.tileSize / 2
    const spawnY = spawn.y + this.tileSize // Player stands on tile floor

    this.player = new TeddyPlayer(this, spawnX, spawnY)
    this.player.setDepth(10)
    
    // Apply spawn facing direction from level data
    this.spawnFacingDirection = spawn.facingDirection || "right"
    if (this.spawnFacingDirection === "left") {
      this.player.facingDirection = "left"
      this.player.setFlipX(true)
      // Also update the player's spawn point facing for respawns
      this.player.spawnFacingDirection = "left"
    } else {
      this.player.spawnFacingDirection = "right"
    }
  }

  createFragments(emitEvent = true) {
    const fragmentData = this.levelData.fragments || []
    
    // Track collectible counts for UI
    this.collectibleCounts = {
      instruments: {},
      notes: 0,
      bonus: null,
      demoFragment: false,
      total: 0
    }
    
    // Track how many were already collected this session
    let alreadyCollectedCount = 0
    
    fragmentData.forEach((frag, index) => {
      // Get the fragment type - could be instrument, note, bonus, or demo
      const fragType = frag.type || this.getFragmentType(index)
      
      // Always count towards total (for UI display)
      this.updateCollectibleCounts(fragType)
      
      // Check if this fragment was already collected this session
      if (LevelSessionManager.isFragmentCollected(index)) {
        alreadyCollectedCount++
        return // Skip creating this fragment - already collected
      }
      
      // Coordinates are stored as top-left pixel position of the tile
      // Add half tile to center the fragment within the tile
      const x = frag.x + this.tileSize / 2
      const y = frag.y + this.tileSize / 2
      
      // Create the appropriate collectible
      const fragment = new MusicFragment(this, x, y, fragType, index)
      this.fragments.add(fragment)
    })
    
    // Calculate total collectibles for UI
    this.totalCollectibles = this.collectibleCounts.total
    
    // Set collected count to already-collected items from this session
    this.collectedCount = alreadyCollectedCount
    
    // Only emit event if requested (and UIScene is ready)
    if (emitEvent) {
      this.events.emit("collectiblesLoaded", {
        total: this.totalCollectibles,
        collected: this.collectedCount,
        counts: this.collectibleCounts
      })
    }
  }

  updateCollectibleCounts(fragType) {
    if (fragType === 'note') {
      this.collectibleCounts.notes++
    } else if (['drums', 'guitar', 'bass', 'keyboard', 'microphone'].includes(fragType)) {
      this.collectibleCounts.instruments[fragType] = 
        (this.collectibleCounts.instruments[fragType] || 0) + 1
    } else if (['mixtape', 'cd', 'vinyl', 'waveform', 'recordDeal'].includes(fragType)) {
      this.collectibleCounts.bonus = fragType
    } else if (fragType === 'demoFragment') {
      this.collectibleCounts.demoFragment = true
    }
    
    this.collectibleCounts.total++
  }

  getFragmentType(index) {
    // Default fragment types for procedurally generated levels
    const types = ["note", "bass", "drums", "guitar", "keyboard", "microphone"]
    return types[index % types.length]
  }

  createHazards() {
    const hazardData = this.levelData.hazards || []
    
    hazardData.forEach(hazard => {
      this.createHazard(hazard)
    })
  }

  createHazard(hazardData) {
    // Coordinates are stored as top-left pixel position of the tile
    // Center hazard horizontally, position at floor level vertically
    const x = hazardData.x + this.tileSize / 2
    const y = hazardData.y + this.tileSize // Spike sits on tile floor
    
    // Use spike texture if available, otherwise create styled triangle
    if (this.textures.exists("spike_hazard")) {
      const spike = this.physics.add.image(x, y, "spike_hazard")
      spike.setOrigin(0.5, 1)
      
      // Scale spike to fit tile
      const targetHeight = this.tileSize * 0.5
      spike.setScale(targetHeight / spike.height)
      
      spike.body.setAllowGravity(false)
      spike.body.setImmovable(true)
      spike.body.setSize(spike.width * 0.6, spike.height * 0.5)
      spike.body.setOffset(spike.width * 0.2, spike.height * 0.5)
      
      this.hazards.add(spike)
    } else {
      // Fallback: Create styled triangle hazard
      const hazard = this.add.triangle(x, y - 16, 0, 32, 16, 0, 32, 32, 0xff4444)
      hazard.setOrigin(0.5, 1)
      this.physics.add.existing(hazard, true)
      hazard.body.setSize(24, 24)
      this.hazards.add(hazard)
    }
  }

  createGoal() {
    const goal = this.levelData.goalPoint || { x: 1800, y: 600 }
    // Coordinates are stored as top-left pixel position of the tile
    // Add half tile to center goal horizontally, position at floor level
    const goalX = goal.x + this.tileSize / 2
    const goalY = goal.y + this.tileSize // Goal sits on tile floor

    this.goal = new LevelGoal(this, goalX, goalY)
  }

  /**
   * Create slow zones (cables) from level data
   * Cables are hazard-type elements that slow player movement when walked through
   */
  createSlowZones() {
    // Check for cables in level data
    // They can be in: placedObjects with type 'cable' or 'slow_zone', or a dedicated cables array
    let cableData = []
    
    // Check placedObjects
    if (Array.isArray(this.levelData.placedObjects)) {
      const cables = this.levelData.placedObjects.filter(obj => 
        obj.type === 'cable' || obj.type === 'slow_zone' || obj.type === 'cables'
      )
      cableData.push(...cables)
    }
    
    // Check dedicated cables/slowZones array
    if (Array.isArray(this.levelData.cables)) {
      cableData.push(...this.levelData.cables)
    }
    if (Array.isArray(this.levelData.slowZones)) {
      cableData.push(...this.levelData.slowZones)
    }
    
    // Check hazards for cable type
    if (Array.isArray(this.levelData.hazards)) {
      const cableHazards = this.levelData.hazards.filter(h => 
        h.type === 'cable' || h.type === 'slow_zone' || h.type === 'cables'
      )
      cableData.push(...cableHazards)
    }
    
    if (cableData.length === 0) return
    
    console.log("[DynamicLevelScene] Creating", cableData.length, "slow zones (cables)")
    
    cableData.forEach(cable => {
      this.createSlowZone(cable)
    })
  }
  
  /**
   * Create a single slow zone (cable bundle)
   */
  createSlowZone(cableData) {
    // Coordinates are stored as top-left pixel position of the tile
    const x = cableData.x + this.tileSize / 2
    const y = cableData.y + this.tileSize // Cable sits on tile floor
    
    // Try to use cable texture if available
    let zone
    if (this.textures.exists("cable_hazard") || this.textures.exists("cables")) {
      const textureKey = this.textures.exists("cable_hazard") ? "cable_hazard" : "cables"
      zone = this.physics.add.image(x, y, textureKey)
      zone.setOrigin(0.5, 1)
      
      // Scale to fit tile
      const targetHeight = this.tileSize * 0.6
      zone.setScale(targetHeight / zone.height)
    } else {
      // Fallback: Create styled rectangle to represent cables
      zone = this.add.rectangle(x, y - this.tileSize * 0.3, this.tileSize * 0.8, this.tileSize * 0.4, 0x444444, 0.7)
      zone.setOrigin(0.5, 0.5)
      this.physics.add.existing(zone, true)
      
      // Add visual indicator (wavy lines to represent cables)
      const graphics = this.add.graphics()
      graphics.lineStyle(2, 0x222222, 0.8)
      for (let i = 0; i < 3; i++) {
        const lineY = y - this.tileSize * 0.1 - i * 8
        graphics.beginPath()
        graphics.moveTo(x - 15, lineY)
        graphics.lineTo(x - 5, lineY - 3)
        graphics.lineTo(x + 5, lineY + 3)
        graphics.lineTo(x + 15, lineY)
        graphics.strokePath()
      }
    }
    
    // Setup physics body
    if (zone.body) {
      zone.body.setAllowGravity(false)
      zone.body.setImmovable(true)
      zone.body.setSize(this.tileSize * 0.8, this.tileSize * 0.5)
    } else {
      this.physics.add.existing(zone, true)
      zone.body.setSize(this.tileSize * 0.8, this.tileSize * 0.5)
    }
    
    // Store slow factor on zone
    zone.slowFactor = cableData.slowFactor || 0.4
    
    this.slowZones.add(zone)
  }

  /**
   * Create metronome if present in level data
   * Metronome triggers the speed run timer when collected
   * (Internal key remains "stopwatch" for backwards compatibility)
   */
  createStopwatch() {
    // Check for metronome in level data
    // Can be in: levelData.stopwatch, levelData.settings.stopwatch, or in placedObjects
    let metronomeData = null
    
    // Check direct stopwatch property (legacy key)
    if (this.levelData.stopwatch) {
      metronomeData = this.levelData.stopwatch
    }
    
    // Check settings
    if (!metronomeData && this.levelData.settings?.stopwatch) {
      metronomeData = this.levelData.settings.stopwatch
    }
    
    // Check placed objects (from Level Designer)
    if (!metronomeData && Array.isArray(this.levelData.placedObjects)) {
      const metronomeObj = this.levelData.placedObjects.find(obj => obj.type === 'stopwatch')
      if (metronomeObj) {
        metronomeData = { x: metronomeObj.x, y: metronomeObj.y }
      }
    }
    
    // Also check a dedicated stopwatches array (legacy)
    if (!metronomeData && Array.isArray(this.levelData.stopwatches) && this.levelData.stopwatches.length > 0) {
      metronomeData = this.levelData.stopwatches[0]
    }
    
    if (metronomeData) {
      this.hasStopwatch = true
      
      // Create the metronome sprite
      const x = metronomeData.x + this.tileSize / 2
      const y = metronomeData.y + this.tileSize / 2
      
      this.stopwatch = new SpeedRunStopwatch(this, x, y)
      
      // Add collision detection with player
      this.physics.add.overlap(this.player, this.stopwatch, this.onCollectMetronome, null, this)
      
      console.log("[DynamicLevelScene] Metronome created at", x, y)
    } else {
      this.hasStopwatch = false
      console.log("[DynamicLevelScene] No metronome in level - timer starts immediately")
    }
  }

  /**
   * Handle metronome collection
   */
  onCollectMetronome(player, metronome) {
    if (!metronome.active || metronome.isCollected) return
    metronome.collect()
  }

  /**
   * Handle stopwatchCollected event - starts the speed run timer
   * (Event name unchanged for backwards compatibility)
   */
  onStopwatchCollected(data) {
    console.log("[DynamicLevelScene] Metronome collected - starting speed run timer!")
    this.startTimer()
  }

  /**
   * Start the level timer
   */
  startTimer() {
    if (this.timerStarted) return
    
    this.timerStarted = true
    this.startTime = this.time.now
    
    // Emit event so UIScene knows timer has started
    this.events.emit("timerStarted", { startTime: this.startTime })
    
    console.log("[DynamicLevelScene] Timer started at", this.startTime)
  }

  setupCollisions() {
    // Player vs platforms
    this.physics.add.collider(this.player, this.platforms.getChildren())

    // Player vs hazards
    this.physics.add.overlap(this.player, this.hazards.getChildren(), this.onPlayerHitHazard, null, this)

    // Player vs fragments
    this.physics.add.overlap(this.player, this.fragments.getChildren(), this.onCollectFragment, null, this)

    // Player vs goal
    this.physics.add.overlap(this.player, this.goal, this.onReachGoal, null, this)
    
    // Player vs slow zones (cables) - slows movement when inside
    if (this.slowZones.getChildren().length > 0) {
      this.physics.add.overlap(this.player, this.slowZones.getChildren(), this.onPlayerInSlowZone, null, this)
    }
  }
  
  /**
   * Handle player entering a slow zone (cables)
   * Cables impede movement: slower walk speed, reduced jump power
   */
  onPlayerInSlowZone(player, zone) {
    if (player.isDead) return
    
    // Apply slow effect
    player.slowZoneTimer = 100 // Stay slowed for 100ms after leaving
    
    // Reduce velocities while in zone
    const slowFactor = zone.slowFactor || 0.5
    
    if (Math.abs(player.body.velocity.x) > player.walkSpeed * slowFactor) {
      player.body.setVelocityX(player.body.velocity.x * slowFactor)
    }
    
    // Limit jump power while in cables
    if (player.body.velocity.y < -player.jumpPower * slowFactor) {
      player.body.setVelocityY(-player.jumpPower * slowFactor)
    }
  }

  setupInputs() {
    this.cursors = this.input.keyboard.createCursorKeys()
    // Add space for running (B button on mobile)
    this.cursors.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.pauseKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEMICOLON)
    
    // Quick restart with "/" key - resets player to spawn point
    this.input.keyboard.on("keydown-FORWARD_SLASH", () => this.resetPlayerToSpawn())
    
    // Spawn shifting with "Q" key (premium/unlockable feature)
    this.input.keyboard.on("keydown-Q", () => this.shiftSpawnPoint())
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
    this.pauseGame()
  }

  setupBossFight() {
    this.bossManager = new BossFightManager(this, this.worldNum)
    
    // Start boss fight after short delay
    this.time.delayedCall(1000, () => {
      this.bossManager.start()
    })
  }

  showLevelIntro() {
    const { width, height } = this.cameras.main
    
    // Use custom level name from metadata if available (saved from Level Designer)
    let levelName = this.levelData?.metadata?.name || "Tutorial"
    let subtitle = this.levelData?.metadata?.description || "Learn the basics"
    
    // Only fall back to generated name if metadata name looks like a default/levelId
    if (this.world && (!levelName || levelName === this.levelId || levelName.startsWith("W"))) {
      if (this.levelType === LEVEL_TYPES.NORMAL) {
        levelName = `${this.world.location} - Level ${this.levelNum}`
        subtitle = this.world.mechanicFocus
      } else if (this.levelType === LEVEL_TYPES.BONUS) {
        const bonus = BONUS_PURPOSES[`b${this.levelNum}`]
        levelName = `${this.world.location} - ${bonus?.name || "Bonus"}`
        subtitle = bonus?.reward?.replace("_", " ") || "Special challenge"
      } else if (this.levelType === LEVEL_TYPES.BOSS) {
        levelName = `BOSS: ${this.world.bossName}`
        subtitle = this.world.bossMechanic
      }
    }

    const introText = this.add.text(width / 2, height / 3, levelName.toUpperCase(), {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff",
      backgroundColor: "#000000aa",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100)

    const subText = this.add.text(width / 2, height / 3 + 45, subtitle, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100)

    // Fade out
    this.tweens.add({
      targets: [introText, subText],
      alpha: 0,
      delay: 2000,
      duration: 500,
      onComplete: () => {
        introText.destroy()
        subText.destroy()
      }
    })
  }

  update(time, delta) {
    // Handle replay mode update separately
    if (this.isReplayMode) {
      this.updateReplayMode(time, delta)
      return
    }
    
    if (!this.player || !this.player.active) return

    // Get merged controls (keyboard + touch)
    const controls = getMergedControls(this.cursors, this.registry)
    
    // Update player
    this.player.update(controls, time, delta)

    // Record ghost position for replay
    this.recordGhostPosition(time)

    // Update boss if active
    if (this.bossManager) {
      this.bossManager.update(delta)
    }

    // Check for restart
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.restartLevel()
    }

    // Check for pause (ESC or semicolon key)
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey) || Phaser.Input.Keyboard.JustDown(this.pauseKey2)) {
      this.pauseGame()
    }

    // Check for death (fall off screen) - guard against multiple calls
    if (this.player.y > this.mapHeight + 100 && !this.player.isDead) {
      console.log("[DynamicLevelScene] Player fell off map - y:", this.player.y, "mapHeight:", this.mapHeight)
      this.onPlayerDeath()
    }
  }
  
  /**
   * Update function for replay mode - plays back ghost positions
   */
  updateReplayMode(time, delta) {
    if (this.replayPaused || this.replayCompleted || !this.ghosts) {
      return
    }
    
    // Calculate playback time
    const playbackTime = (time - this.replayStartTime) * this.replaySpeed
    
    // Update time display
    if (this.replayTimeText) {
      this.replayTimeText.setText(`${(playbackTime / 1000).toFixed(3)}s`)
    }
    
    // Update each ghost (skip culled ghosts for performance)
    let stillActiveCount = 0
    
    this.ghosts.forEach(ghost => {
      if (!ghost.active || ghost.isDead || ghost.isCulled) return
      
      const position = this.getGhostPosition(ghost, playbackTime)
      
      if (position) {
        stillActiveCount++
        ghost.setPosition(position.x, position.y)
        
        // Update animation
        if (position.a && position.a !== ghost.lastAnim) {
          ghost.lastAnim = position.a
          if (this.anims.exists(position.a)) {
            ghost.play(position.a, true)
          }
        }
        
        // Update flip
        if (position.f !== undefined) {
          ghost.setFlipX(position.f === 1)
        }
      } else if (!ghost.isWinner) {
        // Ghost reached end of data (death point)
        this.onGhostDeath(ghost)
      }
    })
    
    // Update active ghost count
    if (stillActiveCount !== this.activeGhosts) {
      this.activeGhosts = stillActiveCount
      if (this.ghostCountText) {
        this.ghostCountText.setText(`${this.activeGhosts} ghost${this.activeGhosts !== 1 ? 's' : ''} remaining`)
      }
    }
    
    // Check if replay is complete
    if (this.totalGhosts > 0 && (this.activeGhosts === 0 || (this.successfulGhost && this.successfulGhost.isDead))) {
      this.onReplayComplete()
    }
  }
  
  getGhostPosition(ghost, playbackTime) {
    const positions = ghost.positionData
    if (!positions || positions.length === 0) return null
    
    // Advance playback index
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
    
    // Interpolate for smooth movement
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
  
  onGhostDeath(ghost) {
    if (ghost.isDead) return
    ghost.isDead = true
    
    // Fade out effect
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
  }
  
  onReplayComplete() {
    if (this.replayCompleted) return
    this.replayCompleted = true
    
    const { width, height } = this.cameras.main
    
    // Show completion message
    const container = this.add.container(width / 2, height / 2)
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
      `Total attempts: ${this.totalGhosts}\nWinner time: ${(this.replayCompletionTimeMs / 1000).toFixed(3)}s`, {
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
    
    container.add([bg, title, statsText, exitHint])
    
    // Animate in
    container.setScale(0)
    this.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: "Back.easeOut"
    })
    
    // Allow exit
    this.input.keyboard.once("keydown-SPACE", () => this.exitReplayMode())
    this.input.keyboard.once("keydown-ESC", () => this.exitReplayMode())
  }

  onPlayerHitHazard(player, hazard) {
    if (player.isInvulnerable || player.isDead) return
    this.onPlayerDeath()
  }

  onCollectFragment(player, fragment) {
    // Guard against multiple collision calls for the same fragment
    if (!fragment.active || fragment.isCollected) return
    // Just call collect() - MusicFragment.collect() already emits the "fragmentCollected" event
    // with proper {type, id, category} data - no need to emit again here
    fragment.collect()
  }

  onReachGoal(player, goal) {
    if (this.gameCompleted) return
    this.completeLevel()
  }

  onFragmentCollected(fragment) {
    // Get fragment type and index from the event data
    const fragmentType = fragment.type || fragment.fragmentType || null
    const fragmentIndex = fragment.id !== undefined ? fragment.id : null
    
    // Guard: Check if this fragment was already counted (prevents double-counting)
    if (fragmentIndex !== null && LevelSessionManager.isFragmentCollected(fragmentIndex)) {
      console.log(`[DynamicLevelScene] Fragment ${fragmentIndex} already collected, skipping`)
      return
    }
    
    // Mark this fragment as collected in the session (persists through deaths)
    if (fragmentIndex !== null) {
      LevelSessionManager.collectFragment(fragmentIndex)
    }
    
    // Track collected fragments count
    this.collectedCount++
    
    // Track collected fragment IDs for progress recording
    // IMPORTANT: Always use unique IDs (fragment_0, fragment_1, etc.) to prevent
    // duplicate types (like multiple "note" entries) from collapsing when merged with Set
    if (!this.collectedFragmentIds) {
      this.collectedFragmentIds = []
    }
    // Always use the fragment index for unique identification
    // The type is useful for UI but for progress tracking we need unique IDs
    if (fragmentIndex !== null) {
      this.collectedFragmentIds.push(`fragment_${fragmentIndex}`)
    } else if (fragmentType) {
      // Fallback: use type with timestamp for uniqueness (rare edge case)
      this.collectedFragmentIds.push(`${fragmentType}_${Date.now()}`)
    }
    
    // Check if this is a hidden B2 unlock item
    this.checkHiddenItemCollection(fragmentType)
    
    // Emit UI update event with current collection status
    this.events.emit("updateFragmentUI", {
      collected: this.collectedCount,
      total: this.totalCollectibles || 0,
      type: fragmentType // Pass the type so UIScene can update instrument icons
    })
    
    // Note: Sound is played by MusicFragment.collect() - don't play here to avoid duplicate
  }
  
  /**
   * Check if a collected item is the hidden B2 unlock item for this world
   */
  checkHiddenItemCollection(fragmentType) {
    if (!this.levelId || !this.worldNum) return
    
    // Map fragment types to hidden item types
    const typeMapping = {
      "record_deal": "record_deal",
      "recordDeal": "record_deal",
      "vinyl": "vinyl",
      "mixtape": "mixtape",
      "cd": "cd",
      "golden_note": "golden_note",
      "goldenNote": "golden_note"
    }
    
    const normalizedType = typeMapping[fragmentType]
    if (!normalizedType) return // Not a special item type
    
    // Check if this level is designated to contain the hidden item for this world
    const hiddenItemInfo = WorldManager.levelHasHiddenItem(this.levelId)
    
    if (hiddenItemInfo.hasHiddenItem && hiddenItemInfo.itemType === normalizedType) {
      // This is the hidden B2 unlock item! Mark it as found
      WorldManager.foundHiddenItem(this.worldNum)
      
      // Show special unlock notification
      this.showHiddenItemUnlockNotification()
    }
  }
  
  /**
   * Show a special notification when the B2 unlock hidden item is found
   */
  showHiddenItemUnlockNotification() {
    const { width, height } = this.cameras.main
    
    // Create celebratory notification
    const container = this.add.container(width / 2, height / 2 - 100)
    container.setDepth(200)
    container.setScrollFactor(0)
    
    // Background
    const bg = this.add.rectangle(0, 0, 350, 100, 0x0a0a1a, 0.95)
      .setStrokeStyle(3, 0xffd700)
    container.add(bg)
    
    // Icon
    const icon = this.add.text(0, -25, "🔓", { fontSize: "32px" }).setOrigin(0.5)
    container.add(icon)
    
    // Text
    const text = this.add.text(0, 15, "SECRET FOUND!\nBonus Level 2 Unlocked!", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffd700",
      align: "center"
    }).setOrigin(0.5)
    container.add(text)
    
    // Sound effect
    if (this.sound.get("track_unlock_sound")) {
      this.sound.play("track_unlock_sound", { volume: 0.6 })
    } else if (this.sound.get("ui_confirm_sound")) {
      this.sound.play("ui_confirm_sound", { volume: 0.5 })
    }
    
    // Animate in and out
    container.setScale(0)
    this.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: container,
          alpha: 0,
          y: container.y - 50,
          delay: 3000,
          duration: 500,
          onComplete: () => container.destroy()
        })
      }
    })
  }

  onBossDefeated(worldNum) {
    // Check if we have post-boss cutscenes to play
    const cutsceneSequence = CutsceneFlowManager.getPostBossCutsceneSequence(worldNum)
    
    if (cutsceneSequence.length > 0) {
      // Store boss completion data for after cutscenes
      this.registry.set("bossVictoryData", {
        worldNum: worldNum,
        levelId: this.levelId,
        deathCount: this.deathCount,
        completionTime: Math.floor((this.time.now - this.startTime) / 1000),
        allFragments: this.totalCollectibles > 0 && this.collectedCount >= this.totalCollectibles,
        collectedCount: this.collectedCount,
        totalCollectibles: this.totalCollectibles
      })
      
      // Store the cutscene sequence to play
      this.registry.set("pendingCutsceneSequence", cutsceneSequence)
      this.registry.set("cutsceneSequenceIndex", 0)
      
      // Mark level as completed before cutscenes
      LevelSessionManager.clearSession(this.levelId)
      WorldManager.completeLevel(this.levelId)
      
      // Stop UI and current scene, start first cutscene
      this.scene.stop("UIScene")
      BGMManager.stop()
      
      const firstCutscene = cutsceneSequence[0]
      this.scene.start(firstCutscene.sceneKey, {
        returnScene: "PostBossCutsceneHandler",
        returnData: { worldNum: worldNum }
      })
    } else {
      // No cutscenes - just complete the level normally
      this.completeLevel()
    }
  }

  onPlayerDeath() {
    // Guard against multiple death calls per life
    if (!this.player || this.player.isDead || this.isProcessingDeath) {
      console.log("[DynamicLevelScene] onPlayerDeath blocked - player:", !!this.player, "isDead:", this.player?.isDead, "isProcessingDeath:", this.isProcessingDeath)
      return
    }
    this.isProcessingDeath = true
    
    this.deathCount++
    console.log("[DynamicLevelScene] Death processed! Count:", this.deathCount)
    
    // Save death count to registry so it persists through restarts
    this.registry.set(`deathCount_${this.levelId}`, this.deathCount)
    
    // Emit death count update to UIScene
    this.events.emit("updateDeathCount", this.deathCount)
    
    // Save current run as a death replay before resetting
    this.saveDeathReplay()
    
    this.player.die()
    
    // Quick restart
    this.time.delayedCall(500, () => {
      this.restartLevel()
    })
  }

  restartLevel() {
    // Stop UIScene so it gets properly recreated with fresh state
    this.scene.stop("UIScene")
    
    // Don't stop music - BGMManager will handle continuation for same level
    // freshStart: false means collected fragments persist through this restart
    this.scene.restart({ 
      levelId: this.levelId, 
      worldNum: this.worldNum, 
      levelType: this.levelType,
      freshStart: false // Preserve collected fragments
    })
  }

  /**
   * Reset player to spawn point (quick respawn with "/" key)
   * This doesn't count as a death, just repositions the player
   */
  resetPlayerToSpawn() {
    if (this.gameCompleted || !this.player || !this.player.active) return
    
    // Use shifted spawn if available, otherwise level data spawn
    const shiftedSpawn = this.registry.get("shiftedSpawnPoint_" + this.levelId)
    const defaultSpawn = this.levelData.spawnPoint || { x: 100, y: 600 }
    const spawn = shiftedSpawn || defaultSpawn
    
    // Reset player position and state
    this.player.setPosition(spawn.x, spawn.y)
    this.player.body.setVelocity(0, 0)
    
    // Apply spawn facing direction
    const facingDirection = this.spawnFacingDirection || "right"
    this.player.facingDirection = facingDirection
    this.player.setFlipX(facingDirection === "left")
    
    // Reset player state if it has a respawn method
    // Note: respawn() will now use the player's spawnFacingDirection
    if (typeof this.player.respawn === "function") {
      this.player.respawn()
    }
  }
  
  /**
   * Shift spawn point to current player position (Q key)
   * This is the "spawn-shifting" premium/unlockable feature
   */
  shiftSpawnPoint() {
    // Check if feature is unlocked
    if (!isSpawnShiftingActive()) {
      this.showSpawnShiftLockedMessage()
      return
    }
    
    if (this.gameCompleted || !this.player || !this.player.active || this.player.isDead) return
    
    // Get current player position
    const newSpawnX = this.player.x
    const newSpawnY = this.player.y
    
    // Save to registry (per-level to prevent cross-level issues)
    this.registry.set("shiftedSpawnPoint_" + this.levelId, { x: newSpawnX, y: newSpawnY })
    
    // Visual and audio feedback
    this.showSpawnShiftFeedback(newSpawnX, newSpawnY)
    
    // Play sound effect
    if (this.sound.get("checkpoint_sound")) {
      this.sound.play("checkpoint_sound", { volume: 0.4 })
    } else if (this.sound.get("ui_confirm_sound")) {
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
    feedbackText.setScrollFactor(0)
    
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
   * Show message when spawn shifting is locked
   */
  showSpawnShiftLockedMessage() {
    const { width, height } = this.cameras.main
    
    const lockedText = this.add.text(width / 2, height / 2, "🔒 SPAWN SHIFTING LOCKED\nUnlock with Premium or game progression", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff6666",
      backgroundColor: "#000000cc",
      padding: { x: 15, y: 10 },
      align: "center"
    })
    lockedText.setOrigin(0.5)
    lockedText.setScrollFactor(0)
    lockedText.setDepth(100)
    
    // Fade out
    this.tweens.add({
      targets: lockedText,
      alpha: 0,
      duration: 500,
      delay: 1500,
      onComplete: () => lockedText.destroy()
    })
  }

  pauseGame() {
    if (this.gameCompleted) return
    
    // Pause this scene
    this.scene.pause()
    
    // Pause UI scene
    this.scene.pause("UIScene")
    
    // Launch pause menu
    this.scene.launch("PauseMenuScene", { gameSceneKey: this.scene.key, levelId: this.levelId })
  }

  completeLevel() {
    if (this.gameCompleted) return
    this.gameCompleted = true

    // Clear the session - collected fragments don't persist after level completion
    // This means retry from victory screen starts with all fragments available again
    LevelSessionManager.clearSession(this.levelId)
    
    // Also clear any shifted spawn point for this level
    this.registry.set("shiftedSpawnPoint_" + this.levelId, null)

    // Calculate stats
    const completionTimeMs = this.time.now - this.startTime
    const completionTime = Math.floor(completionTimeMs / 1000)
    
    // Check if all fragments were collected
    const allFragments = this.totalCollectibles > 0 && this.collectedCount >= this.totalCollectibles
    
    // Record detailed progress to PlayerProgressManager
    PlayerProgressManager.recordCompletion(this.levelId, {
      timeMs: completionTimeMs,
      deaths: this.deathCount,
      fragmentsCollected: this.collectedFragmentIds || [],
      totalFragments: this.totalCollectibles,
      allFragmentsCollected: allFragments
    })

    // Mark level as completed in WorldManager (handles world unlock logic)
    WorldManager.completeLevel(this.levelId)
    
    // Try to unlock track if all fragments collected
    // For now, we'll set unlockedTrack to null - track unlocking will be handled by a music manager
    // when tracks are properly assigned to levels
    let unlockedTrack = null
    let levelTrack = null
    
    // Try to get level track info from BGMManager or LevelDataManager
    // This allows tracks to be assigned to dynamic levels
    const levelData = LevelDataManager.getLevel(this.levelId)
    if (levelData && levelData.settings && levelData.settings.trackInfo) {
      levelTrack = levelData.settings.trackInfo
      
      if (allFragments && levelTrack) {
        // Mark track as unlocked (could store in localStorage or a manager)
        unlockedTrack = {
          title: levelTrack.title || `Track for ${this.levelId}`,
          artist: levelTrack.artist || "The Diminished Chord",
          levelId: this.levelId
        }
      }
    }
    
    // Play level complete sound immediately
    this.sound.play("level_complete_sound", { volume: 0.5 })
    
    // Duck music for victory screen (don't stop it)
    BGMManager.duckVolume()

    // Get ghost replay data before clearing
    const ghostData = this.getGhostReplayData()
    
    console.log("[DynamicLevelScene] Level complete - ghost data captured:")
    console.log("  - Death replays:", ghostData.deathReplays?.length || 0)
    console.log("  - Successful run positions:", ghostData.successfulRun?.positions?.length || 0)
    console.log("  - Current run positions (raw):", this.currentRunPositions?.length || 0)

    // Show victory
    this.time.delayedCall(500, () => {
      const nextLevel = WorldManager.getNextLevel(this.levelId)
      
      // Common victory data including ghost replays
      const victoryData = {
        currentLevelKey: this.scene.key,
        levelId: this.levelId,
        deathCount: this.deathCount,
        completionTime: completionTime,
        completionTimeMs: completionTimeMs,
        allFragments: allFragments,
        unlockedTrack: unlockedTrack,
        levelTrack: levelTrack,
        collectedCount: this.collectedCount,
        totalCollectibles: this.totalCollectibles,
        // Ghost replay data
        deathReplays: ghostData.deathReplays,
        successfulRunPositions: ghostData.successfulRun
      }
      
      if (this.levelType === LEVEL_TYPES.BOSS) {
        // Boss defeated - show special victory
        this.scene.launch("VictoryUIScene", { 
          ...victoryData,
          isBoss: true,
          worldNum: this.worldNum
        })
      } else if (!nextLevel) {
        // Game complete!
        this.scene.launch("GameCompleteUIScene", victoryData)
      } else {
        this.scene.launch("VictoryUIScene", { 
          ...victoryData,
          nextLevelId: nextLevel
        })
      }
      
      // Clear ghost data after passing to victory scene
      this.clearGhostReplayData()
    })
  }

  /**
   * Setup visibility change handling to pause the game when the window/tab loses focus
   * This ensures the timer and game state pause when player clicks away
   */
  setupVisibilityHandling() {
    // Store reference to handler for cleanup
    this.visibilityHandler = () => {
      if (document.hidden && !this.gameCompleted && !this.scene.isPaused(this.scene.key)) {
        // Tab/window lost focus - pause the game
        this.pauseGame()
      }
    }
    
    // Add visibility change listener
    document.addEventListener("visibilitychange", this.visibilityHandler)
    
    // Also handle window blur (for iframe scenarios)
    this.blurHandler = () => {
      if (!this.gameCompleted && !this.scene.isPaused(this.scene.key)) {
        this.pauseGame()
      }
    }
    window.addEventListener("blur", this.blurHandler)
  }

  /**
   * Clean up visibility handlers when scene is shut down
   */
  shutdown() {
    // Remove visibility change handlers
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler)
    }
    if (this.blurHandler) {
      window.removeEventListener("blur", this.blurHandler)
    }
    
    // Clean up event listeners
    if (this.gameScene) {
      this.gameScene.events.off("fragmentCollected", this.onFragmentCollected, this)
      this.gameScene.events.off("bossDefeated", this.onBossDefeated, this)
      this.gameScene.events.off("stopwatchCollected", this.onStopwatchCollected, this)
    }
  }
}
