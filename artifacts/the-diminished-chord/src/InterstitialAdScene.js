import Phaser from "phaser"
import { AdSkipManager } from "./AdSkipManager.js"

/**
 * InterstitialAdScene - Shows between levels
 * Placeholder for ad integration
 */

export class InterstitialAdScene extends Phaser.Scene {
  constructor() {
    super({ key: "InterstitialAdScene" })
  }

  init(data) {
    this.nextLevelKey = data.nextLevelKey
    this.levelId = data.levelId || null
    this.onComplete = data.onComplete || null
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const centerX = width / 2
    const centerY = height / 2

    this.isSkipping = false

    // Dark overlay (blocks clicks behind)
    this.add.rectangle(0, 0, width, height, 0x000000, 0.95)
      .setOrigin(0, 0)
      .setInteractive()

    const hasCredits = AdSkipManager.hasCredits()
    const creditCount = AdSkipManager.getCredits()

    // Mock ad background
    this.add.rectangle(centerX, centerY - 30, 500, 300, 0x1a1a2e)
      .setStrokeStyle(3, 0x444466)

    this.add.text(centerX, centerY - 160, "ADVERTISEMENT", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5)

    this.add.text(centerX, centerY - 60, "🎸 Support the Developer! 🎸", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    this.add.text(centerX, centerY, 
      "Your ad could be here!\n\nIntegrate your ad provider's SDK\nto display real ads.",
      {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#888888",
        align: "center"
      }
    ).setOrigin(0.5)

    // Countdown
    this.adDuration = 5
    this.remainingTime = this.adDuration

    this.countdownText = this.add.text(centerX, centerY + 100, `Skip in ${this.remainingTime}...`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#aaaaaa"
    }).setOrigin(0.5)

    this.countdownEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateCountdown,
      callbackScope: this,
      repeat: this.adDuration - 1
    })

    // Skip logic
    this.canSkip = hasCredits
    this.useCreditToSkip = hasCredits

    this.skipButton = this.createSkipButton(centerX, centerY + 180, hasCredits)

    this.inputHintText = this.add.text(centerX, centerY + 230, "", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)

    this.updateInputHint()

    if (hasCredits) {
      this.add.text(centerX, centerY + 140, 
        `You have ${creditCount} ad-skip credit${creditCount > 1 ? "s" : ""}!`,
        {
          fontFamily: "RetroPixel",
          fontSize: "14px",
          color: "#00ff88"
        }
      ).setOrigin(0.5)
    }

    this.add.text(centerX, height - 40,
      "Earn ad-skip credits: Complete levels on first try or beat the speedrun time!",
      {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#555555"
      }
    ).setOrigin(0.5)

    this.setupInput()
  }

  updateInputHint() {
    if (this.canSkip) {
      if (this.useCreditToSkip) {
        this.inputHintText.setText("Press ENTER / A button or click to use credit")
      } else {
        this.inputHintText.setText("Press any key / click to continue")
      }
      this.inputHintText.setColor("#00ff88")
    } else {
      this.inputHintText.setText("")
    }
  }

  setupInput() {
    this.input.keyboard.once("keydown", () => {
      if (this.canSkip) {
        this.handleSkipAction()
      }
    })
  }

  handleSkipAction() {
    if (!this.canSkip || this.isSkipping) return

    this.sound.play("ui_confirm_sound", { volume: 0.3 })

    if (this.useCreditToSkip) {
      AdSkipManager.useCredit()
    }

    this.skipAd()
  }

  updateCountdown() {
    this.remainingTime--

    if (this.remainingTime > 0) {
      this.countdownText.setText(`Skip in ${this.remainingTime}...`)
    } else {
      this.countdownText.setText("Ad complete!")
      this.enableFreeSkip()

      // Auto continue after short delay
      this.time.delayedCall(2500, () => {
        if (!this.isSkipping) {
          this.skipAd()
        }
      })
    }
  }

  createSkipButton(x, y, hasCredits) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 200, 45,
      hasCredits ? 0x00ff88 : 0x444444,
      hasCredits ? 0.9 : 0.5
    )

    if (hasCredits) {
      bg.setStrokeStyle(2, 0x44ff88)
      bg.setInteractive({ useHandCursor: true })
    } else {
      bg.setStrokeStyle(2, 0x666666)
    }

    const text = this.add.text(0, 0,
      hasCredits ? "USE CREDIT TO SKIP" : "CONTINUE",
      {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: hasCredits ? "#000000" : "#666666"
      }
    ).setOrigin(0.5)

    container.add([bg, text])

    if (hasCredits) {
      bg.on("pointerdown", () => this.handleSkipAction())
    }

    container.bg = bg
    container.text = text
    container.enabled = hasCredits

    return container
  }

  enableFreeSkip() {
    if (this.skipButton.enabled) return

    const bg = this.skipButton.bg
    const text = this.skipButton.text

    bg.setFillStyle(0x00ffff, 0.9)
    bg.setStrokeStyle(2, 0x44ffff)
    bg.setInteractive({ useHandCursor: true })

    text.setColor("#000000")
    text.setText("CONTINUE")

    bg.on("pointerdown", () => this.handleSkipAction())

    this.skipButton.enabled = true
    this.canSkip = true
    this.useCreditToSkip = false

    this.updateInputHint()
  }

  skipAd() {
    if (this.isSkipping) return
    this.isSkipping = true

    if (this.countdownEvent) {
      this.countdownEvent.destroy()
    }

    this.input.keyboard.removeAllListeners("keydown")

    if (this.onComplete) {
      this.onComplete(true)
    }

    if (!this.nextLevelKey) {
      this.scene.start("TitleScreen")
      return
    }

    const nextKey = this.nextLevelKey
    const levelId = this.levelId

    if (levelId && nextKey === "DynamicLevelScene") {
      this.scene.start(nextKey, { levelId: levelId, freshStart: true })
    } else {
      this.scene.start(nextKey)
    }
  }
}
