import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * BonusUnlock2Scene - Unlocks when player achieves 100% completion
 * 
 * Story: The Ultimate Secret - a hidden message from the developers,
 * the "true" story behind The Diminished Chord, and a special thank you
 * to completionists.
 */
export class BonusUnlock2Scene extends Phaser.Scene {
  constructor() {
    super({ key: "BonusUnlock2Scene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "TitleScreen"
    this.returnData = data.returnData || {}
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

    CutsceneManager.markWatched("bonus_unlock_2")

    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 1,
      duration: 300,
      onComplete: () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        BGMManager.stop()
        this.scene.start(this.returnScene, this.returnData)
      }
    })
  }

  startCutsceneSequence() {
    const timeline = this.add.timeline([
      { at: 0, run: () => this.showPerfectCompletion() },
      { at: 4000, run: () => this.showTrueStory() },
      { at: 10000, run: () => this.showDevMessage() },
      { at: 16000, run: () => this.showUltimateReward() },
      { at: 22000, run: () => this.showThankYou() },
      { at: 28000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showPerfectCompletion() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1500
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Golden celebration
    this.createGoldenParticles()

    this.add.text(this.centerX, 100, "100% COMPLETE!", {
      fontFamily: "RetroPixel",
      fontSize: "40px",
      color: "#ffcc00",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 1000,
      delay: 500,
      ease: "Elastic.easeOut"
    })

    this.add.text(this.centerX, this.centerY, "🏆", {
      fontSize: "120px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, this.height - 60,
      "You've seen everything. Or have you?", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2500
    })
  }

  createGoldenParticles() {
    for (let i = 0; i < 30; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, this.width),
        -20,
        Phaser.Math.Between(3, 8),
        0xffcc00
      ).setAlpha(0.7).setDepth(30)

      this.tweens.add({
        targets: particle,
        y: this.height + 20,
        alpha: 0,
        duration: Phaser.Math.Between(2000, 4000),
        delay: i * 100,
        repeat: -1
      })
    }
  }

  showTrueStory() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x080508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 50, "THE TRUE STORY", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // The real inspiration
    const story = [
      "The Diminished Chord isn't just a game.",
      "It's a story about artistic integrity.",
      "About staying true to yourself.",
      "About the music industry's dark side.",
      "And about finding your own path."
    ]

    story.forEach((line, i) => {
      const text = this.add.text(
        this.centerX,
        120 + i * 50,
        line,
        {
          fontFamily: "RetroPixel",
          fontSize: "14px",
          color: i === 0 ? "#ffcc00" : "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 500,
        delay: i * 800
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "This game was made by someone who lived it.", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 4500
    })
  }

  showDevMessage() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 50, "A MESSAGE FROM THE CREATOR", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Developer message
    const message = `"Thank you for playing through everything.

This game represents my own journey
as a musician and creator.

Every struggle Teddy faced,
I faced too.

The diminished chord that haunted him?
That was a real song I couldn't finish
for years.

Until I did.

And now, so have you."

- The Developer 🎸`

    this.add.text(this.centerX, this.centerY + 20, message, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff",
      align: "center",
      lineSpacing: 8
    }).setOrigin(0.5).setDepth(50)
  }

  showUltimateReward() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "ULTIMATE REWARDS UNLOCKED!", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#00ff88"
    }).setOrigin(0.5).setDepth(50)

    // Ultimate rewards list
    const rewards = [
      "🎵 Complete Soundtrack Download",
      "👑 Golden Teddy Skin",
      "🎬 Behind-the-Scenes Documentary",
      "📜 Full Game Script",
      "🔓 Level Creator Access",
      "♾️ Infinite Mode Unlocked"
    ]

    rewards.forEach((reward, i) => {
      const text = this.add.text(
        this.centerX,
        130 + i * 50,
        reward,
        {
          fontFamily: "RetroPixel",
          fontSize: "16px",
          color: "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 300,
        delay: i * 300
      })
    })
  }

  showThankYou() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Final thank you
    this.add.text(this.centerX, this.centerY - 80, "THANK YOU", {
      fontFamily: "RetroPixel",
      fontSize: "48px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY,
      "For believing in independent music.\nFor believing in this game.\nFor completing every note.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888",
      align: "center"
    }).setOrigin(0.5).setDepth(50)

    // Heart
    const heart = this.add.text(this.centerX, this.centerY + 100, "♥", {
      fontSize: "60px",
      color: "#ff4466"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: heart,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 1000,
      delay: 2000,
      ease: "Back.easeOut"
    })

    // Pulsing heart
    this.tweens.add({
      targets: heart,
      scale: { from: 1, to: 1.1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      delay: 3000
    })

    this.add.text(this.centerX, this.height - 40,
      "Now go make some music. 🎵", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffcc00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 4000
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markWatched("bonus_unlock_2")

    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 1,
      duration: 2000,
      onComplete: () => {
        BGMManager.stop()
        this.scene.start(this.returnScene, this.returnData)
      }
    })
  }

  flashTransition() {
    const flash = this.add.rectangle(0, 0, this.width, this.height, 0xffffff)
    flash.setOrigin(0, 0).setAlpha(0).setDepth(99)

    this.tweens.add({
      targets: flash,
      alpha: 0.6,
      duration: 80,
      yoyo: true,
      onComplete: () => flash.destroy()
    })
  }
}
