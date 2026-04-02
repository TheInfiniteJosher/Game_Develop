import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World14IntroScene - Clarity
 */
export class World14IntroScene extends Phaser.Scene {
  constructor() { super({ key: "World14IntroScene" }) }
  init(data) { this.returnScene = data.returnScene || "WorldLevelSelectScene"; this.returnData = data.returnData || { worldNum: 14 } }

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
    CutsceneManager.markWorldIntroWatched(14)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 300, onComplete: () => { this.sound.play("ui_confirm_sound", { volume: 0.3 }); BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  startCutsceneSequence() {
    const timeline = this.add.timeline([
      { at: 0, run: () => this.showPureSpace() },
      { at: 4000, run: () => this.showClarityDawn() },
      { at: 9000, run: () => this.showFloatingInstruments() },
      { at: 14000, run: () => this.showSelfMastery() },
      { at: 19000, run: () => this.showPureSkill() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showPureSpace() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 2000 })
    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_pure_space")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height)).setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 2000 })

    this.locationText = this.add.text(this.centerX, 80, "PURE SPACE", { fontFamily: "RetroPixel", fontSize: "28px", color: "#ffffff", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1000 })
    this.subtitleText = this.add.text(this.centerX, 115, "Clarity", { fontFamily: "RetroPixel", fontSize: "14px", color: "#ffdd00" }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 1500 })
  }

  showClarityDawn() {
    this.sound.play("intro_whoosh", { volume: 0.2 }); this.flashTransition()
    if (this.locationText) this.locationText.destroy(); if (this.subtitleText) this.subtitleText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "world14_clarity_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    // Peaceful glow
    const glow = this.add.circle(this.centerX, this.centerY, 100, 0xffffaa, 0.2).setDepth(30)
    this.tweens.add({ targets: glow, scale: 3, alpha: 0, duration: 3000 })

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"After the storm... peace."', { fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 1000, delay: 1000 })
  }

  showFloatingInstruments() {
    this.sound.play("intro_whoosh", { volume: 0.2 }); this.flashTransition()
    if (this.dialogText) this.dialogText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a1a2a).setOrigin(0, 0).setDepth(-1)

    // Floating instruments visualization
    const instruments = ["🎸", "🥁", "🎹", "🎤", "🎷"]
    instruments.forEach((inst, i) => {
      const text = this.add.text(this.centerX + (i - 2) * 100, this.centerY - 50, inst, { fontSize: "40px" }).setOrigin(0.5).setAlpha(0).setDepth(40)
      this.tweens.add({ targets: text, alpha: 1, y: text.y - 20, duration: 800, delay: i * 200, ease: "Sine.easeInOut" })
      this.tweens.add({ targets: text, y: text.y - 10, duration: 1500, yoyo: true, repeat: -1, delay: i * 200 + 800 })
    })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"Remember why you love this."', { fontFamily: "RetroPixel", fontSize: "18px", color: "#ffdd00", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1500 })
  }

  showSelfMastery() {
    this.sound.play("intro_impact", { volume: 0.4 }); this.flashTransition()
    if (this.dialogText) this.dialogText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a1a00).setOrigin(0, 0).setDepth(-1)

    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss14_self_mastery").setScale(0.4).setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 1, duration: 1000 })
    // Golden glow pulse
    this.tweens.add({ targets: this.bossImage, scale: { from: 0.4, to: 0.42 }, duration: 1000, yoyo: true, repeat: 2 })

    this.bossText = this.add.text(this.centerX, 80, "THE PERFECTIONIST", { fontFamily: "RetroPixel", fontSize: "32px", color: "#ffdd00", stroke: "#000000", strokeThickness: 5 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.bossText, alpha: 1, duration: 800, ease: "Back.easeOut" })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"Your final test. Pure skill. No tricks."', { fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showPureSkill() {
    this.sound.play("intro_whoosh", { volume: 0.3 }); this.flashTransition()
    if (this.bossImage) this.bossImage.destroy(); if (this.bossText) this.bossText.destroy(); if (this.dialogText) this.dialogText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a1a).setOrigin(0, 0).setDepth(-1)

    this.teddy = this.add.image(this.centerX, this.centerY + 50, "teddy_punk_front_view").setScale(0.4).setAlpha(0)
    this.tweens.add({ targets: this.teddy, alpha: 1, scale: 0.45, duration: 800, ease: "Back.easeOut" })

    this.endingText = this.add.text(this.centerX, 100, "PURE SKILL. NO GIMMICKS.", { fontFamily: "RetroPixel", fontSize: "26px", color: "#ffdd00", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true; CutsceneManager.markWorldIntroWatched(14)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 1000, onComplete: () => { BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xffffaa).setOrigin(0, 0).setAlpha(0).setDepth(99)
    this.tweens.add({ targets: flash, alpha: 0.6, duration: 100, yoyo: true, onComplete: () => flash.destroy() })
  }
}
