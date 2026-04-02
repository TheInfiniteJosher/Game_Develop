import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World1IntroScene - Animated intro cutscene for World 1 (Detroit)
 * 
 * Story: Teddy arrives via spaceship at Detroit airport, is greeted by bandmates
 * with "MIDWEST IS BEST TOUR" banner, grabs his guitar from baggage claim,
 * and hops on a tour bus driving into Detroit city.
 */
export class World1IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: "World1IntroScene" })
  }

  init(data) {
    // Where to go after cutscene ends
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 1 }
  }

  create() {
    this.centerX = this.cameras.main.width / 2
    this.centerY = this.cameras.main.height / 2
    this.width = this.cameras.main.width
    this.height = this.cameras.main.height

    // Track if cutscene was skipped
    this.cutsceneSkipped = false
    this.cutsceneComplete = false

    // Start with completely black screen
    this.blackOverlay = this.add.rectangle(
      0, 0, this.width, this.height, 0x000000
    ).setOrigin(0, 0).setDepth(100)

    // Play intro music
    BGMManager.playMenuMusic(this, MENU_KEYS.INTRO)

    // Setup skip functionality
    this.setupSkipControls()

    // Show skip hint
    this.createSkipHint()

    // Start the cutscene sequence
    this.startCutsceneSequence()
  }

  setupSkipControls() {
    // Skip on any key press
    this.input.keyboard.on("keydown", () => {
      this.skipCutscene()
    })

    // Skip on click/tap
    this.input.on("pointerdown", () => {
      this.skipCutscene()
    })
  }

  createSkipHint() {
    this.skipHint = this.add.text(
      this.width - 20,
      this.height - 30,
      "Press any key to skip",
      {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#666666"
      }
    ).setOrigin(1, 0.5).setAlpha(0).setDepth(101)

    // Fade in the skip hint after a short delay
    this.time.delayedCall(1500, () => {
      if (!this.cutsceneSkipped) {
        this.tweens.add({
          targets: this.skipHint,
          alpha: 0.7,
          duration: 500
        })
      }
    })
  }

  skipCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneSkipped = true

    // Stop all tweens and timers
    this.tweens.killAll()
    this.time.removeAllEvents()

    // Mark as watched
    CutsceneManager.markWorldIntroWatched(1)

    // Quick fade to black then go to destination
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
    // Timeline of cutscene events
    const timeline = this.add.timeline([
      // 0s - Scene 1: Spaceship landing at airport
      {
        at: 0,
        run: () => this.showSpaceshipLanding()
      },
      // 4s - Scene 2: Airport exterior establishing shot
      {
        at: 4000,
        run: () => this.showAirportExterior()
      },
      // 8s - Scene 3: Bandmates waiting with banner
      {
        at: 8000,
        run: () => this.showBandmatesWelcome()
      },
      // 12s - Scene 4: Teddy grabbing guitar from baggage claim
      {
        at: 12000,
        run: () => this.showGrabbingGuitar()
      },
      // 16s - Scene 5: Tour bus reveal
      {
        at: 16000,
        run: () => this.showTourBus()
      },
      // 20s - Scene 6: Tour bus driving into Detroit skyline
      {
        at: 20000,
        run: () => this.showDrivingIntoCity()
      },
      // 25s - End cutscene
      {
        at: 25000,
        run: () => this.endCutscene()
      }
    ])

    timeline.play()
  }

  // Scene 1: Spaceship descending through clouds
  showSpaceshipLanding() {
    // Fade out black
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Sky background (using airport exterior as base with tint)
    this.currentBg = this.add.image(this.centerX, this.centerY, "detroit_airport_exterior")
    this.currentBg.setScale(Math.max(this.width / 1536, this.height / 1024))
    this.currentBg.setAlpha(0)
    this.currentBg.setTint(0x8899bb) // Blue sky tint
    
    this.tweens.add({
      targets: this.currentBg,
      alpha: 0.6,
      duration: 1000
    })

    // Spaceship descending
    this.spaceship = this.add.image(this.centerX + 200, -100, "teddy_spaceship_landing")
    this.spaceship.setScale(0.4)
    this.spaceship.setAngle(-15)

    // Play whoosh sound
    this.time.delayedCall(500, () => {
      if (!this.cutsceneSkipped) {
        this.sound.play("intro_whoosh", { volume: 0.4 })
      }
    })

    // Animate spaceship landing
    this.tweens.add({
      targets: this.spaceship,
      y: this.height + 100,
      x: this.centerX - 100,
      duration: 3500,
      ease: "Power1"
    })

    // Title text
    this.locationText = this.add.text(this.centerX, 100, "DETROIT, MICHIGAN", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.locationText,
      alpha: 1,
      duration: 1000,
      delay: 1500
    })
  }

  // Scene 2: Airport exterior establishing shot
  showAirportExterior() {
    this.sound.play("intro_whoosh", { volume: 0.3 })

    // Flash transition
    this.flashTransition()

    // Clear previous elements
    if (this.spaceship) this.spaceship.destroy()
    if (this.locationText) {
      this.tweens.add({
        targets: this.locationText,
        alpha: 0,
        duration: 300
      })
    }

    // Show full airport exterior
    if (this.currentBg) {
      this.currentBg.clearTint()
      this.tweens.add({
        targets: this.currentBg,
        alpha: 1,
        duration: 500
      })
    }

    // Subtitle
    this.subtitleText = this.add.text(this.centerX, this.height - 80, "Detroit Metro Airport", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#cccccc"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 500
    })

    // Ken Burns slow zoom
    this.tweens.add({
      targets: this.currentBg,
      scale: this.currentBg.scale * 1.05,
      duration: 4000,
      ease: "Sine.easeInOut"
    })
  }

  // Scene 3: Bandmates with banner
  showBandmatesWelcome() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    // Clear previous
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // Dark interior background (use credits bg as interior)
    this.currentBg = this.add.image(this.centerX, this.centerY, "intro_credits_bg")
    this.currentBg.setScale(Math.max(this.width / 1536, this.height / 1024))
    this.currentBg.setTint(0x445566)
    this.currentBg.setDepth(-1)

    // Bandmates with banner
    this.bandmates = this.add.image(this.centerX, this.centerY + 50, "teddy_bandmates_welcome")
    const bandmatesScale = 0.5
    this.bandmates.setScale(bandmatesScale * 1.2)
    this.bandmates.setAlpha(0)

    this.tweens.add({
      targets: this.bandmates,
      alpha: 1,
      scale: bandmatesScale,
      duration: 800,
      ease: "Back.easeOut"
    })

    // Excitement particles
    this.time.delayedCall(600, () => {
      if (this.cutsceneSkipped) return
      this.createExcitementParticles()
    })

    // Dialog text
    this.dialogText = this.add.text(this.centerX, this.height - 60, '"Welcome to Motor City, Teddy!"', {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 800
    })
  }

  createExcitementParticles() {
    // Create simple star particles around bandmates
    for (let i = 0; i < 6; i++) {
      const star = this.add.text(
        this.centerX + Phaser.Math.Between(-200, 200),
        this.centerY + Phaser.Math.Between(-100, 100),
        "✦",
        { fontSize: "24px", color: "#ffff00" }
      ).setOrigin(0.5).setAlpha(0).setDepth(40)

      this.tweens.add({
        targets: star,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.5, to: 1.2 },
        y: star.y - 30,
        duration: 600,
        delay: i * 100,
        yoyo: true,
        onComplete: () => star.destroy()
      })
    }
  }

  // Scene 4: Teddy grabbing guitar from baggage claim
  showGrabbingGuitar() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    // Clear previous
    if (this.bandmates) this.bandmates.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // Interior background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x222233)
    this.currentBg.setOrigin(0, 0)
    this.currentBg.setDepth(-1)

    // Baggage claim conveyor (simple graphic)
    const conveyor = this.add.rectangle(this.centerX, this.height - 100, this.width * 0.8, 40, 0x444455)
    conveyor.setStrokeStyle(3, 0x666677)

    // Teddy grabbing guitar image
    this.teddyGuitar = this.add.image(this.centerX, this.centerY + 30, "teddy_grabbing_guitar")
    const guitarScale = 0.6
    this.teddyGuitar.setScale(guitarScale)
    this.teddyGuitar.setAlpha(0)

    this.tweens.add({
      targets: this.teddyGuitar,
      alpha: 1,
      duration: 500
    })

    // Bounce animation for excitement
    this.tweens.add({
      targets: this.teddyGuitar,
      y: this.teddyGuitar.y - 10,
      duration: 300,
      delay: 800,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut"
    })

    // Dialog
    this.dialogText = this.add.text(this.centerX, 80, '"My baby! Time to make some noise!"', {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff69b4",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 500
    })
  }

  // Scene 5: Tour bus reveal
  showTourBus() {
    this.sound.play("intro_impact", { volume: 0.4 })
    this.flashTransition()

    // Clear previous
    if (this.teddyGuitar) this.teddyGuitar.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // Outdoor parking lot background
    this.currentBg = this.add.image(this.centerX, this.centerY, "detroit_airport_exterior")
    this.currentBg.setScale(Math.max(this.width / 1536, this.height / 1024))
    this.currentBg.setTint(0x99aacc) // Evening tint
    this.currentBg.setDepth(-1)

    // Tour bus entering from right
    this.tourBus = this.add.image(this.width + 300, this.centerY + 80, "tour_bus_pixel")
    const busScale = 0.45
    this.tourBus.setScale(busScale)

    // Bus drives in
    this.tweens.add({
      targets: this.tourBus,
      x: this.centerX,
      duration: 1500,
      ease: "Power2"
    })

    // Big reveal text
    this.revealText = this.add.text(this.centerX, 100, "THE MIDWEST IS BEST TOUR", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff69b4",
      stroke: "#000000",
      strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setScale(0.8).setDepth(50)

    this.tweens.add({
      targets: this.revealText,
      alpha: 1,
      scale: 1,
      duration: 800,
      delay: 1000,
      ease: "Back.easeOut"
    })

    // Year text
    this.yearText = this.add.text(this.centerX, 145, "2024", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffaa00"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.yearText,
      alpha: 1,
      duration: 500,
      delay: 1500
    })
  }

  // Scene 6: Tour bus driving into Detroit skyline
  showDrivingIntoCity() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()

    // Clear previous
    if (this.revealText) this.revealText.destroy()
    if (this.yearText) this.yearText.destroy()
    if (this.tourBus) this.tourBus.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // Detroit skyline at night
    this.currentBg = this.add.image(this.centerX, this.centerY, "detroit_skyline_night")
    this.currentBg.setScale(Math.max(this.width / 1536, this.height / 1024))
    this.currentBg.setDepth(-1)
    this.currentBg.setAlpha(0)

    this.tweens.add({
      targets: this.currentBg,
      alpha: 1,
      duration: 800
    })

    // Tour bus driving across (small in distance)
    this.tourBus = this.add.image(-200, this.height - 150, "tour_bus_pixel")
    this.tourBus.setScale(0.25)

    this.tweens.add({
      targets: this.tourBus,
      x: this.width + 200,
      duration: 4500,
      ease: "Linear"
    })

    // Ending text
    this.endingText = this.add.text(this.centerX, this.centerY - 100, "LET THE TOUR BEGIN...", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.endingText,
      alpha: 1,
      duration: 1000,
      delay: 1500
    })

    // Slow zoom on skyline
    this.tweens.add({
      targets: this.currentBg,
      scale: this.currentBg.scale * 1.1,
      duration: 5000,
      ease: "Sine.easeInOut"
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    // Mark cutscene as watched
    CutsceneManager.markWorldIntroWatched(1)

    // Fade to black
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
    flash.setOrigin(0, 0)
    flash.setAlpha(0)
    flash.setDepth(99)

    this.tweens.add({
      targets: flash,
      alpha: 0.6,
      duration: 80,
      yoyo: true,
      onComplete: () => flash.destroy()
    })
  }
}
