/**
 * GamepadManager - Native USB/Bluetooth game controller support using Web Gamepad API
 * 
 * Features:
 * - Auto-detects connected controllers
 * - Supports D-pad as buttons or axes (with deadzone)
 * - Simulates keyboard events for seamless integration
 * - Configurable button mapping
 * - Persistent mapping saved to localStorage and Supabase
 * - Debug overlay for testing
 * 
 * Default mapping (matches common Xbox/PlayStation layout):
 * - D-pad: Arrow keys
 * - B/Circle: Jump (Up Arrow)
 * - Y/Triangle: Run (Space)
 * - A/Cross: Confirm (Enter)
 * - X/Square: Semicolon
 * - Select/Share: R key
 * - Start/Options: Semicolon (pause)
 * - L trigger: Slash key (/)
 * - R trigger: Q key (spawn shift)
 */

import { supabase } from "./integrations/supabase/client.js"
import { AuthManager } from "./AuthManager.js"

// Default button mapping
const DEFAULT_MAPPING = {
  // D-pad buttons (indices vary by controller, these are common)
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
  
  // Face buttons (standard gamepad layout)
  buttonA: 0,      // A/Cross - Confirm (Enter)
  buttonB: 1,      // B/Circle - Jump (Up Arrow) 
  buttonX: 2,      // X/Square - Semicolon
  buttonY: 3,      // Y/Triangle - Run (Space)
  
  // Shoulder buttons
  leftBumper: 4,   // LB/L1
  rightBumper: 5,  // RB/R1
  leftTrigger: 6,  // LT/L2 - Slash key (/)
  rightTrigger: 7, // RT/R2 - Q key (spawn shift)
  
  // Center buttons
  select: 8,       // Select/Share/Back - R key
  start: 9,        // Start/Options/Menu - Semicolon (pause)
  
  // Stick buttons
  leftStick: 10,
  rightStick: 11
}

// Default key mappings for each button
const DEFAULT_KEY_ACTIONS = {
  dpadUp: "ArrowUp",
  dpadDown: "ArrowDown",
  dpadLeft: "ArrowLeft",
  dpadRight: "ArrowRight",
  buttonA: "Enter",
  buttonB: "ArrowUp",      // Jump
  buttonX: "Semicolon",
  buttonY: "Space",        // Run
  leftBumper: null,
  rightBumper: null,
  leftTrigger: "Slash",    // /
  rightTrigger: "KeyQ",    // Q - Spawn shift
  select: "KeyR",          // R
  start: "Semicolon",      // Pause
  leftStick: null,
  rightStick: null
}

// Axis indices
const AXES = {
  leftStickX: 0,
  leftStickY: 1,
  rightStickX: 2,
  rightStickY: 3
}

// Deadzone for analog sticks acting as D-pad
const DEADZONE = 0.4

class GamepadManagerClass {
  constructor() {
    this.isEnabled = true
    this.isInitialized = false
    this.activeGamepad = null
    this.buttonMapping = { ...DEFAULT_MAPPING }
    this.keyActions = { ...DEFAULT_KEY_ACTIONS }
    
    // Button state tracking (to prevent repeat spam)
    this.buttonStates = {}
    this.axisStates = {
      up: false,
      down: false,
      left: false,
      right: false
    }
    
    // Animation frame ID for polling loop
    this.animationFrameId = null
    
    // Debug overlay
    this.debugOverlay = null
    this.showDebug = false
    
    // Connected controller info
    this.connectedControllers = []
    
    // Listeners
    this.listeners = new Set()
  }

  /**
   * Initialize the gamepad manager
   * Should be called once when the game starts
   */
  initialize() {
    if (this.isInitialized) return
    
    // Load saved mapping from localStorage first (immediate)
    this.loadMapping()
    
    // Try to load from Supabase (async, will override localStorage if successful)
    this.loadMappingFromSupabase().catch(e => {
      console.warn("[GamepadManager] Could not load from Supabase:", e)
    })
    
    // Listen for auth state changes to reload controls when user logs in
    this.setupAuthListener()
    
    // Set up gamepad connection listeners
    window.addEventListener("gamepadconnected", (e) => this.onGamepadConnected(e))
    window.addEventListener("gamepaddisconnected", (e) => this.onGamepadDisconnected(e))
    
    // Check for already-connected gamepads
    this.scanForGamepads()
    
    // Start polling loop
    this.startPolling()
    
    this.isInitialized = true
    console.log("[GamepadManager] Initialized")
  }
  
  /**
   * Set up auth state change listener to reload controls on login
   */
  setupAuthListener() {
    // Subscribe to auth state changes
    AuthManager.onAuthStateChange((event, session, user) => {
      if (event === 'SIGNED_IN' && user) {
        console.log("[GamepadManager] User signed in, loading control preferences...")
        this.loadMappingFromSupabase().then(() => {
          console.log("[GamepadManager] Control preferences loaded for user:", user.email)
        }).catch(e => {
          console.warn("[GamepadManager] Failed to load control preferences on login:", e)
        })
      } else if (event === 'SIGNED_OUT') {
        // Optionally reset to defaults when user signs out
        // Or just keep localStorage settings
        console.log("[GamepadManager] User signed out, keeping local control settings")
      }
    })
  }

  /**
   * Scan for already-connected gamepads
   */
  scanForGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
    for (const gamepad of gamepads) {
      if (gamepad) {
        this.registerGamepad(gamepad)
      }
    }
  }

  /**
   * Handle gamepad connection event
   */
  onGamepadConnected(event) {
    console.log("[GamepadManager] Gamepad connected:", event.gamepad.id)
    this.registerGamepad(event.gamepad)
    this.notifyListeners("connected", event.gamepad)
  }

  /**
   * Handle gamepad disconnection event
   */
  onGamepadDisconnected(event) {
    console.log("[GamepadManager] Gamepad disconnected:", event.gamepad.id)
    this.connectedControllers = this.connectedControllers.filter(
      c => c.index !== event.gamepad.index
    )
    
    // If the active gamepad was disconnected, clear it
    if (this.activeGamepad && this.activeGamepad.index === event.gamepad.index) {
      this.activeGamepad = null
      // Try to select another connected gamepad
      if (this.connectedControllers.length > 0) {
        this.activeGamepad = this.connectedControllers[0]
      }
    }
    
    this.notifyListeners("disconnected", event.gamepad)
  }

  /**
   * Register a gamepad
   */
  registerGamepad(gamepad) {
    // Check if already registered
    const existing = this.connectedControllers.find(c => c.index === gamepad.index)
    if (!existing) {
      this.connectedControllers.push({
        index: gamepad.index,
        id: gamepad.id,
        buttons: gamepad.buttons.length,
        axes: gamepad.axes.length
      })
    }
    
    // Set as active if we don't have one
    if (!this.activeGamepad) {
      this.activeGamepad = this.connectedControllers[0]
    }
  }

  /**
   * Start the polling loop
   */
  startPolling() {
    if (this.animationFrameId) return
    
    const poll = () => {
      this.poll()
      this.animationFrameId = requestAnimationFrame(poll)
    }
    this.animationFrameId = requestAnimationFrame(poll)
  }

  /**
   * Stop the polling loop
   */
  stopPolling() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Main polling function - called every frame
   */
  poll() {
    if (!this.isEnabled) return
    
    // Get fresh gamepad state
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
    if (!gamepads || gamepads.length === 0) return
    
    // Find our active gamepad
    let gamepad = null
    if (this.activeGamepad) {
      gamepad = gamepads[this.activeGamepad.index]
    }
    
    // Fallback to first available
    if (!gamepad) {
      for (const gp of gamepads) {
        if (gp) {
          gamepad = gp
          break
        }
      }
    }
    
    if (!gamepad) return
    
    // Process buttons
    this.processButtons(gamepad)
    
    // Process axes (analog sticks as D-pad)
    this.processAxes(gamepad)
    
    // Update debug overlay
    if (this.showDebug) {
      this.updateDebugOverlay(gamepad)
    }
  }

  /**
   * Process button inputs
   */
  processButtons(gamepad) {
    for (const [action, buttonIndex] of Object.entries(this.buttonMapping)) {
      if (buttonIndex === null || buttonIndex >= gamepad.buttons.length) continue
      
      const button = gamepad.buttons[buttonIndex]
      const isPressed = button.pressed || button.value > 0.5
      const wasPressed = this.buttonStates[action] || false
      
      // State changed
      if (isPressed !== wasPressed) {
        this.buttonStates[action] = isPressed
        
        // Get the key action for this button
        const keyCode = this.keyActions[action]
        if (keyCode) {
          this.simulateKeyEvent(keyCode, isPressed)
        }
        
        // Notify listeners
        this.notifyListeners(isPressed ? "buttondown" : "buttonup", {
          action,
          buttonIndex,
          value: button.value
        })
      }
    }
  }

  /**
   * Process axis inputs (analog sticks as D-pad)
   */
  processAxes(gamepad) {
    // Left stick X axis -> left/right
    if (gamepad.axes.length > AXES.leftStickX) {
      const xValue = gamepad.axes[AXES.leftStickX]
      
      // Left
      const isLeft = xValue < -DEADZONE
      if (isLeft !== this.axisStates.left) {
        this.axisStates.left = isLeft
        this.simulateKeyEvent("ArrowLeft", isLeft)
      }
      
      // Right
      const isRight = xValue > DEADZONE
      if (isRight !== this.axisStates.right) {
        this.axisStates.right = isRight
        this.simulateKeyEvent("ArrowRight", isRight)
      }
    }
    
    // Left stick Y axis -> up/down
    if (gamepad.axes.length > AXES.leftStickY) {
      const yValue = gamepad.axes[AXES.leftStickY]
      
      // Up (negative Y is up)
      const isUp = yValue < -DEADZONE
      if (isUp !== this.axisStates.up) {
        this.axisStates.up = isUp
        this.simulateKeyEvent("ArrowUp", isUp)
      }
      
      // Down
      const isDown = yValue > DEADZONE
      if (isDown !== this.axisStates.down) {
        this.axisStates.down = isDown
        this.simulateKeyEvent("ArrowDown", isDown)
      }
    }
  }

  /**
   * Simulate a keyboard event
   */
  simulateKeyEvent(keyCode, isDown) {
    // Map our key codes to proper key values
    const keyMap = {
      "ArrowUp": { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
      "ArrowDown": { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
      "ArrowLeft": { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
      "ArrowRight": { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
      "Space": { key: " ", code: "Space", keyCode: 32 },
      "Enter": { key: "Enter", code: "Enter", keyCode: 13 },
      "Semicolon": { key: ";", code: "Semicolon", keyCode: 186 },
      "Slash": { key: "/", code: "Slash", keyCode: 191 },
      "KeyQ": { key: "q", code: "KeyQ", keyCode: 81 },
      "KeyR": { key: "r", code: "KeyR", keyCode: 82 },
      "Escape": { key: "Escape", code: "Escape", keyCode: 27 }
    }
    
    const keyInfo = keyMap[keyCode]
    if (!keyInfo) return
    
    const eventType = isDown ? "keydown" : "keyup"
    const event = new KeyboardEvent(eventType, {
      key: keyInfo.key,
      code: keyInfo.code,
      keyCode: keyInfo.keyCode,
      which: keyInfo.keyCode,
      bubbles: true,
      cancelable: true
    })
    
    // Dispatch to window (Phaser listens here)
    window.dispatchEvent(event)
  }

  /**
   * Enable/disable gamepad input
   */
  setEnabled(enabled) {
    this.isEnabled = enabled
    
    // Clear all button states when disabling
    if (!enabled) {
      for (const action of Object.keys(this.buttonStates)) {
        if (this.buttonStates[action]) {
          const keyCode = this.keyActions[action]
          if (keyCode) {
            this.simulateKeyEvent(keyCode, false)
          }
          this.buttonStates[action] = false
        }
      }
      
      for (const dir of ["up", "down", "left", "right"]) {
        if (this.axisStates[dir]) {
          this.simulateKeyEvent(`Arrow${dir.charAt(0).toUpperCase() + dir.slice(1)}`, false)
          this.axisStates[dir] = false
        }
      }
    }
  }

  /**
   * Get the current button mapping
   */
  getMapping() {
    return {
      buttons: { ...this.buttonMapping },
      actions: { ...this.keyActions }
    }
  }

  /**
   * Update button mapping
   */
  setMapping(buttonName, buttonIndex) {
    if (this.buttonMapping.hasOwnProperty(buttonName)) {
      this.buttonMapping[buttonName] = buttonIndex
      this.saveMapping()
    }
  }

  /**
   * Update key action for a button
   */
  setKeyAction(buttonName, keyCode) {
    if (this.keyActions.hasOwnProperty(buttonName)) {
      this.keyActions[buttonName] = keyCode
      this.saveMapping()
    }
  }

  /**
   * Reset to default mapping
   */
  resetToDefaults() {
    this.buttonMapping = { ...DEFAULT_MAPPING }
    this.keyActions = { ...DEFAULT_KEY_ACTIONS }
    this.saveMapping()
  }

  /**
   * Save mapping to localStorage
   */
  saveMapping() {
    const data = {
      buttons: this.buttonMapping,
      actions: this.keyActions
    }
    localStorage.setItem("gamepadMapping", JSON.stringify(data))
  }

  /**
   * Load mapping from localStorage
   */
  loadMapping() {
    try {
      const saved = localStorage.getItem("gamepadMapping")
      if (saved) {
        const data = JSON.parse(saved)
        if (data.buttons) {
          this.buttonMapping = { ...DEFAULT_MAPPING, ...data.buttons }
        }
        if (data.actions) {
          this.keyActions = { ...DEFAULT_KEY_ACTIONS, ...data.actions }
        }
        console.log("[GamepadManager] Loaded saved mapping")
      }
    } catch (e) {
      console.warn("[GamepadManager] Failed to load mapping:", e)
    }
  }

  /**
   * Save mapping to Supabase (for logged-in users)
   */
  async saveMappingToSupabase() {
    const userId = AuthManager.getUserId()
    if (!userId) return { success: false, error: "Not logged in" }
    
    try {
      const controlPreferences = {
        gamepad: {
          buttons: this.buttonMapping,
          actions: this.keyActions
        },
        preferences: {
          deadzone: DEADZONE,
          enabled: this.isEnabled
        }
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({ control_preferences: controlPreferences })
        .eq('id', userId)
      
      if (error) {
        console.error("[GamepadManager] Supabase save error:", error)
        return { success: false, error: error.message }
      }
      
      console.log("[GamepadManager] Mapping saved to Supabase")
      return { success: true }
    } catch (e) {
      console.error("[GamepadManager] Save to Supabase failed:", e)
      return { success: false, error: e.message }
    }
  }

  /**
   * Load mapping from Supabase
   */
  async loadMappingFromSupabase() {
    const userId = AuthManager.getUserId()
    if (!userId) return
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('control_preferences')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.warn("[GamepadManager] Supabase load error:", error.message)
        return
      }
      
      if (data?.control_preferences?.gamepad) {
        const { buttons, actions } = data.control_preferences.gamepad
        if (buttons) {
          this.buttonMapping = { ...DEFAULT_MAPPING, ...buttons }
        }
        if (actions) {
          this.keyActions = { ...DEFAULT_KEY_ACTIONS, ...actions }
        }
        console.log("[GamepadManager] Loaded mapping from Supabase")
        
        // Also update localStorage to keep in sync
        this.saveMapping()
      }
    } catch (e) {
      console.warn("[GamepadManager] Load from Supabase failed:", e)
    }
  }

  /**
   * Get list of connected controllers
   */
  getConnectedControllers() {
    return [...this.connectedControllers]
  }

  /**
   * Set active controller by index
   */
  setActiveController(index) {
    const controller = this.connectedControllers.find(c => c.index === index)
    if (controller) {
      this.activeGamepad = controller
      return true
    }
    return false
  }

  /**
   * Toggle debug overlay
   */
  toggleDebug() {
    this.showDebug = !this.showDebug
    
    if (this.showDebug) {
      this.createDebugOverlay()
    } else {
      this.destroyDebugOverlay()
    }
  }

  /**
   * Create debug overlay
   */
  createDebugOverlay() {
    if (this.debugOverlay) return
    
    this.debugOverlay = document.createElement("div")
    this.debugOverlay.id = "gamepad-debug"
    this.debugOverlay.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 5px;
      z-index: 10000;
      max-width: 300px;
      pointer-events: none;
    `
    document.body.appendChild(this.debugOverlay)
  }

  /**
   * Destroy debug overlay
   */
  destroyDebugOverlay() {
    if (this.debugOverlay) {
      this.debugOverlay.remove()
      this.debugOverlay = null
    }
  }

  /**
   * Update debug overlay content
   */
  updateDebugOverlay(gamepad) {
    if (!this.debugOverlay) return
    
    let html = `<strong>🎮 ${gamepad.id.substring(0, 30)}...</strong><br>`
    html += `Index: ${gamepad.index}<br><br>`
    
    // Show button states
    html += `<strong>Buttons:</strong><br>`
    const pressedButtons = []
    for (let i = 0; i < gamepad.buttons.length; i++) {
      if (gamepad.buttons[i].pressed || gamepad.buttons[i].value > 0.1) {
        pressedButtons.push(`${i}:${gamepad.buttons[i].value.toFixed(2)}`)
      }
    }
    html += pressedButtons.length > 0 ? pressedButtons.join(", ") : "(none)"
    html += "<br><br>"
    
    // Show axis states
    html += `<strong>Axes:</strong><br>`
    const axes = []
    for (let i = 0; i < gamepad.axes.length; i++) {
      const val = gamepad.axes[i]
      if (Math.abs(val) > 0.1) {
        axes.push(`${i}:${val.toFixed(2)}`)
      }
    }
    html += axes.length > 0 ? axes.join(", ") : "(centered)"
    
    this.debugOverlay.innerHTML = html
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    this.listeners.add({ event, callback })
    return () => this.off(event, callback)
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    this.listeners.forEach(listener => {
      if (listener.event === event && listener.callback === callback) {
        this.listeners.delete(listener)
      }
    })
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      if (listener.event === event) {
        try {
          listener.callback(data)
        } catch (e) {
          console.error("[GamepadManager] Listener error:", e)
        }
      }
    })
  }

  /**
   * Start remapping mode - waits for next button press
   * Returns a promise that resolves with the button index
   */
  waitForButtonPress(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const checkButton = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error("Timeout waiting for button press"))
          return
        }
        
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
        for (const gamepad of gamepads) {
          if (!gamepad) continue
          
          for (let i = 0; i < gamepad.buttons.length; i++) {
            if (gamepad.buttons[i].pressed) {
              resolve({ gamepadIndex: gamepad.index, buttonIndex: i })
              return
            }
          }
        }
        
        requestAnimationFrame(checkButton)
      }
      
      requestAnimationFrame(checkButton)
    })
  }

  /**
   * Clean up
   */
  destroy() {
    this.stopPolling()
    this.destroyDebugOverlay()
    window.removeEventListener("gamepadconnected", this.onGamepadConnected)
    window.removeEventListener("gamepaddisconnected", this.onGamepadDisconnected)
    this.isInitialized = false
  }
}

// Singleton instance
export const GamepadManager = new GamepadManagerClass()

// Auto-initialize when module loads
// We use a check for window to support SSR environments
if (typeof window !== "undefined") {
  // Initialize on first user interaction (required by some browsers)
  const initOnInteraction = () => {
    GamepadManager.initialize()
    window.removeEventListener("click", initOnInteraction)
    window.removeEventListener("keydown", initOnInteraction)
  }
  
  // Also try to init immediately (works in most browsers)
  if (document.readyState === "complete" || document.readyState === "interactive") {
    GamepadManager.initialize()
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      GamepadManager.initialize()
    })
  }
  
  // Backup init on interaction
  window.addEventListener("click", initOnInteraction)
  window.addEventListener("keydown", initOnInteraction)
}

// Export constants for use in settings UI
export { DEFAULT_MAPPING, DEFAULT_KEY_ACTIONS, DEADZONE }
