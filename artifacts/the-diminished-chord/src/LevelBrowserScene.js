import Phaser from "phaser"
import { SavedLevelsManager } from "./SavedLevelsManager.js"
import { LEVEL_ORDER, LEVEL_METADATA } from "./LevelManager.js"
import { WORLDS, getAllLevelIds, parseLevelId, LEVEL_TYPES, getLevelId, BONUS_PURPOSES } from "./WorldManager.js"
import { LevelDataManager } from "./LevelDataManager.js"

/**
 * LevelBrowserScene - Browse, edit, and manage ALL 301 levels
 * Three tabs: World Tour (301 levels), Legacy (11 levels), Custom (user-created)
 */
export class LevelBrowserScene extends Phaser.Scene {
  constructor() {
    super({ key: "LevelBrowserScene" })
  }

  create() {
    // Check if we should restore previous browser state
    const savedState = this.registry.get("levelBrowserState")
    
    this.selectedIndex = savedState?.selectedIndex || 0
    this.currentTab = savedState?.tab || "worldtour" // "worldtour", "legacy", or "custom"
    this.levelItems = []
    
    // World filter for world tour tab (0 = all, 1-15 = specific world)
    this.currentWorld = savedState?.world || 0
    this.scrollOffset = savedState?.scrollOffset || 0
    
    // Clear the saved state after restoring (one-time use)
    this.registry.set("levelBrowserState", null)
    
    // All 301 level IDs
    this.allLevelIds = getAllLevelIds()

    this.createBackground()
    this.createHeader()
    this.createTabs()
    this.createWorldFilter()
    this.createLevelList()
    this.createActionPanel()
    this.createBackButton()
    this.setupInput()

    // Load the appropriate tab (restored or default)
    if (this.currentTab === "worldtour") {
      this.loadWorldTourLevels()
    } else if (this.currentTab === "legacy") {
      this.loadLegacyLevels()
    } else {
      this.loadCustomLevels()
    }
    
    // Update tab visuals to match restored state
    this.updateTabStyles()
  }

  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)

    // Grid pattern
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

  createHeader() {
    this.add.text(this.cameras.main.width / 2, 35, "LEVEL BROWSER", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ffff"
    }).setOrigin(0.5)

    // Level count display
    this.levelCountText = this.add.text(this.cameras.main.width / 2, 62, `301 World Tour Levels | 11 Legacy | Custom`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
  }

  createTabs() {
    const tabY = 95
    const tabWidth = 140

    // World Tour tab (NEW - 301 levels)
    this.worldTourTab = this.add.container(this.cameras.main.width / 2 - 160, tabY)
    const worldTourBg = this.add.rectangle(0, 0, tabWidth, 30, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0xff69b4)
      .setInteractive({ useHandCursor: true })
    const worldTourText = this.add.text(0, 0, "WORLD TOUR", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.worldTourTab.add([worldTourBg, worldTourText])
    this.worldTourTab.bg = worldTourBg
    this.worldTourTab.text = worldTourText

    worldTourBg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.selectTab("worldtour")
    })

    // Legacy levels tab
    this.legacyTab = this.add.container(this.cameras.main.width / 2, tabY)
    const legacyBg = this.add.rectangle(0, 0, tabWidth, 30, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const legacyText = this.add.text(0, 0, "LEGACY (11)", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    this.legacyTab.add([legacyBg, legacyText])
    this.legacyTab.bg = legacyBg
    this.legacyTab.text = legacyText

    legacyBg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.selectTab("legacy")
    })

    // Custom levels tab
    this.customTab = this.add.container(this.cameras.main.width / 2 + 160, tabY)
    const customBg = this.add.rectangle(0, 0, tabWidth, 30, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const customText = this.add.text(0, 0, "MY LEVELS", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    this.customTab.add([customBg, customText])
    this.customTab.bg = customBg
    this.customTab.text = customText

    customBg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.selectTab("custom")
    })
  }

  createWorldFilter() {
    const filterY = 130
    
    // World filter container (only visible for World Tour tab)
    this.worldFilterContainer = this.add.container(0, filterY)
    
    // Background strip
    const filterBg = this.add.rectangle(this.cameras.main.width / 2, 0, 700, 28, 0x0f0f1f, 0.9)
      .setStrokeStyle(1, 0x333355)
    this.worldFilterContainer.add(filterBg)
    
    // "World:" label
    const label = this.add.text(80, 0, "World:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0, 0.5)
    this.worldFilterContainer.add(label)
    
    // Create world buttons: ALL, Tutorial, 1-15
    this.worldButtons = []
    const buttonStartX = 140
    const buttonSpacing = 36
    
    // "ALL" button
    const allBtn = this.createWorldFilterBtn(buttonStartX, 0, "ALL", 0)
    this.worldFilterContainer.add(allBtn)
    this.worldButtons.push(allBtn)
    
    // Tutorial button
    const tutBtn = this.createWorldFilterBtn(buttonStartX + buttonSpacing, 0, "T", -1) // -1 for tutorial
    this.worldFilterContainer.add(tutBtn)
    this.worldButtons.push(tutBtn)
    
    // World 1-15 buttons
    for (let w = 1; w <= 15; w++) {
      const btn = this.createWorldFilterBtn(buttonStartX + buttonSpacing * (w + 1), 0, `${w}`, w)
      this.worldFilterContainer.add(btn)
      this.worldButtons.push(btn)
    }
    
    // World name display
    this.worldNameDisplay = this.add.text(this.cameras.main.width - 80, 0, "", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff69b4"
    }).setOrigin(1, 0.5)
    this.worldFilterContainer.add(this.worldNameDisplay)
    
    this.updateWorldFilterHighlight()
  }

  createWorldFilterBtn(x, y, label, worldNum) {
    const container = this.add.container(x, y)
    
    const isAll = worldNum === 0
    const width = isAll ? 35 : 28
    
    const bg = this.add.rectangle(0, 0, width, 22, 0x1a1a2e, 0.8)
      .setStrokeStyle(1, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
    
    container.add([bg, text])
    container.bg = bg
    container.text = text
    container.worldNum = worldNum
    
    bg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.currentWorld = worldNum
      this.updateWorldFilterHighlight()
      this.loadWorldTourLevels()
    })
    
    bg.on("pointerover", () => {
      if (this.currentWorld !== worldNum) {
        bg.setStrokeStyle(1, 0x6666aa)
      }
    })
    
    bg.on("pointerout", () => {
      if (this.currentWorld !== worldNum) {
        bg.setStrokeStyle(1, 0x444466)
      }
    })
    
    return container
  }

  updateWorldFilterHighlight() {
    this.worldButtons.forEach(btn => {
      if (btn.worldNum === this.currentWorld) {
        btn.bg.setStrokeStyle(2, 0xff69b4)
        btn.text.setColor("#ff69b4")
      } else {
        btn.bg.setStrokeStyle(1, 0x444466)
        btn.text.setColor("#888888")
      }
    })
    
    // Update world name display
    if (this.currentWorld === 0) {
      this.worldNameDisplay.setText("All 301 Levels")
    } else if (this.currentWorld === -1) {
      this.worldNameDisplay.setText("Tutorial")
    } else {
      const world = WORLDS[this.currentWorld]
      if (world) {
        this.worldNameDisplay.setText(`${world.name} - ${world.location}`)
      }
    }
  }

  selectTab(tab) {
    this.currentTab = tab
    this.selectedIndex = 0
    this.scrollOffset = 0

    // Update tab visuals
    this.updateTabStyles()
    
    // Load appropriate levels
    if (tab === "worldtour") {
      this.loadWorldTourLevels()
    } else if (tab === "legacy") {
      this.loadLegacyLevels()
    } else {
      this.loadCustomLevels()
    }
  }
  
  /**
   * Update tab visual styles based on currentTab
   */
  updateTabStyles() {
    if (this.currentTab === "worldtour") {
      this.worldTourTab.bg.setStrokeStyle(2, 0xff69b4)
      this.worldTourTab.text.setColor("#ff69b4")
      this.legacyTab.bg.setStrokeStyle(2, 0x666666)
      this.legacyTab.text.setColor("#888888")
      this.customTab.bg.setStrokeStyle(2, 0x666666)
      this.customTab.text.setColor("#888888")
      this.worldFilterContainer.setVisible(true)
    } else if (this.currentTab === "legacy") {
      this.worldTourTab.bg.setStrokeStyle(2, 0x666666)
      this.worldTourTab.text.setColor("#888888")
      this.legacyTab.bg.setStrokeStyle(2, 0x00ff88)
      this.legacyTab.text.setColor("#00ff88")
      this.customTab.bg.setStrokeStyle(2, 0x666666)
      this.customTab.text.setColor("#888888")
      this.worldFilterContainer.setVisible(false)
    } else {
      this.worldTourTab.bg.setStrokeStyle(2, 0x666666)
      this.worldTourTab.text.setColor("#888888")
      this.legacyTab.bg.setStrokeStyle(2, 0x666666)
      this.legacyTab.text.setColor("#888888")
      this.customTab.bg.setStrokeStyle(2, 0x00ffff)
      this.customTab.text.setColor("#00ffff")
      this.worldFilterContainer.setVisible(false)
    }
  }

  createLevelList() {
    // Adjust Y position based on whether filter is visible
    const listStartY = 165

    // Scrollable list container
    this.listContainer = this.add.container(0, listStartY)
    
    // List panel background
    const panelWidth = 700
    const panelHeight = 340
    this.panelHeight = panelHeight
    this.listPanel = this.add.rectangle(
      this.cameras.main.width / 2,
      panelHeight / 2,
      panelWidth,
      panelHeight,
      0x0f0f1f,
      0.95
    ).setStrokeStyle(2, 0x333366)
    this.listContainer.add(this.listPanel)

    // Items container (for scrolling)
    this.itemsContainer = this.add.container(this.cameras.main.width / 2 - panelWidth / 2 + 15, 15)
    this.listContainer.add(this.itemsContainer)

    // Scroll offset tracking
    this.scrollOffset = 0
    this.maxVisibleItems = 6
    this.itemHeight = 52

    // Create scroll buttons
    this.createScrollButtons()
  }

  createScrollButtons() {
    const centerX = this.cameras.main.width / 2
    const listStartY = 165
    const panelTop = listStartY
    const panelBottom = listStartY + this.panelHeight

    // Scroll up button
    this.scrollUpBtn = this.add.text(centerX + 330, panelTop + 25, "▲", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#666666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    this.scrollUpBtn.on("pointerover", () => this.scrollUpBtn.setColor("#ffffff"))
    this.scrollUpBtn.on("pointerout", () => this.scrollUpBtn.setColor("#666666"))
    this.scrollUpBtn.on("pointerdown", () => {
      this.scrollList(-1)
    })

    // Scroll down button
    this.scrollDownBtn = this.add.text(centerX + 330, panelBottom - 25, "▼", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#666666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    this.scrollDownBtn.on("pointerover", () => this.scrollDownBtn.setColor("#ffffff"))
    this.scrollDownBtn.on("pointerout", () => this.scrollDownBtn.setColor("#666666"))
    this.scrollDownBtn.on("pointerdown", () => {
      this.scrollList(1)
    })

    // Scroll position indicator
    this.scrollIndicator = this.add.text(centerX + 330, (panelTop + panelBottom) / 2, "", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
  }

  scrollList(direction) {
    const maxOffset = Math.max(0, this.levelItems.length - this.maxVisibleItems)
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + direction, 0, maxOffset)
    
    // Update visible items
    this.updateVisibleItems()
    this.sound.play("ui_select_sound", { volume: 0.15 })
  }

  updateVisibleItems() {
    // Show/hide items based on scroll offset
    this.levelItems.forEach((item, index) => {
      const visibleIndex = index - this.scrollOffset
      if (visibleIndex >= 0 && visibleIndex < this.maxVisibleItems) {
        item.setVisible(true)
        item.setY(visibleIndex * this.itemHeight)
      } else {
        item.setVisible(false)
      }
    })

    // Update scroll indicator
    if (this.levelItems.length > this.maxVisibleItems) {
      const current = this.scrollOffset + 1
      const total = this.levelItems.length - this.maxVisibleItems + 1
      this.scrollIndicator.setText(`${current}/${total}`)
    } else {
      this.scrollIndicator.setText("")
    }

    // Update scroll button visibility
    this.scrollUpBtn.setAlpha(this.scrollOffset > 0 ? 1 : 0.3)
    this.scrollDownBtn.setAlpha(this.scrollOffset < this.levelItems.length - this.maxVisibleItems ? 1 : 0.3)
  }

  // Load all 301 World Tour levels
  loadWorldTourLevels() {
    this.clearItems()
    this.scrollOffset = 0

    let levelsToShow = []
    
    if (this.currentWorld === 0) {
      // All levels
      levelsToShow = this.allLevelIds
    } else if (this.currentWorld === -1) {
      // Tutorial only
      levelsToShow = ["Tutorial"]
    } else {
      // Specific world
      levelsToShow = this.allLevelIds.filter(levelId => {
        const parsed = parseLevelId(levelId)
        return parsed && parsed.world === this.currentWorld
      })
    }

    levelsToShow.forEach((levelId, index) => {
      const parsed = parseLevelId(levelId)
      const levelData = LevelDataManager.getLevel(levelId)
      
      let displayName = ""
      let subtitle = ""
      let levelTypeColor = "#888888"
      
      // Check for custom name in database metadata
      const customName = levelData?.metadata?.name
      const hasCustomName = customName && customName !== levelId && 
                            !customName.includes(" - Stage ") && 
                            !customName.includes(" - Boss") &&
                            !customName.startsWith("W") // Not auto-generated
      
      if (levelId === "Tutorial") {
        displayName = hasCustomName ? customName : "Tutorial"
        subtitle = levelData?.metadata?.description || "Learn the basics"
        levelTypeColor = "#00ff88"
      } else if (parsed) {
        const world = WORLDS[parsed.world]
        
        if (parsed.type === LEVEL_TYPES.NORMAL) {
          // Use custom name if available, otherwise default format
          displayName = hasCustomName ? 
            `W${parsed.world}-${parsed.level}: ${customName}` :
            `W${parsed.world}-${parsed.level}: ${world?.location || "Unknown"} Stage ${parsed.level}`
          subtitle = `Normal Level | ${levelData?.metadata?.difficulty || "Medium"}`
          levelTypeColor = "#ffffff"
        } else if (parsed.type === LEVEL_TYPES.BONUS) {
          const bonus = BONUS_PURPOSES[`b${parsed.level}`]
          displayName = hasCustomName ?
            `W${parsed.world}-B${parsed.level}: ${customName}` :
            `W${parsed.world}-B${parsed.level}: ${bonus?.name || "Bonus"}`
          subtitle = `Bonus Level | ${bonus?.reward || "Special Reward"}`
          levelTypeColor = "#ffaa00"
        } else if (parsed.type === LEVEL_TYPES.BOSS) {
          displayName = hasCustomName ?
            `W${parsed.world}-BOSS: ${customName}` :
            `W${parsed.world}-BOSS: ${world?.bossName || "Boss"}`
          subtitle = `Boss Fight | ${world?.bossMechanic || "Challenge"}`
          levelTypeColor = "#ff4444"
        }
      }
      
      // Check if level has been modified or saved to database
      const isInSupabase = LevelDataManager.isPublishedToSupabase(levelId)
      const hasModifications = LevelDataManager.isLevelModified(levelId)
      let extraInfo = ""
      if (isInSupabase) {
        extraInfo = "(published)"
      } else if (hasModifications) {
        extraInfo = "(modified)"
      }
      
      this.createLevelItem(
        index,
        displayName,
        subtitle,
        extraInfo,
        { type: "worldtour", levelId: levelId },
        levelTypeColor
      )
    })

    this.updateVisibleItems()
    this.updateSelection()
    
    // Update count display
    this.levelCountText.setText(`Showing ${levelsToShow.length} levels`)
  }

  // Load legacy 11 levels
  loadLegacyLevels() {
    this.clearItems()
    this.scrollOffset = 0

    LEVEL_ORDER.forEach((levelKey, index) => {
      const metadata = LEVEL_METADATA[levelKey]
      const hasOverride = SavedLevelsManager.hasBuiltinOverride(levelKey)
      
      // Check for custom name
      const customName = SavedLevelsManager.getCustomLevelName(levelKey)
      const displayName = customName || metadata.name
      const hasCustomName = SavedLevelsManager.hasCustomLevelName(levelKey)
      
      let extraInfo = ""
      if (hasOverride && hasCustomName) {
        extraInfo = "(custom)"
      } else if (hasOverride) {
        extraInfo = "(modified)"
      } else if (hasCustomName) {
        extraInfo = "(renamed)"
      }
      
      this.createLevelItem(
        index,
        `Level ${index + 1}: ${displayName}`,
        `${metadata.difficulty} | ${metadata.description}`,
        extraInfo,
        { type: "legacy", key: levelKey, originalName: metadata.name, customName }
      )
    })

    this.updateVisibleItems()
    this.updateSelection()
    
    this.levelCountText.setText(`Showing 11 Legacy levels`)
  }

  loadCustomLevels() {
    this.clearItems()
    this.scrollOffset = 0

    const savedLevels = SavedLevelsManager.getAllSavedLevels()

    if (savedLevels.length === 0) {
      const emptyText = this.add.text(335, 140, "No saved levels yet.\n\nCreate a new level in the\nLevel Designer and save it!", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#666666",
        align: "center"
      }).setOrigin(0.5)
      this.itemsContainer.add(emptyText)
      this.updateVisibleItems()
      this.levelCountText.setText(`0 Custom levels`)
      return
    }

    savedLevels.forEach((level, index) => {
      const dateStr = new Date(level.updatedAt).toLocaleDateString()
      this.createLevelItem(
        index,
        `#${level.levelNumber}: ${level.title}`,
        `${level.data.objects?.length || 0} objects | Created: ${dateStr}`,
        "",
        { type: "custom", id: level.id }
      )
    })

    this.updateVisibleItems()
    this.updateSelection()
    
    this.levelCountText.setText(`Showing ${savedLevels.length} Custom levels`)
  }

  clearItems() {
    this.itemsContainer.removeAll(true)
    this.levelItems = []
  }

  createLevelItem(index, title, subtitle, extra, data, accentColor = "#ffffff") {
    const y = index * this.itemHeight
    const container = this.add.container(0, y)

    const bg = this.add.rectangle(335, 0, 670, 46, 0x1a1a2e, 0.8)
      .setStrokeStyle(1, 0x333366)
      .setInteractive({ useHandCursor: true })

    // Level type indicator bar (left side)
    const typeBar = this.add.rectangle(5, 0, 4, 40, Phaser.Display.Color.HexStringToColor(accentColor).color)

    const titleText = this.add.text(20, -10, title, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: accentColor
    })

    const subtitleText = this.add.text(20, 10, subtitle, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    })

    const extraText = this.add.text(650, 0, extra, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: extra.includes("modified") || extra.includes("custom") ? "#ffaa00" : "#555555"
    }).setOrigin(1, 0.5)

    container.add([bg, typeBar, titleText, subtitleText, extraText])
    container.levelData = data
    container.bg = bg
    container.index = index

    bg.on("pointerdown", () => {
      this.selectedIndex = index
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    bg.on("pointerover", () => {
      if (this.selectedIndex !== index) {
        bg.setStrokeStyle(1, 0x4444aa)
      }
    })

    bg.on("pointerout", () => {
      if (this.selectedIndex !== index) {
        bg.setStrokeStyle(1, 0x333366)
      }
    })

    this.itemsContainer.add(container)
    this.levelItems.push(container)
  }

  updateSelection() {
    this.levelItems.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.bg.setStrokeStyle(3, 0x00ffff)
        item.bg.setFillStyle(0x1a2a3a, 0.95)
      } else {
        item.bg.setStrokeStyle(1, 0x333366)
        item.bg.setFillStyle(0x1a1a2e, 0.8)
      }
    })

    this.updateActionButtons()
  }

  createActionPanel() {
    const panelX = this.cameras.main.width / 2
    const panelY = this.cameras.main.height - 60

    this.add.rectangle(panelX, panelY, 700, 55, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x444466)

    // Play/Test button (now FIRST - secondary action)
    this.playBtn = this.createActionBtn(panelX - 180, panelY, "PLAY", 0x00ffff, () => this.playSelected())
    
    // Edit button (now SECOND - primary action)
    this.editBtn = this.createActionBtn(panelX - 60, panelY, "EDIT", 0x00ff88, () => this.editSelected())
    
    // Rename button
    this.renameBtn = this.createActionBtn(panelX + 60, panelY, "RENAME", 0xff69b4, () => this.renameSelected())
    
    // Delete/Reset button
    this.deleteBtn = this.createActionBtn(panelX + 180, panelY, "DELETE", 0xff4444, () => this.deleteSelected())
    
    // Control hints
    this.controlHints = this.add.text(panelX, panelY + 35, "START/; = Edit  •  SELECT/R = Play  •  L/R = Cycle Tabs", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5)

    this.updateActionButtons()
  }

  createActionBtn(x, y, label, color, callback) {
    const bg = this.add.rectangle(x, y, 100, 38, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, color)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(x, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)

    bg.on("pointerover", () => {
      bg.setStrokeStyle(3, 0xffffff)
      text.setColor("#ffffff")
    })
    bg.on("pointerout", () => {
      bg.setStrokeStyle(2, color)
      text.setColor(Phaser.Display.Color.IntegerToColor(color).rgba)
    })
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      callback()
    })

    return { bg, text }
  }

  updateActionButtons() {
    const hasSelection = this.levelItems.length > 0
    const isCustom = this.currentTab === "custom"
    const isWorldTour = this.currentTab === "worldtour"
    const isLegacy = this.currentTab === "legacy"

    // Edit - available for all
    this.editBtn.bg.setVisible(hasSelection)
    this.editBtn.text.setVisible(hasSelection)
    
    // Play - available for all
    this.playBtn.bg.setVisible(hasSelection)
    this.playBtn.text.setVisible(hasSelection)
    
    // Rename - available for legacy and custom
    this.renameBtn.bg.setVisible(hasSelection && (isLegacy || isCustom))
    this.renameBtn.text.setVisible(hasSelection && (isLegacy || isCustom))
    
    // Delete - only for custom; Reset for legacy with modifications
    if (isCustom) {
      this.deleteBtn.text.setText("DELETE")
      this.deleteBtn.bg.setVisible(hasSelection)
      this.deleteBtn.text.setVisible(hasSelection)
    } else if (isLegacy && hasSelection && this.levelItems[this.selectedIndex]) {
      const levelData = this.levelItems[this.selectedIndex].levelData
      const showReset = SavedLevelsManager.hasBuiltinOverride(levelData.key) || 
                        SavedLevelsManager.hasCustomLevelName(levelData.key)
      this.deleteBtn.text.setText("RESET")
      this.deleteBtn.bg.setVisible(showReset)
      this.deleteBtn.text.setVisible(showReset)
    } else if (isWorldTour && hasSelection && this.levelItems[this.selectedIndex]) {
      const levelData = this.levelItems[this.selectedIndex].levelData
      const showReset = LevelDataManager.isLevelModified(levelData.levelId)
      this.deleteBtn.text.setText("RESET")
      this.deleteBtn.bg.setVisible(showReset)
      this.deleteBtn.text.setVisible(showReset)
    } else {
      this.deleteBtn.bg.setVisible(false)
      this.deleteBtn.text.setVisible(false)
    }
  }

  editSelected() {
    if (this.levelItems.length === 0) return

    const selected = this.levelItems[this.selectedIndex]
    const levelData = selected.levelData

    if (levelData.type === "worldtour") {
      // Edit World Tour level
      this.scene.start("LevelDesignerScene", { 
        editingLevelId: levelData.levelId,
        loadWorldTourLevel: levelData.levelId 
      })
    } else if (levelData.type === "legacy") {
      this.scene.start("LevelDesignerScene", { loadBuiltinKey: levelData.key })
    } else {
      this.scene.start("LevelDesignerScene", { loadLevelId: levelData.id })
    }
  }

  playSelected() {
    if (this.levelItems.length === 0) return

    const selected = this.levelItems[this.selectedIndex]
    const levelData = selected.levelData

    // Store browser state so we can return to the same position
    this.registry.set("levelBrowserState", {
      tab: this.currentTab,
      world: this.currentWorld,
      selectedIndex: this.selectedIndex,
      scrollOffset: this.scrollOffset
    })

    if (levelData.type === "worldtour") {
      // Play World Tour level using DynamicLevelScene
      // Pass flag that we came from browser
      this.scene.start("DynamicLevelScene", { 
        levelId: levelData.levelId,
        fromLevelBrowser: true 
      })
    } else if (levelData.type === "legacy") {
      // Start the actual game level
      this.scene.start(levelData.key, { fromLevelBrowser: true })
    } else {
      // Load custom level into test scene
      const level = SavedLevelsManager.getLevel(levelData.id)
      if (level) {
        this.registry.set("customLevelData", level.data)
        this.scene.start("CustomLevelTestScene", { fromLevelBrowser: true })
      }
    }
  }

  renameSelected() {
    if (this.levelItems.length === 0) return

    const selected = this.levelItems[this.selectedIndex]
    const levelData = selected.levelData

    if (this.currentTab === "custom") {
      const level = SavedLevelsManager.getLevel(levelData.id)
      if (!level) return
      this.showRenameDialog(level.title, (newTitle) => {
        SavedLevelsManager.updateLevel(level.id, { title: newTitle })
        this.loadCustomLevels()
      })
    } else if (this.currentTab === "legacy") {
      // For built-in levels, use custom name or original name
      const currentName = levelData.customName || levelData.originalName
      this.showRenameDialog(currentName, (newTitle) => {
        SavedLevelsManager.setCustomLevelName(levelData.key, newTitle)
        this.loadLegacyLevels()
      })
    }
  }

  showRenameDialog(currentTitle, onRename) {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 400, 200, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0xff69b4)

    const titleText = this.add.text(0, -70, "RENAME LEVEL", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    const promptText = this.add.text(0, -30, "Enter a new title:", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc"
    }).setOrigin(0.5)

    // Display current title
    const inputBg = this.add.rectangle(0, 10, 300, 35, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)

    const inputText = this.add.text(0, 10, currentTitle, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)

    const renameBtn = this.add.rectangle(-70, 65, 100, 35, 0xff69b4, 0.8)
      .setStrokeStyle(2, 0xff88cc)
      .setInteractive({ useHandCursor: true })
    const renameText = this.add.text(-70, 65, "RENAME", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#000000"
    }).setOrigin(0.5)

    const cancelBtn = this.add.rectangle(70, 65, 100, 35, 0x444444, 0.8)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(70, 65, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    dialog.add([bg, titleText, promptText, inputBg, inputText, renameBtn, renameText, cancelBtn, cancelText])

    renameBtn.on("pointerdown", () => {
      // Use browser prompt for input (simple and reliable)
      const newTitle = prompt("Enter new level title:", currentTitle)
      if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
        onRename(newTitle.trim())
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        dialog.destroy()
      } else {
        dialog.destroy()
      }
    })

    cancelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
    })
  }

  deleteSelected() {
    if (this.levelItems.length === 0) return

    const selected = this.levelItems[this.selectedIndex]
    const levelData = selected.levelData

    if (this.currentTab === "custom") {
      const level = SavedLevelsManager.getLevel(levelData.id)
      this.showConfirmDialog(
        "DELETE LEVEL?",
        `Delete "${level?.title}"?\nThis cannot be undone.`,
        () => {
          SavedLevelsManager.deleteLevel(levelData.id)
          this.loadCustomLevels()
        }
      )
    } else if (this.currentTab === "legacy") {
      const metadata = LEVEL_METADATA[levelData.key]
      this.showConfirmDialog(
        "RESET TO DEFAULT?",
        `Reset "${metadata.name}" to original?\nAll customizations will be lost.`,
        () => {
          SavedLevelsManager.deleteBuiltinOverride(levelData.key)
          SavedLevelsManager.removeCustomLevelName(levelData.key)
          this.loadLegacyLevels()
        }
      )
    } else if (this.currentTab === "worldtour") {
      this.showConfirmDialog(
        "RESET TO DEFAULT?",
        `Reset this level to default?\nAll customizations will be lost.`,
        () => {
          LevelDataManager.resetLevel(levelData.levelId)
          this.loadWorldTourLevels()
        }
      )
    }
  }

  showConfirmDialog(title, message, onConfirm) {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 350, 180, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0xff4444)

    const titleText = this.add.text(0, -60, title, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff4444"
    }).setOrigin(0.5)

    const msgText = this.add.text(0, -10, message, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc",
      align: "center"
    }).setOrigin(0.5)

    const confirmBtn = this.add.rectangle(-70, 55, 100, 35, 0xff4444, 0.8)
      .setStrokeStyle(2, 0xff6666)
      .setInteractive({ useHandCursor: true })
    const confirmText = this.add.text(-70, 55, "CONFIRM", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    const cancelBtn = this.add.rectangle(70, 55, 100, 35, 0x444444, 0.8)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(70, 55, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    dialog.add([bg, titleText, msgText, confirmBtn, confirmText, cancelBtn, cancelText])

    confirmBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      dialog.destroy()
      onConfirm()
    })

    cancelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
    })
  }

  createBackButton() {
    const backBtn = this.add.text(30, 25, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
    })
    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("DeveloperMenuScene")
    })
  }

  setupInput() {
    this.input.keyboard.on("keydown-UP", () => {
      if (this.levelItems.length === 0) return
      // Cycle to bottom if at top (menu looping)
      if (this.selectedIndex <= 0) {
        this.selectedIndex = this.levelItems.length - 1
      } else {
        this.selectedIndex--
      }
      // Auto-scroll to keep selection visible
      if (this.selectedIndex < this.scrollOffset) {
        this.scrollOffset = this.selectedIndex
        this.updateVisibleItems()
      }
      // Handle wrap to bottom
      if (this.selectedIndex === this.levelItems.length - 1) {
        this.scrollOffset = Math.max(0, this.levelItems.length - this.maxVisibleItems)
        this.updateVisibleItems()
      }
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      if (this.levelItems.length === 0) return
      // Cycle to top if at bottom (menu looping)
      if (this.selectedIndex >= this.levelItems.length - 1) {
        this.selectedIndex = 0
      } else {
        this.selectedIndex++
      }
      // Auto-scroll to keep selection visible
      if (this.selectedIndex >= this.scrollOffset + this.maxVisibleItems) {
        this.scrollOffset = this.selectedIndex - this.maxVisibleItems + 1
        this.updateVisibleItems()
      }
      // Handle wrap to top
      if (this.selectedIndex === 0) {
        this.scrollOffset = 0
        this.updateVisibleItems()
      }
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    // Page Up/Down for faster scrolling
    this.input.keyboard.on("keydown-PAGE_UP", () => {
      this.scrollList(-this.maxVisibleItems)
      this.selectedIndex = Math.max(0, this.scrollOffset)
      this.updateSelection()
    })

    this.input.keyboard.on("keydown-PAGE_DOWN", () => {
      this.scrollList(this.maxVisibleItems)
      this.selectedIndex = Math.min(this.levelItems.length - 1, this.scrollOffset)
      this.updateSelection()
    })

    // Tab switching with number keys
    this.input.keyboard.on("keydown-ONE", () => this.selectTab("worldtour"))
    this.input.keyboard.on("keydown-TWO", () => this.selectTab("legacy"))
    this.input.keyboard.on("keydown-THREE", () => this.selectTab("custom"))

    this.input.keyboard.on("keydown-TAB", () => {
      if (this.currentTab === "worldtour") {
        this.selectTab("legacy")
      } else if (this.currentTab === "legacy") {
        this.selectTab("custom")
      } else {
        this.selectTab("worldtour")
      }
    })

    // ENTER key now opens Edit/Play dialog (like A/X/Y buttons)
    this.input.keyboard.on("keydown-ENTER", () => {
      this.showEditPlayDialog()
    })

    // A key (mapped to Enter typically) - opens dialog
    this.input.keyboard.on("keydown-A", () => {
      this.showEditPlayDialog()
    })

    // Semicolon (Start button) = Edit directly
    this.input.keyboard.on("keydown-SEMICOLON", () => {
      this.editSelected()
    })
    
    // R key (Select button) = Play directly
    this.input.keyboard.on("keydown-R", () => {
      this.playSelected()
    })

    // E key - still works for edit (legacy/convenience)
    this.input.keyboard.on("keydown-E", () => {
      this.editSelected()
    })

    this.input.keyboard.on("keydown-ESC", () => {
      this.scene.start("DeveloperMenuScene")
    })

    // World filter shortcuts (for World Tour tab)
    this.input.keyboard.on("keydown-LEFT", () => {
      if (this.currentTab === "worldtour" && this.currentWorld > -1) {
        this.currentWorld--
        this.updateWorldFilterHighlight()
        this.loadWorldTourLevels()
      }
    })

    this.input.keyboard.on("keydown-RIGHT", () => {
      if (this.currentTab === "worldtour" && this.currentWorld < 15) {
        this.currentWorld++
        this.updateWorldFilterHighlight()
        this.loadWorldTourLevels()
      }
    })

    // Mouse wheel scrolling
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      if (deltaY > 0) {
        this.scrollList(1)
      } else if (deltaY < 0) {
        this.scrollList(-1)
      }
    })
    
    // L trigger (/) = Cycle tabs LEFT
    this.input.keyboard.on("keydown-FORWARD_SLASH", () => {
      this.cycleTabLeft()
    })
    
    // Q key (R trigger alternative) = Cycle tabs RIGHT
    this.input.keyboard.on("keydown-Q", () => {
      this.cycleTabRight()
    })
  }

  /**
   * Cycle to the previous tab (left)
   */
  cycleTabLeft() {
    if (this.currentTab === "worldtour") {
      this.selectTab("custom")
    } else if (this.currentTab === "legacy") {
      this.selectTab("worldtour")
    } else {
      this.selectTab("legacy")
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
  }

  /**
   * Cycle to the next tab (right)
   */
  cycleTabRight() {
    if (this.currentTab === "worldtour") {
      this.selectTab("legacy")
    } else if (this.currentTab === "legacy") {
      this.selectTab("custom")
    } else {
      this.selectTab("worldtour")
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
  }

  /**
   * Show Edit/Play dialog when A/X/Y or Enter is pressed
   */
  showEditPlayDialog() {
    if (this.levelItems.length === 0) return
    
    const selected = this.levelItems[this.selectedIndex]
    const levelData = selected.levelData
    const levelName = levelData.title || levelData.name || levelData.levelId || "Selected Level"
    
    // Create dialog
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)
    
    const bg = this.add.rectangle(0, 0, 320, 200, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0x00ffff)
    
    const titleText = this.add.text(0, -70, levelName.length > 25 ? levelName.substring(0, 25) + "..." : levelName, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)
    
    const promptText = this.add.text(0, -40, "Choose action:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    
    // Edit button
    const editBtn = this.add.rectangle(-70, 10, 110, 45, 0x00ff88, 0.9)
      .setStrokeStyle(2, 0x44ffaa)
      .setInteractive({ useHandCursor: true })
    const editText = this.add.text(-70, 10, "EDIT", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#000000"
    }).setOrigin(0.5)
    
    // Play button
    const playBtn = this.add.rectangle(70, 10, 110, 45, 0x00ffff, 0.9)
      .setStrokeStyle(2, 0x44ffff)
      .setInteractive({ useHandCursor: true })
    const playText = this.add.text(70, 10, "PLAY", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#000000"
    }).setOrigin(0.5)
    
    // Hints
    const hintText = this.add.text(0, 65, "START/; = Edit  •  SELECT/R = Play  •  B = Cancel", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0.5)
    
    dialog.add([bg, titleText, promptText, editBtn, editText, playBtn, playText, hintText])
    
    // Store reference for cleanup
    this.editPlayDialog = dialog
    
    // Button handlers
    editBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      dialog.destroy()
      this.editPlayDialog = null
      this.editSelected()
    })
    
    playBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      dialog.destroy()
      this.editPlayDialog = null
      this.playSelected()
    })
    
    // Keyboard handlers for dialog
    const dialogKeyHandler = (event) => {
      if (!this.editPlayDialog) return
      
      if (event.key === "Escape" || event.key === "b" || event.key === "B") {
        // Cancel
        this.sound.play("ui_select_sound", { volume: 0.2 })
        dialog.destroy()
        this.editPlayDialog = null
        this.input.keyboard.off("keydown", dialogKeyHandler)
      } else if (event.key === ";" || event.key === "e" || event.key === "E") {
        // Edit (Start/semicolon or E)
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        dialog.destroy()
        this.editPlayDialog = null
        this.input.keyboard.off("keydown", dialogKeyHandler)
        this.editSelected()
      } else if (event.key === "r" || event.key === "R") {
        // Play (Select/R)
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        dialog.destroy()
        this.editPlayDialog = null
        this.input.keyboard.off("keydown", dialogKeyHandler)
        this.playSelected()
      }
    }
    
    this.input.keyboard.on("keydown", dialogKeyHandler)
  }
}
