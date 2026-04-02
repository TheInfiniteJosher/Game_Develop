import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World6IntroScene - Animated intro cutscene for World 6 (Reykjavik)
 * 
 * Story: Act II begins - The band ventures to Iceland's frozen landscape where
 * music fragments resonate with natural aurora crystals. Here they meet Groove.
 */
export class World6IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: "World6IntroScene" })
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
    CutsceneManager.markWorldIntroWatched(6)
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
      { at: 0, run: () => this.showIcelandArrival() },
      { at: 4000, run: () => this.showAuroraCrystals() },
      { at: 9000, run: () => this.showActTwoTitle() },
      { at: 14000, run: () => this.showAuroraPhantom() },
      { at: 19000, run: () => this.showIsolationMoment() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showIcelandArrival() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 1500 })

    this.currentBg = this.add.image(this.centerX, this.centerY, "world6_reykjavik_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 1500 })

    // Aurora shimmer effect
    this.createAuroraEffect()

    this.locationText = this.add.text(this.centerX, 80, "REYKJAVIK, ICELAND", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#00ffaa",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1500 })

    this.subtitleText = this.add.text(this.centerX, 115, "Arctic Isolation", {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#00ffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 2000 })
  }

  createAuroraEffect() {
    const colors = [0x00ff88, 0x00ffff, 0xff00ff]
    colors.forEach((color, i) => {
      this.time.delayedCall(i * 800, () => {
        if (this.cutsceneSkipped) return
        const aurora = this.add.ellipse(this.centerX + (i - 1) * 200, 150, 300, 50, color, 0.2)
          .setDepth(30)
        this.tweens.add({
          targets: aurora, scaleY: 1.5, alpha: 0, duration: 2000,
          onComplete: () => aurora.destroy()
        })
      })
    })
  }

  showAuroraCrystals() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.locationText) this.locationText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_reykjavik_crystals")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"The music resonates with the northern lights..."', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })

    this.tweens.add({
      targets: this.currentBg, scale: this.currentBg.scale * 1.05,
      duration: 5000, ease: "Sine.easeInOut"
    })
  }

  showActTwoTitle() {
    this.sound.play("intro_impact", { volume: 0.4 })
    this.flashTransition()

    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x001122)
      .setOrigin(0, 0).setDepth(-1)

    this.actTitle = this.add.text(this.centerX, this.centerY - 30, "ACT II", {
      fontFamily: "RetroPixel", fontSize: "48px", color: "#00ffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.actSubtitle = this.add.text(this.centerX, this.centerY + 30, "THE INDUSTRY", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#ff69b4"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.actTitle, alpha: 1, scale: { from: 0.5, to: 1 },
      duration: 800, ease: "Back.easeOut"
    })
    this.tweens.add({
      targets: this.actSubtitle, alpha: 1, duration: 500, delay: 500
    })
  }

  showAuroraPhantom() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()

    if (this.actTitle) this.actTitle.destroy()
    if (this.actSubtitle) this.actSubtitle.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x001133)
      .setOrigin(0, 0).setDepth(-1)

    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss6_aurora_phantom")
    this.bossImage.setScale(0.4)
    this.bossImage.setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 0.9, duration: 1000 })

    // Ethereal glow
    this.tweens.add({
      targets: this.bossImage, alpha: { from: 0.7, to: 1 },
      duration: 1000, yoyo: true, repeat: 2
    })

    this.bossText = this.add.text(this.centerX, 80, "THE SILENCE", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#00ffaa",
      stroke: "#000000", strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({
      targets: this.bossText, alpha: 1, duration: 800, ease: "Back.easeOut"
    })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"In the silence, only the true music survives."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showIsolationMoment() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.bossImage) this.bossImage.destroy()
    if (this.bossText) this.bossText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a1a)
      .setOrigin(0, 0).setDepth(-1)

    this.teddy = this.add.image(this.centerX, this.centerY + 50, "teddy_punk_front_view")
    this.teddy.setScale(0.4)
    this.teddy.setAlpha(0)
    this.tweens.add({
      targets: this.teddy, alpha: 1, scale: 0.45,
      duration: 800, ease: "Back.easeOut"
    })

    this.endingText = this.add.text(this.centerX, 100, "FIND THE SIGNAL IN THE NOISE", {
      fontFamily: "RetroPixel", fontSize: "24px", color: "#00ffaa",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true
    CutsceneManager.markWorldIntroWatched(6)
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
