import Phaser from "phaser"
import { WORLDS, WorldManager } from "./WorldManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * UniverseSelectScene - World map showing all 15 worlds
 * Features a spaceship that players navigate from node to node
 * Hovering animation for the spaceship
 */
export class UniverseSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "UniverseSelectScene" })
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0a0a12)
    
    const { width, height } = this.cameras.main
    this.centerX = width / 2
    this.centerY = height / 2

    // Play universe select music (if assigned, otherwise fall back to main menu)
    BGMManager.playMenuMusic(this, MENU_KEYS.UNIVERSE_SELECT)

    // Create background
    this.createBackground()

    // Create title
    this.createTitle()

    // Calculate world positions first
    this.worldPositions = this.calculateWorldPositions(width, height)

    // Create world nodes
    this.createWorldMap()

    // Create act labels
    this.createActLabels()

    // Create spaceship player
    this.createSpaceship()

    // Create progress display
    this.createProgressDisplay()

    // Create info panel
    this.createInfoPanel()

    // Create back button
    this.createBackButton()

    // Setup input
    this.setupInput()

    // Initial selection - find first unlocked world
    this.selectedWorld = this.findFirstSelectableWorld()
    this.updateSelection()
    this.moveSpaceshipToWorld(this.selectedWorld, false) // Instant move
  }

  findFirstSelectableWorld() {
    // Find the furthest unlocked world
    for (let i = 15; i >= 1; i--) {
      if (WorldManager.isWorldUnlocked(i)) {
        return i
      }
    }
    return 1
  }

  createBackground() {
    const { width, height } = this.cameras.main

    // Starfield background
    const graphics = this.add.graphics()
    
    // Create multiple layers of stars for depth
    // Far stars (small, dim)
    for (let i = 0; i < 150; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const size = Phaser.Math.FloatBetween(0.3, 0.8)
      const alpha = Phaser.Math.FloatBetween(0.2, 0.5)
      graphics.fillStyle(0xffffff, alpha)
      graphics.fillCircle(x, y, size)
    }

    // Medium stars
    for (let i = 0; i < 80; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const size = Phaser.Math.FloatBetween(1, 1.5)
      const alpha = Phaser.Math.FloatBetween(0.4, 0.8)
      graphics.fillStyle(0xffffff, alpha)
      graphics.fillCircle(x, y, size)
    }

    // Close stars (larger, brighter, some colored)
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const size = Phaser.Math.FloatBetween(1.5, 2.5)
      const colors = [0xffffff, 0xaaddff, 0xffddaa, 0xffaaaa]
      const color = Phaser.Math.RND.pick(colors)
      graphics.fillStyle(color, Phaser.Math.FloatBetween(0.6, 1))
      graphics.fillCircle(x, y, size)
    }

    // Nebula effect (subtle colored gradients)
    this.createNebulaEffects()

    // Connection lines between worlds
    this.connectionGraphics = this.add.graphics()
    this.connectionGraphics.setDepth(1)
  }

  createNebulaEffects() {
    const { width, height } = this.cameras.main
    
    // Create some subtle colored regions
    const nebulaColors = [0xff69b4, 0x00ffff, 0xa855f7]
    
    for (let i = 0; i < 3; i++) {
      const x = Phaser.Math.Between(100, width - 100)
      const y = Phaser.Math.Between(100, height - 100)
      const radius = Phaser.Math.Between(150, 300)
      
      const nebula = this.add.circle(x, y, radius, nebulaColors[i], 0.03)
      nebula.setBlendMode(Phaser.BlendModes.ADD)
    }
  }

  createTitle() {
    const { width } = this.cameras.main

    // Main title
    this.add.text(width / 2, 35, "WORLD TOUR", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    // Subtitle
    this.add.text(width / 2, 60, "Navigate with Arrow Keys • ENTER to select", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#666666"
    }).setOrigin(0.5)
  }

  createWorldMap() {
    const { width, height } = this.cameras.main
    this.worldNodes = []

    // Draw connection lines first
    this.drawConnections(this.worldPositions)

    // Create world nodes
    for (let worldNum = 1; worldNum <= 15; worldNum++) {
      const world = WORLDS[worldNum]
      const pos = this.worldPositions[worldNum - 1]
      const node = this.createWorldNode(pos.x, pos.y, worldNum, world)
      this.worldNodes.push(node)
    }
  }

  calculateWorldPositions(width, height) {
    const positions = []
    const startY = 130
    const rowHeight = 95
    const margin = 90

    // Act I (Worlds 1-5): Two rows flowing right then left
    // Row 1: 1-3
    positions.push({ x: margin + 100, y: startY })                    // 1: Detroit
    positions.push({ x: margin + 300, y: startY })                    // 2: Berlin
    positions.push({ x: margin + 500, y: startY })                    // 3: Tokyo
    // Row 2: 4-5 (right to left)
    positions.push({ x: margin + 400, y: startY + rowHeight })        // 4: London
    positions.push({ x: margin + 200, y: startY + rowHeight })        // 5: Festival

    // Act II (Worlds 6-10): Two rows
    // Row 3: 6-8 (left to right)
    positions.push({ x: width - margin - 500, y: startY + rowHeight * 2 })  // 6: Reykjavik
    positions.push({ x: width - margin - 300, y: startY + rowHeight * 2 })  // 7: LA
    positions.push({ x: width - margin - 100, y: startY + rowHeight * 2 })  // 8: Sydney
    // Row 4: 9-10 (right to left)
    positions.push({ x: width - margin - 200, y: startY + rowHeight * 3 })  // 9: NYC
    positions.push({ x: width - margin - 400, y: startY + rowHeight * 3 })  // 10: Contract

    // Act III (Worlds 11-15): Two rows
    // Row 5: 11-13 (left to right)
    positions.push({ x: margin + 100, y: startY + rowHeight * 4 })    // 11: Doubt
    positions.push({ x: margin + 300, y: startY + rowHeight * 4 })    // 12: Time
    positions.push({ x: margin + 500, y: startY + rowHeight * 4 })    // 13: Noise
    // Row 6: 14-15 (right to left)
    positions.push({ x: margin + 400, y: startY + rowHeight * 5 })    // 14: Clarity
    positions.push({ x: margin + 200, y: startY + rowHeight * 5 })    // 15: The Diminished Chord

    return positions
  }

  drawConnections(positions) {
    this.connectionGraphics.clear()

    // Draw paths between worlds
    const pathColor = 0x333355
    const unlockedPathColor = 0x00ff88
    const completedPathColor = 0xff69b4

    for (let i = 0; i < positions.length - 1; i++) {
      const from = positions[i]
      const to = positions[i + 1]
      
      const fromWorld = i + 1
      const toWorld = i + 2

      // Determine path color based on unlock status
      let color = pathColor
      let alpha = 0.3
      if (WorldManager.isWorldUnlocked(fromWorld) && WorldManager.isWorldUnlocked(toWorld)) {
        color = unlockedPathColor
        alpha = 0.5
      }
      if (WorldManager.getWorldProgress(fromWorld).completed === 20) {
        color = completedPathColor
        alpha = 0.6
      }

      // Draw dotted path
      this.drawDottedPath(this.connectionGraphics, from.x, from.y, to.x, to.y, color, alpha)
    }
  }

  drawDottedPath(graphics, x1, y1, x2, y2, color, alpha) {
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)
    const dotCount = Math.floor(distance / 15)
    
    for (let i = 0; i <= dotCount; i++) {
      const t = i / dotCount
      const x = x1 + dx * t
      const y = y1 + dy * t
      graphics.fillStyle(color, alpha)
      graphics.fillCircle(x, y, 2)
    }
  }

  createWorldNode(x, y, worldNum, world) {
    const container = this.add.container(x, y)
    container.setDepth(2)

    const isUnlocked = WorldManager.isWorldUnlocked(worldNum)
    const progress = WorldManager.getWorldProgress(worldNum)
    const isCompleted = progress.completed === 20

    // Node background - circle
    const nodeSize = 40
    const bgColor = isCompleted ? 0x2a1a3a : (isUnlocked ? 0x1a1a3e : 0x111118)
    const borderColor = isCompleted ? 0xff69b4 : (isUnlocked ? 0x00ff88 : 0x333344)

    const bg = this.add.circle(0, 0, nodeSize / 2, bgColor)
    bg.setStrokeStyle(2, borderColor)

    // World number or lock icon
    let contentElement
    if (!isUnlocked) {
      // Show lock icon for locked worlds
      contentElement = this.add.image(0, 0, "lock_icon")
      contentElement.setScale(0.04)
      contentElement.setTint(0x555555)
    } else {
      // World number for unlocked worlds
      contentElement = this.add.text(0, 0, `${worldNum}`, {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: isCompleted ? "#ff69b4" : "#ffffff"
      }).setOrigin(0.5)
    }

    // Location name below
    const locationText = this.add.text(0, nodeSize / 2 + 10, world.location, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: isUnlocked ? "#aaaaaa" : "#444444"
    }).setOrigin(0.5)

    // Progress indicator (small dots or bar)
    if (isUnlocked && progress.completed > 0) {
      const progressBarWidth = 40
      const progressBarHeight = 3
      const progressBg = this.add.rectangle(0, nodeSize / 2 + 24, progressBarWidth, progressBarHeight, 0x222244)
      const progressFill = this.add.rectangle(
        -progressBarWidth / 2 + (progressBarWidth * progress.percent / 100) / 2,
        nodeSize / 2 + 24,
        progressBarWidth * progress.percent / 100,
        progressBarHeight,
        isCompleted ? 0xff69b4 : 0x00ff88
      ).setOrigin(0.5)
      container.add([progressBg, progressFill])
    }

    container.add([bg, contentElement, locationText])

    // Store references
    container.worldNum = worldNum
    container.world = world
    container.bg = bg
    container.isUnlocked = isUnlocked
    container.nodeX = x
    container.nodeY = y

    return container
  }

  createSpaceship() {
    // Create spaceship at the first world position
    const startPos = this.worldPositions[0]
    
    this.spaceship = this.add.image(startPos.x, startPos.y - 50, "teddy_spaceship")
    this.spaceship.setScale(0.08)
    this.spaceship.setDepth(10)
    this.spaceship.setOrigin(0.5, 1) // Bottom center

    // Hovering animation (floating up and down)
    this.tweens.add({
      targets: this.spaceship,
      y: this.spaceship.y - 8,
      duration: 1200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })

    // Subtle rotation wobble
    this.tweens.add({
      targets: this.spaceship,
      angle: { from: -3, to: 3 },
      duration: 2000,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })

    // Engine glow effect
    this.createEngineGlow()
  }

  createEngineGlow() {
    // Create a pulsing glow below the spaceship
    this.engineGlow = this.add.circle(
      this.spaceship.x,
      this.spaceship.y + 5,
      8,
      0x00ffff,
      0.4
    )
    this.engineGlow.setDepth(9)
    this.engineGlow.setBlendMode(Phaser.BlendModes.ADD)

    // Pulse the glow
    this.tweens.add({
      targets: this.engineGlow,
      scaleX: { from: 0.8, to: 1.2 },
      scaleY: { from: 0.8, to: 1.2 },
      alpha: { from: 0.3, to: 0.6 },
      duration: 400,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  moveSpaceshipToWorld(worldNum, animate = true) {
    const targetPos = this.worldPositions[worldNum - 1]
    const targetX = targetPos.x
    const targetY = targetPos.y - 50 // Hover above the node

    if (animate) {
      // Stop hovering tween temporarily during move
      this.tweens.killTweensOf(this.spaceship)
      
      // Flip spaceship based on direction
      const goingRight = targetX > this.spaceship.x
      this.spaceship.setFlipX(!goingRight)

      // Animate movement
      this.tweens.add({
        targets: this.spaceship,
        x: targetX,
        y: targetY,
        duration: 400,
        ease: "Power2",
        onComplete: () => {
          // Resume hovering animation
          this.tweens.add({
            targets: this.spaceship,
            y: targetY - 8,
            duration: 1200,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1
          })
          // Reset rotation
          this.tweens.add({
            targets: this.spaceship,
            angle: { from: -3, to: 3 },
            duration: 2000,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1
          })
        }
      })

      // Move engine glow
      this.tweens.add({
        targets: this.engineGlow,
        x: targetX,
        y: targetY + 5,
        duration: 400,
        ease: "Power2"
      })
    } else {
      // Instant move
      this.spaceship.setPosition(targetX, targetY)
      this.engineGlow.setPosition(targetX, targetY + 5)
    }
  }

  createActLabels() {
    const { width, height } = this.cameras.main

    // Act I
    this.add.text(20, 115, "ACT I", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff6b6b"
    })
    this.add.text(20, 128, "THE UNDERGROUND", {
      fontFamily: "RetroPixel",
      fontSize: "7px",
      color: "#ff6b6b88"
    })

    // Act II
    this.add.text(width - 120, 300, "ACT II", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#4ecdc4"
    })
    this.add.text(width - 120, 313, "THE INDUSTRY", {
      fontFamily: "RetroPixel",
      fontSize: "7px",
      color: "#4ecdc488"
    })

    // Act III
    this.add.text(20, 490, "ACT III", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#a855f7"
    })
    this.add.text(20, 503, "INTERNAL BATTLE", {
      fontFamily: "RetroPixel",
      fontSize: "7px",
      color: "#a855f788"
    })
  }

  createProgressDisplay() {
    const { width, height } = this.cameras.main
    const progress = WorldManager.getTotalProgress()

    // Total progress in top right
    this.add.text(width - 20, 35, `${progress.completed}/${progress.total} LEVELS`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ff88"
    }).setOrigin(1, 0.5)

    this.add.text(width - 20, 52, `${progress.percent}% COMPLETE`, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(1, 0.5)
  }

  createInfoPanel() {
    const { width, height } = this.cameras.main

    // Selected world info panel at bottom
    this.infoPanel = this.add.container(width / 2, height - 70)
    
    const infoBg = this.add.rectangle(0, 0, 500, 90, 0x1a1a2e, 0.95)
    infoBg.setStrokeStyle(2, 0x333355)

    this.infoTitle = this.add.text(0, -30, "", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)

    this.infoSubtitle = this.add.text(0, -12, "", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    this.infoDescription = this.add.text(0, 6, "", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888",
      wordWrap: { width: 480 },
      align: "center"
    }).setOrigin(0.5)

    this.infoHint = this.add.text(0, 32, "", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#00ff88"
    }).setOrigin(0.5)

    this.infoPanel.add([infoBg, this.infoTitle, this.infoSubtitle, this.infoDescription, this.infoHint])
  }

  createBackButton() {
    const backBtn = this.add.text(30, this.cameras.main.height - 25, "< BACK TO MENU", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    })
    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("TitleScreen")
    })
  }

  setupInput() {
    // Arrow key navigation - move along the path
    this.input.keyboard.on("keydown-LEFT", () => this.navigateWorld(-1))
    this.input.keyboard.on("keydown-RIGHT", () => this.navigateWorld(1))
    this.input.keyboard.on("keydown-UP", () => this.navigateWorld(-1))
    this.input.keyboard.on("keydown-DOWN", () => this.navigateWorld(1))

    // Select
    this.input.keyboard.on("keydown-ENTER", () => this.selectCurrentWorld())
    this.input.keyboard.on("keydown-SPACE", () => this.selectCurrentWorld())

    // Back - ESC key, "/" key (L shoulder button on controller), or "B" key
    const goBack = () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("TitleScreen")
    }
    this.input.keyboard.on("keydown-ESC", goBack)
    this.input.keyboard.on("keydown-FORWARD_SLASH", goBack)

    // Click on nodes
    this.worldNodes.forEach((node, index) => {
      const worldNum = index + 1
      if (node.isUnlocked) {
        node.bg.setInteractive({ useHandCursor: true })
        node.bg.on("pointerdown", () => {
          if (this.selectedWorld === worldNum) {
            this.selectWorld(worldNum)
          } else {
            this.selectedWorld = worldNum
            this.updateSelection()
            this.moveSpaceshipToWorld(worldNum)
            this.sound.play("ui_select_sound", { volume: 0.2 })
          }
        })
      }
    })
  }

  navigateWorld(delta) {
    let newWorld = this.selectedWorld + delta
    
    // Clamp to valid range
    newWorld = Phaser.Math.Clamp(newWorld, 1, 15)

    // Find next unlocked world in direction
    while (newWorld >= 1 && newWorld <= 15) {
      if (WorldManager.isWorldUnlocked(newWorld)) {
        break
      }
      newWorld += delta > 0 ? 1 : -1
    }

    // Only move if we found a valid unlocked world
    if (newWorld >= 1 && newWorld <= 15 && WorldManager.isWorldUnlocked(newWorld) && newWorld !== this.selectedWorld) {
      this.selectedWorld = newWorld
      this.updateSelection()
      this.moveSpaceshipToWorld(newWorld)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    }
  }

  updateSelection() {
    // Update node visuals
    this.worldNodes.forEach((node, index) => {
      const worldNum = index + 1
      const isSelected = worldNum === this.selectedWorld
      
      if (node.isUnlocked) {
        const progress = WorldManager.getWorldProgress(worldNum)
        const isCompleted = progress.completed === 20
        node.bg.setStrokeStyle(isSelected ? 3 : 2, isSelected ? 0xffffff : (isCompleted ? 0xff69b4 : 0x00ff88))
        node.setScale(isSelected ? 1.1 : 1)
      }
    })

    // Update info panel
    const world = WORLDS[this.selectedWorld]
    if (world) {
      this.infoTitle.setText(`${world.name}`)
      this.infoSubtitle.setText(`${world.location} • Act ${world.act}`)
      this.infoDescription.setText(`🎸 Boss: ${world.bossName}`)

      if (WorldManager.isWorldUnlocked(this.selectedWorld)) {
        const progress = WorldManager.getWorldProgress(this.selectedWorld)
        this.infoHint.setText(`Press ENTER to enter • ${progress.completed}/20 completed`)
        this.infoHint.setColor("#00ff88")
      } else {
        this.infoHint.setText("🔒 Complete previous world to unlock")
        this.infoHint.setColor("#ff4444")
      }
    }
  }

  selectCurrentWorld() {
    if (WorldManager.isWorldUnlocked(this.selectedWorld)) {
      this.selectWorld(this.selectedWorld)
    }
  }

  selectWorld(worldNum) {
    if (!WorldManager.isWorldUnlocked(worldNum)) return

    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    WorldManager.currentWorld = worldNum
    WorldManager.saveProgress()

    // Transition to world level select with zoom effect
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(300, () => {
      this.scene.start("WorldLevelSelectScene", { worldNum })
    })
  }
}
