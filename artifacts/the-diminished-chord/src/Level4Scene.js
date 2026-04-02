import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level4Scene - Narrow corridors and tight spaces
 * Difficulty: Medium
 */
export class Level4Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level4Scene" })
    
    this.tilemapKey = "level_4_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 40x12 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 40 * this.tileSize
    this.mapHeight = 12 * this.tileSize

    // Player spawn
    this.playerSpawnX = 2 * this.tileSize
    this.playerSpawnY = 9.5 * this.tileSize

    // Goal position
    this.goalX = 37.5 * this.tileSize
    this.goalY = 2.5 * this.tileSize
  }

  createFragments() {
    // Drums - in the corridor
    this.placeFragment(10 * this.tileSize, 8.5 * this.tileSize, "drums", 0)

    // Bass - on gap platform 2
    this.placeFragment(22 * this.tileSize, 7.5 * this.tileSize, "bass", 1)

    // Guitar - on gap platform 3
    this.placeFragment(26 * this.tileSize, 6.5 * this.tileSize, "guitar", 2)

    // Note - on exit platform
    this.placeFragment(31.5 * this.tileSize, 0.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Spikes below gap platforms
    for (let i = 0; i < 3; i++) {
      this.createSpike((16 + i) * this.tileSize, 11.5 * this.tileSize)
    }
    for (let i = 0; i < 3; i++) {
      this.createSpike((20 + i) * this.tileSize, 11.5 * this.tileSize)
    }
    // Spikes in wall jump corridor bottom
    this.createSpike(30.5 * this.tileSize, 11.5 * this.tileSize)
    this.createSpike(31.5 * this.tileSize, 11.5 * this.tileSize)
    this.createSpike(32.5 * this.tileSize, 11.5 * this.tileSize)
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
      alpha: { start: 0.2, end: 0 },
      speed: { min: 5, max: 15 },
      angle: { min: -90, max: -70 },
      lifespan: 4000,
      frequency: 450,
      quantity: 1,
      blendMode: "ADD"
    })
    particles.setDepth(-5)
  }
}
