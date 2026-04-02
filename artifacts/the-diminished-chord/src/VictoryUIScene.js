import Phaser from "phaser"
import { LevelManager } from "./LevelManager.js"
import { BGMManager } from "./BGMManager.js"
import { AdSkipManager } from "./AdSkipManager.js"
import { LevelSessionManager } from "./DynamicLevelScene.js"
import { LeaderboardManager } from "./LeaderboardManager.js"
import { parseLevelId } from "./WorldManager.js"
import gameConfig from "./gameConfig.json"

/**
 * VictoryUIScene - Level complete screen
 * Shows stats, track unlock status, audio player for level music, and next level option
 * 
 * Features:
 * - Level completion stats
 * - Track unlock and audio player
 * - World Menu navigation
 * - Embedded leaderboards
 * - Ghost run playback (death montage)
 * - Music sharing/streaming links
 */
export class VictoryUIScene extends Phaser.Scene {
  constructor() {
    super({ key: "VictoryUIScene" })
  }

  init(data) {
    this.currentLevelKey = data.currentLevelKey
    this.completionTime = data.completionTime || 0
    this.completionTimeMs = data.completionTimeMs || (this.completionTime * 1000)
    this.deathCount = data.deathCount || 0
    this.allFragments = data.allFragments || false
    this.unlockedTrack = data.unlockedTrack || null
    this.levelTrack = data.levelTrack || null
    
    // For dynamic levels, store level ID and next level ID
    this.levelId = data.levelId || null
    this.nextLevelId = data.nextLevelId || null
    this.isDynamicLevel = this.currentLevelKey === "DynamicLevelScene"
    
    // Store collected/total counts for detailed display
    this.collectedCount = data.collectedCount !== undefined ? data.collectedCount : 0
    this.totalCollectibles = data.totalCollectibles !== undefined ? data.totalCollectibles : 0
    
    // Receive BGM reference from level scene (continues playing)
    this.levelBgm = data.levelBgm || null
    this.isPlaying = this.levelBgm && this.levelBgm.isPlaying
    this.userTookControl = false // Track if user has interacted with audio controls

    // Ghost run data for replay - includes ALL attempts (deaths + successful run)
    this.ghostRunData = data.ghostRunData || null
    this.deathReplays = data.deathReplays || []
    // The final successful run's positions (always present after level completion)
    this.successfulRunPositions = data.successfulRunPositions || []
    
    console.log("[VictoryUIScene] Received ghost data:")
    console.log("  - deathReplays:", this.deathReplays?.length || 0)
    console.log("  - successfulRunPositions:", this.successfulRunPositions)
    console.log("  - successfulRunPositions.positions:", this.successfulRunPositions?.positions?.length || 0)

    // Check and award achievements
    this.achievements = AdSkipManager.checkAndAwardAchievements(
      this.currentLevelKey,
      this.deathCount,
      this.completionTime
    )

    // UI state
    this.showingLeaderboard = false
    this.showingGhostReplay = false
    
    // Leaderboard submission result (populated after auto-submit)
    this.leaderboardSubmitResult = null
  }

  async create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Duck the background music volume by 20% for the victory screen
    BGMManager.duckVolume()

    // Semi-transparent overlay
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.8
    )
    overlay.setOrigin(0, 0)

    // Victory text
    const victoryText = this.add.text(centerX, 60, "LEVEL COMPLETE!", {
      fontFamily: "RetroPixel",
      fontSize: "42px",
      color: "#00ff88"
    }).setOrigin(0.5)

    // Animate victory text
    this.tweens.add({
      targets: victoryText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 500,
      yoyo: true,
      repeat: -1
    })

    // Auto-submit to leaderboard (async, but don't block UI)
    this.autoSubmitToLeaderboard()

    // Stats panel
    this.createStatsPanel(centerX, 170)

    // Track status and audio player (compact)
    this.createTrackStatus(centerX, 295)

    // Feature buttons row (Leaderboard, Ghost Replay, Go to Song)
    this.createFeatureButtons(centerX, 390)

    // Navigation buttons
    this.createButtons(centerX, 500)

    // Setup input
    this.setupInput()
  }

  /**
   * Auto-submit the run to leaderboard
   * This ensures the player's time is recorded and available in the leaderboard view
   */
  async autoSubmitToLeaderboard() {
    const levelId = this.levelId || this.currentLevelKey
    
    try {
      const result = await LeaderboardManager.submitTime(levelId, {
        timeMs: this.completionTimeMs,
        deaths: this.deathCount,
        fragmentsCollected: this.collectedCount,
        allFragmentsCollected: this.allFragments,
        ghostData: this.ghostRunData
      })
      
      this.leaderboardSubmitResult = result
      
      if (result.success) {
        console.log("[VictoryUIScene] Auto-submitted to leaderboard:", {
          isPersonalBest: result.isPersonalBest,
          rank: result.rank,
          category: result.runCategory
        })
      }
    } catch (e) {
      console.warn("[VictoryUIScene] Failed to auto-submit to leaderboard:", e)
    }
  }

  createStatsPanel(x, y) {
    // Calculate panel height based on achievements and track unlock
    const hasAchievements = this.achievements.newHoleInOne || this.achievements.newSpeedrun
    const hasTrackUnlock = this.allFragments
    let panelHeight = 130 // Base height for stats
    if (hasAchievements) panelHeight += 50
    if (hasTrackUnlock) panelHeight += 28

    const panel = this.add.rectangle(x, y, 500, panelHeight, 0x1a1a2e, 0.9)
    panel.setStrokeStyle(2, 0x00ff88)

    const topY = y - panelHeight / 2 + 20
    const lineSpacing = 28

    // Time - show milliseconds for precision (own line)
    const timeStr = this.formatTime(this.completionTimeMs)
    
    // Show speedrun target comparison
    const targetTime = AdSkipManager.getSpeedrunTarget(this.currentLevelKey)
    let timeColor = "#ffffff"
    let timeExtra = ""
    if (targetTime) {
      const targetMs = targetTime * 1000
      if (this.completionTimeMs <= targetMs) {
        timeColor = "#00ff88"
        timeExtra = ` ⚡`
      }
    }

    this.add.text(x, topY, `Time: ${timeStr}${timeExtra}`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: timeColor
    }).setOrigin(0.5)

    // Deaths (own line)
    const deathColor = this.deathCount === 0 ? "#00ff88" : "#ff6666"
    const deathExtra = this.deathCount === 0 ? " 🏆 FLAWLESS!" : ""
    this.add.text(x, topY + lineSpacing, `Deaths: ${this.deathCount}${deathExtra}`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: deathColor
    }).setOrigin(0.5)

    // Fragments (own line)
    const fragmentColor = this.allFragments ? "#00ff88" : "#ffaa00"
    let fragmentText = this.allFragments ? "100% Complete!" : `${this.collectedCount}/${this.totalCollectibles}`
    
    this.add.text(x, topY + lineSpacing * 2, `Fragments: ${fragmentText}`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: fragmentColor
    }).setOrigin(0.5)

    let currentY = topY + lineSpacing * 3

    // Track Unlocked notification (only if 100% fragments)
    if (hasTrackUnlock) {
      this.add.text(x, currentY, "🎵 Track Unlocked In Your Library!", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ff69b4"
      }).setOrigin(0.5)
      currentY += lineSpacing
    }

    // Achievement rewards
    if (hasAchievements) {
      this.add.rectangle(x, currentY, 450, 2, 0x444466)
      currentY += 18

      if (this.achievements.newHoleInOne) {
        this.add.text(x, currentY, "🏆 FIRST TRY! +1 Ad-Skip Credit", {
          fontFamily: "RetroPixel",
          fontSize: "13px",
          color: "#ffff00"
        }).setOrigin(0.5)
        currentY += 22
      }
      if (this.achievements.newSpeedrun) {
        this.add.text(x, currentY, "⚡ SPEEDRUN! +1 Ad-Skip Credit", {
          fontFamily: "RetroPixel",
          fontSize: "13px",
          color: "#ffff00"
        }).setOrigin(0.5)
      }
    }
  }

  createTrackStatus(x, y) {
    const hasAudio = this.levelTrack && this.levelTrack.audioUrl
    
    if (this.allFragments && this.unlockedTrack) {
      // Track unlocked!
      const panel = this.add.rectangle(x, y, 500, 70, 0x2d1b4e, 0.9)
      panel.setStrokeStyle(2, 0xff69b4)

      this.add.text(x - 180, y, "🎵 TRACK UNLOCKED!", {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#ff69b4"
      }).setOrigin(0, 0.5)

      this.add.text(x + 20, y - 10, `"${this.unlockedTrack.title}"`, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ffffff"
      }).setOrigin(0, 0.5)

      if (this.levelTrack) {
        this.add.text(x + 20, y + 12, `${this.levelTrack.artist || "The Diminished Chord"}`, {
          fontFamily: "RetroPixel",
          fontSize: "11px",
          color: "#aaaaaa"
        }).setOrigin(0, 0.5)
      }

      // Mini audio controls
      if (hasAudio) {
        this.createMiniAudioPlayer(x + 200, y)
      }

      this.sound.play("track_unlock_sound", { volume: 0.5 })
      
    } else if (hasAudio) {
      // Now playing (not unlocked)
      const panel = this.add.rectangle(x, y, 500, 60, 0x1a2a3e, 0.9)
      panel.setStrokeStyle(2, 0x00ffff)

      this.add.text(x - 180, y, "🎵 NOW PLAYING", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#00ffff"
      }).setOrigin(0, 0.5)

      this.add.text(x + 20, y, `"${this.levelTrack.title}"`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ffffff"
      }).setOrigin(0, 0.5)

      this.createMiniAudioPlayer(x + 200, y)
    }
  }

  createMiniAudioPlayer(x, y) {
    // Compact audio controls
    const playBtn = this.add.text(x, y, this.isPlaying ? "⏸" : "▶", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ff88"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    playBtn.on("pointerdown", () => {
      if (this.isPlaying) {
        this.pauseTrack()
        playBtn.setText("▶")
      } else {
        this.playTrack()
        playBtn.setText("⏸")
      }
    })

    const stopBtn = this.add.text(x + 35, y, "◼", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff4444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    stopBtn.on("pointerdown", () => {
      this.stopTrack()
      playBtn.setText("▶")
    })

    this.playBtnRef = playBtn
  }

  createFeatureButtons(x, y) {
    // If track is unlocked (100% fragments), show 3 buttons. Otherwise just 2.
    const showSongButton = this.allFragments
    const spacing = showSongButton ? 175 : 140

    // Initialize feature buttons array for keyboard navigation
    this.featureButtons = []

    // Leaderboard button
    this.leaderboardBtn = this.createFeatureButton(
      showSongButton ? x - spacing : x - spacing/2, 
      y, 
      "🏆 LEADERBOARD", 
      0x00ffff, 
      () => this.toggleLeaderboard()
    )
    this.featureButtons.push(this.leaderboardBtn)

    // Ghost Replay button - replays ALL attempts (deaths + successful run) simultaneously
    this.replayBtn = this.createFeatureButton(
      showSongButton ? x : x + spacing/2, 
      y, 
      "👻 GHOST REPLAY", 
      0xff69b4, 
      () => this.showGhostReplay()
    )
    this.featureButtons.push(this.replayBtn)

    // Go to Song button - ONLY shows if track is unlocked via 100% fragments
    if (showSongButton) {
      this.musicLinksBtn = this.createFeatureButton(
        x + spacing, 
        y, 
        "🎵 GO TO SONG", 
        0x1db954, 
        () => this.showMusicLinks()
      )
      this.featureButtons.push(this.musicLinksBtn)
    }
    
    // Track which row is currently selected (0 = feature buttons, 1 = main buttons row 1, 2 = main buttons row 2)
    this.selectedRow = 1 // Start with main buttons selected
    this.selectedFeatureIndex = 0
  }

  createFeatureButton(x, y, label, color, callback) {
    const container = this.add.container(x, y)

    // Wider buttons to fit text properly
    const bg = this.add.rectangle(0, 0, 160, 45, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, color)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.on("pointerover", () => {
      // Update selection state when hovering
      const featureIndex = this.featureButtons?.indexOf(container)
      if (featureIndex !== undefined && featureIndex >= 0) {
        this.selectedRow = 0
        this.selectedFeatureIndex = featureIndex
        this.updateAllSelections()
      }
      bg.setStrokeStyle(3, 0xffffff)
      text.setColor("#ffffff")
    })
    bg.on("pointerout", () => {
      // Only reset visual if not currently selected
      const featureIndex = this.featureButtons?.indexOf(container)
      if (this.selectedRow !== 0 || this.selectedFeatureIndex !== featureIndex) {
        bg.setStrokeStyle(2, color)
        text.setColor(Phaser.Display.Color.IntegerToColor(color).rgba)
      }
    })
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      callback()
    })
    
    // Store properties for selection state management
    container.bg = bg
    container.label = text
    container.color = color
    container.callback = callback

    return container
  }
  
  /**
   * Update all button selections (feature buttons + main buttons)
   */
  updateAllSelections() {
    // Update feature buttons
    if (this.featureButtons) {
      this.featureButtons.forEach((btn, index) => {
        if (this.selectedRow === 0 && index === this.selectedFeatureIndex) {
          btn.bg.setStrokeStyle(3, 0xffffff)
          btn.label.setColor("#ffffff")
          btn.setScale(1.05)
        } else {
          btn.bg.setStrokeStyle(2, btn.color)
          btn.label.setColor(Phaser.Display.Color.IntegerToColor(btn.color).rgba)
          btn.setScale(1)
        }
      })
    }
    
    // Update main navigation buttons
    if (this.buttons) {
      this.buttons.forEach((button, index) => {
        const isMainSelected = this.selectedRow > 0 && index === this.selectedButtonIndex
        if (isMainSelected) {
          button.bg.setStrokeStyle(3, 0xffffff)
          button.label.setColor("#ffffff")
          button.setScale(1.05)
        } else {
          button.bg.setStrokeStyle(2, button.color)
          button.label.setColor(Phaser.Display.Color.IntegerToColor(button.color).rgba)
          button.setScale(1)
        }
      })
    }
  }

  toggleLeaderboard() {
    if (this.showingLeaderboard) {
      this.hideLeaderboard()
    } else {
      this.showLeaderboard()
    }
  }

  async showLeaderboard(preserveCategory = false) {
    this.showingLeaderboard = true
    
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Create leaderboard overlay
    this.leaderboardContainer = this.add.container(centerX, centerY).setDepth(100)

    const bg = this.add.rectangle(0, 0, 550, 450, 0x0a0a1a, 0.98)
      .setStrokeStyle(3, 0x00ffff)
    this.leaderboardContainer.add(bg)

    const title = this.add.text(0, -200, "🏆 LEADERBOARD", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ffff"
    }).setOrigin(0.5)
    this.leaderboardContainer.add(title)

    // Category tabs - only set default if not preserving category selection
    if (!preserveCategory || !this.leaderboardCategory) {
      this.leaderboardCategory = "any"
    }
    const anyTab = this.createCategoryTab(-80, -165, "ANY%", "any")
    const tab100 = this.createCategoryTab(80, -165, "100%", "100")
    this.leaderboardContainer.add([anyTab, tab100])

    // Loading indicator
    const loadingText = this.add.text(0, 0, "Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5)
    this.leaderboardContainer.add(loadingText)

    // Close button
    const closeBtn = this.add.text(250, -200, "✕", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff4444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    closeBtn.on("pointerdown", () => this.hideLeaderboard())
    this.leaderboardContainer.add(closeBtn)

    // Fetch leaderboard data
    await this.loadLeaderboardData(loadingText)
  }

  createCategoryTab(x, y, label, category) {
    const isActive = this.leaderboardCategory === category
    const tab = this.add.text(x, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: isActive ? "#00ffff" : "#666666",
      backgroundColor: isActive ? "#1a2a3e" : "#0a0a1a",
      padding: { x: 15, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    tab.on("pointerdown", async () => {
      if (this.leaderboardCategory !== category) {
        this.leaderboardCategory = category
        // Refresh leaderboard, preserving category selection
        this.hideLeaderboard()
        await this.showLeaderboard(true)
      }
    })

    return tab
  }

  async loadLeaderboardData(loadingText) {
    try {
      const levelId = this.levelId || this.currentLevelKey
      let entries = await LeaderboardManager.getLeaderboard(levelId, 20, this.leaderboardCategory)
      
      loadingText.destroy()

      // If no entries but we just submitted a time, create a temporary display entry
      // This ensures the player sees their time even if leaderboard cache hasn't updated
      if (entries.length === 0 && this.leaderboardSubmitResult?.success) {
        const currentUserId = this.registry.get("userId")
        const profile = this.registry.get("userProfile")
        
        // Check if this run matches the current category
        const runCategory = this.allFragments ? '100' : 'any'
        if (runCategory === this.leaderboardCategory || this.leaderboardCategory === 'any') {
          entries = [{
            rank: 1,
            userId: currentUserId,
            displayName: profile?.displayName || profile?.username || "You",
            timeMs: this.completionTimeMs,
            deaths: this.deathCount,
            fragmentsCollected: this.collectedCount,
            isCurrentRun: true
          }]
        }
      }

      if (entries.length === 0) {
        const noDataText = this.add.text(0, 0, "No records yet!\nBe the first to set a time.", {
          fontFamily: "RetroPixel",
          fontSize: "16px",
          color: "#666666",
          align: "center"
        }).setOrigin(0.5)
        this.leaderboardContainer.add(noDataText)
        return
      }

      // Header row
      const headerY = -130
      this.add.text(-230, headerY, "RANK", { fontFamily: "RetroPixel", fontSize: "12px", color: "#888888" })
        .setOrigin(0, 0.5)
      this.leaderboardContainer.add(this.children.list[this.children.list.length - 1])
      
      this.add.text(-150, headerY, "PLAYER", { fontFamily: "RetroPixel", fontSize: "12px", color: "#888888" })
        .setOrigin(0, 0.5)
      this.leaderboardContainer.add(this.children.list[this.children.list.length - 1])
      
      this.add.text(100, headerY, "TIME", { fontFamily: "RetroPixel", fontSize: "12px", color: "#888888" })
        .setOrigin(0.5, 0.5)
      this.leaderboardContainer.add(this.children.list[this.children.list.length - 1])
      
      this.add.text(200, headerY, "DEATHS", { fontFamily: "RetroPixel", fontSize: "12px", color: "#888888" })
        .setOrigin(0.5, 0.5)
      this.leaderboardContainer.add(this.children.list[this.children.list.length - 1])

      // Leaderboard entries
      entries.slice(0, 10).forEach((entry, index) => {
        const rowY = -95 + index * 28
        const isCurrentUser = entry.userId === (this.registry.get("userId") || null)
        const isCurrentRun = entry.isCurrentRun || false
        // Highlight current run in gold, current user in green, others white
        const rowColor = isCurrentRun ? "#ffff00" : (isCurrentUser ? "#00ff88" : "#ffffff")
        
        // Rank with medal for top 3
        let rankText = `${entry.rank || index + 1}`
        if (entry.rank === 1) rankText = "🥇"
        else if (entry.rank === 2) rankText = "🥈"
        else if (entry.rank === 3) rankText = "🥉"
        
        this.add.text(-230, rowY, rankText, { fontFamily: "RetroPixel", fontSize: "12px", color: rowColor })
          .setOrigin(0, 0.5)
        this.leaderboardContainer.add(this.children.list[this.children.list.length - 1])
        
        const playerName = entry.displayName || entry.username || "Anonymous"
        const nameText = this.add.text(-150, rowY, playerName.substring(0, 15), { 
          fontFamily: "RetroPixel", 
          fontSize: "12px", 
          color: rowColor 
        }).setOrigin(0, 0.5)
          .setInteractive({ useHandCursor: true })
        
        // Add hover events for player profile preview
        nameText.on("pointerover", () => {
          nameText.setColor("#ff69b4")
          this.showPlayerProfilePreview(entry, -150, rowY)
        })
        nameText.on("pointerout", () => {
          nameText.setColor(rowColor)
          this.hidePlayerProfilePreview()
        })
        this.leaderboardContainer.add(nameText)
        
        this.add.text(100, rowY, this.formatTime(entry.timeMs), { fontFamily: "RetroPixel", fontSize: "12px", color: rowColor })
          .setOrigin(0.5, 0.5)
        this.leaderboardContainer.add(this.children.list[this.children.list.length - 1])
        
        this.add.text(200, rowY, `${entry.deaths || 0}`, { fontFamily: "RetroPixel", fontSize: "12px", color: rowColor })
          .setOrigin(0.5, 0.5)
        this.leaderboardContainer.add(this.children.list[this.children.list.length - 1])
      })

      // Your rank (if not in top 10)
      const currentUserId = this.registry.get("userId")
      if (currentUserId) {
        const yourEntry = entries.find(e => e.userId === currentUserId)
        if (yourEntry && yourEntry.rank > 10) {
          this.add.text(0, 160, `Your Rank: #${yourEntry.rank} - ${this.formatTime(yourEntry.timeMs)}`, {
            fontFamily: "RetroPixel",
            fontSize: "14px",
            color: "#00ff88"
          }).setOrigin(0.5)
          this.leaderboardContainer.add(this.children.list[this.children.list.length - 1])
        }
      }

    } catch (error) {
      loadingText.setText("Failed to load leaderboard")
      loadingText.setColor("#ff4444")
      console.error("[VictoryUIScene] Leaderboard error:", error)
    }
  }

  hideLeaderboard() {
    this.showingLeaderboard = false
    this.hidePlayerProfilePreview()
    if (this.leaderboardContainer) {
      this.leaderboardContainer.destroy()
      this.leaderboardContainer = null
    }
  }

  /**
   * Show a small profile preview card on player name hover
   */
  showPlayerProfilePreview(entry, nameX, rowY) {
    // Hide any existing preview
    this.hidePlayerProfilePreview()

    // Create profile preview container (positioned relative to leaderboard container)
    this.profilePreview = this.add.container(nameX + 140, rowY)
    this.profilePreview.setDepth(101)
    this.leaderboardContainer.add(this.profilePreview)

    // Background
    const bg = this.add.rectangle(0, 0, 220, 130, 0x1a1a2e, 0.98)
      .setStrokeStyle(2, 0xff69b4)
    this.profilePreview.add(bg)

    // Full player name (not truncated)
    const fullName = entry.displayName || entry.username || "Anonymous"
    const nameText = this.add.text(0, -45, fullName, {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#ffffff"
    }).setOrigin(0.5)
    this.profilePreview.add(nameText)

    // Avatar placeholder (circle)
    const avatarBg = this.add.circle(-75, 0, 25, 0x333355)
    avatarBg.setStrokeStyle(2, 0x444477)
    this.profilePreview.add(avatarBg)

    // Avatar icon (or image if available)
    if (entry.avatarUrl) {
      // TODO: Load actual avatar image
      const avatarIcon = this.add.text(-75, 0, "👤", { fontSize: "22px" }).setOrigin(0.5)
      this.profilePreview.add(avatarIcon)
    } else {
      const avatarIcon = this.add.text(-75, 0, "👤", { fontSize: "22px" }).setOrigin(0.5)
      this.profilePreview.add(avatarIcon)
    }

    // Stats section
    const statsX = 15
    
    // Levels completed (placeholder - would need to fetch from profiles table)
    const levelsText = this.add.text(statsX, -10, "🎮 Levels: ?", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    }).setOrigin(0, 0.5)
    this.profilePreview.add(levelsText)

    // Medals earned (placeholder)
    const medalsText = this.add.text(statsX, 10, "🏆 Medals: ?", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    }).setOrigin(0, 0.5)
    this.profilePreview.add(medalsText)

    // This run's time
    const timeText = this.add.text(statsX, 30, `⏱ ${this.formatTime(entry.timeMs)}`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#00ff88"
    }).setOrigin(0, 0.5)
    this.profilePreview.add(timeText)

    // Rank badge
    let rankEmoji = ""
    if (entry.rank === 1) rankEmoji = "🥇"
    else if (entry.rank === 2) rankEmoji = "🥈"  
    else if (entry.rank === 3) rankEmoji = "🥉"
    else rankEmoji = `#${entry.rank}`

    const rankText = this.add.text(0, 50, `Rank: ${rankEmoji}`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: entry.rank <= 3 ? "#ffd700" : "#aaaaaa"
    }).setOrigin(0.5)
    this.profilePreview.add(rankText)
  }

  /**
   * Hide player profile preview
   */
  hidePlayerProfilePreview() {
    if (this.profilePreview) {
      this.profilePreview.destroy()
      this.profilePreview = null
    }
  }

  showGhostReplay() {
    // Ghost Replay - replay ALL attempts simultaneously (deaths + final successful run)
    // All ghosts start from the same spawn point, diverge during play,
    // failed attempts disappear at their death points, leaving only the winner
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Create replay panel
    this.replayContainer = this.add.container(centerX, centerY).setDepth(100)

    const bg = this.add.rectangle(0, 0, 500, 380, 0x0a0a1a, 0.98)
      .setStrokeStyle(3, 0xff69b4)
    this.replayContainer.add(bg)

    const title = this.add.text(0, -165, "👻 GHOST REPLAY", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.replayContainer.add(title)

    // Total attempts info (deaths + 1 successful run)
    const totalAttempts = this.deathCount + 1
    const attemptInfo = this.add.text(0, -130, `${totalAttempts} attempt${totalAttempts > 1 ? 's' : ''} recorded`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5)
    this.replayContainer.add(attemptInfo)

    // Feature description - always show since we always have at least 1 run
    let descText
    if (this.deathCount === 0) {
      descText = this.add.text(0, -70, "🏆 PERFECT RUN!\n\nWatch your flawless victory replay.", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#00ff88",
        align: "center"
      }).setOrigin(0.5)
    } else {
      descText = this.add.text(0, -70, "Watch all your attempts play back simultaneously!\nAll ghosts start together - failed ones fade away\nat their death points until only the winner remains.", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#aaaaaa",
        align: "center"
      }).setOrigin(0.5)
    }
    this.replayContainer.add(descText)

    // Play replay button - always available (wider to fit text)
    const playBtn = this.add.rectangle(0, 20, 250, 55, 0xff69b4, 0.9)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true })
    this.replayContainer.add(playBtn)

    const playText = this.add.text(0, 20, "▶ PLAY GHOST REPLAY", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)
    this.replayContainer.add(playText)

    playBtn.on("pointerover", () => playBtn.setStrokeStyle(3, 0xffff00))
    playBtn.on("pointerout", () => playBtn.setStrokeStyle(2, 0xffffff))
    playBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.launchGhostReplayScene()
    })

    // Stats summary
    const statsText = this.add.text(0, 85, `Deaths: ${this.deathCount} | Time: ${this.formatTime(this.completionTimeMs)}`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    }).setOrigin(0.5)
    this.replayContainer.add(statsText)

    // Save/Share options
    const shareLabel = this.add.text(0, 120, "─── SHARE OPTIONS ───", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#444444"
    }).setOrigin(0.5)
    this.replayContainer.add(shareLabel)

    const saveBtn = this.createSmallButton(-70, 155, "💾 SAVE", () => {
      this.saveGhostReplay()
    })
    this.replayContainer.add(saveBtn)

    const shareBtn = this.createSmallButton(70, 155, "📤 SHARE", () => {
      this.shareGhostReplay()
    })
    this.replayContainer.add(shareBtn)

    // Close button
    const closeBtn = this.add.text(225, -165, "✕", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff4444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    closeBtn.on("pointerdown", () => {
      this.replayContainer.destroy()
      this.replayContainer = null
    })
    this.replayContainer.add(closeBtn)
  }

  /**
   * Launch the actual ghost replay - restarts the level in replay mode
   * This reuses the same level scene that was just played, ensuring correct visuals
   */
  launchGhostReplayScene() {
    // Close the replay panel
    if (this.replayContainer) {
      this.replayContainer.destroy()
      this.replayContainer = null
    }

    // Check if we have ghost data to replay
    const hasDeathData = this.deathReplays && this.deathReplays.length > 0
    const hasSuccessData = this.successfulRunPositions && 
      (this.successfulRunPositions.positions?.length > 0 || this.successfulRunPositions.length > 0)
    
    if (!hasDeathData && !hasSuccessData) {
      this.showToast("No ghost data recorded for this run")
      return
    }

    // Store replay data in registry for the level scene to use
    console.log("[VictoryUIScene] Launching ghost replay with data:")
    console.log("  - deathReplays:", this.deathReplays?.length || 0)
    console.log("  - successfulRunPositions:", this.successfulRunPositions)
    
    this.registry.set("ghostReplayMode", {
      enabled: true,
      levelId: this.levelId || this.currentLevelKey,
      deathReplays: this.deathReplays || [],
      successfulRun: this.successfulRunPositions,
      completionTimeMs: this.completionTimeMs,
      returnData: {
        currentLevelKey: this.currentLevelKey,
        levelId: this.levelId,
        completionTimeMs: this.completionTimeMs,
        deathCount: this.deathCount,
        allFragments: this.allFragments,
        collectedCount: this.collectedCount,
        totalCollectibles: this.totalCollectibles,
        unlockedTrack: this.unlockedTrack,
        levelTrack: this.levelTrack,
        deathReplays: this.deathReplays,
        successfulRunPositions: this.successfulRunPositions
      }
    })

    // Stop this scene and restart the level in replay mode
    // Using DynamicLevelScene ensures the same level with same visuals
    // Note: this.scene.start() automatically stops the current scene (VictoryUIScene)
    // but we also need to stop UIScene if it's running
    if (this.scene.isActive("UIScene")) {
      this.scene.stop("UIScene")
    }
    
    console.log("[VictoryUIScene] Starting DynamicLevelScene in replay mode")
    
    this.scene.start("DynamicLevelScene", {
      levelId: this.levelId || this.currentLevelKey,
      freshStart: true, // Fresh start to reset state
      replayMode: true  // Signal to enter replay mode
    })
  }

  createSmallButton(x, y, label, callback) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 100, 35, 0x222244, 0.9)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#aaaaaa"
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.on("pointerover", () => {
      bg.setStrokeStyle(2, 0x00ffff)
      text.setColor("#ffffff")
    })
    bg.on("pointerout", () => {
      bg.setStrokeStyle(2, 0x666666)
      text.setColor("#aaaaaa")
    })
    bg.on("pointerdown", callback)

    return container
  }

  saveGhostReplay() {
    this.showComingSoonMessage("Save Replay")
  }

  shareGhostReplay() {
    this.showComingSoonMessage("Share Replay")
  }

  showMusicLinks() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Create "Go to Song" panel - focus on the unlocked track
    this.musicLinksContainer = this.add.container(centerX, centerY).setDepth(100)

    const bg = this.add.rectangle(0, 0, 480, 420, 0x0a0a1a, 0.98)
      .setStrokeStyle(3, 0x1db954)
    this.musicLinksContainer.add(bg)

    const title = this.add.text(0, -185, "🎵 GO TO SONG", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#1db954"
    }).setOrigin(0.5)
    this.musicLinksContainer.add(title)

    // Primary feature: The unlocked track from completing this level
    if (this.allFragments && this.unlockedTrack) {
      // Track unlocked celebration
      const unlockedLabel = this.add.text(0, -145, "✨ TRACK UNLOCKED! ✨", {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#ffff00"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(unlockedLabel)

      const trackTitle = this.add.text(0, -115, `"${this.unlockedTrack.title || this.levelTrack?.title || "Level Track"}"`, {
        fontFamily: "RetroPixel",
        fontSize: "18px",
        color: "#ffffff"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(trackTitle)

      const artistText = this.add.text(0, -90, `by ${this.levelTrack?.artist || "The Diminished Chord"}`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(artistText)

      const addedText = this.add.text(0, -65, "Added to your Music Library!", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#00ff88"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(addedText)

      // Play button - play the track right here
      const playBtn = this.add.rectangle(0, -25, 180, 45, 0x1db954, 0.9)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true })
      this.musicLinksContainer.add(playBtn)

      const playText = this.add.text(0, -25, this.isPlaying ? "⏸ PAUSE" : "▶ PLAY NOW", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ffffff"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(playText)

      playBtn.on("pointerover", () => playBtn.setStrokeStyle(3, 0xffff00))
      playBtn.on("pointerout", () => playBtn.setStrokeStyle(2, 0xffffff))
      playBtn.on("pointerdown", () => {
        this.togglePlayPause()
        playText.setText(this.isPlaying ? "⏸ PAUSE" : "▶ PLAY NOW")
      })

    } else if (this.levelTrack) {
      // Track not unlocked yet (didn't collect all fragments)
      const trackTitle = this.add.text(0, -130, `"${this.levelTrack.title || "Level Track"}"`, {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#ffffff"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(trackTitle)

      const artistText = this.add.text(0, -105, `by ${this.levelTrack.artist || "The Diminished Chord"}`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(artistText)

      const lockedText = this.add.text(0, -75, "🔒 Collect all fragments to unlock!", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#ffaa00"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(lockedText)
    } else {
      // No track info available
      const noTrackText = this.add.text(0, -100, "No track associated with this level", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#666666"
      }).setOrigin(0.5)
      this.musicLinksContainer.add(noTrackText)
    }

    // Separator
    const separator = this.add.text(0, 25, "─── STREAM & DOWNLOAD ───", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#444444"
    }).setOrigin(0.5)
    this.musicLinksContainer.add(separator)

    // Streaming service buttons (more compact layout)
    const services = [
      { name: "Spotify", color: 0x1db954, icon: "🎵", url: this.levelTrack?.spotifyUrl },
      { name: "Apple Music", color: 0xfc3c44, icon: "🍎", url: this.levelTrack?.appleMusicUrl },
      { name: "YouTube", color: 0xff0000, icon: "▶️", url: this.levelTrack?.youtubeUrl },
      { name: "SoundCloud", color: 0xff5500, icon: "☁️", url: this.levelTrack?.soundcloudUrl }
    ]

    // 2x2 grid layout for service buttons
    services.forEach((service, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const btnX = -100 + col * 200
      const btnY = 65 + row * 45
      const btn = this.createMusicServiceButton(btnX, btnY, service, true) // compact mode
      this.musicLinksContainer.add(btn)
    })

    // Share the track button
    const shareBtn = this.add.rectangle(0, 175, 180, 38, 0x333366, 0.9)
      .setStrokeStyle(2, 0x6666ff)
      .setInteractive({ useHandCursor: true })
    this.musicLinksContainer.add(shareBtn)

    const shareText = this.add.text(0, 175, "📤 SHARE TRACK", {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#6666ff"
    }).setOrigin(0.5)
    this.musicLinksContainer.add(shareText)

    shareBtn.on("pointerover", () => shareBtn.setStrokeStyle(2, 0xffffff))
    shareBtn.on("pointerout", () => shareBtn.setStrokeStyle(2, 0x6666ff))
    shareBtn.on("pointerdown", () => this.shareTrackLink())

    // Close button
    const closeBtn = this.add.text(215, -185, "✕", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff4444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    closeBtn.on("pointerdown", () => {
      this.musicLinksContainer.destroy()
      this.musicLinksContainer = null
    })
    this.musicLinksContainer.add(closeBtn)
  }

  createMusicServiceButton(x, y, service, compact = false) {
    const container = this.add.container(x, y)

    const btnWidth = compact ? 180 : 300
    const btnHeight = compact ? 35 : 40
    const fontSize = compact ? "12px" : "14px"

    const bg = this.add.rectangle(0, 0, btnWidth, btnHeight, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, service.color)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(0, 0, `${service.icon} ${service.name}`, {
      fontFamily: "RetroPixel",
      fontSize: fontSize,
      color: Phaser.Display.Color.IntegerToColor(service.color).rgba
    }).setOrigin(0.5)

    container.add([bg, text])

    const hasUrl = service.url && service.url.length > 0
    
    if (hasUrl) {
      bg.on("pointerover", () => {
        bg.setStrokeStyle(3, 0xffffff)
        text.setColor("#ffffff")
      })
      bg.on("pointerout", () => {
        bg.setStrokeStyle(2, service.color)
        text.setColor(Phaser.Display.Color.IntegerToColor(service.color).rgba)
      })
      bg.on("pointerdown", () => {
        window.open(service.url, "_blank")
      })
    } else {
      bg.setAlpha(0.5)
      text.setAlpha(0.5)
      if (!compact) {
        text.setText(`${service.icon} ${service.name} (Coming Soon)`)
      }
    }

    return container
  }

  shareTrackLink() {
    // Use Web Share API if available
    if (navigator.share && this.levelTrack) {
      navigator.share({
        title: `Listen to "${this.levelTrack.title}"`,
        text: `Check out this track from The Diminished Chord: "${this.levelTrack.title}" by ${this.levelTrack.artist}`,
        url: this.levelTrack.spotifyUrl || this.levelTrack.appleMusicUrl || window.location.href
      }).catch(err => console.log("Share failed:", err))
    } else {
      // Fallback: copy to clipboard
      const shareText = `Check out "${this.levelTrack?.title || "this track"}" from The Diminished Chord!`
      navigator.clipboard?.writeText(shareText)
      this.showToast("Link copied to clipboard!")
    }
  }

  showComingSoonMessage(feature) {
    this.showToast(`${feature} coming soon!`)
  }

  showToast(message) {
    const toast = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 100, message, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#333333cc",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(200)

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 50,
      delay: 2000,
      duration: 500,
      onComplete: () => toast.destroy()
    })
  }

  createButtons(x, y) {
    const buttonSpacing = 45
    const buttonWidth = 180

    // Row 1: Next Level, Retry
    this.nextButton = this.createButton(x - 100, y, "NEXT LEVEL", 0x00ff88, () => this.goToNextLevel())
    this.retryButton = this.createButton(x + 100, y, "RETRY", 0xffaa00, () => this.retryLevel())

    // Row 2: World Map, Main Menu
    this.worldMapButton = this.createButton(x - 100, y + buttonSpacing, "WORLD MAP", 0x00ffff, () => this.goToWorldMap())
    this.menuButton = this.createButton(x + 100, y + buttonSpacing, "MAIN MENU", 0xff4444, () => this.goToMenu())

    this.buttons = [this.nextButton, this.retryButton, this.worldMapButton, this.menuButton]
    this.selectedButtonIndex = 0
    this.updateAllSelections()
  }

  createButton(x, y, text, color, callback) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 180, 38, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(2, color)

    const label = this.add.text(0, 0, text, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
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
    container.color = color
    container.callback = callback

    return container
  }

  updateButtonSelection() {
    // Redirect to unified selection update
    this.updateAllSelections()
  }

  setupInput() {
    // Arrow key navigation - supports both feature buttons row and main buttons (2x2 grid)
    // Row 0 = feature buttons (Leaderboard, Ghost Replay, Go to Song)
    // Row 1 = main buttons top (Next Level, Retry)
    // Row 2 = main buttons bottom (World Map, Main Menu)
    
    this.input.keyboard.on("keydown-UP", () => {
      if (this.selectedRow === 0) {
        // Already at top row (feature buttons), can't go higher
        return
      } else if (this.selectedRow === 1) {
        // Move from main buttons row 1 to feature buttons
        this.selectedRow = 0
        // Map column position: left button -> first feature, right button -> last feature
        this.selectedFeatureIndex = this.selectedButtonIndex % 2 === 0 ? 0 : 
          (this.featureButtons ? this.featureButtons.length - 1 : 0)
        this.updateAllSelections()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      } else if (this.selectedRow === 2) {
        // Move from main buttons row 2 to row 1
        this.selectedRow = 1
        // Keep same column position
        this.updateAllSelections()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      if (this.selectedRow === 0) {
        // Move from feature buttons to main buttons row 1
        this.selectedRow = 1
        // Map feature position to main button column
        if (this.featureButtons && this.featureButtons.length > 0) {
          this.selectedButtonIndex = this.selectedFeatureIndex === 0 ? 0 : 1
        }
        this.updateAllSelections()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      } else if (this.selectedRow === 1) {
        // Move from main buttons row 1 to row 2
        this.selectedRow = 2
        this.selectedButtonIndex += 2
        this.updateAllSelections()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
      // Row 2 is the bottom, can't go lower
    })

    this.input.keyboard.on("keydown-LEFT", () => {
      if (this.selectedRow === 0) {
        // Navigate left within feature buttons
        if (this.selectedFeatureIndex > 0) {
          this.selectedFeatureIndex--
          this.updateAllSelections()
          this.sound.play("ui_select_sound", { volume: 0.2 })
        }
      } else {
        // Navigate left within main buttons (2x2 grid)
        if (this.selectedButtonIndex % 2 === 1) {
          this.selectedButtonIndex -= 1
          this.updateAllSelections()
          this.sound.play("ui_select_sound", { volume: 0.2 })
        }
      }
    })

    this.input.keyboard.on("keydown-RIGHT", () => {
      if (this.selectedRow === 0) {
        // Navigate right within feature buttons
        if (this.featureButtons && this.selectedFeatureIndex < this.featureButtons.length - 1) {
          this.selectedFeatureIndex++
          this.updateAllSelections()
          this.sound.play("ui_select_sound", { volume: 0.2 })
        }
      } else {
        // Navigate right within main buttons (2x2 grid)
        if (this.selectedButtonIndex % 2 === 0) {
          this.selectedButtonIndex += 1
          this.updateAllSelections()
          this.sound.play("ui_select_sound", { volume: 0.2 })
        }
      }
    })

    this.input.keyboard.on("keydown-ENTER", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      if (this.selectedRow === 0 && this.featureButtons && this.featureButtons[this.selectedFeatureIndex]) {
        // Activate selected feature button
        this.featureButtons[this.selectedFeatureIndex].callback()
      } else if (this.buttons && this.buttons[this.selectedButtonIndex]) {
        // Activate selected main button
        this.buttons[this.selectedButtonIndex].callback()
      }
    })

    // Space to toggle play/pause on the audio player
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.levelTrack && this.levelTrack.audioUrl) {
        this.togglePlayPause()
      }
    })

    // ESC to close overlays
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.leaderboardContainer) {
        this.hideLeaderboard()
      } else if (this.replayContainer) {
        this.replayContainer.destroy()
        this.replayContainer = null
      } else if (this.musicLinksContainer) {
        this.musicLinksContainer.destroy()
        this.musicLinksContainer = null
      }
    })
  }

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = ms % 1000
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`
  }

  togglePlayPause() {
    this.userTookControl = true
    if (this.isPlaying) {
      this.pauseTrack()
    } else {
      this.playTrack()
    }
    
    // Update mini player button if it exists
    if (this.playBtnRef) {
      this.playBtnRef.setText(this.isPlaying ? "⏸" : "▶")
    }
  }

  playTrack() {
    this.userTookControl = true
    
    if (!this.levelTrack || !this.levelTrack.audioUrl) {
      return
    }

    if (this.levelBgm && this.levelBgm.isPaused) {
      this.levelBgm.resume()
      this.isPlaying = true
      return
    }

    if (!this.levelBgm || !this.levelBgm.isPlaying) {
      const audioKey = `bgm_${this.levelTrack.id}`
      
      if (this.cache.audio.exists(audioKey)) {
        this.levelBgm = this.sound.add(audioKey, { volume: 0.6, loop: true })
        this.levelBgm.play()
        this.isPlaying = true
      } else {
        this.load.audio(audioKey, this.levelTrack.audioUrl)
        this.load.once("complete", () => {
          this.levelBgm = this.sound.add(audioKey, { volume: 0.6, loop: true })
          this.levelBgm.play()
          this.isPlaying = true
        })
        this.load.start()
      }
    }
  }

  pauseTrack() {
    this.userTookControl = true
    if (this.levelBgm && this.levelBgm.isPlaying) {
      this.levelBgm.pause()
      this.isPlaying = false
    }
  }

  stopTrack() {
    this.userTookControl = true
    if (this.levelBgm) {
      this.levelBgm.stop()
      this.levelBgm.destroy()
      this.levelBgm = null
    }
    this.isPlaying = false
  }

  goToNextLevel() {
    BGMManager.stop()
    this.cleanupMusic()
    
    // Store reference to scene manager before stopping scenes
    const sceneManager = this.scene
    
    sceneManager.stop("UIScene")
    if (this.currentLevelKey) {
      sceneManager.stop(this.currentLevelKey)
    }
    
    const returnToTutorialWorld = this.registry.get("returnToTutorialWorld")
    if (returnToTutorialWorld) {
      this.registry.set("returnToTutorialWorld", false)
      sceneManager.stop()
      sceneManager.start("TutorialWorldScene")
      return
    }
    
    if (this.isDynamicLevel && this.nextLevelId) {
      if (AdSkipManager.shouldShowAds()) {
        sceneManager.stop()
        sceneManager.start("InterstitialAdScene", { 
          nextLevelKey: "DynamicLevelScene",
          levelId: this.nextLevelId,
          freshStart: true
        })
      } else {
        sceneManager.stop()
        sceneManager.start("DynamicLevelScene", { levelId: this.nextLevelId, freshStart: true })
      }
    } else {
      const nextLevel = LevelManager.getNextLevel(this.currentLevelKey)
      if (nextLevel) {
        if (AdSkipManager.shouldShowAds()) {
          sceneManager.stop()
          sceneManager.start("InterstitialAdScene", { nextLevelKey: nextLevel })
        } else {
          sceneManager.stop()
          sceneManager.start(nextLevel)
        }
      } else {
        sceneManager.stop()
        sceneManager.start("TitleScreen")
      }
    }
  }

  retryLevel() {
    BGMManager.unduckVolume()
    this.cleanupMusic()
    
    this.scene.stop("UIScene")
    this.scene.stop()
    
    if (this.isDynamicLevel && this.levelId) {
      this.scene.start("DynamicLevelScene", { levelId: this.levelId, freshStart: true })
    } else {
      this.scene.start(this.currentLevelKey)
    }
  }

  goToWorldMap() {
    BGMManager.stop()
    this.cleanupMusic()
    
    LevelSessionManager.clearAllSessions()
    this.registry.set("returnToTutorialWorld", false)
    
    this.scene.stop("UIScene")
    this.scene.stop(this.currentLevelKey)
    this.scene.stop()
    
    // Parse level ID to get world number for navigation
    let worldNum = 1
    if (this.levelId) {
      const parsed = parseLevelId(this.levelId)
      if (parsed && parsed.world) {
        worldNum = parsed.world
      }
    }
    
    this.scene.start("WorldLevelSelectScene", { worldNum })
  }

  goToMenu() {
    BGMManager.stop()
    this.cleanupMusic()
    
    LevelSessionManager.clearAllSessions()
    this.registry.set("returnToTutorialWorld", false)
    
    this.scene.stop("UIScene")
    this.scene.stop(this.currentLevelKey)
    this.scene.stop()
    this.scene.start("TitleScreen")
  }

  cleanupMusic() {
    if (this.levelBgm) {
      this.levelBgm.stop()
      this.levelBgm.destroy()
      this.levelBgm = null
    }
  }

  shutdown() {
    this.cleanupMusic()
  }
}
