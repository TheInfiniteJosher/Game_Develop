import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World5IntroScene - Animated intro cutscene for World 5 (Festival)
 * 
 * Story: Act I climax - The band arrives at the massive music festival where
 * thousands of hypnotized fans are being controlled through speaker towers.
 * This is the breakthrough moment.
 */
export class World5IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: "World5IntroScene" })
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

    this.blackOverlay = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
      .setOrigin(0, 0).setDepth(100)

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
    this.skipHint = this.add.text(this.width - 20, this.height - 30, "Press any key to skip", {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#666666"
    }).setOrigin(1, 0.5).setAlpha(0).setDepth(101)
    this.time.delayedCall(1500, () => {
      if (!this.cutsceneSkipped) this.tweens.add({ targets: this.skipHint, alpha: 0.7, duration: 500 })
    })
  }

  skipCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneSkipped = true
    this.tweens.killAll()
    this.time.removeAllEvents()
    CutsceneManager.markWorldIntroWatched(5)
    this.tweens.add({
      targets: this.blackOverlay, alpha: 1, duration: 300,
      onComplete: () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        BGMManager.stop()
        this.scene.start(this.returnScene, this.returnData)
      }
    })
  }

  startCutsceneSequence() {
    const timeline = this.add.timeline([
      { at: 0, run: () => this.showFestivalArrival() },
      { at: 4000, run: () => this.showMassiveCrowds() },
      { at: 9000, run: () => this.showSpeakerTowers() },
      { at: 14000, run: () => this.showFestivalColossus() },
      { at: 19000, run: () => this.showBreakthroughMoment() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showFestivalArrival() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 1000 })

    this.currentBg = this.add.image(this.centerX, this.centerY, "world5_festival_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 1000 })

    this.locationText = this.add.text(this.centerX, 80, "THE FESTIVAL GROUNDS", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#ffaa00",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1500 })

    this.subtitleText = this.add.text(this.centerX, 115, "Act I Finale - The Breakthrough", {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#ff69b4"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 2000 })

    // Pyro effects
    this.createPyroEffects()
  }

  createPyroEffects() {
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 400 + 1500, () => {
        if (this.cutsceneSkipped) return
        const pyro = this.add.text(
          Phaser.Math.Between(100, this.width - 100),
          this.height - 100,
          "🔥", { fontSize: "32px" }
        ).setDepth(40)

        this.tweens.add({
          targets: pyro, y: this.height - 200, alpha: { from: 1, to: 0 }, scale: { from: 1, to: 2 },
          duration: 800, onComplete: () => pyro.destroy()
        })
      })
    }
  }

  showMassiveCrowds() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.locationText) this.locationText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_festival_crowds")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"Hundreds of thousands... all under their control."', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })

    this.tweens.add({
      targets: this.currentBg, scale: this.currentBg.scale * 1.08,
      duration: 5000, ease: "Sine.easeInOut"
    })
  }

  showSpeakerTowers() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()

    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a0a1a)
      .setOrigin(0, 0).setDepth(-1)

    // Speaker tower visualization
    this.speakerText = this.add.text(this.centerX, this.centerY - 50, "🔊 BROADCASTING 🔊", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#ff00ff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.speakerText, alpha: 1, duration: 500 })

    // Pulse effect
    this.tweens.add({
      targets: this.speakerText, scale: { from: 1, to: 1.1 },
      duration: 500, yoyo: true, repeat: 3
    })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"The signal towers control everything."', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ffaa00",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 800 })
  }

  showFestivalColossus() {
    this.sound.play("intro_impact", { volume: 0.5 })
    this.flashTransition()

    if (this.speakerText) this.speakerText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x220011)
      .setOrigin(0, 0).setDepth(-1)

    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss5_festival_colossus")
    this.bossImage.setScale(0.45)
    this.bossImage.setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 1, duration: 800 })

    this.bossText = this.add.text(this.centerX, 70, "THE HEADLINER", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#ffaa00",
      stroke: "#000000", strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({
      targets: this.bossText, alpha: 1, scale: { from: 0.8, to: 1 },
      duration: 800, ease: "Back.easeOut"
    })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"The stage is set for the ultimate showdown."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showBreakthroughMoment() {
    this.sound.play("intro_whoosh", { volume: 0.5 })
    this.flashTransition()

    if (this.bossImage) this.bossImage.destroy()
    if (this.bossText) this.bossText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a1a)
      .setOrigin(0, 0).setDepth(-1)

    this.teddy = this.add.image(this.centerX, this.centerY + 50, "intro_teddy_action_pose")
    this.teddy.setScale(0.55)
    this.teddy.setAlpha(0)
    this.tweens.add({
      targets: this.teddy, alpha: 1, scale: 0.6,
      duration: 800, ease: "Back.easeOut"
    })

    this.endingText = this.add.text(this.centerX, 90, "THIS IS THE BREAKTHROUGH", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#ffaa00",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })

    // Dramatic effect
    this.time.delayedCall(1500, () => {
      if (this.cutsceneSkipped) return
      const burst = this.add.circle(this.centerX, this.centerY, 10, 0xffaa00, 0.5).setDepth(30)
      this.tweens.add({
        targets: burst, scale: 30, alpha: 0, duration: 800,
        onComplete: () => burst.destroy()
      })
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true
    CutsceneManager.markWorldIntroWatched(5)
    this.tweens.add({
      targets: this.blackOverlay, alpha: 1, duration: 1000,
      onComplete: () => {
        BGMManager.stop()
        this.scene.start(this.returnScene, this.returnData)
      }
    })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xffffff)
      .setOrigin(0, 0).setAlpha(0).setDepth(99)
    this.tweens.add({ targets: flash, alpha: 0.6, duration: 80, yoyo: true, onComplete: () => flash.destroy() })
  }
}
