import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World4PostBossScene - Post-Boss cutscene for World 4 (London)
 * 
 * Story: After conquering the Rain-Slick Streets, Teddy embraces the British
 * punk heritage. The band plays legendary venues and gains respect from
 * punk rock royalty.
 */
export class World4PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World4PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 4 }
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

    CutsceneManager.markPostBossWatched(4)

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
      { at: 0, run: () => this.showStreetsVictory() },
      { at: 4000, run: () => this.showLondonRain() },
      { at: 8000, run: () => this.showPunkHeritage() },
      { at: 12000, run: () => this.showLegendaryVenue() },
      { at: 16000, run: () => this.showBritishPress() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showStreetsVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Rainy London background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x151520)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Rain effect
    this.createRain()

    this.titleText = this.add.text(this.centerX, 100, "STREETS CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#8888ff",
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
      "The birthplace of punk welcomes a new voice...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aaaaaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createRain() {
    for (let i = 0; i < 30; i++) {
      const drop = this.add.rectangle(
        Phaser.Math.Between(0, this.width),
        -10,
        1,
        Phaser.Math.Between(10, 25),
        0x6688aa
      ).setDepth(5).setAlpha(0.4)

      this.tweens.add({
        targets: drop,
        y: this.height + 30,
        duration: Phaser.Math.Between(800, 1500),
        delay: i * 50,
        repeat: -1
      })
    }
  }

  showLondonRain() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Moody London atmosphere
    this.currentBg.setFillStyle(0x101018)

    // Big Ben silhouette (text-based)
    this.add.text(this.centerX, this.centerY - 80, "🏰", {
      fontSize: "120px"
    }).setOrigin(0.5).setAlpha(0.3).setDepth(10)

    // Location text
    this.add.text(this.centerX, 60, "LONDON, ENGLAND", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.dialogText = this.add.text(this.centerX, this.height - 60,
      "\"Oi! This is where it all started, innit?\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aaddff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 500
    })
  }

  showPunkHeritage() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0d0d15)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Continue rain
    this.createRain()

    // Punk history wall
    this.add.text(this.centerX, 60, "PUNK HERITAGE", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#ff4466"
    }).setOrigin(0.5).setDepth(50)

    // Band posters
    const bands = ["SEX PISTOLS", "THE CLASH", "THE DAMNED", "BUZZCOCKS"]
    bands.forEach((band, i) => {
      const poster = this.add.text(
        200 + (i % 2) * 400,
        180 + Math.floor(i / 2) * 150,
        band,
        {
          fontFamily: "RetroPixel",
          fontSize: "18px",
          color: "#ffffff",
          backgroundColor: "#222233",
          padding: { x: 15, y: 10 }
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: poster,
        alpha: 1,
        rotation: Phaser.Math.FloatBetween(-0.1, 0.1),
        duration: 400,
        delay: i * 300
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "Standing on the shoulders of giants", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
    }).setOrigin(0.5).setDepth(50)
  }

  showLegendaryVenue() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a0a0a)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Venue marquee
    this.add.text(this.centerX, 60, "★ BRIXTON ACADEMY ★", {
      fontFamily: "RetroPixel",
      fontSize: "30px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Stage lights
    for (let i = 0; i < 5; i++) {
      const light = this.add.circle(
        200 + i * 150,
        150,
        20,
        [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff][i]
      ).setAlpha(0.5).setDepth(30)

      this.tweens.add({
        targets: light,
        alpha: { from: 0.3, to: 0.8 },
        duration: 300 + i * 100,
        yoyo: true,
        repeat: -1
      })
    }

    // Crowd silhouette
    this.add.text(this.centerX, this.centerY + 80, 
      "👤👤👤👤👤👤👤👤👤👤", {
      fontSize: "30px"
    }).setOrigin(0.5).setAlpha(0.5).setDepth(20)

    this.dialogText = this.add.text(this.centerX, this.height - 60,
      "\"LONDON! ARE YOU READY?!\"", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#ff4466"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      scale: { from: 0.8, to: 1.1 },
      duration: 600,
      ease: "Back.easeOut"
    })
  }

  showBritishPress() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a10)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Newspaper headline
    this.add.text(this.centerX, 50, "NME", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ff0000"
    }).setOrigin(0.5).setDepth(50)

    const headline = this.add.text(this.centerX, this.centerY - 50,
      "\"THE FUTURE OF PUNK\nHAS ARRIVED\"", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setDepth(50)

    this.tweens.add({
      targets: headline,
      scale: { from: 0.5, to: 1 },
      duration: 800,
      ease: "Back.easeOut"
    })

    // Rating stars
    this.add.text(this.centerX, this.centerY + 60, "★★★★★", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "One more stop before the big festival...", {
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

    CutsceneManager.markPostBossWatched(4)

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
