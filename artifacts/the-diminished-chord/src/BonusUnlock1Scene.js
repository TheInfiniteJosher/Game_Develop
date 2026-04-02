import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * BonusUnlock1Scene - Unlocks when player completes all bonus levels in Acts I & II
 * 
 * Story: A secret recording session is discovered - the "Lost Basement Tapes"
 * from before Teddy became famous. Raw, unpolished, pure energy.
 */
export class BonusUnlock1Scene extends Phaser.Scene {
  constructor() {
    super({ key: "BonusUnlock1Scene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "UniverseSelectScene"
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

    CutsceneManager.markWatched("bonus_unlock_1")

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
      { at: 0, run: () => this.showDiscovery() },
      { at: 4000, run: () => this.showOldTapes() },
      { at: 8000, run: () => this.showMemories() },
      { at: 12000, run: () => this.showUnlock() },
      { at: 16000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showDiscovery() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0808)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 80, "SECRET DISCOVERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffcc00",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 800,
      delay: 500,
      ease: "Back.easeOut"
    })

    // Dusty box
    this.add.text(this.centerX, this.centerY, "📦💨", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, this.height - 60,
      "An old box in the corner of the studio...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1500
    })
  }

  showOldTapes() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x080505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "THE LOST BASEMENT TAPES", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff4466"
    }).setOrigin(0.5).setDepth(50)

    // Cassette tapes
    const tapes = ["📼", "📼", "📼", "📼", "📼"]
    tapes.forEach((tape, i) => {
      const text = this.add.text(
        200 + i * 150,
        this.centerY,
        tape,
        { fontSize: "50px" }
      ).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: text,
        alpha: 1,
        rotation: Phaser.Math.FloatBetween(-0.2, 0.2),
        duration: 400,
        delay: i * 200
      })
    })

    this.add.text(this.centerX, this.height - 60,
      "Recordings from before anyone knew the name...", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#aaaaaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1500
    })
  }

  showMemories() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0808)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Sepia-toned flashback
    this.add.text(this.centerX, 60, "THE EARLY DAYS", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#cc9966"
    }).setOrigin(0.5).setDepth(50)

    // Old band playing in basement
    this.add.text(this.centerX, this.centerY - 30, "🧸🎸 🎤 🥁", {
      fontSize: "50px"
    }).setOrigin(0.5).setAlpha(0.7).setDepth(40)

    // Film grain effect
    for (let i = 0; i < 20; i++) {
      const grain = this.add.circle(
        Phaser.Math.Between(0, this.width),
        Phaser.Math.Between(0, this.height),
        Phaser.Math.Between(1, 3),
        0xffffff
      ).setAlpha(0.1).setDepth(30)

      this.tweens.add({
        targets: grain,
        alpha: { from: 0.1, to: 0 },
        duration: 200,
        repeat: -1,
        repeatDelay: Phaser.Math.Between(100, 500)
      })
    }

    this.add.text(this.centerX, this.height - 60,
      "\"This is where the magic began.\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffcc88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2000
    })
  }

  showUnlock() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050510)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 80, "BONUS CONTENT UNLOCKED!", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ff88"
    }).setOrigin(0.5).setDepth(50)

    // Unlock rewards
    const rewards = [
      "🎵 5 Bonus Tracks",
      "🖼️ Concept Art Gallery",
      "📝 Developer Commentary"
    ]

    rewards.forEach((reward, i) => {
      const text = this.add.text(
        this.centerX,
        180 + i * 60,
        reward,
        {
          fontFamily: "RetroPixel",
          fontSize: "20px",
          color: "#ffffff"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: text,
        alpha: 1,
        x: { from: this.centerX + 100, to: this.centerX },
        duration: 400,
        delay: i * 400
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "Check the Music Library for new content!", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2000
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markWatched("bonus_unlock_1")

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
