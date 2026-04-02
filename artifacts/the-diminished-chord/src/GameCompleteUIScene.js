import Phaser from "phaser"
import { BGMManager } from "./BGMManager.js"

/**
 * GameCompleteUIScene - Full game completion screen
 * Shows when all levels are completed
 * Includes audio player for level music (continues from level)
 */
export class GameCompleteUIScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameCompleteUIScene" })
  }

  init(data) {
    this.currentLevelKey = data.currentLevelKey
    this.completionTime = data.completionTime || 0
    this.deathCount = data.deathCount || 0
    this.allFragments = data.allFragments || false
    this.unlockedTrack = data.unlockedTrack || null
    this.levelTrack = data.levelTrack || null
    
    // Receive BGM reference from level scene (continues playing)
    this.levelBgm = data.levelBgm || null
    this.isPlaying = this.levelBgm && this.levelBgm.isPlaying
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Duck the background music volume by 20% for the completion screen
    BGMManager.duckVolume()

    // Full dark overlay
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.9
    )
    overlay.setOrigin(0, 0)

    // Congratulations text
    const congratsText = this.add.text(centerX, 60, "CONGRATULATIONS!", {
      fontFamily: "RetroPixel",
      fontSize: "42px",
      color: "#ffaa00"
    }).setOrigin(0.5)

    // Pulsing animation
    this.tweens.add({
      targets: congratsText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1
    })

    // Main message
    this.add.text(centerX, 120, "You've completed The Diminished Chord!", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffffff"
    }).setOrigin(0.5)

    // Stats
    this.createStatsPanel(centerX, centerY - 80)

    // Track status and audio player
    const hasAudio = this.levelTrack && this.levelTrack.audioUrl
    if (this.allFragments && this.unlockedTrack) {
      this.createTrackUnlockPanel(centerX, centerY + 40)
    } else if (hasAudio) {
      this.createNowPlayingPanel(centerX, centerY + 40)
    }

    // Music Library CTA
    const ctaY = hasAudio ? centerY + 170 : centerY + 100
    this.add.text(centerX, ctaY, "Check out your unlocked tracks in the Music Library!", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ff88"
    }).setOrigin(0.5)

    // Buttons
    const buttonsY = hasAudio ? centerY + 230 : centerY + 180
    this.createButtons(centerX, buttonsY)

    // Play level complete sound
    this.sound.play("level_complete_sound", { volume: 0.5 })

    // Setup input
    this.setupInput()
  }

  createStatsPanel(x, y) {
    const panel = this.add.rectangle(x, y, 400, 100, 0x1a1a2e, 0.9)
    panel.setStrokeStyle(2, 0xffaa00)

    const minutes = Math.floor(this.completionTime / 60).toString().padStart(2, "0")
    const seconds = (this.completionTime % 60).toString().padStart(2, "0")
    this.add.text(x, y - 25, `Final Time: ${minutes}:${seconds}`, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5)

    this.add.text(x, y + 15, `Total Deaths: ${this.deathCount}`, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: this.deathCount === 0 ? "#00ff88" : "#ff6666"
    }).setOrigin(0.5)
  }

  createTrackUnlockPanel(x, y) {
    const hasAudio = this.levelTrack && this.levelTrack.audioUrl
    const panelHeight = hasAudio ? 140 : 60
    
    const panel = this.add.rectangle(x, y, 500, panelHeight, 0x2d1b4e, 0.9)
    panel.setStrokeStyle(3, 0xff69b4)

    this.add.text(x, y - panelHeight/2 + 25, "🎵 FINAL TRACK UNLOCKED! 🎵", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    this.add.text(x, y - panelHeight/2 + 50, `"${this.unlockedTrack.title}"`, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffffff"
    }).setOrigin(0.5)

    if (hasAudio) {
      this.add.text(x, y - panelHeight/2 + 72, `${this.levelTrack.artist} • ${this.levelTrack.genre}`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#aaaaaa"
      }).setOrigin(0.5)

      // Create audio player controls
      this.createAudioPlayer(x, y + 25)
    }

    // Play unlock sound
    this.sound.play("track_unlock_sound", { volume: 0.5 })
  }

  createNowPlayingPanel(x, y) {
    const panelHeight = 130
    
    const panel = this.add.rectangle(x, y, 500, panelHeight, 0x1a2a3e, 0.9)
    panel.setStrokeStyle(2, 0x00ffff)

    this.add.text(x, y - panelHeight/2 + 25, "🎵 NOW PLAYING", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#00ffff"
    }).setOrigin(0.5)

    this.add.text(x, y - panelHeight/2 + 48, `"${this.levelTrack.title}"`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)

    this.add.text(x, y - panelHeight/2 + 68, `${this.levelTrack.artist} • ${this.levelTrack.genre}`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)

    // Create audio player controls
    this.createAudioPlayer(x, y + 20)
  }

  createAudioPlayer(x, y) {
    // Player container
    this.playerContainer = this.add.container(x, y)

    // Player background
    const playerBg = this.add.rectangle(0, 0, 400, 45, 0x1a1a2e, 0.95)
    playerBg.setStrokeStyle(2, 0x00ffff)

    // Play button
    this.playBtn = this.add.text(-140, 0, "▶", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#00ff88"
    }).setOrigin(0.5)
    this.playBtn.setInteractive({ useHandCursor: true })
    this.playBtn.on("pointerover", () => this.playBtn.setColor("#ffffff"))
    this.playBtn.on("pointerout", () => this.playBtn.setColor("#00ff88"))
    this.playBtn.on("pointerdown", () => this.togglePlayPause())

    // Pause button
    this.pauseBtn = this.add.text(-90, 0, "⏸", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#ffaa00"
    }).setOrigin(0.5)
    this.pauseBtn.setInteractive({ useHandCursor: true })
    this.pauseBtn.on("pointerover", () => this.pauseBtn.setColor("#ffffff"))
    this.pauseBtn.on("pointerout", () => this.pauseBtn.setColor("#ffaa00"))
    this.pauseBtn.on("pointerdown", () => this.pauseTrack())

    // Stop button
    this.stopBtn = this.add.text(-40, 0, "◼", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#ff4444"
    }).setOrigin(0.5)
    this.stopBtn.setInteractive({ useHandCursor: true })
    this.stopBtn.on("pointerover", () => this.stopBtn.setColor("#ffffff"))
    this.stopBtn.on("pointerout", () => this.stopBtn.setColor("#ff4444"))
    this.stopBtn.on("pointerdown", () => this.stopTrack())

    // Restart button
    this.restartBtn = this.add.text(10, 0, "⟲", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#00ffff"
    }).setOrigin(0.5)
    this.restartBtn.setInteractive({ useHandCursor: true })
    this.restartBtn.on("pointerover", () => this.restartBtn.setColor("#ffffff"))
    this.restartBtn.on("pointerout", () => this.restartBtn.setColor("#00ffff"))
    this.restartBtn.on("pointerdown", () => this.restartTrack())

    // Now playing status
    const statusText = this.isPlaying ? "♪ Playing..." : "Stopped"
    const statusColor = this.isPlaying ? "#00ff88" : "#888888"
    this.nowPlayingText = this.add.text(120, 0, statusText, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: statusColor
    }).setOrigin(0.5)

    this.playerContainer.add([playerBg, this.playBtn, this.pauseBtn, this.stopBtn, this.restartBtn, this.nowPlayingText])

    if (this.isPlaying) {
      this.startPlayingAnimation()
    }
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pauseTrack()
    } else {
      this.playTrack()
    }
  }

  playTrack() {
    if (!this.levelTrack || !this.levelTrack.audioUrl) {
      this.nowPlayingText.setText("No audio available")
      this.nowPlayingText.setColor("#ff6666")
      return
    }

    // If we have a paused BGM reference, resume it
    if (this.levelBgm && this.levelBgm.isPaused) {
      this.levelBgm.resume()
      this.isPlaying = true
      this.nowPlayingText.setText("♪ Playing...")
      this.nowPlayingText.setColor("#00ff88")
      this.startPlayingAnimation()
      return
    }

    // If BGM was stopped, need to restart it
    if (!this.levelBgm || !this.levelBgm.isPlaying) {
      const audioKey = `bgm_${this.levelTrack.id}`
      
      if (this.cache.audio.exists(audioKey)) {
        this.levelBgm = this.sound.add(audioKey, { volume: 0.6, loop: true })
        this.levelBgm.play()
        this.isPlaying = true
        this.nowPlayingText.setText("♪ Playing...")
        this.nowPlayingText.setColor("#00ff88")
        this.startPlayingAnimation()
      } else {
        this.nowPlayingText.setText("Loading...")
        this.nowPlayingText.setColor("#ffaa00")
        
        this.load.audio(audioKey, this.levelTrack.audioUrl)
        this.load.once("complete", () => {
          this.levelBgm = this.sound.add(audioKey, { volume: 0.6, loop: true })
          this.levelBgm.play()
          this.isPlaying = true
          this.nowPlayingText.setText("♪ Playing...")
          this.nowPlayingText.setColor("#00ff88")
          this.startPlayingAnimation()
        })
        this.load.once("loaderror", () => {
          this.nowPlayingText.setText("Failed to load")
          this.nowPlayingText.setColor("#ff4444")
        })
        this.load.start()
      }
    }
  }

  pauseTrack() {
    if (this.levelBgm && this.levelBgm.isPlaying) {
      this.levelBgm.pause()
      this.isPlaying = false
      this.nowPlayingText.setText("Paused")
      this.nowPlayingText.setColor("#ffaa00")
      this.stopPlayingAnimation()
    }
  }

  stopTrack() {
    if (this.levelBgm) {
      this.levelBgm.stop()
      this.levelBgm.destroy()
      this.levelBgm = null
    }
    this.isPlaying = false
    if (this.nowPlayingText) {
      this.nowPlayingText.setText("Stopped")
      this.nowPlayingText.setColor("#888888")
    }
    this.stopPlayingAnimation()
  }

  restartTrack() {
    this.stopTrack()
    this.playTrack()
  }

  startPlayingAnimation() {
    if (this.playingTween) {
      this.playingTween.stop()
    }
    this.playingTween = this.tweens.add({
      targets: this.nowPlayingText,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1
    })
  }

  stopPlayingAnimation() {
    if (this.playingTween) {
      this.playingTween.stop()
      this.playingTween = null
    }
    if (this.nowPlayingText) {
      this.nowPlayingText.setAlpha(1)
    }
  }

  createButtons(x, y) {
    const buttonSpacing = 50

    // Music Library button
    this.libraryButton = this.createButton(x, y, "MUSIC LIBRARY", () => this.openLibrary())

    // Menu button
    this.menuButton = this.createButton(x, y + buttonSpacing, "MAIN MENU", () => this.goToMenu())

    this.buttons = [this.libraryButton, this.menuButton]
    this.selectedButtonIndex = 0
    this.updateButtonSelection()
  }

  createButton(x, y, text, callback) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 280, 45, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(2, 0x00ff88)

    const label = this.add.text(0, 0, text, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ff88"
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
        button.bg.setStrokeStyle(3, 0x00ffff)
        button.label.setColor("#00ffff")
        button.setScale(1.05)
      } else {
        button.bg.setStrokeStyle(2, 0x00ff88)
        button.label.setColor("#00ff88")
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

    // Space to toggle play/pause on the audio player
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.levelTrack && this.levelTrack.audioUrl) {
        this.togglePlayPause()
      }
    })
  }

  cleanupMusic() {
    if (this.levelBgm) {
      this.levelBgm.stop()
      this.levelBgm.destroy()
      this.levelBgm = null
    }
  }

  openLibrary() {
    BGMManager.stop()
    this.cleanupMusic()
    this.scene.stop("UIScene")
    this.scene.stop(this.currentLevelKey)
    this.scene.stop()
    this.scene.start("MusicLibraryScene")
  }

  goToMenu() {
    BGMManager.stop()
    this.cleanupMusic()
    this.scene.stop("UIScene")
    this.scene.stop(this.currentLevelKey)
    this.scene.stop()
    this.scene.start("TitleScreen")
  }

  shutdown() {
    this.cleanupMusic()
  }
}
