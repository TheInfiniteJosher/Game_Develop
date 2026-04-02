import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level8Scene - The Labyrinth, complex multi-path level
 * Difficulty: Hard
 */
export class Level8Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level8Scene" })
    
    this.tilemapKey = "level_8_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 35x18 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 35 * this.tileSize
    this.mapHeight = 18 * this.tileSize

    // Player spawn
    this.playerSpawnX = 4 * this.tileSize
    this.playerSpawnY = 15.5 * this.tileSize

    // Goal position
    this.goalX = 33 * this.tileSize
    this.goalY = 6.5 * this.tileSize
  }

  createFragments() {
    // Drums - in lower path
    this.placeFragment(17 * this.tileSize, 15.5 * this.tileSize, "drums", 0)

    // Bass - in upper path
    this.placeFragment(10 * this.tileSize, 10.5 * this.tileSize, "bass", 1)

    // Guitar - in top route
    this.placeFragment(19 * this.tileSize, 3.5 * this.tileSize, "guitar", 2)

    // Note - on convergence platform
    this.placeFragment(30 * this.tileSize, 9.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Spikes in the lower path corridor
    for (let i = 11; i < 24; i += 2) {
      this.createSpike(i * this.tileSize, 17.5 * this.tileSize)
    }
    
    // Saw blades guarding key paths
    this.createSawBlade(8 * this.tileSize, 13.5 * this.tileSize)
    this.createSawBlade(16 * this.tileSize, 7 * this.tileSize)
    this.createSawBlade(22 * this.tileSize, 5.5 * this.tileSize)
    this.createSawBlade(26 * this.tileSize, 8 * this.tileSize)
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
      frequency: 400,
      quantity: 1,
      blendMode: "ADD"
    })
    particles.setDepth(-5)
  }
}
