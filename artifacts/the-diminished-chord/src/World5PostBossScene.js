import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World5PostBossScene - Post-Boss cutscene for World 5 (Festival Grounds)
 * 
 * Story: The climax of Act I. After conquering the Festival Breakthrough boss,
 * Teddy plays the main stage at a legendary festival. This is the moment
 * of breakthrough - from underground to recognized artist.
 */
export class World5PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World5PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 5 }
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

    CutsceneManager.markPostBossWatched(5)

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
      { at: 0, run: () => this.showFestivalVictory() },
      { at: 4000, run: () => this.showMainStageReveal() },
      { at: 8000, run: () => this.showMassiveCrowd() },
      { at: 12000, run: () => this.showLegendaryPerformance() },
      { at: 16000, run: () => this.showBreakthroughMoment() },
      { at: 20000, run: () => this.showActOneComplete() },
      { at: 24000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showFestivalVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Festival sunset background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a1008)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Golden sunset gradient effect
    const gradient = this.add.rectangle(0, 0, this.width, this.height / 2, 0xff8800)
    gradient.setOrigin(0, 0).setAlpha(0.2).setDepth(0)

    // Confetti
    this.createConfetti()

    this.titleText = this.add.text(this.centerX, 100, "FESTIVAL CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffaa00",
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
      "From the underground to the main stage!", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffcc88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createConfetti() {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]
    for (let i = 0; i < 20; i++) {
      const confetti = this.add.rectangle(
        Phaser.Math.Between(0, this.width),
        -20,
        Phaser.Math.Between(5, 10),
        Phaser.Math.Between(10, 20),
        colors[Phaser.Math.Between(0, 5)]
      ).setDepth(40)

      this.tweens.add({
        targets: confetti,
        y: this.height + 50,
        x: confetti.x + Phaser.Math.Between(-100, 100),
        rotation: Phaser.Math.FloatBetween(-5, 5),
        duration: Phaser.Math.Between(3000, 5000),
        delay: i * 100,
        repeat: -1
      })
    }
  }

  showMainStageReveal() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Night sky with festival lights
    this.currentBg.setFillStyle(0x0a0510)

    // Main stage text
    this.add.text(this.centerX, 50, "★ MAIN STAGE ★", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Stage structure
    const stage = this.add.rectangle(
      this.centerX, this.height - 100,
      this.width * 0.8, 200,
      0x222222
    ).setDepth(10)

    // Moving lights
    for (let i = 0; i < 8; i++) {
      const light = this.add.circle(
        100 + i * 130,
        100,
        15,
        [0xff0000, 0x00ff00, 0x0000ff, 0xffff00][i % 4]
      ).setAlpha(0).setDepth(30)

      this.tweens.add({
        targets: light,
        alpha: { from: 0.3, to: 1 },
        duration: 200 + i * 50,
        yoyo: true,
        repeat: -1,
        delay: i * 100
      })
    }

    this.dialogText = this.add.text(this.centerX, this.centerY,
      "\"Is this real?!\"", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 800
    })
  }

  showMassiveCrowd() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050308)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Crowd POV from stage
    this.add.text(this.centerX, 50, "50,000 PEOPLE", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Sea of phone lights
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 15; col++) {
        const light = this.add.circle(
          80 + col * 70 + Phaser.Math.Between(-10, 10),
          200 + row * 80 + Phaser.Math.Between(-10, 10),
          3,
          0xffffff
        ).setAlpha(0).setDepth(20)

        this.tweens.add({
          targets: light,
          alpha: Phaser.Math.FloatBetween(0.3, 1),
          duration: Phaser.Math.Between(500, 1500),
          yoyo: true,
          repeat: -1,
          delay: Phaser.Math.Between(0, 1000)
        })
      }
    }

    // Crowd roar text
    this.add.text(this.centerX, this.height - 50,
      "The roar is deafening...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)
  }

  showLegendaryPerformance() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x100505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Performance montage
    this.add.text(this.centerX, 50, "♪ THE PERFORMANCE OF A LIFETIME ♪", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff4488"
    }).setOrigin(0.5).setDepth(50)

    // Teddy center stage
    const teddy = this.add.text(this.centerX, this.centerY, "🧸🎸", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    // Pulsing to music
    this.tweens.add({
      targets: teddy,
      scale: { from: 1, to: 1.1 },
      duration: 250,
      yoyo: true,
      repeat: -1
    })

    // Pyrotechnics
    this.time.addEvent({
      delay: 400,
      callback: () => {
        if (this.cutsceneSkipped) return
        const pyro = this.add.text(
          Phaser.Math.Between(100, this.width - 100),
          this.height - 50,
          "💥",
          { fontSize: "40px" }
        ).setOrigin(0.5).setDepth(35)

        this.tweens.add({
          targets: pyro,
          y: this.height - 200,
          alpha: 0,
          duration: 800,
          onComplete: () => pyro.destroy()
        })
      },
      repeat: 5
    })
  }

  showBreakthroughMoment() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Breakthrough headline
    this.add.text(this.centerX, 60, "BREAKTHROUGH!", {
      fontFamily: "RetroPixel",
      fontSize: "40px",
      color: "#00ff88",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(50)

    // Social media explosion
    const stats = [
      "#1 TRENDING",
      "10M VIEWS",
      "VIRAL WORLDWIDE",
      "RECORD DEAL OFFERS"
    ]

    stats.forEach((stat, i) => {
      const statText = this.add.text(
        this.centerX,
        180 + i * 60,
        stat,
        {
          fontFamily: "RetroPixel",
          fontSize: "22px",
          color: "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: statText,
        alpha: 1,
        x: { from: this.centerX + 200, to: this.centerX },
        duration: 400,
        delay: i * 400,
        ease: "Power2"
      })
    })
  }

  showActOneComplete() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Act complete text
    this.add.text(this.centerX, this.centerY - 60, "ACT I COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY, "THE UNDERGROUND", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Teaser for Act II
    this.add.text(this.centerX, this.centerY + 80,
      "But with fame comes the industry...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 1000,
      delay: 1500
    })

    this.add.text(this.centerX, this.height - 50,
      "Act II: The Industry awaits in Reykjavik...", {
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

    CutsceneManager.markPostBossWatched(5)

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
