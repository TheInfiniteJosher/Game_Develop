import Phaser from "phaser"
import { CutsceneManager, CUTSCENE_TYPES } from "./CutsceneManager.js"
import { CutsceneFlowManager, CUTSCENE_SCENE_KEYS } from "./CutsceneFlowManager.js"
import { WORLDS } from "./WorldManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { DevModeManager } from "./DevModeManager.js"

/**
 * CutsceneGalleryScene - Browse and replay all cutscenes
 * Now shows ALL cutscene types organized by category:
 * - Special: Game Intro, Epilogue
 * - World Intros: 15 world intro cutscenes
 * - Post-Boss: 15 post-boss victory cutscenes
 * - Act Endings: 3 end-of-act cinematics
 * - Bonus: Special unlock cutscenes
 * 
 * Developer mode allows viewing all cutscenes regardless of progress
 */
export class CutsceneGalleryScene extends Phaser.Scene {
  constructor() {
    super({ key: "CutsceneGalleryScene" })
  }

  async create() {
    const { width, height } = this.cameras.main
    this.centerX = width / 2
    this.centerY = height / 2
    this.width = width
    this.height = height

    // Check if developer mode should allow all cutscenes
    this.isDevMode = DevModeManager.isDevMode() || this.registry.get("devModeEnabled")
    CutsceneFlowManager.setDevMode(this.isDevMode)

    // Background
    this.cameras.main.setBackgroundColor(0x0a0a12)
    this.createBackground()

    // Title
    this.createTitle()

    // Show loading state
    this.loadingText = this.add.text(this.centerX, this.centerY, "Loading cutscenes...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5)

    // Load cutscenes from Supabase
    await CutsceneManager.loadAllCutscenes()

    // Remove loading text
    this.loadingText.destroy()

    // Category tabs
    this.currentCategory = "worldIntros"
    this.createCategoryTabs()

    // Cutscene grid
    this.createCutsceneGrid()

    // Navigation
    this.createNavigation()

    // Setup input
    this.setupInput()

    // Play menu music
    BGMManager.playMenuMusic(this, MENU_KEYS.MAIN_MENU)
  }

  createBackground() {
    const graphics = this.add.graphics()

    // Starfield-like pattern
    for (let i = 0; i < 100; i++) {
      const x = Phaser.Math.Between(0, this.width)
      const y = Phaser.Math.Between(0, this.height)
      const alpha = Phaser.Math.FloatBetween(0.1, 0.4)
      graphics.fillStyle(0xffffff, alpha)
      graphics.fillCircle(x, y, Phaser.Math.FloatBetween(0.5, 1.5))
    }

    // Film strip decoration on sides
    this.createFilmStripDecoration()
  }

  createFilmStripDecoration() {
    const graphics = this.add.graphics()

    // Left film strip
    graphics.fillStyle(0x1a1a2e, 0.8)
    graphics.fillRect(0, 0, 30, this.height)

    // Film perforations
    for (let y = 20; y < this.height; y += 40) {
      graphics.fillStyle(0x0a0a12, 1)
      graphics.fillRect(8, y, 14, 20)
    }

    // Right film strip
    graphics.fillStyle(0x1a1a2e, 0.8)
    graphics.fillRect(this.width - 30, 0, 30, this.height)

    for (let y = 20; y < this.height; y += 40) {
      graphics.fillStyle(0x0a0a12, 1)
      graphics.fillRect(this.width - 22, y, 14, 20)
    }
  }

  createTitle() {
    // Main title
    this.add.text(this.centerX, 30, "CUTSCENE GALLERY", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    // Progress text
    this.progressText = this.add.text(this.centerX, 55, "Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)

    // Dev mode indicator
    if (this.isDevMode) {
      this.add.text(this.centerX, 75, "🔧 DEVELOPER MODE - All Cutscenes Unlocked", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#ffaa00"
      }).setOrigin(0.5)
    }

    this.updateProgressText()
  }

  updateProgressText() {
    const stats = CutsceneFlowManager.getGalleryStats()
    this.progressText.setText(`${stats.watched} / ${stats.playable} Watched`)
  }

  createCategoryTabs() {
    const tabY = this.isDevMode ? 100 : 85
    const categories = [
      { key: "special", label: "SPECIAL", color: 0xffaa00 },
      { key: "worldIntros", label: "WORLD INTROS", color: 0x00ff88 },
      { key: "postBoss", label: "POST-BOSS", color: 0xff4444 },
      { key: "actEnds", label: "ACT ENDINGS", color: 0x00ffff },
      { key: "bonusUnlocks", label: "BONUS", color: 0xaa44ff }
    ]

    this.categoryTabs = []
    const tabWidth = 150
    const totalWidth = categories.length * tabWidth
    const startX = (this.width - totalWidth) / 2 + tabWidth / 2

    categories.forEach((cat, index) => {
      const x = startX + index * tabWidth
      const tab = this.createCategoryTab(x, tabY, cat.label, cat.key, cat.color)
      this.categoryTabs.push(tab)
    })

    this.updateTabSelection()
  }

  createCategoryTab(x, y, label, key, color) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 140, 28, 0x1a1a2e, 0.9)
    bg.setStrokeStyle(2, color)
    bg.setInteractive({ useHandCursor: true })

    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)

    container.add([bg, text])
    container.key = key
    container.bg = bg
    container.text = text
    container.color = color

    bg.on("pointerdown", () => {
      this.currentCategory = key
      this.updateTabSelection()
      this.createCutsceneGrid()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    return container
  }

  updateTabSelection() {
    this.categoryTabs.forEach(tab => {
      const isSelected = tab.key === this.currentCategory
      tab.bg.setFillStyle(isSelected ? 0x2a2a4e : 0x1a1a2e, 0.9)
      tab.bg.setStrokeStyle(isSelected ? 3 : 2, isSelected ? 0xffffff : tab.color)
      tab.text.setColor(isSelected ? "#ffffff" : Phaser.Display.Color.IntegerToColor(tab.color).rgba)
    })
  }

  createCutsceneGrid() {
    // Clear existing grid
    if (this.gridContainer) {
      this.gridContainer.destroy()
    }
    this.cutsceneCards = []

    const gallery = CutsceneFlowManager.getAllCutscenesForGallery()
    const cutscenes = gallery[this.currentCategory] || []

    // Grid container
    this.gridContainer = this.add.container(0, 0)

    // Grid layout parameters
    const startY = this.isDevMode ? 170 : 150
    const cardWidth = 170
    const cardHeight = 100
    const spacing = 10

    // Calculate columns based on category
    let cols = 5
    if (this.currentCategory === "special" || this.currentCategory === "actEnds") {
      cols = Math.min(cutscenes.length, 4)
    }

    const totalGridWidth = cols * cardWidth + (cols - 1) * spacing
    const startX = (this.width - totalGridWidth) / 2 + cardWidth / 2

    // Create cards
    cutscenes.forEach((cutscene, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      const x = startX + col * (cardWidth + spacing)
      const y = startY + row * (cardHeight + spacing)

      const card = this.createCutsceneCard(x, y, cardWidth, cardHeight, cutscene)
      this.cutsceneCards.push(card)
      this.gridContainer.add(card)
    })

    // If no cutscenes, show message
    if (cutscenes.length === 0) {
      const emptyText = this.add.text(this.centerX, startY + 100, "No cutscenes in this category yet", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#666666"
      }).setOrigin(0.5)
      this.gridContainer.add(emptyText)
    }

    // Initialize selection
    this.selectedIndex = 0
    this.updateSelection()
  }

  createCutsceneCard(x, y, cardWidth, cardHeight, cutscene) {
    const container = this.add.container(x, y)

    const isPlayable = cutscene.isPlayable
    const isWatched = cutscene.isWatched

    // Card background
    const bgColor = isPlayable ? 0x1a1a2e : 0x0f0f1a
    const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, bgColor, 0.9)
    
    // Border color based on state
    let borderColor = 0x333344
    if (isPlayable) {
      borderColor = isWatched ? 0x00ff88 : this.getCategoryColor()
    }
    bg.setStrokeStyle(2, borderColor)
    container.add(bg)

    // Get display info based on cutscene type
    let displayNum = ""
    let displayTitle = cutscene.title || "Unknown"
    let displaySubtitle = ""

    if (cutscene.worldNum) {
      displayNum = `${cutscene.worldNum}`
      displayTitle = cutscene.world?.location || `World ${cutscene.worldNum}`
      displaySubtitle = cutscene.title
    } else if (cutscene.actNum) {
      displayNum = `${cutscene.actNum}`
      displayTitle = `ACT ${cutscene.actNum}`
      displaySubtitle = cutscene.title
    } else if (cutscene.cutscene_type === "intro") {
      displayNum = "★"
      displaySubtitle = "Game Intro"
    } else if (cutscene.cutscene_type === "epilogue") {
      displayNum = "★"
      displaySubtitle = "Epilogue"
    }

    // Number/icon badge
    if (displayNum) {
      const badge = this.add.circle(-cardWidth / 2 + 18, -cardHeight / 2 + 18, 14, 0x0a0a12)
      badge.setStrokeStyle(2, borderColor)
      const badgeText = this.add.text(-cardWidth / 2 + 18, -cardHeight / 2 + 18, displayNum, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: isPlayable ? "#ffffff" : "#666666"
      }).setOrigin(0.5)
      container.add([badge, badgeText])
    }

    // Watched indicator
    if (isWatched && isPlayable) {
      const checkmark = this.add.text(cardWidth / 2 - 14, -cardHeight / 2 + 14, "✓", {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#00ff88"
      }).setOrigin(0.5)
      container.add(checkmark)
    }

    // Title
    const titleColor = isPlayable ? "#ffffff" : "#555555"
    const title = this.add.text(0, -5, displayTitle, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: titleColor
    }).setOrigin(0.5)
    container.add(title)

    // Subtitle
    if (displaySubtitle) {
      const subtitle = this.add.text(0, 12, displaySubtitle, {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: isPlayable ? Phaser.Display.Color.IntegerToColor(this.getCategoryColor()).rgba : "#444444"
      }).setOrigin(0.5)
      container.add(subtitle)
    }

    // Status text
    let statusText = "Coming Soon"
    let statusColor = "#444444"
    if (isPlayable) {
      statusText = isWatched ? "REPLAY" : "NEW"
      statusColor = isWatched ? "#888888" : "#ffaa00"
    }
    const status = this.add.text(0, cardHeight / 2 - 15, statusText, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: statusColor
    }).setOrigin(0.5)
    container.add(status)

    // Lock icon if not playable
    if (!isPlayable) {
      const lockIcon = this.add.text(0, -20, "🔒", {
        fontSize: "18px"
      }).setOrigin(0.5).setAlpha(0.3)
      container.add(lockIcon)
    }

    // Store data
    container.cutsceneData = cutscene
    container.isPlayable = isPlayable
    container.bg = bg
    container.borderColor = borderColor

    // Make interactive
    bg.setInteractive({ useHandCursor: isPlayable })
    bg.on("pointerover", () => {
      const index = this.cutsceneCards.indexOf(container)
      if (index !== -1) {
        this.selectedIndex = index
        this.updateSelection()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      }
    })
    bg.on("pointerdown", () => {
      if (isPlayable) {
        this.playCutscene(cutscene)
      }
    })

    return container
  }

  getCategoryColor() {
    const colors = {
      special: 0xffaa00,
      worldIntros: 0x00ff88,
      postBoss: 0xff4444,
      actEnds: 0x00ffff,
      bonusUnlocks: 0xaa44ff
    }
    return colors[this.currentCategory] || 0xffffff
  }

  updateSelection() {
    this.cutsceneCards.forEach((card, index) => {
      const isSelected = index === this.selectedIndex
      
      if (isSelected) {
        card.bg.setStrokeStyle(3, 0xffffff)
        card.setScale(1.05)
      } else {
        card.bg.setStrokeStyle(2, card.borderColor)
        card.setScale(1)
      }
    })
  }

  playCutscene(cutscene) {
    const sceneKey = cutscene.sceneKey
    if (!sceneKey) {
      this.showNotAvailable()
      return
    }

    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    BGMManager.stop()

    // Mark as watched
    if (cutscene.cutsceneKey) {
      CutsceneManager.markWatched(cutscene.cutsceneKey)
    }

    // Fade out and start cutscene
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(300, () => {
      this.scene.start(sceneKey, {
        returnScene: "CutsceneGalleryScene",
        returnData: {}
      })
    })
  }

  showNotAvailable() {
    const text = this.add.text(this.centerX, this.centerY, "Coming Soon!", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffaa00",
      backgroundColor: "#000000cc",
      padding: { x: 20, y: 15 }
    }).setOrigin(0.5).setDepth(100)

    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 1000,
      duration: 500,
      onComplete: () => text.destroy()
    })
  }

  createNavigation() {
    // Back to menu button
    const backBtn = this.add.text(50, this.height - 30, "< BACK TO MENU", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    })
    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on("pointerover", () => backBtn.setColor("#ff69b4"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("TitleScreen")
    })

    // Category hint
    this.add.text(this.width - 50, this.height - 30, "TAB: Switch Category", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#444444"
    }).setOrigin(1, 0)
  }

  setupInput() {
    // Arrow key navigation
    this.input.keyboard.on("keydown-LEFT", () => this.navigateGrid(-1, 0))
    this.input.keyboard.on("keydown-RIGHT", () => this.navigateGrid(1, 0))
    this.input.keyboard.on("keydown-UP", () => this.navigateGrid(0, -1))
    this.input.keyboard.on("keydown-DOWN", () => this.navigateGrid(0, 1))

    // Tab to switch categories
    this.input.keyboard.on("keydown-TAB", (event) => {
      event.preventDefault()
      this.switchCategory(1)
    })

    // Shift+Tab to switch categories backward
    this.input.keyboard.on("keydown-SHIFT", () => {
      this.shiftHeld = true
    })
    this.input.keyboard.on("keyup-SHIFT", () => {
      this.shiftHeld = false
    })

    // Select
    this.input.keyboard.on("keydown-ENTER", () => this.selectCurrent())
    this.input.keyboard.on("keydown-SPACE", () => this.selectCurrent())

    // Back
    this.input.keyboard.on("keydown-ESC", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("TitleScreen")
    })
  }

  switchCategory(direction) {
    const categories = ["special", "worldIntros", "postBoss", "actEnds", "bonusUnlocks"]
    const currentIndex = categories.indexOf(this.currentCategory)
    let newIndex = (currentIndex + direction + categories.length) % categories.length
    
    this.currentCategory = categories[newIndex]
    this.updateTabSelection()
    this.createCutsceneGrid()
    this.sound.play("ui_select_sound", { volume: 0.2 })
  }

  navigateGrid(dx, dy) {
    if (this.cutsceneCards.length === 0) return

    const cols = this.currentCategory === "special" || this.currentCategory === "actEnds" 
      ? Math.min(this.cutsceneCards.length, 4) : 5
    
    const currentRow = Math.floor(this.selectedIndex / cols)
    const currentCol = this.selectedIndex % cols

    let newCol = currentCol + dx
    let newRow = currentRow + dy

    // Wrap columns
    if (newCol < 0) newCol = cols - 1
    if (newCol >= cols) newCol = 0

    // Clamp rows
    const totalRows = Math.ceil(this.cutsceneCards.length / cols)
    if (newRow < 0) newRow = totalRows - 1
    if (newRow >= totalRows) newRow = 0

    let newIndex = newRow * cols + newCol

    // Make sure we don't go past the end
    if (newIndex >= this.cutsceneCards.length) {
      newIndex = this.cutsceneCards.length - 1
    }

    if (newIndex !== this.selectedIndex && newIndex >= 0) {
      this.selectedIndex = newIndex
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    }
  }

  selectCurrent() {
    if (this.cutsceneCards.length === 0) return
    
    const card = this.cutsceneCards[this.selectedIndex]
    if (card && card.isPlayable) {
      this.playCutscene(card.cutsceneData)
    } else {
      this.showNotAvailable()
    }
  }
}
