import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World9IntroScene - NYC Media Storm
 */
export class World9IntroScene extends Phaser.Scene {
  constructor() { super({ key: "World9IntroScene" }) }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 9 }
  }

  create() {
    this.centerX = this.cameras.main.width / 2
    this.centerY = this.cameras.main.height / 2
    this.width = this.cameras.main.width
    this.height = this.cameras.main.height
    this.cutsceneSkipped = false
    this.cutsceneComplete = false

    this.blackOverlay = this.add.rectangle(0, 0, this.width, this.height, 0x000000).setOrigin(0, 0).setDepth(100)
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
    this.time.delayedCall(1500, () => { if (!this.cutsceneSkipped) this.tweens.add({ targets: this.skipHint, alpha: 0.7, duration: 500 }) })
  }

  skipCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneSkipped = true
    this.tweens.killAll()
    this.time.removeAllEvents()
    CutsceneManager.markWorldIntroWatched(9)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 300, onComplete: () => { this.sound.play("ui_confirm_sound", { volume: 0.3 }); BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  startCutsceneSequence() {
    const timeline = this.add.timeline([
      { at: 0, run: () => this.showNYCArrival() },
      { at: 4000, run: () => this.showRooftops() },
      { at: 9000, run: () => this.showMediaChaos() },
      { at: 14000, run: () => this.showAlgorithmEntity() },
      { at: 19000, run: () => this.showBattleReady() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showNYCArrival() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 1000 })
    this.currentBg = this.add.image(this.centerX, this.centerY, "world9_nyc_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height)).setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 1000 })

    this.locationText = this.add.text(this.centerX, 80, "NEW YORK CITY, USA", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#ffff00", stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1500 })

    this.subtitleText = this.add.text(this.centerX, 115, "Media Storm", {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#ff4444"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 2000 })
  }

  showRooftops() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()
    if (this.locationText) this.locationText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_nyc_rooftops")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"The city that never sleeps... because they won\'t let it."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff", stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })
  }

  showMediaChaos() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a1a1a).setOrigin(0, 0).setDepth(-1)

    // Headlines flying
    const headlines = ["BREAKING:", "TRENDING:", "VIRAL:", "EXCLUSIVE:"]
    headlines.forEach((h, i) => {
      const text = this.add.text(Phaser.Math.Between(50, this.width - 50), Phaser.Math.Between(100, this.height - 100), h, {
        fontFamily: "RetroPixel", fontSize: "20px", color: "#ff4444"
      }).setAlpha(0).setDepth(40)
      this.tweens.add({ targets: text, alpha: 1, y: text.y - 30, duration: 1000, delay: i * 300, yoyo: true, onComplete: () => text.destroy() })
    })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"Everyone is watching. Everything is recorded."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ffff00", stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1500 })
  }

  showAlgorithmEntity() {
    this.sound.play("intro_impact", { volume: 0.5 })
    this.flashTransition()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x110011).setOrigin(0, 0).setDepth(-1)

    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss9_algorithm_entity")
    this.bossImage.setScale(0.4).setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 1, duration: 800 })

    this.bossText = this.add.text(this.centerX, 80, "THE INTERVIEW", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#ffff00", stroke: "#000000", strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.bossText, alpha: 1, duration: 800, ease: "Back.easeOut" })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"Every question is a trap. Every answer is ammunition."', {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#ffffff", stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showBattleReady() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()
    if (this.bossImage) this.bossImage.destroy()
    if (this.bossText) this.bossText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a1a).setOrigin(0, 0).setDepth(-1)

    this.teddy = this.add.image(this.centerX, this.centerY + 50, "intro_teddy_action_pose").setScale(0.5).setAlpha(0)
    this.tweens.add({ targets: this.teddy, alpha: 1, scale: 0.55, duration: 800, ease: "Back.easeOut" })

    this.endingText = this.add.text(this.centerX, 100, "STAY TRUE TO THE MUSIC", {
      fontFamily: "RetroPixel", fontSize: "26px", color: "#ffff00", stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true
    CutsceneManager.markWorldIntroWatched(9)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 1000, onComplete: () => { BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xffffff).setOrigin(0, 0).setAlpha(0).setDepth(99)
    this.tweens.add({ targets: flash, alpha: 0.6, duration: 80, yoyo: true, onComplete: () => flash.destroy() })
  }
}
