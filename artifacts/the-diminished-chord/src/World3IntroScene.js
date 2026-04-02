import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World3IntroScene - Animated intro cutscene for World 3 (Tokyo)
 * 
 * Story: The band arrives in Tokyo's neon-lit streets where holographic idol
 * performers dominate the skyline and hypnotized crowds worship AI-generated music.
 */
export class World3IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: "World3IntroScene" })
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
    CutsceneManager.markWorldIntroWatched(3)
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
      { at: 0, run: () => this.showTokyoArrival() },
      { at: 4000, run: () => this.showNeonStreets() },
      { at: 9000, run: () => this.showHolographicIdol() },
      { at: 14000, run: () => this.showIdolShatter() },
      { at: 19000, run: () => this.showTeddyReady() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showTokyoArrival() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 1000 })

    this.currentBg = this.add.image(this.centerX, this.centerY, "world3_tokyo_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setAlpha(0)

    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 1000 })

    this.locationText = this.add.text(this.centerX, 80, "TOKYO, JAPAN", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#ff69b4",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1500 })

    this.subtitleText = this.add.text(this.centerX, 115, "Neon Rooftops & Digital Dreams", {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#00ffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 2000 })
  }

  showNeonStreets() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.locationText) this.locationText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_tokyo_neon_streets")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"The city drowns in synthetic melodies..."', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })

    // Neon pulse effect
    this.createNeonPulse()

    this.tweens.add({
      targets: this.currentBg, scale: this.currentBg.scale * 1.05,
      duration: 5000, ease: "Sine.easeInOut"
    })
  }

  createNeonPulse() {
    const neonColors = [0xff00ff, 0x00ffff, 0xff69b4]
    neonColors.forEach((color, i) => {
      this.time.delayedCall(i * 500, () => {
        if (this.cutsceneSkipped) return
        const pulse = this.add.rectangle(0, 0, this.width, this.height, color)
          .setOrigin(0, 0).setAlpha(0).setDepth(40)
        this.tweens.add({
          targets: pulse, alpha: 0.1, duration: 200, yoyo: true,
          onComplete: () => pulse.destroy()
        })
      })
    })
  }

  showHolographicIdol() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // Dark background with holographic tint
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x110022)
      .setOrigin(0, 0).setDepth(-1)

    // Holographic effect text
    this.holoText = this.add.text(this.centerX, this.centerY - 80, "✧ VIRTUAL IDOL ✧", {
      fontFamily: "RetroPixel", fontSize: "36px", color: "#ff69b4"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.holoText, alpha: 1, scale: { from: 0.8, to: 1 },
      duration: 800, ease: "Back.easeOut"
    })

    // Glitch effect
    this.tweens.add({
      targets: this.holoText, x: this.holoText.x + 3,
      duration: 100, yoyo: true, repeat: 5, delay: 1000
    })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"Millions worship what isn\'t real."', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#00ffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showIdolShatter() {
    this.sound.play("intro_impact", { volume: 0.5 })
    this.flashTransition()

    if (this.holoText) this.holoText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_tokyo_idol_shatter")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setAlpha(0)

    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 500 })

    // Shatter particles
    this.createShatterParticles()

    this.bossText = this.add.text(this.centerX, 100, "NEON DRAGON", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#ff00ff",
      stroke: "#000000", strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setScale(0.8).setDepth(50)

    this.tweens.add({
      targets: this.bossText, alpha: 1, scale: 1,
      duration: 800, delay: 500, ease: "Back.easeOut"
    })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"Time to bring back real music."', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1500 })
  }

  createShatterParticles() {
    for (let i = 0; i < 8; i++) {
      const particle = this.add.text(
        this.centerX + Phaser.Math.Between(-200, 200),
        this.centerY + Phaser.Math.Between(-100, 100),
        "◆", { fontSize: "20px", color: "#ff69b4" }
      ).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: particle,
        alpha: { from: 1, to: 0 },
        y: particle.y + 100,
        scale: { from: 1, to: 0.3 },
        duration: 1000,
        delay: i * 100,
        onComplete: () => particle.destroy()
      })
    }
  }

  showTeddyReady() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()

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

    this.endingText = this.add.text(this.centerX, 100, "RISE ABOVE THE NOISE", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#ff69b4",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true
    CutsceneManager.markWorldIntroWatched(3)
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
    this.tweens.add({
      targets: flash, alpha: 0.6, duration: 80, yoyo: true,
      onComplete: () => flash.destroy()
    })
  }
}
