import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World8IntroScene - Sydney Arena Tour
 */
export class World8IntroScene extends Phaser.Scene {
  constructor() { super({ key: "World8IntroScene" }) }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 8 }
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
    CutsceneManager.markWorldIntroWatched(8)
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
      { at: 0, run: () => this.showSydneyArrival() },
      { at: 4000, run: () => this.showCoastalView() },
      { at: 9000, run: () => this.showArenaStage() },
      { at: 14000, run: () => this.showOperaPhantom() },
      { at: 19000, run: () => this.showEncoreMoment() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showSydneyArrival() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 1000 })

    this.currentBg = this.add.image(this.centerX, this.centerY, "world8_sydney_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 1000 })

    this.locationText = this.add.text(this.centerX, 80, "SYDNEY, AUSTRALIA", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#00aaff",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1500 })

    this.subtitleText = this.add.text(this.centerX, 115, "Arena Tour", {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#ffaa00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 2000 })
  }

  showCoastalView() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.locationText) this.locationText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_sydney_coastal")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"Even paradise has been corrupted..."', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })
  }

  showArenaStage() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()

    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a1a2e)
      .setOrigin(0, 0).setDepth(-1)

    this.stageText = this.add.text(this.centerX, this.centerY - 50, "🎤 SOLD OUT 🎤", {
      fontFamily: "RetroPixel", fontSize: "36px", color: "#ffaa00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.stageText, alpha: 1, scale: { from: 0.8, to: 1 }, duration: 600, ease: "Back.easeOut" })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"The biggest stage yet. The most demanding crowd."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#888888",
      stroke: "#000000", strokeThickness: 2
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 800 })
  }

  showOperaPhantom() {
    this.sound.play("intro_impact", { volume: 0.5 })
    this.flashTransition()

    if (this.stageText) this.stageText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x110022)
      .setOrigin(0, 0).setDepth(-1)

    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss8_opera_phantom")
    this.bossImage.setScale(0.4)
    this.bossImage.setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 1, duration: 800 })

    this.bossText = this.add.text(this.centerX, 80, "THE ENCORE", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#00aaff",
      stroke: "#000000", strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.bossText, alpha: 1, duration: 800, ease: "Back.easeOut" })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"They demand more. Always more."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff",
      stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showEncoreMoment() {
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
    this.tweens.add({ targets: this.teddy, alpha: 1, scale: 0.55, duration: 800, ease: "Back.easeOut" })

    this.endingText = this.add.text(this.centerX, 100, "GIVE THEM A SHOW", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#00aaff",
      stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true
    CutsceneManager.markWorldIntroWatched(8)
    this.tweens.add({
      targets: this.blackOverlay, alpha: 1, duration: 1000,
      onComplete: () => { BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) }
    })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xffffff).setOrigin(0, 0).setAlpha(0).setDepth(99)
    this.tweens.add({ targets: flash, alpha: 0.6, duration: 80, yoyo: true, onComplete: () => flash.destroy() })
  }
}
