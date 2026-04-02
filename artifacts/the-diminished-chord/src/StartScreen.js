import Phaser from "phaser"
import { musicManager } from "./MusicTrackManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { AuthManager } from "./AuthManager.js"

/**
 * StartScreen - Initial title screen with cinematic reveal
 * Features: Logo fade in from black -> Tagline appears -> Press Start button appears
 * This is the first screen players see on game launch
 * Transitions to TitleScreen (main menu) on interaction
 */
export class StartScreen extends Phaser.Scene {
  constructor() {
    super({ key: "StartScreen" })
  }

  create() {
    const { width, height } = this.cameras.main
    this.centerX = width / 2
    this.centerY = height / 2

    // Reset transitioning flag (important for scene re-entry, e.g., after Replay Intro)
    this.transitioning = false
    this.animationComplete = false
    this.introSkipped = false // Track if intro was skipped/accelerated

    // Start with full black screen for fade-in effect
    this.cameras.main.setBackgroundColor(0x000000)

    // Create background elements (hidden initially)
    this.createBackground()

    // Create all elements initially hidden
    this.createLogoHidden()
    this.createTaglineHidden()
    this.createStartButtonHidden()
    this.createFooterHidden()
    this.createAmbientEffects()
    this.createSkipHint()

    // Setup early skip/accelerate input
    this.setupSkipInput()

    // Start the cinematic reveal sequence
    this.startRevealSequence()
  }

  /**
   * Create skip hint text shown during intro
   */
  createSkipHint() {
    const { width, height } = this.cameras.main
    
    this.skipHint = this.add.text(width - 20, height - 20, "Press any key to skip intro", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#444444"
    }).setOrigin(1, 1).setAlpha(0).setDepth(100)

    // Fade in after a moment
    this.time.delayedCall(1000, () => {
      if (!this.introSkipped && !this.animationComplete) {
        this.tweens.add({
          targets: this.skipHint,
          alpha: 0.6,
          duration: 500
        })
      }
    })
  }

  /**
   * Setup input to skip/accelerate the intro sequence
   * During intro: pressing any key skips to the final state
   * After intro completes: pressing any key goes to main menu
   */
  setupSkipInput() {
    // Any key to skip/accelerate intro
    this.input.keyboard.on("keydown", (event) => {
      // Ignore modifier keys
      if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return
      this.handleSkipInput()
    })

    // Click anywhere to skip/accelerate intro
    this.input.on("pointerdown", () => {
      this.handleSkipInput()
    })

    // Gamepad support
    if (this.input.gamepad) {
      this.input.gamepad.on("down", () => {
        this.handleSkipInput()
      })
    }
  }

  /**
   * Handle skip input - skip to end of intro fade-in
   * NOTE: Once on the title screen with music playing, user MUST press the Start button
   * to proceed - they cannot skip past the title screen itself
   */
  handleSkipInput() {
    if (this.transitioning) return

    // If animation is not yet complete, skip to the end of the fade-in sequence
    // Once animation IS complete, do nothing - user must click the PRESS START button
    if (!this.introSkipped && !this.animationComplete) {
      this.skipToEnd()
    }
    // If animationComplete is true, we intentionally do nothing here
    // The user must click the "PRESS START" button to proceed
  }

  /**
   * Skip to the end of the intro animation
   * Immediately shows all elements in their final state
   */
  skipToEnd() {
    if (this.introSkipped || this.animationComplete) return
    this.introSkipped = true

    // Play a subtle sound
    try {
      this.sound.play("ui_select_sound", { volume: 0.2 })
    } catch (e) {
      // Sound might not be ready yet
    }

    // Kill all running tweens and timers
    this.tweens.killAll()
    this.time.removeAllEvents()

    // Immediately show all elements in final state
    // Background
    if (this.bgImage) this.bgImage.setAlpha(1)
    if (this.bgOverlay) this.bgOverlay.setAlpha(1)
    this.stars.forEach(star => star.setAlpha(star.getData("targetAlpha") || 0.4))

    // Logo
    if (this.titleImage) {
      this.titleImage.setAlpha(1)
      this.titleImage.setScale(this.titleScale)
    }
    if (this.titleGlow) this.titleGlow.setAlpha(0.3)

    // Tagline
    if (this.taglineText) {
      this.taglineText.setAlpha(1)
      this.taglineText.setY(this.taglineY)
    }

    // Start button
    if (this.startBtn) this.startBtn.setAlpha(1)

    // Footer
    if (this.tracksText) this.tracksText.setAlpha(1)
    if (this.versionText) this.versionText.setAlpha(1)
    if (this.creditsText) this.creditsText.setAlpha(1)

    // Hide skip hint
    if (this.skipHint) this.skipHint.setAlpha(0)

    // Start music if not already playing
    if (!this.sound.get("title_music")?.isPlaying) {
      BGMManager.setDevMode(false)
      BGMManager.playMenuMusic(this, MENU_KEYS.TITLE_SCREEN)
    }

    // Launch music control if not active
    if (!this.scene.isActive("MusicControlScene")) {
      this.scene.launch("MusicControlScene")
    }

    // Start the pulsing animations
    this.startButtonPulse()
    this.startGlowPulse()

    // Mark animation as complete and setup full input
    this.animationComplete = true
    this.setupInput()
  }

  startRevealSequence() {
    // Timeline for the cinematic reveal:
    // 0.0s - Start from black
    // 0.5s - Begin fading in background
    // 1.5s - Logo starts fading in
    // 3.0s - Logo fully visible, tagline starts appearing
    // 4.0s - Press Start button fades in
    // 4.5s - Animation complete, enable input

    // Phase 1: Fade in background (after brief delay)
    this.time.delayedCall(500, () => {
      this.tweens.add({
        targets: [this.bgImage, this.bgOverlay],
        alpha: { from: 0, to: 1 },
        duration: 1000,
        ease: "Sine.easeOut",
        onComplete: () => {
          // Start music after background appears
          BGMManager.setDevMode(false)
          BGMManager.playMenuMusic(this, MENU_KEYS.TITLE_SCREEN)
          
          // Launch persistent music control overlay
          if (!this.scene.isActive("MusicControlScene")) {
            this.scene.launch("MusicControlScene")
          }
        }
      })

      // Fade in stars
      this.stars.forEach((star, index) => {
        this.tweens.add({
          targets: star,
          alpha: star.getData("targetAlpha"),
          duration: 1500,
          delay: index * 20,
          ease: "Sine.easeOut"
        })
      })
    })

    // Phase 2: Logo fade in (from black)
    this.time.delayedCall(1500, () => {
      // Fade in the logo with a slight scale-up effect
      this.tweens.add({
        targets: [this.titleImage, this.titleGlow],
        alpha: 1,
        duration: 1500,
        ease: "Sine.easeOut"
      })

      // Scale up slightly during fade
      this.tweens.add({
        targets: this.titleImage,
        scale: { from: this.titleScale * 0.95, to: this.titleScale },
        duration: 1500,
        ease: "Sine.easeOut"
      })
    })

    // Phase 3: Tagline appears
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: this.taglineText,
        alpha: 1,
        y: this.taglineY,
        duration: 800,
        ease: "Back.easeOut"
      })
    })

    // Phase 4: Press Start button fades in
    this.time.delayedCall(4000, () => {
      this.tweens.add({
        targets: this.startBtn,
        alpha: 1,
        duration: 600,
        ease: "Sine.easeOut",
        onComplete: () => {
          // Start the pulsing animation on the button
          this.startButtonPulse()
          this.startGlowPulse()
        }
      })
    })

    // Phase 5: Enable input after animation completes
    this.time.delayedCall(4500, () => {
      this.animationComplete = true
      this.setupInput()
      
      // Fade in footer
      this.tweens.add({
        targets: [this.tracksText, this.versionText, this.creditsText],
        alpha: 1,
        duration: 500
      })
    })
  }

  createBackground() {
    const { width, height } = this.cameras.main

    // Background image (starts hidden)
    this.bgImage = this.add.image(0, 0, "metroid_cavern_background")
    this.bgImage.setOrigin(0, 0)
    this.bgImage.setAlpha(0)
    
    const scaleX = width / this.bgImage.width
    const scaleY = height / this.bgImage.height
    const scale = Math.max(scaleX, scaleY)
    this.bgImage.setScale(scale)

    // Dark overlay for dramatic effect (starts hidden)
    this.bgOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
    this.bgOverlay.setOrigin(0, 0)
    this.bgOverlay.setAlpha(0)

    // Create twinkling stars (hidden initially)
    this.createStarfield()
  }

  createStarfield() {
    const { width, height } = this.cameras.main
    this.stars = []
    
    // Create twinkling stars
    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 2),
        0xffffff,
        0 // Start invisible
      )
      star.setDepth(0)
      
      const targetAlpha = Phaser.Math.FloatBetween(0.2, 0.6)
      star.setData("targetAlpha", targetAlpha)

      // Twinkle animation (will start after reveal)
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.1, 0.4),
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000)
      })

      this.stars.push(star)
    }
  }

  createLogoHidden() {
    const { width, height } = this.cameras.main

    // Main title image - larger and more prominent (starts hidden)
    this.titleImage = this.add.image(this.centerX, height * 0.35, "game_title")
    
    // Scale to prominent size
    const targetWidth = Math.min(700, width * 0.8)
    this.titleScale = targetWidth / this.titleImage.width
    this.titleImage.setScale(this.titleScale)
    this.titleImage.setDepth(10)
    this.titleImage.setAlpha(0) // Hidden initially

    // Subtle glow effect using tint (starts hidden)
    this.titleGlow = this.add.image(this.centerX, height * 0.35, "game_title")
    this.titleGlow.setScale(this.titleScale * 1.02)
    this.titleGlow.setAlpha(0) // Hidden initially
    this.titleGlow.setTint(0xff69b4)
    this.titleGlow.setDepth(9)
  }

  createTaglineHidden() {
    const { height } = this.cameras.main
    
    // Calculate tagline position
    this.taglineY = height * 0.35 + this.titleImage.displayHeight / 2 + 30
    
    // Tagline text (starts hidden and slightly offset)
    this.taglineText = this.add.text(this.centerX, this.taglineY + 20, 
      "A Punk Rock Platformer Adventure", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4"
    }).setOrigin(0.5).setDepth(10).setAlpha(0)
  }

  createStartButtonHidden() {
    const { width, height } = this.cameras.main
    
    // Calculate button position (centered between tagline and footer)
    const taglineY = height * 0.35 + this.titleImage.displayHeight / 2 + 30
    const footerY = height - 60
    const btnY = taglineY + (footerY - taglineY) / 2

    // Create button container (starts hidden)
    this.startBtn = this.add.container(this.centerX, btnY)
    this.startBtn.setDepth(20)
    this.startBtn.setAlpha(0) // Hidden initially

    // Button background with glow
    this.btnGlow = this.add.rectangle(0, 0, 360, 65, 0x00ff88, 0.2)
    this.btnGlow.setStrokeStyle(0)
    
    this.btnBg = this.add.rectangle(0, 0, 340, 55, 0x1a1a2e, 0.95)
    this.btnBg.setStrokeStyle(3, 0x00ff88)

    // Button text
    this.btnText = this.add.text(0, 0, "PRESS START", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ff88"
    }).setOrigin(0.5)

    this.startBtn.add([this.btnGlow, this.btnBg, this.btnText])
  }

  startButtonPulse() {
    // Pulsing animation for the button
    this.tweens.add({
      targets: this.startBtn,
      scale: 1.03,
      duration: 1000,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  startGlowPulse() {
    // Pulsing glow animation for the logo
    this.tweens.add({
      targets: this.titleGlow,
      alpha: { from: 0.2, to: 0.5 },
      scale: { from: this.titleScale * 1.01, to: this.titleScale * 1.04 },
      duration: 2000,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })

    // Glow pulse on button
    this.tweens.add({
      targets: this.btnGlow,
      alpha: { from: 0.2, to: 0.4 },
      scaleX: { from: 1, to: 1.1 },
      scaleY: { from: 1, to: 1.1 },
      duration: 1200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  createFooterHidden() {
    const { width, height } = this.cameras.main

    // Track progress display (210 total = 14 primary levels × 15 worlds)
    const unlockedCount = musicManager.getUnlockedCount()
    const totalTracks = 210
    
    this.tracksText = this.add.text(this.centerX, height - 60, `♪ ${unlockedCount} / ${totalTracks} Tracks Unlocked`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(10).setAlpha(0)

    // Version info
    this.versionText = this.add.text(10, height - 25, "v0.3.0", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#444444"
    }).setDepth(10).setAlpha(0)

    // Credits hint
    this.creditsText = this.add.text(width - 10, height - 25, "© JS Creativ", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#444444"
    }).setOrigin(1, 0).setDepth(10).setAlpha(0)
  }

  createAmbientEffects() {
    const { width, height } = this.cameras.main

    // Floating music notes in background
    const noteKeys = ["music_fragment_note", "music_fragment_bass", "music_fragment_drums", "music_fragment_guitar"]
    
    for (let i = 0; i < 6; i++) {
      const noteKey = noteKeys[i % noteKeys.length]
      const note = this.add.image(
        Phaser.Math.Between(50, width - 50),
        Phaser.Math.Between(100, height - 100),
        noteKey
      )
      note.setScale(0.04)
      note.setAlpha(0.2)
      note.setDepth(1)

      // Float animation
      this.tweens.add({
        targets: note,
        y: note.y - 40,
        duration: Phaser.Math.Between(3000, 5000),
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      })

      // Gentle rotation
      this.tweens.add({
        targets: note,
        angle: { from: -8, to: 8 },
        duration: Phaser.Math.Between(2000, 4000),
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      })
    }
  }

  setupInput() {
    // Make button interactive with hover effects
    this.btnBg.setInteractive({ useHandCursor: true })
    this.btnBg.on("pointerover", () => {
      this.btnBg.setStrokeStyle(4, 0xffffff)
      this.btnText.setColor("#ffffff")
      this.btnGlow.setFillStyle(0x00ff88, 0.3)
      this.startBtn.setScale(1.05)
    })
    this.btnBg.on("pointerout", () => {
      this.btnBg.setStrokeStyle(3, 0x00ff88)
      this.btnText.setColor("#00ff88")
      this.btnGlow.setFillStyle(0x00ff88, 0.2)
      this.startBtn.setScale(1)
    })
    this.btnBg.on("pointerdown", () => {
      this.goToMainMenu()
    })
    
    // Setup keyboard shortcuts specifically for the PRESS START button
    // These only work AFTER animationComplete - pressing Enter/Space is like clicking the button
    this.input.keyboard.on("keydown-ENTER", () => {
      if (this.animationComplete && !this.transitioning) {
        this.goToMainMenu()
      }
    })
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.animationComplete && !this.transitioning) {
        this.goToMainMenu()
      }
    })
    
    // Note: General pointer/keyboard input during fade-in is handled by setupSkipInput()
    // which only skips to the end of the fade-in, NOT past the title screen
  }

  async goToMainMenu() {
    if (this.transitioning || !this.animationComplete) return
    this.transitioning = true

    this.sound.play("ui_confirm_sound", { volume: 0.3 })

    // Wait for auth to be ready before checking login status
    await AuthManager.waitForReady()

    // Quick fade transition
    const fade = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000
    ).setOrigin(0, 0).setAlpha(0).setDepth(100)

    this.tweens.add({
      targets: fade,
      alpha: 1,
      duration: 300,
      onComplete: () => {
        BGMManager.stop()
        // Check if already signed in - go to main menu, otherwise go to sign in
        if (AuthManager.isLoggedIn()) {
          this.scene.start("TitleScreen")
        } else {
          this.scene.start("SignInScene")
        }
      }
    })
  }
}
