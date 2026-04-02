import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level5Scene - The Gauntlet, long horizontal challenge
 * Difficulty: Medium-Hard
 */
export class Level5Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level5Scene" })
    
    this.tilemapKey = "level_5_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 50x12 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 50 * this.tileSize
    this.mapHeight = 12 * this.tileSize

    // Player spawn
    this.playerSpawnX = 3 * this.tileSize
    this.playerSpawnY = 9.5 * this.tileSize

    // Goal position
    this.goalX = 47 * this.tileSize
    this.goalY = 7.5 * this.tileSize
  }

  createFragments() {
    // Drums - on platform 2
    this.placeFragment(14.5 * this.tileSize, 7.5 * this.tileSize, "drums", 0)

    // Bass - on platform 4
    this.placeFragment(25.5 * this.tileSize, 6.5 * this.tileSize, "bass", 1)

    // Guitar - on platform 5
    this.placeFragment(37 * this.tileSize, 5.5 * this.tileSize, "guitar", 2)

    // Note - on final stretch
    this.placeFragment(46 * this.tileSize, 7.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Spikes throughout the gauntlet - between platforms
    const spikePositions = [7, 12, 17, 22, 23, 28, 35, 39, 43]
    spikePositions.forEach(x => {
      this.createSpike(x * this.tileSize, 11.5 * this.tileSize)
    })
    
    // Add some saw blades for extra challenge
    this.createSawBlade(9.5 * this.tileSize, 6 * this.tileSize)
    this.createSawBlade(19.5 * this.tileSize, 6 * this.tileSize)
    this.createSawBlade(37 * this.tileSize, 3 * this.tileSize)
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

  createSawBlade(x, y) {
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
      duration: 1000,
      repeat: -1,
      ease: "Linear"
    })
    
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
