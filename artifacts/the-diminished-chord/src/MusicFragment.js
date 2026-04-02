import Phaser from "phaser"
import { REQUIRED_INSTRUMENTS, NOTE_COLLECTIBLE, BONUS_COLLECTIBLES, DEMO_FRAGMENT, SPEED_RUN_STOPWATCH } from "./CollectibleTypes.js"

/**
 * MusicFragment - Collectible music piece that forms part of a complete track
 * 
 * Types:
 * - Instruments (required, 1 each): drums, guitar, bass, keyboard, microphone
 * - Notes (variable, 0-45): note
 * - Bonus collectibles: mixtape, cd, vinyl, waveform, recordDeal
 * - Special: demoFragment
 */
export class MusicFragment extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, fragmentType = "note", fragmentId = 0) {
    const textureKey = MusicFragment.getTextureKey(fragmentType)
    super(scene, x, y, textureKey)

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.fragmentType = fragmentType
    this.fragmentId = fragmentId
    this.isCollected = false
    this.category = MusicFragment.getCategory(fragmentType)

    // Set up physics - no gravity, static collectible
    this.body.setAllowGravity(false)
    this.body.setImmovable(true)

    // Scale based on fragment type - instruments larger than notes
    const targetHeight = this.category === 'instrument' ? 48 : 
                         this.category === 'bonus' ? 52 : 
                         this.category === 'special' ? 56 : 40
    const actualHeight = this.height || 40
    const scale = targetHeight / actualHeight
    this.setScale(scale)

    // Adjust body size after scaling
    this.body.setSize(this.width * 0.8, this.height * 0.8)
    this.body.setOffset(this.width * 0.1, this.height * 0.1)

    // Set origin to center for floating animation
    this.setOrigin(0.5, 0.5)

    // Apply tint based on type (fallback if texture not found)
    this.setTint(this.getFragmentColor())

    // Start floating animation
    this.startFloatingAnimation()

    // Glow effect
    this.createGlowEffect()
  }

  /**
   * Get the texture key for a fragment type
   */
  static getTextureKey(fragmentType) {
    // Required instruments
    if (REQUIRED_INSTRUMENTS[fragmentType]) {
      return REQUIRED_INSTRUMENTS[fragmentType].textureKey
    }
    
    // Notes
    if (fragmentType === 'note') {
      return NOTE_COLLECTIBLE.textureKey
    }
    
    // Bonus collectibles
    if (BONUS_COLLECTIBLES[fragmentType]) {
      return BONUS_COLLECTIBLES[fragmentType].textureKey
    }
    
    // Demo fragment
    if (fragmentType === 'demoFragment') {
      return DEMO_FRAGMENT.textureKey
    }
    
    // Fallback to generic music fragment
    return `music_fragment_${fragmentType}`
  }

  /**
   * Get category for a fragment type
   */
  static getCategory(fragmentType) {
    if (REQUIRED_INSTRUMENTS[fragmentType]) return 'instrument'
    if (fragmentType === 'note') return 'note'
    if (BONUS_COLLECTIBLES[fragmentType]) return 'bonus'
    if (fragmentType === 'demoFragment') return 'special'
    return 'unknown'
  }

  startFloatingAnimation() {
    // Special animation for demo fragments
    if (this.category === 'special') {
      // More dramatic floating for demo fragments
      this.scene.tweens.add({
        targets: this,
        y: this.y - 12,
        duration: 1500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      })
      
      // Rotation
      this.scene.tweens.add({
        targets: this,
        angle: { from: -10, to: 10 },
        duration: 1000,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      })
      return
    }
    
    // Standard floating
    this.scene.tweens.add({
      targets: this,
      y: this.y - 8,
      duration: 1000,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })

    // Gentle rotation wobble
    this.scene.tweens.add({
      targets: this,
      angle: { from: -5, to: 5 },
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  createGlowEffect() {
    // Stronger glow for special items
    const alphaMin = this.category === 'special' ? 0.6 : 
                     this.category === 'bonus' ? 0.7 : 0.8
    
    this.scene.tweens.add({
      targets: this,
      alpha: { from: alphaMin, to: 1 },
      duration: this.category === 'special' ? 300 : 500,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  collect() {
    if (this.isCollected) return

    this.isCollected = true

    // Different sounds for different categories
    let soundKey = "collect_fragment_sound"
    let volume = 0.3
    
    if (this.category === 'instrument') {
      soundKey = "collect_fragment_sound"
      volume = 0.4
    } else if (this.category === 'bonus') {
      soundKey = "collect_fragment_sound" // Could use special sound
      volume = 0.5
    } else if (this.category === 'special') {
      soundKey = "collect_fragment_sound" // Could use rare collect sound
      volume = 0.6
    }
    
    this.scene.sound.play(soundKey, { volume })

    // Collection animation - scale up and fade out
    // Special items have more dramatic animation
    const scaleMult = this.category === 'special' ? 2.0 : 
                      this.category === 'bonus' ? 1.7 : 1.5
    const duration = this.category === 'special' ? 500 : 300
    
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * scaleMult,
      scaleY: this.scaleY * scaleMult,
      alpha: 0,
      duration: duration,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.destroy()
      }
    })

    // Emit collection event with detailed info
    this.scene.events.emit("fragmentCollected", {
      type: this.fragmentType,
      id: this.fragmentId,
      category: this.category
    })
  }

  // Get color based on fragment type
  getFragmentColor() {
    // Required instruments
    if (REQUIRED_INSTRUMENTS[this.fragmentType]) {
      return REQUIRED_INSTRUMENTS[this.fragmentType].color
    }
    
    // Notes
    if (this.fragmentType === 'note') {
      return NOTE_COLLECTIBLE.color
    }
    
    // Bonus collectibles
    if (BONUS_COLLECTIBLES[this.fragmentType]) {
      return BONUS_COLLECTIBLES[this.fragmentType].color
    }
    
    // Demo fragment
    if (this.fragmentType === 'demoFragment') {
      return DEMO_FRAGMENT.color
    }
    
    // Legacy fallbacks
    switch (this.fragmentType) {
      case "note": return 0xff69b4 // Pink (legacy)
      case "bass": return 0x00ffff // Cyan
      case "drums": return 0xffa500 // Orange
      case "guitar": return 0x9932cc // Purple
      case "synth": return 0x00ff88 // Green
      case "vocal": return 0xff69b4 // Pink
      default: return 0xffffff
    }
  }
}

/**
 * Goal - Level completion zone
 */
export class LevelGoal extends Phaser.GameObjects.Zone {
  constructor(scene, x, y, width = 64, height = 128) {
    super(scene, x, y, width, height)

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body.setAllowGravity(false)
    this.body.setImmovable(true)

    // Create visual indicator
    this.createVisual()
  }

  createVisual() {
    // Create a glowing portal effect
    this.visual = this.scene.add.rectangle(
      this.x, 
      this.y, 
      this.width, 
      this.height, 
      0x00ff88, 
      0.3
    )
    this.visual.setStrokeStyle(3, 0x00ff88, 1)

    // Pulsing animation
    this.scene.tweens.add({
      targets: this.visual,
      alpha: { from: 0.3, to: 0.6 },
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  destroy() {
    if (this.visual) {
      this.visual.destroy()
    }
    super.destroy()
  }
}

/**
 * SpeedRunStopwatch (Metronome) - When collected, starts the level's speed run timer
 * Place near the level start to give players a fair starting point for timing
 * Visually represented as a metronome, but internally still called "stopwatch" for backwards compatibility
 */
export class SpeedRunStopwatch extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    // Use metronome texture or fallback
    const textureKey = scene.textures.exists('collectible_metronome') 
      ? 'collectible_metronome' 
      : 'music_fragment_note' // Fallback
    
    super(scene, x, y, textureKey)

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.isCollected = false
    this.isStopwatch = true // Flag to identify this as a metronome/stopwatch

    // Set up physics - no gravity, static
    this.body.setAllowGravity(false)
    this.body.setImmovable(true)

    // Scale to appropriate size
    const targetHeight = 56
    const actualHeight = this.height || 40
    const scale = targetHeight / actualHeight
    this.setScale(scale)

    // Adjust body size
    this.body.setSize(this.width * 0.8, this.height * 0.8)
    this.body.setOffset(this.width * 0.1, this.height * 0.1)

    // Set origin to center
    this.setOrigin(0.5, 0.5)

    // Cyan tint for metronome
    this.setTint(SPEED_RUN_STOPWATCH.color)

    // Start animations
    this.startAnimations()
  }

  startAnimations() {
    // Floating animation
    this.scene.tweens.add({
      targets: this,
      y: this.y - 10,
      duration: 1200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })

    // Pendulum swing - like a metronome ticking
    this.scene.tweens.add({
      targets: this,
      angle: { from: -15, to: 15 },
      duration: 600,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })

    // Pulsing glow
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.7, to: 1 },
      duration: 500,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    })
  }

  collect() {
    if (this.isCollected) return

    this.isCollected = true

    // Play distinctive sound
    if (this.scene.sound.get("ui_confirm_sound")) {
      this.scene.sound.play("ui_confirm_sound", { volume: 0.5 })
    } else if (this.scene.sound.get("collect_fragment_sound")) {
      this.scene.sound.play("collect_fragment_sound", { volume: 0.5 })
    }

    // Emit timer start event
    this.scene.events.emit("stopwatchCollected", {
      x: this.x,
      y: this.y,
      timestamp: this.scene.time.now
    })

    // Collection animation - expand and fade with clock effect
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 2.5,
      scaleY: this.scaleY * 2.5,
      alpha: 0,
      angle: this.angle + 720, // Spin rapidly as it disappears
      duration: 400,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.destroy()
      }
    })

    // Show "GO!" text where the stopwatch was
    const goText = this.scene.add.text(this.x, this.y, "GO!", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#00ffff",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(100)

    this.scene.tweens.add({
      targets: goText,
      y: goText.y - 60,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => goText.destroy()
    })
  }
}
