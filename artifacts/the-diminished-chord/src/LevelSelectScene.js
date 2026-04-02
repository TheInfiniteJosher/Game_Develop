import Phaser from "phaser"
import { LEVEL_ORDER, LevelManager } from "./LevelManager.js"
import { WORLDS, LEVEL_TYPES, getLevelId, BONUS_PURPOSES, WorldManager } from "./WorldManager.js"

/**
 * LevelSelectScene - Complete level select with World organization
 * Shows Tutorial, Legacy Levels, and all 15 Worlds with their levels
 */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "LevelSelectScene" })
  }

  create() {
    // View modes: "worlds" (world selection) or "levels" (levels within a world)
    this.viewMode = "worlds"
    this.selectedWorldNum = null
    this.scrollY = 0
    this.maxScroll = 0

    // Background
    this.createBackground()

    // Create main container for scrollable content
    this.contentContainer = this.add.container(0, 0)

    // Show world selection view
    this.showWorldSelection()

    // Create fixed UI elements (title bar, back button)
    this.createFixedUI()

    // Setup input
    this.setupInput()
  }

  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)

    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x222244, 0.3)
    
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

  createFixedUI() {
    // Title bar background
    this.titleBar = this.add.rectangle(0, 0, this.cameras.main.width, 70, 0x0a0a1a, 0.95)
      .setOrigin(0, 0)
      .setDepth(100)

    // Title text
    this.titleText = this.add.text(this.cameras.main.width / 2, 35, "SELECT WORLD", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ffff"
    }).setOrigin(0.5).setDepth(101)

    // Back button
    this.backButton = this.add.text(25, 35, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#666666"
    }).setOrigin(0, 0.5).setDepth(101)
    
    this.backButton.setInteractive({ useHandCursor: true })
    this.backButton.on("pointerover", () => this.backButton.setColor("#ffffff"))
    this.backButton.on("pointerout", () => this.backButton.setColor("#666666"))
    this.backButton.on("pointerdown", () => this.handleBack())

    // Scroll hint
    this.scrollHint = this.add.text(
      this.cameras.main.width / 2, 
      this.cameras.main.height - 20, 
      "Scroll with mouse wheel or arrow keys", 
      {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#444444"
      }
    ).setOrigin(0.5).setDepth(101)
  }

  showWorldSelection() {
    this.viewMode = "worlds"
    this.contentContainer.removeAll(true)
    this.scrollY = 0
    this.selectedIndex = 0
    this.selectableItems = []

    const centerX = this.cameras.main.width / 2
    let currentY = 90

    // Update title
    if (this.titleText) {
      this.titleText.setText("SELECT WORLD")
    }

    // === TUTORIAL SECTION ===
    const tutorialHeader = this.add.text(centerX, currentY, "— TUTORIAL —", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5)
    this.contentContainer.add(tutorialHeader)
    currentY += 40

    const tutorialBtn = this.createLevelButton(centerX, currentY, "Tutorial", "Learn the basics", 0x00ff88, "Tutorial", true)
    this.contentContainer.add(tutorialBtn)
    this.selectableItems.push(tutorialBtn)
    currentY += 70

    // === LEGACY LEVELS SECTION ===
    const legacyHeader = this.add.text(centerX, currentY, "— LEGACY LEVELS (Original 11) —", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5)
    this.contentContainer.add(legacyHeader)
    currentY += 40

    // Create legacy level buttons in a grid
    const legacyStartX = 120
    const legacyColWidth = 190
    const legacyCols = 5

    LEVEL_ORDER.forEach((levelKey, index) => {
      const col = index % legacyCols
      const row = Math.floor(index / legacyCols)
      const x = legacyStartX + col * legacyColWidth
      const y = currentY + row * 55

      const metadata = LevelManager.getLevelMetadata(levelKey)
      const color = this.getLegacyLevelColor(index)
      
      const btn = this.createLevelButton(x, y, `L${index + 1}`, metadata.name, color, levelKey, false)
      this.contentContainer.add(btn)
      this.selectableItems.push(btn)
    })

    currentY += Math.ceil(LEVEL_ORDER.length / legacyCols) * 55 + 40

    // === WORLD LEVELS SECTION ===
    const worldHeader = this.add.text(centerX, currentY, "— WORLD TOUR (301 Levels) —", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5)
    this.contentContainer.add(worldHeader)
    currentY += 15

    // Act headers and world cards
    const acts = [
      { num: 1, name: "ACT I: THE UNDERGROUND", worlds: [1, 2, 3, 4, 5], color: 0x00ff88 },
      { num: 2, name: "ACT II: THE INDUSTRY", worlds: [6, 7, 8, 9, 10], color: 0x00ffff },
      { num: 3, name: "ACT III: INTERNAL BATTLE", worlds: [11, 12, 13, 14, 15], color: 0xff69b4 }
    ]

    acts.forEach(act => {
      currentY += 35
      
      // Act header
      const actHeader = this.add.text(centerX, currentY, `— ${act.name} —`, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: Phaser.Display.Color.IntegerToColor(act.color).rgba
      }).setOrigin(0.5)
      this.contentContainer.add(actHeader)
      currentY += 35

      // World cards for this act
      act.worlds.forEach((worldNum, idx) => {
        const world = WORLDS[worldNum]
        if (!world) return

        const isUnlocked = WorldManager.isWorldUnlocked(worldNum)
        const progress = WorldManager.getWorldProgress(worldNum)
        
        const card = this.createWorldCard(centerX, currentY, world, isUnlocked, progress, act.color)
        this.contentContainer.add(card)
        this.selectableItems.push(card)
        
        currentY += 85
      })
    })

    // Calculate max scroll
    this.maxScroll = Math.max(0, currentY - this.cameras.main.height + 100)
    this.updateScroll()
    this.updateSelection()
  }

  showLevelSelection(worldNum) {
    this.viewMode = "levels"
    this.selectedWorldNum = worldNum
    this.contentContainer.removeAll(true)
    this.scrollY = 0
    this.selectedIndex = 0
    this.selectableItems = []

    const world = WORLDS[worldNum]
    if (!world) return

    const centerX = this.cameras.main.width / 2
    let currentY = 90

    // Update title
    if (this.titleText) {
      this.titleText.setText(`WORLD ${worldNum}: ${world.name.toUpperCase()}`)
    }

    // World info header
    const locationText = this.add.text(centerX, currentY, world.location, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.contentContainer.add(locationText)
    currentY += 25

    const descText = this.add.text(centerX, currentY, world.description, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    this.contentContainer.add(descText)
    currentY += 40

    // === NORMAL LEVELS (1-14) ===
    const normalHeader = this.add.text(centerX, currentY, "— STAGES (1-14) —", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff"
    }).setOrigin(0.5)
    this.contentContainer.add(normalHeader)
    currentY += 30

    // Grid of normal levels
    const cols = 7
    const buttonWidth = 130
    const buttonHeight = 50
    const startX = (this.cameras.main.width - (cols * buttonWidth + (cols - 1) * 10)) / 2 + buttonWidth / 2

    for (let i = 1; i <= 14; i++) {
      const col = (i - 1) % cols
      const row = Math.floor((i - 1) / cols)
      const x = startX + col * (buttonWidth + 10)
      const y = currentY + row * (buttonHeight + 10)

      const levelId = getLevelId(worldNum, i, LEVEL_TYPES.NORMAL)
      const isCompleted = WorldManager.isLevelCompleted(levelId)
      const isUnlocked = WorldManager.isLevelUnlocked(levelId)

      const btn = this.createStageLevelButton(x, y, `Stage ${i}`, levelId, isCompleted, isUnlocked)
      this.contentContainer.add(btn)
      this.selectableItems.push(btn)
    }

    currentY += Math.ceil(14 / cols) * (buttonHeight + 10) + 30

    // === BONUS LEVELS ===
    const bonusHeader = this.add.text(centerX, currentY, "— BONUS STAGES —", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffaa00"
    }).setOrigin(0.5)
    this.contentContainer.add(bonusHeader)
    currentY += 30

    // Grid of bonus levels
    const bonusCols = 5
    const bonusStartX = (this.cameras.main.width - (bonusCols * 180 + (bonusCols - 1) * 10)) / 2 + 90

    for (let i = 1; i <= 5; i++) {
      const x = bonusStartX + (i - 1) * 190
      const y = currentY

      const levelId = getLevelId(worldNum, i, LEVEL_TYPES.BONUS)
      const isCompleted = WorldManager.isLevelCompleted(levelId)
      const isUnlocked = WorldManager.isLevelUnlocked(levelId)
      const bonusInfo = BONUS_PURPOSES[`b${i}`]

      const btn = this.createBonusLevelButton(x, y, `B${i}`, bonusInfo.name, levelId, isCompleted, isUnlocked)
      this.contentContainer.add(btn)
      this.selectableItems.push(btn)
    }

    currentY += 70

    // === BOSS LEVEL ===
    const bossHeader = this.add.text(centerX, currentY, "— BOSS —", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff4444"
    }).setOrigin(0.5)
    this.contentContainer.add(bossHeader)
    currentY += 30

    const bossLevelId = getLevelId(worldNum, 0, LEVEL_TYPES.BOSS)
    const bossCompleted = WorldManager.isLevelCompleted(bossLevelId)
    const bossUnlocked = WorldManager.isLevelUnlocked(bossLevelId)

    const bossBtn = this.createBossLevelButton(centerX, currentY, world.bossName, bossLevelId, bossCompleted, bossUnlocked)
    this.contentContainer.add(bossBtn)
    this.selectableItems.push(bossBtn)

    currentY += 100

    // Calculate max scroll
    this.maxScroll = Math.max(0, currentY - this.cameras.main.height + 100)
    this.updateScroll()
    this.updateSelection()
  }

  createWorldCard(x, y, world, isUnlocked, progress, actColor) {
    const container = this.add.container(x, y)
    const cardWidth = 700
    const cardHeight = 70

    // Background
    const bgColor = isUnlocked ? 0x1a1a2e : 0x111122
    const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, bgColor, 0.9)
    bg.setStrokeStyle(2, isUnlocked ? actColor : 0x333344)

    // World number badge
    const badge = this.add.rectangle(-cardWidth/2 + 40, 0, 60, 50, actColor, isUnlocked ? 1 : 0.3)
    const badgeText = this.add.text(-cardWidth/2 + 40, 0, `W${world.id}`, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: isUnlocked ? "#000000" : "#444444"
    }).setOrigin(0.5)

    // World name and location
    const nameText = this.add.text(-cardWidth/2 + 90, -12, world.name, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: isUnlocked ? "#ffffff" : "#555555"
    })

    const locationText = this.add.text(-cardWidth/2 + 90, 12, world.location, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: isUnlocked ? "#888888" : "#444444"
    })

    // Progress bar
    const progressBarWidth = 150
    const progressBarX = cardWidth/2 - 180
    
    const progressBg = this.add.rectangle(progressBarX, 0, progressBarWidth, 16, 0x333344)
    const progressFill = this.add.rectangle(
      progressBarX - progressBarWidth/2 + (progressBarWidth * progress.percent / 100) / 2, 
      0, 
      progressBarWidth * progress.percent / 100, 
      16, 
      actColor, 
      0.8
    ).setOrigin(0.5)

    const progressText = this.add.text(progressBarX, 0, `${progress.completed}/${progress.total}`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5)

    // Lock icon or arrow
    const statusText = this.add.text(cardWidth/2 - 30, 0, isUnlocked ? ">" : "🔒", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: isUnlocked ? actColor : "#444444"
    }).setOrigin(0.5)

    container.add([bg, badge, badgeText, nameText, locationText, progressBg, progressFill, progressText, statusText])

    // Interactivity
    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true })
      bg.on("pointerover", () => {
        this.selectedIndex = this.selectableItems.indexOf(container)
        this.updateSelection()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      })
      bg.on("pointerdown", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.showLevelSelection(world.id)
      })
    }

    container.bg = bg
    container.isUnlocked = isUnlocked
    container.worldNum = world.id
    container.itemType = "world"
    container.actColor = actColor

    return container
  }

  createLevelButton(x, y, label, description, color, levelKey, isDynamic) {
    const container = this.add.container(x, y)
    const btnWidth = isDynamic ? 300 : 170
    const btnHeight = 50

    const bg = this.add.rectangle(0, 0, btnWidth, btnHeight, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(2, color)

    const labelText = this.add.text(isDynamic ? -btnWidth/2 + 20 : -btnWidth/2 + 15, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: isDynamic ? "20px" : "16px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0, 0.5)

    const descText = this.add.text(isDynamic ? -btnWidth/2 + 100 : -btnWidth/2 + 50, 0, description, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#aaaaaa",
      wordWrap: { width: isDynamic ? 180 : 110 }
    }).setOrigin(0, 0.5)

    container.add([bg, labelText, descText])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerover", () => {
      this.selectedIndex = this.selectableItems.indexOf(container)
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.startLevel(levelKey, isDynamic)
    })

    container.bg = bg
    container.color = color
    container.levelKey = levelKey
    container.isDynamic = isDynamic
    container.itemType = "level"

    return container
  }

  createStageLevelButton(x, y, label, levelId, isCompleted, isUnlocked) {
    const container = this.add.container(x, y)
    const btnWidth = 130
    const btnHeight = 45

    const bgColor = isUnlocked ? 0x1a1a2e : 0x111122
    const borderColor = isCompleted ? 0x00ff88 : (isUnlocked ? 0x00ffff : 0x333344)
    
    const bg = this.add.rectangle(0, 0, btnWidth, btnHeight, bgColor, 0.9)
    bg.setStrokeStyle(2, borderColor)

    const textColor = isCompleted ? "#00ff88" : (isUnlocked ? "#ffffff" : "#444444")
    const labelText = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: textColor
    }).setOrigin(0.5)

    // Completion checkmark
    if (isCompleted) {
      const check = this.add.text(btnWidth/2 - 12, -btnHeight/2 + 10, "✓", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#00ff88"
      }).setOrigin(0.5)
      container.add(check)
    }

    container.add([bg, labelText])

    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true })
      bg.on("pointerover", () => {
        this.selectedIndex = this.selectableItems.indexOf(container)
        this.updateSelection()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      })
      bg.on("pointerdown", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.startLevel(levelId, true)
      })
    }

    container.bg = bg
    container.color = borderColor
    container.levelId = levelId
    container.isUnlocked = isUnlocked
    container.itemType = "dynamicLevel"

    return container
  }

  createBonusLevelButton(x, y, label, name, levelId, isCompleted, isUnlocked) {
    const container = this.add.container(x, y)
    const btnWidth = 170
    const btnHeight = 50

    const bgColor = isUnlocked ? 0x2a1a1e : 0x111122
    const borderColor = isCompleted ? 0x00ff88 : (isUnlocked ? 0xffaa00 : 0x333344)
    
    const bg = this.add.rectangle(0, 0, btnWidth, btnHeight, bgColor, 0.9)
    bg.setStrokeStyle(2, borderColor)

    const textColor = isCompleted ? "#00ff88" : (isUnlocked ? "#ffaa00" : "#444444")
    const labelText = this.add.text(-btnWidth/2 + 15, -8, label, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: textColor
    })

    const nameText = this.add.text(-btnWidth/2 + 45, -6, name, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: isUnlocked ? "#888888" : "#444444",
      wordWrap: { width: 110 }
    })

    container.add([bg, labelText, nameText])

    if (isCompleted) {
      const check = this.add.text(btnWidth/2 - 12, -btnHeight/2 + 10, "✓", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#00ff88"
      }).setOrigin(0.5)
      container.add(check)
    }

    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true })
      bg.on("pointerover", () => {
        this.selectedIndex = this.selectableItems.indexOf(container)
        this.updateSelection()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      })
      bg.on("pointerdown", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.startLevel(levelId, true)
      })
    }

    container.bg = bg
    container.color = borderColor
    container.levelId = levelId
    container.isUnlocked = isUnlocked
    container.itemType = "dynamicLevel"

    return container
  }

  createBossLevelButton(x, y, bossName, levelId, isCompleted, isUnlocked) {
    const container = this.add.container(x, y)
    const btnWidth = 400
    const btnHeight = 60

    const bgColor = isUnlocked ? 0x2e1a1a : 0x111122
    const borderColor = isCompleted ? 0x00ff88 : (isUnlocked ? 0xff4444 : 0x333344)
    
    const bg = this.add.rectangle(0, 0, btnWidth, btnHeight, bgColor, 0.9)
    bg.setStrokeStyle(3, borderColor)

    const textColor = isCompleted ? "#00ff88" : (isUnlocked ? "#ff4444" : "#444444")
    
    const bossLabel = this.add.text(0, -10, "⚔ BOSS BATTLE ⚔", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: textColor
    }).setOrigin(0.5)

    const nameText = this.add.text(0, 12, bossName, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: isUnlocked ? "#ffffff" : "#555555"
    }).setOrigin(0.5)

    container.add([bg, bossLabel, nameText])

    if (isCompleted) {
      const check = this.add.text(btnWidth/2 - 20, 0, "✓", {
        fontFamily: "RetroPixel",
        fontSize: "20px",
        color: "#00ff88"
      }).setOrigin(0.5)
      container.add(check)
    }

    if (!isUnlocked) {
      const lockText = this.add.text(0, 35, "Complete all 14 stages to unlock", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#444444"
      }).setOrigin(0.5)
      container.add(lockText)
    }

    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true })
      bg.on("pointerover", () => {
        this.selectedIndex = this.selectableItems.indexOf(container)
        this.updateSelection()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      })
      bg.on("pointerdown", () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.startLevel(levelId, true)
      })
    }

    container.bg = bg
    container.color = borderColor
    container.levelId = levelId
    container.isUnlocked = isUnlocked
    container.itemType = "dynamicLevel"

    return container
  }

  getLegacyLevelColor(index) {
    const colors = [
      0x00ff88, 0x00ff88,  // Easy (1-2)
      0xffff00, 0xffff00,  // Medium (3-4)
      0xffa500,             // Medium-Hard (5)
      0xff6600, 0xff6600, 0xff6600,  // Hard (6-8)
      0xff0000, 0xff0000,  // Very Hard (9-10)
      0xff00ff             // Expert (11)
    ]
    return colors[index] || 0xffffff
  }

  updateSelection() {
    this.selectableItems.forEach((item, index) => {
      if (!item.bg) return
      
      if (index === this.selectedIndex) {
        item.bg.setStrokeStyle(3, 0xffffff)
        item.setScale(1.02)
      } else {
        const color = item.actColor || item.color || 0x444444
        item.bg.setStrokeStyle(2, item.isUnlocked !== false ? color : 0x333344)
        item.setScale(1)
      }
    })

    // Auto-scroll to keep selection visible
    this.scrollToSelection()
  }

  scrollToSelection() {
    if (this.selectableItems.length === 0) return
    
    const selectedItem = this.selectableItems[this.selectedIndex]
    if (!selectedItem) return

    const itemY = selectedItem.y - this.scrollY
    const viewTop = 80
    const viewBottom = this.cameras.main.height - 50

    if (itemY < viewTop + 50) {
      this.scrollY = Math.max(0, selectedItem.y - viewTop - 50)
    } else if (itemY > viewBottom - 50) {
      this.scrollY = Math.min(this.maxScroll, selectedItem.y - viewBottom + 50)
    }

    this.updateScroll()
  }

  updateScroll() {
    this.contentContainer.y = -this.scrollY
  }

  setupInput() {
    // Mouse wheel scrolling
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScroll)
      this.updateScroll()
    })

    // Keyboard navigation
    this.input.keyboard.on("keydown-UP", () => {
      if (this.selectableItems.length === 0) return
      // Cycle to bottom if at top (menu looping)
      if (this.selectedIndex <= 0) {
        this.selectedIndex = this.selectableItems.length - 1
      } else {
        this.selectedIndex--
      }
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      if (this.selectableItems.length === 0) return
      // Cycle to top if at bottom (menu looping)
      if (this.selectedIndex >= this.selectableItems.length - 1) {
        this.selectedIndex = 0
      } else {
        this.selectedIndex++
      }
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    this.input.keyboard.on("keydown-ENTER", () => {
      if (this.selectableItems.length === 0) return
      const item = this.selectableItems[this.selectedIndex]
      if (!item) return

      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      
      if (item.itemType === "world" && item.isUnlocked) {
        this.showLevelSelection(item.worldNum)
      } else if (item.itemType === "level") {
        this.startLevel(item.levelKey, item.isDynamic)
      } else if (item.itemType === "dynamicLevel" && item.isUnlocked) {
        this.startLevel(item.levelId, true)
      }
    })

    this.input.keyboard.on("keydown-ESC", () => {
      this.handleBack()
    })

    // Page up/down for faster scrolling
    this.input.keyboard.on("keydown-PAGE_UP", () => {
      this.scrollY = Math.max(0, this.scrollY - 300)
      this.updateScroll()
    })

    this.input.keyboard.on("keydown-PAGE_DOWN", () => {
      this.scrollY = Math.min(this.maxScroll, this.scrollY + 300)
      this.updateScroll()
    })
  }

  handleBack() {
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    
    if (this.viewMode === "levels") {
      // Go back to world selection
      this.showWorldSelection()
    } else {
      // Go back to title screen
      this.scene.start("TitleScreen")
    }
  }

  startLevel(levelKey, isDynamic) {
    if (isDynamic) {
      // Dynamic level - use DynamicLevelScene with levelId
      this.scene.start("DynamicLevelScene", { levelId: levelKey })
    } else {
      // Legacy level - direct scene start
      this.scene.start(levelKey)
    }
  }
}
