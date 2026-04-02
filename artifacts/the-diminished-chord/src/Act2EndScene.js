import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * Act2EndScene - End of Act II Cinematic: "Industry Reckoning"
 * 
 * Story: The culmination of the industry struggle. From Reykjavik isolation
 * to LA compromise, Sydney success, NYC confrontation, and the contract escape.
 * Teddy has broken free from the machine, but at great cost.
 * 
 * This is a longer, more impactful cinematic marking a major story milestone.
 */
export class Act2EndScene extends Phaser.Scene {
  constructor() {
    super({ key: "Act2EndScene" })
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

    CutsceneManager.markWatched("act_2_end")

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
      { at: 5000, run: () => this.showIndustryMontage() },
      { at: 12000, run: () => this.showCompromiseMoments() },
      { at: 18000, run: () => this.showBreakingFree() },
      { at: 24000, run: () => this.showTheCost() },
      { at: 30000, run: () => this.showActThreeTeaser() },
      { at: 36000, run: () => this.endCutscene() }
    ])

    timeline.play()
  }

  showActTitle() {
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 2000
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0508)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.actText = this.add.text(this.centerX, this.centerY - 60, "ACT II", {
      fontFamily: "RetroPixel",
      fontSize: "48px",
      color: "#ffcc00",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.titleText = this.add.text(this.centerX, this.centerY + 20, 
      "THE INDUSTRY", {
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

  showIndustryMontage() {
    this.flashTransition()

    if (this.actText) this.actText.destroy()
    if (this.titleText) this.titleText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()

    this.currentBg.setFillStyle(0x050508)

    this.add.text(this.centerX, 50, "THE MACHINE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(50)

    // Industry locations
    const worlds = [
      { name: "REYKJAVIK", color: "#88ddff", emoji: "❄️", desc: "The approach" },
      { name: "LA", color: "#ff8844", emoji: "🌴", desc: "Compromise" },
      { name: "SYDNEY", color: "#ff88cc", emoji: "🏟️", desc: "Peak success" },
      { name: "NYC", color: "#ffff00", emoji: "🗽", desc: "Confrontation" },
      { name: "ESCAPE", color: "#00ff88", emoji: "🔓", desc: "Freedom" }
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

    // Corporate chain breaking
    this.time.delayedCall(4500, () => {
      if (this.cutsceneSkipped) return
      const chain = this.add.text(this.centerX, this.centerY + 100, "⛓️💥", {
        fontSize: "40px"
      }).setOrigin(0.5).setAlpha(0).setDepth(45)

      this.tweens.add({
        targets: chain,
        alpha: 1,
        scale: { from: 0.5, to: 1.2 },
        duration: 800,
        ease: "Back.easeOut"
      })
    })
  }

  showCompromiseMoments() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x080505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "THE COMPROMISES", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff4444"
    }).setOrigin(0.5).setDepth(50)

    // Split screen: What they wanted vs What you wanted
    const leftSide = this.add.container(this.centerX - 200, this.centerY)
    const rightSide = this.add.container(this.centerX + 200, this.centerY)

    // Left: Industry demands
    const leftTitle = this.add.text(0, -80, "THEY WANTED", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff8888"
    }).setOrigin(0.5)

    const demands = ["Radio edits", "Pop hooks", "Safe image", "Their schedule"]
    demands.forEach((demand, i) => {
      const text = this.add.text(0, -40 + i * 35, `• ${demand}`, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#ff6666"
      }).setOrigin(0.5)
      leftSide.add(text)
    })
    leftSide.add(leftTitle)
    leftSide.setAlpha(0).setDepth(40)

    // Right: Your vision
    const rightTitle = this.add.text(0, -80, "YOU WANTED", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#88ff88"
    }).setOrigin(0.5)

    const vision = ["Authentic sound", "Creative freedom", "Real connection", "Your terms"]
    vision.forEach((item, i) => {
      const text = this.add.text(0, -40 + i * 35, `• ${item}`, {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#66ff66"
      }).setOrigin(0.5)
      rightSide.add(text)
    })
    rightSide.add(rightTitle)
    rightSide.setAlpha(0).setDepth(40)

    this.tweens.add({
      targets: leftSide,
      alpha: 1,
      x: { from: this.centerX - 250, to: this.centerX - 200 },
      duration: 800,
      delay: 500
    })

    this.tweens.add({
      targets: rightSide,
      alpha: 1,
      x: { from: this.centerX + 250, to: this.centerX + 200 },
      duration: 800,
      delay: 1000
    })

    // VS in center
    this.time.delayedCall(1500, () => {
      if (this.cutsceneSkipped) return
      const vs = this.add.text(this.centerX, this.centerY, "VS", {
        fontFamily: "RetroPixel",
        fontSize: "36px",
        color: "#ffffff"
      }).setOrigin(0.5).setAlpha(0).setDepth(45)

      this.tweens.add({
        targets: vs,
        alpha: 1,
        scale: { from: 0.5, to: 1 },
        duration: 500
      })
    })
  }

  showBreakingFree() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x030308)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "BREAKING FREE", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#00ff88"
    }).setOrigin(0.5).setDepth(50)

    // Contract tearing animation
    const contractLeft = this.add.rectangle(
      this.centerX - 50, this.centerY,
      100, 150, 0xeeeeee
    ).setDepth(40)

    const contractRight = this.add.rectangle(
      this.centerX + 50, this.centerY,
      100, 150, 0xeeeeee
    ).setDepth(40)

    // Tear apart
    this.tweens.add({
      targets: contractLeft,
      x: -200,
      rotation: -0.5,
      alpha: 0,
      duration: 2000,
      delay: 1000,
      ease: "Power2"
    })

    this.tweens.add({
      targets: contractRight,
      x: this.width + 200,
      rotation: 0.5,
      alpha: 0,
      duration: 2000,
      delay: 1000,
      ease: "Power2"
    })

    // Teddy free
    this.time.delayedCall(2000, () => {
      if (this.cutsceneSkipped) return
      const teddy = this.add.text(this.centerX, this.centerY, "🧸🎉", {
        fontSize: "80px"
      }).setOrigin(0.5).setAlpha(0).setDepth(45)

      this.tweens.add({
        targets: teddy,
        alpha: 1,
        scale: { from: 0.5, to: 1 },
        duration: 800,
        ease: "Back.easeOut"
      })
    })

    this.add.text(this.centerX, this.height - 50,
      "\"I'M FREE!\"", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 3000
    })
  }

  showTheCost() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x050505)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, 60, "BUT AT WHAT COST?", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff4444"
    }).setOrigin(0.5).setDepth(50)

    // What was lost
    const losses = [
      "No more label support",
      "No marketing budget",
      "No industry connections",
      "Starting from zero..."
    ]

    losses.forEach((loss, i) => {
      const lossText = this.add.text(
        this.centerX,
        150 + i * 50,
        `❌ ${loss}`,
        {
          fontFamily: "RetroPixel",
          fontSize: "18px",
          color: "#ff6666"
        }
      ).setOrigin(0.5).setAlpha(0).setDepth(50)

      this.tweens.add({
        targets: lossText,
        alpha: 1,
        duration: 400,
        delay: i * 600
      })
    })

    // But...
    this.add.text(this.centerX, this.height - 80,
      "But you still have your music.", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#88ff88"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 3000
    })

    this.add.text(this.centerX, this.height - 50,
      "And your soul.", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1,
      duration: 500,
      delay: 4000
    })
  }

  showActThreeTeaser() {
    this.flashTransition()

    this.children.each(child => {
      if (child !== this.blackOverlay && child !== this.skipHint) {
        child.destroy()
      }
    })

    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x000000)
    this.currentBg.setOrigin(0, 0).setDepth(-1)

    this.add.text(this.centerX, this.centerY - 60, "COMING NEXT", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#666666"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY, "ACT III", {
      fontFamily: "RetroPixel",
      fontSize: "40px",
      color: "#8844aa"
    }).setOrigin(0.5).setDepth(50)

    this.add.text(this.centerX, this.centerY + 50, "THE INTERNAL BATTLE", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5).setDepth(50)

    // Psychological symbols
    this.add.text(this.centerX, this.height - 80,
      "🧠 💭 😰 🪞", {
      fontSize: "30px"
    }).setOrigin(0.5).setAlpha(0.5).setDepth(40)

    this.add.text(this.centerX, this.height - 40,
      "The hardest battle is the one within...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#8844aa"
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

    CutsceneManager.markWatched("act_2_end")

    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 1,
      duration: 1500,
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
