import Phaser from "phaser"
import { BGMManager } from "./BGMManager.js"

/**
 * MusicControlScene - Persistent music control overlay
 * Shows a pause/resume button at the bottom right of the screen
 * This scene runs on top of all other scenes
 */
export class MusicControlScene extends Phaser.Scene {
  constructor() {
    super({ key: "MusicControlScene" })
  }

  create() {
    // Position at bottom right
    const padding = 20
    const btnSize = 40
    const x = this.cameras.main.width - padding - btnSize / 2
    const y = this.cameras.main.height - padding - btnSize / 2

    // Create button background
    this.btnBg = this.add.circle(x, y, btnSize / 2, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0x444488)
      .setInteractive({ useHandCursor: true })

    // Create button icon (music note / paused indicator)
    this.btnIcon = this.add.text(x, y, "♪", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#00ff88"
    }).setOrigin(0.5)

    // Hover effects
    this.btnBg.on("pointerover", () => {
      this.btnBg.setStrokeStyle(2, 0x00ffff)
      this.btnBg.setScale(1.1)
      this.btnIcon.setScale(1.1)
    })

    this.btnBg.on("pointerout", () => {
      this.btnBg.setStrokeStyle(2, 0x444488)
      this.btnBg.setScale(1)
      this.btnIcon.setScale(1)
    })

    // Click to toggle music
    this.btnBg.on("pointerdown", () => {
      this.toggleMusic()
    })

    // Update icon state periodically to reflect actual music state
    this.time.addEvent({
      delay: 200,
      callback: this.updateIconState,
      callbackScope: this,
      loop: true
    })

    // Initial state
    this.updateIconState()
  }

  /**
   * Toggle background music pause/resume
   */
  toggleMusic() {
    if (BGMManager.isPlaying()) {
      BGMManager.pause()
      this.btnIcon.setText("⏸")
      this.btnIcon.setColor("#ff6666")
    } else if (BGMManager.isPaused()) {
      BGMManager.resume()
      this.btnIcon.setText("♪")
      this.btnIcon.setColor("#00ff88")
    } else {
      // No music currently - just show muted state
      this.btnIcon.setText("🔇")
      this.btnIcon.setColor("#888888")
    }
  }

  /**
   * Update icon to reflect current music state
   */
  updateIconState() {
    if (!this.btnIcon) return

    if (BGMManager.isPlaying()) {
      this.btnIcon.setText("♪")
      this.btnIcon.setColor("#00ff88")
    } else if (BGMManager.isPaused()) {
      this.btnIcon.setText("⏸")
      this.btnIcon.setColor("#ff6666")
    } else {
      // No music
      this.btnIcon.setText("🔇")
      this.btnIcon.setColor("#888888")
    }
  }
}
