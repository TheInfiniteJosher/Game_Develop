import Phaser from "phaser"
import { LEVEL_ORDER } from "./LevelManager.js"
import { SavedLevelsManager } from "./SavedLevelsManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { LevelDataManager } from "./LevelDataManager.js"
import { PlayerProgressManager } from "./PlayerProgressManager.js"
import { WorldManager } from "./WorldManager.js"

/**
 * DeveloperMenuScene - Admin panel for game development
 * Provides access to level designer, track uploader, and level select
 */
export class DeveloperMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "DeveloperMenuScene" })
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Background - create this FIRST to ensure something is visible
    this.createBackground()

    // Play dev mode menu music (if assigned) - wrapped in try/catch
    try {
      BGMManager.setDevMode(true)
      BGMManager.playMenuMusic(this, MENU_KEYS.DEV_MODE).catch(e => {
        console.warn("[DeveloperMenuScene] Music playback error:", e)
      })
    } catch (e) {
      console.warn("[DeveloperMenuScene] BGMManager error:", e)
    }

    // Title
    this.add.text(centerX, 50, "DEVELOPER MODE", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ff00ff"
    }).setOrigin(0.5)

    this.add.text(centerX, 85, "Meta Game Design Tools", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#aaaaaa"
    }).setOrigin(0.5)

    // Menu options
    this.createMenuButtons(centerX, centerY - 80)

    // Stats display
    this.createStatsPanel(centerX)

    // Back button
    this.createBackButton()

    // Setup input
    this.setupInput()
  }

  createBackground() {
    // Dark dev mode background
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)

    // Grid pattern for dev aesthetic
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x222244, 0.3)
    
    for (let x = 0; x < this.cameras.main.width; x += 40) {
      graphics.beginPath()
      graphics.moveTo(x, 0)
      graphics.lineTo(x, this.cameras.main.height)
      graphics.strokePath()
    }
    for (let y = 0; y < this.cameras.main.height; y += 40) {
      graphics.beginPath()
      graphics.moveTo(0, y)
      graphics.lineTo(this.cameras.main.width, y)
      graphics.strokePath()
    }
  }

  createMenuButtons(centerX, startY) {
    const buttonSpacing = 50
    
    // Create scrollable container for buttons
    this.menuContainer = this.add.container(0, 0)
    this.menuScrollY = 0
    
    // Define all menu items
    const menuItems = [
      // Level Tools
      { title: "LEVEL DESIGNER", desc: "Create and test custom levels", color: 0x00ff88, action: () => this.openLevelDesigner() },
      { title: "LEVEL BROWSER", desc: "View, edit, and manage all levels", color: 0x00ffff, action: () => this.openLevelBrowser() },
      { title: "QUICK PLAY", desc: "Jump to any level for testing", color: 0xffaa00, action: () => this.openLevelSelect() },
      
      // Story & Content Tools
      { title: "STORY EDITOR", desc: "Manage cutscenes, shots & dialogue", color: 0xff69b4, action: () => this.scene.start("StoryEditorScene") },
      { title: "WORLD EDITOR", desc: "Edit themes, prompts & metadata", color: 0x00ffff, action: () => this.scene.start("WorldEditorScene") },
      { title: "BOSS DESIGNER", desc: "Configure boss fights & phases", color: 0xff4444, action: () => this.scene.start("BossDesignerScene") },
      { title: "BAND MEMBERS", desc: "Edit character profiles & abilities", color: 0xff69b4, action: () => this.scene.start("BandMemberEditorScene") },
      { title: "ART PROMPTS", desc: "AI generation prompt library", color: 0xaa44ff, action: () => this.scene.start("ArtPromptLibraryScene") },
      
      // Audio Tools
      { title: "TRACK MANAGER", desc: "Upload and assign music tracks", color: 0xff69b4, action: () => this.openTrackUploader() },
      { title: "AUDIO DATABASE", desc: "Manage tracks & sounds in Supabase", color: 0xaa44ff, action: () => this.openAudioAdmin() },
      
      // System Tools
      { title: "GAME CONFIG", desc: "Adjust physics and game parameters", color: 0x8888ff, action: () => this.openGameConfig() },
      { title: "AD CONFIG", desc: "Manage ads, monetization & premium", color: 0x00ff88, action: () => this.scene.start("AdConfigEditorScene") },
      { title: "SEED DATABASE", desc: "Publish all 301 levels to Supabase", color: 0xff4444, action: () => this.seedDatabase() },
      
      // Testing & Debug Tools
      { title: "RESET PROGRESS", desc: "Reset all game progress for current account", color: 0xff0000, action: () => this.showResetProgressDialog() },
      { title: "CLEAN SLATE MODE", desc: this.isCleanSlateMode() ? "✓ Active - Testing as new player" : "Test game as new player (no progress)", color: this.isCleanSlateMode() ? 0x00ff00 : 0xffff00, action: () => this.toggleCleanSlateMode() },
    ]
    
    this.buttons = []
    
    menuItems.forEach((item, index) => {
      const btn = this.createButton(
        centerX,
        startY + index * buttonSpacing,
        item.title,
        item.desc,
        item.color,
        item.action
      )
      this.menuContainer.add(btn)
      this.buttons.push(btn)
    })
    
    // Create mask for scrolling
    const maskY = startY - 30
    const maskHeight = this.cameras.main.height - maskY - 120
    this.maxScrollY = Math.max(0, (menuItems.length * buttonSpacing) - maskHeight + 30)
    
    const maskShape = this.add.graphics()
    maskShape.fillStyle(0xffffff)
    maskShape.fillRect(0, maskY, this.cameras.main.width, maskHeight)
    maskShape.setVisible(false)  // Hide the graphics - it's only used for masking
    const mask = maskShape.createGeometryMask()
    this.menuContainer.setMask(mask)
    
    // Scroll indicator
    if (this.maxScrollY > 0) {
      this.scrollIndicator = this.add.text(centerX, this.cameras.main.height - 130, "▼ Scroll for more ▼", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#555555"
      }).setOrigin(0.5)
    }
    
    // Mouse wheel scrolling
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollMenu(deltaY > 0 ? 1 : -1)
    })
    
    this.selectedButtonIndex = 0
    this.updateButtonSelection()
  }
  
  scrollMenu(direction) {
    if (!this.maxScrollY) return
    
    const scrollAmount = 50
    this.menuScrollY = Phaser.Math.Clamp(
      this.menuScrollY + (direction * scrollAmount),
      0,
      this.maxScrollY
    )
    
    this.menuContainer.y = -this.menuScrollY
    
    if (this.scrollIndicator) {
      this.scrollIndicator.setAlpha(this.menuScrollY < this.maxScrollY ? 1 : 0.3)
    }
  }

  createButton(x, y, title, description, color, callback) {
    const container = this.add.container(x, y)

    // Button background
    const bg = this.add.rectangle(0, 0, 400, 50, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(2, color)

    // Button title
    const titleText = this.add.text(-180, -10, title, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    })

    // Button description
    const descText = this.add.text(-180, 12, description, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })

    // Arrow indicator
    const arrow = this.add.text(175, -5, ">", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    })

    container.add([bg, titleText, descText, arrow])

    // Make interactive
    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerover", () => {
      this.selectedButtonIndex = this.buttons.indexOf(container)
      this.updateButtonSelection()
      this.playSoundSafe("ui_select_sound", 0.2)
    })
    bg.on("pointerdown", () => {
      this.playSoundSafe("ui_confirm_sound", 0.3)
      callback()
    })

    container.bg = bg
    container.titleText = titleText
    container.color = color
    container.callback = callback
    container.arrow = arrow

    return container
  }

  updateButtonSelection() {
    this.buttons.forEach((button, index) => {
      if (index === this.selectedButtonIndex) {
        button.bg.setStrokeStyle(3, 0xffffff)
        button.setScale(1.02)
        button.arrow.setAlpha(1)
      } else {
        button.bg.setStrokeStyle(2, button.color)
        button.setScale(1)
        button.arrow.setAlpha(0.5)
      }
    })
  }

  createStatsPanel(centerX) {
    const panelY = this.cameras.main.height - 100
    
    this.add.rectangle(centerX, panelY, 500, 70, 0x1a1a2e, 0.8)
      .setStrokeStyle(1, 0x333366)

    this.add.text(centerX, panelY - 20, "DATABASE STATS", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5)

    // Safely get Supabase level count with fallback
    let supabaseCount = 0
    try {
      supabaseCount = LevelDataManager.getSupabaseLevelCount() || 0
    } catch (e) {
      console.warn("[DeveloperMenuScene] Could not get Supabase count:", e)
    }
    const totalLevels = 301  // Tutorial + 15 worlds × 20 levels

    const statusColor = supabaseCount >= totalLevels ? "#00ff88" : "#ffaa00"
    this.statsText = this.add.text(centerX, panelY + 10, `Supabase: ${supabaseCount}/${totalLevels} levels`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: statusColor
    }).setOrigin(0.5)

    // Refresh stats after LevelDataManager initializes
    this.refreshStatsAsync(centerX, panelY)
  }

  async refreshStatsAsync(centerX, panelY) {
    try {
      // Wait for LevelDataManager to be ready
      await LevelDataManager.waitForReady()
      
      const supabaseCount = LevelDataManager.getSupabaseLevelCount() || 0
      const totalLevels = 301
      const statusColor = supabaseCount >= totalLevels ? "#00ff88" : "#ffaa00"
      
      // Update stats text if it exists
      if (this.statsText && this.statsText.active) {
        this.statsText.setText(`Supabase: ${supabaseCount}/${totalLevels} levels`)
        this.statsText.setColor(statusColor)
      }
    } catch (e) {
      console.warn("[DeveloperMenuScene] Stats refresh error:", e)
    }
  }

  createBackButton() {
    const backBtn = this.add.text(30, this.cameras.main.height - 40, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#666666"
    })
    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.playSoundSafe("ui_confirm_sound", 0.3)
      this.scene.start("TitleScreen")
    })
  }

  /**
   * Safely play a sound effect - won't crash if sound not loaded
   */
  playSoundSafe(key, volume = 0.3) {
    try {
      if (this.cache.audio.exists(key)) {
        this.sound.play(key, { volume })
      }
    } catch (e) {
      console.warn(`[DeveloperMenuScene] Sound play error for ${key}:`, e)
    }
  }

  setupInput() {
    this.input.keyboard.on("keydown-UP", () => {
      // Cycle to bottom if at top (menu looping)
      if (this.selectedButtonIndex <= 0) {
        this.selectedButtonIndex = this.buttons.length - 1
      } else {
        this.selectedButtonIndex--
      }
      this.updateButtonSelection()
      this.playSoundSafe("ui_select_sound", 0.2)
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      // Cycle to top if at bottom (menu looping)
      if (this.selectedButtonIndex >= this.buttons.length - 1) {
        this.selectedButtonIndex = 0
      } else {
        this.selectedButtonIndex++
      }
      this.updateButtonSelection()
      this.playSoundSafe("ui_select_sound", 0.2)
    })

    this.input.keyboard.on("keydown-ENTER", () => {
      this.playSoundSafe("ui_confirm_sound", 0.3)
      this.buttons[this.selectedButtonIndex].callback()
    })

    this.input.keyboard.on("keydown-ESC", () => {
      this.scene.start("TitleScreen")
    })
  }

  openLevelDesigner() {
    this.scene.start("LevelDesignerScene")
  }

  openLevelBrowser() {
    this.scene.start("LevelBrowserScene")
  }

  openTrackUploader() {
    this.scene.start("TrackUploaderScene")
  }

  openLevelSelect() {
    this.scene.start("LevelSelectScene")
  }

  openGameConfig() {
    this.scene.start("GameConfigScene")
  }

  openAudioAdmin() {
    this.scene.start("AudioAdminScene")
  }

  async seedDatabase() {
    // Create overlay
    const overlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000, 0.9
    )
    overlay.setDepth(100)

    // Create progress display
    const progressTitle = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 80,
      "SEEDING DATABASE",
      {
        fontFamily: "RetroPixel",
        fontSize: "24px",
        color: "#ff4444"
      }
    ).setOrigin(0.5).setDepth(101)

    const progressText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 40,
      "Initializing...",
      {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ffffff"
      }
    ).setOrigin(0.5).setDepth(101)

    const currentLevelText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      "",
      {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }
    ).setOrigin(0.5).setDepth(101)

    // Progress bar
    const barWidth = 400
    const barHeight = 20
    const barBg = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 40,
      barWidth, barHeight, 0x333333
    ).setDepth(101)
    
    const barFill = this.add.rectangle(
      this.cameras.main.width / 2 - barWidth / 2,
      this.cameras.main.height / 2 + 40,
      0, barHeight, 0xff4444
    ).setOrigin(0, 0.5).setDepth(101)

    // Status text
    const statusText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 80,
      "",
      {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#666666"
      }
    ).setOrigin(0.5).setDepth(101)

    // Progress callback
    const updateProgress = (current, total, levelId) => {
      const percent = Math.floor((current / total) * 100)
      progressText.setText(`${current} / ${total} levels (${percent}%)`)
      currentLevelText.setText(`Currently: ${levelId}`)
      barFill.setSize((current / total) * barWidth, barHeight)
    }

    // Run the seed operation
    try {
      const result = await LevelDataManager.seedAllLevelsToSupabase(updateProgress)
      
      // Show result
      progressTitle.setText(result.success ? "SEED COMPLETE!" : "SEED FINISHED WITH ERRORS")
      progressTitle.setColor(result.success ? "#00ff88" : "#ffaa00")
      progressText.setText(result.message)
      currentLevelText.setText("")
      
      if (result.stats) {
        statusText.setText(
          `Success: ${result.stats.success} | Skipped: ${result.stats.skipped || 0} | Errors: ${result.stats.errors}`
        )
      }

      // Add close button
      const closeBtn = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 + 120,
        "[ CLICK TO CLOSE ]",
        {
          fontFamily: "RetroPixel",
          fontSize: "14px",
          color: "#00ffff"
        }
      ).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true })

      closeBtn.on("pointerdown", () => {
        overlay.destroy()
        progressTitle.destroy()
        progressText.destroy()
        currentLevelText.destroy()
        barBg.destroy()
        barFill.destroy()
        statusText.destroy()
        closeBtn.destroy()
        
        // Refresh the scene to update stats
        this.scene.restart()
      })
    } catch (e) {
      progressTitle.setText("SEED FAILED")
      progressTitle.setColor("#ff0000")
      progressText.setText(e.message)
      
      // Add close button for error state
      const closeBtn = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 + 80,
        "[ CLICK TO CLOSE ]",
        {
          fontFamily: "RetroPixel",
          fontSize: "14px",
          color: "#ff0000"
        }
      ).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true })

      closeBtn.on("pointerdown", () => {
        overlay.destroy()
        progressTitle.destroy()
        progressText.destroy()
        currentLevelText.destroy()
        barBg.destroy()
        barFill.destroy()
        statusText.destroy()
        closeBtn.destroy()
      })
    }
  }

  /**
   * Check if Clean Slate Mode is active
   */
  isCleanSlateMode() {
    return localStorage.getItem("clean_slate_mode") === "true"
  }

  /**
   * Toggle Clean Slate Mode for testing
   * When active, the game behaves as if the player has no progress
   */
  toggleCleanSlateMode() {
    const isActive = this.isCleanSlateMode()
    
    if (isActive) {
      // Disable clean slate mode
      localStorage.removeItem("clean_slate_mode")
      this.showNotification("Clean Slate Mode DISABLED", "Progress restored", 0x00ff88)
    } else {
      // Enable clean slate mode
      localStorage.setItem("clean_slate_mode", "true")
      this.showNotification("Clean Slate Mode ENABLED", "Testing as new player", 0xffff00)
    }
    
    // Refresh the scene to update the button state
    this.time.delayedCall(1500, () => {
      this.scene.restart()
    })
  }

  /**
   * Show reset progress confirmation dialog
   */
  showResetProgressDialog() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Create overlay
    const overlay = this.add.rectangle(centerX, centerY, 
      this.cameras.main.width, this.cameras.main.height, 0x000000, 0.9)
    overlay.setDepth(100)

    // Dialog container
    const dialog = this.add.container(centerX, centerY)
    dialog.setDepth(101)

    // Background
    const bg = this.add.rectangle(0, 0, 450, 280, 0x1a0a0a, 0.98)
      .setStrokeStyle(3, 0xff0000)
    dialog.add(bg)

    // Warning icon
    const warningIcon = this.add.text(0, -100, "⚠️", { fontSize: "48px" }).setOrigin(0.5)
    dialog.add(warningIcon)

    // Title
    const title = this.add.text(0, -55, "RESET ALL PROGRESS?", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#ff4444"
    }).setOrigin(0.5)
    dialog.add(title)

    // Warning text
    const warningText = this.add.text(0, 0, 
      "This will permanently delete:\n• All level completions\n• All world progress\n• All unlocked content\n• All leaderboard entries", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff",
      align: "center",
      lineSpacing: 5
    }).setOrigin(0.5)
    dialog.add(warningText)

    // Confirm button
    const confirmBtn = this.add.rectangle(-80, 100, 140, 45, 0xff0000, 0.9)
      .setStrokeStyle(2, 0xff4444)
      .setInteractive({ useHandCursor: true })
    dialog.add(confirmBtn)

    const confirmText = this.add.text(-80, 100, "RESET", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)
    dialog.add(confirmText)

    confirmBtn.on("pointerover", () => confirmBtn.setStrokeStyle(3, 0xffffff))
    confirmBtn.on("pointerout", () => confirmBtn.setStrokeStyle(2, 0xff4444))
    confirmBtn.on("pointerdown", async () => {
      await this.executeProgressReset()
      overlay.destroy()
      dialog.destroy()
    })

    // Cancel button
    const cancelBtn = this.add.rectangle(80, 100, 140, 45, 0x333333, 0.9)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    dialog.add(cancelBtn)

    const cancelText = this.add.text(80, 100, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5)
    dialog.add(cancelText)

    cancelBtn.on("pointerover", () => cancelBtn.setStrokeStyle(3, 0xffffff))
    cancelBtn.on("pointerout", () => cancelBtn.setStrokeStyle(2, 0x666666))
    cancelBtn.on("pointerdown", () => {
      overlay.destroy()
      dialog.destroy()
    })

    // ESC to cancel
    this.input.keyboard.once("keydown-ESC", () => {
      overlay.destroy()
      dialog.destroy()
    })
  }

  /**
   * Execute the progress reset
   */
  async executeProgressReset() {
    try {
      // Reset PlayerProgressManager (handles both Supabase and localStorage)
      await PlayerProgressManager.resetAllProgress()
      
      // Reset WorldManager
      WorldManager.resetProgress()
      
      // Clear any clean slate mode if active
      localStorage.removeItem("clean_slate_mode")
      
      // Clear hidden items and other unlock data
      for (let world = 1; world <= 15; world++) {
        localStorage.removeItem(`hidden_item_w${world}`)
        localStorage.removeItem(`all_fragments_w${world}`)
        localStorage.removeItem(`all_speedruns_w${world}`)
      }
      
      this.showNotification("Progress Reset Complete", "All data has been cleared", 0xff4444)
      
      // Restart scene after delay
      this.time.delayedCall(2000, () => {
        this.scene.restart()
      })
    } catch (e) {
      console.error("[DeveloperMenu] Reset failed:", e)
      this.showNotification("Reset Failed", e.message, 0xff0000)
    }
  }

  /**
   * Show a notification overlay
   */
  showNotification(title, message, color) {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    const container = this.add.container(centerX, centerY)
    container.setDepth(200)

    const bg = this.add.rectangle(0, 0, 350, 100, 0x0a0a1a, 0.95)
      .setStrokeStyle(3, color)
    container.add(bg)

    const titleText = this.add.text(0, -20, title, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)
    container.add(titleText)

    const msgText = this.add.text(0, 15, message, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    container.add(msgText)

    // Fade out and destroy
    this.tweens.add({
      targets: container,
      alpha: 0,
      y: centerY - 50,
      delay: 1500,
      duration: 500,
      onComplete: () => container.destroy()
    })
  }
}
