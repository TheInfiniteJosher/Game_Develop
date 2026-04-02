import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World8PostBossScene - Post-Boss cutscene for World 8 (Sydney)
 * 
 * Story: After conquering the Arena Tour boss, Teddy reaches peak commercial
 * success. But the soul of the music feels diluted. A chance encounter
 * reminds him why he started.
 */
export class World8PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World8PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 8 }
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

    CutsceneManager.markPostBossWatched(8)

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
      { at: 0, run: () => this.showArenaVictory() },
      { at: 4000, run: () => this.showMassiveSuccess() },
      { at: 8000, run: () => this.showEmptyFeeling() },
      { at: 12000, run: () => this.showFanEncounter() },
      { at: 16000, run: () => this.showReminder() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showArenaVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Sydney Opera House inspired background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a1020)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Opera house silhouette
    this.add.text(this.centerX, 200, "🏛️", {
      fontSize: "150px"
    }).setOrigin(0.5).setAlpha(0.3).setDepth(5)

    this.titleText = this.add.text(this.centerX, 80, "ARENA CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff88cc",
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
      "80,000 screaming fans...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffaacc"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  showMassiveSuccess() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Chart success
    this.currentBg.setFillStyle(0x050510)

    this.add.text(this.centerX, 50, "CHART SUCCESS", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffcc00"
    }).setOrigin(0.5).setDepth(50)

    // Billboard chart
    const chartItems = [
      { pos: "1", title: "COMPROMISED DREAMS", change: "⬆️" },
      { pos: "2", title: "Radio Edit Mix", change: "⬆️" },
      { pos: "3", title: "Pop Punk Remix", change: "NEW" }
    ]

    chartItems.forEach((item, i) => {
      const container = this.add.container(this.centerX, 150 + i * 70)

      const bg = this.add.rectangle(0, 0, 500, 50, 0x222233)
      const posText = this.add.text(-220, 0, `#${item.pos}`, {
        fontFamily: "RetroPixel",
        fontSize: "24px",
        color: "#ffcc00"
      }).setOrigin(0, 0.5)

      const titleText = this.add.text(-150, 0, item.title, {
        fontFamily: "RetroPixel",
        fontSize: "18px",
        color: "#ffffff"
      }).setOrigin(0, 0.5)

      const changeText = this.add.text(200, 0, item.change, {
        fontSize: "20px"
      }).setOrigin(0.5)

      container.add([bg, posText, titleText, changeText])
      container.setDepth(40).setAlpha(0)

      this.tweens.add({
        targets: container,
        alpha: 1,
        x: { from: this.centerX + 100, to: this.centerX },
        duration: 400,
        delay: i * 300
      })
    })
  }

  showEmptyFeeling() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x080810)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Empty dressing room
    this.add.text(this.centerX, 50, "BACKSTAGE", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#666666"
    }).setOrigin(0.5).setDepth(50)

    // Mirror and Teddy
    const mirror = this.add.rectangle(
      this.centerX, this.centerY,
      200, 250, 0x111122
    ).setStrokeStyle(3, 0x444455).setDepth(30)

    this.add.text(this.centerX, this.centerY - 30, "🧸", {
      fontSize: "60px"
    }).setOrigin(0.5).setDepth(40)

    // Reflection looks sad
    this.add.text(this.centerX, this.centerY + 30, "😔", {
      fontSize: "40px"
    }).setOrigin(0.5).setAlpha(0.5).setDepth(35)

    this.dialogText = this.add.text(this.centerX, this.height - 60,
      "\"Is this what success feels like?\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#888888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  showFanEncounter() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0810)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Stage door encounter
    this.add.text(this.centerX, 50, "STAGE DOOR", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Young fan approaching
    this.add.text(this.centerX - 100, this.centerY, "🧒", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX + 100, this.centerY, "🧸", {
      fontSize: "60px"
    }).setOrigin(0.5).setDepth(40)

    // Fan holding old demo tape
    this.add.text(this.centerX - 100, this.centerY + 80, "📼", {
      fontSize: "30px"
    }).setOrigin(0.5).setDepth(45)

    this.add.text(this.centerX, this.height - 80,
      "\"Your basement recordings saved my life.\"", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ffaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1000
    })

    this.add.text(this.centerX, this.height - 50,
      "\"The RAW stuff. Before they changed you.\"", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff8888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2500
    })
  }

  showReminder() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000005)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Realization moment
    this.add.text(this.centerX, this.centerY - 60, "💡", {
      fontSize: "100px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX, this.centerY + 60,
      "\"I remember why I started...\"", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.height - 50,
      "NYC and the media circus await. Time to take back control.", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
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

    CutsceneManager.markPostBossWatched(8)

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
