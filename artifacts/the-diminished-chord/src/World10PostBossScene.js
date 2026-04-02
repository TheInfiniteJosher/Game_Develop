import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World10PostBossScene - Post-Boss cutscene for World 10 (Contract Trap)
 * 
 * Story: The climax of Act II. After defeating the Auto-Tune Entity,
 * Teddy breaks free from the label's contract through a loophole.
 * But freedom comes at a cost - all resources, support, and connections are gone.
 */
export class World10PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World10PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 10 }
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

    CutsceneManager.markPostBossWatched(10)

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
      { at: 0, run: () => this.showContractVictory() },
      { at: 4000, run: () => this.showLoopholeDiscovery() },
      { at: 8000, run: () => this.showContractTearing() },
      { at: 12000, run: () => this.showFreedomCost() },
      { at: 16000, run: () => this.showAloneButFree() },
      { at: 20000, run: () => this.showActTwoComplete() },
      { at: 24000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showContractVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Corporate nightmare background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x100505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Digital glitch effect
    this.createGlitchEffect()

    this.titleText = this.add.text(this.centerX, 100, "CONTRACT ESCAPED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#00ff88",
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
      "The chains are broken...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ffaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createGlitchEffect() {
    for (let i = 0; i < 10; i++) {
      const glitch = this.add.rectangle(
        Phaser.Math.Between(0, this.width),
        Phaser.Math.Between(0, this.height),
        Phaser.Math.Between(50, 200),
        Phaser.Math.Between(2, 10),
        [0xff0000, 0x00ff00, 0x0000ff][Phaser.Math.Between(0, 2)]
      ).setAlpha(0).setDepth(10)

      this.tweens.add({
        targets: glitch,
        alpha: { from: 0.5, to: 0 },
        x: glitch.x + Phaser.Math.Between(-50, 50),
        duration: 200,
        delay: i * 300,
        repeat: -1,
        repeatDelay: 1000
      })
    }
  }

  showLoopholeDiscovery() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Lawyer's office
    this.currentBg.setFillStyle(0x0a0a10)

    this.add.text(this.centerX, 50, "THE LOOPHOLE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Contract document with highlighted text
    const contract = this.add.rectangle(
      this.centerX, this.centerY,
      400, 300, 0xeeeeee
    ).setDepth(30)

    // Highlighted clause
    const highlight = this.add.rectangle(
      this.centerX, this.centerY + 20,
      350, 40, 0xffff00
    ).setAlpha(0.5).setDepth(35)

    this.tweens.add({
      targets: highlight,
      alpha: { from: 0.3, to: 0.7 },
      duration: 500,
      yoyo: true,
      repeat: -1
    })

    this.add.text(this.centerX, this.centerY + 20,
      "\"...void if artistic integrity compromised...\"", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#000000"
    }).setOrigin(0.5).setDepth(40)

    // Teddy and lawyer
    this.add.text(this.centerX - 250, this.centerY, "👨‍⚖️", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX + 250, this.centerY, "🧸😲", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)
  }

  showContractTearing() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Contract being torn
    this.add.text(this.centerX, 50, "FREEDOM", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Contract halves flying apart
    const leftHalf = this.add.text(this.centerX - 50, this.centerY, "📃", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    const rightHalf = this.add.text(this.centerX + 50, this.centerY, "📃", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40).setFlipX(true)

    this.tweens.add({
      targets: leftHalf,
      x: -100,
      rotation: -0.5,
      alpha: 0,
      duration: 1500
    })

    this.tweens.add({
      targets: rightHalf,
      x: this.width + 100,
      rotation: 0.5,
      alpha: 0,
      duration: 1500
    })

    // Teddy celebrating
    this.time.delayedCall(500, () => {
      if (this.cutsceneSkipped) return
      this.add.text(this.centerX, this.centerY, "🧸🎉", {
        fontSize: "80px"
      }).setOrigin(0.5).setDepth(45)
    })

    this.add.text(this.centerX, this.height - 60,
      "\"I'M FREE!\"", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  showFreedomCost() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x080508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // The cost of freedom
    this.add.text(this.centerX, 50, "THE COST", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff4444"
    }).setOrigin(0.5).setDepth(50)

    // Things lost
    const losses = [
      "❌ Label Support",
      "❌ Tour Budget",
      "❌ Marketing",
      "❌ Industry Connections",
      "❌ Radio Play"
    ]

    losses.forEach((loss, i) => {
      const lossText = this.add.text(
        this.centerX,
        130 + i * 50,
        loss,
        {
          fontFamily: "RetroPixel",
          fontSize: "18px",
          color: "#ff8888"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: lossText,
        alpha: 1,
        x: { from: this.centerX - 100, to: this.centerX },
        duration: 300,
        delay: i * 400
      })
    })

    this.add.text(this.centerX, this.height - 60,
      "But you still have your music...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2500
    })
  }

  showAloneButFree() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000008)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Alone on empty road
    this.add.text(this.centerX, this.centerY - 50, "🧸🎸", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    // Empty road stretching ahead
    this.add.text(this.centerX, this.height - 150, "━━━━━━━━━━━━━━━", {
      fontFamily: "RetroPixel",
      fontSize: "30px",
      color: "#333344"
    }).setOrigin(0.5).setDepth(30)

    this.add.text(this.centerX, 80, "ALONE, BUT FREE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 60,
      "\"Time to face myself...\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aaaaff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1500
    })
  }

  showActTwoComplete() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Act complete text
    this.add.text(this.centerX, this.centerY - 60, "ACT II COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY, "THE INDUSTRY", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Teaser for Act III
    this.add.text(this.centerX, this.centerY + 80,
      "The external battle is won...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 1000,
      delay: 1000
    })

    this.add.text(this.centerX, this.height - 50,
      "Act III: The Internal Battle begins with Self-Doubt...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#444444"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2500
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markPostBossWatched(10)

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
