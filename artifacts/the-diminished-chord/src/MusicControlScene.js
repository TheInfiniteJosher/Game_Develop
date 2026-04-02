import Phaser from "phaser"
import { BGMManager } from "./BGMManager.js"

/**
 * MusicControlScene - Persistent music control overlay
 * Shows a pause/resume button at the bottom right of the screen.
 * Also shows an NFS-style "Now Playing" card whenever a new track starts.
 *
 * This scene runs on top of all other scenes.
 */
export class MusicControlScene extends Phaser.Scene {
  constructor() {
    super({ key: "MusicControlScene" })
    this._nowPlayingTween = null
    this._nowPlayingHideTimer = null
  }

  create() {
    const W = this.cameras.main.width
    const H = this.cameras.main.height
    const padding = 20
    const btnSize = 40

    // ── Pause/resume button (bottom-right) ────────────────────────────────
    const btnX = W - padding - btnSize / 2
    const btnY = H - padding - btnSize / 2

    this.btnBg = this.add.circle(btnX, btnY, btnSize / 2, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0x444488)
      .setInteractive({ useHandCursor: true })
      .setDepth(200)
      .setScrollFactor(0)

    this.btnIcon = this.add.text(btnX, btnY, "♪", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#00ff88"
    }).setOrigin(0.5).setDepth(201).setScrollFactor(0)

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
    this.btnBg.on("pointerdown", () => this.toggleMusic())

    // Poll BGM state every 200 ms to keep icon current
    this.time.addEvent({
      delay: 200,
      callback: this.updateIconState,
      callbackScope: this,
      loop: true
    })
    this.updateIconState()

    // ── Now Playing overlay (bottom-center, NFS-style) ────────────────────
    this._buildNowPlayingPanel(W, H)

    // Listen for the global bgm-now-playing event emitted by BGMManager
    this.game.events.on("bgm-now-playing", this._onNowPlaying, this)

    // Clean up listener when this scene is destroyed
    this.events.once("destroy", () => {
      this.game.events.off("bgm-now-playing", this._onNowPlaying, this)
    })
  }

  // ── Pause / Resume ───────────────────────────────────────────────────────

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
      this.btnIcon.setText("🔇")
      this.btnIcon.setColor("#888888")
    }
  }

  updateIconState() {
    if (!this.btnIcon) return
    if (BGMManager.isPlaying()) {
      this.btnIcon.setText("♪")
      this.btnIcon.setColor("#00ff88")
    } else if (BGMManager.isPaused()) {
      this.btnIcon.setText("⏸")
      this.btnIcon.setColor("#ff6666")
    } else {
      this.btnIcon.setText("🔇")
      this.btnIcon.setColor("#888888")
    }
  }

  // ── Now Playing panel ────────────────────────────────────────────────────

  _buildNowPlayingPanel(W, H) {
    const panelW = 280
    const panelH = 52
    const panelX = W / 2 - panelW / 2
    // Start off-screen below the bottom edge; slides up into view
    const panelYHidden = H + panelH + 10
    const panelYVisible = H - 16 - panelH

    this._npContainer = this.add.container(panelX, panelYHidden)
      .setDepth(210)
      .setScrollFactor(0)
      .setAlpha(0)

    // Background pill
    const bg = this.add.rectangle(panelW / 2, panelH / 2, panelW, panelH, 0x0a0a18, 0.92)
      .setStrokeStyle(1, 0x9944cc)
    this._npContainer.add(bg)

    // Left accent bar
    const accent = this.add.rectangle(3, panelH / 2, 3, panelH - 10, 0x9944cc)
    this._npContainer.add(accent)

    // Music note icon
    const icon = this.add.text(16, panelH / 2, "♪", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#cc77ff"
    }).setOrigin(0.5)
    this._npContainer.add(icon)

    // "NOW PLAYING" label
    const label = this.add.text(30, 10, "NOW PLAYING", {
      fontFamily: "RetroPixel",
      fontSize: "7px",
      color: "#9944cc",
      letterSpacing: 2
    })
    this._npContainer.add(label)

    // Track title
    this._npTitle = this.add.text(30, 20, "", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    })
    this._npContainer.add(this._npTitle)

    // Artist name
    this._npArtist = this.add.text(30, 35, "", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#cc77ff"
    })
    this._npContainer.add(this._npArtist)

    // Store y positions for animation
    this._npYHidden = panelYHidden
    this._npYVisible = panelYVisible
  }

  _onNowPlaying({ title, artist }) {
    if (!this._npContainer) return

    // Update text
    this._npTitle.setText(title || "")
    this._npArtist.setText(artist || "")

    // Cancel any in-progress tween / hide timer
    if (this._nowPlayingTween) {
      this._nowPlayingTween.stop()
      this._nowPlayingTween = null
    }
    if (this._nowPlayingHideTimer) {
      this._nowPlayingHideTimer.remove()
      this._nowPlayingHideTimer = null
    }

    // Slide up + fade in
    this._npContainer.setY(this._npYHidden).setAlpha(0)
    this._nowPlayingTween = this.tweens.add({
      targets: this._npContainer,
      y: this._npYVisible,
      alpha: 1,
      duration: 400,
      ease: "Back.Out",
      onComplete: () => {
        // Hold for 4 seconds then slide back down
        this._nowPlayingHideTimer = this.time.delayedCall(4000, () => {
          this._nowPlayingTween = this.tweens.add({
            targets: this._npContainer,
            y: this._npYHidden,
            alpha: 0,
            duration: 500,
            ease: "Back.In"
          })
        })
      }
    })
  }
}
