import Phaser from "phaser"
import { LevelDataManager } from "./LevelDataManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * TutorialWorldScene - Tutorial level selection screen
 * Similar to UniverseSelectScene but for tutorial levels (T1, T2, T3, etc.)
 * Displays tutorials as nodes that players can navigate and select
 */
export class TutorialWorldScene extends Phaser.Scene {
  constructor() {
    super({ key: "TutorialWorldScene" })
  }

  async create() {
    this.cameras.main.setBackgroundColor(0x0a1220)
    
    const { width, height } = this.cameras.main
    this.centerX = width / 2
    this.centerY = height / 2

    // Play menu music
    BGMManager.playMenuMusic(this, MENU_KEYS.MAIN_MENU)

    // Show loading indicator
    this.loadingText = this.add.text(width / 2, height / 2, "Loading tutorials...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5)

    // Load tutorial levels from database
    this.tutorialLevels = await LevelDataManager.getTutorialLevels()
    
    // Remove loading indicator
    this.loadingText.destroy()

    // Create background
    this.createBackground()

    // Create title
    this.createTitle()

    // Create tutorial nodes
    this.createTutorialNodes()

    // Create info panel
    this.createInfoPanel()

    // Create back button
    this.createBackButton()

    // Create "No tutorials" message if empty
    if (this.tutorialLevels.length === 0) {
      this.createEmptyMessage()
    }

    // Setup input
    this.setupInput()

    // Initial selection
    this.selectedIndex = 0
    if (this.tutorialLevels.length > 0) {
      this.updateSelection()
    }
  }

  createBackground() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics()
    
    // Create gradient background
    for (let i = 0; i < 20; i++) {
      const alpha = 0.05 - (i * 0.002)
      const y = i * (height / 20)
      graphics.fillStyle(0x00ffff, alpha)
      graphics.fillRect(0, y, width, height / 20)
    }

    // Add some decorative elements
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const size = Phaser.Math.FloatBetween(0.5, 1.5)
      const alpha = Phaser.Math.FloatBetween(0.2, 0.6)
      graphics.fillStyle(0x00ffff, alpha)
      graphics.fillCircle(x, y, size)
    }

    // Grid pattern
    graphics.lineStyle(1, 0x00ffff, 0.05)
    for (let x = 0; x < width; x += 40) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, height)
    }
    for (let y = 0; y < height; y += 40) {
      graphics.moveTo(0, y)
      graphics.lineTo(width, y)
    }
    graphics.strokePath()
  }

  createTitle() {
    const { width } = this.cameras.main

    // Main title
    this.add.text(width / 2, 40, "TUTORIAL WORLD", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#00ffff"
    }).setOrigin(0.5)

    // Subtitle
    this.add.text(width / 2, 75, "Master the basics before the World Tour", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666688"
    }).setOrigin(0.5)

    // Navigation hint
    this.add.text(width / 2, 95, "Arrow Keys to navigate • ENTER to play", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#444466"
    }).setOrigin(0.5)
  }

  createTutorialNodes() {
    const { width, height } = this.cameras.main
    this.tutorialNodes = []

    if (this.tutorialLevels.length === 0) return

    // Calculate node positions - arrange in a flowing grid
    const startY = 160
    const nodeSpacingX = 180
    const nodeSpacingY = 120
    const nodesPerRow = 5
    const startX = width / 2 - ((Math.min(this.tutorialLevels.length, nodesPerRow) - 1) * nodeSpacingX / 2)

    // Draw connection lines
    this.connectionGraphics = this.add.graphics()
    this.connectionGraphics.setDepth(1)

    this.tutorialLevels.forEach((tutorial, index) => {
      const row = Math.floor(index / nodesPerRow)
      const col = index % nodesPerRow
      const x = startX + col * nodeSpacingX
      const y = startY + row * nodeSpacingY

      // Draw connection to previous node
      if (index > 0) {
        const prevRow = Math.floor((index - 1) / nodesPerRow)
        const prevCol = (index - 1) % nodesPerRow
        const prevX = startX + prevCol * nodeSpacingX
        const prevY = startY + prevRow * nodeSpacingY
        
        this.drawConnection(prevX, prevY, x, y)
      }

      // Create node
      const node = this.createNode(x, y, tutorial, index)
      this.tutorialNodes.push(node)
    })
  }

  drawConnection(x1, y1, x2, y2) {
    this.connectionGraphics.lineStyle(2, 0x00ffff, 0.3)
    
    // Draw dotted line
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)
    const dotCount = Math.floor(distance / 12)
    
    for (let i = 0; i <= dotCount; i++) {
      const t = i / dotCount
      const x = x1 + dx * t
      const y = y1 + dy * t
      this.connectionGraphics.fillStyle(0x00ffff, 0.4)
      this.connectionGraphics.fillCircle(x, y, 2)
    }
  }

  createNode(x, y, tutorial, index) {
    const container = this.add.container(x, y)
    container.setDepth(10)

    // Node background - hexagonal shape
    const nodeSize = 50
    const bg = this.add.circle(0, 0, nodeSize, 0x0a1a2a, 0.9)
    bg.setStrokeStyle(3, 0x00ffff)
    container.add(bg)

    // Tutorial code (T1, T2, etc.)
    const codeText = this.add.text(0, -10, tutorial.tutorialCode, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#00ffff"
    }).setOrigin(0.5)
    container.add(codeText)

    // Level title (truncated)
    const title = tutorial.title || "Tutorial"
    const truncatedTitle = title.length > 12 ? title.substring(0, 10) + "..." : title
    const titleText = this.add.text(0, 15, truncatedTitle, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    }).setOrigin(0.5)
    container.add(titleText)

    // Make interactive
    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerdown", () => {
      this.selectedIndex = index
      this.updateSelection()
      this.playTutorial()
    })
    bg.on("pointerover", () => {
      if (this.selectedIndex !== index) {
        bg.setStrokeStyle(3, 0xffffff, 0.8)
      }
    })
    bg.on("pointerout", () => {
      if (this.selectedIndex !== index) {
        bg.setStrokeStyle(3, 0x00ffff)
      }
    })

    // Store references
    container.bg = bg
    container.codeText = codeText
    container.titleText = titleText
    container.tutorial = tutorial

    return container
  }

  createInfoPanel() {
    const { width, height } = this.cameras.main
    
    // Info panel at bottom
    const panelY = height - 80
    const panelBg = this.add.rectangle(width / 2, panelY, 500, 80, 0x0a1a2a, 0.95)
    panelBg.setStrokeStyle(2, 0x00ffff, 0.5)

    // Tutorial info (will be updated on selection)
    this.infoTitle = this.add.text(width / 2, panelY - 20, "", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5)

    this.infoDetails = this.add.text(width / 2, panelY + 10, "", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
  }

  createBackButton() {
    const backBtn = this.add.text(30, 30, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666",
      backgroundColor: "#0a0a1a88",
      padding: { x: 10, y: 5 }
    }).setInteractive({ useHandCursor: true })

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.scene.start("TitleScreen")
    })
  }

  createEmptyMessage() {
    const { width, height } = this.cameras.main

    const emptyContainer = this.add.container(width / 2, height / 2 - 30)

    const msgBg = this.add.rectangle(0, 0, 500, 150, 0x1a1a2e, 0.9)
    msgBg.setStrokeStyle(2, 0x444466)
    emptyContainer.add(msgBg)

    const icon = this.add.text(0, -40, "📝", {
      fontSize: "32px"
    }).setOrigin(0.5)
    emptyContainer.add(icon)

    const msg = this.add.text(0, 10, "No Tutorial Levels Yet", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#888888"
    }).setOrigin(0.5)
    emptyContainer.add(msg)

    const hint = this.add.text(0, 40, "Create levels in the Level Designer and toggle\n'Tutorial Level' in LEVEL SETTINGS to add them here", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666",
      align: "center"
    }).setOrigin(0.5)
    emptyContainer.add(hint)
  }

  setupInput() {
    // Arrow key navigation with cycling (menu looping)
    this.input.keyboard.on("keydown-LEFT", () => {
      if (this.tutorialLevels.length === 0) return
      // Cycle to end if at start
      if (this.selectedIndex <= 0) {
        this.selectedIndex = this.tutorialLevels.length - 1
      } else {
        this.selectedIndex--
      }
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    this.input.keyboard.on("keydown-RIGHT", () => {
      if (this.tutorialLevels.length === 0) return
      // Cycle to start if at end
      if (this.selectedIndex >= this.tutorialLevels.length - 1) {
        this.selectedIndex = 0
      } else {
        this.selectedIndex++
      }
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    this.input.keyboard.on("keydown-UP", () => {
      if (this.tutorialLevels.length === 0) return
      const nodesPerRow = 5
      // Cycle to bottom if at top (menu looping)
      if (this.selectedIndex < nodesPerRow) {
        // Calculate the column and wrap to the last row in that column
        const col = this.selectedIndex % nodesPerRow
        const lastRowStart = Math.floor((this.tutorialLevels.length - 1) / nodesPerRow) * nodesPerRow
        this.selectedIndex = Math.min(lastRowStart + col, this.tutorialLevels.length - 1)
      } else {
        this.selectedIndex -= nodesPerRow
      }
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      if (this.tutorialLevels.length === 0) return
      const nodesPerRow = 5
      // Cycle to top if at bottom (menu looping)
      if (this.selectedIndex + nodesPerRow >= this.tutorialLevels.length) {
        // Calculate the column and wrap to the first row in that column
        const col = this.selectedIndex % nodesPerRow
        this.selectedIndex = col
      } else {
        this.selectedIndex += nodesPerRow
      }
      this.updateSelection()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    // Enter to play
    this.input.keyboard.on("keydown-ENTER", () => {
      if (this.tutorialLevels.length === 0) return
      this.playTutorial()
    })

    // Escape to go back
    this.input.keyboard.on("keydown-ESC", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.scene.start("TitleScreen")
    })
  }

  updateSelection() {
    if (this.tutorialLevels.length === 0) return

    // Update node visuals
    this.tutorialNodes.forEach((node, index) => {
      if (index === this.selectedIndex) {
        node.bg.setStrokeStyle(4, 0xffffff)
        node.setScale(1.1)
        node.codeText.setColor("#ffffff")
      } else {
        node.bg.setStrokeStyle(3, 0x00ffff)
        node.setScale(1)
        node.codeText.setColor("#00ffff")
      }
    })

    // Update info panel
    const tutorial = this.tutorialLevels[this.selectedIndex]
    if (tutorial) {
      this.infoTitle.setText(tutorial.title || "Tutorial")
      
      const dateStr = tutorial.createdAt ? 
        new Date(tutorial.createdAt).toLocaleDateString() : "Unknown"
      const objectCount = tutorial.data?.objects?.length || 0
      this.infoDetails.setText(`${tutorial.tutorialCode} • Created: ${dateStr} • ${objectCount} objects`)
    }
  }

  playTutorial() {
    const tutorial = this.tutorialLevels[this.selectedIndex]
    if (!tutorial) return

    this.sound.play("ui_confirm_sound", { volume: 0.3 })

    // Store return destination for after level completion
    this.registry.set("returnToTutorialWorld", true)
    
    // Use DynamicLevelScene to play the tutorial level properly
    // The levelId from the database (e.g., "Tutorial" or tutorial-specific ID)
    this.scene.start("DynamicLevelScene", {
      levelId: tutorial.id,
      freshStart: true
    })
  }
}
