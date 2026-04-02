import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World14PostBossScene - Post-Boss cutscene for World 14 (Clarity)
 * 
 * Story: After achieving Clarity, Teddy finally understands his purpose.
 * It was never about fame or fortune - it was about creating something
 * real, something that matters. The final confrontation awaits.
 */
export class World14PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World14PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 14 }
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

    CutsceneManager.markPostBossWatched(14)

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
      { at: 0, run: () => this.showClarityVictory() },
      { at: 4000, run: () => this.showEnlightenment() },
      { at: 8000, run: () => this.showPurpose() },
      { at: 12000, run: () => this.showReadyForFinal() },
      { at: 16000, run: () => this.showFinalChallenge() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showClarityVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Pure white space
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x101020)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Soft light rays
    this.createLightRays()

    this.titleText = this.add.text(this.centerX, 100, "CLARITY ACHIEVED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffffff",
      stroke: "#4488ff",
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
      "The fog lifts. The path is clear.", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aaccff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createLightRays() {
    for (let i = 0; i < 6; i++) {
      const ray = this.add.triangle(
        this.centerX + (i - 2.5) * 150,
        0,
        0, 0,
        50, this.height,
        -50, this.height,
        0xffffff
      ).setOrigin(0.5, 0).setAlpha(0.05).setDepth(5)

      this.tweens.add({
        targets: ray,
        alpha: { from: 0.02, to: 0.08 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        delay: i * 300
      })
    }
  }

  showEnlightenment() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Moment of understanding
    this.currentBg.setFillStyle(0x081018)

    this.add.text(this.centerX, 50, "ENLIGHTENMENT", {
      fontFamily: "RetroPixel",
      fontSize: "30px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Teddy in meditation pose
    this.add.text(this.centerX, this.centerY, "🧸🧘", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    // Glowing aura
    const aura = this.add.circle(this.centerX, this.centerY, 100, 0x4488ff, 0.2)
    aura.setDepth(35)

    this.tweens.add({
      targets: aura,
      scale: { from: 1, to: 1.5 },
      alpha: { from: 0.2, to: 0 },
      duration: 2000,
      repeat: -1
    })

    this.add.text(this.centerX, this.height - 60,
      "\"I finally understand...\"", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#88ccff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  showPurpose() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x051015)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // The revelation
    this.add.text(this.centerX, 50, "THE PURPOSE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Core truths revealed
    const truths = [
      "Music was never about fame",
      "It's about CONNECTION",
      "It's about EXPRESSION",
      "It's about being TRUE"
    ]

    truths.forEach((truth, i) => {
      const truthText = this.add.text(
        this.centerX,
        150 + i * 60,
        truth,
        {
          fontFamily: "RetroPixel",
          fontSize: i === 0 ? "18px" : "22px",
          color: i === 0 ? "#888888" : "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: truthText,
        alpha: 1,
        duration: 500,
        delay: i * 600
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "\"This is why I started. This is why I continue.\"", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2800
    })
  }

  showReadyForFinal() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Ready for battle
    this.add.text(this.centerX, 80, "READY", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Teddy powered up
    this.add.text(this.centerX, this.centerY, "🧸⚡🎸", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    // Power aura
    const powerCircle = this.add.circle(this.centerX, this.centerY, 80, 0xffcc00, 0)
    powerCircle.setStrokeStyle(3, 0xffcc00).setDepth(35)

    this.tweens.add({
      targets: powerCircle,
      scale: { from: 1, to: 2 },
      alpha: { from: 1, to: 0 },
      duration: 1000,
      repeat: -1
    })

    this.add.text(this.centerX, this.height - 60,
      "\"I know who I am now. I'm ready.\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)
  }

  showFinalChallenge() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000005)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // The final challenge
    this.add.text(this.centerX, this.centerY - 80, "ONE FINAL CHALLENGE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY,
      "THE DIMINISHED CHORD", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff4488"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 60,
      "The incomplete piece that started it all...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "Face your ultimate test.", {
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

    CutsceneManager.markPostBossWatched(14)

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
