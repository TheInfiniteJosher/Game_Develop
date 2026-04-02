import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World11PostBossScene - Post-Boss cutscene for World 11 (Self-Doubt)
 * 
 * Story: The beginning of Act III. After confronting the Self-Doubt boss,
 * Teddy faces his deepest fears. Was leaving the label the right choice?
 * The inner demons whisper, but a spark of determination remains.
 */
export class World11PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World11PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 11 }
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

    CutsceneManager.markPostBossWatched(11)

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
      { at: 0, run: () => this.showDoubtVictory() },
      { at: 4000, run: () => this.showInnerVoices() },
      { at: 8000, run: () => this.showMemoryFlashback() },
      { at: 12000, run: () => this.showDarkestMoment() },
      { at: 16000, run: () => this.showSparkOfHope() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showDoubtVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Dark psychological space
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Swirling darkness
    this.createDarkSwirls()

    this.titleText = this.add.text(this.centerX, 100, "DOUBT CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#8844aa",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      scale: { from: 0.8, to: 1 },
      duration: 800,
      ease: "Back.easeOut"
    })

    this.subtitleText = this.add.text(this.centerX, this.height - 80,
      "But the battle within has just begun...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aa88cc"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createDarkSwirls() {
    for (let i = 0; i < 5; i++) {
      const swirl = this.add.circle(
        this.centerX + Phaser.Math.Between(-200, 200),
        this.centerY + Phaser.Math.Between(-100, 100),
        Phaser.Math.Between(50, 150),
        0x220033
      ).setAlpha(0.3).setDepth(5)

      this.tweens.add({
        targets: swirl,
        x: swirl.x + Phaser.Math.Between(-100, 100),
        y: swirl.y + Phaser.Math.Between(-50, 50),
        scale: { from: 1, to: 1.3 },
        alpha: { from: 0.3, to: 0.1 },
        duration: 4000,
        yoyo: true,
        repeat: -1
      })
    }
  }

  showInnerVoices() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Voices in the dark
    this.currentBg.setFillStyle(0x030305)

    this.add.text(this.centerX, 50, "THE VOICES", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#666666"
    }).setOrigin(0.5).setDepth(50)

    // Negative thoughts appearing
    const thoughts = [
      { text: "You're nothing without them...", x: 200, y: 150 },
      { text: "Should have taken the money...", x: 800, y: 200 },
      { text: "Nobody cares anymore...", x: 300, y: 350 },
      { text: "You'll never make it alone...", x: 700, y: 400 },
      { text: "It was all luck...", x: 500, y: 500 }
    ]

    thoughts.forEach((thought, i) => {
      const text = this.add.text(thought.x, thought.y, thought.text, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#884444"
      }).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: text,
        alpha: { from: 0, to: 0.7 },
        duration: 500,
        delay: i * 400,
        yoyo: true,
        hold: 1000
      })
    })

    // Teddy in the center, overwhelmed
    this.add.text(this.centerX, this.centerY, "🧸😰", {
      fontSize: "60px"
    }).setOrigin(0.5).setDepth(45)
  }

  showMemoryFlashback() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Flashback to happier times
    this.add.text(this.centerX, 50, "REMEMBER...", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffcc88"
    }).setOrigin(0.5).setDepth(50)

    // Old footage style - sepia/vintage
    const flashback = this.add.rectangle(
      this.centerX, this.centerY,
      500, 300, 0x332211
    ).setAlpha(0.5).setDepth(20)

    // Scene: Basement show with friends
    this.add.text(this.centerX, this.centerY - 40, "🧸🎸 👤👤👤", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40).setAlpha(0.8)

    this.add.text(this.centerX, this.centerY + 60,
      "The first basement show...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ccaa88"
    }).setOrigin(0.5).setDepth(50)

    // Nostalgia effect
    this.add.text(this.centerX, this.height - 60,
      "\"When it was just about the music...\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aaaaaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1500
    })
  }

  showDarkestMoment() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000003)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // The darkest moment
    this.add.text(this.centerX, 80, "THE ABYSS", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#444444"
    }).setOrigin(0.5).setDepth(50)

    // Teddy at the edge
    const teddy = this.add.text(this.centerX, this.centerY, "🧸", {
      fontSize: "60px"
    }).setOrigin(0.5).setDepth(40)

    // Fading away effect
    this.tweens.add({
      targets: teddy,
      alpha: { from: 1, to: 0.3 },
      scale: { from: 1, to: 0.8 },
      duration: 2000
    })

    this.add.text(this.centerX, this.height - 80,
      "\"Maybe they were right...\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#553333"
    }).setOrigin(0.5).setDepth(50)
  }

  showSparkOfHope() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000005)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // A small light appears
    const spark = this.add.circle(this.centerX, this.centerY, 5, 0xffffff)
    spark.setDepth(40).setAlpha(0)

    this.tweens.add({
      targets: spark,
      alpha: 1,
      scale: { from: 1, to: 3 },
      duration: 1000
    })

    // Teddy looking up
    this.add.text(this.centerX, this.centerY + 100, "🧸", {
      fontSize: "60px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, 80, "BUT WAIT...", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1000
    })

    this.add.text(this.centerX, this.height - 60,
      "\"No. I didn't come this far to give up.\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2000
    })

    this.add.text(this.centerX, this.height - 30,
      "Time fractures await...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 3000
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markPostBossWatched(11)

    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 1,
      duration: 1000,
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
