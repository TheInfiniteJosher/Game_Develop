import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * EpilogueScene - The true ending epilogue after completing everything
 * 
 * Story: A glimpse into the future. Teddy continues to make music on his
 * own terms. New adventures await. The legacy grows. This is the reward
 * for completing all content in the game.
 */
export class EpilogueScene extends Phaser.Scene {
  constructor() {
    super({ key: "EpilogueScene" })
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

    this.time.delayedCall(2000, () => {
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

    CutsceneManager.markWatched("epilogue")

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
      { at: 0, run: () => this.showTimeLater() },
      { at: 5000, run: () => this.showNewStudio() },
      { at: 10000, run: () => this.showIndependentSuccess() },
      { at: 15000, run: () => this.showFansWorldwide() },
      { at: 20000, run: () => this.showTheBand() },
      { at: 25000, run: () => this.showNewAdventure() },
      { at: 30000, run: () => this.showFinalMessage() },
      { at: 36000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showTimeLater() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 2000
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000005)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Time skip text
    this.add.text(this.centerX, this.centerY - 40, "ONE YEAR LATER...", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 2000,
      delay: 1000
    })
  }

  showNewStudio() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0810)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "THE NEW STUDIO", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Home studio setup
    this.add.text(this.centerX, this.centerY - 50, "🎹🎸🎤🥁", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    // Teddy at the controls
    this.add.text(this.centerX, this.centerY + 50, "🧸🎧", {
      fontSize: "60px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, this.height - 60,
      "A small studio. A big dream. Complete creative freedom.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2000
    })
  }

  showIndependentSuccess() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "INDEPENDENT SUCCESS", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ff88"
    }).setOrigin(0.5).setDepth(50)

    // Success metrics
    const stats = [
      "🎵 5 Albums Released",
      "📀 1 Million Downloads",
      "🏆 \"Artist of the Year\" (Independent)",
      "💰 Self-Funded World Tour"
    ]

    stats.forEach((stat, i) => {
      const text = this.add.text(
        this.centerX,
        150 + i * 60,
        stat,
        {
          fontFamily: "RetroPixel",
          fontSize: "18px",
          color: "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: text,
        alpha: 1,
        x: { from: this.centerX + 100, to: this.centerX },
        duration: 400,
        delay: i * 500
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "On YOUR terms.", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffcc00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2500
    })
  }

  showFansWorldwide() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x030508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "FANS WORLDWIDE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // World map with fan locations
    const fans = [
      { emoji: "🇺🇸", x: 200, y: 200 },
      { emoji: "🇩🇪", x: 550, y: 180 },
      { emoji: "🇯🇵", x: 850, y: 220 },
      { emoji: "🇬🇧", x: 500, y: 160 },
      { emoji: "🇦🇺", x: 900, y: 400 },
      { emoji: "🇧🇷", x: 350, y: 380 },
      { emoji: "🇮🇸", x: 450, y: 120 },
      { emoji: "🇰🇷", x: 820, y: 200 }
    ]

    fans.forEach((fan, i) => {
      const text = this.add.text(fan.x, fan.y, fan.emoji, {
        fontSize: "30px"
      }).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: text,
        alpha: 1,
        scale: { from: 0.5, to: 1 },
        duration: 400,
        delay: i * 300,
        ease: "Back.easeOut"
      })
    })

    // Connection lines
    this.time.delayedCall(2500, () => {
      if (this.cutsceneSkipped) return
      this.add.text(this.centerX, this.height - 80,
        "Connected by music. United by passion.", {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#88ccff"
      }).setOrigin(0.5).setDepth(50)
    })
  }

  showTheBand() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x080505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "THE BAND", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff4488"
    }).setOrigin(0.5).setDepth(50)

    // Band members
    const members = [
      { emoji: "🧸🎸", name: "Teddy", role: "Guitar/Vocals" },
      { emoji: "🥁", name: "Riff", role: "Drums" },
      { emoji: "🎸", name: "Groove", role: "Bass" },
      { emoji: "🎹", name: "Echo", role: "Keys" }
    ]

    members.forEach((member, i) => {
      const container = this.add.container(
        200 + i * 200,
        this.centerY
      )

      const emoji = this.add.text(0, -30, member.emoji, {
        fontSize: "40px"
      }).setOrigin(0.5)

      const name = this.add.text(0, 30, member.name, {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#ffffff"
      }).setOrigin(0.5)

      const role = this.add.text(0, 55, member.role, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }).setOrigin(0.5)

      container.add([emoji, name, role])
      container.setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: container,
        alpha: 1,
        y: { from: this.centerY + 30, to: this.centerY },
        duration: 500,
        delay: i * 400
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "Family. Forever.", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff88aa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2500
    })
  }

  showNewAdventure() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 80, "THE NEXT ADVENTURE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Tour bus heading into sunset
    this.add.text(this.centerX, this.centerY - 50, "🚐💨", {
      fontSize: "60px"
    }).setOrigin(0.5).setDepth(40)

    // Road ahead
    this.add.text(this.centerX, this.centerY + 50, "━━━━━━━━━━━━", {
      fontFamily: "RetroPixel",
      fontSize: "30px",
      color: "#333344"
    }).setOrigin(0.5).setDepth(30)

    // Destination unknown
    this.add.text(this.centerX, this.centerY + 100,
      "Destination: Unknown", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "And that's exactly how we like it.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2000
    })
  }

  showFinalMessage() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Final quote
    this.add.text(this.centerX, this.centerY - 80,
      "\"The diminished chord was never incomplete.", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY - 40,
      "It was just waiting for the right moment", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY,
      "to resolve.\"", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 60, "- Teddy", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffcc00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2000
    })

    // THE END
    this.add.text(this.centerX, this.height - 80, "THE END", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 1000,
      delay: 4000
    })

    // Or is it?
    this.add.text(this.centerX, this.height - 50, "...or is it? 🎸", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#444444"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 5000
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markWatched("epilogue")

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
