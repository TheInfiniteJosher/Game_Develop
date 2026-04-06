import { supabase } from "./integrations/supabase/client.js"
import { AuthManager } from "./AuthManager.js"

export const TOUCH_ACTIONS = [
  { code: "ArrowUp",    label: "JUMP",    color: "#00ff88" },
  { code: "Space",      label: "RUN",     color: "#ff9900" },
  { code: "Semicolon",  label: "PAUSE",   color: "#ff69b4" },
  { code: "Enter",      label: "CONFIRM", color: "#00aaff" },
  { code: "KeyR",       label: "REWIND",  color: "#ff4444" },
  { code: "KeyQ",       label: "WARP",    color: "#cc66ff" },
  { code: "Slash",      label: "ITEM",    color: "#ffdd00" },
  { code: "ArrowLeft",  label: "LEFT",    color: "#aaaaaa" },
  { code: "ArrowRight", label: "RIGHT",   color: "#cccccc" },
  { code: "ArrowDown",  label: "CROUCH",  color: "#888888" },
  { code: null,         label: "NONE",    color: "#444466" },
]

export const DEFAULT_TOUCH_MAPPING = {
  a:      "ArrowUp",   // Jump
  b:      "Space",     // Run
  x:      "Semicolon", // Pause
  y:      "Space",     // Run (alternate)
  l:      "Slash",     // Item / Use
  r:      "KeyQ",      // Warp / Spawn shift
  start:  "Semicolon", // Pause
  select: "KeyR",      // Rewind
}

const STORAGE_KEY = "tdc_touch_mapping_v1"

class TouchButtonMapperClass {
  constructor() {
    this.mapping = { ...DEFAULT_TOUCH_MAPPING }
    this._listeners = new Set()
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        this.mapping = { ...DEFAULT_TOUCH_MAPPING, ...saved }
      }
    } catch (e) {}
    this._syncToWindow()
    this._setupAuthListener()
  }

  _setupAuthListener() {
    AuthManager.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        this.syncFromSupabase().catch(() => {})
      }
    })
  }

  updateMapping(newMapping) {
    this.mapping = { ...DEFAULT_TOUCH_MAPPING, ...newMapping }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.mapping))
    this._syncToWindow()
    this._notify()
  }

  setAction(btn, code) {
    this.mapping[btn] = code
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.mapping))
    this._syncToWindow()
    this._notify()
  }

  getMapping() {
    return { ...this.mapping }
  }

  getAction(btn) {
    return this.mapping[btn] ?? null
  }

  _syncToWindow() {
    window.TOUCH_MAPPING = { ...this.mapping }
    window.dispatchEvent(
      new CustomEvent("touchmappingchanged", { detail: window.TOUCH_MAPPING })
    )
  }

  onChange(fn) {
    this._listeners.add(fn)
    return () => this._listeners.delete(fn)
  }

  _notify() {
    this._listeners.forEach((fn) => fn(this.mapping))
  }

  async syncFromSupabase() {
    const userId = AuthManager.getUserId()
    if (!userId) return
    try {
      const { data } = await supabase
        .from("profiles")
        .select("control_preferences")
        .eq("id", userId)
        .single()
      const touchPrefs = data?.control_preferences?.touch_controls
      if (touchPrefs) {
        this.mapping = { ...DEFAULT_TOUCH_MAPPING, ...touchPrefs }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.mapping))
        this._syncToWindow()
        console.log("[TouchButtonMapper] Loaded from Supabase")
      }
    } catch (e) {
      console.warn("[TouchButtonMapper] Supabase load failed:", e)
    }
  }

  async saveToSupabase() {
    const userId = AuthManager.getUserId()
    if (!userId) return { success: false, error: "Not logged in" }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("control_preferences")
        .eq("id", userId)
        .single()
      const existing = data?.control_preferences || {}
      const updated = { ...existing, touch_controls: { ...this.mapping } }
      const { error } = await supabase
        .from("profiles")
        .update({ control_preferences: updated })
        .eq("id", userId)
      if (error) return { success: false, error: error.message }
      console.log("[TouchButtonMapper] Saved to Supabase")
      return { success: true }
    } catch (e) {
      console.warn("[TouchButtonMapper] Supabase save failed:", e)
      return { success: false, error: e.message }
    }
  }
}

export const TouchButtonMapper = new TouchButtonMapperClass()

// Auto-load from localStorage on module init; Supabase sync happens after auth
if (typeof window !== "undefined") {
  const doLoad = () => {
    TouchButtonMapper.load()
    TouchButtonMapper.syncFromSupabase().catch(() => {})
  }
  if (document.readyState === "complete" || document.readyState === "interactive") {
    doLoad()
  } else {
    document.addEventListener("DOMContentLoaded", doLoad)
  }
}
