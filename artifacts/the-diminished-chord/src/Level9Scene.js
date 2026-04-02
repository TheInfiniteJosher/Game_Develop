import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level9Scene - Precision Nightmare, pixel-perfect jumps
 * Difficulty: Very Hard
 */
export class Level9Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level9Scene" })
    
    this.tilemapKey = "level_9_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 40x14 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 40 * this.tileSize
    this.mapHeight = 14 * this.tileSize

    // Player spawn
    this.playerSpawnX = 1.5 * this.tileSize
    this.playerSpawnY = 11.5 * this.tileSize

    // Goal position
    this.goalX = 38.5 * this.tileSize
    this.goalY = 7.5 * this.tileSize
  }

  createFragments() {
    // Drums - on tiny platform 2
    this.placeFragment(8.5 * this.tileSize, 7.5 * this.tileSize, "drums", 0)

    // Bass - high tiny platform after wall jump
    this.placeFragment(20.5 * this.tileSize, 3.5 * this.tileSize, "bass", 1)

    // Guitar - on descending tiny 1
    this.placeFragment(26.5 * this.tileSize, 7.5 * this.tileSize, "guitar", 2)

    // Note - on almost there platform
    this.placeFragment(34 * this.tileSize, 8.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // This level is mostly death by falling
    // Add some spikes on the bottom for extra danger
    for (let i = 4; i < 38; i += 2) {
      this.createSpike(i * this.tileSize, 13.5 * this.tileSize)
    }
    
    // Saw blades between some platforms
    this.createSawBlade(7 * this.tileSize, 9 * this.tileSize)
    this.createSawBlade(13 * this.tileSize, 9 * this.tileSize)
    this.createSawBlade(22 * this.tileSize, 5 * this.tileSize)
    this.createSawBlade(28 * this.tileSize, 9 * this.tileSize)
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
    const targetSize = 40
    saw.setScale(targetSize / saw.height)
    saw.body.setAllowGravity(false)
    saw.body.setImmovable(true)
    saw.body.setCircle(saw.width * 0.4)
    saw.body.setOffset(saw.width * 0.1, saw.height * 0.1)
    
    this.tweens.add({
      targets: saw,
      angle: 360,
      duration: 800,
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
      alpha: { start: 0.15, end: 0 },
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
