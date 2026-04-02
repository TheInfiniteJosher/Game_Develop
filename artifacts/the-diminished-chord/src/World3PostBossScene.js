import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World3PostBossScene - Post-Boss cutscene for World 3 (Tokyo)
 * 
 * Story: After conquering the Neon Rooftops, Teddy experiences the fusion of
 * Western punk with Japanese rock culture. A legendary collaboration emerges,
 * and the band gains a massive following in Asia.
 */
export class World3PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World3PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 3 }
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

    CutsceneManager.markPostBossWatched(3)

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
      { at: 0, run: () => this.showRooftopVictory() },
      { at: 4000, run: () => this.showNeonCity() },
      { at: 8000, run: () => this.showJRockMeeting() },
      { at: 12000, run: () => this.showAnimeOpening() },
      { at: 16000, run: () => this.showAsianFame() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showRooftopVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Tokyo neon background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a1f)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Neon rain
    this.createNeonRain()

    this.titleText = this.add.text(this.centerX, 100, "ROOFTOPS CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff00ff",
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

    // Japanese subtitle
    this.subtitleText = this.add.text(this.centerX, this.height - 80,
      "ネオンの街を征服した... (The neon city conquered...)", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createNeonRain() {
    for (let i = 0; i < 15; i++) {
      const colors = [0xff00ff, 0x00ffff, 0xff0088, 0x0088ff]
      const drop = this.add.rectangle(
        Phaser.Math.Between(0, this.width),
        -20,
        2,
        Phaser.Math.Between(20, 50),
        colors[Phaser.Math.Between(0, 3)]
      ).setDepth(5).setAlpha(0.6)

      this.tweens.add({
        targets: drop,
        y: this.height + 50,
        duration: Phaser.Math.Between(1500, 3000),
        delay: i * 100,
        repeat: -1
      })
    }
  }

  showNeonCity() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Shibuya-style cityscape
    this.currentBg.setFillStyle(0x050515)

    // Neon signs
    const signs = ["秋葉原", "渋谷", "新宿", "原宿"]
    signs.forEach((sign, i) => {
      const neonSign = this.add.text(
        100 + i * 250,
        80 + (i % 2) * 50,
        sign,
        {
          fontFamily: "RetroPixel",
          fontSize: "20px",
          color: i % 2 === 0 ? "#ff00ff" : "#00ffff"
        }
      ).setOrigin(0.5).setDepth(30)

      this.tweens.add({
        targets: neonSign,
        alpha: { from: 0.6, to: 1 },
        duration: 300 + i * 100,
        yoyo: true,
        repeat: -1
      })
    })

    // City comment
    this.dialogText = this.add.text(this.centerX, this.height - 60,
      "\"This city never sleeps... neither do we!\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 500
    })
  }

  showJRockMeeting() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x100818)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Meeting scene
    this.add.text(this.centerX, 70, "LEGENDARY MEETING", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#ff4488"
    }).setOrigin(0.5).setDepth(50)

    // Teddy meets J-Rock star
    const teddy = this.add.text(this.centerX - 120, this.centerY, "🧸", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    const jrocker = this.add.text(this.centerX + 120, this.centerY, "🎤", {
      fontSize: "70px"
    }).setOrigin(0.5).setDepth(40)

    // Shake hands animation
    this.tweens.add({
      targets: [teddy, jrocker],
      x: this.centerX,
      duration: 1000,
      delay: 500,
      ease: "Power2"
    })

    // Sparkle effect
    this.time.delayedCall(1500, () => {
      if (this.cutsceneSkipped) return
      for (let i = 0; i < 8; i++) {
        const spark = this.add.text(
          this.centerX + Phaser.Math.Between(-80, 80),
          this.centerY + Phaser.Math.Between(-80, 80),
          "✨",
          { fontSize: "24px" }
        ).setOrigin(0.5).setAlpha(0).setDepth(45)

        this.tweens.add({
          targets: spark,
          alpha: { from: 1, to: 0 },
          scale: { from: 0.5, to: 1.5 },
          duration: 600,
          delay: i * 100
        })
      }
    })

    this.add.text(this.centerX, this.height - 60, "East meets West", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)
  }

  showAnimeOpening() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0d0518)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Anime-style intro
    this.add.text(this.centerX, 50, "♪ ANIME OP THEME ♪", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff88cc"
    }).setOrigin(0.5).setDepth(50)

    // Dynamic text animation
    const titleParts = ["THE", "DIMINISHED", "CHORD"]
    titleParts.forEach((part, i) => {
      const partText = this.add.text(
        this.centerX,
        this.centerY - 50 + i * 45,
        part,
        {
          fontFamily: "RetroPixel",
          fontSize: i === 1 ? "36px" : "24px",
          color: "#ffffff",
          stroke: "#ff0088",
          strokeThickness: i === 1 ? 4 : 2
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: partText,
        alpha: 1,
        x: { from: this.centerX + 200, to: this.centerX },
        duration: 400,
        delay: i * 300,
        ease: "Power2"
      })
    })

    // Speed lines
    for (let i = 0; i < 10; i++) {
      const line = this.add.rectangle(
        this.width + 50,
        Phaser.Math.Between(50, this.height - 50),
        Phaser.Math.Between(100, 300),
        2,
        0xffffff
      ).setOrigin(1, 0.5).setAlpha(0.3).setDepth(5)

      this.tweens.add({
        targets: line,
        x: -300,
        duration: 500,
        delay: i * 100,
        repeat: -1
      })
    }
  }

  showAsianFame() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0812)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 70, "ASIA TOUR ANNOUNCED!", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // City tour dates
    const cities = [
      { name: "TOKYO", date: "SOLD OUT" },
      { name: "OSAKA", date: "SOLD OUT" },
      { name: "SEOUL", date: "SOLD OUT" },
      { name: "TAIPEI", date: "SOLD OUT" }
    ]

    cities.forEach((city, i) => {
      const cityText = this.add.text(
        this.centerX - 100,
        180 + i * 60,
        city.name,
        {
          fontFamily: "RetroPixel",
          fontSize: "20px",
          color: "#ffffff"
        }
      ).setOrigin(0, 0.5).setAlpha(0).setDepth(50)

      const statusText = this.add.text(
        this.centerX + 100,
        180 + i * 60,
        city.date,
        {
          fontFamily: "RetroPixel",
          fontSize: "18px",
          color: "#ff4444"
        }
      ).setOrigin(0, 0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: [cityText, statusText],
        alpha: 1,
        duration: 300,
        delay: i * 400
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "Next: London... where the rain never stops.", {
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

    CutsceneManager.markPostBossWatched(3)

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
