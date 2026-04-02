import Phaser from "phaser"
import { musicManager } from "./MusicTrackManager.js"
import { LevelManager } from "./LevelManager.js"
import { SavedLevelsManager } from "./SavedLevelsManager.js"
import { parseLevelId, WORLDS, LEVEL_TYPES } from "./WorldManager.js"

/**
 * UIScene - HUD overlay for gameplay
 * Shows fragment collection progress, death count, timer
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene" })
  }

  init(data) {
    this.gameSceneKey = data.gameSceneKey
    this.levelId = data.levelId || null // For dynamic levels
    this.isDynamicLevel = this.gameSceneKey === "DynamicLevelScene"
  }

  create() {
    // Get reference to game scene
    this.gameScene = this.scene.get(this.gameSceneKey)

    // Create UI container
    this.createLevelTitleUI()
    this.createFragmentUI()
    this.createTimerUI()
    this.createDeathCountUI()

    // Listen for events from game scene
    if (this.gameScene) {
      this.gameScene.events.on("updateFragmentUI", this.updateFragmentUI, this)
      this.gameScene.events.on("updateDeathCount", this.updateDeathCount, this)
    }

    // Create controls hint
    this.createControlsHint()

    // Initial display - wait for collectiblesLoaded event from game scene
    // Don't use musicManager here as it may have stale data from previous levels
    // The game scene will emit collectiblesLoaded with accurate totals
    
    // Listen for shutdown event to clean up
    this.events.on("shutdown", this.shutdown, this)
  }

  update() {
    // Update run indicator based on player state
    if (this.gameScene && this.gameScene.player) {
      if (this.gameScene.player.isRunning) {
        this.runIndicator.setText("RUNNING!")
      } else {
        this.runIndicator.setText("")
      }
    }
  }

  createLevelTitleUI() {
    // Level title display at top center
    const centerX = this.cameras.main.width / 2
    
    // Get level number and name based on level type
    let levelNumber = 0
    let levelName = "Unknown Level"
    
    if (this.isDynamicLevel && this.levelId) {
      // Dynamic level - parse level ID for display
      const parsed = parseLevelId(this.levelId)
      if (parsed) {
        const world = WORLDS[parsed.world]
        if (parsed.type === LEVEL_TYPES.BOSS) {
          levelNumber = `W${parsed.world}`
          levelName = world ? `${world.location} - ${world.bossName}` : "Boss"
        } else if (parsed.type === LEVEL_TYPES.BONUS) {
          levelNumber = `W${parsed.world}-B${parsed.level}`
          levelName = world ? `${world.location} - Bonus ${parsed.level}` : `Bonus ${parsed.level}`
        } else {
          levelNumber = `W${parsed.world}-L${parsed.level}`
          levelName = world ? `${world.location} - Stage ${parsed.level}` : `Stage ${parsed.level}`
        }
      } else if (this.levelId === "Tutorial") {
        levelNumber = 0
        levelName = "Tutorial"
      }
    } else {
      // Legacy level - use LevelManager
      levelNumber = LevelManager.getLevelNumber(this.gameSceneKey)
      const levelMetadata = LevelManager.getLevelMetadata(this.gameSceneKey)
      
      // Check for custom level name (user-defined rename)
      const customName = SavedLevelsManager.getCustomLevelName(this.gameSceneKey)
      levelName = customName || levelMetadata.name
    }
    
    // Background panel for level title
    const titleWidth = 300
    this.levelTitlePanel = this.add.rectangle(
      centerX,
      20,
      titleWidth,
      36,
      0x000000,
      0.6
    )
    this.levelTitlePanel.setStrokeStyle(2, 0xff69b4)

    // Level number and title text
    this.levelTitleText = this.add.text(centerX, 20, `Level ${levelNumber}: ${levelName}`, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    // Adjust panel width to fit text
    const textWidth = this.levelTitleText.width + 40
    this.levelTitlePanel.setSize(Math.max(titleWidth, textWidth), 36)
  }

  createFragmentUI() {
    // Collectible display in top-left (moved down to make room for level title)
    const padding = 20
    const topOffset = 50 // Offset to place below level title

    // Background panel - two rows: counter on top, instruments below
    this.fragmentPanel = this.add.rectangle(
      padding + 80,
      topOffset + padding + 18,
      180,
      56,
      0x000000,
      0.5
    )
    this.fragmentPanel.setStrokeStyle(2, 0x00ff88)

    // Main collectible icon - top row
    this.fragmentIcon = this.add.image(padding + 22, topOffset + padding + 5, "music_fragment_note")
    // Scale down to fit HUD - music_fragment_note is a large image, so use a small scale
    this.fragmentIcon.setScale(0.06)

    // Main collectible counter text - top row, next to icon
    this.fragmentText = this.add.text(padding + 42, topOffset + padding - 2, "0 / 0", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ff88"
    })

    // Instrument tracker (small icons showing which instruments collected) - bottom row
    this.instrumentIcons = {}
    const instruments = ["drums", "guitar", "bass", "keyboard", "microphone"]
    const iconStartX = padding + 22
    const iconY = topOffset + padding + 28 // Below the counter text
    const iconSpacing = 26
    
    instruments.forEach((inst, i) => {
      // Small colored square to represent each instrument
      const icon = this.add.rectangle(
        iconStartX + i * iconSpacing, 
        iconY, 
        18, 18, 
        this.getInstrumentColor(inst), 
        0.3
      )
      icon.setStrokeStyle(1, this.getInstrumentColor(inst))
      this.instrumentIcons[inst] = icon
    })
    
    // Track collected fragments
    this.collectedFragments = new Set()
    this.totalCollectibles = 0
    this.collectedCount = 0
    
    // Create the all-collected celebration text (hidden by default)
    this.allCollectedText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 50,
      "ALL COLLECTIBLES FOUND!\nTrack Unlock Eligible!",
      {
        fontFamily: "RetroPixel",
        fontSize: "28px",
        color: "#ffff00",
        align: "center",
        stroke: "#000000",
        strokeThickness: 4
      }
    ).setOrigin(0.5).setAlpha(0).setDepth(100)
    
    // Listen for collectibles loaded event
    if (this.gameScene) {
      this.gameScene.events.on("collectiblesLoaded", this.onCollectiblesLoaded, this)
    }
  }

  getInstrumentColor(inst) {
    const colors = {
      drums: 0xffa500,
      guitar: 0x9932cc,
      bass: 0x00ffff,
      keyboard: 0x00ff88,
      microphone: 0xff69b4
    }
    return colors[inst] || 0xffffff
  }

  onCollectiblesLoaded(data) {
    this.totalCollectibles = data.total || 0
    // Use collected count from game scene (may be > 0 if fragments were collected before death/restart)
    this.collectedCount = data.collected || 0
    this.hasShownCelebration = false // Reset celebration flag for new level
    
    // IMPORTANT: Reset the collected fragments Set to prevent accumulation across playthroughs
    this.collectedFragments = new Set()
    
    // Reset instrument icons to uncollected state
    Object.keys(this.instrumentIcons).forEach(inst => {
      if (this.instrumentIcons[inst]) {
        this.instrumentIcons[inst].setFillStyle(this.getInstrumentColor(inst), 0.3)
      }
    })
    
    // Reset panel color (will be updated by updateFragmentDisplay if all collected)
    if (this.fragmentPanel) {
      this.fragmentPanel.setStrokeStyle(2, 0x00ff88)
    }
    if (this.fragmentText) {
      this.fragmentText.setColor("#00ff88")
    }
    
    // Only update display if fragmentText exists (UI is ready)
    if (this.fragmentText) {
      this.updateFragmentDisplay(this.collectedCount, this.totalCollectibles)
    }
  }

  createTimerUI() {
    // Timer positioned below level title (moved down)
    const topOffset = 50 // Below level title
    
    this.timerText = this.add.text(this.cameras.main.width / 2, topOffset + 15, "00:00.000", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffffff"
    })
    this.timerText.setOrigin(0.5)

    // Initialize startTime to null - will be set when game scene starts timer
    // Timer stays at 00:00 until stopwatch is collected (or immediately if no stopwatch)
    this.startTime = null
    this.timerSyncAttempts = 0
    this.timerWaitingForStopwatch = false
    
    // Listen for timer start event from game scene (when stopwatch is collected)
    if (this.gameScene) {
      this.gameScene.events.on("timerStarted", this.onTimerStarted, this)
      
      // Check if level has stopwatch - if so, show waiting indicator
      this.time.delayedCall(100, () => {
        if (this.gameScene.hasStopwatch && !this.gameScene.timerStarted) {
          this.timerWaitingForStopwatch = true
          this.timerText.setColor("#888888") // Gray until stopwatch collected
          this.showStopwatchHint()
        }
      })
    }
    
    this.time.addEvent({
      delay: 100,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    })
  }

  createDeathCountUI() {
    // Death count in top-right (moved down below level title)
    const rightEdge = this.cameras.main.width - 20
    const topOffset = 50 // Below level title

    // Skull emoji or death icon representation
    this.deathText = this.add.text(rightEdge, topOffset + 20, "Deaths: 0", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff6666"
    })
    this.deathText.setOrigin(1, 0.5)
  }

  createControlsHint() {
    // Controls hint at bottom
    this.controlsText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 20,
      "Arrows: move • UP: jump • SPACE: run • /: respawn • ;: pause",
      {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#666666"
      }
    ).setOrigin(0.5)

    // Run indicator (positioned below death count)
    this.runIndicator = this.add.text(
      this.cameras.main.width - 100,
      95,
      "",
      {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ffaa00"
      }
    ).setOrigin(0.5)
  }

  updateFragmentUI(data) {
    // Update instrument icon if it's an instrument type
    if (data.type) {
      this.collectedFragments.add(data.type)
      
      // Update instrument icon if it's an instrument
      if (this.instrumentIcons[data.type]) {
        this.instrumentIcons[data.type].setFillStyle(this.getInstrumentColor(data.type), 1.0)
        
        // Flash the icon
        this.tweens.add({
          targets: this.instrumentIcons[data.type],
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 100,
          yoyo: true
        })
      }
    }
    
    // Use data from game scene event - this is the authoritative source
    // Don't use internal tracking as it can get out of sync
    const collected = data.collected !== undefined ? data.collected : 0
    const total = data.total !== undefined ? data.total : this.totalCollectibles
    
    // Update internal tracking to match game scene
    this.collectedCount = collected
    
    this.updateFragmentDisplay(collected, total)
  }

  updateFragmentDisplay(collected = this.collectedCount, total = this.totalCollectibles) {
    // Safety check - ensure UI elements are created before updating
    if (!this.fragmentText || !this.fragmentText.scene) {
      return
    }
    
    this.fragmentText.setText(`${collected} / ${total}`)
      
    // Flash effect when collecting
    if (collected > 0) {
      this.tweens.add({
        targets: this.fragmentText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 100,
        yoyo: true
      })
    }
    
    // Check for all collectibles gathered - show celebration!
    // Only trigger when: total > 0, collected equals total, haven't shown yet, AND actually collected something
    if (total > 0 && collected > 0 && collected === total && !this.hasShownCelebration) {
      this.hasShownCelebration = true
      this.fragmentText.setColor("#ffff00") // Gold when complete
      this.fragmentPanel.setStrokeStyle(2, 0xffff00)
      
      // Show celebration message
      this.showAllCollectedCelebration()
    }
  }
  
  /**
   * Show a celebratory message when all collectibles are gathered
   */
  showAllCollectedCelebration() {
    if (!this.allCollectedText) return
    
    // Play a celebratory sound if available
    if (this.sound.get("level_complete_sound")) {
      this.sound.play("level_complete_sound", { volume: 0.3 })
    } else if (this.sound.get("collect_fragment_sound")) {
      // Fallback to collect sound played multiple times for celebration effect
      this.sound.play("collect_fragment_sound", { volume: 0.4 })
    }
    
    // Animate the celebration text
    this.allCollectedText.setAlpha(1)
    this.allCollectedText.setScale(0.5)
    
    // Scale up and pulse
    this.tweens.add({
      targets: this.allCollectedText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 300,
      ease: "Back.easeOut",
      onComplete: () => {
        // Pulse effect
        this.tweens.add({
          targets: this.allCollectedText,
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 200,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            // Fade out after display
            this.tweens.add({
              targets: this.allCollectedText,
              alpha: 0,
              y: this.allCollectedText.y - 50,
              duration: 1000,
              delay: 1500,
              ease: "Quad.easeIn"
            })
          }
        })
      }
    })
    
    // Add sparkle particles around the panel
    this.createCelebrationParticles()
  }
  
  /**
   * Create celebratory particle effects
   */
  createCelebrationParticles() {
    const panelX = this.fragmentPanel.x
    const panelY = this.fragmentPanel.y
    
    // Create multiple sparkle bursts
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const distance = 60
      const sparkleX = panelX + Math.cos(angle) * distance
      const sparkleY = panelY + Math.sin(angle) * distance
      
      const sparkle = this.add.circle(sparkleX, sparkleY, 4, 0xffff00, 1)
      sparkle.setDepth(101)
      
      this.tweens.add({
        targets: sparkle,
        x: sparkleX + Math.cos(angle) * 30,
        y: sparkleY + Math.sin(angle) * 30,
        alpha: 0,
        scale: 0,
        duration: 600,
        delay: i * 50,
        ease: "Quad.easeOut",
        onComplete: () => sparkle.destroy()
      })
    }
  }

  updateDeathCount(count) {
    if (this.deathText) {
      this.deathText.setText(`Deaths: ${count}`)
      
      // Flash red on death
      this.tweens.add({
        targets: this.deathText,
        alpha: 0.5,
        duration: 100,
        yoyo: true,
        repeat: 2
      })
    }
  }

  /**
   * Show hint that player needs to collect stopwatch to start timer
   */
  showStopwatchHint() {
    // Show a subtle hint near the timer
    this.stopwatchHint = this.add.text(
      this.cameras.main.width / 2,
      this.timerText.y + 20,
      "⏱ Collect Stopwatch to Start!",
      {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#00ffff"
      }
    ).setOrigin(0.5)
    
    // Pulse animation
    this.tweens.add({
      targets: this.stopwatchHint,
      alpha: { from: 0.5, to: 1 },
      duration: 500,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  /**
   * Called when game scene starts the timer (stopwatch collected or no stopwatch)
   */
  onTimerStarted(data) {
    this.startTime = data.startTime
    this.timerWaitingForStopwatch = false
    this.timerText.setColor("#ffffff") // White now that timer is running
    
    // Remove stopwatch hint if present
    if (this.stopwatchHint) {
      this.stopwatchHint.destroy()
      this.stopwatchHint = null
    }
    
    console.log("[UIScene] Timer started via event, startTime:", this.startTime)
  }

  updateTimer() {
    if (!this.gameScene || this.gameScene.gameCompleted) return

    // If timer hasn't started yet (waiting for stopwatch), keep showing 00:00.000
    if (this.startTime === null) {
      // Check if game scene has started timer
      if (this.gameScene.startTime && this.gameScene.timerStarted) {
        this.startTime = this.gameScene.startTime
        this.timerWaitingForStopwatch = false
        this.timerText.setColor("#ffffff")
        
        // Remove hint if present
        if (this.stopwatchHint) {
          this.stopwatchHint.destroy()
          this.stopwatchHint = null
        }
        
        console.log("[UIScene] Timer synced with level start time")
      } else {
        // Timer not started yet - keep at 00:00.000
        return
      }
    }

    // Use game scene's time for accurate level timing
    // This ensures the timer reflects actual gameplay time, not UIScene time
    const gameTime = this.gameScene.time ? this.gameScene.time.now : this.time.now
    
    const elapsedMs = gameTime - this.startTime
    const minutes = Math.floor(elapsedMs / 60000).toString().padStart(2, "0")
    const seconds = Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, "0")
    const milliseconds = (elapsedMs % 1000).toString().padStart(3, "0")
    this.timerText.setText(`${minutes}:${seconds}.${milliseconds}`)
  }

  shutdown() {
    // Clean up event listeners from game scene
    if (this.gameScene) {
      this.gameScene.events.off("updateFragmentUI", this.updateFragmentUI, this)
      this.gameScene.events.off("updateDeathCount", this.updateDeathCount, this)
      this.gameScene.events.off("collectiblesLoaded", this.onCollectiblesLoaded, this)
      this.gameScene.events.off("timerStarted", this.onTimerStarted, this)
    }
    
    // Clean up own event listeners
    this.events.off("shutdown", this.shutdown, this)
    
    // Reset tracking state
    if (this.collectedFragments) {
      this.collectedFragments.clear()
    }
    this.collectedCount = 0
    this.totalCollectibles = 0
    this.hasShownCelebration = false
    this.startTime = null
    this.timerWaitingForStopwatch = false
    
    // Clean up stopwatch hint
    if (this.stopwatchHint) {
      this.stopwatchHint.destroy()
      this.stopwatchHint = null
    }
  }
}
