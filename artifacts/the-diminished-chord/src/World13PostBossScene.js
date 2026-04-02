import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World13PostBossScene - Post-Boss cutscene for World 13 (Noise Collapse)
 * 
 * Story: After surviving the Noise Collapse, Teddy learns to filter out
 * the chaos. All the criticism, all the doubt, all the noise - it all
 * fades away when you focus on what matters: the music itself.
 */
export class World13PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World13PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 13 }
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

    CutsceneManager.markPostBossWatched(13)

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
      { at: 0, run: () => this.showNoiseVictory() },
      { at: 4000, run: () => this.showChaosStorm() },
      { at: 8000, run: () => this.showFindingSignal() },
      { at: 12000, run: () => this.showPureMelody() },
      { at: 16000, run: () => this.showClarityAhead() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showNoiseVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Chaotic static background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x080808)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Static noise
    this.createStaticNoise()

    this.titleText = this.add.text(this.centerX, 100, "NOISE CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff4488",
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
      "The static clears...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff88aa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createStaticNoise() {
    for (let i = 0; i < 50; i++) {
      const pixel = this.add.rectangle(
        Phaser.Math.Between(0, this.width),
        Phaser.Math.Between(0, this.height),
        Phaser.Math.Between(2, 8),
        Phaser.Math.Between(2, 8),
        Phaser.Math.Between(0, 1) === 0 ? 0x222222 : 0x333333
      ).setDepth(5).setAlpha(0.5)

      this.tweens.add({
        targets: pixel,
        alpha: { from: 0.2, to: 0.6 },
        x: pixel.x + Phaser.Math.Between(-20, 20),
        duration: Phaser.Math.Between(100, 300),
        yoyo: true,
        repeat: -1
      })
    }
  }

  showChaosStorm() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Overwhelming noise
    this.currentBg.setFillStyle(0x0a0505)

    this.add.text(this.centerX, 50, "THE NOISE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff0000"
    }).setOrigin(0.5).setDepth(50)

    // Overwhelming voices/criticism
    const noise = [
      "YOU'LL FAIL", "SELLOUT!", "OVERRATED",
      "ONE HIT WONDER", "NOBODY CARES", "GIVE UP",
      "FRAUD!", "WASHED UP", "PATHETIC"
    ]

    noise.forEach((text, i) => {
      const noiseText = this.add.text(
        Phaser.Math.Between(50, this.width - 50),
        Phaser.Math.Between(120, this.height - 100),
        text,
        {
          fontFamily: "RetroPixel",
          fontSize: Phaser.Math.Between(12, 20) + "px",
          color: "#ff" + Phaser.Math.Between(44, 88).toString(16) + Phaser.Math.Between(44, 88).toString(16)
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(30)

      this.tweens.add({
        targets: noiseText,
        alpha: { from: 0, to: 0.8 },
        duration: 200,
        delay: i * 150,
        yoyo: true,
        hold: 500
      })
    })

    // Teddy overwhelmed
    this.add.text(this.centerX, this.centerY, "🧸😵", {
      fontSize: "60px"
    }).setOrigin(0.5).setDepth(40)
  }

  showFindingSignal() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Finding the signal
    this.add.text(this.centerX, 50, "FINDING THE SIGNAL", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Noise fading, signal emerging
    const signalBar = this.add.rectangle(
      this.centerX, this.centerY,
      20, 100, 0x00ff88
    ).setDepth(40).setAlpha(0)

    // More bars joining
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue
      const bar = this.add.rectangle(
        this.centerX + i * 40,
        this.centerY,
        20,
        Phaser.Math.Between(40, 120),
        0x00ff88
      ).setDepth(40).setAlpha(0)

      this.tweens.add({
        targets: bar,
        alpha: 0.8,
        duration: 500,
        delay: 500 + Math.abs(i) * 200
      })

      this.tweens.add({
        targets: bar,
        scaleY: Phaser.Math.FloatBetween(0.7, 1.3),
        duration: 300,
        yoyo: true,
        repeat: -1,
        delay: 1000
      })
    }

    this.tweens.add({
      targets: signalBar,
      alpha: 1,
      duration: 500
    })

    this.add.text(this.centerX, this.height - 60,
      "\"Filter out the noise. Find YOUR frequency.\"", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#88ffaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1500
    })
  }

  showPureMelody() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Pure music moment
    this.add.text(this.centerX, 50, "PURE MELODY", {
      fontFamily: "RetroPixel",
      fontSize: "30px",
      color: "#00ffaa"
    }).setOrigin(0.5).setDepth(50)

    // Teddy playing in peace
    this.add.text(this.centerX, this.centerY - 30, "🧸🎸", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    // Musical notes floating up
    const notes = ["♪", "♫", "♩", "♬"]
    for (let i = 0; i < 8; i++) {
      const note = this.add.text(
        this.centerX + Phaser.Math.Between(-150, 150),
        this.centerY + 100,
        notes[Phaser.Math.Between(0, 3)],
        {
          fontSize: "30px",
          color: "#88ffcc"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(35)

      this.tweens.add({
        targets: note,
        y: note.y - 200,
        alpha: { from: 1, to: 0 },
        duration: 2000,
        delay: i * 300,
        repeat: -1
      })
    }

    this.add.text(this.centerX, this.height - 60,
      "The only voice that matters is your own.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)
  }

  showClarityAhead() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000005)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Clarity approaches
    this.add.text(this.centerX, this.centerY - 40, "CLARITY AWAITS", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Light at end of tunnel
    const light = this.add.circle(this.centerX, this.centerY + 80, 10, 0xffffff)
    light.setDepth(40)

    this.tweens.add({
      targets: light,
      scale: { from: 1, to: 5 },
      alpha: { from: 1, to: 0.5 },
      duration: 2000
    })

    this.add.text(this.centerX, this.height - 50,
      "One more step to true understanding...", {
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

    CutsceneManager.markPostBossWatched(13)

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
