import Phaser from "phaser"
import { BGMManager } from "./BGMManager.js"

/**
 * GameOverUIScene - Death screen (quick, Super Meat Boy style)
 * Just shows "WASTED" briefly then respawns - not really used in SMB-style
 * But kept for potential game over conditions
 */
export class GameOverUIScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameOverUIScene" })
  }

  init(data) {
    this.currentLevelKey = data.currentLevelKey
    this.levelId = data.levelId || null // For dynamic levels
    this.isDynamicLevel = this.currentLevelKey === "DynamicLevelScene"
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Semi-transparent overlay
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.7
    )
    overlay.setOrigin(0, 0)

    // Game Over text
    const gameOverText = this.add.text(centerX, centerY - 50, "GAME OVER", {
      fontFamily: "RetroPixel",
      fontSize: "56px",
      color: "#ff4444"
    }).setOrigin(0.5)

    // Buttons
    this.createButtons(centerX, centerY + 80)

    // Setup input
    this.setupInput()

    // Play game over sound
    this.sound.play("death_sound", { volume: 0.4 })
  }

  createButtons(x, y) {
    const buttonSpacing = 60

    // Retry button
    this.retryButton = this.createButton(x, y, "TRY AGAIN", () => this.retryLevel())

    // Menu button
    this.menuButton = this.createButton(x, y + buttonSpacing, "MAIN MENU", () => this.goToMenu())

    this.buttons = [this.retryButton, this.menuButton]
    this.selectedButtonIndex = 0
    this.updateButtonSelection()
  }

  createButton(x, y, text, callback) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 250, 45, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(2, 0xff4444)

    const label = this.add.text(0, 0, text, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff4444"
    }).setOrigin(0.5)

    container.add([bg, label])

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

    container.bg = bg
    container.label = label
    container.callback = callback

    return container
  }

  updateButtonSelection() {
    this.buttons.forEach((button, index) => {
      if (index === this.selectedButtonIndex) {
        button.bg.setStrokeStyle(3, 0xffaa00)
        button.label.setColor("#ffaa00")
        button.setScale(1.05)
      } else {
        button.bg.setStrokeStyle(2, 0xff4444)
        button.label.setColor("#ff4444")
        button.setScale(1)
      }
    })
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
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      // Cycle to top if at bottom (menu looping)
      if (this.selectedButtonIndex >= this.buttons.length - 1) {
        this.selectedButtonIndex = 0
      } else {
        this.selectedButtonIndex++
      }
      this.updateButtonSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    this.input.keyboard.on("keydown-ENTER", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.buttons[this.selectedButtonIndex].callback()
    })
  }

  retryLevel() {
    this.scene.stop("UIScene")
    this.scene.stop()
    
    // Handle dynamic levels vs legacy levels differently
    if (this.isDynamicLevel && this.levelId) {
      this.scene.start("DynamicLevelScene", { levelId: this.levelId })
    } else {
      this.scene.start(this.currentLevelKey)
    }
  }

  goToMenu() {
    // Stop music when going to menu (menu will start its own music)
    BGMManager.stop()
    
    // Clear tutorial world flag
    this.registry.set("returnToTutorialWorld", false)
    
    this.scene.stop("UIScene")
    this.scene.stop(this.currentLevelKey)
    this.scene.stop()
    this.scene.start("TitleScreen")
  }
}
