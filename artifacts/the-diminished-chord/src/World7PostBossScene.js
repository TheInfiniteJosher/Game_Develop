import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World7PostBossScene - Post-Boss cutscene for World 7 (Los Angeles)
 * 
 * Story: After conquering the Hollywood Hustle boss, Teddy navigates the
 * shallow waters of LA. The label pushes for a more "commercial" sound,
 * and the first cracks in the dream appear.
 */
export class World7PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World7PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 7 }
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

    CutsceneManager.markPostBossWatched(7)

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
      { at: 0, run: () => this.showHollywoodVictory() },
      { at: 4000, run: () => this.showStudioSession() },
      { at: 8000, run: () => this.showProducerConflict() },
      { at: 12000, run: () => this.showCompromise() },
      { at: 16000, run: () => this.showHollywoodNight() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showHollywoodVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // LA sunset background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a0a05)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Palm tree silhouettes
    const palmPositions = [100, 300, 800, 1000]
    palmPositions.forEach(x => {
      this.add.text(x, this.height - 100, "🌴", {
        fontSize: "80px"
      }).setOrigin(0.5, 1).setAlpha(0.3).setDepth(5)
    })

    this.titleText = this.add.text(this.centerX, 100, "HUSTLE CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff8844",
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
      "Welcome to the machine...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffaa88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  showStudioSession() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Recording studio
    this.currentBg.setFillStyle(0x0a0a10)

    this.add.text(this.centerX, 50, "MEGA RECORDS STUDIO A", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Mixing console
    const console = this.add.rectangle(
      this.centerX, this.centerY + 50,
      400, 100, 0x222233
    ).setDepth(30)

    // Level meters
    for (let i = 0; i < 10; i++) {
      const meter = this.add.rectangle(
        this.centerX - 180 + i * 40,
        this.centerY,
        20,
        Phaser.Math.Between(30, 80),
        i < 7 ? 0x00ff00 : (i < 9 ? 0xffff00 : 0xff0000)
      ).setOrigin(0.5, 1).setDepth(35)

      this.tweens.add({
        targets: meter,
        scaleY: Phaser.Math.FloatBetween(0.5, 1.2),
        duration: Phaser.Math.Between(100, 300),
        yoyo: true,
        repeat: -1
      })
    }

    this.dialogText = this.add.text(this.centerX, this.height - 60,
      "\"Let's make some magic!\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 800
    })
  }

  showProducerConflict() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x100808)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Conflict scene
    this.add.text(this.centerX, 50, "CREATIVE DIFFERENCES", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#ff4444"
    }).setOrigin(0.5).setDepth(50)

    // Producer vs Teddy
    this.add.text(this.centerX - 150, this.centerY, "🕴️", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX + 150, this.centerY, "🧸", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    // Lightning bolt between
    this.add.text(this.centerX, this.centerY, "⚡", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(45)

    // Producer's demands
    const demands = [
      "\"More pop hooks!\"",
      "\"Less distortion!\"",
      "\"Think radio!\""
    ]

    demands.forEach((demand, i) => {
      this.add.text(
        this.centerX - 200,
        200 + i * 40,
        demand,
        {
          fontFamily: "RetroPixel",
          fontSize: "14px",
          color: "#ff8888"
        }
      ).setOrigin(0, 0.5).setAlpha(0.8).setDepth(50)
    })
  }

  showCompromise() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a0f)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Uneasy compromise
    this.add.text(this.centerX, 60, "THE COMPROMISE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Handshake with reluctance
    this.add.text(this.centerX, this.centerY - 30, "🤝", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, this.centerY + 80,
      "\"Fine. ONE radio edit...\"", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffaa00"
    }).setOrigin(0.5).setDepth(50)

    // But at what cost?
    this.add.text(this.centerX, this.height - 60,
      "But at what cost?", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666",
      fontStyle: "italic"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2000
    })
  }

  showHollywoodNight() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Hollywood sign at night
    this.add.text(this.centerX, 100, "HOLLYWOOD", {
      fontFamily: "RetroPixel",
      fontSize: "40px",
      color: "#ffffff",
      stroke: "#ff0088",
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(50)

    // City lights
    for (let i = 0; i < 20; i++) {
      const light = this.add.circle(
        Phaser.Math.Between(50, this.width - 50),
        Phaser.Math.Between(300, this.height - 100),
        Phaser.Math.Between(2, 5),
        [0xffff00, 0xffffff, 0xff8800][Phaser.Math.Between(0, 2)]
      ).setAlpha(0.5).setDepth(10)

      this.tweens.add({
        targets: light,
        alpha: { from: 0.3, to: 0.8 },
        duration: Phaser.Math.Between(500, 1500),
        yoyo: true,
        repeat: -1
      })
    }

    // Teddy alone on balcony
    this.add.text(this.centerX, this.centerY + 50, "🧸", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, this.height - 50,
      "Sydney's arena awaits... bigger crowds, bigger pressure.", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
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

    CutsceneManager.markPostBossWatched(7)

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
