import Phaser from "phaser"
import { musicManager, TRACK_DATABASE } from "./MusicTrackManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * MusicLibraryScene - Browse and play unlocked music tracks
 * Players can listen to tracks they've unlocked by collecting fragments
 * Also provides external links to stream/buy/download tracks
 */
export class MusicLibraryScene extends Phaser.Scene {
  constructor() {
    super({ key: "MusicLibraryScene" })
  }

  create() {
    const centerX = this.cameras.main.width / 2

    // Stop any menu background music when entering library (user will control playback here)
    BGMManager.stop()

    // Track state
    this.currentlyPlaying = null
    this.currentAudio = null
    this.selectedIndex = 0
    this.scrollOffset = 0
    this.maxVisibleTracks = 5

    // Background
    this.createBackground()

    // Title
    this.add.text(centerX, 40, "MUSIC LIBRARY", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    // Stats
    const unlockedCount = musicManager.getUnlockedCount()
    const totalCount = musicManager.getTotalTracks()
    this.add.text(centerX, 80, `${unlockedCount} / ${totalCount} Tracks Unlocked`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5)

    // Create track list with scroll support
    this.createTrackListPanel()
    this.createTrackList()

    // Create track detail panel (for external links)
    this.createTrackDetailPanel()

    // Create player controls
    this.createPlayerControls()

    // Create now playing display
    this.createNowPlayingDisplay()

    // Back button
    this.createBackButton()

    // Setup input
    this.setupInput()

    // Initial selection highlight
    this.updateTrackSelection()
  }

  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)

    // Musical notes pattern
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x1a1a3a, 0.3)
    
    for (let x = 0; x < this.cameras.main.width; x += 60) {
      graphics.beginPath()
      graphics.moveTo(x, 0)
      graphics.lineTo(x, this.cameras.main.height)
      graphics.strokePath()
    }
    for (let y = 0; y < this.cameras.main.height; y += 60) {
      graphics.beginPath()
      graphics.moveTo(0, y)
      graphics.lineTo(this.cameras.main.width, y)
      graphics.strokePath()
    }
  }

  createTrackListPanel() {
    // Track list panel - left side
    const panelX = 220
    const panelY = 340
    const panelWidth = 400
    const panelHeight = 380

    this.trackListPanel = {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight
    }

    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x333366)

    // Scroll hint at bottom
    this.scrollHint = this.add.text(panelX, panelY + panelHeight / 2 - 15, "Scroll to see more", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#555555"
    }).setOrigin(0.5)
  }

  createTrackList() {
    this.trackItems = []
    this.allTracks = musicManager.getAllTracks()
    
    const panel = this.trackListPanel
    const startX = panel.x - panel.width / 2 + 20
    const startY = panel.y - panel.height / 2 + 40
    const itemHeight = 65

    // Create containers for visible tracks
    this.trackListContainer = this.add.container(0, 0)

    this.allTracks.forEach((track, index) => {
      const y = startY + index * itemHeight
      const item = this.createTrackItem(startX, y, track, index)
      this.trackItems.push(item)
      this.trackListContainer.add(item)
    })

    // Create mask for scrolling
    const maskShape = this.make.graphics()
    maskShape.fillRect(
      panel.x - panel.width / 2,
      panel.y - panel.height / 2 + 10,
      panel.width,
      panel.height - 30
    )
    const mask = maskShape.createGeometryMask()
    this.trackListContainer.setMask(mask)

    // Update scroll hint visibility
    this.updateScrollHint()
  }

  createTrackItem(x, y, track, index) {
    const container = this.add.container(x, y)
    const isUnlocked = track.isUnlocked

    // Background
    const bg = this.add.rectangle(180, 0, 360, 58, isUnlocked ? 0x222244 : 0x1a1a1a, 0.9)
      .setStrokeStyle(2, isUnlocked ? 0x444488 : 0x333333)

    // Track number
    const numText = this.add.text(15, 0, `${index + 1}.`, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: isUnlocked ? "#00ff88" : "#444444"
    }).setOrigin(0, 0.5)

    // Track title
    const titleText = this.add.text(50, -10, isUnlocked ? track.title : "???", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: isUnlocked ? "#ffffff" : "#666666"
    })

    // Artist and genre
    const infoText = this.add.text(50, 10, isUnlocked ? `${track.artist} • ${track.genre}` : "Locked", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: isUnlocked ? "#888888" : "#555555"
    })

    // Duration
    const durationText = this.add.text(290, 0, isUnlocked ? track.duration : "--:--", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: isUnlocked ? "#aaaaaa" : "#444444"
    }).setOrigin(0.5)

    // Lock/play icon
    const icon = this.add.text(340, 0, isUnlocked ? "▶" : "🔒", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: isUnlocked ? "#00ff88" : "#ff4444"
    }).setOrigin(0.5)

    container.add([bg, numText, titleText, infoText, durationText, icon])

    // Make interactive only if unlocked
    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true })
      
      bg.on("pointerover", () => {
        this.selectedIndex = index
        this.updateTrackSelection()
        this.updateTrackDetail(track)
        this.sound.play("ui_select_sound", { volume: 0.1 })
      })

      bg.on("pointerdown", () => {
        this.playTrack(track)
      })
    }

    container.bg = bg
    container.track = track
    container.index = index
    container.isUnlocked = isUnlocked
    container.icon = icon

    return container
  }

  updateTrackSelection() {
    this.trackItems.forEach((item, index) => {
      if (!item.isUnlocked) return

      if (index === this.selectedIndex) {
        item.bg.setStrokeStyle(3, 0x00ffff)
        item.setScale(1.02)
        // Update detail panel when selected
        this.updateTrackDetail(item.track)
      } else {
        item.bg.setStrokeStyle(2, 0x444488)
        item.setScale(1)
      }
    })
  }

  updateScrollHint() {
    if (this.allTracks.length > this.maxVisibleTracks) {
      this.scrollHint.setVisible(true)
    } else {
      this.scrollHint.setVisible(false)
    }
  }

  scrollTrackList(delta) {
    const itemHeight = 65
    const maxScroll = Math.max(0, (this.allTracks.length - this.maxVisibleTracks) * itemHeight)
    
    // Inverted scroll direction (natural scrolling)
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + delta, 0, maxScroll)
    
    // Apply scroll to container
    this.trackListContainer.y = this.scrollOffset
  }

  createTrackDetailPanel() {
    // Detail panel - right side
    const panelX = 620
    const panelY = 280
    const panelWidth = 300
    const panelHeight = 260

    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x333366)

    // Title
    this.add.text(panelX, panelY - panelHeight / 2 + 25, "TRACK DETAILS", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    // Detail text placeholders
    this.detailTitle = this.add.text(panelX - panelWidth / 2 + 20, panelY - 70, "Select a track", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff",
      wordWrap: { width: panelWidth - 40 }
    })

    this.detailArtist = this.add.text(panelX - panelWidth / 2 + 20, panelY - 45, "", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    })

    this.detailAlbum = this.add.text(panelX - panelWidth / 2 + 20, panelY - 25, "", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    })

    // External links container
    this.externalLinksContainer = this.add.container(panelX, panelY + 20)
    this.externalLinkButtons = []

    // "Get this track" label
    this.getTrackLabel = this.add.text(panelX - panelWidth / 2 + 20, panelY + 5, "GET THIS TRACK:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#00ff88"
    }).setVisible(false)
  }

  updateTrackDetail(track) {
    if (!track || !track.isUnlocked) {
      this.detailTitle.setText("Select an unlocked track")
      this.detailArtist.setText("")
      this.detailAlbum.setText("")
      this.getTrackLabel.setVisible(false)
      this.clearExternalLinks()
      return
    }

    this.detailTitle.setText(track.title)
    this.detailArtist.setText(`by ${track.artist}`)
    this.detailAlbum.setText(`${track.album} • ${track.genre} • ${track.duration}`)

    // Update external links
    this.clearExternalLinks()
    const links = track.externalLinks || []
    
    if (links.length > 0) {
      this.getTrackLabel.setVisible(true)
      this.createExternalLinkButtons(links)
    } else {
      this.getTrackLabel.setVisible(false)
    }
  }

  clearExternalLinks() {
    this.externalLinkButtons.forEach(btn => btn.destroy())
    this.externalLinkButtons = []
    this.externalLinksContainer.removeAll(true)
  }

  createExternalLinkButtons(links) {
    const startX = -130
    const startY = 20
    const buttonWidth = 120
    const buttonHeight = 28
    const gap = 8

    links.forEach((link, index) => {
      const row = Math.floor(index / 2)
      const col = index % 2
      const x = startX + col * (buttonWidth + gap)
      const y = startY + row * (buttonHeight + gap)

      // Button background
      const bg = this.add.rectangle(x + buttonWidth / 2, y, buttonWidth, buttonHeight, 0x333366, 0.9)
        .setStrokeStyle(1, 0x5555aa)
        .setInteractive({ useHandCursor: true })

      // Button text
      const text = this.add.text(x + buttonWidth / 2, y, link.label, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#ffffff"
      }).setOrigin(0.5)

      // Hover effects
      bg.on("pointerover", () => {
        bg.setFillStyle(0x4444aa, 1)
        bg.setStrokeStyle(2, 0x00ffff)
      })

      bg.on("pointerout", () => {
        bg.setFillStyle(0x333366, 0.9)
        bg.setStrokeStyle(1, 0x5555aa)
      })

      // Click to open link
      bg.on("pointerdown", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        window.open(link.url, "_blank")
      })

      this.externalLinksContainer.add([bg, text])
      this.externalLinkButtons.push(bg, text)
    })
  }

  createPlayerControls() {
    const controlsY = this.cameras.main.height - 100
    const centerX = this.cameras.main.width / 2

    // Control panel background
    this.add.rectangle(centerX, controlsY, 400, 60, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xff69b4)

    // Play/Pause button
    this.playPauseBtn = this.add.text(centerX - 80, controlsY, "▶ PLAY", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#00ff88",
      backgroundColor: "#00ff8822",
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5)
    this.playPauseBtn.setInteractive({ useHandCursor: true })
    this.playPauseBtn.on("pointerdown", () => this.togglePlayPause())

    // Stop button
    this.stopBtn = this.add.text(centerX + 80, controlsY, "◼ STOP", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff4444",
      backgroundColor: "#ff444422",
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5)
    this.stopBtn.setInteractive({ useHandCursor: true })
    this.stopBtn.on("pointerdown", () => this.stopPlayback())
  }

  createNowPlayingDisplay() {
    const displayY = this.cameras.main.height - 160
    const centerX = this.cameras.main.width / 2

    // Now playing panel
    this.add.rectangle(centerX, displayY, 500, 40, 0x0a0a1a, 0.9)
      .setStrokeStyle(1, 0x333366)

    this.nowPlayingText = this.add.text(centerX, displayY, "Select a track to play", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5)
  }

  playTrack(track) {
    // Stop current playback
    this.stopPlayback()

    // Check if track has audio URL
    if (!track.audioUrl) {
      this.nowPlayingText.setText(`No audio file for "${track.title}"`)
      this.nowPlayingText.setColor("#ff6666")
      return
    }

    // Try to play the track
    try {
      // Load and play the audio dynamically
      const audioKey = `track_${track.id}_audio`
      
      if (this.cache.audio.exists(audioKey)) {
        this.currentAudio = this.sound.add(audioKey, { volume: 0.7 })
        this.currentAudio.play()
      } else {
        // Load dynamically
        this.load.audio(audioKey, track.audioUrl)
        this.load.once("complete", () => {
          if (this.cache.audio.exists(audioKey)) {
            this.currentAudio = this.sound.add(audioKey, { volume: 0.7 })
            this.currentAudio.play()
          }
        })
        this.load.start()
      }

      this.currentlyPlaying = track
      this.nowPlayingText.setText(`Now Playing: ${track.title} - ${track.artist}`)
      this.nowPlayingText.setColor("#00ff88")
      this.playPauseBtn.setText("⏸ PAUSE")

      // Update icon to show currently playing
      this.updatePlayingIcon(track)

    } catch (e) {
      console.error("Error playing track:", e)
      this.nowPlayingText.setText(`Error playing "${track.title}"`)
      this.nowPlayingText.setColor("#ff4444")
    }
  }

  updatePlayingIcon(playingTrack) {
    this.trackItems.forEach(item => {
      if (item.isUnlocked) {
        if (item.track.id === playingTrack.id) {
          item.icon.setText("♪")
          item.icon.setColor("#ff69b4")
        } else {
          item.icon.setText("▶")
          item.icon.setColor("#00ff88")
        }
      }
    })
  }

  togglePlayPause() {
    if (this.currentAudio) {
      if (this.currentAudio.isPlaying) {
        this.currentAudio.pause()
        this.playPauseBtn.setText("▶ PLAY")
      } else {
        this.currentAudio.resume()
        this.playPauseBtn.setText("⏸ PAUSE")
      }
    } else {
      // Play selected track
      const selectedItem = this.trackItems[this.selectedIndex]
      if (selectedItem && selectedItem.isUnlocked) {
        this.playTrack(selectedItem.track)
      }
    }
  }

  stopPlayback() {
    if (this.currentAudio) {
      this.currentAudio.stop()
      this.currentAudio.destroy()
      this.currentAudio = null
    }
    this.currentlyPlaying = null
    this.nowPlayingText.setText("Select a track to play")
    this.nowPlayingText.setColor("#888888")
    this.playPauseBtn.setText("▶ PLAY")

    // Reset all icons
    this.trackItems.forEach(item => {
      if (item.isUnlocked) {
        item.icon.setText("▶")
        item.icon.setColor("#00ff88")
      }
    })
  }

  createBackButton() {
    const backBtn = this.add.text(30, this.cameras.main.height - 40, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#666666"
    })
    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.stopPlayback()
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("TitleScreen")
    })
  }

  setupInput() {
    this.input.keyboard.on("keydown-UP", () => {
      // Find previous unlocked track
      let newIndex = this.selectedIndex - 1
      while (newIndex >= 0 && !this.trackItems[newIndex]?.isUnlocked) {
        newIndex--
      }
      if (newIndex >= 0) {
        this.selectedIndex = newIndex
        this.updateTrackSelection()
        this.ensureSelectedVisible()
        this.sound.play("ui_select_sound", { volume: 0.1 })
      }
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      // Find next unlocked track
      let newIndex = this.selectedIndex + 1
      while (newIndex < this.trackItems.length && !this.trackItems[newIndex]?.isUnlocked) {
        newIndex++
      }
      if (newIndex < this.trackItems.length) {
        this.selectedIndex = newIndex
        this.updateTrackSelection()
        this.ensureSelectedVisible()
        this.sound.play("ui_select_sound", { volume: 0.1 })
      }
    })

    this.input.keyboard.on("keydown-ENTER", () => {
      const selectedItem = this.trackItems[this.selectedIndex]
      if (selectedItem && selectedItem.isUnlocked) {
        this.playTrack(selectedItem.track)
      }
    })

    this.input.keyboard.on("keydown-SPACE", () => {
      this.togglePlayPause()
    })

    this.input.keyboard.on("keydown-ESC", () => {
      this.stopPlayback()
      this.scene.start("TitleScreen")
    })

    // Mouse wheel scrolling - INVERTED (natural scrolling)
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      // Inverted: positive deltaY scrolls content up (shows items below)
      this.scrollTrackList(-deltaY * 0.5)
    })
  }

  ensureSelectedVisible() {
    const itemHeight = 65
    const selectedY = this.selectedIndex * itemHeight
    const visibleTop = this.scrollOffset
    const visibleBottom = this.scrollOffset + (this.maxVisibleTracks * itemHeight)

    if (selectedY < visibleTop) {
      this.scrollOffset = selectedY
    } else if (selectedY + itemHeight > visibleBottom) {
      this.scrollOffset = selectedY - (this.maxVisibleTracks - 1) * itemHeight
    }

    this.scrollOffset = Math.max(0, this.scrollOffset)
    this.trackListContainer.y = this.scrollOffset
  }

  shutdown() {
    this.stopPlayback()
  }
}
