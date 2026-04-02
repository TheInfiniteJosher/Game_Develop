import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level6Scene - The Tower, vertical ascent with wall jumping
 * Difficulty: Hard
 */
export class Level6Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level6Scene" })
    
    this.tilemapKey = "level_6_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 20x20 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 20 * this.tileSize
    this.mapHeight = 20 * this.tileSize

    // Player spawn - on starting floor
    this.playerSpawnX = 10 * this.tileSize
    this.playerSpawnY = 17.5 * this.tileSize

    // Goal position - right side of tower top
    this.goalX = 18 * this.tileSize
    this.goalY = 1.5 * this.tileSize
  }

  createFragments() {
    // Drums - on internal platform 1
    this.placeFragment(8 * this.tileSize, 14.5 * this.tileSize, "drums", 0)

    // Bass - on internal platform 2
    this.placeFragment(12 * this.tileSize, 11.5 * this.tileSize, "bass", 1)

    // Guitar - on internal platform 4
    this.placeFragment(12 * this.tileSize, 5.5 * this.tileSize, "guitar", 2)

    // Note - on tower top
    this.placeFragment(10 * this.tileSize, 2.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Spikes at the bottom of the tower shaft
    for (let i = 7; i < 14; i++) {
      this.createSpike(i * this.tileSize, 17.5 * this.tileSize)
    }
    
    // Some saw blades on the walls for extra challenge
    this.createSawBlade(5.5 * this.tileSize, 8 * this.tileSize)
    this.createSawBlade(14.5 * this.tileSize, 8 * this.tileSize)
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
      alpha: { start: 0.25, end: 0 },
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
