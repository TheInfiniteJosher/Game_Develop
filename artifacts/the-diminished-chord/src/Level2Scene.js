import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level2Scene - Introduction to longer gaps and multiple wall jumps
 * Difficulty: Easy-Medium
 */
export class Level2Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level2Scene" })
    
    // Level-specific settings
    this.tilemapKey = "level_2_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 35x12 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 35 * this.tileSize
    this.mapHeight = 12 * this.tileSize

    // Player spawn - left side on starting platform
    this.playerSpawnX = 2 * this.tileSize
    this.playerSpawnY = 9.5 * this.tileSize

    // Goal position - right side on final platform
    this.goalX = 32 * this.tileSize
    this.goalY = 5.5 * this.tileSize
  }

  createFragments() {
    // Drums - on first floating platform
    this.placeFragment(8.5 * this.tileSize, 8.5 * this.tileSize, "drums", 0)

    // Bass - on middle platform in wall section
    this.placeFragment(19.5 * this.tileSize, 6.5 * this.tileSize, "bass", 1)

    // Guitar - on top platform after wall jump
    this.placeFragment(19.5 * this.tileSize, 1.5 * this.tileSize, "guitar", 2)

    // Note - on bridge platform before goal
    this.placeFragment(25.5 * this.tileSize, 3.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Add spikes below the wall jump section
    for (let i = 0; i < 4; i++) {
      this.createSpike((18 + i) * this.tileSize, 11.5 * this.tileSize)
    }
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

  createAtmosphere() {
    const particles = this.add.particles(0, 0, "music_fragment_note", {
      x: { min: 0, max: this.mapWidth },
      y: { min: 0, max: this.mapHeight },
      scale: { start: 0.02, end: 0.01 },
      alpha: { start: 0.3, end: 0 },
      speed: { min: 5, max: 15 },
      angle: { min: -90, max: -70 },
      lifespan: 4000,
      frequency: 500,
      quantity: 1,
      blendMode: "ADD"
    })
    particles.setDepth(-5)
  }
}
