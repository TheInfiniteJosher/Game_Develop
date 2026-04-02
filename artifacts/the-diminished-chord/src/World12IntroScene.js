import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World12IntroScene - Time Fracture
 */
export class World12IntroScene extends Phaser.Scene {
  constructor() { super({ key: "World12IntroScene" }) }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 12 }
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
    CutsceneManager.markWorldIntroWatched(12)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 300, onComplete: () => { this.sound.play("ui_confirm_sound", { volume: 0.3 }); BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  startCutsceneSequence() {
    const timeline = this.add.timeline([
      { at: 0, run: () => this.showTemporalVoid() },
      { at: 4000, run: () => this.showFirstSongMemory() },
      { at: 9000, run: () => this.showTimeFracture() },
      { at: 14000, run: () => this.showChronos() },
      { at: 19000, run: () => this.showRememberWhy() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showTemporalVoid() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 1500 })

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_temporal_void")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height)).setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 1500 })

    this.locationText = this.add.text(this.centerX, 80, "TEMPORAL VOID", {
      fontFamily: "RetroPixel", fontSize: "28px", color: "#00ffaa", stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1000 })

    this.subtitleText = this.add.text(this.centerX, 115, "Time Fracture", {
      fontFamily: "RetroPixel", fontSize: "14px", color: "#ffaa00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 1500 })
  }

  showFirstSongMemory() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()
    if (this.locationText) this.locationText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_first_song_memory")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    
    // Sepia/nostalgic tint
    this.currentBg.setTint(0xffeecc)

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"Remember when music was just... joy?"', {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff", stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })
  }

  showTimeFracture() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "world12_time_fracture_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    // Clock/time visualization
    this.timeText = this.add.text(this.centerX, this.centerY - 50, "⏰ FRACTURED ⏰", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#00ffaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({ targets: this.timeText, alpha: 1, duration: 500 })
    
    // Glitch effect
    this.tweens.add({ targets: this.timeText, x: this.timeText.x + 5, duration: 50, yoyo: true, repeat: 10, delay: 500 })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"Past and future collide. Which path do you choose?"', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff", stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showChronos() {
    this.sound.play("intro_impact", { volume: 0.5 })
    this.flashTransition()
    if (this.timeText) this.timeText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x001a1a).setOrigin(0, 0).setDepth(-1)

    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss12_chronos")
    this.bossImage.setScale(0.5).setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 1, duration: 800 })

    this.bossText = this.add.text(this.centerX, 80, "THE METRONOME", {
      fontFamily: "RetroPixel", fontSize: "32px", color: "#00ffaa", stroke: "#000000", strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.bossText, alpha: 1, duration: 800, ease: "Back.easeOut" })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"Keep the beat... or be lost to time."', {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff", stroke: "#000000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showRememberWhy() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()
    if (this.bossImage) this.bossImage.destroy()
    if (this.bossText) this.bossText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a1a).setOrigin(0, 0).setDepth(-1)

    this.teddy = this.add.image(this.centerX, this.centerY + 50, "teddy_punk_front_view").setScale(0.4).setAlpha(0)
    this.tweens.add({ targets: this.teddy, alpha: 1, scale: 0.45, duration: 800, ease: "Back.easeOut" })

    this.endingText = this.add.text(this.centerX, 100, "REMEMBER WHY YOU STARTED", {
      fontFamily: "RetroPixel", fontSize: "24px", color: "#00ffaa", stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true
    CutsceneManager.markWorldIntroWatched(12)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 1000, onComplete: () => { BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xffffff).setOrigin(0, 0).setAlpha(0).setDepth(99)
    this.tweens.add({ targets: flash, alpha: 0.6, duration: 80, yoyo: true, onComplete: () => flash.destroy() })
  }
}
