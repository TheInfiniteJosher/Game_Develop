import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World12PostBossScene - Post-Boss cutscene for World 12 (Time Fracture)
 * 
 * Story: After navigating the Time Fracture, Teddy experiences glimpses of
 * alternate timelines - what could have been. He sees versions of himself
 * that took different paths, and realizes his choice was the right one.
 */
export class World12PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World12PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 12 }
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

    CutsceneManager.markPostBossWatched(12)

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
      { at: 0, run: () => this.showTimeVictory() },
      { at: 4000, run: () => this.showAlternateTimeline1() },
      { at: 8000, run: () => this.showAlternateTimeline2() },
      { at: 12000, run: () => this.showAlternateTimeline3() },
      { at: 16000, run: () => this.showRightChoice() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showTimeVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Time-warped space
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Temporal distortion effect
    this.createTimeDistortion()

    this.titleText = this.add.text(this.centerX, 100, "TIME CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#44aaff",
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
      "The threads of time unravel...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ccff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createTimeDistortion() {
    // Clock hands spinning
    for (let i = 0; i < 8; i++) {
      const clock = this.add.text(
        Phaser.Math.Between(100, this.width - 100),
        Phaser.Math.Between(100, this.height - 100),
        "🕐",
        { fontSize: "30px" }
      ).setOrigin(0.5).setAlpha(0.3).setDepth(10)

      this.tweens.add({
        targets: clock,
        rotation: Math.PI * 4,
        alpha: { from: 0.3, to: 0 },
        duration: 3000,
        delay: i * 400,
        repeat: -1
      })
    }
  }

  showAlternateTimeline1() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Timeline: Stayed with label
    this.currentBg.setFillStyle(0x080510)

    this.add.text(this.centerX, 50, "TIMELINE A: THE SELLOUT", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Vision frame
    const frame = this.add.rectangle(
      this.centerX, this.centerY,
      500, 280, 0x111118
    ).setStrokeStyle(2, 0x444488).setDepth(20)

    // Rich but empty Teddy
    this.add.text(this.centerX - 100, this.centerY, "🧸💰", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    // But look closely - eyes are empty
    this.add.text(this.centerX + 100, this.centerY, "😔", {
      fontSize: "50px"
    }).setOrigin(0.5).setAlpha(0.7).setDepth(40)

    this.add.text(this.centerX, this.centerY + 100,
      "Rich. Famous. Empty.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "\"In this timeline, I had everything except myself.\"", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5).setDepth(50)
  }

  showAlternateTimeline2() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050808)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Timeline: Never started music
    this.add.text(this.centerX, 50, "TIMELINE B: THE QUITTER", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Vision frame
    this.add.rectangle(
      this.centerX, this.centerY,
      500, 280, 0x111118
    ).setStrokeStyle(2, 0x448844).setDepth(20)

    // Office worker Teddy
    this.add.text(this.centerX, this.centerY - 30, "🧸👔", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    // Cubicle
    this.add.text(this.centerX, this.centerY + 40, "🖥️", {
      fontSize: "40px"
    }).setOrigin(0.5).setDepth(35)

    this.add.text(this.centerX, this.centerY + 100,
      "Safe. Secure. Soulless.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "\"In this timeline, I never even tried.\"", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5).setDepth(50)
  }

  showAlternateTimeline3() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x080505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Timeline: Current path
    this.add.text(this.centerX, 50, "TIMELINE C: THE FIGHTER", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Vision frame - golden glow
    this.add.rectangle(
      this.centerX, this.centerY,
      500, 280, 0x111118
    ).setStrokeStyle(2, 0xffcc44).setDepth(20)

    // Current Teddy - beaten but standing
    this.add.text(this.centerX, this.centerY, "🧸🎸💪", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, this.centerY + 100,
      "Broke. Free. ALIVE.", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "\"This is MY timeline.\"", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#88ff88"
    }).setOrigin(0.5).setDepth(50)
  }

  showRightChoice() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Affirmation
    this.add.text(this.centerX, this.centerY - 60, "THE RIGHT CHOICE", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 20,
      "\"I chose the hard path.\nBut it's MY path.\"", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#88ff88",
      align: "center"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "The noise collapse awaits... but the signal is clearer now.", {
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

    CutsceneManager.markPostBossWatched(12)

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
