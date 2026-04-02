import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World6PostBossScene - Post-Boss cutscene for World 6 (Reykjavik)
 * 
 * Story: The beginning of Act II. After conquering the Arctic Isolation boss,
 * Teddy faces the reality of the music industry. Record labels come calling,
 * and the pressure to "sell out" begins.
 */
export class World6PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World6PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 6 }
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

    CutsceneManager.markPostBossWatched(6)

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
      { at: 0, run: () => this.showArcticVictory() },
      { at: 4000, run: () => this.showNorthernLights() },
      { at: 8000, run: () => this.showLabelApproach() },
      { at: 12000, run: () => this.showContractOffer() },
      { at: 16000, run: () => this.showDecisionTime() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showArcticVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Arctic blue background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a1520)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Snowfall
    this.createSnowfall()

    this.titleText = this.add.text(this.centerX, 100, "ISOLATION CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#88ddff",
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
      "The frozen north holds no fear...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aaddff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createSnowfall() {
    for (let i = 0; i < 30; i++) {
      const snow = this.add.circle(
        Phaser.Math.Between(0, this.width),
        -10,
        Phaser.Math.Between(2, 4),
        0xffffff
      ).setAlpha(0.6).setDepth(5)

      this.tweens.add({
        targets: snow,
        y: this.height + 20,
        x: snow.x + Phaser.Math.Between(-50, 50),
        duration: Phaser.Math.Between(3000, 6000),
        delay: i * 100,
        repeat: -1
      })
    }
  }

  showNorthernLights() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Dark arctic sky
    this.currentBg.setFillStyle(0x050812)

    // Northern lights effect
    const colors = [0x00ff88, 0x00ffaa, 0x88ff88, 0x44ffcc]
    for (let i = 0; i < 4; i++) {
      const aurora = this.add.ellipse(
        this.centerX + Phaser.Math.Between(-200, 200),
        150 + i * 50,
        Phaser.Math.Between(300, 500),
        Phaser.Math.Between(30, 60),
        colors[i]
      ).setAlpha(0.3).setDepth(5)

      this.tweens.add({
        targets: aurora,
        x: aurora.x + Phaser.Math.Between(-100, 100),
        alpha: { from: 0.2, to: 0.5 },
        scaleX: { from: 1, to: 1.2 },
        duration: 3000,
        yoyo: true,
        repeat: -1
      })
    }

    this.add.text(this.centerX, 50, "REYKJAVIK, ICELAND", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.dialogText = this.add.text(this.centerX, this.height - 60,
      "\"Beautiful... but something's coming.\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ffaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 800
    })
  }

  showLabelApproach() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x101015)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Corporate figure approaching
    this.add.text(this.centerX, 60, "AN UNEXPECTED VISITOR", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Suit emoji approaching
    const suit = this.add.text(this.width + 100, this.centerY, "🕴️", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    this.tweens.add({
      targets: suit,
      x: this.centerX + 100,
      duration: 1500,
      ease: "Power2"
    })

    // Teddy watching
    this.add.text(this.centerX - 150, this.centerY, "🧸", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, this.height - 60,
      "\"Mr. Bear, we need to talk...\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aaaaaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1500
    })
  }

  showContractOffer() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a0f)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Contract document
    this.add.text(this.centerX, 50, "MEGA RECORDS™", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Contract terms appearing
    const terms = [
      "💰 $10 MILLION ADVANCE",
      "📀 5-ALBUM DEAL",
      "🎬 GLOBAL TOUR",
      "⚠️ Creative Control: LIMITED"
    ]

    terms.forEach((term, i) => {
      const termText = this.add.text(
        this.centerX,
        150 + i * 60,
        term,
        {
          fontFamily: "RetroPixel",
          fontSize: "20px",
          color: i === 3 ? "#ff4444" : "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: termText,
        alpha: 1,
        duration: 400,
        delay: i * 500
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "\"Just sign here... and you're set for life.\"", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2500
    })
  }

  showDecisionTime() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Internal conflict
    this.add.text(this.centerX, 80, "A CHOICE TO MAKE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Teddy thinking
    this.add.text(this.centerX, this.centerY - 30, "🧸💭", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    // Thought options
    this.add.text(this.centerX - 150, this.centerY + 80, "🎸 MUSIC", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ff88"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX + 150, this.centerY + 80, "💰 FAME", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "The industry machine awaits in LA...", {
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

    CutsceneManager.markPostBossWatched(6)

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
