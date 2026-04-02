import Phaser from "phaser"
import { AudioManager } from "./AudioManager.js"
import { GamepadManager, DEFAULT_MAPPING, DEFAULT_KEY_ACTIONS } from "./GamepadManager.js"
import { AuthManager } from "./AuthManager.js"

/**
 * ControlsSettingsScene - Configure keyboard and gamepad controls
 * 
 * Features:
 * - View and edit current control mappings
 * - Detect and configure game controllers
 * - Remap buttons to different actions
 * - Save preferences locally and to Supabase
 */
export class ControlsSettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: "ControlsSettingsScene" })
  }

  init(data) {
    this.returnScene = data?.returnScene || "SettingsScene"
    this.returnData = data?.returnData || {}
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Current tab
    this.currentTab = "keyboard" // "keyboard" or "gamepad"

    // Create background
    this.createBackground()

    // Title
    this.add.text(centerX, 40, "CONTROL SETTINGS", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    // Create tabs
    this.createTabs(centerX)

    // Create content containers
    this.keyboardContainer = this.add.container(0, 0)
    this.gamepadContainer = this.add.container(0, 0)

    // Populate tabs
    this.createKeyboardPanel(centerX, centerY)
    this.createGamepadPanel(centerX, centerY)

    // Show initial tab
    this.showTab("keyboard")

    // Back button
    this.createBackButton(centerX)

    // Setup input
    this.setupInput()

    // Listen for gamepad events
    this.setupGamepadListeners()
  }

  createBackground() {
    // Dark background
    this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x0a0a15
    ).setOrigin(0, 0)

    // Decorative lines
    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0x00ffff, 0.1)

    for (let i = -this.cameras.main.height; i < this.cameras.main.width + this.cameras.main.height; i += 80) {
      graphics.beginPath()
      graphics.moveTo(i, 0)
      graphics.lineTo(i + this.cameras.main.height, this.cameras.main.height)
      graphics.strokePath()
    }

    // Main panel background
    this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 30,
      700,
      500,
      0x1a1a2e,
      0.95
    ).setStrokeStyle(2, 0x333366)
  }

  createTabs(centerX) {
    const tabY = 85
    const tabWidth = 180

    // Keyboard tab
    this.keyboardTab = this.createTabButton(
      centerX - tabWidth / 2 - 10,
      tabY,
      "⌨️ KEYBOARD",
      "keyboard"
    )

    // Gamepad tab
    this.gamepadTab = this.createTabButton(
      centerX + tabWidth / 2 + 10,
      tabY,
      "🎮 GAMEPAD",
      "gamepad"
    )
  }

  createTabButton(x, y, label, tabKey) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 180, 36, 0x222244, 0.9)
      .setStrokeStyle(2, 0x444488)

    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#888888"
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: AudioManager.getScaledSfxVolume(0.3) })
      this.showTab(tabKey)
    })

    container.bg = bg
    container.text = text
    container.tabKey = tabKey

    return container
  }

  showTab(tabKey) {
    this.currentTab = tabKey

    // Update tab visuals
    const tabs = [this.keyboardTab, this.gamepadTab]
    tabs.forEach(tab => {
      if (tab.tabKey === tabKey) {
        tab.bg.setStrokeStyle(3, 0x00ffff)
        tab.bg.setFillStyle(0x333366)
        tab.text.setColor("#00ffff")
      } else {
        tab.bg.setStrokeStyle(2, 0x444488)
        tab.bg.setFillStyle(0x222244)
        tab.text.setColor("#888888")
      }
    })

    // Show/hide content
    this.keyboardContainer.setVisible(tabKey === "keyboard")
    this.gamepadContainer.setVisible(tabKey === "gamepad")
  }

  createKeyboardPanel(centerX, centerY) {
    const startY = 140

    // Header
    const header = this.add.text(centerX, startY, "Keyboard Controls", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)
    this.keyboardContainer.add(header)

    // Description
    const desc = this.add.text(centerX, startY + 25, "Current key bindings (read-only for now)", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666"
    }).setOrigin(0.5)
    this.keyboardContainer.add(desc)

    // Control mappings display
    const controls = [
      { action: "Move Left", key: "← Arrow" },
      { action: "Move Right", key: "→ Arrow" },
      { action: "Jump", key: "↑ Arrow" },
      { action: "Crouch/Slide", key: "↓ Arrow" },
      { action: "Run", key: "Space" },
      { action: "Pause", key: "; (Semicolon)" },
      { action: "Respawn", key: "/" },
      { action: "Spawn Shift", key: "Q" },
      { action: "Restart", key: "R" }
    ]

    const listY = startY + 60
    const rowHeight = 32
    const colWidth = 280

    controls.forEach((ctrl, i) => {
      const row = Math.floor(i / 2)
      const col = i % 2
      const x = centerX - colWidth / 2 + col * colWidth
      const y = listY + row * rowHeight

      // Action name
      const actionText = this.add.text(x - 120, y, ctrl.action, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#aaaaaa"
      }).setOrigin(0, 0.5)
      this.keyboardContainer.add(actionText)

      // Key binding
      const keyBg = this.add.rectangle(x + 60, y, 80, 24, 0x333355, 0.8)
        .setStrokeStyle(1, 0x555577)
      const keyText = this.add.text(x + 60, y, ctrl.key, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#00ff88"
      }).setOrigin(0.5)

      this.keyboardContainer.add(keyBg)
      this.keyboardContainer.add(keyText)
    })

    // Future: Remapping note
    const noteText = this.add.text(centerX, listY + Math.ceil(controls.length / 2) * rowHeight + 30, 
      "Custom keyboard remapping coming soon!", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.keyboardContainer.add(noteText)
  }

  createGamepadPanel(centerX, centerY) {
    const startY = 130

    // Header
    const header = this.add.text(centerX, startY, "Gamepad Configuration", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)
    this.gamepadContainer.add(header)

    // Controller status
    this.controllerStatusText = this.add.text(centerX, startY + 28, "Checking for controllers...", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
    this.gamepadContainer.add(this.controllerStatusText)

    // Update controller status
    this.updateControllerStatus()

    // Controller selection dropdown area
    this.createControllerSelector(centerX, startY + 60)

    // Button mapping section
    this.createButtonMappingSection(centerX, startY + 100)

    // Debug toggle
    this.createDebugToggle(centerX, this.cameras.main.height - 155)

    // Save to Profile button (most prominent)
    this.createSaveToProfileButton(centerX, this.cameras.main.height - 115)

    // Reset button
    this.createResetButton(centerX, this.cameras.main.height - 75)
  }

  updateControllerStatus() {
    const controllers = GamepadManager.getConnectedControllers()
    
    if (controllers.length === 0) {
      this.controllerStatusText.setText("No controllers detected. Connect a controller to configure.")
      this.controllerStatusText.setColor("#ff6666")
    } else {
      const activeController = controllers[0]
      this.controllerStatusText.setText(`✓ ${controllers.length} controller(s) connected: ${activeController.id.substring(0, 40)}...`)
      this.controllerStatusText.setColor("#00ff88")
    }
  }

  createControllerSelector(centerX, y) {
    const controllers = GamepadManager.getConnectedControllers()
    
    if (controllers.length <= 1) return

    const label = this.add.text(centerX - 150, y, "Active Controller:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#aaaaaa"
    }).setOrigin(0, 0.5)
    this.gamepadContainer.add(label)

    // Simple controller buttons for selection
    controllers.forEach((ctrl, i) => {
      const btnX = centerX + 50 + i * 80
      const btn = this.add.text(btnX, y, `#${ctrl.index + 1}`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: i === 0 ? "#00ffff" : "#666666",
        backgroundColor: "#222244",
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      btn.on("pointerdown", () => {
        GamepadManager.setActiveController(ctrl.index)
        this.sound.play("ui_select_sound", { volume: AudioManager.getScaledSfxVolume(0.3) })
        // Refresh panel
        this.gamepadContainer.removeAll(true)
        this.createGamepadPanel(centerX, this.cameras.main.height / 2)
      })

      this.gamepadContainer.add(btn)
    })
  }

  createButtonMappingSection(centerX, y) {
    const mapping = GamepadManager.getMapping()
    
    // Section header
    const header = this.add.text(centerX, y, "Button Mappings", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)
    this.gamepadContainer.add(header)

    // Mapping rows
    const mappings = [
      { button: "dpadUp", label: "D-Pad Up", action: "Jump / Up" },
      { button: "dpadDown", label: "D-Pad Down", action: "Crouch / Down" },
      { button: "dpadLeft", label: "D-Pad Left", action: "Move Left" },
      { button: "dpadRight", label: "D-Pad Right", action: "Move Right" },
      { button: "buttonA", label: "A Button", action: "Confirm (Enter)" },
      { button: "buttonB", label: "B Button", action: "Jump (Up Arrow)" },
      { button: "buttonX", label: "X Button", action: "Pause" },
      { button: "buttonY", label: "Y Button", action: "Run (Space)" },
      { button: "leftTrigger", label: "L Trigger", action: "Respawn (/)" },
      { button: "rightTrigger", label: "R Trigger", action: "Spawn Shift (Q)" },
      { button: "select", label: "Select", action: "Restart (R)" },
      { button: "start", label: "Start", action: "Pause" }
    ]

    const listY = y + 30
    const rowHeight = 28
    const colWidth = 320

    mappings.forEach((m, i) => {
      const row = Math.floor(i / 2)
      const col = i % 2
      const x = centerX - colWidth / 2 + col * colWidth
      const rowY = listY + row * rowHeight

      // Button label
      const labelText = this.add.text(x - 140, rowY, m.label, {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#888888"
      }).setOrigin(0, 0.5)
      this.gamepadContainer.add(labelText)

      // Action
      const actionText = this.add.text(x + 20, rowY, m.action, {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#00ff88"
      }).setOrigin(0, 0.5)
      this.gamepadContainer.add(actionText)

      // Remap button (future feature)
      const remapBtn = this.add.text(x + 130, rowY, "[EDIT]", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#666666",
        backgroundColor: "#222233",
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5)
      
      remapBtn.setInteractive({ useHandCursor: true })
      remapBtn.on("pointerover", () => remapBtn.setColor("#aaaaaa"))
      remapBtn.on("pointerout", () => remapBtn.setColor("#666666"))
      remapBtn.on("pointerdown", () => {
        this.startRemapping(m.button, m.label, remapBtn)
      })
      
      this.gamepadContainer.add(remapBtn)
    })
  }

  /**
   * Start remapping a button
   */
  async startRemapping(buttonName, buttonLabel, buttonElement) {
    // Show waiting state
    buttonElement.setText("[PRESS]")
    buttonElement.setColor("#ffaa00")
    
    // Show instruction overlay
    const overlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      400, 100,
      0x000000, 0.9
    ).setStrokeStyle(2, 0xffaa00).setDepth(100)
    
    const instructionText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      `Press a button on your controller\nto assign to "${buttonLabel}"`,
      {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ffaa00",
        align: "center"
      }
    ).setOrigin(0.5).setDepth(101)

    try {
      const result = await GamepadManager.waitForButtonPress(5000)
      
      // Update mapping
      GamepadManager.setMapping(buttonName, result.buttonIndex)
      
      // Play success sound
      this.sound.play("ui_confirm_sound", { volume: AudioManager.getScaledSfxVolume(0.4) })
      
      // Update button text
      buttonElement.setText("[EDIT]")
      buttonElement.setColor("#00ff88")
      
      // Show success briefly
      instructionText.setText(`Mapped to button ${result.buttonIndex}!`)
      instructionText.setColor("#00ff88")
      
      // Auto-save to Supabase in background (if logged in)
      if (AuthManager.isLoggedIn()) {
        GamepadManager.saveMappingToSupabase().then(saveResult => {
          if (saveResult.success && this.saveStatusText) {
            this.saveStatusText.setText("Auto-saved to profile ✓")
            this.saveStatusText.setColor("#00ff88")
            this.time.delayedCall(2000, () => {
              if (this.saveStatusText) {
                this.saveStatusText.setText("")
              }
            })
          }
        })
      }
      
      this.time.delayedCall(1000, () => {
        overlay.destroy()
        instructionText.destroy()
        buttonElement.setColor("#666666")
      })
      
    } catch (e) {
      // Timeout or error
      buttonElement.setText("[EDIT]")
      buttonElement.setColor("#666666")
      
      instructionText.setText("Timed out. Try again.")
      instructionText.setColor("#ff6666")
      
      this.time.delayedCall(1500, () => {
        overlay.destroy()
        instructionText.destroy()
      })
    }
  }

  createDebugToggle(centerX, y) {
    const isDebugOn = GamepadManager.showDebug

    const label = this.add.text(centerX - 80, y, "Debug Overlay:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0, 0.5)
    this.gamepadContainer.add(label)

    const toggleBtn = this.add.text(centerX + 60, y, isDebugOn ? "[ON]" : "[OFF]", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: isDebugOn ? "#00ff88" : "#666666",
      backgroundColor: "#222244",
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    toggleBtn.on("pointerdown", () => {
      GamepadManager.toggleDebug()
      const newState = GamepadManager.showDebug
      toggleBtn.setText(newState ? "[ON]" : "[OFF]")
      toggleBtn.setColor(newState ? "#00ff88" : "#666666")
      this.sound.play("ui_select_sound", { volume: AudioManager.getScaledSfxVolume(0.3) })
    })

    this.gamepadContainer.add(toggleBtn)
  }

  createSaveToProfileButton(centerX, y) {
    const isLoggedIn = AuthManager.isLoggedIn()
    
    // Container for the button
    const container = this.add.container(centerX, y)
    this.gamepadContainer.add(container)
    
    // Background - more prominent styling
    const bg = this.add.rectangle(0, 0, 280, 36, isLoggedIn ? 0x004400 : 0x333333, 0.9)
      .setStrokeStyle(2, isLoggedIn ? 0x00ff88 : 0x666666)
    container.add(bg)
    
    const btnText = this.add.text(0, 0, isLoggedIn ? "💾 SAVE CONTROLS TO PROFILE" : "💾 LOGIN TO SAVE CONTROLS", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: isLoggedIn ? "#00ff88" : "#888888"
    }).setOrigin(0.5)
    container.add(btnText)
    
    // Status text (shows save result)
    this.saveStatusText = this.add.text(0, 22, "", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#888888"
    }).setOrigin(0.5)
    container.add(this.saveStatusText)
    
    if (isLoggedIn) {
      bg.setInteractive({ useHandCursor: true })
      
      bg.on("pointerover", () => {
        bg.setStrokeStyle(3, 0xffffff)
        bg.setFillStyle(0x005500)
        btnText.setColor("#ffffff")
      })
      
      bg.on("pointerout", () => {
        bg.setStrokeStyle(2, 0x00ff88)
        bg.setFillStyle(0x004400)
        btnText.setColor("#00ff88")
      })
      
      bg.on("pointerdown", async () => {
        this.sound.play("ui_confirm_sound", { volume: AudioManager.getScaledSfxVolume(0.4) })
        
        // Show saving state
        btnText.setText("💾 SAVING...")
        btnText.setColor("#ffaa00")
        this.saveStatusText.setText("")
        
        // Save to Supabase
        const result = await GamepadManager.saveMappingToSupabase()
        
        if (result.success) {
          btnText.setText("✓ SAVED TO PROFILE!")
          btnText.setColor("#00ff88")
          this.saveStatusText.setText("Your controls will sync across devices")
          this.saveStatusText.setColor("#00ff88")
          
          // Reset button text after delay
          this.time.delayedCall(2500, () => {
            btnText.setText("💾 SAVE CONTROLS TO PROFILE")
            btnText.setColor("#00ff88")
            this.saveStatusText.setText("")
          })
        } else {
          btnText.setText("✗ SAVE FAILED")
          btnText.setColor("#ff6666")
          this.saveStatusText.setText(result.error || "Please try again")
          this.saveStatusText.setColor("#ff6666")
          
          // Reset button text after delay
          this.time.delayedCall(3000, () => {
            btnText.setText("💾 SAVE CONTROLS TO PROFILE")
            btnText.setColor("#00ff88")
            this.saveStatusText.setText("")
          })
        }
      })
    } else {
      // Not logged in - clicking prompts login
      bg.setInteractive({ useHandCursor: true })
      
      bg.on("pointerover", () => {
        bg.setStrokeStyle(2, 0xaaaaaa)
        btnText.setColor("#aaaaaa")
      })
      
      bg.on("pointerout", () => {
        bg.setStrokeStyle(2, 0x666666)
        btnText.setColor("#888888")
      })
      
      bg.on("pointerdown", () => {
        this.sound.play("ui_select_sound", { volume: AudioManager.getScaledSfxVolume(0.3) })
        this.saveStatusText.setText("Sign in from the main menu to save")
        this.saveStatusText.setColor("#ffaa00")
      })
    }
  }

  createResetButton(centerX, y) {
    const btn = this.add.text(centerX, y, "🔄 RESET TO DEFAULTS", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff6666",
      backgroundColor: "#330000",
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    btn.on("pointerover", () => btn.setColor("#ff9999"))
    btn.on("pointerout", () => btn.setColor("#ff6666"))
    btn.on("pointerdown", async () => {
      GamepadManager.resetToDefaults()
      
      this.sound.play("ui_confirm_sound", { volume: AudioManager.getScaledSfxVolume(0.4) })
      
      // Show confirmation
      const confirmText = this.add.text(centerX, y - 25, "Defaults restored!", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#00ff88"
      }).setOrigin(0.5)
      this.gamepadContainer.add(confirmText)
      
      // Auto-save to Supabase if logged in
      if (AuthManager.isLoggedIn()) {
        const result = await GamepadManager.saveMappingToSupabase()
        if (result.success && this.saveStatusText) {
          this.saveStatusText.setText("Defaults saved to profile ✓")
          this.saveStatusText.setColor("#00ff88")
          this.time.delayedCall(2000, () => {
            if (this.saveStatusText) {
              this.saveStatusText.setText("")
            }
          })
        }
      }
      
      this.tweens.add({
        targets: confirmText,
        alpha: 0,
        duration: 1000,
        delay: 1500,
        onComplete: () => confirmText.destroy()
      })
    })

    this.gamepadContainer.add(btn)
  }

  createBackButton(centerX) {
    const y = this.cameras.main.height - 45

    const container = this.add.container(centerX, y)

    const bg = this.add.rectangle(0, 0, 180, 40, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0xff69b4)

    const text = this.add.text(0, 0, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerover", () => {
      bg.setStrokeStyle(3, 0xffffff)
      text.setColor("#ffffff")
      container.setScale(1.05)
    })
    bg.on("pointerout", () => {
      bg.setStrokeStyle(2, 0xff69b4)
      text.setColor("#ff69b4")
      container.setScale(1)
    })
    bg.on("pointerdown", () => {
      this.goBack()
    })
  }

  setupInput() {
    // ESC to go back
    this.input.keyboard.on("keydown-ESC", () => this.goBack())
    
    // Tab switching
    this.input.keyboard.on("keydown-LEFT", () => this.showTab("keyboard"))
    this.input.keyboard.on("keydown-RIGHT", () => this.showTab("gamepad"))
  }

  setupGamepadListeners() {
    // Listen for controller connections
    this.gamepadConnectedHandler = () => {
      this.updateControllerStatus()
    }
    this.gamepadDisconnectedHandler = () => {
      this.updateControllerStatus()
    }
    
    GamepadManager.on("connected", this.gamepadConnectedHandler)
    GamepadManager.on("disconnected", this.gamepadDisconnectedHandler)
  }

  goBack() {
    // Clean up listeners
    GamepadManager.off("connected", this.gamepadConnectedHandler)
    GamepadManager.off("disconnected", this.gamepadDisconnectedHandler)
    
    // Auto-save to Supabase when leaving (if logged in) - fire and forget
    if (AuthManager.isLoggedIn()) {
      GamepadManager.saveMappingToSupabase().catch(e => {
        console.warn("[ControlsSettingsScene] Auto-save on exit failed:", e)
      })
    }
    
    this.sound.play("ui_confirm_sound", { volume: AudioManager.getScaledSfxVolume(0.4) })
    this.scene.start(this.returnScene, this.returnData)
  }

  shutdown() {
    // Clean up listeners
    if (this.gamepadConnectedHandler) {
      GamepadManager.off("connected", this.gamepadConnectedHandler)
    }
    if (this.gamepadDisconnectedHandler) {
      GamepadManager.off("disconnected", this.gamepadDisconnectedHandler)
    }
  }
}
