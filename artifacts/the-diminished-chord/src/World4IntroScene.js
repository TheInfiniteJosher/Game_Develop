import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World4IntroScene - Animated intro cutscene for World 4 (London)
 * 
 * Story: The band ventures into London's punk underground, navigating rain-slicked
 * streets and tunnels where the resistance movement hides from royal robot patrols.
 */
export class World4IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: "World4IntroScene" })
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
    CutsceneManager.markWorldIntroWatched(4)
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
      { at: 0, run: () => this.showLondonArrival() },
      { at: 4000, run: () => this.showUndergroundTunnels() },
      { at: 9000, run: () => this.showResistanceHideout() },
      { at: 14000, run: () => this.showPunkQueenReveal() },
      { at: 19000, run: () => this.showBattlePrep() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showLondonArrival() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 1000 })

    this.currentBg = this.add.image(this.centerX, this.centerY, "world4_london_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 1000 })

    // Rain effect
    this.createRainEffect()

    this.locationText = this.add.text(this.centerX, 80, "LONDON, ENGLAND", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#ff4444",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1500 })

    this.subtitleText = this.add.text(this.centerX, 115, "Punk Rock's Birthplace", {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 2000 })
  }

  createRainEffect() {
    // Simple rain streaks
    for (let i = 0; i < 20; i++) {
      const rain = this.add.text(
        Phaser.Math.Between(0, this.width),
        Phaser.Math.Between(-100, 0),
        "|", { fontSize: "16px", color: "#4466aa" }
      ).setAlpha(0.3).setDepth(30)

      this.tweens.add({
        targets: rain, y: this.height + 50, alpha: 0,
        duration: Phaser.Math.Between(800, 1500),
        repeat: 2,
        onComplete: () => rain.destroy()
      })
    }
  }

  showUndergroundTunnels() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.locationText) this.locationText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_london_tunnels")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"The resistance hides in the underground..."', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })

    this.tweens.add({
      targets: this.currentBg, scale: this.currentBg.scale * 1.05,
      duration: 5000, ease: "Sine.easeInOut"
    })
  }

  showResistanceHideout() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a1a2e)
      .setOrigin(0, 0).setDepth(-1)

    // Graffiti-style text
    this.graffitiText = this.add.text(this.centerX, this.centerY - 50, "ANARCHY IN THE UK", {
      fontFamily: "RetroPixel", fontSize: "36px", color: "#ff4444"
    }).setOrigin(0.5).setAlpha(0).setDepth(50).setAngle(-5)

    this.tweens.add({
      targets: this.graffitiText, alpha: 1, scale: { from: 0.5, to: 1 },
      duration: 600, ease: "Back.easeOut"
    })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"True punk never dies. It just goes underground."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#888888",
      stroke: "#000000", strokeThickness: 2
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })
  }

  showPunkQueenReveal() {
    this.sound.play("intro_impact", { volume: 0.4 })
    this.flashTransition()

    if (this.graffitiText) this.graffitiText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x220000)
      .setOrigin(0, 0).setDepth(-1)

    // Boss image
    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss4_punk_queen")
    this.bossImage.setScale(0.4)
    this.bossImage.setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 1, duration: 800 })

    this.bossText = this.add.text(this.centerX, 80, "THE PUNK QUEEN", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#ff4444",
      stroke: "#000000", strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({
      targets: this.bossText, alpha: 1, scale: { from: 0.8, to: 1 },
      duration: 800, ease: "Back.easeOut"
    })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"She rules the critics with an iron guitar."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showBattlePrep() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()

    if (this.bossImage) this.bossImage.destroy()
    if (this.bossText) this.bossText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a1a)
      .setOrigin(0, 0).setDepth(-1)

    this.teddy = this.add.image(this.centerX, this.centerY + 50, "intro_teddy_action_pose")
    this.teddy.setScale(0.5)
    this.teddy.setAlpha(0)
    this.tweens.add({
      targets: this.teddy, alpha: 1, scale: 0.55,
      duration: 800, ease: "Back.easeOut"
    })

    this.endingText = this.add.text(this.centerX, 100, "GOD SAVE THE REAL MUSIC", {
      fontFamily: "RetroPixel", fontSize: "26px", color: "#ff4444",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true
    CutsceneManager.markWorldIntroWatched(4)
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
