import Phaser from "phaser"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneManager } from "./CutsceneManager.js"

/**
 * World2IntroScene - Animated intro cutscene for World 2 (Berlin)
 * 
 * Story: After Detroit victory, the band heads to Berlin's underground techno scene.
 * The city is under the grip of AI-controlled rave culture, with hypnotized crowds
 * dancing to algorithmic beats in industrial warehouses.
 */
export class World2IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: "World2IntroScene" })
  }

  init(data) {
    this.returnScene = data.returnScene || "WorldLevelSelectScene"
    this.returnData = data.returnData || { worldNum: 2 }
  }

  create() {
    this.centerX = this.cameras.main.width / 2
    this.centerY = this.cameras.main.height / 2
    this.width = this.cameras.main.width
    this.height = this.cameras.main.height

    this.cutsceneSkipped = false
    this.cutsceneComplete = false

    // Start with black screen
    this.blackOverlay = this.add.rectangle(
      0, 0, this.width, this.height, 0x000000
    ).setOrigin(0, 0).setDepth(100)

    // Play intro music
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
      {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#666666"
      }
    ).setOrigin(1, 0.5).setAlpha(0).setDepth(101)

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

    this.tweens.killAll()
    this.time.removeAllEvents()

    CutsceneManager.markWorldIntroWatched(2)

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
      // 0s - Scene 1: Tour bus arriving in Berlin
      {
        at: 0,
        run: () => this.showBerlinArrival()
      },
      // 4s - Scene 2: Berlin underground techno scene
      {
        at: 4000,
        run: () => this.showBerlinRave()
      },
      // 9s - Scene 3: Hypnotized crowd close-up
      {
        at: 9000,
        run: () => this.showHypnotizedCrowds()
      },
      // 14s - Scene 4: AI DJ reveal
      {
        at: 14000,
        run: () => this.showAIDJBooth()
      },
      // 19s - Scene 5: Teddy preparing for battle
      {
        at: 19000,
        run: () => this.showTeddyPreparing()
      },
      // 24s - End cutscene
      {
        at: 24000,
        run: () => this.endCutscene()
      }
    ])

    timeline.play()
  }

  // Scene 1: Tour bus arriving in Berlin
  showBerlinArrival() {
    // Fade out black
    this.tweens.add({
      targets: this.blackOverlay,
      alpha: 0,
      duration: 1000
    })

    // Berlin background
    this.currentBg = this.add.image(this.centerX, this.centerY, "world2_berlin_background")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setAlpha(0)

    this.tweens.add({
      targets: this.currentBg,
      alpha: 1,
      duration: 1000
    })

    // Tour bus driving in
    this.tourBus = this.add.image(-300, this.height - 150, "tour_bus_pixel")
    this.tourBus.setScale(0.35)

    this.tweens.add({
      targets: this.tourBus,
      x: this.centerX - 100,
      duration: 2500,
      ease: "Power2"
    })

    // Location text
    this.locationText = this.add.text(this.centerX, 80, "BERLIN, GERMANY", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff00ff",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.locationText,
      alpha: 1,
      duration: 1000,
      delay: 1500
    })

    // Subtitle
    this.subtitleText = this.add.text(this.centerX, 115, "The Underground Techno Capital", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff"
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      duration: 500,
      delay: 2000
    })
  }

  // Scene 2: Berlin underground rave
  showBerlinRave() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    // Clear previous
    if (this.tourBus) this.tourBus.destroy()
    if (this.locationText) this.locationText.destroy()
    if (this.subtitleText) this.subtitleText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // Berlin rave scene
    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_berlin_rave")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setAlpha(0)

    this.tweens.add({
      targets: this.currentBg,
      alpha: 1,
      duration: 500
    })

    // Strobe light effect
    this.createStrobeEffect()

    // Dialog
    this.dialogText = this.add.text(this.centerX, this.height - 80, '"The Algorithm has taken hold of the clubs..."', {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 1000
    })

    // Ken Burns effect
    this.tweens.add({
      targets: this.currentBg,
      scale: this.currentBg.scale * 1.08,
      duration: 5000,
      ease: "Sine.easeInOut"
    })
  }

  createStrobeEffect() {
    // Subtle strobe pulse
    const strobe = this.add.rectangle(0, 0, this.width, this.height, 0xff00ff)
      .setOrigin(0, 0).setAlpha(0).setDepth(40)

    this.tweens.add({
      targets: strobe,
      alpha: 0.15,
      duration: 150,
      yoyo: true,
      repeat: 8,
      onComplete: () => strobe.destroy()
    })
  }

  // Scene 3: Hypnotized crowds
  showHypnotizedCrowds() {
    this.sound.play("intro_whoosh", { volume: 0.3 })
    this.flashTransition()

    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // Festival/crowd scene
    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_festival_crowds")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setDepth(-1)

    // Spiral eyes effect overlay (simple text-based)
    this.eyesText = this.add.text(this.centerX, this.centerY - 50, "👁️ 👁️ 👁️", {
      fontSize: "48px"
    }).setOrigin(0.5).setAlpha(0).setDepth(30)

    this.tweens.add({
      targets: this.eyesText,
      alpha: 0.7,
      scale: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: 1
    })

    // Dialog
    this.dialogText = this.add.text(this.centerX, this.height - 60, '"Thousands dancing... but no one is really here."', {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4",
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

  // Scene 4: AI DJ booth reveal
  showAIDJBooth() {
    this.sound.play("intro_impact", { volume: 0.4 })
    this.flashTransition()

    if (this.dialogText) this.dialogText.destroy()
    if (this.eyesText) this.eyesText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // DJ console scene
    this.currentBg = this.add.image(this.centerX, this.centerY, "cutscene_berlin_dj_console")
    this.currentBg.setScale(Math.max(this.width / this.currentBg.width, this.height / this.currentBg.height))
    this.currentBg.setDepth(-1)
    this.currentBg.setAlpha(0)

    this.tweens.add({
      targets: this.currentBg,
      alpha: 1,
      duration: 500
    })

    // Boss hint text
    this.bossText = this.add.text(this.centerX, 100, "THE TECHNO TITAN", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff00ff",
      stroke: "#000000",
      strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setScale(0.8).setDepth(50)

    this.tweens.add({
      targets: this.bossText,
      alpha: 1,
      scale: 1,
      duration: 800,
      ease: "Back.easeOut"
    })

    // Subtitle
    this.dialogText = this.add.text(this.centerX, this.height - 60, '"Time to shut down this machine."', {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#00ffff",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(50)

    this.tweens.add({
      targets: this.dialogText,
      alpha: 1,
      duration: 500,
      delay: 1200
    })
  }

  // Scene 5: Teddy preparing
  showTeddyPreparing() {
    this.sound.play("intro_whoosh", { volume: 0.4 })
    this.flashTransition()

    if (this.bossText) this.bossText.destroy()
    if (this.dialogText) this.dialogText.destroy()
    if (this.currentBg) this.currentBg.destroy()

    // Dark background
    this.currentBg = this.add.rectangle(0, 0, this.width, this.height, 0x111122)
      .setOrigin(0, 0).setDepth(-1)

    // Teddy action pose
    this.teddy = this.add.image(this.centerX, this.centerY + 50, "intro_teddy_action_pose")
    this.teddy.setScale(0.5)
    this.teddy.setAlpha(0)

    this.tweens.add({
      targets: this.teddy,
      alpha: 1,
      scale: 0.55,
      duration: 800,
      ease: "Back.easeOut"
    })

    // Ending text
    this.endingText = this.add.text(this.centerX, 100, "LET'S BREAK THE BEAT", {
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
      delay: 500
    })
  }

  endCutscene() {
    if (this.cutsceneSkipped || this.cutsceneComplete) return
    this.cutsceneComplete = true

    CutsceneManager.markWorldIntroWatched(2)

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
      .setOrigin(0, 0).setAlpha(0).setDepth(99)

    this.tweens.add({
      targets: flash,
      alpha: 0.6,
      duration: 80,
      yoyo: true,
      onComplete: () => flash.destroy()
    })
  }
}
