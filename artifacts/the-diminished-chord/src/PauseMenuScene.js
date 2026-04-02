import Phaser from "phaser"
import { BGMManager } from "./BGMManager.js"
import { LevelSessionManager } from "./DynamicLevelScene.js"
import { parseLevelId, WorldManager } from "./WorldManager.js"

/**
 * PauseMenuScene - Overlay scene when game is paused
 * Provides options to resume, go to main menu, or level select
 */
export class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "PauseMenuScene" })
  }

  init(data) {
    this.gameSceneKey = data.gameSceneKey
    this.levelId = data.levelId || null // For dynamic levels
    this.isDynamicLevel = this.gameSceneKey === "DynamicLevelScene"
    
    // Check if we came from Level Browser (shows "Back to Browser" option)
    this.fromLevelBrowser = this.registry.get("levelBrowserState") !== null || 
                            (data.fromLevelBrowser === true)
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Semi-transparent background overlay
    this.overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.8
    ).setOrigin(0, 0)

    // Build button list dynamically
    const buttonData = [
      { label: "RESUME", color: 0x00ff88, callback: () => this.resumeGame() },
      { label: "SETTINGS", color: 0xaaaaff, callback: () => this.openSettings() },
      { label: "RESTART LEVEL", color: 0xffaa00, callback: () => this.restartLevel() }
    ]
    
    // Add "Back to Level Browser" if we came from there
    if (this.fromLevelBrowser) {
      buttonData.push({ label: "LEVEL BROWSER", color: 0xff69b4, callback: () => this.goToLevelBrowser() })
    }
    
    buttonData.push({ label: "WORLD MAP", color: 0x00ffff, callback: () => this.goToWorldMap() })
    buttonData.push({ label: "MAIN MENU", color: 0xff4444, callback: () => this.goToMainMenu() })

    // Calculate panel size based on button count
    const buttonCount = buttonData.length
    const panelHeight = 120 + buttonCount * 52
    
    // Pause menu panel
    this.panel = this.add.rectangle(centerX, centerY, 350, panelHeight, 0x1a1a2e, 0.95)
      .setStrokeStyle(3, 0xff69b4)

    // Title
    this.add.text(centerX, centerY - panelHeight / 2 + 35, "PAUSED", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    // Menu buttons
    this.buttons = []
    this.selectedIndex = 0

    buttonData.forEach((btn, index) => {
      const y = centerY - panelHeight / 2 + 85 + index * 52
      const button = this.createButton(centerX, y, btn.label, btn.color, btn.callback)
      this.buttons.push(button)
    })

    this.updateSelection()

    // Controls hint
    this.add.text(centerX, centerY + panelHeight / 2 - 20, "Press ; or ESC to resume", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    }).setOrigin(0.5)

    // Setup input
    this.setupInput()
  }

  createButton(x, y, label, color, callback) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 280, 45, 0x222244, 0.9)
      .setStrokeStyle(2, color)

    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerover", () => {
      this.selectedIndex = this.buttons.indexOf(container)
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      callback()
    })

    container.bg = bg
    container.text = text
    container.color = color
    container.callback = callback

    return container
  }

  updateSelection() {
    this.buttons.forEach((btn, index) => {
      if (index === this.selectedIndex) {
        btn.bg.setStrokeStyle(3, 0xffffff)
        btn.text.setColor("#ffffff")
        btn.setScale(1.05)
      } else {
        btn.bg.setStrokeStyle(2, btn.color)
        btn.text.setColor(Phaser.Display.Color.IntegerToColor(btn.color).rgba)
        btn.setScale(1)
      }
    })
  }

  setupInput() {
    // Resume with semicolon or ESC
    this.input.keyboard.on("keydown-ESC", () => this.resumeGame())
    this.input.keyboard.on("keydown-SEMICOLON", () => this.resumeGame())

    // Navigation
    this.input.keyboard.on("keydown-UP", () => this.navigateUp())
    this.input.keyboard.on("keydown-DOWN", () => this.navigateDown())

    this.input.keyboard.on("keydown-ENTER", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.buttons[this.selectedIndex].callback()
    })
    
    // Mobile controls - listen for virtual events
    const mobileScene = this.scene.get("MobileControlsScene")
    if (mobileScene) {
      mobileScene.events.on("virtualConfirm", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.buttons[this.selectedIndex].callback()
      })
      mobileScene.events.on("virtualBack", () => this.resumeGame())
    }
  }
  
  navigateUp() {
    // Cycle to bottom if at top (menu looping)
    if (this.selectedIndex <= 0) {
      this.selectedIndex = this.buttons.length - 1
    } else {
      this.selectedIndex--
    }
    this.updateSelection()
    this.sound.play("ui_select_sound", { volume: 0.2 })
  }
  
  navigateDown() {
    // Cycle to top if at bottom (menu looping)
    if (this.selectedIndex >= this.buttons.length - 1) {
      this.selectedIndex = 0
    } else {
      this.selectedIndex++
    }
    this.updateSelection()
    this.sound.play("ui_select_sound", { volume: 0.2 })
  }
  
  update() {
    // Check for mobile D-pad input for menu navigation
    const virtualControls = this.registry.get("virtualControls")
    const mobileActive = this.registry.get("mobileControlsActive")
    
    if (mobileActive && virtualControls) {
      if (!this._prevVirtualState) {
        this._prevVirtualState = { up: false, down: false }
      }
      
      if (virtualControls.up.isDown && !this._prevVirtualState.up) {
        this.navigateUp()
      }
      
      if (virtualControls.down.isDown && !this._prevVirtualState.down) {
        this.navigateDown()
      }
      
      this._prevVirtualState.up = virtualControls.up.isDown
      this._prevVirtualState.down = virtualControls.down.isDown
    }
  }

  resumeGame() {
    // Resume the game scene
    const gameScene = this.scene.get(this.gameSceneKey)
    if (gameScene) {
      gameScene.scene.resume()
    }
    
    // Resume UI scene
    const uiScene = this.scene.get("UIScene")
    if (uiScene) {
      uiScene.scene.resume()
    }

    // Stop this scene
    this.scene.stop()
  }

  openSettings() {
    // Sleep this scene (don't stop it, so we can return)
    this.scene.sleep()
    
    // Launch settings scene with return info
    this.scene.launch("SettingsScene", {
      returnScene: "PauseMenuScene",
      gameSceneKey: this.gameSceneKey,
      returnData: {
        gameSceneKey: this.gameSceneKey,
        levelId: this.levelId
      }
    })
  }

  restartLevel() {
    // Stop UI scenes
    this.scene.stop("UIScene")
    this.scene.stop("PauseMenuScene")
    
    // Don't stop music - BGMManager will handle continuation for same level
    
    this.scene.stop(this.gameSceneKey)
    
    // Handle dynamic levels vs legacy levels differently
    // freshStart: false - restarting mid-level preserves collected fragments
    if (this.isDynamicLevel && this.levelId) {
      this.scene.start("DynamicLevelScene", { levelId: this.levelId, freshStart: false })
    } else {
      this.scene.start(this.gameSceneKey)
    }
  }

  goToWorldMap() {
    // Stop all related scenes
    this.scene.stop("UIScene")
    
    // Clear collected fragments session - leaving level abandons progress
    LevelSessionManager.clearAllSessions()
    
    // Stop music when going to world map (world map will start its own music)
    BGMManager.stop()
    
    this.scene.stop(this.gameSceneKey)
    this.scene.stop("PauseMenuScene")
    
    // Check if we should return to Tutorial World
    const returnToTutorialWorld = this.registry.get("returnToTutorialWorld")
    if (returnToTutorialWorld) {
      this.registry.set("returnToTutorialWorld", false)
      this.scene.start("TutorialWorldScene")
      return
    }
    
    // Parse current level to get world number
    let worldNum = 1 // Default to world 1
    if (this.levelId) {
      const parsed = parseLevelId(this.levelId)
      if (parsed && parsed.world) {
        worldNum = parsed.world
      }
    }
    
    // Navigate to the WorldLevelSelectScene for the current world
    this.scene.start("WorldLevelSelectScene", { worldNum, skipIntroCutscene: true })
  }

  goToMainMenu() {
    // Stop all related scenes
    this.scene.stop("UIScene")
    
    // Clear collected fragments session - leaving level abandons progress
    LevelSessionManager.clearAllSessions()
    
    // Stop music when going to main menu (menu will start its own music)
    BGMManager.stop()
    
    this.scene.stop(this.gameSceneKey)
    this.scene.stop("PauseMenuScene")
    
    this.scene.start("TitleScreen")
  }

  /**
   * Return to the Level Browser, preserving scroll position
   */
  goToLevelBrowser() {
    // Stop all related scenes
    this.scene.stop("UIScene")
    
    // Clear collected fragments session - leaving level abandons progress
    LevelSessionManager.clearAllSessions()
    
    // Stop music
    BGMManager.stop()
    
    this.scene.stop(this.gameSceneKey)
    this.scene.stop("PauseMenuScene")
    
    // Level browser state is already in registry (was set when we started playing)
    // It will be restored automatically when LevelBrowserScene creates
    this.scene.start("LevelBrowserScene")
  }
}
