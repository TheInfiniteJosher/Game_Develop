import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World15IntroScene - The Diminished Chord (Final World)
 */
export class World15IntroScene extends Phaser.Scene {
  constructor() { super({ key: "World15IntroScene" }) }
  init(data) { this.returnScene = data.returnScene || "WorldLevelSelectScene"; this.returnData = data.returnData || { worldNum: 15 } }

  create() {
    this.centerX = this.cameras.main.width / 2; this.centerY = this.cameras.main.height / 2
    this.width = this.cameras.main.width; this.height = this.cameras.main.height
    this.cutsceneSkipped = false; this.cutsceneComplete = false
    this.blackOverlay = this.add.rectangle(0, 0, this.width, this.height, 0x000000).setOrigin(0, 0).setDepth(100)
    BGMManager.playMenuMusic(this, MENU_KEYS.INTRO)
    this.setupSkipControls(); this.createSkipHint(); this.startCutsceneSequence()
  }

  setupSkipControls() { this.input.keyboard.on("keydown", () => this.skipCutscene()); this.input.on("pointerdown", () => this.skipCutscene()) }
  createSkipHint() {
    this.skipHint = this.add.text(this.width - 20, this.height - 30, "Press any key to skip", { fontFamily: "RetroPixel", fontSize: "14px", color: "#666666" }).setOrigin(1, 0.5).setAlpha(0).setDepth(101)
    this.time.delayedCall(1500, () => { if (!this.cutsceneSkipped) this.tweens.add({ targets: this.skipHint, alpha: 0.7, duration: 500 }) })
  }

  skipCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneSkipped = true; this.tweens.killAll(); this.time.removeAllEvents()
    CutsceneManager.markWorldIntroWatched(15)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 300, onComplete: () => { this.sound.play("ui_confirm_sound", { volume: 0.3 }); BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  startCutsceneSequence() {
    const timeline = this.add.timeline([
      { at: 0, run: () => this.showCoreUniverse() },
      { at: 4000, run: () => this.showFinalWorld() },
      { at: 9000, run: () => this.showAllMechanics() },
      { at: 14000, run: () => this.showComposersDoubt() },
      { at: 19000, run: () => this.showFinalBattle() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showCoreUniverse() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 2000 })
    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_core_universe")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height)).setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 2000 })

    this.locationText = this.add.text(this.centerX, 80, "CORE OF SELF", { fontFamily: "RetroPixel", fontSize: "28px", color: "#ff69b4", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1500 })
  }

  showFinalWorld() {
    this.sound.play("intro_impact", { volume: 0.5 }); this.flashTransition()
    if (this.locationText) this.locationText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x110011).setOrigin(0, 0).setDepth(-1)

    this.titleText = this.add.text(this.centerX, this.centerY - 30, "THE DIMINISHED CHORD", { fontFamily: "RetroPixel", fontSize: "36px", color: "#ff69b4" }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.subtitleText = this.add.text(this.centerX, this.centerY + 20, "THE FINAL WORLD", { fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff" }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.titleText, alpha: 1, scale: { from: 0.5, to: 1 }, duration: 1000, ease: "Back.easeOut" })
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 800 })

    // Epic pulse
    const pulse = this.add.circle(this.centerX, this.centerY, 50, 0xff69b4, 0.3).setDepth(30)
    this.tweens.add({ targets: pulse, scale: 5, alpha: 0, duration: 2000, onComplete: () => pulse.destroy() })
  }

  showAllMechanics() {
    this.sound.play("intro_whoosh", { volume: 0.4 }); this.flashTransition()
    if (this.titleText) this.titleText.destroy(); if (this.subtitleText) this.subtitleText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "world15_diminished_chord_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"Everything you\'ve learned. Everything you are."', { fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 1000, delay: 1000 })

    this.tweens.add({ targets: this.currentBg, scale: this.currentBg.scale * 1.1, duration: 5000, ease: "Sine.easeInOut" })
  }

  showComposersDoubt() {
    this.sound.play("intro_impact", { volume: 0.6 }); this.flashTransition()
    if (this.dialogText) this.dialogText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510).setOrigin(0, 0).setDepth(-1)

    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss15_composers_doubt").setScale(0.4).setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 1, duration: 1000 })
    // Ominous pulse
    this.tweens.add({ targets: this.bossImage, scale: { from: 0.4, to: 0.45 }, duration: 800, yoyo: true, repeat: 2 })

    this.bossText = this.add.text(this.centerX, 70, "SELF-DOUBT MANIFESTATION", { fontFamily: "RetroPixel", fontSize: "26px", color: "#ff69b4", stroke: "#000000", strokeThickness: 5 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.bossText, alpha: 1, duration: 800, ease: "Back.easeOut" })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"The final boss is yourself."', { fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showFinalBattle() {
    this.sound.play("intro_whoosh", { volume: 0.5 }); this.flashTransition()
    if (this.bossImage) this.bossImage.destroy(); if (this.bossText) this.bossText.destroy(); if (this.dialogText) this.dialogText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a1a).setOrigin(0, 0).setDepth(-1)

    this.teddy = this.add.image(this.centerX, this.centerY + 50, "intro_teddy_action_pose").setScale(0.55).setAlpha(0)
    this.tweens.add({ targets: this.teddy, alpha: 1, scale: 0.6, duration: 800, ease: "Back.easeOut" })

    this.endingText = this.add.text(this.centerX, 90, "THIS IS YOUR MOMENT", { fontFamily: "RetroPixel", fontSize: "30px", color: "#ff69b4", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })

    // Final dramatic burst
    this.time.delayedCall(1500, () => {
      if (this.cutsceneSkipped) return
      const burst = this.add.circle(this.centerX, this.centerY, 10, 0xff69b4, 0.6).setDepth(30)
      this.tweens.add({ targets: burst, scale: 40, alpha: 0, duration: 1000, onComplete: () => burst.destroy() })
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true; CutsceneManager.markWorldIntroWatched(15)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 1000, onComplete: () => { BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xff69b4).setOrigin(0, 0).setAlpha(0).setDepth(99)
    this.tweens.add({ targets: flash, alpha: 0.5, duration: 100, yoyo: true, onComplete: () => flash.destroy() })
  }
}
