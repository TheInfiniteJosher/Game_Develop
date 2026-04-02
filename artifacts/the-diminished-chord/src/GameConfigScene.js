import Phaser from "phaser"
import gameConfigData from "./gameConfig.json"

/**
 * GameConfigScene - Adjust game parameters in real-time
 * Modify physics, player settings, and debug options
 */
export class GameConfigScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameConfigScene" })
  }

  create() {
    const centerX = this.cameras.main.width / 2

    // Background
    this.createBackground()

    // Title
    this.add.text(centerX, 40, "GAME CONFIG", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffaa00"
    }).setOrigin(0.5)

    this.add.text(centerX, 75, "Adjust physics and game parameters", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5)

    // Create config panels
    this.createPlayerConfigPanel()
    this.createDebugConfigPanel()

    // Save/Reset buttons
    this.createActionButtons()

    // Back button
    this.createBackButton()

    // Setup input
    this.setupInput()
  }

  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)

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

  createPlayerConfigPanel() {
    const panelX = 300
    const panelY = 350

    this.add.rectangle(panelX, panelY, 380, 450, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x444466)

    this.add.text(panelX, panelY - 200, "PLAYER PHYSICS", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ff88"
    }).setOrigin(0.5)

    this.configSliders = []
    const playerConfig = gameConfigData.playerConfig
    const configKeys = Object.keys(playerConfig)

    configKeys.forEach((key, index) => {
      const config = playerConfig[key]
      if (config.type === "number") {
        const y = panelY - 160 + index * 40
        this.createConfigSlider(panelX, y, key, config)
      }
    })
  }

  createConfigSlider(x, y, key, config) {
    const container = this.add.container(x, y)

    // Label
    const label = this.add.text(-170, -8, key, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#cccccc"
    })

    // Value display
    const valueText = this.add.text(170, -8, String(config.value), {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ff88"
    }).setOrigin(1, 0)

    // Slider track
    const track = this.add.rectangle(0, 10, 200, 8, 0x333355)
    
    // Slider handle
    const minVal = config.value * 0.1
    const maxVal = config.value * 3
    const normalizedPos = (config.value - minVal) / (maxVal - minVal)
    const handleX = -100 + normalizedPos * 200

    const handle = this.add.rectangle(handleX, 10, 12, 20, 0x00ff88)
      .setInteractive({ draggable: true })

    container.add([label, valueText, track, handle])

    // Drag functionality
    handle.on("drag", (pointer, dragX) => {
      // Clamp handle position
      const clampedX = Phaser.Math.Clamp(dragX, -100, 100)
      handle.x = clampedX

      // Calculate new value
      const normalized = (clampedX + 100) / 200
      const newValue = minVal + normalized * (maxVal - minVal)
      
      // Update display
      if (config.type === "number") {
        const roundedValue = Math.round(newValue * 100) / 100
        valueText.setText(String(roundedValue))
        config.value = roundedValue
      }
    })

    container.key = key
    container.config = config
    container.valueText = valueText
    this.configSliders.push(container)
  }

  createDebugConfigPanel() {
    const panelX = this.cameras.main.width - 300
    const panelY = 250

    this.add.rectangle(panelX, panelY, 340, 250, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x444466)

    this.add.text(panelX, panelY - 105, "DEBUG OPTIONS", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff4444"
    }).setOrigin(0.5)

    this.debugToggles = []
    const debugConfig = gameConfigData.debugConfig
    const debugKeys = Object.keys(debugConfig)

    debugKeys.forEach((key, index) => {
      const config = debugConfig[key]
      if (config.type === "boolean") {
        const y = panelY - 60 + index * 40
        this.createToggleSwitch(panelX, y, key, config)
      }
    })
  }

  createToggleSwitch(x, y, key, config) {
    const container = this.add.container(x, y)

    // Label
    const label = this.add.text(-150, 0, key, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    // Toggle background
    const toggleBg = this.add.rectangle(120, 0, 50, 24, config.value ? 0x00ff88 : 0x444444)
      .setStrokeStyle(1, 0x666666)

    // Toggle handle
    const handleX = config.value ? 135 : 105
    const toggleHandle = this.add.rectangle(handleX, 0, 18, 18, 0xffffff)

    container.add([label, toggleBg, toggleHandle])

    // Interactive
    toggleBg.setInteractive({ useHandCursor: true })
    toggleBg.on("pointerdown", () => {
      config.value = !config.value
      toggleBg.setFillStyle(config.value ? 0x00ff88 : 0x444444)
      toggleHandle.x = config.value ? 135 : 105
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    container.key = key
    container.config = config
    this.debugToggles.push(container)
  }

  createActionButtons() {
    const centerX = this.cameras.main.width - 300
    const startY = 450

    // Save button
    const saveBtn = this.add.text(centerX, startY, "APPLY CHANGES", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ff88",
      backgroundColor: "#00ff8822",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
    saveBtn.setInteractive({ useHandCursor: true })
    saveBtn.on("pointerover", () => saveBtn.setColor("#ffffff"))
    saveBtn.on("pointerout", () => saveBtn.setColor("#00ff88"))
    saveBtn.on("pointerdown", () => this.applyChanges())

    // Reset button
    const resetBtn = this.add.text(centerX, startY + 50, "RESET TO DEFAULTS", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff4444",
      backgroundColor: "#ff444422",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
    resetBtn.setInteractive({ useHandCursor: true })
    resetBtn.on("pointerover", () => resetBtn.setColor("#ffffff"))
    resetBtn.on("pointerout", () => resetBtn.setColor("#ff4444"))
    resetBtn.on("pointerdown", () => this.resetToDefaults())

    // Test Level button
    const testBtn = this.add.text(centerX, startY + 100, "TEST IN LEVEL 1", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff",
      backgroundColor: "#00ffff22",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
    testBtn.setInteractive({ useHandCursor: true })
    testBtn.on("pointerover", () => testBtn.setColor("#ffffff"))
    testBtn.on("pointerout", () => testBtn.setColor("#00ffff"))
    testBtn.on("pointerdown", () => this.testInLevel())
  }

  applyChanges() {
    // The config changes are already applied to the gameConfigData object
    // This would persist to localStorage in a full implementation
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    
    // Visual feedback
    const msg = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 80, "Changes Applied!", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#00ff88"
    }).setOrigin(0.5)

    this.tweens.add({
      targets: msg,
      alpha: 0,
      duration: 2000,
      onComplete: () => msg.destroy()
    })
  }

  resetToDefaults() {
    // Reset to original values (you'd store these somewhere)
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.scene.restart()
  }

  testInLevel() {
    this.applyChanges()
    this.scene.start("Level1Scene")
  }

  createBackButton() {
    const backBtn = this.add.text(30, this.cameras.main.height - 40, "< BACK TO DEV MENU", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
    })
    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("DeveloperMenuScene")
    })
  }

  setupInput() {
    this.input.keyboard.on("keydown-ESC", () => {
      this.scene.start("DeveloperMenuScene")
    })
  }
}
