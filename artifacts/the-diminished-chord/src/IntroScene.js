import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * IntroScene - Cinematic intro sequence for The Diminished Chord
 * Features dramatic character reveals, credits, and title flash
 * Can be skipped at any time to jump to main menu
 */
export class IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: "IntroScene" })
  }

  init(data) {
    // Get the scene to return to after intro completes (defaults to TitleScreen)
    this.returnToScene = data?.returnTo || "TitleScreen"
  }

  create() {
    this.centerX = this.cameras.main.width / 2
    this.centerY = this.cameras.main.height / 2

    // Track if intro was skipped
    this.introSkipped = false
    this.introComplete = false

    // Start with completely black screen
    this.blackOverlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000
    ).setOrigin(0, 0).setDepth(100)

    // Play intro music (if assigned)
    BGMManager.playMenuMusic(this, MENU_KEYS.INTRO)

    // Setup skip functionality
    this.setupSkipControls()

    // Show skip hint
    this.createSkipHint()

    // Start the intro sequence
    this.startIntroSequence()
  }

  setupSkipControls() {
    // Skip on any key press
    this.input.keyboard.on("keydown", () => {
      this.skipIntro()
    })

    // Skip on click/tap
    this.input.on("pointerdown", () => {
      this.skipIntro()
    })
  }

  createSkipHint() {
    this.skipHint = this.add.text(
      this.cameras.main.width - 20,
      this.cameras.main.height - 30,
      "Press any key to skip",
      {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#666666"
      }
    ).setOrigin(1, 0.5).setAlpha(0).setDepth(101)

    // Fade in the skip hint after a short delay
    this.time.delayedCall(1500, () => {
      if (!this.introSkipped) {
        this.tweens.add({
          targets: this.skipHint,
          alpha: 0.7,
          duration: 500
        })
      }
    })
  }

  skipIntro() {
    if (this.introSkipped || this.introComplete) return
    this.introSkipped = true

    // Stop all tweens and timers
    this.tweens.killAll()
    this.time.removeAllEvents()

    // Quick fade to black then go to the return scene
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 1,
      duration: 300,
      onComplete: () => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        BGMManager.stop()
        // Go to the scene specified when launching intro (defaults to TitleScreen)
        this.scene.start(this.returnToScene)
      }
    })
  }

  startIntroSequence() {
    // Timeline of intro events
    const timeline = this.add.timeline([
      // 0s - Fade in from black to first shot (sunglasses closeup)
      {
        at: 0,
        run: () => this.showSunglassesShot()
      },
      // 3s - Cut to removing glasses
      {
        at: 3000,
        run: () => this.showRemovingGlassesShot()
      },
      // 5.5s - Cut to credits
      {
        at: 5500,
        run: () => this.showCredits1()
      },
      // 9s - Cut to bandana wrap
      {
        at: 9000,
        run: () => this.showBandanaWrapShot()
      },
      // 12s - Cut to credits 2
      {
        at: 12000,
        run: () => this.showCredits2()
      },
      // 15s - Cut to action pose
      {
        at: 15000,
        run: () => this.showActionPoseShot()
      },
      // 18s - Flash effects building
      {
        at: 18000,
        run: () => this.startTitleBuildUp()
      },
      // 20s - Title flash
      {
        at: 20000,
        run: () => this.showTitleFlash()
      },
      // 23s - Show start button and transition
      {
        at: 23000,
        run: () => this.showStartButton()
      }
    ])

    timeline.play()
  }

  showSunglassesShot() {
    // Fade in from black with sunglasses closeup
    this.currentShot = this.add.image(this.centerX, this.centerY, "intro_teddy_sunglasses")
    this.currentShot.setScale(0.8)
    this.currentShot.setAlpha(0)

    // Fade out black overlay
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1500,
      ease: "Sine.easeOut"
    })

    // Fade in image with slight zoom
    this.tweens.add({
      targets: this.currentShot,
      alpha: 1,
      scale: 0.85,
      duration: 2000,
      ease: "Sine.easeOut"
    })
  }

  showRemovingGlassesShot() {
    this.transitionToShot("intro_teddy_removing_glasses", 0.75)
  }

  showBandanaWrapShot() {
    this.transitionToShot("intro_teddy_bandana_wrap", 0.7)
  }

  showActionPoseShot() {
    this.transitionToShot("intro_teddy_action_pose", 0.65)
  }

  transitionToShot(imageKey, scale) {
    // Play whoosh sound
    this.sound.play("intro_whoosh", { volume: 0.4 })

    // White flash effect
    const flash = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0xffffff
    ).setOrigin(0, 0).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: flash,
      alpha: 0.8,
      duration: 100,
      yoyo: true,
      onComplete: () => flash.destroy()
    })

    // Remove old shot
    if (this.currentShot) {
      this.currentShot.destroy()
    }
    if (this.creditsContainer) {
      this.creditsContainer.destroy()
      this.creditsContainer = null
    }

    // Create new shot
    this.currentShot = this.add.image(this.centerX, this.centerY, imageKey)
    this.currentShot.setScale(scale * 1.1)
    this.currentShot.setAlpha(0)

    // Animate in with Ken Burns effect (slow zoom)
    this.tweens.add({
      targets: this.currentShot,
      alpha: 1,
      scale: scale,
      duration: 500,
      ease: "Power2"
    })

    // Continue slow zoom during display
    this.tweens.add({
      targets: this.currentShot,
      scale: scale * 1.05,
      duration: 3000,
      ease: "Sine.easeInOut"
    })
  }

  showCredits1() {
    this.showCreditsScreen([
      "A",
      "",
      "JS CREATIV",
      "",
      "PRODUCTION"
    ])
  }

  showCredits2() {
    this.showCreditsScreen([
      "IN ACCORDANCE WITH",
      "",
      "RIFFBANK.IO",
      "&",
      "TRASHPANDA RECORDS"
    ])
  }

  showCreditsScreen(lines) {
    // Play whoosh
    this.sound.play("intro_whoosh", { volume: 0.3 })

    // Remove current shot
    if (this.currentShot) {
      this.tweens.add({
        targets: this.currentShot,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          if (this.currentShot) {
            this.currentShot.destroy()
            this.currentShot = null
          }
        }
      })
    }

    // Create credits background
    const creditsBg = this.add.image(this.centerX, this.centerY, "intro_credits_bg")
    const bgScale = Math.max(
      this.cameras.main.width / creditsBg.width,
      this.cameras.main.height / creditsBg.height
    )
    creditsBg.setScale(bgScale)
    creditsBg.setAlpha(0)

    // Create container for credits
    this.creditsContainer = this.add.container(this.centerX, this.centerY)
    this.creditsContainer.add(creditsBg)

    // Add text lines
    const lineHeight = 40
    const startY = -((lines.length - 1) * lineHeight) / 2

    lines.forEach((line, index) => {
      const isMainText = line.length > 0 && !["DEVELOPED BY", "IN ACCORDANCE WITH", "A", "PRODUCTION", "&"].includes(line)
      const text = this.add.text(0, startY + index * lineHeight, line, {
        fontFamily: "RetroPixel",
        fontSize: isMainText ? "32px" : "18px",
        color: isMainText ? "#ff69b4" : "#888888"
      }).setOrigin(0.5)
      this.creditsContainer.add(text)
    })

    this.creditsContainer.setAlpha(0)

    // Fade in
    this.tweens.add({
      targets: [this.creditsContainer, creditsBg],
      alpha: 1,
      duration: 500,
      ease: "Sine.easeOut"
    })
  }

  startTitleBuildUp() {
    // Create flashing/glitching effects
    this.sound.play("intro_whoosh", { volume: 0.5 })

    // Remove any existing elements
    if (this.currentShot) {
      this.currentShot.destroy()
      this.currentShot = null
    }
    if (this.creditsContainer) {
      this.creditsContainer.destroy()
      this.creditsContainer = null
    }

    // Black background
    this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000
    ).setOrigin(0, 0).setDepth(-1)

    // Create flash sequence
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 300, () => {
        if (this.introSkipped) return
        
        const flash = this.add.rectangle(
          0, 0,
          this.cameras.main.width,
          this.cameras.main.height,
          i % 2 === 0 ? 0xff00ff : 0x00ffff
        ).setOrigin(0, 0).setAlpha(0.3).setDepth(10)

        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 200,
          onComplete: () => flash.destroy()
        })
      })
    }
  }

  showTitleFlash() {
    // Big impact sound
    this.sound.play("intro_impact", { volume: 0.6 })

    // White flash
    const bigFlash = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0xffffff
    ).setOrigin(0, 0).setAlpha(1).setDepth(200)

    this.tweens.add({
      targets: bigFlash,
      alpha: 0,
      duration: 500,
      delay: 100,
      onComplete: () => bigFlash.destroy()
    })

    // Show title logo with dramatic entrance
    this.titleLogo = this.add.image(this.centerX, this.centerY - 50, "game_title")
    const targetScale = 500 / this.titleLogo.width
    this.titleLogo.setScale(targetScale * 2)
    this.titleLogo.setAlpha(0)
    this.titleLogo.setDepth(150)

    this.time.delayedCall(150, () => {
      if (this.introSkipped) return
      
      this.tweens.add({
        targets: this.titleLogo,
        alpha: 1,
        scale: targetScale,
        duration: 800,
        ease: "Back.easeOut"
      })
    })

    // Add glowing effect to title
    this.time.delayedCall(1000, () => {
      if (this.introSkipped) return
      
      this.tweens.add({
        targets: this.titleLogo,
        scale: targetScale * 1.02,
        duration: 1500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      })
    })
  }

  showStartButton() {
    if (this.introSkipped) return

    // Add subtitle
    const subtitle = this.add.text(this.centerX, this.centerY + 80, "A Punk Rock Platformer Adventure", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff69b4"
    }).setOrigin(0.5).setAlpha(0).setDepth(150)

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 500
    })

    // Create start button
    const startBtn = this.add.container(this.centerX, this.centerY + 180)
    startBtn.setDepth(150)
    startBtn.setAlpha(0)

    const btnBg = this.add.rectangle(0, 0, 220, 50, 0x1a1a2e, 0.9)
      .setStrokeStyle(3, 0x00ff88)
    const btnText = this.add.text(0, 0, "START", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5)

    startBtn.add([btnBg, btnText])

    // Make interactive
    btnBg.setInteractive({ useHandCursor: true })
    btnBg.on("pointerover", () => {
      btnBg.setStrokeStyle(4, 0xffffff)
      btnText.setColor("#ffffff")
      startBtn.setScale(1.05)
    })
    btnBg.on("pointerout", () => {
      btnBg.setStrokeStyle(3, 0x00ff88)
      btnText.setColor("#00ff88")
      startBtn.setScale(1)
    })
    btnBg.on("pointerdown", () => {
      this.goToTitleScreen()
    })

    // Fade in button
    this.tweens.add({
      targets: startBtn,
      alpha: 1,
      duration: 500,
      delay: 500
    })

    // Pulsing animation
    this.tweens.add({
      targets: startBtn,
      scale: 1.03,
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
      delay: 1000
    })

    // Mark intro as complete (skip hint now acts as instant transition)
    this.introComplete = true

    // Update skip hint
    this.skipHint.setText("Press any key to continue")

    // Any key now goes to title
    this.input.keyboard.removeAllListeners("keydown")
    this.input.keyboard.on("keydown", () => {
      this.goToTitleScreen()
    })
  }

  goToTitleScreen() {
    if (this.transitioning) return
    this.transitioning = true

    this.sound.play("ui_confirm_sound", { volume: 0.3 })

    // Fade to black
    const fadeOut = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000
    ).setOrigin(0, 0).setAlpha(0).setDepth(500)

    this.tweens.add({
      targets: fadeOut,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        BGMManager.stop()
        // Go to the scene specified when launching intro (defaults to TitleScreen)
        this.scene.start(this.returnToScene)
      }
    })
  }
}
