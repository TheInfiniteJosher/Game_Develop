import Phaser from "phaser"
import { LevelManager } from "./LevelManager.js"
import { musicManager } from "./MusicTrackManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { DevModeManager } from "./DevModeManager.js"
import { AuthManager } from "./AuthManager.js"
import { UserProfileManager } from "./UserProfileManager.js"
import { WorldManager } from "./WorldManager.js"

/**
 * TitleScreen - Main menu for The Diminished Chord
 * Features punk rock aesthetic with music-themed elements
 * Includes Developer Mode access
 */
export class TitleScreen extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScreen" })
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Play menu music (if assigned)
    BGMManager.setDevMode(false)
    BGMManager.playMenuMusic(this, MENU_KEYS.MAIN_MENU)

    // Launch persistent music control overlay (if not already running)
    if (!this.scene.isActive("MusicControlScene")) {
      this.scene.launch("MusicControlScene")
    }

    // Background
    this.createBackground()

    // Game title - positioned properly on screen
    this.createTitle(centerX)

    // Menu buttons in scrollable container
    this.createMenuButtons(centerX, centerY)

    // Animated elements
    this.createAnimatedElements()

    // User/Auth UI in top right
    this.createUserUI()

    // Version and dev mode indicator
    this.createFooter()

    // Setup input
    this.setupInput()
  }

  createBackground() {
    // Use the cavern background with dark overlay
    const bg = this.add.image(0, 0, "metroid_cavern_background")
    bg.setOrigin(0, 0)
    
    const scaleX = this.cameras.main.width / bg.width
    const scaleY = this.cameras.main.height / bg.height
    const scale = Math.max(scaleX, scaleY)
    bg.setScale(scale)

    // Dark overlay for better text readability
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.6
    )
    overlay.setOrigin(0, 0)

    // Animated gradient lines (punk rock aesthetic)
    this.createPunkLines()
  }

  createPunkLines() {
    // Create diagonal punk rock lines
    const graphics = this.add.graphics()
    graphics.lineStyle(3, 0xff00ff, 0.3)

    for (let i = -this.cameras.main.height; i < this.cameras.main.width + this.cameras.main.height; i += 100) {
      graphics.beginPath()
      graphics.moveTo(i, 0)
      graphics.lineTo(i + this.cameras.main.height, this.cameras.main.height)
      graphics.strokePath()
    }
  }

  createTitle(centerX) {
    // Main title image - positioned lower to ensure it's fully visible
    // Scale first to calculate proper positioning
    const targetWidth = 380
    const tempScale = targetWidth / this.textures.get("game_title").getSourceImage().width
    const scaledHeight = this.textures.get("game_title").getSourceImage().height * tempScale
    
    // Position title so it's fully on screen with margin from top
    const titleY = 80 + scaledHeight / 2
    this.titleImage = this.add.image(centerX, titleY, "game_title")
    
    const scale = targetWidth / this.titleImage.width
    this.titleImage.setScale(scale)
    this.titleImage.setOrigin(0.5, 0.5)

    // Pulsing animation
    this.tweens.add({
      targets: this.titleImage,
      scaleX: scale * 1.02,
      scaleY: scale * 1.02,
      duration: 1500,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })

    // Subtitle - positioned below title with proper spacing
    const titleBottom = titleY + scaledHeight / 2
    
    this.add.text(centerX, titleBottom + 12, "A Punk Rock Platformer Adventure", {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#00ff88"
    }).setOrigin(0.5)

    // Track progress
    const unlockedCount = musicManager.getUnlockedCount()
    const totalTracks = musicManager.getTotalTracks()
    this.add.text(centerX, titleBottom + 30, `Tracks Unlocked: ${unlockedCount} / ${totalTracks}`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    }).setOrigin(0.5)
    
    // Store title bottom for menu positioning (with extra padding)
    this.titleBottomY = titleBottom + 70
  }

  createMenuButtons(centerX, centerY) {
    // Calculate menu start position based on title bottom
    const menuStartY = this.titleBottomY || 280
    const buttonSpacing = 36
    const buttonHeight = 34
    const buttonWidth = 220
    const viewportHeight = this.cameras.main.height - menuStartY - 50 // Leave space for footer
    
    // Create menu items data - removed "REPLAY INTRO" (now in Cutscenes gallery)
    const menuItems = [
      { text: "TUTORIAL WORLD", callback: () => this.openTutorialWorld(), color: 0x00ffff },
      { text: "WORLD TOUR", callback: () => this.openWorldTour(), color: 0xff69b4 },
      { text: "QUICK PLAY", callback: () => this.startGame(), color: 0x00ff88 },
      { text: "MUSIC LIBRARY", callback: () => this.openLibrary(), color: 0x00ff88 },
      { text: "SETTINGS", callback: () => this.openSettings(), color: 0x00ff88 },
      { text: "CUTSCENES", callback: () => this.openCutsceneGallery(), color: 0xffaa00 }
    ]
    
    // Add dev mode button if enabled
    if (DevModeManager.isDevMode()) {
      menuItems.push({ 
        text: "DEVELOPER MODE", 
        callback: () => this.openDeveloperMode(), 
        color: 0xff00ff 
      })
    }
    
    // Calculate total menu height
    const totalMenuHeight = menuItems.length * buttonSpacing
    const needsScrolling = totalMenuHeight > viewportHeight
    
    // Create scrollable panel container
    const panelPadding = 15
    const panelHeight = Math.min(totalMenuHeight + panelPadding * 2, viewportHeight)
    
    // Panel background
    this.menuPanel = this.add.rectangle(
      centerX, 
      menuStartY + panelHeight / 2 - panelPadding,
      buttonWidth + 40,
      panelHeight,
      0x0a0a15,
      0.7
    )
    this.menuPanel.setStrokeStyle(1, 0x333344)
    
    // Create menu container
    this.menuContainer = this.add.container(centerX, menuStartY)
    
    // Create buttons with smaller size
    this.buttons = []
    menuItems.forEach((item, index) => {
      const btn = this.createButton(
        0,
        index * buttonSpacing,
        item.text,
        item.callback,
        item.color,
        buttonWidth,
        buttonHeight
      )
      this.menuContainer.add(btn)
      this.buttons.push(btn)
    })
    
    // Setup scrolling if needed
    if (needsScrolling) {
      this.menuScrollY = 0
      this.maxScrollY = totalMenuHeight - viewportHeight + 40
      
      // Create mask for scrolling
      const maskShape = this.add.graphics()
      maskShape.fillStyle(0xffffff)
      maskShape.fillRect(
        centerX - buttonWidth / 2 - 30, 
        menuStartY - 10, 
        buttonWidth + 60, 
        viewportHeight
      )
      const mask = maskShape.createGeometryMask()
      this.menuContainer.setMask(mask)
      
      // Add scroll indicator
      this.scrollIndicator = this.add.text(centerX, this.cameras.main.height - 65, "▼ Scroll for more ▼", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#555555"
      }).setOrigin(0.5)
      
      // Enable mouse wheel scrolling
      this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
        this.scrollMenu(deltaY > 0 ? 1 : -1)
      })
    }
    
    this.selectedButtonIndex = 0
    this.updateButtonSelection()
  }

  scrollMenu(direction) {
    if (!this.maxScrollY) return
    
    const scrollAmount = 36 // One button height
    this.menuScrollY = Phaser.Math.Clamp(
      this.menuScrollY + (direction * scrollAmount),
      0,
      this.maxScrollY
    )
    
    // Update container position
    const menuStartY = this.titleBottomY || 280
    this.menuContainer.y = menuStartY - this.menuScrollY
    
    // Update scroll indicator visibility
    if (this.scrollIndicator) {
      this.scrollIndicator.setAlpha(this.menuScrollY < this.maxScrollY ? 1 : 0)
    }
  }

  createButton(x, y, text, callback, accentColor = 0x00ff88, width = 220, height = 34) {
    const container = this.add.container(x, y)

    // Button background - compact buttons
    const bg = this.add.rectangle(0, 0, width, height, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(2, accentColor)

    // Button text - compact font
    const label = this.add.text(0, 0, text, {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: Phaser.Display.Color.IntegerToColor(accentColor).rgba
    }).setOrigin(0.5)

    container.add([bg, label])

    // Make interactive
    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerover", () => {
      this.selectedButtonIndex = this.buttons.indexOf(container)
      this.updateButtonSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      callback()
    })

    // Store references
    container.bg = bg
    container.label = label
    container.callback = callback
    container.accentColor = accentColor

    return container
  }

  updateButtonSelection() {
    this.buttons.forEach((button, index) => {
      if (index === this.selectedButtonIndex) {
        button.bg.setStrokeStyle(3, 0xffffff)
        button.label.setColor("#ffffff")
        button.setScale(1.03)
      } else {
        button.bg.setStrokeStyle(2, button.accentColor)
        button.label.setColor(Phaser.Display.Color.IntegerToColor(button.accentColor).rgba)
        button.setScale(1)
      }
    })
  }

  createAnimatedElements() {
    // Floating music notes in background
    const noteKeys = ["music_fragment_note", "music_fragment_bass", "music_fragment_drums", "music_fragment_guitar"]
    
    for (let i = 0; i < 8; i++) {
      const noteKey = noteKeys[i % noteKeys.length]
      const note = this.add.image(
        Phaser.Math.Between(50, this.cameras.main.width - 50),
        Phaser.Math.Between(50, this.cameras.main.height - 50),
        noteKey
      )
      note.setScale(0.05)
      note.setAlpha(0.3)
      note.setDepth(-1)

      // Float animation
      this.tweens.add({
        targets: note,
        y: note.y - 30,
        duration: Phaser.Math.Between(2000, 4000),
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      })

      // Rotation
      this.tweens.add({
        targets: note,
        angle: { from: -10, to: 10 },
        duration: Phaser.Math.Between(1500, 3000),
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      })
    }
  }

  createFooter() {
    // Version text
    const versionText = DevModeManager.isDevMode() 
      ? "v0.3.0 - Dev Mode Active" 
      : "v0.3.0"
    this.add.text(10, this.cameras.main.height - 25, versionText, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#555555"
    })
  }

  /**
   * Create user/authentication UI in top right corner
   */
  createUserUI() {
    const rightEdge = this.cameras.main.width - 20
    const topY = 25

    if (AuthManager.isLoggedIn()) {
      // User is logged in - show profile button
      const profile = UserProfileManager.getProfile()
      const displayName = profile?.display_name || profile?.username || "Player"
      // Truncate long names
      const truncatedName = displayName.length > 12 ? displayName.substring(0, 10) + "..." : displayName

      // Profile container - position from right edge
      const profileContainer = this.add.container(rightEdge, topY)

      // Username text (right-aligned) - positioned first to measure width
      const nameText = this.add.text(0, 0, truncatedName, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ffffff"
      }).setOrigin(1, 0.5) // Right-aligned

      // Avatar circle - positioned to left of username
      const avatarX = -nameText.width - 25
      const avatarBg = this.add.circle(avatarX, 0, 16, 0x1a1a2e)
      avatarBg.setStrokeStyle(2, 0xff69b4)

      const avatarText = this.add.text(avatarX, 0, displayName.charAt(0).toUpperCase(), {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ff69b4"
      }).setOrigin(0.5)

      profileContainer.add([avatarBg, avatarText, nameText])

      // Role indicator (if developer/admin) - below the username
      const role = profile?.role
      if (role === "developer" || role === "admin") {
        const roleColors = { developer: "#ff00ff", admin: "#ff0000" }
        const roleText = this.add.text(0, 14, `[${role.toUpperCase()}]`, {
          fontFamily: "RetroPixel",
          fontSize: "8px",
          color: roleColors[role]
        }).setOrigin(1, 0.5)
        profileContainer.add(roleText)
      }

      // Make clickable - hit area covers avatar and name
      const hitWidth = nameText.width + 50
      const hitArea = this.add.rectangle(-hitWidth / 2, 0, hitWidth, 36, 0x000000, 0)
      hitArea.setOrigin(0.5)
      hitArea.setInteractive({ useHandCursor: true })
      profileContainer.add(hitArea)

      hitArea.on("pointerover", () => {
        avatarBg.setStrokeStyle(2, 0xffffff)
        nameText.setColor("#ff69b4")
      })
      hitArea.on("pointerout", () => {
        avatarBg.setStrokeStyle(2, 0xff69b4)
        nameText.setColor("#ffffff")
      })
      hitArea.on("pointerdown", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.scene.start("ProfileScene", { returnScene: "TitleScreen" })
      })

    } else {
      // User is not logged in - show sign in button
      const signInBtn = this.add.container(rightEdge - 50, topY)

      const btnBg = this.add.rectangle(0, 0, 100, 30, 0x1a1a2e, 0.8)
      btnBg.setStrokeStyle(2, 0x00ff88)
      btnBg.setInteractive({ useHandCursor: true })

      const btnText = this.add.text(0, 0, "SIGN IN", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#00ff88"
      }).setOrigin(0.5)

      signInBtn.add([btnBg, btnText])

      btnBg.on("pointerover", () => {
        btnBg.setStrokeStyle(2, 0xffffff)
        btnText.setColor("#ffffff")
      })
      btnBg.on("pointerout", () => {
        btnBg.setStrokeStyle(2, 0x00ff88)
        btnText.setColor("#00ff88")
      })
      btnBg.on("pointerdown", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.scene.start("AuthScene", { returnScene: "TitleScreen" })
      })
    }
  }

  setupInput() {
    // Keyboard navigation
    this.input.keyboard.on("keydown-UP", () => {
      this.navigateUp()
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      this.navigateDown()
    })

    this.input.keyboard.on("keydown-ENTER", () => {
      this.confirmSelection()
    })

    this.input.keyboard.on("keydown-SPACE", () => {
      this.confirmSelection()
    })

    // Mobile controls support - launch if touch device
    this.launchMobileControls()
    
    // Listen for virtual control events from mobile controls scene
    const mobileScene = this.scene.get("MobileControlsScene")
    if (mobileScene) {
      // A button and Start button both confirm selection
      mobileScene.events.on("virtualConfirm", () => this.confirmSelection())
      // B button does nothing on main menu (no back action)
    }

    // Quick dev mode access (only if enabled)
    if (DevModeManager.isDevMode()) {
      this.input.keyboard.on("keydown-D", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.openDeveloperMode()
      })
    }

    // Secret code detection for unlocking dev mode
    this.input.keyboard.on("keydown", (event) => {
      if (event.key.length === 1) {
        const unlocked = DevModeManager.processKeyInput(event.key)
        if (unlocked) {
          // Dev mode was just unlocked! Show notification and refresh menu
          this.showDevModeUnlocked()
        }
      }
    })
  }

  /**
   * Launch mobile controls overlay if on a touch device
   */
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

  navigateUp() {
    // Cycle to bottom if at top (menu looping)
    if (this.selectedButtonIndex <= 0) {
      this.selectedButtonIndex = this.buttons.length - 1
    } else {
      this.selectedButtonIndex--
    }
    this.updateButtonSelection()
    this.sound.play("ui_select_sound", { volume: 0.2 })
    
    // Auto-scroll to keep selected button visible
    if (this.maxScrollY) {
      const buttonY = this.selectedButtonIndex * 38
      if (buttonY < this.menuScrollY) {
        this.menuScrollY = buttonY
        this.menuContainer.y = 280 - this.menuScrollY
      }
      // Handle wrapping to bottom - scroll to show last item
      if (this.selectedButtonIndex === this.buttons.length - 1) {
        const viewportHeight = this.cameras.main.height - 280 - 60
        this.menuScrollY = Math.max(0, buttonY - viewportHeight + 38)
        this.menuContainer.y = 280 - this.menuScrollY
      }
    }
  }

  navigateDown() {
    // Cycle to top if at bottom (menu looping)
    if (this.selectedButtonIndex >= this.buttons.length - 1) {
      this.selectedButtonIndex = 0
    } else {
      this.selectedButtonIndex++
    }
    this.updateButtonSelection()
    this.sound.play("ui_select_sound", { volume: 0.2 })
    
    // Auto-scroll to keep selected button visible
    if (this.maxScrollY) {
      const viewportHeight = this.cameras.main.height - 280 - 60
      const buttonY = this.selectedButtonIndex * 38
      if (buttonY > this.menuScrollY + viewportHeight - 38) {
        this.menuScrollY = buttonY - viewportHeight + 38
        this.menuContainer.y = 280 - this.menuScrollY
      }
      // Handle wrapping to top - scroll to show first item
      if (this.selectedButtonIndex === 0) {
        this.menuScrollY = 0
        this.menuContainer.y = 280 - this.menuScrollY
      }
    }
  }

  confirmSelection() {
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.buttons[this.selectedButtonIndex].callback()
  }

  update(time, delta) {
    // Check for mobile D-pad input for menu navigation
    const virtualControls = this.registry.get("virtualControls")
    const mobileActive = this.registry.get("mobileControlsActive")
    
    if (mobileActive && virtualControls) {
      // Track previous state for "just pressed" detection
      if (!this._prevVirtualState) {
        this._prevVirtualState = { up: false, down: false }
      }
      
      // Navigate up
      if (virtualControls.up.isDown && !this._prevVirtualState.up) {
        this.navigateUp()
      }
      
      // Navigate down
      if (virtualControls.down.isDown && !this._prevVirtualState.down) {
        this.navigateDown()
      }
      
      this._prevVirtualState.up = virtualControls.up.isDown
      this._prevVirtualState.down = virtualControls.down.isDown
    }
  }

  showDevModeUnlocked() {
    // Play confirmation sound
    this.sound.play("track_unlock_sound", { volume: 0.5 })

    // Show unlock notification
    const notification = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      "🔓 DEVELOPER MODE UNLOCKED!",
      {
        fontFamily: "RetroPixel",
        fontSize: "28px",
        color: "#ff00ff",
        backgroundColor: "#000000ee",
        padding: { x: 30, y: 20 }
      }
    ).setOrigin(0.5).setDepth(100)

    // Flash effect
    this.tweens.add({
      targets: notification,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.8, to: 1 },
      duration: 300,
      ease: "Back.easeOut"
    })

    // Fade out and restart scene to show dev button
    this.tweens.add({
      targets: notification,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => {
        notification.destroy()
        // Restart scene to show dev mode button
        this.scene.restart()
      }
    })
  }

  startGame() {
    // Stop menu music before starting game
    BGMManager.stop()
    const firstLevel = LevelManager.getFirstLevel()
    this.scene.start(firstLevel)
  }

  openLibrary() {
    this.scene.start("MusicLibraryScene")
  }

  openSettings() {
    this.scene.start("SettingsScene")
  }

  openTutorialWorld() {
    // Go to tutorial world scene
    this.scene.start("TutorialWorldScene")
  }

  openWorldTour() {
    // Check if tutorial world is completed (required for Story Mode)
    // Dev mode bypasses this requirement
    if (!DevModeManager.isDevMode() && !WorldManager.isTutorialWorldCompleted()) {
      this.showTutorialRequiredMessage()
      return
    }

    BGMManager.stop()
    
    // Check if intro has been watched this session
    const introSeen = sessionStorage.getItem("intro_seen_world_tour")
    if (!introSeen) {
      // First time clicking World Tour this session - show intro cutscene
      sessionStorage.setItem("intro_seen_world_tour", "true")
      // Also mark intro as watched for cutscene gallery unlock
      localStorage.setItem("diminished_chord_intro_started", "true")
      this.scene.start("IntroScene", { returnTo: "UniverseSelectScene" })
    } else {
      // Intro already seen - go directly to universe select
      this.scene.start("UniverseSelectScene")
    }
  }

  showTutorialRequiredMessage() {
    // Create modal overlay
    const overlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.8
    ).setDepth(1000)

    const container = this.add.container(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2
    ).setDepth(1001)

    // Message box
    const bg = this.add.rectangle(0, 0, 450, 200, 0x1a1a2e, 0.98)
      .setStrokeStyle(3, 0x00ffff)

    // Icon
    const icon = this.add.text(0, -60, "🎸", {
      fontSize: "40px"
    }).setOrigin(0.5)

    // Title
    const title = this.add.text(0, -15, "TUTORIAL REQUIRED", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ffff"
    }).setOrigin(0.5)

    // Message
    const message = this.add.text(0, 25, "Complete at least one Tutorial level\nto unlock the World Tour!", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc",
      align: "center"
    }).setOrigin(0.5)

    // Buttons
    const tutorialBtn = this.add.rectangle(-80, 75, 140, 35, 0x00ffff, 0.9)
      .setStrokeStyle(2, 0x44ffff)
      .setInteractive({ useHandCursor: true })
    const tutorialText = this.add.text(-80, 75, "GO TO TUTORIAL", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#000000"
    }).setOrigin(0.5)

    const closeBtn = this.add.rectangle(80, 75, 100, 35, 0x444444, 0.9)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const closeText = this.add.text(80, 75, "CLOSE", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5)

    container.add([bg, icon, title, message, tutorialBtn, tutorialText, closeBtn, closeText])

    // Button interactions
    tutorialBtn.on("pointerover", () => tutorialBtn.setFillStyle(0x44ffff))
    tutorialBtn.on("pointerout", () => tutorialBtn.setFillStyle(0x00ffff, 0.9))
    tutorialBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      overlay.destroy()
      container.destroy()
      this.openTutorialWorld()
    })

    closeBtn.on("pointerover", () => closeBtn.setFillStyle(0x666666))
    closeBtn.on("pointerout", () => closeBtn.setFillStyle(0x444444, 0.9))
    closeBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      overlay.destroy()
      container.destroy()
    })

    // Also close on overlay click
    overlay.setInteractive()
    overlay.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      overlay.destroy()
      container.destroy()
    })
  }

  openDeveloperMode() {
    this.scene.start("DeveloperMenuScene")
  }

  openCutsceneGallery() {
    this.scene.start("CutsceneGalleryScene")
  }

  showComingSoon(feature) {
    const text = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      `${feature}\nComing Soon!`,
      {
        fontFamily: "RetroPixel",
        fontSize: "24px",
        color: "#ffaa00",
        backgroundColor: "#000000cc",
        padding: { x: 30, y: 20 },
        align: "center"
      }
    ).setOrigin(0.5)

    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => text.destroy()
    })
  }
}
