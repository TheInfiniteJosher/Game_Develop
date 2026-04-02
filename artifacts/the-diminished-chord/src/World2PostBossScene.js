import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World2PostBossScene - Post-Boss cutscene for World 2 (Berlin)
 * 
 * Story: After defeating the Industrial Warehouse boss, Teddy discovers the
 * European underground scene. The raw Detroit sound meets German industrial,
 * creating a unique fusion that attracts the attention of international fans.
 */
export class World2PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World2PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 2 }
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

    this.time.delayedCall(1500, () => {
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

    CutsceneManager.markPostBossWatched(2)

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
      { at: 0, run: () => this.showWarehouseVictory() },
      { at: 4000, run: () => this.showBerlinNightlife() },
      { at: 8000, run: () => this.showCollaboration() },
      { at: 12000, run: () => this.showIndustrialFusion() },
      { at: 16000, run: () => this.showEuropeanSpread() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showWarehouseVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Industrial warehouse background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a1a1f)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Metallic sparks
    this.createSparks()

    this.titleText = this.add.text(this.centerX, 100, "WAREHOUSE CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#88aacc",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      scale: { from: 0.8, to: 1 },
      duration: 800,
      ease: "Back.easeOut"
    })

    this.subtitleText = this.add.text(this.centerX, this.height - 80,
      "The industrial heartbeat of Berlin falls silent...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createSparks() {
    for (let i = 0; i < 10; i++) {
      const spark = this.add.circle(
        Phaser.Math.Between(100, this.width - 100),
        Phaser.Math.Between(100, this.height - 100),
        Phaser.Math.Between(2, 4),
        0xffaa44
      ).setDepth(30).setAlpha(0)

      this.tweens.add({
        targets: spark,
        alpha: { from: 1, to: 0 },
        x: spark.x + Phaser.Math.Between(-50, 50),
        y: spark.y + Phaser.Math.Between(20, 60),
        duration: Phaser.Math.Between(500, 1500),
        delay: i * 150,
        onComplete: () => spark.destroy()
      })
    }
  }

  showBerlinNightlife() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Neon-tinted night scene
    this.currentBg.setFillStyle(0x0a0a1a)

    // Neon signs
    this.neonText = this.add.text(this.centerX, 80, "BERLIN UNDERGROUND", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff00ff"
    }).setOrigin(0.5).setDepth(50)

    // Pulsing neon effect
    this.tweens.add({
      targets: this.neonText,
      alpha: { from: 0.7, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1
    })

    // Club atmosphere icons
    const icons = ["🎧", "💀", "⚡", "🖤"]
    icons.forEach((icon, i) => {
      const iconText = this.add.text(
        200 + i * 200,
        this.centerY,
        icon,
        { fontSize: "50px" }
      ).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: iconText,
        alpha: 1,
        rotation: 0.1,
        duration: 400,
        delay: i * 200
      })
    })

    this.dialogText = this.add.text(this.centerX, this.height - 80,
      "\"Die Musik ist universal!\"", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#aaaaaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 800
    })
  }

  showCollaboration() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x151520)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Two figures meeting
    this.add.text(this.centerX - 100, this.centerY, "🧸", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX + 100, this.centerY, "🤖", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    // Connection line
    const line = this.add.line(
      this.centerX, this.centerY,
      -50, 0, 50, 0,
      0x00ffff
    ).setDepth(30).setAlpha(0)

    this.tweens.add({
      targets: line,
      alpha: 1,
      duration: 800,
      delay: 500
    })

    this.add.text(this.centerX, 80, "A NEW SOUND IS BORN", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 60,
      "Punk meets Industrial", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#666666"
    }).setOrigin(0.5).setDepth(50)
  }

  showIndustrialFusion() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0d0d15)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Sound wave visualization
    for (let i = 0; i < 20; i++) {
      const bar = this.add.rectangle(
        100 + i * 50,
        this.centerY,
        30,
        Phaser.Math.Between(50, 200),
        i % 2 === 0 ? 0xff4466 : 0x4466ff
      ).setDepth(30)

      this.tweens.add({
        targets: bar,
        scaleY: Phaser.Math.FloatBetween(0.5, 1.5),
        duration: Phaser.Math.Between(200, 400),
        yoyo: true,
        repeat: -1
      })
    }

    this.add.text(this.centerX, 60, "INDUSTRIAL PUNK FUSION", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "🔊 The sound that shakes warehouses 🔊", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)
  }

  showEuropeanSpread() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a12)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Map spreading effect
    this.add.text(this.centerX, 80, "THE SOUND SPREADS", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ff88"
    }).setOrigin(0.5).setDepth(50)

    // City names appearing
    const cities = ["AMSTERDAM", "PRAGUE", "WARSAW", "COPENHAGEN"]
    cities.forEach((city, i) => {
      const cityText = this.add.text(
        this.centerX + Phaser.Math.Between(-200, 200),
        this.centerY + Phaser.Math.Between(-100, 100),
        city,
        {
          fontFamily: "RetroPixel",
          fontSize: "14px",
          color: "#44ff88"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: cityText,
        alpha: 1,
        scale: { from: 0.5, to: 1 },
        duration: 400,
        delay: i * 400
      })
    })

    this.add.text(this.centerX, this.height - 60,
      "Next stop: Tokyo... where neon meets noise.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2000
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markPostBossWatched(2)

    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 1,
      duration: 1000,
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
