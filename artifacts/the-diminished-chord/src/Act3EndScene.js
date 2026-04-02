import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * Act3EndScene - End of Act III Cinematic: "The Final Chord"
 * 
 * Story: The ultimate culmination of the journey. From self-doubt through
 * time fractures, noise collapse, clarity, and finally completing The 
 * Diminished Chord. The artist is whole. The music is complete.
 * 
 * This is the longest and most impactful cinematic - the game's true ending.
 */
export class Act3EndScene extends Phaser.Scene {
  constructor() {
    super({ key: "Act3EndScene" })
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

    CutsceneManager.markWatched("act_3_end")

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
      { at: 0, run: () => this.showActTitle() },
      { at: 5000, run: () => this.showInternalJourney() },
      { at: 12000, run: () => this.showOvercomingDoubt() },
      { at: 18000, run: () => this.showFindingClarity() },
      { at: 24000, run: () => this.showTheCompletedChord() },
      { at: 32000, run: () => this.showFullJourneyReflection() },
      { at: 40000, run: () => this.showTheLegacy() },
      { at: 48000, run: () => this.showCredits() },
      { at: 56000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showActTitle() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 2000
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.actText = this.add.text(this.centerX, this.centerY - 60, "ACT III", {
      fontFamily: "RetroPixel",
      fontSize: "48px",
      color: "#8844aa",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.titleText = this.add.text(this.centerX, this.centerY + 20, 
      "THE INTERNAL BATTLE", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.actText,
      alpha: 1,
      y: { from: this.centerY - 40, to: this.centerY - 60 },
      duration: 1500,
      delay: 1000
    })

    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      duration: 1500,
      delay: 2000
    })

    this.subtitleText = this.add.text(this.centerX, this.centerY + 80,
      "COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      scale: { from: 0.8, to: 1 },
      duration: 800,
      delay: 3500,
      ease: "Back.easeOut"
    })
  }

  showInternalJourney() {
    this.flashTransition()

    if (this.actText) this.actText.destroy()
    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    this.currentBg.setFillStyle(0x030308)

    this.add.text(this.centerX, 50, "THE INNER JOURNEY", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Internal world locations
    const worlds = [
      { name: "DOUBT", color: "#884488", emoji: "😰", desc: "Facing fear" },
      { name: "TIME", color: "#4488ff", emoji: "⏰", desc: "Seeing possibilities" },
      { name: "NOISE", color: "#ff4488", emoji: "📢", desc: "Filtering chaos" },
      { name: "CLARITY", color: "#ffffff", emoji: "💡", desc: "Finding truth" },
      { name: "CHORD", color: "#ffcc00", emoji: "🎵", desc: "Completion" }
    ]

    worlds.forEach((world, i) => {
      const container = this.add.container(150 + i * 180, this.centerY)

      const emoji = this.add.text(0, -30, world.emoji, {
        fontSize: "40px"
      }).setOrigin(0.5)

      const name = this.add.text(0, 20, world.name, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: world.color
      }).setOrigin(0.5)

      const desc = this.add.text(0, 45, world.desc, {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#666666"
      }).setOrigin(0.5)

      container.add([emoji, name, desc])
      container.setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: container,
        alpha: 1,
        duration: 600,
        delay: i * 800
      })
    })
  }

  showOvercomingDoubt() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "OVERCOMING DOUBT", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Dark voices fading
    const doubts = ["failure", "fake", "worthless", "alone", "nobody"]
    doubts.forEach((doubt, i) => {
      const text = this.add.text(
        Phaser.Math.Between(100, this.width - 100),
        Phaser.Math.Between(120, this.height - 150),
        doubt,
        {
          fontFamily: "RetroPixel",
          fontSize: "16px",
          color: "#442244"
        }
      ).setOrigin(0.5).setDepth(30)

      this.tweens.add({
        targets: text,
        alpha: 0,
        duration: 3000,
        delay: i * 400
      })
    })

    // Light growing
    const light = this.add.circle(this.centerX, this.centerY, 10, 0xffffff)
    light.setDepth(40).setAlpha(0)

    this.tweens.add({
      targets: light,
      alpha: 0.8,
      scale: { from: 1, to: 20 },
      duration: 4000,
      delay: 2000
    })

    this.add.text(this.centerX, this.height - 50,
      "\"I am enough.\"", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 4000
    })
  }

  showFindingClarity() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x081018)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "FINDING CLARITY", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // The truths revealed
    const truths = [
      "Music is not about fame",
      "It's about CONNECTION",
      "It's about TRUTH",
      "It's about being YOURSELF"
    ]

    truths.forEach((truth, i) => {
      const text = this.add.text(
        this.centerX,
        150 + i * 60,
        truth,
        {
          fontFamily: "RetroPixel",
          fontSize: i === 0 ? "18px" : "22px",
          color: i === 0 ? "#888888" : "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 600,
        delay: i * 800
      })
    })

    // Teddy enlightened
    this.add.text(this.centerX, this.height - 100, "🧸✨", {
      fontSize: "60px"
    }).setOrigin(0.5).setAlpha(0).setDepth(40)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 3500
    })
  }

  showTheCompletedChord() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000008)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Stars background
    for (let i = 0; i < 50; i++) {
      this.add.circle(
        Phaser.Math.Between(0, this.width),
        Phaser.Math.Between(0, this.height),
        Phaser.Math.Between(1, 2),
        0xffffff
      ).setAlpha(Phaser.Math.FloatBetween(0.3, 0.8)).setDepth(5)
    }

    this.add.text(this.centerX, 80, "THE DIMINISHED CHORD", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffcc00",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, 130, "COMPLETED", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Musical chord visualization
    const notes = ["C", "E♭", "G♭", "B♭♭"]
    notes.forEach((note, i) => {
      const noteText = this.add.text(
        250 + i * 180,
        this.centerY,
        note,
        {
          fontFamily: "RetroPixel",
          fontSize: "48px",
          color: "#ffcc00"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: noteText,
        alpha: 1,
        y: { from: this.centerY + 50, to: this.centerY },
        duration: 600,
        delay: i * 600,
        ease: "Back.easeOut"
      })
    })

    // Harmony line
    this.time.delayedCall(3000, () => {
      if (this.cutsceneSkipped) return
      const line = this.add.rectangle(
        this.centerX, this.centerY + 80,
        700, 4, 0xffcc00
      ).setAlpha(0).setDepth(45)

      this.tweens.add({
        targets: line,
        alpha: 1,
        scaleX: { from: 0, to: 1 },
        duration: 1500
      })
    })

    this.add.text(this.centerX, this.height - 60,
      "What was incomplete is now whole.", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 5000
    })
  }

  showFullJourneyReflection() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x030305)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 50, "THE COMPLETE JOURNEY", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // All 15 worlds as small icons
    const allWorlds = [
      "🏚️", "🏭", "🗼", "🌧️", "🎪",  // Act I
      "❄️", "🌴", "🏟️", "🗽", "🔓",  // Act II
      "😰", "⏰", "📢", "💡", "🎵"   // Act III
    ]

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const idx = row * 5 + col
        const icon = this.add.text(
          150 + col * 180,
          150 + row * 130,
          allWorlds[idx],
          { fontSize: "30px" }
        ).setOrigin(0.5).setAlpha(0).setDepth(40)

        this.tweens.add({
          targets: icon,
          alpha: 0.8,
          duration: 300,
          delay: idx * 150
        })
      }
    }

    // Act labels
    const actLabels = [
      { text: "ACT I: Underground", y: 260, color: "#ff4466" },
      { text: "ACT II: Industry", y: 390, color: "#ffcc00" },
      { text: "ACT III: Internal", y: 520, color: "#8844aa" }
    ]

    actLabels.forEach((label, i) => {
      this.add.text(this.centerX, label.y, label.text, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: label.color
      }).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: this.children.list[this.children.list.length - 1],
        alpha: 0.7,
        duration: 300,
        delay: 3000 + i * 500
      })
    })
  }

  showTheLegacy() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Dawn rising
    const dawn = this.add.ellipse(
      this.centerX, this.height,
      this.width * 2, 400,
      0xffaa44
    ).setAlpha(0).setDepth(5)

    this.tweens.add({
      targets: dawn,
      y: this.height - 100,
      alpha: 0.4,
      duration: 5000
    })

    this.add.text(this.centerX, 100, "THE LEGACY", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Teddy triumphant
    this.add.text(this.centerX, this.centerY - 30, "🧸🎸👑", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    // Final message
    const messages = [
      "The music lives on.",
      "The chord is complete.",
      "The artist is whole.",
      "The journey continues..."
    ]

    messages.forEach((msg, i) => {
      this.add.text(this.centerX, this.centerY + 80 + i * 35, msg, {
        fontFamily: "RetroPixel",
        fontSize: "16px",
        color: "#ffffff"
      }).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: this.children.list[this.children.list.length - 1],
        alpha: 1,
        duration: 500,
        delay: 2000 + i * 800
      })
    })
  }

  showCredits() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Game complete
    this.add.text(this.centerX, this.centerY - 120, "GAME COMPLETE", {
      fontFamily: "RetroPixel",
      fontSize: "40px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY - 60, 
      "THE DIMINISHED CHORD", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Thank you message
    this.add.text(this.centerX, this.centerY + 40,
      "Thank you for playing.", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 100,
      "The music never ends.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 1000,
      delay: 2000
    })

    // Heart
    this.add.text(this.centerX, this.height - 80, "♥", {
      fontSize: "40px",
      color: "#ff4466"
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

    CutsceneManager.markWatched("act_3_end")

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
