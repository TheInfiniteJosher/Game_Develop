import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * Act1EndScene - End of Act I Cinematic: "Rise from the Underground"
 * 
 * Story: The culmination of the underground journey. From Detroit basements
 * to Berlin warehouses, Tokyo neon, London rain, and finally the festival
 * breakthrough. Teddy has risen from obscurity to recognition.
 * 
 * This is a longer, more impactful cinematic marking a major story milestone.
 */
export class Act1EndScene extends Phaser.Scene {
  constructor() {
    super({ key: "Act1EndScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "UniverseSelectScene"
    this.returnData = data.returnData || {}
  }

  create() {
    this.centerX = this.cameras.main.width / 2
    this.centerY = this.cameras.main.height / 2
    this.width = this.cameras.main.width
    this.height = this.cameras.main.height

    this.cutsceneSkipped = false
    this.cutsceneComplete = false

    this.blackOverlay = this.add.rectangle(
      0, 0, this.width, this.height, 0x000000
    ).setOrigin(0, 0).setDepth(100)

    BGMManager.playMenuMusic(this, MENU_KEYS.INTRO)

    this.setupSkipControls()
    this.createSkipHint()
    this.startCutsceneSequence()
  }

  setupSkipControls() {
    this.input.keyboard.on("keydown", () => this.skipCutscene())
    this.input.on("pointerdown", () => this.skipCutscene())
  }

  createSkipHint() {
    this.skipHint = this.add.text(
      this.width - 20, this.height - 30,
      "Press any key to skip",
      { fontFamily: "RetroPixel", fontSize: "14px", color: "#666666" }
    ).setOrigin(1, 0.5).setAlpha(0).setDepth(101)

    this.time.delayedCall(2000, () => {
      if (!this.cutsceneSkipped) {
        this.tweens.add({ targets: this.skipHint, alpha: 0.7, duration: 500 })
      }
    })
  }

  skipCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneSkipped = true

    this.tweens.killAll()
    this.time.removeAllEvents()

    CutsceneManager.markWatched("act_1_end")

    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 1,
      duration: 300,
      onComplete: () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        BGMManager.stop()
        this.scene.start(this.returnScene, this.returnData)
      }
    })
  }

  startCutsceneSequence() {
    const timeline = this.add.timeline([
      { at: 0, run: () => this.showActTitle() },
      { at: 5000, run: () => this.showJourneyMontage() },
      { at: 12000, run: () => this.showBreakthroughMoment() },
      { at: 18000, run: () => this.showRiseVisualization() },
      { at: 24000, run: () => this.showNewChapter() },
      { at: 30000, run: () => this.showActTwoTeaser() },
      { at: 36000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showActTitle() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 2000
    })

    // Dark background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Act I title
    this.actText = this.add.text(this.centerX, this.centerY - 60, "ACT I", {
      fontFamily: "RetroPixel",
      fontSize: "48px",
      color: "#ff4466",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.titleText = this.add.text(this.centerX, this.centerY + 20, 
      "THE UNDERGROUND", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.actText,
      alpha: 1,
      y: { from: this.centerY - 40, to: this.centerY - 60 },
      duration: 1500,
      delay: 1000
    })

    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      duration: 1500,
      delay: 2000
    })

    this.subtitleText = this.add.text(this.centerX, this.centerY + 80,
      "COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      scale: { from: 0.8, to: 1 },
      duration: 800,
      delay: 3500,
      ease: "Back.easeOut"
    })
  }

  showJourneyMontage() {
    this.flashTransition()

    if (this.actText) this.actText.destroy()
    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    this.currentBg.setFillStyle(0x030305)

    this.add.text(this.centerX, 50, "THE JOURNEY", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Five worlds montage
    const worlds = [
      { name: "DETROIT", color: "#ff4466", emoji: "🏚️", desc: "Where it began" },
      { name: "BERLIN", color: "#88aaff", emoji: "🏭", desc: "Industrial fusion" },
      { name: "TOKYO", color: "#ff00ff", emoji: "🗼", desc: "Neon dreams" },
      { name: "LONDON", color: "#8888ff", emoji: "🌧️", desc: "Punk heritage" },
      { name: "FESTIVAL", color: "#ffaa00", emoji: "🎪", desc: "Breakthrough" }
    ]

    worlds.forEach((world, i) => {
      const container = this.add.container(
        150 + i * 180,
        this.centerY
      )

      const emoji = this.add.text(0, -30, world.emoji, {
        fontSize: "40px"
      }).setOrigin(0.5)

      const name = this.add.text(0, 20, world.name, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: world.color
      }).setOrigin(0.5)

      const desc = this.add.text(0, 45, world.desc, {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#666666"
      }).setOrigin(0.5)

      container.add([emoji, name, desc])
      container.setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: container,
        alpha: 1,
        y: { from: this.centerY + 30, to: this.centerY },
        duration: 600,
        delay: i * 800
      })
    })

    // Connecting line
    this.time.delayedCall(4500, () => {
      if (this.cutsceneSkipped) return
      const line = this.add.rectangle(
        this.centerX, this.centerY + 80,
        700, 3, 0xff4466
      ).setAlpha(0).setDepth(30)

      this.tweens.add({
        targets: line,
        alpha: 0.5,
        scaleX: { from: 0, to: 1 },
        duration: 1000
      })
    })
  }

  showBreakthroughMoment() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "THE BREAKTHROUGH", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Festival stage with crowd
    this.add.text(this.centerX, this.centerY - 50, "🧸🎸", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    // Crowd below
    const crowdRow = "👤".repeat(15)
    for (let i = 0; i < 3; i++) {
      this.add.text(this.centerX, this.centerY + 80 + i * 40, crowdRow, {
        fontSize: "20px"
      }).setOrigin(0.5).setAlpha(0.3 + i * 0.2).setDepth(30)
    }

    // Spotlights
    for (let i = 0; i < 5; i++) {
      const light = this.add.triangle(
        200 + i * 180, 0,
        0, 0, 40, 200, -40, 200,
        [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff][i]
      ).setOrigin(0.5, 0).setAlpha(0.15).setDepth(10)

      this.tweens.add({
        targets: light,
        rotation: { from: -0.2, to: 0.2 },
        duration: 2000 + i * 200,
        yoyo: true,
        repeat: -1
      })
    }

    this.add.text(this.centerX, this.height - 50,
      "From 47 views to 50,000 fans...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 3000
    })
  }

  showRiseVisualization() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000008)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 50, "THE RISE", {
      fontFamily: "RetroPixel",
      fontSize: "30px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Rising graph visualization
    const graphPoints = [
      { x: 100, y: 500 },
      { x: 250, y: 450 },
      { x: 400, y: 380 },
      { x: 550, y: 280 },
      { x: 700, y: 150 },
      { x: 850, y: 100 }
    ]

    // Draw line connecting points
    for (let i = 0; i < graphPoints.length - 1; i++) {
      const line = this.add.line(
        0, 0,
        graphPoints[i].x, graphPoints[i].y,
        graphPoints[i + 1].x, graphPoints[i + 1].y,
        0x00ff88
      ).setOrigin(0, 0).setLineWidth(3).setAlpha(0).setDepth(30)

      this.tweens.add({
        targets: line,
        alpha: 1,
        duration: 500,
        delay: i * 600
      })
    }

    // Teddy climbing the graph
    const teddy = this.add.text(100, 500, "🧸", {
      fontSize: "40px"
    }).setOrigin(0.5).setDepth(40)

    this.tweens.add({
      targets: teddy,
      x: 850,
      y: 100,
      duration: 4000,
      delay: 500,
      ease: "Power2"
    })

    this.add.text(this.centerX, this.height - 50,
      "Underground no more.", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#00ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 4500
    })
  }

  showNewChapter() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, this.centerY - 80,
      "A NEW CHAPTER BEGINS", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY,
      "But with recognition comes...", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 60,
      "THE INDUSTRY", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff4444"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 1000,
      delay: 2000
    })
  }

  showActTwoTeaser() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Act II teaser
    this.add.text(this.centerX, this.centerY - 60, "COMING NEXT", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#666666"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY, "ACT II", {
      fontFamily: "RetroPixel",
      fontSize: "40px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 50, "THE INDUSTRY", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Ominous corporate symbols
    this.add.text(this.centerX, this.height - 80,
      "💼 📝 💰 ⚖️", {
      fontSize: "30px"
    }).setOrigin(0.5).setAlpha(0.5).setDepth(40)

    this.add.text(this.centerX, this.height - 40,
      "The real battle begins...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff4444"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 3000
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markWatched("act_1_end")

    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 1,
      duration: 1500,
      onComplete: () => {
        BGMManager.stop()
        this.scene.start(this.returnScene, this.returnData)
      }
    })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xffffff)
    flash.setOrigin(0, 0).setAlpha(0).setDepth(99)

    this.tweens.add({
      targets: flash,
      alpha: 0.6,
      duration: 80,
      yoyo: true,
      onComplete: () => flash.destroy()
    })
  }
}
