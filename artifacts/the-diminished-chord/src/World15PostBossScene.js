import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World15PostBossScene - Post-Boss cutscene for World 15 (The Diminished Chord)
 * 
 * Story: The ultimate finale. After completing The Diminished Chord,
 * Teddy has resolved the incomplete piece that haunted him. The journey
 * is complete. The music is whole. The artist is complete.
 */
export class World15PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World15PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 15 }
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

    CutsceneManager.markPostBossWatched(15)

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
      { at: 0, run: () => this.showFinalVictory() },
      { at: 5000, run: () => this.showChordComplete() },
      { at: 10000, run: () => this.showJourneyReflection() },
      { at: 15000, run: () => this.showLegacyMoment() },
      { at: 20000, run: () => this.showNewBeginning() },
      { at: 25000, run: () => this.showActThreeComplete() },
      { at: 30000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showFinalVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 2000
    })

    // Cosmic space
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000008)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Stars
    this.createStarfield()

    this.titleText = this.add.text(this.centerX, this.centerY - 100, 
      "THE DIMINISHED CHORD", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffcc00",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 1500,
      ease: "Back.easeOut"
    })

    this.subtitleText = this.add.text(this.centerX, this.centerY,
      "COMPLETED", {
      fontFamily: "RetroPixel",
      fontSize: "48px",
      color: "#ffffff",
      stroke: "#ff4488",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 1000,
      delay: 2000
    })

    // Explosion of light
    this.time.delayedCall(2500, () => {
      if (this.cutsceneSkipped) return
      this.createVictoryExplosion()
    })
  }

  createStarfield() {
    for (let i = 0; i < 100; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, this.width),
        Phaser.Math.Between(0, this.height),
        Phaser.Math.Between(1, 2),
        0xffffff
      ).setAlpha(Phaser.Math.FloatBetween(0.3, 1)).setDepth(5)

      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: star.alpha * 0.5 },
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1
      })
    }
  }

  createVictoryExplosion() {
    const colors = [0xffcc00, 0xff4488, 0x44ff88, 0x4488ff, 0xffffff]
    for (let i = 0; i < 20; i++) {
      const particle = this.add.circle(
        this.centerX,
        this.centerY,
        Phaser.Math.Between(5, 15),
        colors[Phaser.Math.Between(0, 4)]
      ).setDepth(45)

      const angle = (i / 20) * Math.PI * 2
      const distance = Phaser.Math.Between(200, 400)

      this.tweens.add({
        targets: particle,
        x: this.centerX + Math.cos(angle) * distance,
        y: this.centerY + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.5,
        duration: 1500,
        ease: "Power2"
      })
    }
  }

  showChordComplete() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // The complete chord
    this.currentBg.setFillStyle(0x050510)

    this.add.text(this.centerX, 50, "THE CHORD IS COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Musical chord visualization
    const notes = ["C", "E♭", "G♭", "B♭♭"]
    notes.forEach((note, i) => {
      const noteText = this.add.text(
        250 + i * 180,
        this.centerY,
        note,
        {
          fontFamily: "RetroPixel",
          fontSize: "40px",
          color: "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: noteText,
        alpha: 1,
        y: { from: this.centerY + 50, to: this.centerY },
        duration: 500,
        delay: i * 400,
        ease: "Back.easeOut"
      })
    })

    // Harmony visualization
    this.time.delayedCall(2000, () => {
      if (this.cutsceneSkipped) return
      const harmonyLine = this.add.rectangle(
        this.centerX, this.centerY + 80,
        600, 4, 0xffcc00
      ).setAlpha(0).setDepth(45)

      this.tweens.add({
        targets: harmonyLine,
        alpha: 1,
        scaleX: { from: 0, to: 1 },
        duration: 1000
      })
    })

    this.add.text(this.centerX, this.height - 60,
      "What was broken is now whole.", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 3000
    })
  }

  showJourneyReflection() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x030308)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Journey montage
    this.add.text(this.centerX, 50, "THE JOURNEY", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Location memories
    const locations = [
      { name: "Detroit", emoji: "🏚️" },
      { name: "Berlin", emoji: "🏭" },
      { name: "Tokyo", emoji: "🗼" },
      { name: "London", emoji: "🌧️" },
      { name: "Festival", emoji: "🎪" },
      { name: "Iceland", emoji: "❄️" },
      { name: "LA", emoji: "🌴" },
      { name: "Sydney", emoji: "🏟️" },
      { name: "NYC", emoji: "🗽" }
    ]

    locations.forEach((loc, i) => {
      const locText = this.add.text(
        100 + (i % 5) * 200,
        150 + Math.floor(i / 5) * 120,
        `${loc.emoji}\n${loc.name}`,
        {
          fontFamily: "RetroPixel",
          fontSize: "14px",
          color: "#aaaaaa",
          align: "center"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: locText,
        alpha: 0.8,
        duration: 300,
        delay: i * 200
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "Every step led here.", {
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

  showLegacyMoment() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Legacy
    this.add.text(this.centerX, 80, "THE LEGACY", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Teddy triumphant
    this.add.text(this.centerX, this.centerY - 30, "🧸🎸👑", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    // Quote
    this.add.text(this.centerX, this.centerY + 100,
      "\"The music lives on.\nThe chord is complete.\nThe story... continues.\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 1000,
      delay: 1000
    })
  }

  showNewBeginning() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Sunrise/new dawn
    const dawn = this.add.ellipse(
      this.centerX, this.height,
      this.width * 2, 300,
      0xffaa44
    ).setAlpha(0.3).setDepth(5)

    this.tweens.add({
      targets: dawn,
      y: this.height - 50,
      alpha: 0.5,
      duration: 3000
    })

    this.add.text(this.centerX, this.centerY - 80, "A NEW DAWN", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 20,
      "The end of one journey...\nis the beginning of another.", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffcc88",
      align: "center"
    }).setOrigin(0.5).setDepth(50)

    // Teddy walking into sunrise
    const teddy = this.add.text(this.centerX, this.height - 100, "🧸🎸", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    this.tweens.add({
      targets: teddy,
      y: this.height - 150,
      alpha: { from: 1, to: 0.5 },
      duration: 3000
    })
  }

  showActThreeComplete() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Final act complete
    this.add.text(this.centerX, this.centerY - 100, "ACT III COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY - 40, "THE INTERNAL BATTLE", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 40,
      "GAME COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      scale: { from: 0.8, to: 1 },
      duration: 1000,
      delay: 1500,
      ease: "Back.easeOut"
    })

    this.add.text(this.centerX, this.height - 50,
      "Thank you for playing.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
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

    CutsceneManager.markPostBossWatched(15)

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
