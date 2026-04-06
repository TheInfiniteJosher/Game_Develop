import Phaser from "phaser"
import { AudioManager } from "./AudioManager.js"
import { TouchButtonMapper, TOUCH_ACTIONS, DEFAULT_TOUCH_MAPPING } from "./TouchButtonMapper.js"

const BUTTON_DEFS = [
  { key: "a",      label: "A  BUTTON",  color: "#00cc77" },
  { key: "b",      label: "B  BUTTON",  color: "#9933cc" },
  { key: "x",      label: "X  BUTTON",  color: "#4488dd" },
  { key: "y",      label: "Y  BUTTON",  color: "#cc8800" },
  { key: "l",      label: "L  TRIGGER", color: "#2266aa" },
  { key: "r",      label: "R  TRIGGER", color: "#aa3322" },
  { key: "start",  label: "START",      color: "#888888" },
  { key: "select", label: "SELECT",     color: "#666688" },
]

export class TouchMappingScene extends Phaser.Scene {
  constructor() {
    super({ key: "TouchMappingScene" })
  }

  init(data) {
    this.returnScene = data?.returnScene || "SettingsScene"
    this.returnData  = data?.returnData  || {}
  }

  create() {
    const W = this.cameras.main.width
    const H = this.cameras.main.height

    this._mapping = TouchButtonMapper.getMapping()
    this._pillRefs = {}

    // Full-screen dim
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82)

    // Panel
    const PW = Math.min(560, W - 32)
    const PH = Math.min(520, H - 60)
    const PX = W / 2
    const PY = H / 2

    this.add.rectangle(PX, PY, PW, PH, 0x1a1a2e, 0.97)
      .setStrokeStyle(2, 0x333366)

    // Title
    this.add.text(PX, PY - PH / 2 + 24, "📱 TOUCH CONTROLS MAPPING", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4",
    }).setOrigin(0.5)

    // Subtitle
    this.add.text(
      PX, PY - PH / 2 + 45,
      "Tap an action to cycle. Saved separately from gamepad settings.",
      { fontFamily: "RetroPixel", fontSize: "8px", color: "#555577" }
    ).setOrigin(0.5)

    // Separator
    const gs = this.add.graphics()
    gs.lineStyle(1, 0x333366)
    gs.moveTo(PX - PW / 2 + 16, PY - PH / 2 + 58)
    gs.lineTo(PX + PW / 2 - 16, PY - PH / 2 + 58)
    gs.strokePath()

    // Column headers
    this.add.text(PX - PW / 2 + 28, PY - PH / 2 + 72, "BUTTON", {
      fontFamily: "RetroPixel", fontSize: "9px", color: "#444466",
    }).setOrigin(0, 0.5)
    this.add.text(PX + 34, PY - PH / 2 + 72, "ASSIGNED ACTION  (tap to change)", {
      fontFamily: "RetroPixel", fontSize: "9px", color: "#444466",
    }).setOrigin(0, 0.5)

    // Rows
    const ROW_Y0   = PY - PH / 2 + 86
    const ROW_H    = Math.max(36, (PH - 170) / BUTTON_DEFS.length)
    const PILL_W   = Math.min(190, PW * 0.38)

    BUTTON_DEFS.forEach(({ key, label, color }, i) => {
      const ry = ROW_Y0 + i * ROW_H + ROW_H / 2

      // Alternating row bg
      if (i % 2 === 0) {
        this.add.rectangle(PX, ry, PW - 16, ROW_H, 0x111128, 0.55)
      }

      // Button name
      this.add.text(PX - PW / 2 + 28, ry, label, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color,
      }).setOrigin(0, 0.5)

      // Current action
      const action = this._getActionMeta(key)

      const pillBg = this.add.rectangle(PX + PW * 0.18, ry, PILL_W, ROW_H - 10, 0x222244, 0.95)
        .setStrokeStyle(2, this._hexColor(action.color))
        .setInteractive({ useHandCursor: true })

      const pillText = this.add.text(PX + PW * 0.18, ry, `${action.label}  ↻`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: action.color,
      }).setOrigin(0.5)

      pillBg.on("pointerdown", () => this._cycleAction(key, pillBg, pillText))
      pillBg.on("pointerover", () => pillBg.setFillStyle(0x2a2a55))
      pillBg.on("pointerout",  () => pillBg.setFillStyle(0x222244))

      this._pillRefs[key] = { pillBg, pillText }
    })

    // Bottom bar
    const barY = ROW_Y0 + BUTTON_DEFS.length * ROW_H + 10

    const gs2 = this.add.graphics()
    gs2.lineStyle(1, 0x333366)
    gs2.moveTo(PX - PW / 2 + 16, barY)
    gs2.lineTo(PX + PW / 2 - 16, barY)
    gs2.strokePath()

    // Reset defaults
    const resetBg = this.add.rectangle(PX - PW * 0.25, barY + 22, 160, 32, 0x1a1010, 0.9)
      .setStrokeStyle(2, 0x663333)
      .setInteractive({ useHandCursor: true })
    this.add.text(PX - PW * 0.25, barY + 22, "↺  RESET DEFAULTS", {
      fontFamily: "RetroPixel", fontSize: "11px", color: "#ff6666",
    }).setOrigin(0.5)
    resetBg.on("pointerdown", () => this._resetDefaults())
    resetBg.on("pointerover", () => resetBg.setStrokeStyle(2, 0xff6666))
    resetBg.on("pointerout",  () => resetBg.setStrokeStyle(2, 0x663333))

    // Save & Close
    this._saveBg = this.add.rectangle(PX + PW * 0.22, barY + 22, 168, 32, 0x112233, 0.9)
      .setStrokeStyle(2, 0x00ff88)
      .setInteractive({ useHandCursor: true })
    this._saveText = this.add.text(PX + PW * 0.22, barY + 22, "✓  SAVE & CLOSE", {
      fontFamily: "RetroPixel", fontSize: "11px", color: "#00ff88",
    }).setOrigin(0.5)
    this._saveBg.on("pointerdown", () => this._saveAndClose())
    this._saveBg.on("pointerover", () => this._saveBg.setStrokeStyle(2, 0x00ffaa))
    this._saveBg.on("pointerout",  () => this._saveBg.setStrokeStyle(2, 0x00ff88))

    // Status text
    this._statusText = this.add.text(PX, barY + 50, "", {
      fontFamily: "RetroPixel", fontSize: "9px", color: "#666688",
    }).setOrigin(0.5)
  }

  _getActionMeta(btn) {
    const code = this._mapping[btn]
    return TOUCH_ACTIONS.find(a => a.code === code) ?? TOUCH_ACTIONS[TOUCH_ACTIONS.length - 1]
  }

  _hexColor(cssHex) {
    return Phaser.Display.Color.HexStringToColor(cssHex).color
  }

  _cycleAction(key, pillBg, pillText) {
    const currentCode = this._mapping[key]
    const idx  = TOUCH_ACTIONS.findIndex(a => a.code === currentCode)
    const next = TOUCH_ACTIONS[(idx + 1) % TOUCH_ACTIONS.length]
    this._mapping[key] = next.code

    pillBg.setStrokeStyle(2, this._hexColor(next.color))
    pillText.setText(`${next.label}  ↻`)
    pillText.setColor(next.color)

    // Live-update window.TOUCH_MAPPING so the overlay picks it up immediately
    window.TOUCH_MAPPING = { ...this._mapping }
    window.dispatchEvent(new CustomEvent("touchmappingchanged", { detail: window.TOUCH_MAPPING }))

    try {
      this.sound.play("ui_select_sound", {
        volume: AudioManager.getScaledSfxVolume(0.25),
      })
    } catch (_) {}
  }

  _resetDefaults() {
    this._mapping = { ...DEFAULT_TOUCH_MAPPING }
    BUTTON_DEFS.forEach(({ key }) => {
      const action = this._getActionMeta(key)
      const { pillBg, pillText } = this._pillRefs[key]
      pillBg.setStrokeStyle(2, this._hexColor(action.color))
      pillText.setText(`${action.label}  ↻`)
      pillText.setColor(action.color)
    })
    window.TOUCH_MAPPING = { ...this._mapping }
    window.dispatchEvent(new CustomEvent("touchmappingchanged", { detail: window.TOUCH_MAPPING }))
    this._statusText.setText("Reset to defaults — press Save to keep")
    this._statusText.setColor("#ffaa44")
    try {
      this.sound.play("ui_select_sound", { volume: AudioManager.getScaledSfxVolume(0.25) })
    } catch (_) {}
  }

  async _saveAndClose() {
    this._saveText.setText("Saving...")
    this._saveBg.setFillStyle(0x113322)

    TouchButtonMapper.updateMapping(this._mapping)

    const result = await TouchButtonMapper.saveToSupabase()

    if (result.success) {
      this._statusText.setText("✓ Saved to your profile")
      this._statusText.setColor("#00ff88")
    } else {
      this._statusText.setText("✓ Saved locally  (sign in to sync to profile)")
      this._statusText.setColor("#ffaa00")
    }

    this.time.delayedCall(900, () => {
      this.scene.start(this.returnScene, this.returnData)
    })
  }
}
