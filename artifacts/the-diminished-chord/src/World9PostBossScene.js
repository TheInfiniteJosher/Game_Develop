import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World9PostBossScene - Post-Boss cutscene for World 9 (NYC)
 * 
 * Story: After conquering the Media Circus boss, Teddy faces the ruthless
 * New York music press. A controversial interview sparks a turning point -
 * Teddy publicly challenges the industry.
 */
export class World9PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World9PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 9 }
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

    CutsceneManager.markPostBossWatched(9)

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
      { at: 0, run: () => this.showMediaVictory() },
      { at: 4000, run: () => this.showTVInterview() },
      { at: 8000, run: () => this.showControversialMoment() },
      { at: 12000, run: () => this.showPublicReaction() },
      { at: 16000, run: () => this.showLabelResponse() },
      { at: 20000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showMediaVictory() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // NYC skyline background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0812)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Skyline silhouette
    const buildings = [
      { x: 150, h: 200 }, { x: 250, h: 280 }, { x: 350, h: 320 },
      { x: 450, h: 250 }, { x: 550, h: 380 }, { x: 650, h: 300 },
      { x: 750, h: 260 }, { x: 850, h: 340 }, { x: 950, h: 220 }
    ]

    buildings.forEach(b => {
      this.add.rectangle(
        b.x, this.height - b.h / 2,
        60, b.h, 0x111118
      ).setDepth(5)
    })

    this.titleText = this.add.text(this.centerX, 80, "MEDIA CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ffff00",
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
      "The city that never sleeps... neither does the press.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#aaaaaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  showTVInterview() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // TV studio
    this.currentBg.setFillStyle(0x101015)

    // TV frame
    const tvFrame = this.add.rectangle(
      this.centerX, this.centerY,
      600, 350, 0x000000
    ).setStrokeStyle(8, 0x333344).setDepth(20)

    // Interview scene inside TV
    this.add.text(this.centerX, 80, "LIVE - LATE NIGHT TALK", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff0000"
    }).setOrigin(0.5).setDepth(50)

    // Host and Teddy
    this.add.text(this.centerX - 100, this.centerY, "🎙️", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    this.add.text(this.centerX + 100, this.centerY, "🧸", {
      fontSize: "50px"
    }).setOrigin(0.5).setDepth(40)

    // On-screen text
    this.add.text(this.centerX, this.height - 100,
      "\"So tell us about your NEW direction...\"", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Live indicator blinking
    const liveText = this.add.text(this.width - 80, 80, "● LIVE", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff0000"
    }).setOrigin(0.5).setDepth(50)

    this.tweens.add({
      targets: liveText,
      alpha: { from: 0.5, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1
    })
  }

  showControversialMoment() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x100505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // The outburst
    this.add.text(this.centerX, 50, "THE MOMENT", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff4444"
    }).setOrigin(0.5).setDepth(50)

    // Teddy standing up
    this.add.text(this.centerX, this.centerY - 50, "🧸", {
      fontSize: "80px"
    }).setOrigin(0.5).setDepth(40)

    // Speech bubble with controversial statement
    const speechBubble = this.add.container(this.centerX, this.centerY - 150)
    
    const bubble = this.add.rectangle(0, 0, 450, 80, 0xffffff, 0.9)
    const speechText = this.add.text(0, 0, 
      "\"I'M DONE MAKING MUSIC FOR\nBOARDROOM EXECUTIVES!\"", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#000000",
      align: "center"
    }).setOrigin(0.5)

    speechBubble.add([bubble, speechText])
    speechBubble.setDepth(50).setAlpha(0)

    this.tweens.add({
      targets: speechBubble,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 600,
      delay: 500,
      ease: "Back.easeOut"
    })

    // Gasps in background
    this.time.delayedCall(1200, () => {
      if (this.cutsceneSkipped) return
      this.add.text(this.centerX, this.height - 60, "😱 😱 😱", {
        fontSize: "40px"
      }).setOrigin(0.5).setDepth(40)
    })
  }

  showPublicReaction() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Social media explosion
    this.add.text(this.centerX, 50, "THE INTERNET EXPLODES", {
      fontFamily: "RetroPixel",
      fontSize: "26px",
      color: "#00aaff"
    }).setOrigin(0.5).setDepth(50)

    // Tweets/posts scrolling
    const reactions = [
      { text: "Finally someone said it! 🔥", color: "#00ff88" },
      { text: "He's finished...", color: "#ff4444" },
      { text: "TEDDY IS A LEGEND", color: "#ffcc00" },
      { text: "The labels are MAD 😂", color: "#88ff88" },
      { text: "#FreeTeddy trending!", color: "#ff88ff" }
    ]

    reactions.forEach((reaction, i) => {
      const tweet = this.add.text(
        Phaser.Math.Between(100, this.width - 300),
        150 + i * 70,
        reaction.text,
        {
          fontFamily: "RetroPixel",
          fontSize: "16px",
          color: reaction.color,
          backgroundColor: "#111122",
          padding: { x: 10, y: 5 }
        }
      ).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: tweet,
        alpha: 1,
        x: { from: tweet.x + 100, to: tweet.x },
        duration: 400,
        delay: i * 300
      })
    })
  }

  showLabelResponse() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Label's threatening response
    this.add.text(this.centerX, 50, "MEGA RECORDS RESPONDS", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff0000"
    }).setOrigin(0.5).setDepth(50)

    // Official statement
    const statement = this.add.text(this.centerX, this.centerY - 30,
      "\"We are deeply disappointed.\nLegal action is being considered.\"\n\n- Mega Records CEO", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setDepth(50)

    // War declaration
    this.add.text(this.centerX, this.height - 80,
      "The contract trap closes...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff8888"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 1500
    })

    this.add.text(this.centerX, this.height - 50,
      "But first... survive the Contract Trap.", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 2500
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markPostBossWatched(9)

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
