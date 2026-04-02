import Phaser from "phaser"

/**
 * MobileControlsScene - Reads virtual controls from DOM-based touch buttons
 * 
 * The actual touch controls are rendered as HTML elements outside the Phaser canvas,
 * positioned in the vacant black space around the game viewport:
 * - Portrait: Controls below the game
 * - Landscape: D-pad on left, A/B buttons on right
 * 
 * This scene simply reads the state from window.virtualControlsState and
 * provides the same interface that game scenes expect.
 * 
 * Controls:
 * - D-pad: 4-way directional (swipe/slide between directions)
 * - Start: Access menu (pause) during gameplay, confirm in menus
 * - Select: Access settings
 * - A button: Jump during gameplay, CONFIRM/ENTER in menus
 * - B button: Run (hold) during gameplay, BACK in menus
 */
export class MobileControlsScene extends Phaser.Scene {
  constructor() {
    super({ key: "MobileControlsScene" })
  }

  init(data) {
    this.gameSceneKey = data?.gameSceneKey || null
  }

  create() {
    // Check if this is a touch device
    this.isTouchDevice = this.checkTouchDevice()
    
    // Skip if not a touch device
    if (!this.isTouchDevice) {
      return
    }

    // Virtual button states - these will be read by game scenes
    this.virtualControls = {
      left: { isDown: false },
      right: { isDown: false },
      up: { isDown: false },
      down: { isDown: false },
      space: { isDown: false },  // B button (run)
      start: false,   // Start button (menu)
      select: false   // Select button (settings)
    }

    // Track previous states for JustDown detection
    this.prevStates = {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
      start: false,
      select: false
    }

    // Track JustDown states for buttons that need single-press detection
    this.justDownStates = {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
      start: false,
      select: false
    }

    // Register virtual controls globally
    this.registry.set("virtualControls", this.virtualControls)
    this.registry.set("mobileControlsActive", true)
  }

  checkTouchDevice() {
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    )
  }

  /**
   * Read the current state from DOM-based virtual controls
   */
  readDOMControls() {
    if (!window.virtualControlsState) {
      return
    }

    const domState = window.virtualControlsState

    // Update virtual controls from DOM state
    this.virtualControls.left.isDown = domState.left
    this.virtualControls.right.isDown = domState.right
    this.virtualControls.down.isDown = domState.down
    
    // A button = Jump (up arrow / up direction)
    // Either the A button or D-pad up triggers jump
    this.virtualControls.up.isDown = domState.up || domState.a
    
    // B button = Run (space key equivalent)
    this.virtualControls.space.isDown = domState.b
    
    // Start/Select buttons
    this.virtualControls.start = domState.start
    this.virtualControls.select = domState.select

    // ============================================
    // DETECT JUST-PRESSED FOR ALL BUTTONS
    // ============================================
    
    // D-pad directions
    if (domState.up && !this.prevStates.up) {
      this.justDownStates.up = true
    }
    if (domState.down && !this.prevStates.down) {
      this.justDownStates.down = true
    }
    if (domState.left && !this.prevStates.left) {
      this.justDownStates.left = true
    }
    if (domState.right && !this.prevStates.right) {
      this.justDownStates.right = true
    }
    
    // A button just pressed - emit events for menus
    if (domState.a && !this.prevStates.a) {
      this.justDownStates.a = true
      this.events.emit("virtualJump")
      this.events.emit("virtualConfirm") // A = confirm/enter in menus
      this.events.emit("virtualA")
    }

    // B button just pressed - emit back event for menus
    if (domState.b && !this.prevStates.b) {
      this.justDownStates.b = true
      this.events.emit("virtualBack") // B = back in menus
      this.events.emit("virtualB")
    }

    // Start button just pressed
    if (domState.start && !this.prevStates.start) {
      this.justDownStates.start = true
      this.events.emit("virtualStart")
      this.events.emit("virtualConfirm") // Start also confirms in menus
      this.handleStartPress()
    }

    // Select button just pressed
    if (domState.select && !this.prevStates.select) {
      this.justDownStates.select = true
      this.events.emit("virtualSelect")
      this.handleSelectPress()
    }

    // Update previous states
    this.prevStates.up = domState.up
    this.prevStates.down = domState.down
    this.prevStates.left = domState.left
    this.prevStates.right = domState.right
    this.prevStates.a = domState.a
    this.prevStates.b = domState.b
    this.prevStates.start = domState.start
    this.prevStates.select = domState.select
  }

  /**
   * Handle Start button press - opens pause menu during gameplay
   */
  handleStartPress() {
    // Find the active game scene and trigger pause
    const activeScenes = this.scene.manager.getScenes(true)
    for (const scene of activeScenes) {
      if (scene.scene.key !== "MobileControlsScene" && 
          scene.scene.key !== "UIScene" && 
          typeof scene.openPauseMenu === "function") {
        scene.openPauseMenu()
        break
      }
    }
  }

  /**
   * Handle Select button press - opens settings
   */
  handleSelectPress() {
    // Open settings scene
    if (!this.scene.isActive("SettingsScene")) {
      this.scene.launch("SettingsScene")
    }
  }

  /**
   * Check if a virtual button was just pressed (for single-press detection)
   * Should be called once per frame and will auto-reset
   */
  justDown(button) {
    if (this.justDownStates[button]) {
      this.justDownStates[button] = false
      return true
    }
    return false
  }

  update() {
    if (!this.isTouchDevice) {
      return
    }

    // Read DOM control states
    this.readDOMControls()

    // Reset justDown states each frame (they should persist for one frame max)
    // But only after they've had a chance to be read
  }

  shutdown() {
    // Clean up
    this.registry.set("mobileControlsActive", false)
  }
}

/**
 * Helper function to merge virtual controls with keyboard cursors
 * Use this in game scenes to support both input methods
 * 
 * @param {object} cursors - Phaser keyboard cursors object
 * @param {object} registry - Scene registry
 * @returns {object} - Merged controls object with proper Phaser-like interface
 */
export function getMergedControls(cursors, registry) {
  const virtualControls = registry.get("virtualControls")
  const mobileActive = registry.get("mobileControlsActive")
  
  if (!mobileActive || !virtualControls) {
    return cursors
  }
  
  // Track previous state for JustDown detection
  if (!registry.get("_prevControlState")) {
    registry.set("_prevControlState", {
      up: false, down: false, left: false, right: false, space: false
    })
  }
  const prevState = registry.get("_prevControlState")
  
  // Current combined state
  const currentUp = cursors.up.isDown || virtualControls.up.isDown
  const currentDown = cursors.down.isDown || virtualControls.down.isDown
  const currentLeft = cursors.left.isDown || virtualControls.left.isDown
  const currentRight = cursors.right.isDown || virtualControls.right.isDown
  const currentSpace = (cursors.space?.isDown || false) || virtualControls.space.isDown
  
  // Create merged object with JustDown detection
  const merged = {
    left: { 
      isDown: currentLeft,
      _justDown: currentLeft && !prevState.left
    },
    right: { 
      isDown: currentRight,
      _justDown: currentRight && !prevState.right
    },
    up: { 
      isDown: currentUp,
      _justDown: currentUp && !prevState.up
    },
    down: { 
      isDown: currentDown,
      _justDown: currentDown && !prevState.down
    },
    space: { 
      isDown: currentSpace,
      _justDown: currentSpace && !prevState.space
    }
  }
  
  // Update previous state for next frame
  registry.set("_prevControlState", {
    up: currentUp,
    down: currentDown,
    left: currentLeft,
    right: currentRight,
    space: currentSpace
  })
  
  return merged
}

/**
 * Check if a merged control was just pressed this frame
 * Works with both real Phaser keys and merged control objects
 * 
 * @param {object} control - The control key object
 * @returns {boolean} - True if just pressed this frame
 */
export function isJustDown(control) {
  if (!control) return false
  
  // Check our custom _justDown property first
  if (control._justDown !== undefined) {
    return control._justDown
  }
  
  // Fallback to Phaser's JustDown for real keyboard keys
  return Phaser.Input.Keyboard.JustDown(control)
}
