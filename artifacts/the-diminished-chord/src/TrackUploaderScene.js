import Phaser from "phaser"
import { TRACK_DATABASE, LEVEL_TRACKS, musicManager, MENU_KEYS } from "./MusicTrackManager.js"
import { LEVEL_ORDER } from "./LevelManager.js"
import { WORLDS, getAllLevelIds, getLevelId, LEVEL_TYPES } from "./WorldManager.js"
import { AudioStorageDB } from "./AudioStorageDB.js"
import { SupabaseMusicManager } from "./SupabaseMusicManager.js"
import { supabase } from "./integrations/supabase/client.js"

/**
 * TrackUploaderScene - Comprehensive music track management
 * Features tabbed interface for:
 * - Menu Music (intro, main menu, universe, dev mode, library)
 * - World Overworld Music (15 worlds)
 * - Level Music (organized by world)
 * - Track Library (all assignable tracks)
 */
export class TrackUploaderScene extends Phaser.Scene {
  constructor() {
    super({ key: "TrackUploaderScene" })
  }

  create() {
    const { width, height } = this.cameras.main
    this.centerX = width / 2

    // Background
    this.createBackground()

    // Title
    this.add.text(this.centerX, 35, "TRACK MANAGER", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    this.add.text(this.centerX, 60, "Manage music for menus, worlds, and levels", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)

    // Create tabs
    this.currentTab = "menu"
    this.createTabs()

    // Create content area
    this.contentContainer = this.add.container(0, 0)
    
    // Create upload panel FIRST (before showTabContent which calls updateUploadPanelState)
    this.createUploadPanel()

    // Show initial tab content (this calls updateUploadPanelState which needs the panel elements)
    this.showTabContent("menu")

    // Back button
    this.createBackButton()

    // Setup input
    this.setupInput()
    
    // Create file input element
    this.createFileInput()
  }

  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)

    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x222244, 0.2)
    
    for (let x = 0; x < this.cameras.main.width; x += 40) {
      graphics.beginPath()
      graphics.moveTo(x, 0)
      graphics.lineTo(x, this.cameras.main.height)
      graphics.strokePath()
    }
    for (let y = 0; y < this.cameras.main.height; y += 40) {
      graphics.beginPath()
      graphics.moveTo(0, y)
      graphics.lineTo(this.cameras.main.width, y)
      graphics.strokePath()
    }
  }

  createTabs() {
    const tabY = 95
    const tabs = [
      { key: "menu", label: "MENUS", color: 0xff69b4 },
      { key: "worlds", label: "WORLDS", color: 0x00ffff },
      { key: "levels", label: "LEVELS", color: 0x00ff88 },
      { key: "cutscenes", label: "CUTSCENES", color: 0xff8844 },
      { key: "library", label: "LIBRARY", color: 0xffaa00 },
      { key: "supabase", label: "DATABASE", color: 0xaa44ff }
    ]

    this.tabButtons = []
    const tabWidth = 105
    const totalWidth = tabs.length * tabWidth + (tabs.length - 1) * 6
    const startX = this.centerX - totalWidth / 2 + tabWidth / 2

    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + 6)
      const btn = this.createTabButton(x, tabY, tab.key, tab.label, tab.color)
      this.tabButtons.push(btn)
    })
  }

  createTabButton(x, y, key, label, color) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 130, 35, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(2, this.currentTab === key ? 0xffffff : color)

    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: this.currentTab === key ? "#ffffff" : Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.selectTab(key)
    })
    bg.on("pointerover", () => {
      if (this.currentTab !== key) {
        bg.setStrokeStyle(2, 0xffffff)
      }
    })
    bg.on("pointerout", () => {
      if (this.currentTab !== key) {
        bg.setStrokeStyle(2, color)
      }
    })

    container.bg = bg
    container.text = text
    container.key = key
    container.color = color

    return container
  }

  selectTab(key) {
    this.currentTab = key
    
    // Update tab visuals
    this.tabButtons.forEach(btn => {
      const isActive = btn.key === key
      btn.bg.setStrokeStyle(2, isActive ? 0xffffff : btn.color)
      btn.text.setColor(isActive ? "#ffffff" : Phaser.Display.Color.IntegerToColor(btn.color).rgba)
    })

    // Show tab content
    this.showTabContent(key)
  }

  async showTabContent(key) {
    // Clear previous content - destroy all children to prevent memory leaks
    this.contentContainer.removeAll(true)
    
    // Also clear any additional containers that tabs may have created
    if (this.levelListContainer) {
      this.levelListContainer.removeAll(true)
      this.levelListContainer.destroy()
      this.levelListContainer = null
    }
    
    // Clear any tab-specific elements that were added directly to the scene
    if (this.tabSpecificElements) {
      this.tabSpecificElements.forEach(el => {
        if (el && el.destroy) el.destroy()
      })
      this.tabSpecificElements = []
    }
    this.tabSpecificElements = []
    
    // Clear selection
    this.selectedItem = null
    this.selectedItemType = null
    this.updateUploadPanelState()

    switch (key) {
      case "menu":
        this.createMenuMusicContent()
        break
      case "worlds":
        this.createWorldsMusicContent()
        break
      case "levels":
        this.createLevelsMusicContent()
        break
      case "cutscenes":
        await this.createCutscenesMusicContent()
        break
      case "library":
        this.createLibraryContent()
        break
      case "supabase":
        await this.createSupabaseContent()
        break
    }
  }

  // ========== MENU MUSIC TAB ==========
  createMenuMusicContent() {
    const startY = 140
    const itemHeight = 55

    const menuItems = [
      { key: MENU_KEYS.INTRO, label: "Intro Cinematic", description: "Plays during the intro sequence" },
      { key: MENU_KEYS.TITLE_SCREEN, label: "Title Screen", description: "Initial logo reveal and 'Press Start' screen" },
      { key: MENU_KEYS.MAIN_MENU, label: "Main Menu", description: "Main menu after pressing start" },
      { key: MENU_KEYS.UNIVERSE_SELECT, label: "Universe Select", description: "World tour map selection" },
      { key: MENU_KEYS.DEV_MODE, label: "Developer Mode", description: "Developer menu and tools" },
      { key: MENU_KEYS.MUSIC_LIBRARY, label: "Music Library", description: "Track collection viewer" }
    ]

    const titleText = this.add.text(this.centerX, startY, "Menu & UI Music", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.contentContainer.add(titleText)

    menuItems.forEach((item, index) => {
      const y = startY + 40 + index * itemHeight
      this.createMusicSlot(this.centerX, y, item.key, item.label, item.description, "menu")
    })
  }

  // ========== WORLDS MUSIC TAB ==========
  createWorldsMusicContent() {
    const startY = 130
    const itemHeight = 45
    const columns = 2
    const colWidth = 500

    const titleText = this.add.text(this.centerX, startY, "World Overworld Music", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5)
    this.contentContainer.add(titleText)

    // Act labels
    const actColors = { 1: "#ff6b6b", 2: "#4ecdc4", 3: "#a855f7" }
    const actNames = { 1: "THE UNDERGROUND", 2: "THE INDUSTRY", 3: "INTERNAL BATTLE" }

    // Create scrollable content
    let currentY = startY + 35
    let currentAct = 0

    for (let worldNum = 1; worldNum <= 15; worldNum++) {
      const world = WORLDS[worldNum]
      
      // Add act header when act changes
      if (world.act !== currentAct) {
        currentAct = world.act
        const actText = this.add.text(this.centerX, currentY, `ACT ${currentAct}: ${actNames[currentAct]}`, {
          fontFamily: "RetroPixel",
          fontSize: "12px",
          color: actColors[currentAct]
        }).setOrigin(0.5)
        this.contentContainer.add(actText)
        currentY += 25
      }

      const menuKey = `world_${worldNum}`
      const label = `W${worldNum}: ${world.name}`
      const description = world.location
      
      this.createMusicSlot(this.centerX, currentY, menuKey, label, description, "world", 600)
      currentY += itemHeight
    }
  }

  // ========== LEVELS MUSIC TAB ==========
  createLevelsMusicContent() {
    const startY = 130

    const titleText = this.add.text(this.centerX, startY, "Level Music by World", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ff88"
    }).setOrigin(0.5)
    this.contentContainer.add(titleText)

    // World selector
    this.selectedWorldForLevels = 1
    this.createWorldSelector(startY + 35)

    // Level list container (scrollable)
    this.levelListContainer = this.add.container(0, 0)
    this.contentContainer.add(this.levelListContainer)
    
    this.showLevelsForWorld(1)
  }

  createWorldSelector(y) {
    const selectorContainer = this.add.container(this.centerX, y)
    this.contentContainer.add(selectorContainer)

    // Previous button
    const prevBtn = this.add.text(-200, 0, "◄", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    prevBtn.on("pointerdown", () => {
      if (this.selectedWorldForLevels > 1) {
        this.selectedWorldForLevels--
        this.updateWorldSelectorDisplay()
        this.showLevelsForWorld(this.selectedWorldForLevels)
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
    })

    // World display
    this.worldSelectorText = this.add.text(0, 0, "", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)

    // Next button
    const nextBtn = this.add.text(200, 0, "►", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    nextBtn.on("pointerdown", () => {
      if (this.selectedWorldForLevels < 15) {
        this.selectedWorldForLevels++
        this.updateWorldSelectorDisplay()
        this.showLevelsForWorld(this.selectedWorldForLevels)
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
    })

    selectorContainer.add([prevBtn, this.worldSelectorText, nextBtn])
    this.updateWorldSelectorDisplay()
  }

  updateWorldSelectorDisplay() {
    const world = WORLDS[this.selectedWorldForLevels]
    this.worldSelectorText.setText(`World ${this.selectedWorldForLevels}: ${world.name} (${world.location})`)
  }

  showLevelsForWorld(worldNum) {
    this.levelListContainer.removeAll(true)

    const startY = 210
    const itemHeight = 40
    let currentY = startY

    // Normal levels (1-14)
    const normalLabel = this.add.text(this.centerX - 250, currentY, "Normal Levels (1-14)", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ff88"
    })
    this.levelListContainer.add(normalLabel)
    currentY += 25

    // Show in grid (7 per row)
    for (let i = 1; i <= 14; i++) {
      const col = (i - 1) % 7
      const row = Math.floor((i - 1) / 7)
      const x = 150 + col * 120
      const y = currentY + row * 50
      
      const levelId = getLevelId(worldNum, i, LEVEL_TYPES.NORMAL)
      this.createCompactLevelSlot(x, y, levelId, `L${i}`)
    }
    currentY += 120

    // Bonus levels (B1-B5)
    const bonusLabel = this.add.text(this.centerX - 250, currentY, "Bonus Levels (B1-B5)", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffaa00"
    })
    this.levelListContainer.add(bonusLabel)
    currentY += 25

    for (let i = 1; i <= 5; i++) {
      const x = 150 + (i - 1) * 120
      const levelId = getLevelId(worldNum, i, LEVEL_TYPES.BONUS)
      this.createCompactLevelSlot(x, currentY, levelId, `B${i}`)
    }
    currentY += 60

    // Boss level
    const bossLabel = this.add.text(this.centerX - 250, currentY, "Boss Level", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff4444"
    })
    this.levelListContainer.add(bossLabel)
    currentY += 25

    const bossId = getLevelId(worldNum, 0, LEVEL_TYPES.BOSS)
    this.createCompactLevelSlot(150, currentY, bossId, "BOSS")

    // Legacy levels section (only show on World 1)
    if (worldNum === 1) {
      currentY += 60
      const legacyLabel = this.add.text(this.centerX - 250, currentY, "Legacy Levels (Quick Play)", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      })
      this.levelListContainer.add(legacyLabel)
      currentY += 25

      LEVEL_ORDER.forEach((levelKey, index) => {
        const col = index % 6
        const row = Math.floor(index / 6)
        const x = 150 + col * 120
        const y = currentY + row * 50
        this.createCompactLevelSlot(x, y, levelKey, `L${index + 1}*`)
      })
    }
  }

  createCompactLevelSlot(x, y, levelId, displayLabel) {
    const container = this.add.container(x, y)
    this.levelListContainer.add(container)

    const hasTrack = LEVEL_TRACKS[levelId] !== undefined
    const bgColor = hasTrack ? 0x1a3a1a : 0x1a1a2e
    const borderColor = hasTrack ? 0x00ff88 : 0x444466

    const bg = this.add.rectangle(0, 0, 100, 40, bgColor, 0.9)
    bg.setStrokeStyle(2, borderColor)

    const label = this.add.text(0, -8, displayLabel, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: hasTrack ? "#00ff88" : "#888888"
    }).setOrigin(0.5)

    const statusIcon = this.add.text(0, 10, hasTrack ? "🎵" : "—", {
      fontSize: "12px"
    }).setOrigin(0.5)

    container.add([bg, label, statusIcon])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerdown", () => {
      this.selectLevelForAssignment(levelId, displayLabel)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    bg.on("pointerover", () => bg.setStrokeStyle(3, 0xffffff))
    bg.on("pointerout", () => bg.setStrokeStyle(2, borderColor))

    container.levelId = levelId
    container.bg = bg
    container.statusIcon = statusIcon
  }

  selectLevelForAssignment(levelId, displayLabel) {
    this.selectedItem = levelId
    this.selectedItemType = "level"
    this.updateUploadPanelState()
    
    if (this.selectedItemText) {
      this.selectedItemText.setText(`Selected: ${displayLabel} (${levelId})`)
      this.selectedItemText.setColor("#00ff88")
    }
  }

  // ========== LIBRARY TAB ==========
  createLibraryContent() {
    const startY = 140

    const titleText = this.add.text(this.centerX, startY, "Track Library", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffaa00"
    }).setOrigin(0.5)
    this.contentContainer.add(titleText)

    const subtitleText = this.add.text(this.centerX, startY + 25, "All available tracks for assignment", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666"
    }).setOrigin(0.5)
    this.contentContainer.add(subtitleText)

    // Track list
    const tracks = Object.entries(TRACK_DATABASE)
    let currentY = startY + 60

    tracks.forEach(([trackId, track], index) => {
      if (currentY > 600) return // Limit visible tracks
      
      this.createTrackLibraryItem(this.centerX, currentY, trackId, track)
      currentY += 50
    })

    // Add new track button
    const addBtn = this.add.text(this.centerX, currentY + 20, "+ ADD NEW TRACK", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffaa00",
      backgroundColor: "#ffaa0022",
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    addBtn.on("pointerdown", () => this.addNewTrack())
    this.contentContainer.add(addBtn)
  }

  createTrackLibraryItem(x, y, trackId, track) {
    const container = this.add.container(x, y)
    this.contentContainer.add(container)

    const bg = this.add.rectangle(0, 0, 600, 45, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(1, track.audioUrl ? 0x00ff88 : 0x444466)

    const title = this.add.text(-280, -10, track.title, {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: track.audioUrl ? "#ffffff" : "#888888"
    })

    const artist = this.add.text(-280, 8, `${track.artist} • ${track.genre} • ${track.duration}`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    })

    const levelInfo = this.add.text(180, 0, track.levelKey || "Unassigned", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: track.levelKey ? "#00ff88" : "#ff4444"
    }).setOrigin(0.5)

    const audioStatus = this.add.text(260, 0, track.audioUrl ? "🎵" : "❌", {
      fontSize: "14px"
    }).setOrigin(0.5)

    container.add([bg, title, artist, levelInfo, audioStatus])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerdown", () => {
      this.selectTrackFromLibrary(trackId, track)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    bg.on("pointerover", () => bg.setStrokeStyle(2, 0xffffff))
    bg.on("pointerout", () => bg.setStrokeStyle(1, track.audioUrl ? 0x00ff88 : 0x444466))
  }

  selectTrackFromLibrary(trackId, track) {
    this.selectedItem = trackId
    this.selectedItemType = "track"
    this.updateUploadPanelState()
    
    if (this.selectedItemText) {
      this.selectedItemText.setText(`Selected: ${track.title}`)
      this.selectedItemText.setColor("#ffaa00")
    }
  }

  // ========== CUTSCENES TAB - Music for each cutscene ==========
  async createCutscenesMusicContent() {
    const startY = 130

    const titleText = this.add.text(this.centerX, startY, "Cutscene Music", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff8844"
    }).setOrigin(0.5)
    this.contentContainer.add(titleText)

    const subtitleText = this.add.text(this.centerX, startY + 22, "Assign unique music to each cutscene", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666"
    }).setOrigin(0.5)
    this.contentContainer.add(subtitleText)

    // Load cutscenes from Supabase
    const loadingText = this.add.text(this.centerX, startY + 50, "Loading cutscenes...", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffaa00"
    }).setOrigin(0.5)
    this.contentContainer.add(loadingText)

    try {
      const { data: cutscenes, error } = await supabase
        .from("cutscenes")
        .select(`
          id,
          cutscene_key,
          cutscene_type,
          title,
          world_number,
          act_number,
          music_track_id,
          music_tracks (
            id, name, artist
          )
        `)
        .order("sort_order", { ascending: true })

      loadingText.destroy()

      if (error) {
        throw error
      }

      if (!cutscenes || cutscenes.length === 0) {
        const emptyText = this.add.text(this.centerX, startY + 100, "No cutscenes found in database.\n\nUse Story Editor to create cutscenes first.", {
          fontFamily: "RetroPixel",
          fontSize: "12px",
          color: "#888888",
          align: "center"
        }).setOrigin(0.5)
        this.contentContainer.add(emptyText)
        return
      }

      // Group cutscenes by type
      const groupedCutscenes = {
        intro: cutscenes.filter(c => c.cutscene_type === "intro"),
        world_intro: cutscenes.filter(c => c.cutscene_type === "world_intro"),
        post_boss: cutscenes.filter(c => c.cutscene_type === "post_boss"),
        end_of_act: cutscenes.filter(c => c.cutscene_type === "end_of_act"),
        epilogue: cutscenes.filter(c => c.cutscene_type === "epilogue"),
        special: cutscenes.filter(c => c.cutscene_type === "special" || c.cutscene_type === "bonus_unlock")
      }

      // Create scrollable cutscene list
      this.cutsceneScrollOffset = 0
      this.cutsceneListContainer = this.add.container(0, 0)
      this.contentContainer.add(this.cutsceneListContainer)

      this.renderCutsceneList(groupedCutscenes, startY + 50)

    } catch (e) {
      console.error("[TrackUploaderScene] Failed to load cutscenes:", e)
      loadingText.setText("Failed to load cutscenes")
      loadingText.setColor("#ff4444")
    }
  }

  renderCutsceneList(groupedCutscenes, startY) {
    this.cutsceneListContainer.removeAll(true)

    const typeLabels = {
      intro: { label: "INTRO", color: "#ff69b4" },
      world_intro: { label: "WORLD INTROS", color: "#00ffff" },
      post_boss: { label: "POST-BOSS", color: "#00ff88" },
      end_of_act: { label: "END OF ACT", color: "#ffaa00" },
      epilogue: { label: "EPILOGUE", color: "#aa44ff" },
      special: { label: "SPECIAL", color: "#ff4444" }
    }

    let currentY = startY
    const itemHeight = 42

    Object.entries(groupedCutscenes).forEach(([type, cutscenes]) => {
      if (cutscenes.length === 0) return

      // Type header
      const typeInfo = typeLabels[type] || { label: type.toUpperCase(), color: "#888888" }
      const header = this.add.text(this.centerX, currentY, typeInfo.label, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: typeInfo.color
      }).setOrigin(0.5)
      this.cutsceneListContainer.add(header)
      currentY += 25

      // Cutscene slots
      cutscenes.forEach((cutscene) => {
        this.createCutsceneSlot(this.centerX, currentY, cutscene)
        currentY += itemHeight
      })

      currentY += 10 // Gap between groups
    })
  }

  createCutsceneSlot(x, y, cutscene) {
    const container = this.add.container(x, y)
    this.cutsceneListContainer.add(container)

    const hasTrack = cutscene.music_track_id !== null
    const bgColor = hasTrack ? 0x2a3a2a : 0x1a1a2e
    const borderColor = hasTrack ? 0x00ff88 : 0x444466

    const bg = this.add.rectangle(0, 0, 650, 38, bgColor, 0.9)
      .setStrokeStyle(1, borderColor)

    // Cutscene title
    const title = this.add.text(-300, -8, cutscene.title || cutscene.cutscene_key, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffffff"
    })

    // World/Act info
    let locationText = ""
    if (cutscene.world_number) {
      locationText = `World ${cutscene.world_number}`
    } else if (cutscene.act_number) {
      locationText = `Act ${cutscene.act_number}`
    }
    const location = this.add.text(-300, 8, locationText, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    })

    // Current track assignment
    const trackName = cutscene.music_tracks?.name || "No music assigned"
    const trackColor = hasTrack ? "#00ff88" : "#666666"
    const trackText = this.add.text(100, 0, trackName, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: trackColor
    }).setOrigin(0, 0.5)

    // Assign button
    const assignBtn = this.add.rectangle(280, 0, 70, 28, 0x2a1a4a)
      .setStrokeStyle(1, 0xaa44ff)
      .setInteractive({ useHandCursor: true })

    const assignText = this.add.text(280, 0, hasTrack ? "CHANGE" : "ASSIGN", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#aa44ff"
    }).setOrigin(0.5)

    assignBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.openCutsceneTrackPicker(cutscene)
    })
    assignBtn.on("pointerover", () => assignBtn.setStrokeStyle(2, 0xffffff))
    assignBtn.on("pointerout", () => assignBtn.setStrokeStyle(1, 0xaa44ff))

    container.add([bg, title, location, trackText, assignBtn, assignText])

    // Clear button if track is assigned
    if (hasTrack) {
      const clearBtn = this.add.text(310, 0, "✕", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ff4444"
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })

      clearBtn.on("pointerdown", async () => {
        this.sound.play("ui_select_sound", { volume: 0.2 })
        await this.clearCutsceneTrack(cutscene)
      })

      container.add(clearBtn)
    }
  }

  async openCutsceneTrackPicker(cutscene) {
    // Import TrackPickerModal dynamically to avoid circular dependencies
    const { TrackPickerModal } = await import("./TrackPickerModal.js")

    const picker = new TrackPickerModal(this, {
      title: "SELECT CUTSCENE MUSIC",
      subtitle: `Assigning to: ${cutscene.title || cutscene.cutscene_key}`,
      currentTrackId: cutscene.music_track_id,
      onSelect: async (track) => {
        await this.assignCutsceneTrack(cutscene, track)
      },
      onCancel: () => {
        // Nothing to do
      }
    })

    await picker.open()
  }

  async assignCutsceneTrack(cutscene, track) {
    this.statusText.setText(`Assigning "${track.name}"...`)
    this.statusText.setColor("#ffaa00")

    try {
      const { error } = await supabase
        .from("cutscenes")
        .update({ music_track_id: track.id })
        .eq("id", cutscene.id)

      if (error) throw error

      this.statusText.setText(`✓ Assigned: ${track.name}`)
      this.statusText.setColor("#00ff88")
      this.sound.play("ui_confirm_sound", { volume: 0.3 })

      // Refresh the tab
      await this.showTabContent("cutscenes")
    } catch (e) {
      console.error("Failed to assign cutscene track:", e)
      this.statusText.setText(`✗ Failed: ${e.message}`)
      this.statusText.setColor("#ff4444")
    }
  }

  async clearCutsceneTrack(cutscene) {
    this.statusText.setText("Clearing assignment...")
    this.statusText.setColor("#ffaa00")

    try {
      const { error } = await supabase
        .from("cutscenes")
        .update({ music_track_id: null })
        .eq("id", cutscene.id)

      if (error) throw error

      this.statusText.setText("✓ Assignment cleared")
      this.statusText.setColor("#00ff88")

      // Refresh the tab
      await this.showTabContent("cutscenes")
    } catch (e) {
      console.error("Failed to clear cutscene track:", e)
      this.statusText.setText(`✗ Failed: ${e.message}`)
      this.statusText.setColor("#ff4444")
    }
  }

  // ========== DATABASE TAB - Track Library Management ==========
  async createSupabaseContent() {
    const startY = 130

    const titleText = this.add.text(this.centerX, startY, "Track Database", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#aa44ff"
    }).setOrigin(0.5)
    this.contentContainer.add(titleText)

    // Show loading indicator
    const loadingText = this.add.text(this.centerX, startY + 22, "⏳ Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffaa00"
    }).setOrigin(0.5)
    this.contentContainer.add(loadingText)

    // Initialize Supabase manager - force reload to get fresh data
    try {
      await SupabaseMusicManager.forceReload()
    } catch (e) {
      console.error("[TrackUploaderScene] Failed to load from Supabase:", e)
    }

    // Update status after loading
    loadingText.destroy()
    
    const isConnected = SupabaseMusicManager.isInitialized
    const statusColorVal = isConnected ? "#00ff88" : "#ff4444"
    const statusTextVal = isConnected ? "☁️ Connected" : "⚠️ Offline - Click Refresh"

    const connStatusText = this.add.text(this.centerX, startY + 22, statusTextVal, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: statusColorVal
    }).setOrigin(0.5)
    this.contentContainer.add(connStatusText)

    // Upload button at top
    const uploadDbBtn = this.add.rectangle(this.centerX, startY + 60, 300, 45, 0x2a1a4a, 0.9)
      .setStrokeStyle(2, 0x00ff88)
      .setInteractive({ useHandCursor: true })
    this.contentContainer.add(uploadDbBtn)

    const uploadBtnText = this.add.text(this.centerX, startY + 60, "☁️ UPLOAD NEW TRACK", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ff88"
    }).setOrigin(0.5)
    this.contentContainer.add(uploadBtnText)

    uploadDbBtn.on("pointerdown", () => this.openSupabaseUploadDialog())
    uploadDbBtn.on("pointerover", () => uploadDbBtn.setStrokeStyle(3, 0xffffff))
    uploadDbBtn.on("pointerout", () => uploadDbBtn.setStrokeStyle(2, 0x00ff88))

    // Track list
    const supabaseTracks = SupabaseMusicManager.getAllTracks()
    const listStartY = startY + 110
    
    const trackCountText = this.add.text(this.centerX, listStartY, `${supabaseTracks.length} TRACKS IN DATABASE`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
    this.contentContainer.add(trackCountText)

    if (supabaseTracks.length === 0) {
      const emptyText = this.add.text(this.centerX, listStartY + 80, "No tracks uploaded yet.\n\nUpload your first track to get started!\n\nTip: Select a level from MENUS, WORLDS, or LEVELS tab,\nthen click 'SELECT FROM DATABASE' to assign music.", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#666666",
        align: "center",
        lineSpacing: 8
      }).setOrigin(0.5)
      this.contentContainer.add(emptyText)
    } else {
      // Render track list centered
      this.supabaseScrollOffset = 0
      this.renderDatabaseTrackList(this.centerX, listStartY + 30, supabaseTracks)
    }

    // Current assignments section at bottom
    const assignmentsY = this.cameras.main.height - 150
    
    const assignBg = this.add.rectangle(this.centerX, assignmentsY + 40, 700, 100, 0x1a1a2e, 0.8)
      .setStrokeStyle(1, 0x333355)
    this.contentContainer.add(assignBg)
    
    const assignTitle = this.add.text(this.centerX, assignmentsY, "CURRENT ASSIGNMENTS", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666"
    }).setOrigin(0.5)
    this.contentContainer.add(assignTitle)

    const assignments = Array.from(SupabaseMusicManager.levelAssignments.entries())
    if (assignments.length > 0) {
      const displayAssignments = assignments.slice(0, 6)
      const cols = 3
      const colWidth = 220
      
      displayAssignments.forEach(([levelId, assignment], i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = this.centerX - colWidth + col * colWidth
        const y = assignmentsY + 25 + row * 20
        
        const assignText = this.add.text(x, y, `${levelId}: ${assignment.track?.name || "Unknown"}`, {
          fontFamily: "RetroPixel",
          fontSize: "9px",
          color: "#aaaaaa"
        }).setOrigin(0.5)
        this.contentContainer.add(assignText)
      })
      
      if (assignments.length > 6) {
        const moreText = this.add.text(this.centerX, assignmentsY + 70, `... and ${assignments.length - 6} more assignments`, {
          fontFamily: "RetroPixel",
          fontSize: "9px",
          color: "#555555"
        }).setOrigin(0.5)
        this.contentContainer.add(moreText)
      }
    } else {
      const noAssignText = this.add.text(this.centerX, assignmentsY + 45, "No assignments yet. Select a level from another tab to assign tracks.", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#555555"
      }).setOrigin(0.5)
      this.contentContainer.add(noAssignText)
    }

    // Refresh button
    const refreshBtn = this.add.text(this.centerX, this.cameras.main.height - 35, "🔄 Refresh Database", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.contentContainer.add(refreshBtn)

    refreshBtn.on("pointerdown", async () => {
      this.statusText.setText("Refreshing...")
      this.statusText.setColor("#ffaa00")
      try {
        await SupabaseMusicManager.forceReload()
        await this.showTabContent("supabase")
        this.statusText.setText("✓ Refreshed!")
        this.statusText.setColor("#00ff88")
      } catch (e) {
        console.error("Refresh error:", e)
        this.statusText.setText("✗ Refresh failed")
        this.statusText.setColor("#ff4444")
      }
    })
  }

  renderDatabaseTrackList(centerX, startY, tracks) {
    const maxVisible = 7
    const itemHeight = 45
    const itemWidth = 650

    tracks.slice(this.supabaseScrollOffset, this.supabaseScrollOffset + maxVisible).forEach((track, i) => {
      const y = startY + i * itemHeight
      this.createDatabaseTrackItem(centerX, y, track, itemWidth)
    })

    // Scroll indicators
    if (this.supabaseScrollOffset > 0) {
      const upBtn = this.add.text(centerX, startY - 15, "▲ scroll up", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#666666"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      upBtn.on("pointerdown", () => {
        this.supabaseScrollOffset = Math.max(0, this.supabaseScrollOffset - 1)
        this.showTabContent("supabase")
      })
      this.contentContainer.add(upBtn)
    }

    if (this.supabaseScrollOffset + maxVisible < tracks.length) {
      const downBtn = this.add.text(centerX, startY + maxVisible * itemHeight + 5, "▼ scroll down", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#666666"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      downBtn.on("pointerdown", () => {
        this.supabaseScrollOffset = Math.min(tracks.length - maxVisible, this.supabaseScrollOffset + 1)
        this.showTabContent("supabase")
      })
      this.contentContainer.add(downBtn)
    }
  }

  createDatabaseTrackItem(x, y, track, width) {
    const container = this.add.container(x, y)
    this.contentContainer.add(container)

    const bg = this.add.rectangle(0, 0, width, 40, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x444466)

    const title = this.add.text(-width/2 + 20, -8, track.name || "Untitled", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    })

    const info = this.add.text(-width/2 + 20, 10, 
      `${track.artist || "Unknown"} • ${track.genre || "N/A"}`, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#888888"
    })

    // Show where this track is assigned
    const assignment = this.findTrackAssignment(track.id)
    const assignedText = assignment 
      ? `Assigned to: ${assignment}` 
      : "Not assigned"
    const assignedColor = assignment ? "#00ff88" : "#666666"

    const assignedLabel = this.add.text(width/2 - 150, 0, assignedText, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: assignedColor
    }).setOrigin(0.5)

    // Delete button
    const deleteBtn = this.add.text(width/2 - 30, 0, "🗑️", {
      fontSize: "14px"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    deleteBtn.on("pointerdown", () => this.confirmDeleteTrack(track))
    deleteBtn.on("pointerover", () => deleteBtn.setScale(1.2))
    deleteBtn.on("pointerout", () => deleteBtn.setScale(1))

    container.add([bg, title, info, assignedLabel, deleteBtn])
  }

  findTrackAssignment(trackId) {
    for (const [levelId, assignment] of SupabaseMusicManager.levelAssignments.entries()) {
      if (assignment.trackId === trackId) {
        return levelId
      }
    }
    return null
  }

  async confirmDeleteTrack(track) {
    const confirmed = confirm(`Delete "${track.name}" from database?\n\nThis will also remove any level assignments for this track.`)
    if (!confirmed) return

    this.statusText.setText("Deleting...")
    this.statusText.setColor("#ff4444")

    try {
      const result = await SupabaseMusicManager.deleteTrack(track.id)
      if (result.success) {
        this.statusText.setText(`✓ Deleted: ${track.name}`)
        this.statusText.setColor("#00ff88")
        await musicManager.reloadFromSupabase()
        this.showTabContent("supabase")
      } else {
        throw new Error(result.error)
      }
    } catch (e) {
      console.error("Delete error:", e)
      this.statusText.setText(`✗ Delete failed: ${e.message}`)
      this.statusText.setColor("#ff4444")
    }
  }

  openSupabaseUploadDialog() {
    // Create a file input specifically for Supabase uploads
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = "audio/mp3,audio/wav,audio/ogg,audio/*"
    fileInput.style.display = "none"
    document.body.appendChild(fileInput)

    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (file) {
        await this.uploadFileToSupabase(file)
      }
      document.body.removeChild(fileInput)
    }

    fileInput.click()
  }

  async uploadFileToSupabase(file, reopenModal = false) {
    this.statusText.setText("☁️ Uploading to database...")
    this.statusText.setColor("#aa44ff")

    try {
      // Prompt for metadata
      const name = prompt("Track name:", file.name.replace(/\.[^/.]+$/, ""))
      if (!name) {
        this.statusText.setText("Upload cancelled")
        this.statusText.setColor("#888888")
        if (reopenModal) this.openTrackSelectionModal()
        return
      }

      const artist = prompt("Artist:", "The Diminished Chord")
      const genre = prompt("Genre:", "Punk Rock")

      const result = await SupabaseMusicManager.uploadTrack(file, {
        name,
        artist: artist || "The Diminished Chord",
        genre: genre || null
      })

      if (result.success) {
        this.statusText.setText(`✓ Uploaded: ${name}`)
        this.statusText.setColor("#00ff88")
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        
        // Refresh the track list
        await musicManager.reloadFromSupabase()
        
        // Reopen modal to select the newly uploaded track
        if (reopenModal) {
          this.openTrackSelectionModal()
        } else {
          this.showTabContent(this.currentTab)
        }
      } else {
        throw new Error(result.error)
      }
    } catch (e) {
      console.error("Supabase upload error:", e)
      this.statusText.setText(`✗ Upload failed: ${e.message}`)
      this.statusText.setColor("#ff4444")
      if (reopenModal) this.openTrackSelectionModal()
    }
  }

  // ========== COMMON COMPONENTS ==========
  createMusicSlot(x, y, key, label, description, type, width = 500) {
    const container = this.add.container(x, y)
    this.contentContainer.add(container)

    // Check for Supabase assignment first, then local
    const supabaseAssignment = SupabaseMusicManager.getLevelTrack(key)
    const hasSupabaseAudio = !!supabaseAssignment?.track?.file_url
    const hasLocalAudio = (type === "menu" || type === "world") 
      ? !!musicManager.getMenuMusic(key) 
      : false
    const hasAudio = hasSupabaseAudio || hasLocalAudio
    
    const bgColor = hasAudio ? 0x1a3a1a : 0x1a1a2e
    const borderColor = hasSupabaseAudio ? 0xaa44ff : (hasLocalAudio ? 0x00ff88 : 0x444466)

    const bg = this.add.rectangle(0, 0, width, 48, bgColor, 0.9)
    bg.setStrokeStyle(2, borderColor)

    const labelText = this.add.text(-width/2 + 20, -10, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    })

    // Show track name if assigned from database
    let descStr = description
    if (hasSupabaseAudio) {
      descStr = `☁️ ${supabaseAssignment.track.name || "Database track"}`
    }

    const descText = this.add.text(-width/2 + 20, 10, descStr, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: hasSupabaseAudio ? "#aa44ff" : "#666666"
    })

    const statusIcon = this.add.text(width/2 - 30, 0, hasAudio ? "🎵" : "—", {
      fontSize: "18px"
    }).setOrigin(0.5)

    container.add([bg, labelText, descText, statusIcon])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerdown", () => {
      this.selectMenuSlot(key, label, type)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    bg.on("pointerover", () => bg.setStrokeStyle(3, 0xffffff))
    bg.on("pointerout", () => bg.setStrokeStyle(2, borderColor))

    container.key = key
    container.bg = bg
    container.statusIcon = statusIcon
  }

  selectMenuSlot(key, label, type) {
    this.selectedItem = key
    this.selectedItemType = type
    this.updateUploadPanelState()
    
    if (this.selectedItemText) {
      this.selectedItemText.setText(`Selected: ${label}`)
      this.selectedItemText.setColor(type === "menu" ? "#ff69b4" : "#00ffff")
    }
  }

  // ========== ASSIGNMENT PANEL (Database-focused) ==========
  createUploadPanel() {
    // Position panel with proper margin from right edge
    const panelWidth = 280
    const panelX = this.cameras.main.width - panelWidth / 2 - 20
    const panelY = this.cameras.main.height / 2

    // Panel background
    this.add.rectangle(panelX, panelY, panelWidth, 480, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x444466)

    this.add.text(panelX, panelY - 220, "ASSIGN AUDIO", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#aa44ff"
    }).setOrigin(0.5)

    // Selected item display
    this.selectedItemText = this.add.text(panelX, panelY - 190, "Select a level or menu", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666",
      wordWrap: { width: panelWidth - 30 },
      align: "center"
    }).setOrigin(0.5)

    // Current assignment display
    this.currentAssignmentText = this.add.text(panelX, panelY - 160, "", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#888888",
      wordWrap: { width: panelWidth - 30 },
      align: "center"
    }).setOrigin(0.5)

    // Preview button (to audition currently assigned track)
    const previewBtn = this.add.rectangle(panelX, panelY - 120, panelWidth - 30, 35, 0x1a4a3a, 0.9)
      .setStrokeStyle(2, 0x00ffaa)
      .setInteractive({ useHandCursor: true })
    
    this.previewBtnText = this.add.text(panelX, panelY - 120, "▶ PREVIEW ASSIGNED", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#00ffaa"
    }).setOrigin(0.5)

    previewBtn.on("pointerdown", () => this.previewAssignedTrack())
    previewBtn.on("pointerover", () => previewBtn.setStrokeStyle(3, 0xffffff))
    previewBtn.on("pointerout", () => previewBtn.setStrokeStyle(2, 0x00ffaa))
    this.previewBtn = previewBtn

    // MAIN ACTION: Assign from Database button
    const assignBtn = this.add.rectangle(panelX, panelY - 65, panelWidth - 30, 50, 0x2a1a4a, 0.9)
      .setStrokeStyle(2, 0xaa44ff)
      .setInteractive({ useHandCursor: true })
    
    this.add.text(panelX, panelY - 65, "🎵 SELECT FROM DATABASE", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#aa44ff"
    }).setOrigin(0.5)

    assignBtn.on("pointerdown", () => this.openTrackSelectionModal())
    assignBtn.on("pointerover", () => assignBtn.setStrokeStyle(3, 0xffffff))
    assignBtn.on("pointerout", () => assignBtn.setStrokeStyle(2, 0xaa44ff))

    // Clear assignment button
    const clearBtn = this.add.rectangle(panelX, panelY - 10, panelWidth - 30, 30, 0x442222, 0.6)
      .setStrokeStyle(1, 0xff4444, 0.7)
      .setInteractive({ useHandCursor: true })
    
    this.add.text(panelX, panelY - 10, "🗑️ Clear Assignment", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ff4444"
    }).setOrigin(0.5)

    clearBtn.on("pointerdown", () => this.clearAssignment())

    // Divider
    this.add.rectangle(panelX, panelY + 25, panelWidth - 40, 1, 0x444466)

    // Database status
    const isConnected = SupabaseMusicManager.isInitialized
    const statusColor = isConnected ? "#00ff88" : "#ff4444"
    const statusText = isConnected ? "☁️ Database Connected" : "⚠️ Database Offline"

    this.add.text(panelX, panelY + 45, statusText, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: statusColor
    }).setOrigin(0.5)

    // Track count
    const trackCount = SupabaseMusicManager.getAllTracks().length
    this.add.text(panelX, panelY + 62, `${trackCount} tracks available`, {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5)

    // Status message area
    this.statusText = this.add.text(panelX, panelY + 100, "", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#00ff88",
      wordWrap: { width: panelWidth - 30 },
      align: "center"
    }).setOrigin(0.5)

    // Refresh database button
    const refreshBtn = this.add.text(panelX, panelY + 145, "🔄 Refresh Database", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#888888"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    refreshBtn.on("pointerdown", async () => {
      this.statusText.setText("Refreshing...")
      this.statusText.setColor("#ffaa00")
      await musicManager.reloadFromSupabase()
      this.statusText.setText("✓ Database refreshed!")
      this.statusText.setColor("#00ff88")
      this.showTabContent(this.currentTab)
    })

    // Export/Import buttons (smaller, secondary)
    const exportBtn = this.add.text(panelX - 50, panelY + 180, "📤 Export", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    exportBtn.on("pointerdown", () => this.exportTrackAssignments())

    const importBtn = this.add.text(panelX + 50, panelY + 180, "📥 Import", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    importBtn.on("pointerdown", () => this.importTrackAssignments())

    // Store panel X for later reference
    this.panelX = panelX
  }

  // Preview the currently assigned track
  previewAssignedTrack() {
    if (!this.selectedItem) {
      this.statusText.setText("Select a slot first!")
      this.statusText.setColor("#ff4444")
      return
    }

    // Check if there's a Supabase assignment
    const supabaseAssignment = SupabaseMusicManager.getLevelTrack(this.selectedItem)
    
    if (supabaseAssignment?.track?.file_url) {
      this.playPreview(supabaseAssignment.track.file_url, supabaseAssignment.track.name)
      return
    }

    // Check local assignment
    const localUrl = musicManager.getMenuMusic(this.selectedItem)
    if (localUrl) {
      this.playPreview(localUrl, "Local track")
      return
    }

    this.statusText.setText("No track assigned to preview")
    this.statusText.setColor("#ff4444")
  }

  // Play a preview of any track
  playPreview(url, trackName) {
    // Stop any existing preview
    this.stopPreview()

    this.statusText.setText(`Playing: ${trackName}`)
    this.statusText.setColor("#00ffaa")
    this.previewBtnText.setText("⏹ STOP PREVIEW")

    const previewKey = `preview_${Date.now()}`
    
    // Load and play
    this.load.audio(previewKey, url)
    this.load.once("complete", () => {
      this.previewSound = this.sound.add(previewKey, { volume: 0.5 })
      this.previewSound.play()
      this.previewSound.once("complete", () => {
        this.stopPreview()
      })
    })
    this.load.once("loaderror", () => {
      this.statusText.setText("Failed to load audio")
      this.statusText.setColor("#ff4444")
      this.previewBtnText.setText("▶ PREVIEW ASSIGNED")
    })
    this.load.start()
  }

  // Stop preview playback
  stopPreview() {
    if (this.previewSound) {
      this.previewSound.stop()
      this.previewSound.destroy()
      this.previewSound = null
    }
    if (this.previewBtnText) {
      this.previewBtnText.setText("▶ PREVIEW ASSIGNED")
    }
    if (this.statusText && this.statusText.text.startsWith("Playing:")) {
      this.statusText.setText("")
    }
  }

  updateUploadPanelState() {
    if (!this.selectedItem) {
      if (this.selectedItemText) {
        this.selectedItemText.setText("Select a level or menu")
        this.selectedItemText.setColor("#666666")
      }
      if (this.currentAssignmentText) {
        this.currentAssignmentText.setText("")
      }
    } else {
      // Show current assignment if any
      this.updateCurrentAssignmentDisplay()
    }
  }

  updateCurrentAssignmentDisplay() {
    if (!this.currentAssignmentText || !this.selectedItem) return

    // Check Supabase assignment first
    const supabaseAssignment = SupabaseMusicManager.getLevelTrack(this.selectedItem)
    if (supabaseAssignment?.track?.name) {
      this.currentAssignmentText.setText(`Current: ${supabaseAssignment.track.name}`)
      this.currentAssignmentText.setColor("#00ff88")
      return
    }

    // Check menu music
    if (this.selectedItemType === "menu" || this.selectedItemType === "world") {
      const menuUrl = musicManager.getMenuMusic(this.selectedItem)
      if (menuUrl) {
        this.currentAssignmentText.setText("Current: Local audio assigned")
        this.currentAssignmentText.setColor("#ffaa00")
        return
      }
    }

    this.currentAssignmentText.setText("No audio assigned")
    this.currentAssignmentText.setColor("#666666")
  }

  // ========== TRACK SELECTION MODAL ==========
  async openTrackSelectionModal() {
    if (!this.selectedItem) {
      this.statusText.setText("Select a level or menu first!")
      this.statusText.setColor("#ff4444")
      return
    }

    this.sound.play("ui_select_sound", { volume: 0.2 })

    // Show loading indicator
    this.statusText.setText("Loading tracks from database...")
    this.statusText.setColor("#ffaa00")

    // Force refresh the database to get latest tracks (fixes issue after upload)
    try {
      await musicManager.reloadFromSupabase()
      const trackCount = SupabaseMusicManager.getAllTracks().length
      console.log(`[TrackUploaderScene] Loaded ${trackCount} tracks from database`)
      this.statusText.setText(`Loaded ${trackCount} tracks`)
      this.statusText.setColor("#00ff88")
    } catch (e) {
      console.error("[TrackUploaderScene] Failed to load tracks:", e)
      this.statusText.setText(`Error loading tracks: ${e.message}`)
      this.statusText.setColor("#ff4444")
    }

    // Create modal overlay
    this.modalContainer = this.add.container(0, 0)
    this.modalContainer.setDepth(1000)

    // Modal dimensions
    const modalWidth = 650
    const modalHeight = 580
    const modalX = this.cameras.main.width / 2
    const modalY = this.cameras.main.height / 2

    // Darken background
    const overlay = this.add.rectangle(
      modalX, modalY,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000, 0.8
    ).setInteractive()

    // Modal panel
    const modalBg = this.add.rectangle(modalX, modalY, modalWidth, modalHeight, 0x1a1a2e)
      .setStrokeStyle(3, 0xaa44ff)

    // Modal title
    const title = this.add.text(modalX, modalY - 265, "SELECT TRACK", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#aa44ff"
    }).setOrigin(0.5)

    // Assigning to label
    const assigningTo = this.add.text(modalX, modalY - 240, `Assigning to: ${this.selectedItem}`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)

    this.modalContainer.add([overlay, modalBg, title, assigningTo])

    // Get tracks from database
    const allTracks = SupabaseMusicManager.getAllTracks()
    
    // Store all tracks and filtered tracks for search
    this.allModalTracks = allTracks
    this.modalTracks = allTracks
    this.modalSearchQuery = ""

    if (allTracks.length === 0) {
      // No tracks - show upload option
      const noTracksText = this.add.text(modalX, modalY - 50, "No tracks in database yet!", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ff4444"
      }).setOrigin(0.5)

      const uploadPrompt = this.add.text(modalX, modalY, "Upload your first track to get started", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#888888"
      }).setOrigin(0.5)

      const uploadBtn = this.add.rectangle(modalX, modalY + 60, 250, 50, 0x2a1a4a)
        .setStrokeStyle(2, 0x00ff88)
        .setInteractive({ useHandCursor: true })

      const uploadBtnText = this.add.text(modalX, modalY + 60, "☁️ UPLOAD NEW TRACK", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#00ff88"
      }).setOrigin(0.5)

      uploadBtn.on("pointerdown", () => {
        this.closeModal()
        this.openSupabaseUploadDialogThenReopen()
      })

      this.modalContainer.add([noTracksText, uploadPrompt, uploadBtn, uploadBtnText])
    } else {
      // Create search bar
      this.createModalSearchBar(modalX, modalY - 210)
      
      // Track count indicator
      this.modalTrackCountText = this.add.text(modalX, modalY - 175, `${allTracks.length} tracks available`, {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#666666"
      }).setOrigin(0.5)
      this.modalContainer.add(this.modalTrackCountText)

      // Track list with scroll wheel support
      this.modalScrollOffset = 0
      this.modalListStartY = modalY - 150
      this.modalListCenterX = modalX
      this.renderModalTrackList(modalX, this.modalListStartY)

      // Upload new track button at bottom
      const uploadNewBtn = this.add.rectangle(modalX - 100, modalY + 250, 180, 35, 0x1a3a1a)
        .setStrokeStyle(1, 0x00ff88)
        .setInteractive({ useHandCursor: true })

      const uploadNewText = this.add.text(modalX - 100, modalY + 250, "☁️ Upload New", {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#00ff88"
      }).setOrigin(0.5)

      uploadNewBtn.on("pointerdown", () => {
        this.closeModal()
        this.openSupabaseUploadDialogThenReopen()
      })

      this.modalContainer.add([uploadNewBtn, uploadNewText])
      
      // Setup scroll wheel for modal
      this.setupModalScrollWheel()
    }

    // Close button
    const closeBtn = this.add.rectangle(modalX + 100, modalY + 250, 180, 35, 0x442222)
      .setStrokeStyle(1, 0xff4444)
      .setInteractive({ useHandCursor: true })

    const closeBtnText = this.add.text(modalX + 100, modalY + 250, "✕ Cancel", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff4444"
    }).setOrigin(0.5)

    closeBtn.on("pointerdown", () => this.closeModal())

    this.modalContainer.add([closeBtn, closeBtnText])

    // ESC to close
    this.modalEscKey = this.input.keyboard.addKey("ESC")
    this.modalEscKey.on("down", () => this.closeModal())
  }

  // Create search bar for the modal
  createModalSearchBar(centerX, y) {
    const searchContainer = this.add.container(centerX, y)
    this.modalContainer.add(searchContainer)

    // Search box background - highlighted to show it's active
    const searchBg = this.add.rectangle(0, 0, 400, 35, 0x0a0a1a, 0.95)
      .setStrokeStyle(2, 0xaa44ff) // Purple border to show it's focused
    
    // Search icon
    const searchIcon = this.add.text(-180, 0, "🔍", {
      fontSize: "14px"
    }).setOrigin(0.5)
    
    // Search placeholder/text with blinking cursor
    this.modalSearchText = this.add.text(-150, 0, "Type to search...", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    }).setOrigin(0, 0.5)
    
    // Blinking cursor indicator
    this.modalSearchCursor = this.add.text(-150, 0, "|", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#aa44ff"
    }).setOrigin(0, 0.5)
    
    // Blink the cursor
    this.time.addEvent({
      delay: 500,
      callback: () => {
        if (this.modalSearchCursor && this.modalSearchCursor.active) {
          this.modalSearchCursor.setVisible(!this.modalSearchCursor.visible)
        }
      },
      loop: true
    })
    
    // Clear button
    this.modalSearchClear = this.add.text(180, 0, "✕", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff4444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false)
    
    this.modalSearchClear.on("pointerdown", () => {
      this.modalSearchQuery = ""
      this.updateModalSearch()
    })

    // Hint text
    const hintText = this.add.text(0, 22, "Just start typing to filter tracks in real-time", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#555555"
    }).setOrigin(0.5)

    searchContainer.add([searchBg, searchIcon, this.modalSearchText, this.modalSearchCursor, this.modalSearchClear, hintText])

    // Real-time keyboard input - no prompt, just type!
    // Store the callback function separately so we can properly remove it later
    this.modalKeyboardCallback = (event) => {
      if (!this.modalContainer) return
      
      // Ignore special keys (but not Escape - that's handled elsewhere)
      if (["Enter", "Tab", "Shift", "Control", "Alt", "Meta", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return
      
      // Escape is handled by modal close
      if (event.key === "Escape") return
      
      // Handle backspace
      if (event.key === "Backspace") {
        event.preventDefault()
        if (this.modalSearchQuery.length > 0) {
          this.modalSearchQuery = this.modalSearchQuery.slice(0, -1)
          this.updateModalSearch()
        }
        return
      }
      
      // Handle Delete key - clear all
      if (event.key === "Delete") {
        event.preventDefault()
        this.modalSearchQuery = ""
        this.updateModalSearch()
        return
      }
      
      // Handle printable characters (single character keys)
      if (event.key.length === 1) {
        event.preventDefault()
        this.modalSearchQuery += event.key
        this.updateModalSearch()
      }
    }
    
    // Add the keyboard listener
    this.input.keyboard.on("keydown", this.modalKeyboardCallback)
  }

  // Update search results - called in real-time as user types
  updateModalSearch() {
    const query = this.modalSearchQuery.toLowerCase().trim()
    
    // Update search text display and cursor position
    if (this.modalSearchQuery.length > 0) {
      this.modalSearchText.setText(this.modalSearchQuery)
      this.modalSearchText.setColor("#ffffff")
      this.modalSearchClear.setVisible(true)
      
      // Position cursor at end of text
      if (this.modalSearchCursor) {
        const textWidth = this.modalSearchText.width
        this.modalSearchCursor.setX(-150 + textWidth + 2)
        this.modalSearchCursor.setVisible(true)
      }
    } else {
      this.modalSearchText.setText("Type to search...")
      this.modalSearchText.setColor("#666666")
      this.modalSearchClear.setVisible(false)
      
      // Reset cursor position
      if (this.modalSearchCursor) {
        this.modalSearchCursor.setX(-150)
      }
    }
    
    // Filter tracks - searches name, artist, and genre
    if (query) {
      this.modalTracks = this.allModalTracks.filter(track => {
        const name = (track.name || "").toLowerCase()
        const artist = (track.artist || "").toLowerCase()
        const genre = (track.genre || "").toLowerCase()
        const mood = (track.mood || "").toLowerCase()
        return name.includes(query) || artist.includes(query) || genre.includes(query) || mood.includes(query)
      })
    } else {
      this.modalTracks = this.allModalTracks
    }
    
    // Update track count with search feedback
    if (this.modalTrackCountText) {
      if (query) {
        const countText = this.modalTracks.length === 0
          ? `No matches for "${this.modalSearchQuery}"`
          : `${this.modalTracks.length} of ${this.allModalTracks.length} tracks match "${this.modalSearchQuery}"`
        this.modalTrackCountText.setText(countText)
        this.modalTrackCountText.setColor(this.modalTracks.length === 0 ? "#ff6666" : "#00ff88")
      } else {
        this.modalTrackCountText.setText(`${this.allModalTracks.length} tracks available`)
        this.modalTrackCountText.setColor("#666666")
      }
    }
    
    // Reset scroll and rerender
    this.modalScrollOffset = 0
    this.rerenderModalList(this.modalListCenterX, this.modalListStartY)
  }

  // Setup scroll wheel for modal track list
  setupModalScrollWheel() {
    this.modalScrollHandler = (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.modalContainer || !this.modalTracks) return
      
      const maxVisible = 7
      const maxOffset = Math.max(0, this.modalTracks.length - maxVisible)
      
      if (deltaY > 0) {
        // Scroll down
        this.modalScrollOffset = Math.min(maxOffset, this.modalScrollOffset + 1)
      } else if (deltaY < 0) {
        // Scroll up
        this.modalScrollOffset = Math.max(0, this.modalScrollOffset - 1)
      }
      
      this.rerenderModalList(this.modalListCenterX, this.modalListStartY)
    }
    
    this.input.on("wheel", this.modalScrollHandler)
  }

  renderModalTrackList(centerX, startY) {
    const maxVisible = 7
    const itemHeight = 48
    const itemWidth = 580

    // Clear previous items if any
    if (this.modalTrackItems) {
      this.modalTrackItems.forEach(item => {
        if (item && item.destroy) item.destroy()
      })
    }
    this.modalTrackItems = []

    const visibleTracks = this.modalTracks.slice(
      this.modalScrollOffset,
      this.modalScrollOffset + maxVisible
    )

    // Show message if no tracks match search
    if (visibleTracks.length === 0 && this.modalSearchQuery) {
      const noResults = this.add.text(centerX, startY + 100, `No tracks matching "${this.modalSearchQuery}"`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }).setOrigin(0.5)
      this.modalTrackItems.push(noResults)
      this.modalContainer.add(noResults)
      return
    }

    visibleTracks.forEach((track, i) => {
      const y = startY + i * itemHeight
      const item = this.createModalTrackItem(centerX, y, track, itemWidth)
      this.modalTrackItems.push(item)
      this.modalContainer.add(item)
    })

    // Scroll position indicator
    const totalTracks = this.modalTracks.length
    if (totalTracks > maxVisible) {
      const scrollInfo = this.add.text(centerX, startY + maxVisible * itemHeight + 10, 
        `Showing ${this.modalScrollOffset + 1}-${Math.min(this.modalScrollOffset + maxVisible, totalTracks)} of ${totalTracks} • Scroll or use ▲▼`, {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#555555"
      }).setOrigin(0.5)
      this.modalTrackItems.push(scrollInfo)
      this.modalContainer.add(scrollInfo)
    }

    // Scroll buttons (in addition to scroll wheel)
    if (this.modalScrollOffset > 0) {
      const upArrow = this.add.text(centerX + 260, startY + 80, "▲", {
        fontFamily: "RetroPixel",
        fontSize: "20px",
        color: "#aa44ff"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      upArrow.on("pointerdown", () => {
        this.modalScrollOffset = Math.max(0, this.modalScrollOffset - 3)
        this.rerenderModalList(centerX, startY)
      })
      this.modalTrackItems.push(upArrow)
      this.modalContainer.add(upArrow)
    }

    if (this.modalScrollOffset + maxVisible < totalTracks) {
      const downArrow = this.add.text(centerX + 260, startY + maxVisible * itemHeight - 80, "▼", {
        fontFamily: "RetroPixel",
        fontSize: "20px",
        color: "#aa44ff"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      downArrow.on("pointerdown", () => {
        this.modalScrollOffset = Math.min(totalTracks - maxVisible, this.modalScrollOffset + 3)
        this.rerenderModalList(centerX, startY)
      })
      this.modalTrackItems.push(downArrow)
      this.modalContainer.add(downArrow)
    }
  }

  rerenderModalList(centerX, startY) {
    if (this.modalTrackItems) {
      this.modalTrackItems.forEach(item => {
        if (item && item.destroy) item.destroy()
      })
    }
    this.renderModalTrackList(centerX, startY)
  }

  createModalTrackItem(x, y, track, width) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, width, 45, 0x2a2a3e, 0.9)
      .setStrokeStyle(1, 0x444466)

    const title = this.add.text(-width/2 + 20, -10, track.name || "Untitled", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    })

    const info = this.add.text(-width/2 + 20, 10, 
      `${track.artist || "Unknown"} • ${track.genre || "N/A"}`, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#888888"
    })

    // Preview button (play/stop)
    const previewBtn = this.add.rectangle(width/2 - 130, 0, 40, 30, 0x1a3a4a)
      .setStrokeStyle(1, 0x00aaff)
      .setInteractive({ useHandCursor: true })

    const previewText = this.add.text(width/2 - 130, 0, "▶", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00aaff"
    }).setOrigin(0.5)

    previewBtn.on("pointerdown", () => {
      // Toggle preview
      if (this.currentPreviewTrackId === track.id) {
        this.stopPreview()
        previewText.setText("▶")
        this.currentPreviewTrackId = null
      } else {
        this.stopPreview() // Stop any existing preview
        this.currentPreviewTrackId = track.id
        previewText.setText("⏹")
        this.playPreview(track.fileUrl, track.name)
      }
    })

    // Select button
    const selectBtn = this.add.rectangle(width/2 - 60, 0, 80, 30, 0x1a4a1a)
      .setStrokeStyle(1, 0x00ff88)
      .setInteractive({ useHandCursor: true })

    const selectText = this.add.text(width/2 - 60, 0, "SELECT", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#00ff88"
    }).setOrigin(0.5)

    selectBtn.on("pointerdown", () => {
      this.stopPreview() // Stop preview before assigning
      this.selectTrackForAssignment(track)
    })
    selectBtn.on("pointerover", () => {
      bg.setStrokeStyle(2, 0xaa44ff)
      selectBtn.setStrokeStyle(2, 0xffffff)
    })
    selectBtn.on("pointerout", () => {
      bg.setStrokeStyle(1, 0x444466)
      selectBtn.setStrokeStyle(1, 0x00ff88)
    })

    container.add([bg, title, info, previewBtn, previewText, selectBtn, selectText])
    return container
  }

  async selectTrackForAssignment(track) {
    this.closeModal()
    
    this.statusText.setText(`Assigning "${track.name}"...`)
    this.statusText.setColor("#ffaa00")

    try {
      const result = await musicManager.assignSupabaseTrackToLevel(
        this.selectedItem,
        track.id,
        { volume: 0.6, loop: true }
      )

      if (result.success) {
        this.statusText.setText(`✓ Assigned: ${track.name}`)
        this.statusText.setColor("#00ff88")
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        
        // Update the display
        this.updateCurrentAssignmentDisplay()
        
        // Refresh the current tab to show updated status
        this.showTabContent(this.currentTab)
      } else {
        throw new Error(result.error)
      }
    } catch (e) {
      const errorMsg = e?.message || e?.toString() || "Unknown error"
      console.error("Assignment error:", errorMsg, e)
      this.statusText.setText(`✗ Failed:\n${errorMsg}`)
      this.statusText.setColor("#ff4444")
    }
  }

  closeModal() {
    // Stop any preview playing in the modal
    this.stopPreview()
    this.currentPreviewTrackId = null
    
    // Remove scroll wheel handler
    if (this.modalScrollHandler) {
      this.input.off("wheel", this.modalScrollHandler)
      this.modalScrollHandler = null
    }
    
    // Remove keyboard listener for search
    if (this.modalKeyboardCallback) {
      this.input.keyboard.off("keydown", this.modalKeyboardCallback)
      this.modalKeyboardCallback = null
    }
    
    if (this.modalContainer) {
      this.modalContainer.destroy()
      this.modalContainer = null
    }
    if (this.modalEscKey) {
      this.modalEscKey.destroy()
      this.modalEscKey = null
    }
    
    // Clear modal state
    this.modalTrackItems = null
    this.allModalTracks = null
    this.modalTracks = null
    this.modalSearchQuery = ""
    this.modalSearchText = null
    this.modalSearchClear = null
    this.modalSearchCursor = null
    this.modalTrackCountText = null
  }

  openSupabaseUploadDialogThenReopen() {
    // Create file input for upload
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = "audio/mp3,audio/wav,audio/ogg,audio/*"
    fileInput.style.display = "none"
    document.body.appendChild(fileInput)

    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (file) {
        await this.uploadFileToSupabase(file, true) // true = reopen modal after
      }
      document.body.removeChild(fileInput)
    }

    fileInput.click()
  }

  async clearAssignment() {
    if (!this.selectedItem) {
      this.statusText.setText("Select a level or menu first!")
      this.statusText.setColor("#ff4444")
      return
    }

    this.statusText.setText("Clearing assignment...")
    this.statusText.setColor("#ffaa00")

    try {
      // Try to clear from Supabase
      const result = await musicManager.removeSupabaseTrackFromLevel(this.selectedItem)
      
      // Also clear from local storage
      if (this.selectedItemType === "menu" || this.selectedItemType === "world") {
        musicManager.setMenuMusic(this.selectedItem, null)
        musicManager.setMenuMusicBlobUrl(this.selectedItem, null)
      }

      this.statusText.setText("✓ Assignment cleared")
      this.statusText.setColor("#00ff88")
      this.sound.play("ui_select_sound", { volume: 0.2 })
      
      this.updateCurrentAssignmentDisplay()
      this.showTabContent(this.currentTab)
    } catch (e) {
      console.error("Clear error:", e)
      this.statusText.setText(`✗ Clear failed: ${e.message}`)
      this.statusText.setColor("#ff4444")
    }
  }

  // Legacy method - now replaced by database workflow
  createFileInput() {
    // No longer needed - uploads go through Supabase
  }

  // Legacy method - now replaced by database workflow  
  openFileDialog() {
    // Redirect to database workflow
    this.openTrackSelectionModal()
  }

  // Legacy method - for backwards compatibility with old local storage
  async handleFileUpload(file) {
    // Redirect to database upload
    await this.uploadFileToSupabase(file, false)
  }

  enterUrlManually() {
    if (!this.selectedItem) {
      this.statusText.setText("Select an item first!")
      this.statusText.setColor("#ff4444")
      return
    }

    const url = prompt("Enter audio URL (MP3/WAV/OGG):", "https://")
    if (!url || url === "https://") return

    if (this.selectedItemType === "menu" || this.selectedItemType === "world") {
      musicManager.setMenuMusic(this.selectedItem, url)
    } else if (this.selectedItemType === "level") {
      LEVEL_TRACKS[this.selectedItem] = { audioUrl: url }
    } else if (this.selectedItemType === "track") {
      TRACK_DATABASE[this.selectedItem].audioUrl = url
    }

    this.statusText.setText("✓ URL saved")
    this.statusText.setColor("#00ff88")
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.showTabContent(this.currentTab)
  }

  clearAudio() {
    if (!this.selectedItem) {
      this.statusText.setText("Select an item first!")
      this.statusText.setColor("#ff4444")
      return
    }

    if (this.selectedItemType === "menu" || this.selectedItemType === "world") {
      musicManager.setMenuMusic(this.selectedItem, null)
      musicManager.setMenuMusicBlobUrl(this.selectedItem, null)
    } else if (this.selectedItemType === "level") {
      delete LEVEL_TRACKS[this.selectedItem]
    } else if (this.selectedItemType === "track") {
      TRACK_DATABASE[this.selectedItem].audioUrl = null
      TRACK_DATABASE[this.selectedItem].storageKey = null
    }

    this.statusText.setText("✓ Audio cleared")
    this.statusText.setColor("#ffaa00")
    this.showTabContent(this.currentTab)
  }

  saveAllAssignments() {
    try {
      musicManager.saveMenuMusic()
      musicManager.saveTrackMetadata()
      
      // Save level tracks
      const levelAssignments = {}
      Object.entries(LEVEL_TRACKS).forEach(([levelId, data]) => {
        levelAssignments[levelId] = {
          audioUrl: data.audioUrl && !data.audioUrl.startsWith("blob:") ? data.audioUrl : null,
          storageKey: data.storageKey || null
        }
      })
      localStorage.setItem("diminished_chord_level_tracks", JSON.stringify(levelAssignments))

      this.statusText.setText("✓ All saved!")
      this.statusText.setColor("#00ff88")
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
    } catch (e) {
      this.statusText.setText("Save failed!")
      this.statusText.setColor("#ff4444")
    }
  }

  addNewTrack() {
    const title = prompt("Enter track title:", "New Track")
    if (!title) return

    const artist = prompt("Enter artist name:", "The Diminished Chord")
    const genre = prompt("Enter genre:", "Punk Rock")

    const trackCount = Object.keys(TRACK_DATABASE).length + 1
    const newTrackId = `track_${String(trackCount).padStart(3, "0")}`

    TRACK_DATABASE[newTrackId] = {
      title,
      artist: artist || "Unknown",
      album: "Volume 1",
      genre: genre || "Rock",
      duration: "0:00",
      audioUrl: null,
      previewUrl: null,
      coverUrl: null,
      levelKey: null,
      requiredFragments: ["drums", "bass", "guitar", "note"],
      price: 0.99,
      externalLinks: [],
      isUnlocked: false
    }

    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.showTabContent("library")
  }

  exportTrackAssignments() {
    try {
      // Export in the format compatible with default-track-assignments.json
      // This file can be directly copied to public/assets/default-track-assignments.json
      // to make track assignments persist across all browsers/sessions
      const exportData = {
        version: "1.0.0",
        description: "Track assignments for The Diminished Chord. Copy this file to public/assets/default-track-assignments.json to persist across all browsers.",
        exportedAt: new Date().toISOString(),
        instructions: {
          howToUse: "Copy this entire file to public/assets/default-track-assignments.json",
          menuMusic: "These URLs control which music plays on menus and world select screens.",
          levelTracks: "These URLs control music for individual levels."
        },
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

      // Export menu music (only URLs, not indexeddb references)
      Object.keys(MENU_KEYS).forEach(keyName => {
        const key = MENU_KEYS[keyName]
        const url = musicManager.getMenuMusicStorageValue(key)
        if (url && !url.startsWith("indexeddb:") && !url.startsWith("blob:")) {
          exportData.menuMusic[key] = url
        }
      })

      // Export level tracks
      Object.entries(LEVEL_TRACKS).forEach(([levelId, data]) => {
        if (data && data.audioUrl && !data.audioUrl.startsWith("blob:")) {
          exportData.levelTracks[`track_${levelId}`] = {
            audioUrl: data.audioUrl
          }
        }
      })

      // Export track metadata
      Object.entries(TRACK_DATABASE).forEach(([trackId, track]) => {
        // Only export tracks that have URLs (not blob or indexeddb)
        const hasValidUrl = track.audioUrl && !track.audioUrl.startsWith("blob:") && !track.audioUrl.startsWith("indexeddb:")
        if (hasValidUrl || track.title !== "Untitled Track") {
          exportData.trackMetadata[trackId] = {
            title: track.title,
            artist: track.artist,
            genre: track.genre,
            duration: track.duration
          }
          if (hasValidUrl) {
            exportData.levelTracks[trackId] = {
              audioUrl: track.audioUrl
            }
          }
        }
      })

      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `default-track-assignments.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      this.statusText.setText("✓ Exported! Copy to public/assets/")
      this.statusText.setColor("#00ff88")
    } catch (e) {
      console.error("Export failed:", e)
      this.statusText.setText("Export failed!")
      this.statusText.setColor("#ff4444")
    }
  }

  importTrackAssignments() {
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
        const data = JSON.parse(text)

        let imported = 0

        if (data.menuMusic) {
          Object.entries(data.menuMusic).forEach(([key, url]) => {
            musicManager.setMenuMusic(key, url)
            imported++
          })
        }

        if (data.levelTracks) {
          Object.entries(data.levelTracks).forEach(([levelId, url]) => {
            LEVEL_TRACKS[levelId] = { audioUrl: url }
            imported++
          })
        }

        if (data.tracks) {
          Object.entries(data.tracks).forEach(([trackId, trackData]) => {
            if (TRACK_DATABASE[trackId]) {
              Object.assign(TRACK_DATABASE[trackId], trackData)
              imported++
            }
          })
        }

        this.statusText.setText(`✓ Imported ${imported} items!`)
        this.statusText.setColor("#00ff88")
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.showTabContent(this.currentTab)

      } catch (e) {
        this.statusText.setText("Import failed!")
        this.statusText.setColor("#ff4444")
      }

      document.body.removeChild(fileInput)
    })

    fileInput.click()
  }

  createBackButton() {
    const backBtn = this.add.text(30, this.cameras.main.height - 35, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
    }).setInteractive({ useHandCursor: true })
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.cleanupFileInput()
      this.scene.start("DeveloperMenuScene")
    })
  }

  setupInput() {
    this.input.keyboard.on("keydown-ESC", () => {
      this.cleanupFileInput()
      this.scene.start("DeveloperMenuScene")
    })

    // Tab switching with number keys
    this.input.keyboard.on("keydown-ONE", () => this.selectTab("menu"))
    this.input.keyboard.on("keydown-TWO", () => this.selectTab("worlds"))
    this.input.keyboard.on("keydown-THREE", () => this.selectTab("levels"))
    this.input.keyboard.on("keydown-FOUR", () => this.selectTab("library"))
  }

  cleanupFileInput() {
    if (this.fileInput && this.fileInput.parentNode) {
      this.fileInput.parentNode.removeChild(this.fileInput)
    }
  }

  shutdown() {
    this.cleanupFileInput()
  }
}
