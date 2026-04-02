import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level7Scene - Saw Blade Alley, timing-based hazard dodging
 * Difficulty: Hard
 */
export class Level7Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level7Scene" })
    
    this.tilemapKey = "level_7_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 45x12 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 45 * this.tileSize
    this.mapHeight = 12 * this.tileSize

    // Player spawn
    this.playerSpawnX = 2 * this.tileSize
    this.playerSpawnY = 9.5 * this.tileSize

    // Goal position
    this.goalX = 42.5 * this.tileSize
    this.goalY = 8.5 * this.tileSize
  }

  createFragments() {
    // Drums - on narrow platform 2
    this.placeFragment(12 * this.tileSize, 7.5 * this.tileSize, "drums", 0)

    // Bass - on mid section
    this.placeFragment(22 * this.tileSize, 9.5 * this.tileSize, "bass", 1)

    // Guitar - on narrow platform 5
    this.placeFragment(33 * this.tileSize, 6.5 * this.tileSize, "guitar", 2)

    // Note - on final platform
    this.placeFragment(42 * this.tileSize, 8.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Lots of saw blades moving up and down between platforms
    this.createMovingSawBlade(10 * this.tileSize, 5 * this.tileSize, 200, "vertical")
    this.createMovingSawBlade(14 * this.tileSize, 6 * this.tileSize, 150, "vertical")
    this.createMovingSawBlade(18 * this.tileSize, 7 * this.tileSize, 180, "vertical")
    
    this.createMovingSawBlade(27 * this.tileSize, 5 * this.tileSize, 200, "vertical")
    this.createMovingSawBlade(31 * this.tileSize, 4 * this.tileSize, 160, "vertical")
    this.createMovingSawBlade(35 * this.tileSize, 5 * this.tileSize, 190, "vertical")
    this.createMovingSawBlade(38 * this.tileSize, 6 * this.tileSize, 170, "vertical")

    // Spikes below platforms
    const spikeX = [6, 10, 14, 18, 27, 31, 35, 39]
    spikeX.forEach(x => {
      this.createSpike(x * this.tileSize, 11.5 * this.tileSize)
    })
  }

  createSpike(x, y) {
    const spike = this.physics.add.image(x, y, "spike_hazard")
    spike.setOrigin(0.5, 1)
    const targetHeight = 32
    spike.setScale(targetHeight / spike.height)
    spike.body.setAllowGravity(false)
    spike.body.setImmovable(true)
    spike.body.setSize(spike.width * 0.6, spike.height * 0.5)
    spike.body.setOffset(spike.width * 0.2, spike.height * 0.5)
    this.hazards.add(spike)
  }

  createMovingSawBlade(x, y, range, direction) {
    const saw = this.physics.add.image(x, y, "saw_blade_hazard")
    saw.setOrigin(0.5, 0.5)
    const targetSize = 48
    saw.setScale(targetSize / saw.height)
    saw.body.setAllowGravity(false)
    saw.body.setImmovable(true)
    saw.body.setCircle(saw.width * 0.4)
    saw.body.setOffset(saw.width * 0.1, saw.height * 0.1)
    
    // Rotate the saw blade
    this.tweens.add({
      targets: saw,
      angle: 360,
      duration: 800,
      repeat: -1,
      ease: "Linear"
    })

    // Move up and down
    if (direction === "vertical") {
      this.tweens.add({
        targets: saw,
        y: y + range,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    } else {
      this.tweens.add({
        targets: saw,
        x: x + range,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    }
    
    this.hazards.add(saw)
  }

  createAtmosphere() {
    const particles = this.add.particles(0, 0, "music_fragment_note", {
      x: { min: 0, max: this.mapWidth },
      y: { min: 0, max: this.mapHeight },
      scale: { start: 0.02, end: 0.01 },
      alpha: { start: 0.2, end: 0 },
      speed: { min: 5, max: 15 },
      angle: { min: -90, max: -70 },
      lifespan: 4000,
      frequency: 350,
      quantity: 1,
      blendMode: "ADD"
    })
    particles.setDepth(-5)
  }
}
