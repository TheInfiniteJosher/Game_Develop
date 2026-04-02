import Phaser from "phaser"

/**
 * PreTitleScreen - Simple black screen requiring user input
 * This scene ensures browser autoplay policies are satisfied
 * before any music plays in the game.
 * 
 * Shows "...click anywhere to begin" and waits for user interaction
 * On input, proceeds to StartScreen (intro sequence) which can also be sped up
 */
export class PreTitleScreen extends Phaser.Scene {
  constructor() {
    super({ key: "PreTitleScreen" })
  }

  create() {
    const { width, height } = this.cameras.main
    const centerX = width / 2
    const centerY = height / 2

    // Pure black background
    this.cameras.main.setBackgroundColor(0x000000)

    // "...click anywhere to begin" text with subtle animation
    this.promptText = this.add.text(centerX, centerY, "...click anywhere to begin", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#666666"
    }).setOrigin(0.5).setAlpha(0)

    // Fade in the text after a brief moment
    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: this.promptText,
        alpha: 1,
        duration: 800,
        ease: "Sine.easeOut",
        onComplete: () => {
          // Start subtle pulsing animation
          this.startPulseAnimation()
          // Enable input after text is visible
          this.setupInput()
        }
      })
    })
  }

  startPulseAnimation() {
    // Subtle breathing/pulse effect on the text
    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 1, to: 0.5 },
      duration: 1500,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  setupInput() {
    // Click anywhere to proceed to StartScreen (intro sequence)
    this.input.on("pointerdown", () => {
      this.proceedToStartScreen()
    })

    // Any key to proceed to StartScreen (intro sequence)
    this.input.keyboard.on("keydown", (event) => {
      // Ignore modifier keys
      if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return
      this.proceedToStartScreen()
    })
    
    // Gamepad support - any button press proceeds to start screen
    if (this.input.gamepad) {
      this.input.gamepad.on("down", () => {
        this.proceedToStartScreen()
      })
    }
  }

  /**
   * Proceed to StartScreen (intro sequence)
   * StartScreen has its own skip functionality to speed up the intro
   */
  proceedToStartScreen() {
    // Prevent multiple triggers
    if (this.transitioning) return
    this.transitioning = true

    // Quick fade out
    this.tweens.add({
      targets: this.promptText,
      alpha: 0,
      duration: 200,
      ease: "Sine.easeIn",
      onComplete: () => {
        // Go to the actual start screen where music will play
        this.scene.start("StartScreen")
      }
    })
  }
}
