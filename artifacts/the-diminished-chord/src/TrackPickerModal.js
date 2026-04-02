import Phaser from "phaser"
import { SupabaseMusicManager } from "./SupabaseMusicManager.js"
import { musicManager } from "./MusicTrackManager.js"
import { BGMManager } from "./BGMManager.js"

/**
 * TrackPickerModal - Reusable modal for selecting music tracks from the database
 * Features:
 * - Real-time search as you type
 * - Scrollable track list
 * - Track preview/audition
 * - Works in any Phaser scene
 */
export class TrackPickerModal {
  /**
   * Create a new track picker modal
   * @param {Phaser.Scene} scene - The scene to add the modal to
   * @param {Object} options - Configuration options
   * @param {string} options.title - Modal title (default: "SELECT TRACK")
   * @param {string} options.subtitle - Subtitle text (default: shows track count)
   * @param {string} options.currentTrackId - ID of currently assigned track to highlight
   * @param {number} options.depth - Z-depth for modal (default: 1000)
   * @param {function} options.onSelect - Callback when track is selected: (track) => void
   * @param {function} options.onCancel - Callback when modal is cancelled
   * @param {function} options.onUpload - Optional callback to trigger upload flow
   */
  constructor(scene, options = {}) {
    this.scene = scene
    this.options = {
      title: options.title || "SELECT TRACK",
      subtitle: options.subtitle || null,
      currentTrackId: options.currentTrackId || null,
      depth: options.depth || 1000,
      onSelect: options.onSelect || (() => {}),
      onCancel: options.onCancel || (() => {}),
      onUpload: options.onUpload || null
    }
    
    this.container = null
    this.allTracks = []
    this.filteredTracks = []
    this.searchQuery = ""
    this.scrollOffset = 0
    this.trackItems = []
    this.currentPreviewTrackId = null
    this.previewSound = null
    this.searchCursor = null
    this.cursorBlinkTimer = null
  }

  /**
   * Open the modal and load tracks
   */
  async open() {
    // Show loading state
    this.showLoading()
    
    // Ensure tracks are loaded
    try {
      await musicManager.reloadFromSupabase()
      this.allTracks = SupabaseMusicManager.getAllTracks()
      this.filteredTracks = [...this.allTracks]
    } catch (e) {
      console.error("[TrackPickerModal] Failed to load tracks:", e)
      this.allTracks = []
      this.filteredTracks = []
    }
    
    // Build the modal
    this.buildModal()
  }

  showLoading() {
    const { width, height } = this.scene.cameras.main
    const centerX = width / 2
    const centerY = height / 2

    this.container = this.scene.add.container(0, 0)
    this.container.setDepth(this.options.depth)

    // Overlay
    const overlay = this.scene.add.rectangle(centerX, centerY, width, height, 0x000000, 0.8)
      .setInteractive()
    this.container.add(overlay)

    // Loading text
    this.loadingText = this.scene.add.text(centerX, centerY, "Loading tracks...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#aa44ff"
    }).setOrigin(0.5)
    this.container.add(this.loadingText)
  }

  buildModal() {
    const { width, height } = this.scene.cameras.main
    const centerX = width / 2
    const centerY = height / 2

    // Remove loading text
    if (this.loadingText) {
      this.loadingText.destroy()
    }

    // Modal dimensions
    const modalWidth = 650
    const modalHeight = 580

    // Modal background
    const modalBg = this.scene.add.rectangle(centerX, centerY, modalWidth, modalHeight, 0x1a1a2e)
      .setStrokeStyle(3, 0xaa44ff)
    this.container.add(modalBg)

    // Title
    const title = this.scene.add.text(centerX, centerY - 265, this.options.title, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#aa44ff"
    }).setOrigin(0.5)
    this.container.add(title)

    // Subtitle
    const subtitleText = this.options.subtitle || `Assigning track`
    const subtitle = this.scene.add.text(centerX, centerY - 240, subtitleText, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
    this.container.add(subtitle)

    // Check if we have tracks
    if (this.allTracks.length === 0) {
      this.buildEmptyState(centerX, centerY)
    } else {
      this.buildTrackList(centerX, centerY, modalWidth)
    }

    // Close button
    const closeBtn = this.scene.add.rectangle(centerX + 100, centerY + 250, 180, 35, 0x442222)
      .setStrokeStyle(1, 0xff4444)
      .setInteractive({ useHandCursor: true })
    const closeBtnText = this.scene.add.text(centerX + 100, centerY + 250, "✕ Cancel", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff4444"
    }).setOrigin(0.5)
    closeBtn.on("pointerdown", () => this.close(false))
    this.container.add([closeBtn, closeBtnText])

    // Setup keyboard input
    this.setupKeyboardInput()

    // ESC to close
    this.escKey = this.scene.input.keyboard.addKey("ESC")
    this.escKey.on("down", () => this.close(false))
  }

  buildEmptyState(centerX, centerY) {
    const noTracksText = this.scene.add.text(centerX, centerY - 50, "No tracks in database yet!", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff4444"
    }).setOrigin(0.5)
    this.container.add(noTracksText)

    const uploadPrompt = this.scene.add.text(centerX, centerY, "Upload tracks via Track Manager", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
    this.container.add(uploadPrompt)

    if (this.options.onUpload) {
      const uploadBtn = this.scene.add.rectangle(centerX, centerY + 60, 250, 50, 0x2a1a4a)
        .setStrokeStyle(2, 0x00ff88)
        .setInteractive({ useHandCursor: true })
      const uploadBtnText = this.scene.add.text(centerX, centerY + 60, "☁️ GO TO TRACK MANAGER", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#00ff88"
      }).setOrigin(0.5)
      uploadBtn.on("pointerdown", () => {
        this.close(false)
        this.options.onUpload()
      })
      this.container.add([uploadBtn, uploadBtnText])
    }
  }

  buildTrackList(centerX, centerY, modalWidth) {
    // Search bar
    this.buildSearchBar(centerX, centerY - 210)

    // Track count indicator
    this.trackCountText = this.scene.add.text(centerX, centerY - 175, `${this.allTracks.length} tracks available`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5)
    this.container.add(this.trackCountText)

    // Track list area
    this.listStartY = centerY - 150
    this.listCenterX = centerX
    this.renderTrackList()

    // Upload new button (if callback provided)
    if (this.options.onUpload) {
      const uploadNewBtn = this.scene.add.rectangle(centerX - 100, centerY + 250, 180, 35, 0x1a3a1a)
        .setStrokeStyle(1, 0x00ff88)
        .setInteractive({ useHandCursor: true })
      const uploadNewText = this.scene.add.text(centerX - 100, centerY + 250, "☁️ Upload New", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#00ff88"
      }).setOrigin(0.5)
      uploadNewBtn.on("pointerdown", () => {
        this.close(false)
        this.options.onUpload()
      })
      this.container.add([uploadNewBtn, uploadNewText])
    }

    // Setup scroll wheel
    this.setupScrollWheel()
  }

  buildSearchBar(centerX, y) {
    const searchContainer = this.scene.add.container(centerX, y)
    this.container.add(searchContainer)

    // Search box background - highlighted to show it's active
    const searchBg = this.scene.add.rectangle(0, 0, 400, 35, 0x0a0a1a, 0.95)
      .setStrokeStyle(2, 0xaa44ff)

    // Search icon
    const searchIcon = this.scene.add.text(-180, 0, "🔍", {
      fontSize: "14px"
    }).setOrigin(0.5)

    // Search placeholder/text
    this.searchText = this.scene.add.text(-150, 0, "Type to search...", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    }).setOrigin(0, 0.5)

    // Blinking cursor
    this.searchCursor = this.scene.add.text(-150, 0, "|", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#aa44ff"
    }).setOrigin(0, 0.5)

    // Blink the cursor
    this.cursorBlinkTimer = this.scene.time.addEvent({
      delay: 500,
      callback: () => {
        if (this.searchCursor && this.searchCursor.active) {
          this.searchCursor.setVisible(!this.searchCursor.visible)
        }
      },
      loop: true
    })

    // Clear button
    this.searchClear = this.scene.add.text(180, 0, "✕", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff4444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false)

    this.searchClear.on("pointerdown", () => {
      this.searchQuery = ""
      this.updateSearch()
    })

    // Hint text
    const hintText = this.scene.add.text(0, 22, "Just start typing to filter tracks in real-time", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#555555"
    }).setOrigin(0.5)

    searchContainer.add([searchBg, searchIcon, this.searchText, this.searchCursor, this.searchClear, hintText])
  }

  setupKeyboardInput() {
    // Store the callback function so we can properly remove it later
    this.keyboardCallback = (event) => {
      if (!this.container) return

      // Ignore special keys
      if (["Enter", "Tab", "Shift", "Control", "Alt", "Meta", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) return

      // Handle backspace
      if (event.key === "Backspace") {
        event.preventDefault()
        if (this.searchQuery.length > 0) {
          this.searchQuery = this.searchQuery.slice(0, -1)
          this.updateSearch()
        }
        return
      }

      // Handle Delete key - clear all
      if (event.key === "Delete") {
        event.preventDefault()
        this.searchQuery = ""
        this.updateSearch()
        return
      }

      // Handle printable characters
      if (event.key.length === 1) {
        event.preventDefault()
        this.searchQuery += event.key
        this.updateSearch()
      }
    }
    
    // Add the keyboard listener
    this.scene.input.keyboard.on("keydown", this.keyboardCallback)
  }

  updateSearch() {
    const query = this.searchQuery.toLowerCase().trim()

    // Update search text display
    if (this.searchQuery.length > 0) {
      this.searchText.setText(this.searchQuery)
      this.searchText.setColor("#ffffff")
      this.searchClear.setVisible(true)

      // Position cursor at end of text
      if (this.searchCursor) {
        const textWidth = this.searchText.width
        this.searchCursor.setX(-150 + textWidth + 2)
        this.searchCursor.setVisible(true)
      }
    } else {
      this.searchText.setText("Type to search...")
      this.searchText.setColor("#666666")
      this.searchClear.setVisible(false)

      if (this.searchCursor) {
        this.searchCursor.setX(-150)
      }
    }

    // Filter tracks
    if (query) {
      this.filteredTracks = this.allTracks.filter(track => {
        const name = (track.name || "").toLowerCase()
        const artist = (track.artist || "").toLowerCase()
        const genre = (track.genre || "").toLowerCase()
        const mood = (track.mood || "").toLowerCase()
        return name.includes(query) || artist.includes(query) || genre.includes(query) || mood.includes(query)
      })
    } else {
      this.filteredTracks = [...this.allTracks]
    }

    // Update track count
    if (this.trackCountText) {
      if (query) {
        const countText = this.filteredTracks.length === 0
          ? `No matches for "${this.searchQuery}"`
          : `${this.filteredTracks.length} of ${this.allTracks.length} tracks match "${this.searchQuery}"`
        this.trackCountText.setText(countText)
        this.trackCountText.setColor(this.filteredTracks.length === 0 ? "#ff6666" : "#00ff88")
      } else {
        this.trackCountText.setText(`${this.allTracks.length} tracks available`)
        this.trackCountText.setColor("#666666")
      }
    }

    // Reset scroll and rerender
    this.scrollOffset = 0
    this.renderTrackList()
  }

  setupScrollWheel() {
    this.scrollHandler = (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.container || !this.filteredTracks) return

      const maxVisible = 7
      const maxOffset = Math.max(0, this.filteredTracks.length - maxVisible)

      if (deltaY > 0) {
        this.scrollOffset = Math.min(maxOffset, this.scrollOffset + 1)
      } else if (deltaY < 0) {
        this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      }

      this.renderTrackList()
    }

    this.scene.input.on("wheel", this.scrollHandler)
  }

  renderTrackList() {
    const maxVisible = 7
    const itemHeight = 48
    const itemWidth = 580

    // Clear previous items
    if (this.trackItems) {
      this.trackItems.forEach(item => {
        if (item && item.destroy) item.destroy()
      })
    }
    this.trackItems = []

    const visibleTracks = this.filteredTracks.slice(
      this.scrollOffset,
      this.scrollOffset + maxVisible
    )

    // Show message if no tracks match search
    if (visibleTracks.length === 0 && this.searchQuery) {
      const noResults = this.scene.add.text(this.listCenterX, this.listStartY + 100, `No tracks matching "${this.searchQuery}"`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }).setOrigin(0.5)
      this.trackItems.push(noResults)
      this.container.add(noResults)
      return
    }

    visibleTracks.forEach((track, i) => {
      const y = this.listStartY + i * itemHeight
      const item = this.createTrackItem(this.listCenterX, y, track, itemWidth)
      this.trackItems.push(item)
      this.container.add(item)
    })

    // Scroll position indicator
    const totalTracks = this.filteredTracks.length
    if (totalTracks > maxVisible) {
      const scrollInfo = this.scene.add.text(this.listCenterX, this.listStartY + maxVisible * itemHeight + 10,
        `Showing ${this.scrollOffset + 1}-${Math.min(this.scrollOffset + maxVisible, totalTracks)} of ${totalTracks} • Scroll or use ▲▼`, {
          fontFamily: "RetroPixel",
          fontSize: "9px",
          color: "#555555"
        }).setOrigin(0.5)
      this.trackItems.push(scrollInfo)
      this.container.add(scrollInfo)
    }

    // Scroll buttons
    if (this.scrollOffset > 0) {
      const upArrow = this.scene.add.text(this.listCenterX + 260, this.listStartY + 80, "▲", {
        fontFamily: "RetroPixel",
        fontSize: "20px",
        color: "#aa44ff"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      upArrow.on("pointerdown", () => {
        this.scrollOffset = Math.max(0, this.scrollOffset - 3)
        this.renderTrackList()
      })
      this.trackItems.push(upArrow)
      this.container.add(upArrow)
    }

    if (this.scrollOffset + maxVisible < totalTracks) {
      const downArrow = this.scene.add.text(this.listCenterX + 260, this.listStartY + maxVisible * itemHeight - 80, "▼", {
        fontFamily: "RetroPixel",
        fontSize: "20px",
        color: "#aa44ff"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      downArrow.on("pointerdown", () => {
        this.scrollOffset = Math.min(totalTracks - maxVisible, this.scrollOffset + 3)
        this.renderTrackList()
      })
      this.trackItems.push(downArrow)
      this.container.add(downArrow)
    }
  }

  createTrackItem(x, y, track, width) {
    const container = this.scene.add.container(x, y)
    const isCurrentTrack = track.id === this.options.currentTrackId

    const bg = this.scene.add.rectangle(0, 0, width, 45, 0x2a2a3e, 0.9)
      .setStrokeStyle(isCurrentTrack ? 2 : 1, isCurrentTrack ? 0x00ff88 : 0x444466)

    const title = this.scene.add.text(-width / 2 + 20, -10, track.name || "Untitled", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: isCurrentTrack ? "#00ff88" : "#ffffff"
    })

    const info = this.scene.add.text(-width / 2 + 20, 10,
      `${track.artist || "Unknown"} • ${track.genre || "N/A"}`, {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#888888"
      })

    // Current indicator
    if (isCurrentTrack) {
      const currentLabel = this.scene.add.text(width / 2 - 200, 0, "✓ CURRENT", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#00ff88"
      }).setOrigin(0.5)
      container.add(currentLabel)
    }

    // Preview button
    const previewBtn = this.scene.add.rectangle(width / 2 - 130, 0, 40, 30, 0x1a3a4a)
      .setStrokeStyle(1, 0x00aaff)
      .setInteractive({ useHandCursor: true })

    const previewText = this.scene.add.text(width / 2 - 130, 0, 
      this.currentPreviewTrackId === track.id ? "⏹" : "▶", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: this.currentPreviewTrackId === track.id ? "#ff6666" : "#00aaff"
      }).setOrigin(0.5)

    previewBtn.on("pointerdown", () => {
      if (this.currentPreviewTrackId === track.id) {
        this.stopPreview()
        previewText.setText("▶")
        previewText.setColor("#00aaff")
      } else {
        this.stopPreview()
        this.currentPreviewTrackId = track.id
        previewText.setText("⏹")
        previewText.setColor("#ff6666")
        this.playPreview(track)
      }
    })

    // Select button
    const selectBtn = this.scene.add.rectangle(width / 2 - 60, 0, 80, 30, 0x1a4a1a)
      .setStrokeStyle(1, 0x00ff88)
      .setInteractive({ useHandCursor: true })

    const selectText = this.scene.add.text(width / 2 - 60, 0, "SELECT", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#00ff88"
    }).setOrigin(0.5)

    selectBtn.on("pointerdown", () => {
      this.stopPreview()
      this.close(true, track)
    })
    selectBtn.on("pointerover", () => {
      bg.setStrokeStyle(2, 0xaa44ff)
      selectBtn.setStrokeStyle(2, 0xffffff)
    })
    selectBtn.on("pointerout", () => {
      bg.setStrokeStyle(isCurrentTrack ? 2 : 1, isCurrentTrack ? 0x00ff88 : 0x444466)
      selectBtn.setStrokeStyle(1, 0x00ff88)
    })

    container.add([bg, title, info, previewBtn, previewText, selectBtn, selectText])
    return container
  }

  playPreview(track) {
    if (track.fileUrl) {
      BGMManager.playMusic(this.scene, `preview_${track.id}`, track.fileUrl, true)
    }
  }

  stopPreview() {
    BGMManager.stop()
    this.currentPreviewTrackId = null
  }

  /**
   * Close the modal
   * @param {boolean} selected - Whether a track was selected
   * @param {object} track - The selected track (if any)
   */
  close(selected, track = null) {
    this.stopPreview()

    // Remove scroll wheel handler
    if (this.scrollHandler) {
      this.scene.input.off("wheel", this.scrollHandler)
      this.scrollHandler = null
    }

    // Remove keyboard handler
    if (this.keyboardCallback) {
      this.scene.input.keyboard.off("keydown", this.keyboardCallback)
      this.keyboardCallback = null
    }

    // Remove ESC key
    if (this.escKey) {
      this.escKey.destroy()
      this.escKey = null
    }

    // Stop cursor blink timer
    if (this.cursorBlinkTimer) {
      this.cursorBlinkTimer.destroy()
      this.cursorBlinkTimer = null
    }

    // Destroy container
    if (this.container) {
      this.container.destroy()
      this.container = null
    }

    // Clear references
    this.trackItems = []
    this.searchCursor = null
    this.searchText = null
    this.searchClear = null
    this.trackCountText = null

    // Call appropriate callback
    if (selected && track) {
      this.options.onSelect(track)
    } else {
      this.options.onCancel()
    }
  }
}
