import Phaser from "phaser"
import { AudioManager } from "./AudioManager.js"
import { BGMManager } from "./BGMManager.js"
import { UserProfileManager } from "./UserProfileManager.js"
import { DevModeManager } from "./DevModeManager.js"
import { AuthManager } from "./AuthManager.js"

/**
 * SettingsScene - Audio and Controls settings
 * Features tabbed interface for Audio (volume sliders) and Controls (premium features)
 * Can be opened from TitleScreen or PauseMenuScene
 */
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: "SettingsScene" })
  }

  init(data) {
    // Track where we came from to return properly
    this.returnScene = data?.returnScene || "TitleScreen"
    this.returnData = data?.returnData || {}
    this.gameSceneKey = data?.gameSceneKey || null // If opened from pause menu
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Current tab state
    this.currentTab = "audio" // "audio" or "controls"

    // Background
    this.createBackground()

    // Title
    this.add.text(centerX, 60, "SETTINGS", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    // Create tab buttons
    this.createTabs(centerX)

    // Create content containers for each tab
    this.audioContainer = this.add.container(0, 0)
    this.controlsContainer = this.add.container(0, 0)

    // Populate tabs
    this.createAudioPanel(centerX, centerY)
    this.createControlsPanel(centerX, centerY)

    // Show initial tab
    this.showTab("audio")

    // Back button
    this.createBackButton(centerX)

    // Setup input
    this.setupInput()
  }

  createBackground() {
    // Dark background
    this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x0a0a15
    ).setOrigin(0, 0)

    // Decorative punk lines
    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0xff00ff, 0.15)

    for (let i = -this.cameras.main.height; i < this.cameras.main.width + this.cameras.main.height; i += 80) {
      graphics.beginPath()
      graphics.moveTo(i, 0)
      graphics.lineTo(i + this.cameras.main.height, this.cameras.main.height)
      graphics.strokePath()
    }

    // Panel background
    this.panelBg = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 25,
      520,
      470,
      0x1a1a2e,
      0.9
    ).setStrokeStyle(2, 0x333366)
  }

  createTabs(centerX) {
    const tabY = 110
    const tabWidth = 150
    const tabSpacing = 20

    // Audio tab
    this.audioTab = this.createTabButton(
      centerX - tabWidth / 2 - tabSpacing / 2,
      tabY,
      "🔊 AUDIO",
      "audio"
    )

    // Controls tab
    this.controlsTab = this.createTabButton(
      centerX + tabWidth / 2 + tabSpacing / 2,
      tabY,
      "🎮 CONTROLS",
      "controls"
    )
  }

  createTabButton(x, y, label, tabKey) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 150, 40, 0x222244, 0.9)
      .setStrokeStyle(2, 0x444488)

    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
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

    // Update tab button visuals
    const tabs = [this.audioTab, this.controlsTab]
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
    this.audioContainer.setVisible(tabKey === "audio")
    this.controlsContainer.setVisible(tabKey === "controls")
  }

  createAudioPanel(centerX, centerY) {
    const startY = centerY - 20

    // Section header
    const header = this.add.text(centerX, startY - 100, "Volume Settings", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffffff"
    }).setOrigin(0.5)
    this.audioContainer.add(header)

    // SFX Volume slider
    const sfxSlider = this.createVolumeSlider(
      centerX,
      startY - 20,
      "SFX VOLUME",
      AudioManager.getSfxVolume(),
      (value) => {
        AudioManager.setSfxVolume(value)
        this.playTestSfx()
      }
    )
    sfxSlider.elements.forEach(el => this.audioContainer.add(el))

    // Music Volume slider
    const musicSlider = this.createVolumeSlider(
      centerX,
      startY + 80,
      "MUSIC VOLUME",
      AudioManager.getMusicVolume(),
      (value) => {
        AudioManager.setMusicVolume(value, BGMManager)
      }
    )
    musicSlider.elements.forEach(el => this.audioContainer.add(el))
  }

  createControlsPanel(centerX, centerY) {
    const startY = centerY - 80
    const isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    // Touch devices show an extra MAP BUTTONS button in the mobile row, so
    // push the premium features section down to avoid overlap.
    const premiumOffset = isTouchDevice ? 30 : 0

    // CONFIGURE CONTROLS BUTTON - opens detailed controls settings
    this.createControlsConfigButton(centerX, startY - 60)

    // ── ON-SCREEN TOUCH CONTROLS TOGGLE ──────────────────────────
    this.createMobileControlsRow(centerX, startY - 15)

    // Section header
    const header = this.add.text(centerX, startY + 60 + premiumOffset, "Premium Features", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffffff"
    }).setOrigin(0.5)
    this.controlsContainer.add(header)

    // Description
    const desc = this.add.text(centerX, startY + 85 + premiumOffset, "Unlockable movement enhancements", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    this.controlsContainer.add(desc)

    // Auto-Ricochet toggle
    this.createFeatureToggle(
      centerX,
      startY + 140 + premiumOffset,
      "AUTO-RICOCHET",
      "Hold jump while wall-sliding for turbo wall jumps",
      () => this.isAutoRicochetUnlocked(),
      () => this.isAutoRicochetEnabled(),
      (enabled) => this.setAutoRicochetEnabled(enabled)
    )

    // Spawn Shifting toggle
    this.createFeatureToggle(
      centerX,
      startY + 225 + premiumOffset,
      "SPAWN SHIFTING",
      "Press Q during gameplay to set respawn point",
      () => this.isSpawnShiftingUnlocked(),
      () => this.isSpawnShiftingEnabled(),
      (enabled) => this.setSpawnShiftingEnabled(enabled)
    )

    // Developer note if in dev mode
    if (DevModeManager.isDevMode()) {
      const devNote = this.add.text(centerX, startY + 310 + premiumOffset, "🔧 DEV MODE: All features unlocked", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#ff00ff"
      }).setOrigin(0.5)
      this.controlsContainer.add(devNote)
    }
  }

  /**
   * ON-SCREEN TOUCH CONTROLS toggle row
   */
  createMobileControlsRow(centerX, y) {
    const isTouchDevice = (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    )

    // Label
    const label = this.add.text(centerX - 180, y, "ON-SCREEN CONTROLS", {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#ffffff"
    }).setOrigin(0, 0.5)
    this.controlsContainer.add(label)

    const subLabel = this.add.text(centerX - 180, y + 18, "Virtual buttons for touchscreen play", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0, 0.5)
    this.controlsContainer.add(subLabel)

    // Read current state
    const initialOn = typeof window.getMobileControlsEnabled === 'function'
      ? window.getMobileControlsEnabled()
      : isTouchDevice

    // Toggle switch
    const toggle = this.createToggleSwitch(
      centerX + 160, y,
      initialOn,
      (enabled) => {
        if (typeof window.setMobileControlsEnabled === 'function') {
          window.setMobileControlsEnabled(enabled)
        }
      }
    )
    toggle.elements.forEach(el => this.controlsContainer.add(el))

    // Hint buttons — only on touch devices
    if (isTouchDevice) {
      // ✏ EDIT LAYOUT
      const hintBg = this.add.rectangle(centerX + 100, y + 38, 112, 22, 0x1a1a3a, 0.9)
        .setStrokeStyle(1, 0x004477)
      const hintText = this.add.text(centerX + 100, y + 38, "✏ EDIT LAYOUT", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#0088cc"
      }).setOrigin(0.5)
      this.controlsContainer.add(hintBg)
      this.controlsContainer.add(hintText)
      hintBg.setInteractive({ useHandCursor: true })
      hintBg.on("pointerdown", () => {
        if (typeof window.__enterTouchEditMode === 'function') {
          window.__enterTouchEditMode()
        }
        this.scene.stop()
      })
      hintBg.on("pointerover", () => {
        hintBg.setStrokeStyle(1, 0x00aaff)
        hintText.setColor("#00ccff")
      })
      hintBg.on("pointerout", () => {
        hintBg.setStrokeStyle(1, 0x004477)
        hintText.setColor("#0088cc")
      })

      // 📱 MAP TOUCH BUTTONS
      const mapBg = this.add.rectangle(centerX + 100, y + 65, 112, 22, 0x1a1a3a, 0.9)
        .setStrokeStyle(1, 0x335500)
      const mapText = this.add.text(centerX + 100, y + 65, "📱 MAP BUTTONS", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#66cc22"
      }).setOrigin(0.5)
      this.controlsContainer.add(mapBg)
      this.controlsContainer.add(mapText)
      mapBg.setInteractive({ useHandCursor: true })
      mapBg.on("pointerdown", () => {
        this.scene.start("TouchMappingScene", {
          returnScene: "SettingsScene",
          returnData: {
            returnScene: this.returnScene,
            returnData: this.returnData,
            gameSceneKey: this.gameSceneKey
          }
        })
      })
      mapBg.on("pointerover", () => {
        mapBg.setStrokeStyle(1, 0x88ff33)
        mapText.setColor("#99ff44")
      })
      mapBg.on("pointerout", () => {
        mapBg.setStrokeStyle(1, 0x335500)
        mapText.setColor("#66cc22")
      })
    }

    // Separator line below the row
    const sep = this.add.graphics()
    sep.lineStyle(1, 0x222244, 0.8)
    const sepY = isTouchDevice ? y + 82 : y + 52
    sep.moveTo(centerX - 230, sepY)
    sep.lineTo(centerX + 230, sepY)
    sep.strokePath()
    this.controlsContainer.add(sep)
  }

  /**
   * Create button to open detailed controls configuration
   */
  createControlsConfigButton(centerX, y) {
    const container = this.add.container(centerX, y)
    this.controlsContainer.add(container)

    const bg = this.add.rectangle(0, 0, 280, 45, 0x223355, 0.9)
      .setStrokeStyle(2, 0x00ffff)

    const text = this.add.text(0, 0, "🎮 CONFIGURE CONTROLS", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff"
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerover", () => {
      bg.setStrokeStyle(3, 0xffffff)
      text.setColor("#ffffff")
      container.setScale(1.05)
      this.sound.play("ui_select_sound", { volume: AudioManager.getScaledSfxVolume(0.3) })
    })
    bg.on("pointerout", () => {
      bg.setStrokeStyle(2, 0x00ffff)
      text.setColor("#00ffff")
      container.setScale(1)
    })
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: AudioManager.getScaledSfxVolume(0.4) })
      this.scene.start("ControlsSettingsScene", {
        returnScene: "SettingsScene",
        returnData: {
          returnScene: this.returnScene,
          returnData: this.returnData,
          gameSceneKey: this.gameSceneKey
        }
      })
    })

    // Sub-label
    const subLabel = this.add.text(0, 28, "Keyboard & Gamepad mapping", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0.5)
    container.add(subLabel)
  }

  createFeatureToggle(x, y, label, description, isUnlocked, isEnabled, onToggle) {
    const unlocked = isUnlocked()
    const enabled = isEnabled()

    // Feature name
    const nameText = this.add.text(x - 180, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: unlocked ? "#ffffff" : "#666666"
    }).setOrigin(0, 0.5)
    this.controlsContainer.add(nameText)

    // Description
    const descText = this.add.text(x - 180, y + 22, description, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0, 0.5)
    this.controlsContainer.add(descText)

    // Status / Toggle
    if (unlocked) {
      // Create toggle switch
      const toggle = this.createToggleSwitch(x + 160, y, enabled, onToggle)
      toggle.elements.forEach(el => this.controlsContainer.add(el))
    } else {
      // Show locked status
      const lockedBg = this.add.rectangle(x + 160, y, 80, 30, 0x333333, 0.8)
        .setStrokeStyle(1, 0x555555)
      const lockedText = this.add.text(x + 160, y, "🔒 LOCKED", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#888888"
      }).setOrigin(0.5)
      this.controlsContainer.add(lockedBg)
      this.controlsContainer.add(lockedText)

      // Unlock hint
      const hintText = this.add.text(x - 180, y + 42, "Unlock with Premium or in-game progression", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#ff69b4"
      }).setOrigin(0, 0.5)
      this.controlsContainer.add(hintText)
    }
  }

  createToggleSwitch(x, y, initialValue, onChange) {
    const width = 60
    const height = 28
    const handleSize = 22

    // Track background
    const trackBg = this.add.rectangle(x, y, width, height, initialValue ? 0x00aa66 : 0x444466, 0.9)
      .setStrokeStyle(2, initialValue ? 0x00ff88 : 0x666688)

    // Handle
    const handleX = initialValue ? x + width / 2 - handleSize / 2 - 4 : x - width / 2 + handleSize / 2 + 4
    const handle = this.add.circle(handleX, y, handleSize / 2, 0xffffff)
      .setStrokeStyle(2, 0xcccccc)

    // Status text
    const statusText = this.add.text(x, y + 22, initialValue ? "ON" : "OFF", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: initialValue ? "#00ff88" : "#888888"
    }).setOrigin(0.5)

    // Store state
    let isOn = initialValue

    // Make interactive
    trackBg.setInteractive({ useHandCursor: true })
    trackBg.on("pointerdown", () => {
      isOn = !isOn
      
      // Animate toggle
      this.tweens.add({
        targets: handle,
        x: isOn ? x + width / 2 - handleSize / 2 - 4 : x - width / 2 + handleSize / 2 + 4,
        duration: 100
      })

      // Update visuals
      trackBg.setFillStyle(isOn ? 0x00aa66 : 0x444466)
      trackBg.setStrokeStyle(2, isOn ? 0x00ff88 : 0x666688)
      statusText.setText(isOn ? "ON" : "OFF")
      statusText.setColor(isOn ? "#00ff88" : "#888888")

      // Play sound and call callback
      this.sound.play("ui_confirm_sound", { volume: AudioManager.getScaledSfxVolume(0.3) })
      onChange(isOn)
    })

    return { elements: [trackBg, handle, statusText] }
  }

  // Feature unlock checks
  isAutoRicochetUnlocked() {
    // Dev mode always has access
    if (DevModeManager.isDevMode()) return true
    // Check user profile
    return UserProfileManager.hasAutoRicochet()
  }

  isSpawnShiftingUnlocked() {
    // Dev mode always has access
    if (DevModeManager.isDevMode()) return true
    // Check user profile
    return UserProfileManager.hasSpawnShifting()
  }

  // Feature enable/disable (stored in local storage for now, could be synced to profile)
  isAutoRicochetEnabled() {
    // If not unlocked, it's always disabled
    if (!this.isAutoRicochetUnlocked()) return false
    // Check local preference (default to false)
    const stored = localStorage.getItem("autoRicochetEnabled")
    return stored === "true"
  }

  setAutoRicochetEnabled(enabled) {
    localStorage.setItem("autoRicochetEnabled", enabled.toString())
    // Emit event for any active game scenes to pick up
    this.game.events.emit("autoRicochetChanged", enabled)
  }

  isSpawnShiftingEnabled() {
    // If not unlocked, it's always disabled
    if (!this.isSpawnShiftingUnlocked()) return false
    // Check local preference (default to true if unlocked)
    const stored = localStorage.getItem("spawnShiftingEnabled")
    return stored === null ? true : stored === "true"
  }

  setSpawnShiftingEnabled(enabled) {
    localStorage.setItem("spawnShiftingEnabled", enabled.toString())
    // Emit event for any active game scenes to pick up
    this.game.events.emit("spawnShiftingChanged", enabled)
  }

  createVolumeSlider(x, y, label, initialValue, onChange) {
    const sliderWidth = 300
    const sliderHeight = 12
    const handleSize = 24
    const elements = []

    // Label
    const labelText = this.add.text(x, y - 30, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)
    elements.push(labelText)

    // Percentage display
    const percentText = this.add.text(x + sliderWidth / 2 + 40, y, `${Math.round(initialValue * 100)}%`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ff88"
    }).setOrigin(0, 0.5)
    elements.push(percentText)

    // Slider track background
    const trackBg = this.add.rectangle(x, y, sliderWidth, sliderHeight, 0x333355)
      .setStrokeStyle(1, 0x555577)
    elements.push(trackBg)

    // Slider fill
    const fill = this.add.rectangle(
      x - sliderWidth / 2, y,
      sliderWidth * initialValue, sliderHeight,
      0x00ff88
    ).setOrigin(0, 0.5)
    elements.push(fill)

    // Slider handle
    const handle = this.add.circle(
      x - sliderWidth / 2 + sliderWidth * initialValue,
      y,
      handleSize / 2,
      0xffffff
    ).setStrokeStyle(3, 0x00ff88)
    elements.push(handle)

    // Invisible interactive zone
    const hitZone = this.add.rectangle(x, y, sliderWidth + handleSize, sliderHeight + 30, 0x000000, 0)
      .setInteractive({ useHandCursor: true, draggable: true })
    elements.push(hitZone)

    // Slider data
    const sliderData = { fill, handle, percentText, sliderWidth, x, onChange, value: initialValue }

    hitZone.on("pointerdown", (pointer) => this.updateSlider(sliderData, pointer.x))
    hitZone.on("pointermove", (pointer) => {
      if (pointer.isDown) this.updateSlider(sliderData, pointer.x)
    })
    hitZone.on("pointerover", () => handle.setStrokeStyle(3, 0xffffff))
    hitZone.on("pointerout", () => handle.setStrokeStyle(3, 0x00ff88))

    return { sliderData, elements }
  }

  updateSlider(sliderData, pointerX) {
    const { fill, handle, percentText, sliderWidth, x, onChange } = sliderData
    
    const leftEdge = x - sliderWidth / 2
    const rightEdge = x + sliderWidth / 2
    const clampedX = Phaser.Math.Clamp(pointerX, leftEdge, rightEdge)
    const newValue = (clampedX - leftEdge) / sliderWidth

    fill.width = sliderWidth * newValue
    handle.x = leftEdge + sliderWidth * newValue
    percentText.setText(`${Math.round(newValue * 100)}%`)

    sliderData.value = newValue
    onChange(newValue)
  }

  playTestSfx() {
    const volume = AudioManager.getScaledSfxVolume(0.4)
    this.sound.play("ui_select_sound", { volume })
  }

  createBackButton(centerX) {
    const y = this.cameras.main.height - 60

    const container = this.add.container(centerX, y)

    const bg = this.add.rectangle(0, 0, 200, 45, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0xff69b4)

    const text = this.add.text(0, 0, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerover", () => {
      bg.setStrokeStyle(3, 0xffffff)
      text.setColor("#ffffff")
      container.setScale(1.05)
      this.sound.play("ui_select_sound", { volume: AudioManager.getScaledSfxVolume(0.4) })
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
    
    // Tab switching with left/right
    this.input.keyboard.on("keydown-LEFT", () => this.showTab("audio"))
    this.input.keyboard.on("keydown-RIGHT", () => this.showTab("controls"))
    
    // Mobile controls
    const mobileScene = this.scene.get("MobileControlsScene")
    if (mobileScene) {
      mobileScene.events.on("virtualBack", () => this.goBack())
    }
  }
  
  goBack() {
    this.sound.play("ui_confirm_sound", { volume: AudioManager.getScaledSfxVolume(0.6) })
    
    // Return to the appropriate scene
    if (this.returnScene === "PauseMenuScene" && this.gameSceneKey) {
      // Going back to pause menu - just stop this scene, pause menu should still be there
      this.scene.stop()
      // Resume pause menu if it was sleeping
      const pauseScene = this.scene.get("PauseMenuScene")
      if (pauseScene) {
        this.scene.wake("PauseMenuScene")
      }
    } else {
      this.scene.start(this.returnScene, this.returnData)
    }
  }
}

// Static helper to check if auto-ricochet is currently enabled (for use by TeddyPlayer)
export function isAutoRicochetActive() {
  // Check if unlocked first
  if (DevModeManager.isDevMode()) {
    const stored = localStorage.getItem("autoRicochetEnabled")
    return stored === "true"
  }
  if (!UserProfileManager.hasAutoRicochet()) return false
  const stored = localStorage.getItem("autoRicochetEnabled")
  return stored === "true"
}

// Static helper to check if spawn shifting is currently enabled
export function isSpawnShiftingActive() {
  // Check if unlocked first
  if (DevModeManager.isDevMode()) {
    const stored = localStorage.getItem("spawnShiftingEnabled")
    return stored === null ? true : stored === "true"
  }
  if (!UserProfileManager.hasSpawnShifting()) return false
  const stored = localStorage.getItem("spawnShiftingEnabled")
  return stored === null ? true : stored === "true"
}
