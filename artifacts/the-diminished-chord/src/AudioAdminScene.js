import Phaser from "phaser"
import { supabase } from "./integrations/supabase/client.js"
import { SupabaseMusicManager } from "./SupabaseMusicManager.js"
import { SoundEffectManager } from "./SoundEffectManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * AudioAdminScene - Manage music tracks, sound effects, and level assignments
 * 
 * Features:
 * - View all music tracks from Supabase
 * - Upload new tracks to Supabase Storage
 * - Assign tracks to levels
 * - Manage sound effects with variations
 * - Preview audio files
 */
export class AudioAdminScene extends Phaser.Scene {
  constructor() {
    super({ key: "AudioAdminScene" })
  }

  init() {
    this.currentTab = "tracks" // "tracks", "sounds", "assignments"
    this.selectedIndex = 0
    this.tracks = []
    this.sounds = []
    this.assignments = []
    this.scrollOffset = 0
    this.maxVisibleItems = 8
    this.isUploading = false
    this.previewSound = null
  }

  async create() {
    const { width, height } = this.cameras.main

    // Background
    this.createBackground()

    // Title
    this.add.text(width / 2, 30, "AUDIO MANAGER", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    this.add.text(width / 2, 60, "Manage Music Tracks & Sound Effects", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5)

    // Create tabs
    this.createTabs()

    // Create list panel
    this.listPanel = this.add.container(width / 2 - 200, 140)
    this.createListPanel()

    // Create details panel
    this.detailsPanel = this.add.container(width / 2 + 200, 140)
    this.createDetailsPanel()

    // Create action buttons
    this.createActionButtons()

    // Back button
    this.createBackButton()

    // Load data from Supabase
    await this.loadData()

    // Setup input
    this.setupInput()

    // Status text
    this.statusText = this.add.text(width / 2, height - 30, "", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ff88"
    }).setOrigin(0.5)
  }

  createBackground() {
    const { width, height } = this.cameras.main
    this.add.rectangle(0, 0, width, height, 0x0a0a1a).setOrigin(0)

    // Grid pattern
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x1a1a3a, 0.5)
    for (let x = 0; x < width; x += 40) {
      graphics.lineBetween(x, 0, x, height)
    }
    for (let y = 0; y < height; y += 40) {
      graphics.lineBetween(0, y, width, y)
    }
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 100
    const tabs = [
      { key: "tracks", label: "MUSIC TRACKS", color: 0xff69b4 },
      { key: "sounds", label: "SOUND EFFECTS", color: 0x00ffff },
      { key: "assignments", label: "LEVEL ASSIGNMENTS", color: 0xffaa00 }
    ]

    this.tabButtons = []
    const tabWidth = 180
    const startX = width / 2 - (tabs.length * tabWidth) / 2 + tabWidth / 2

    tabs.forEach((tab, i) => {
      const x = startX + i * tabWidth
      const bg = this.add.rectangle(x, tabY, tabWidth - 10, 30, 0x1a1a2e)
        .setStrokeStyle(2, tab.color)
        .setInteractive({ useHandCursor: true })

      const text = this.add.text(x, tabY, tab.label, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ffffff"
      }).setOrigin(0.5)

      bg.on("pointerdown", () => {
        this.currentTab = tab.key
        this.selectedIndex = 0
        this.scrollOffset = 0
        this.updateTabs()
        this.refreshList()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      })

      this.tabButtons.push({ bg, text, key: tab.key, color: tab.color })
    })

    this.updateTabs()
  }

  updateTabs() {
    this.tabButtons.forEach(tab => {
      if (tab.key === this.currentTab) {
        tab.bg.setFillStyle(tab.color, 0.3)
        tab.bg.setStrokeStyle(3, 0xffffff)
      } else {
        tab.bg.setFillStyle(0x1a1a2e)
        tab.bg.setStrokeStyle(2, tab.color)
      }
    })
  }

  createListPanel() {
    // Panel background
    this.listBg = this.add.rectangle(0, 0, 350, 400, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x333366)
      .setOrigin(0.5, 0)

    this.listPanel.add(this.listBg)

    // List title
    this.listTitle = this.add.text(0, 15, "TRACKS", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.listPanel.add(this.listTitle)

    // List items container
    this.listItems = this.add.container(0, 50)
    this.listPanel.add(this.listItems)

    // Scroll indicators
    this.scrollUpText = this.add.text(0, 40, "▲ MORE", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0)
    this.listPanel.add(this.scrollUpText)

    this.scrollDownText = this.add.text(0, 385, "▼ MORE", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0)
    this.listPanel.add(this.scrollDownText)
  }

  createDetailsPanel() {
    // Panel background
    this.detailsBg = this.add.rectangle(0, 0, 350, 400, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x333366)
      .setOrigin(0.5, 0)
    this.detailsPanel.add(this.detailsBg)

    // Details title
    this.detailsTitle = this.add.text(0, 15, "DETAILS", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ff88"
    }).setOrigin(0.5)
    this.detailsPanel.add(this.detailsTitle)

    // Details content container
    this.detailsContent = this.add.container(0, 50)
    this.detailsPanel.add(this.detailsContent)
  }

  createActionButtons() {
    const { width, height } = this.cameras.main
    const buttonY = height - 80

    // Add New button
    this.addButton = this.createActionButton(width / 2 - 150, buttonY, "ADD NEW", 0x00ff88, () => this.showAddDialog())

    // Upload button
    this.uploadButton = this.createActionButton(width / 2, buttonY, "UPLOAD FILE", 0xff69b4, () => this.triggerFileUpload())

    // Delete button
    this.deleteButton = this.createActionButton(width / 2 + 150, buttonY, "DELETE", 0xff4444, () => this.deleteSelected())
  }

  createActionButton(x, y, label, color, callback) {
    const bg = this.add.rectangle(x, y, 130, 35, 0x1a1a2e)
      .setStrokeStyle(2, color)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(x, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)

    bg.on("pointerover", () => bg.setFillStyle(color, 0.2))
    bg.on("pointerout", () => bg.setFillStyle(0x1a1a2e))
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      callback()
    })

    return { bg, text }
  }

  createBackButton() {
    const backBtn = this.add.text(30, this.cameras.main.height - 40, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#666666"
    }).setInteractive({ useHandCursor: true })

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.stopPreview()
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("DeveloperMenuScene")
    })
  }

  async loadData() {
    this.statusText?.setText("Loading from Supabase...")

    // Initialize managers if needed
    await Promise.all([
      SupabaseMusicManager.initialize(),
      SoundEffectManager.initialize()
    ])

    // Load tracks
    this.tracks = SupabaseMusicManager.getAllTracks()

    // Load sounds
    this.sounds = Array.from(SoundEffectManager.sounds.values())

    // Load assignments
    this.assignments = Array.from(SupabaseMusicManager.levelAssignments.values())

    this.statusText?.setText(`Loaded: ${this.tracks.length} tracks, ${this.sounds.length} sounds`)
    this.refreshList()
  }

  refreshList() {
    // Clear existing items
    this.listItems.removeAll(true)

    let items = []
    let title = ""

    switch (this.currentTab) {
      case "tracks":
        items = this.tracks
        title = `MUSIC TRACKS (${items.length})`
        break
      case "sounds":
        items = this.sounds
        title = `SOUND EFFECTS (${items.length})`
        break
      case "assignments":
        items = this.assignments
        title = `LEVEL ASSIGNMENTS (${items.length})`
        break
    }

    this.listTitle.setText(title)

    // Create list items
    const startIndex = this.scrollOffset
    const endIndex = Math.min(startIndex + this.maxVisibleItems, items.length)

    for (let i = startIndex; i < endIndex; i++) {
      const item = items[i]
      const y = (i - startIndex) * 40

      const itemContainer = this.createListItem(item, i, y)
      this.listItems.add(itemContainer)
    }

    // Update scroll indicators
    this.scrollUpText.setAlpha(this.scrollOffset > 0 ? 1 : 0)
    this.scrollDownText.setAlpha(endIndex < items.length ? 1 : 0)

    // Update details panel
    this.updateDetails()
  }

  createListItem(item, index, y) {
    const container = this.add.container(-150, y)
    const isSelected = index === this.selectedIndex

    // Background
    const bg = this.add.rectangle(150, 0, 320, 35, isSelected ? 0x333366 : 0x1a1a2e)
      .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffffff : 0x333366)
      .setInteractive({ useHandCursor: true })

    // Item text based on tab
    let label = ""
    let sublabel = ""

    switch (this.currentTab) {
      case "tracks":
        label = item.name || "Untitled Track"
        sublabel = `${item.artist || "Unknown"} • ${item.genre || "N/A"}`
        break
      case "sounds":
        label = item.name || item.key
        sublabel = `${item.category || "general"} • ${item.variationGroup || "no group"}`
        break
      case "assignments":
        label = item.levelId
        sublabel = item.track?.name || "No track assigned"
        break
    }

    const labelText = this.add.text(20, -8, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: isSelected ? "#ffffff" : "#aaaaaa"
    })

    const sublabelText = this.add.text(20, 8, sublabel, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    })

    container.add([bg, labelText, sublabelText])

    // Interaction
    bg.on("pointerdown", () => {
      this.selectedIndex = index
      this.refreshList()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    bg.on("pointerover", () => {
      if (index !== this.selectedIndex) {
        bg.setFillStyle(0x222244)
      }
    })

    bg.on("pointerout", () => {
      if (index !== this.selectedIndex) {
        bg.setFillStyle(0x1a1a2e)
      }
    })

    return container
  }

  updateDetails() {
    this.detailsContent.removeAll(true)

    let items = this.getCurrentItems()
    const item = items[this.selectedIndex]

    if (!item) {
      const noItem = this.add.text(0, 100, "No item selected", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#666666"
      }).setOrigin(0.5)
      this.detailsContent.add(noItem)
      return
    }

    let details = []

    switch (this.currentTab) {
      case "tracks":
        details = [
          { label: "Name", value: item.name },
          { label: "Artist", value: item.artist || "Unknown" },
          { label: "Album", value: item.album || "N/A" },
          { label: "Genre", value: item.genre || "N/A" },
          { label: "Mood", value: item.mood || "N/A" },
          { label: "BPM", value: item.bpm || "N/A" },
          { label: "Duration", value: item.duration ? `${item.duration}s` : "N/A" },
          { label: "Format", value: item.fileFormat || "mp3" },
          { label: "URL", value: item.fileUrl ? "✓ Set" : "✗ Missing" }
        ]
        break

      case "sounds":
        details = [
          { label: "Key", value: item.key },
          { label: "Name", value: item.name },
          { label: "Category", value: item.category || "general" },
          { label: "Volume", value: `${(item.volume || 0.3) * 100}%` },
          { label: "Variation Group", value: item.variationGroup || "None" },
          { label: "Max Instances", value: item.maxInstances || 3 },
          { label: "URL", value: item.fileUrl ? "✓ Set" : "✗ Missing" }
        ]
        break

      case "assignments":
        details = [
          { label: "Level ID", value: item.levelId },
          { label: "Track", value: item.track?.name || "None" },
          { label: "Volume", value: `${(item.volume || 0.6) * 100}%` },
          { label: "Loop", value: item.loop !== false ? "Yes" : "No" },
          { label: "Fade In", value: `${item.fadeInSeconds || 0}s` },
          { label: "Fade Out", value: `${item.fadeOutSeconds || 1}s` },
          { label: "Priority", value: item.priority || 0 }
        ]
        break
    }

    // Render details
    details.forEach((detail, i) => {
      const y = i * 30

      const labelText = this.add.text(-150, y, detail.label + ":", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      })

      const valueText = this.add.text(20, y, String(detail.value), {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ffffff"
      })

      this.detailsContent.add([labelText, valueText])
    })

    // Preview button for tracks and sounds
    if ((this.currentTab === "tracks" || this.currentTab === "sounds") && item.fileUrl) {
      const previewBtn = this.add.rectangle(0, 320, 120, 30, 0x00ff88, 0.2)
        .setStrokeStyle(2, 0x00ff88)
        .setInteractive({ useHandCursor: true })

      const previewText = this.add.text(0, 320, "▶ PREVIEW", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#00ff88"
      }).setOrigin(0.5)

      previewBtn.on("pointerdown", () => this.togglePreview(item))
      this.detailsContent.add([previewBtn, previewText])
    }
  }

  getCurrentItems() {
    switch (this.currentTab) {
      case "tracks": return this.tracks
      case "sounds": return this.sounds
      case "assignments": return this.assignments
      default: return []
    }
  }

  setupInput() {
    // Keyboard navigation
    this.input.keyboard.on("keydown-UP", () => {
      if (this.selectedIndex > 0) {
        this.selectedIndex--
        if (this.selectedIndex < this.scrollOffset) {
          this.scrollOffset = this.selectedIndex
        }
        this.refreshList()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      const items = this.getCurrentItems()
      if (this.selectedIndex < items.length - 1) {
        this.selectedIndex++
        if (this.selectedIndex >= this.scrollOffset + this.maxVisibleItems) {
          this.scrollOffset++
        }
        this.refreshList()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
    })

    this.input.keyboard.on("keydown-ESC", () => {
      this.stopPreview()
      this.scene.start("DeveloperMenuScene")
    })

    // Tab switching with left/right
    this.input.keyboard.on("keydown-LEFT", () => {
      const tabs = ["tracks", "sounds", "assignments"]
      const currentIndex = tabs.indexOf(this.currentTab)
      if (currentIndex > 0) {
        this.currentTab = tabs[currentIndex - 1]
        this.selectedIndex = 0
        this.scrollOffset = 0
        this.updateTabs()
        this.refreshList()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
    })

    this.input.keyboard.on("keydown-RIGHT", () => {
      const tabs = ["tracks", "sounds", "assignments"]
      const currentIndex = tabs.indexOf(this.currentTab)
      if (currentIndex < tabs.length - 1) {
        this.currentTab = tabs[currentIndex + 1]
        this.selectedIndex = 0
        this.scrollOffset = 0
        this.updateTabs()
        this.refreshList()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
    })

    // Mouse wheel scrolling
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      const items = this.getCurrentItems()
      if (deltaY > 0 && this.scrollOffset < items.length - this.maxVisibleItems) {
        this.scrollOffset++
        this.refreshList()
      } else if (deltaY < 0 && this.scrollOffset > 0) {
        this.scrollOffset--
        this.refreshList()
      }
    })
  }

  togglePreview(item) {
    if (this.previewSound) {
      this.stopPreview()
    } else {
      this.playPreview(item)
    }
  }

  playPreview(item) {
    if (!item.fileUrl) return

    try {
      // Load and play the audio
      const key = `preview_${Date.now()}`
      this.load.audio(key, item.fileUrl)
      this.load.once("complete", () => {
        this.previewSound = this.sound.add(key, { volume: 0.5 })
        this.previewSound.play()
        this.statusText.setText("▶ Playing preview...")
      })
      this.load.start()
    } catch (e) {
      this.statusText.setText(`Preview error: ${e.message}`)
    }
  }

  stopPreview() {
    if (this.previewSound) {
      this.previewSound.stop()
      this.previewSound.destroy()
      this.previewSound = null
      this.statusText.setText("")
    }
  }

  showAddDialog() {
    // For now, show instructions - in a full implementation this would be a modal
    switch (this.currentTab) {
      case "tracks":
        this.statusText.setText("Use UPLOAD FILE to add a new track, or add via Supabase dashboard")
        break
      case "sounds":
        this.statusText.setText("Use UPLOAD FILE to add a new sound effect")
        break
      case "assignments":
        this.statusText.setText("Select a level in Level Browser to assign tracks")
        break
    }
  }

  async triggerFileUpload() {
    // Create a file input element
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = "audio/*"
    fileInput.style.display = "none"
    document.body.appendChild(fileInput)

    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (file) {
        await this.uploadFile(file)
      }
      document.body.removeChild(fileInput)
    }

    fileInput.click()
  }

  async uploadFile(file) {
    if (this.isUploading) return

    this.isUploading = true
    this.statusText.setText(`Uploading ${file.name}...`)

    try {
      // Use the manager's upload methods which handle storage + database
      if (this.currentTab === "tracks") {
        const result = await SupabaseMusicManager.uploadTrack(file, {
          name: file.name.replace(/\.[^/.]+$/, "")
        })

        if (result.success) {
          this.tracks = SupabaseMusicManager.getAllTracks()
          this.statusText.setText(`✓ Uploaded track: ${file.name}`)
        } else {
          throw new Error(result.error)
        }
      } else if (this.currentTab === "sounds") {
        const result = await SoundEffectManager.uploadSound(file, {
          category: "custom"
        })

        if (result.success) {
          this.sounds = Array.from(SoundEffectManager.sounds.values())
          this.statusText.setText(`✓ Uploaded sound: ${file.name}`)
        } else {
          throw new Error(result.error)
        }
      } else {
        this.statusText.setText("Upload not supported for this tab")
        this.isUploading = false
        return
      }

      this.refreshList()
    } catch (e) {
      console.error("Upload error:", e)
      this.statusText.setText(`✗ Upload failed: ${e.message}`)
    }

    this.isUploading = false
  }

  async deleteSelected() {
    const items = this.getCurrentItems()
    const item = items[this.selectedIndex]

    if (!item) {
      this.statusText.setText("No item selected")
      return
    }

    // Confirm deletion (in a full implementation, this would be a modal)
    this.statusText.setText("Deleting...")

    try {
      switch (this.currentTab) {
        case "tracks":
          await SupabaseMusicManager.deleteTrack(item.id)
          this.tracks = SupabaseMusicManager.getAllTracks()
          break
        case "sounds":
          await SoundEffectManager.deleteSound(item.key)
          this.sounds = Array.from(SoundEffectManager.sounds.values())
          break
        case "assignments":
          await SupabaseMusicManager.removeTrackFromLevel(item.levelId)
          this.assignments = Array.from(SupabaseMusicManager.levelAssignments.values())
          break
      }

      this.selectedIndex = Math.max(0, this.selectedIndex - 1)
      this.statusText.setText("✓ Deleted successfully")
      this.refreshList()
    } catch (e) {
      this.statusText.setText(`✗ Delete failed: ${e.message}`)
    }
  }
}
