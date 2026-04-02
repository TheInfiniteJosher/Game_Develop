import Phaser from "phaser"
import { TRACK_DATABASE, LEVEL_TRACKS, musicManager, MENU_KEYS, MENU_MUSIC } from "./MusicTrackManager.js"

/**
 * TrackPublishScene - Simplified interface for publishing track assignments
 * 
 * This scene provides an easy way to:
 * 1. See all current track assignments
 * 2. Copy the JSON config to clipboard
 * 3. Set a remote config URL for auto-loading
 * 4. Apply changes immediately
 */
export class TrackPublishScene extends Phaser.Scene {
  constructor() {
    super({ key: "TrackPublishScene" })
  }

  create() {
    const { width, height } = this.cameras.main
    this.centerX = width / 2
    this.centerY = height / 2

    // Background
    this.add.rectangle(0, 0, width, height, 0x0a0a1a).setOrigin(0, 0)

    // Title
    this.add.text(this.centerX, 40, "PUBLISH TRACK CONFIG", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ff88"
    }).setOrigin(0.5)

    this.add.text(this.centerX, 70, "Make your track assignments persist for all users", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)

    // Create the main panels
    this.createRemoteConfigPanel()
    this.createQuickPublishPanel()
    this.createStatusPanel()
    this.createBackButton()

    // Setup input
    this.setupInput()
  }

  createRemoteConfigPanel() {
    const panelX = this.centerX
    const panelY = 160

    // Panel background
    this.add.rectangle(panelX, panelY, 700, 120, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x00ffff)

    this.add.text(panelX, panelY - 45, "OPTION 1: Remote Config URL", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5)

    this.add.text(panelX, panelY - 25, "Host your config JSON on S3/CDN and the game will fetch it automatically", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5)

    // Current URL display
    const currentUrl = localStorage.getItem("tdc_remote_config_url") || "Not set"
    this.remoteUrlText = this.add.text(panelX, panelY + 5, currentUrl, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: currentUrl === "Not set" ? "#666666" : "#00ff88",
      wordWrap: { width: 650 }
    }).setOrigin(0.5)

    // Set URL button
    const setUrlBtn = this.add.rectangle(panelX - 120, panelY + 40, 180, 35, 0x333355)
      .setStrokeStyle(2, 0x00ffff)
      .setInteractive({ useHandCursor: true })
    
    this.add.text(panelX - 120, panelY + 40, "🔗 Set Config URL", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ffff"
    }).setOrigin(0.5)

    setUrlBtn.on("pointerdown", () => this.setRemoteConfigUrl())
    setUrlBtn.on("pointerover", () => setUrlBtn.setStrokeStyle(3, 0xffffff))
    setUrlBtn.on("pointerout", () => setUrlBtn.setStrokeStyle(2, 0x00ffff))

    // Fetch now button
    const fetchBtn = this.add.rectangle(panelX + 50, panelY + 40, 150, 35, 0x333355)
      .setStrokeStyle(2, 0xffaa00)
      .setInteractive({ useHandCursor: true })
    
    this.add.text(panelX + 50, panelY + 40, "⬇️ Fetch Now", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffaa00"
    }).setOrigin(0.5)

    fetchBtn.on("pointerdown", () => this.fetchRemoteConfig())
    fetchBtn.on("pointerover", () => fetchBtn.setStrokeStyle(3, 0xffffff))
    fetchBtn.on("pointerout", () => fetchBtn.setStrokeStyle(2, 0xffaa00))

    // Clear URL button
    const clearBtn = this.add.rectangle(panelX + 200, panelY + 40, 100, 35, 0x442222)
      .setStrokeStyle(1, 0xff4444)
      .setInteractive({ useHandCursor: true })
    
    this.add.text(panelX + 200, panelY + 40, "Clear", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff4444"
    }).setOrigin(0.5)

    clearBtn.on("pointerdown", () => this.clearRemoteConfigUrl())
  }

  createQuickPublishPanel() {
    const panelX = this.centerX
    const panelY = 340

    // Panel background
    this.add.rectangle(panelX, panelY, 700, 200, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x00ff88)

    this.add.text(panelX, panelY - 85, "OPTION 2: Copy & Paste to Project", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ff88"
    }).setOrigin(0.5)

    this.add.text(panelX, panelY - 65, "Copy the JSON and paste it into public/assets/default-track-assignments.json", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5)

    // Stats display
    const stats = this.getAssignmentStats()
    this.statsText = this.add.text(panelX, panelY - 35, 
      `📊 Current: ${stats.menuCount} menu tracks | ${stats.levelCount} level tracks | ${stats.trackCount} library tracks`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#aaaaaa"
    }).setOrigin(0.5)

    // Copy to clipboard button (BIG)
    const copyBtn = this.add.rectangle(panelX, panelY + 10, 300, 60, 0x1a3a1a)
      .setStrokeStyle(3, 0x00ff88)
      .setInteractive({ useHandCursor: true })
    
    this.add.text(panelX, panelY + 10, "📋 COPY JSON TO CLIPBOARD", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ff88"
    }).setOrigin(0.5)

    copyBtn.on("pointerdown", () => this.copyJsonToClipboard())
    copyBtn.on("pointerover", () => copyBtn.setStrokeStyle(4, 0xffffff))
    copyBtn.on("pointerout", () => copyBtn.setStrokeStyle(3, 0x00ff88))

    // Download button
    const downloadBtn = this.add.rectangle(panelX - 150, panelY + 70, 180, 40, 0x333355)
      .setStrokeStyle(2, 0xffaa00)
      .setInteractive({ useHandCursor: true })
    
    this.add.text(panelX - 150, panelY + 70, "💾 Download JSON", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffaa00"
    }).setOrigin(0.5)

    downloadBtn.on("pointerdown", () => this.downloadJson())

    // Upload to replace
    const uploadBtn = this.add.rectangle(panelX + 150, panelY + 70, 180, 40, 0x333355)
      .setStrokeStyle(2, 0xff69b4)
      .setInteractive({ useHandCursor: true })
    
    this.add.text(panelX + 150, panelY + 70, "📤 Upload JSON", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    uploadBtn.on("pointerdown", () => this.uploadJson())
  }

  createStatusPanel() {
    const panelX = this.centerX
    const panelY = 500

    // Status message
    this.statusText = this.add.text(panelX, panelY, "", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ff88",
      wordWrap: { width: 600 }
    }).setOrigin(0.5)

    // Instructions
    this.add.text(panelX, panelY + 50, "💡 After copying, paste the JSON into public/assets/default-track-assignments.json", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#555555"
    }).setOrigin(0.5)

    this.add.text(panelX, panelY + 70, "Or host the JSON on S3 and use Option 1 for automatic loading", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#555555"
    }).setOrigin(0.5)
  }

  createBackButton() {
    // Back to Track Manager
    const backBtn = this.add.text(30, this.cameras.main.height - 35, "< BACK TO TRACK MANAGER", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setInteractive({ useHandCursor: true })

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.scene.start("TrackUploaderScene")
    })
  }

  setupInput() {
    this.input.keyboard.on("keydown-ESC", () => {
      this.scene.start("TrackUploaderScene")
    })
  }

  // ========== REMOTE CONFIG METHODS ==========

  setRemoteConfigUrl() {
    const currentUrl = localStorage.getItem("tdc_remote_config_url") || ""
    const url = prompt(
      "Enter the URL to your hosted config JSON:\n\n" +
      "Example: https://your-bucket.s3.amazonaws.com/track-config.json\n\n" +
      "This JSON will be fetched on game start for all users.",
      currentUrl || "https://"
    )

    if (!url || url === "https://") return

    localStorage.setItem("tdc_remote_config_url", url)
    this.remoteUrlText.setText(url)
    this.remoteUrlText.setColor("#00ff88")
    
    this.statusText.setText("✓ Remote config URL saved! It will be used on next game start.")
    this.statusText.setColor("#00ff88")
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
  }

  clearRemoteConfigUrl() {
    localStorage.removeItem("tdc_remote_config_url")
    this.remoteUrlText.setText("Not set")
    this.remoteUrlText.setColor("#666666")
    
    this.statusText.setText("Remote config URL cleared")
    this.statusText.setColor("#ffaa00")
  }

  async fetchRemoteConfig() {
    const url = localStorage.getItem("tdc_remote_config_url")
    if (!url) {
      this.statusText.setText("No remote config URL set!")
      this.statusText.setColor("#ff4444")
      return
    }

    this.statusText.setText("⏳ Fetching remote config...")
    this.statusText.setColor("#ffaa00")

    try {
      const response = await fetch(url, { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const config = await response.json()
      this.applyConfig(config)
      
      this.statusText.setText(`✓ Loaded ${this.getConfigItemCount(config)} assignments from remote config!`)
      this.statusText.setColor("#00ff88")
      this.sound.play("ui_confirm_sound", { volume: 0.3 })

      // Update stats
      const stats = this.getAssignmentStats()
      this.statsText.setText(
        `📊 Current: ${stats.menuCount} menu tracks | ${stats.levelCount} level tracks | ${stats.trackCount} library tracks`
      )

    } catch (e) {
      console.error("Failed to fetch remote config:", e)
      this.statusText.setText(`Failed to fetch: ${e.message}`)
      this.statusText.setColor("#ff4444")
    }
  }

  applyConfig(config) {
    // Apply menu music
    if (config.menuMusic) {
      Object.entries(config.menuMusic).forEach(([key, url]) => {
        if (url && !url.startsWith("indexeddb:") && !url.startsWith("blob:")) {
          musicManager.setMenuMusic(key, url)
        }
      })
    }

    // Apply level tracks
    if (config.levelTracks) {
      Object.entries(config.levelTracks).forEach(([trackId, data]) => {
        const url = typeof data === "string" ? data : data?.audioUrl
        if (url && TRACK_DATABASE[trackId]) {
          TRACK_DATABASE[trackId].audioUrl = url
        }
      })
    }

    // Apply track metadata
    if (config.trackMetadata) {
      Object.entries(config.trackMetadata).forEach(([trackId, meta]) => {
        if (TRACK_DATABASE[trackId]) {
          if (meta.title) TRACK_DATABASE[trackId].title = meta.title
          if (meta.artist) TRACK_DATABASE[trackId].artist = meta.artist
          if (meta.genre) TRACK_DATABASE[trackId].genre = meta.genre
          if (meta.duration) TRACK_DATABASE[trackId].duration = meta.duration
        }
      })
    }

    // Save to localStorage so it persists in this browser too
    musicManager.saveMenuMusic()
    musicManager.saveTrackMetadata()
  }

  getConfigItemCount(config) {
    let count = 0
    if (config.menuMusic) {
      count += Object.values(config.menuMusic).filter(v => v).length
    }
    if (config.levelTracks) {
      count += Object.keys(config.levelTracks).length
    }
    return count
  }

  // ========== JSON GENERATION METHODS ==========

  generateConfigJson() {
    const config = {
      version: "1.0.0",
      description: "Track assignments for The Diminished Chord",
      generatedAt: new Date().toISOString(),
      menuMusic: {
        intro: null,
        main_menu: null,
        dev_mode: null,
        music_library: null,
        universe_select: null,
        world_1: null,
        world_2: null,
        world_3: null,
        world_4: null,
        world_5: null,
        world_6: null,
        world_7: null,
        world_8: null,
        world_9: null,
        world_10: null,
        world_11: null,
        world_12: null,
        world_13: null,
        world_14: null,
        world_15: null
      },
      levelTracks: {},
      trackMetadata: {}
    }

    // Export menu music (only valid URLs)
    Object.keys(MENU_KEYS).forEach(keyName => {
      const key = MENU_KEYS[keyName]
      const url = musicManager.getMenuMusicStorageValue(key)
      if (url && !url.startsWith("indexeddb:") && !url.startsWith("blob:")) {
        config.menuMusic[key] = url
      }
    })

    // Export track database entries with URLs
    Object.entries(TRACK_DATABASE).forEach(([trackId, track]) => {
      const hasValidUrl = track.audioUrl && 
        !track.audioUrl.startsWith("blob:") && 
        !track.audioUrl.startsWith("indexeddb:")
      
      if (hasValidUrl) {
        config.levelTracks[trackId] = {
          audioUrl: track.audioUrl
        }
      }

      // Always export metadata if it's been customized
      if (track.title && track.title !== "Untitled Track") {
        config.trackMetadata[trackId] = {
          title: track.title,
          artist: track.artist,
          genre: track.genre,
          duration: track.duration
        }
      }
    })

    return config
  }

  async copyJsonToClipboard() {
    try {
      const config = this.generateConfigJson()
      const jsonString = JSON.stringify(config, null, 2)
      
      await navigator.clipboard.writeText(jsonString)
      
      this.statusText.setText("✓ JSON copied to clipboard! Paste into default-track-assignments.json")
      this.statusText.setColor("#00ff88")
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
    } catch (e) {
      console.error("Copy failed:", e)
      this.statusText.setText("Copy failed - try the Download button instead")
      this.statusText.setColor("#ff4444")
    }
  }

  downloadJson() {
    try {
      const config = this.generateConfigJson()
      const jsonString = JSON.stringify(config, null, 2)
      
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "default-track-assignments.json"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      this.statusText.setText("✓ Downloaded! Copy to public/assets/default-track-assignments.json")
      this.statusText.setColor("#00ff88")
    } catch (e) {
      this.statusText.setText("Download failed!")
      this.statusText.setColor("#ff4444")
    }
  }

  uploadJson() {
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = ".json"
    fileInput.style.display = "none"
    document.body.appendChild(fileInput)

    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files[0]
      if (!file) return

      try {
        const text = await file.text()
        const config = JSON.parse(text)
        
        this.applyConfig(config)
        
        const count = this.getConfigItemCount(config)
        this.statusText.setText(`✓ Applied ${count} assignments from uploaded JSON!`)
        this.statusText.setColor("#00ff88")
        this.sound.play("ui_confirm_sound", { volume: 0.3 })

        // Update stats
        const stats = this.getAssignmentStats()
        this.statsText.setText(
          `📊 Current: ${stats.menuCount} menu tracks | ${stats.levelCount} level tracks | ${stats.trackCount} library tracks`
        )

      } catch (e) {
        this.statusText.setText("Failed to parse JSON file!")
        this.statusText.setColor("#ff4444")
      }

      document.body.removeChild(fileInput)
    })

    fileInput.click()
  }

  getAssignmentStats() {
    let menuCount = 0
    let levelCount = 0
    let trackCount = 0

    // Count menu music
    Object.keys(MENU_KEYS).forEach(keyName => {
      const key = MENU_KEYS[keyName]
      const url = musicManager.getMenuMusicStorageValue(key)
      if (url && !url.startsWith("indexeddb:") && !url.startsWith("blob:")) {
        menuCount++
      }
    })

    // Count level tracks
    Object.entries(LEVEL_TRACKS).forEach(([_, data]) => {
      if (data && data.audioUrl) {
        levelCount++
      }
    })

    // Count library tracks with URLs
    Object.entries(TRACK_DATABASE).forEach(([_, track]) => {
      if (track.audioUrl && !track.audioUrl.startsWith("blob:") && !track.audioUrl.startsWith("indexeddb:")) {
        trackCount++
      }
    })

    return { menuCount, levelCount, trackCount }
  }
}
