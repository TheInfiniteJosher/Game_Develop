import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level3Scene - Vertical challenge with ascending platforms
 * Difficulty: Medium
 */
export class Level3Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level3Scene" })
    
    this.tilemapKey = "level_3_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 25x16 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 25 * this.tileSize
    this.mapHeight = 16 * this.tileSize

    // Player spawn
    this.playerSpawnX = 3 * this.tileSize
    this.playerSpawnY = 13.5 * this.tileSize

    // Goal position
    this.goalX = 22 * this.tileSize
    this.goalY = 4.5 * this.tileSize
  }

  createFragments() {
    // Drums - on second step
    this.placeFragment(10.5 * this.tileSize, 10.5 * this.tileSize, "drums", 0)

    // Bass - on fourth step
    this.placeFragment(11.5 * this.tileSize, 6.5 * this.tileSize, "bass", 1)

    // Guitar - on final top platform
    this.placeFragment(13 * this.tileSize, 2.5 * this.tileSize, "guitar", 2)

    // Note - near the goal
    this.placeFragment(20 * this.tileSize, 4.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Spikes on some ledges to punish missing jumps
    this.createSpike(7 * this.tileSize, 15.5 * this.tileSize)
    this.createSpike(8 * this.tileSize, 15.5 * this.tileSize)
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
