import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World1PostBossScene - Post-Boss cutscene for World 1 (Detroit)
 * 
 * Story: After defeating the Collapsing Stage boss, Teddy records his first
 * punk rock music video in a gritty Detroit basement. Think Avril Lavigne's
 * "Sk8er Boi" - raw energy, behind-the-scenes shots mixed with performance.
 */
export class World1PostBossScene extends Phaser.Scene {
  constructor() {
    super({ key: "World1PostBossScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 1, bossJustCompleted: true }
  }

  create() {
    this.centerX = this.cameras.main.width / 2
    this.centerY = this.cameras.main.height / 2
    this.width = this.cameras.main.width
    this.height = this.cameras.main.height

    this.cutsceneSkipped = false
    this.cutsceneComplete = false

    // Black overlay for transitions
    this.blackOverlay = this.add.rectangle(
      0, 0, this.width, this.height, 0x000000
    ).setOrigin(0, 0).setDepth(100)

    // Play cinematic music
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
      this.width - 20,
      this.height - 30,
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

    CutsceneManager.markPostBossWatched(1)

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
      { at: 0, run: () => this.showVictoryMoment() },
      { at: 4000, run: () => this.showRecordingSetup() },
      { at: 8000, run: () => this.showPerformanceShot() },
      { at: 12000, run: () => this.showBehindTheScenes() },
      { at: 16000, run: () => this.showVideoPreview() },
      { at: 20000, run: () => this.showViralMoment() },
      { at: 24000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  // Scene 1: Victory moment - boss defeated
  showVictoryMoment() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Gritty basement background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x1a1a2e)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Stage debris particles
    this.createDebrisParticles()

    // Victory text
    this.titleText = this.add.text(this.centerX, 100, "STAGE CONQUERED!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff4466",
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

    // Subtitle
    this.subtitleText = this.add.text(this.centerX, this.height - 80, 
      "The basement show that started it all...", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#aaaaaa"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })
  }

  createDebrisParticles() {
    for (let i = 0; i < 8; i++) {
      const debris = this.add.rectangle(
        Phaser.Math.Between(100, this.width - 100),
        Phaser.Math.Between(-50, -20),
        Phaser.Math.Between(5, 15),
        Phaser.Math.Between(5, 15),
        0x444466
      ).setDepth(30)

      this.tweens.add({
        targets: debris,
        y: this.height + 50,
        rotation: Phaser.Math.FloatBetween(-3, 3),
        duration: Phaser.Math.Between(2000, 4000),
        delay: i * 200,
        onComplete: () => debris.destroy()
      })
    }
  }

  // Scene 2: Setting up recording equipment
  showRecordingSetup() {
    this.flashTransition()

    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    // Darker basement with equipment
    this.currentBg.setFillStyle(0x151525)

    // Camera icon (text-based for now)
    this.cameraIcon = this.add.text(this.centerX, this.centerY - 50, "🎥", {
      fontSize: "80px"
    }).setOrigin(0.5).setAlpha(0).setDepth(40)

    this.tweens.add({
      targets: this.cameraIcon,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 600,
      ease: "Back.easeOut"
    })

    // Recording text
    this.recordingText = this.add.text(this.centerX, this.centerY + 60,
      "\"Time to make a music video!\"", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#ff69b4",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.recordingText,
      alpha: 1,
      duration: 500,
      delay: 600
    })

    // REC indicator blinking
    this.recIndicator = this.add.text(50, 50, "● REC", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff0000"
    }).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.recIndicator,
      alpha: { from: 0, to: 1 },
      duration: 500,
      repeat: -1,
      yoyo: true
    })
  }

  // Scene 3: Performance shot
  showPerformanceShot() {
    this.flashTransition()

    if (this.cameraIcon) this.cameraIcon.destroy()
    if (this.recordingText) this.recordingText.destroy()
    if (this.recIndicator) this.recIndicator.destroy()

    // Dramatic lighting
    this.currentBg.setFillStyle(0x0d0d1a)

    // Spotlight effect
    const spotlight = this.add.circle(this.centerX, this.centerY, 200, 0x332244, 0.5)
    spotlight.setDepth(0)

    // Guitar icon
    this.guitarIcon = this.add.text(this.centerX, this.centerY - 30, "🎸", {
      fontSize: "100px"
    }).setOrigin(0.5).setDepth(40)

    // Pulse animation
    this.tweens.add({
      targets: this.guitarIcon,
      scale: { from: 1, to: 1.1 },
      duration: 300,
      yoyo: true,
      repeat: 5
    })

    // Lyrics text
    this.lyricsText = this.add.text(this.centerX, this.height - 100,
      "♪ From the basement to the world ♪", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffcc00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.lyricsText,
      alpha: 1,
      y: this.height - 120,
      duration: 800,
      delay: 500
    })
  }

  // Scene 4: Behind the scenes montage
  showBehindTheScenes() {
    this.flashTransition()

    if (this.guitarIcon) this.guitarIcon.destroy()
    if (this.lyricsText) this.lyricsText.destroy()

    // Warmer lighting for BTS
    this.currentBg.setFillStyle(0x1a1510)

    // Montage text
    this.montageText = this.add.text(this.centerX, 80, "BEHIND THE SCENES", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Multiple emoji icons representing BTS moments
    const moments = ["📷", "🎤", "🎬", "☕", "🤘"]
    moments.forEach((emoji, i) => {
      const icon = this.add.text(
        150 + i * 200,
        this.centerY,
        emoji,
        { fontSize: "50px" }
      ).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: icon,
        alpha: 1,
        y: this.centerY - 20,
        duration: 400,
        delay: i * 300,
        ease: "Back.easeOut"
      })
    })
  }

  // Scene 5: Video preview
  showVideoPreview() {
    this.flashTransition()

    // Clear previous content
    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    // Video frame background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Video player frame
    const videoFrame = this.add.rectangle(
      this.centerX, this.centerY, 
      this.width * 0.7, this.height * 0.6, 
      0x222222
    ).setStrokeStyle(3, 0x444444).setDepth(10)

    // Play button
    const playButton = this.add.text(this.centerX, this.centerY, "▶", {
      fontSize: "60px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(20)

    this.tweens.add({
      targets: playButton,
      scale: { from: 1, to: 1.2 },
      duration: 500,
      yoyo: true,
      repeat: -1
    })

    // Video title
    this.add.text(this.centerX, 60, "\"BASEMENT UPRISING\" - Official Music Video", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // View count
    this.add.text(this.centerX, this.height - 60, "Views: 47", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)
  }

  // Scene 6: Going viral
  showViralMoment() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a15)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    // Viral explosion text
    this.viralText = this.add.text(this.centerX, this.centerY - 80, "GOING VIRAL!", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#00ff88",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(50)

    this.tweens.add({
      targets: this.viralText,
      scale: { from: 0.5, to: 1.2 },
      duration: 600,
      ease: "Elastic.easeOut"
    })

    // View count increasing animation
    this.viewCount = this.add.text(this.centerX, this.centerY + 20, "47 views", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    let views = 47
    const countInterval = this.time.addEvent({
      delay: 50,
      callback: () => {
        views = Math.floor(views * 1.3) + Phaser.Math.Between(10, 50)
        if (views > 100000) {
          this.viewCount.setText("100K+ views! 🔥")
          countInterval.remove()
        } else {
          this.viewCount.setText(`${views.toLocaleString()} views`)
        }
      },
      repeat: 30
    })

    // Next destination hint
    this.nextHint = this.add.text(this.centerX, this.height - 60, 
      "Berlin calls... The underground spreads.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.nextHint,
      alpha: 1,
      duration: 500,
      delay: 2000
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markPostBossWatched(1)

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
