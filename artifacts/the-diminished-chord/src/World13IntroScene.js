import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World13IntroScene - Noise Collapse
 */
export class World13IntroScene extends Phaser.Scene {
  constructor() { super({ key: "World13IntroScene" }) }
  init(data) { this.returnScene = data.returnScene || "WorldLevelSelectScene"; this.returnData = data.returnData || { worldNum: 13 } }

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
    CutsceneManager.markWorldIntroWatched(13)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 300, onComplete: () => { this.sound.play("ui_confirm_sound", { volume: 0.3 }); BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  startCutsceneSequence() {
    const timeline = this.add.timeline([
      { at: 0, run: () => this.showStaticRealm() },
      { at: 4000, run: () => this.showGlitchWorld() },
      { at: 9000, run: () => this.showNoiseStorm() },
      { at: 14000, run: () => this.showEntropyBeast() },
      { at: 19000, run: () => this.showFindSignal() },
      { at: 24000, run: () => this.endCutscene() }
    ])
    timeline.play()
  }

  showStaticRealm() {
    this.tweens.add({ targets: this.blackOverlay, alpha: 0, duration: 1000 })
    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_static_realm")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height)).setAlpha(0)
    this.tweens.add({ targets: this.currentBg, alpha: 1, duration: 1000 })

    this.locationText = this.add.text(this.centerX, 80, "STATIC REALM", { fontFamily: "RetroPixel", fontSize: "28px", color: "#ff4444", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.locationText, alpha: 1, duration: 1000, delay: 1000 })
    this.subtitleText = this.add.text(this.centerX, 115, "Noise Collapse", { fontFamily: "RetroPixel", fontSize: "14px", color: "#888888" }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.subtitleText, alpha: 1, duration: 500, delay: 1500 })
  }

  showGlitchWorld() {
    this.sound.play("intro_whoosh", { volume: 0.3 }); this.flashTransition()
    if (this.locationText) this.locationText.destroy(); if (this.subtitleText) this.subtitleText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.image(this.centerX, this.centerY, "world13_noise_collapse_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))

    // Heavy glitch effect
    this.createGlitchEffect()

    this.dialogText = this.add.text(this.centerX, this.height - 80, '"Everything is falling apart..."', { fontFamily: "RetroPixel", fontSize: "18px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })
  }

  createGlitchEffect() {
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 200, () => {
        if (this.cutsceneSkipped) return
        const glitch = this.add.rectangle(Phaser.Math.Between(0, this.width), Phaser.Math.Between(0, this.height), Phaser.Math.Between(50, 200), Phaser.Math.Between(5, 20), Phaser.Math.Between(0, 0xffffff), 0.5).setDepth(40)
        this.tweens.add({ targets: glitch, alpha: 0, duration: 100, onComplete: () => glitch.destroy() })
      })
    }
  }

  showNoiseStorm() {
    this.sound.play("intro_whoosh", { volume: 0.4 }); this.flashTransition()
    if (this.dialogText) this.dialogText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a0a0a).setOrigin(0, 0).setDepth(-1)

    this.noiseText = this.add.text(this.centerX, this.centerY - 50, "█▓▒░ NOISE ░▒▓█", { fontFamily: "RetroPixel", fontSize: "32px", color: "#ff4444" }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.noiseText, alpha: 1, duration: 500 })
    this.tweens.add({ targets: this.noiseText, x: this.noiseText.x + 10, duration: 30, yoyo: true, repeat: 20 })

    this.dialogText = this.add.text(this.centerX, this.height - 60, '"The silence is creeping in. Don\'t let it win."', { fontFamily: "RetroPixel", fontSize: "16px", color: "#888888", stroke: "#000000", strokeThickness: 2 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1000 })
  }

  showEntropyBeast() {
    this.sound.play("intro_impact", { volume: 0.5 }); this.flashTransition()
    if (this.noiseText) this.noiseText.destroy(); if (this.dialogText) this.dialogText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a0a).setOrigin(0, 0).setDepth(-1)

    this.bossImage = this.add.image(this.centerX, this.centerY + 30, "boss13_entropy_beast").setScale(0.4).setAlpha(0)
    this.tweens.add({ targets: this.bossImage, alpha: 1, duration: 800 })
    // Chaotic movement
    this.tweens.add({ targets: this.bossImage, x: this.bossImage.x + 20, y: this.bossImage.y - 10, duration: 200, yoyo: true, repeat: 5 })

    this.bossText = this.add.text(this.centerX, 80, "FEEDBACK LOOP", { fontFamily: "RetroPixel", fontSize: "32px", color: "#ff4444", stroke: "#000000", strokeThickness: 5 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.bossText, alpha: 1, duration: 800, ease: "Back.easeOut" })

    this.dialogText = this.add.text(this.centerX, this.height - 50, '"Chaos incarnate. Pure entropy."', { fontFamily: "RetroPixel", fontSize: "16px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.dialogText, alpha: 1, duration: 500, delay: 1200 })
  }

  showFindSignal() {
    this.sound.play("intro_whoosh", { volume: 0.4 }); this.flashTransition()
    if (this.bossImage) this.bossImage.destroy(); if (this.bossText) this.bossText.destroy(); if (this.dialogText) this.dialogText.destroy(); if (this.currentBg) this.currentBg.destroy()

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050505).setOrigin(0, 0).setDepth(-1)

    this.teddy = this.add.image(this.centerX, this.centerY + 50, "teddy_punk_front_view").setScale(0.4).setAlpha(0)
    this.tweens.add({ targets: this.teddy, alpha: 1, scale: 0.45, duration: 800, ease: "Back.easeOut" })

    this.endingText = this.add.text(this.centerX, 100, "FIND THE SIGNAL", { fontFamily: "RetroPixel", fontSize: "28px", color: "#ff4444", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0).setDepth(50)
    this.tweens.add({ targets: this.endingText, alpha: 1, duration: 1000, delay: 500 })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true; CutsceneManager.markWorldIntroWatched(13)
    this.tweens.add({ targets: this.blackOverlay, alpha: 1, duration: 1000, onComplete: () => { BGMManager.stop(); this.scene.start(this.returnScene, this.returnData) } })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xffffff).setOrigin(0, 0).setAlpha(0).setDepth(99)
    this.tweens.add({ targets: flash, alpha: 0.6, duration: 80, yoyo: true, onComplete: () => flash.destroy() })
  }
}
