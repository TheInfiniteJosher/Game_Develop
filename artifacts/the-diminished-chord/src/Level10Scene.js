import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level10Scene - The Pit of Despair, deep vertical challenge
 * Difficulty: Very Hard
 */
export class Level10Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level10Scene" })
    
    this.tilemapKey = "level_10_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 25x22 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 25 * this.tileSize
    this.mapHeight = 22 * this.tileSize

    // Player spawn - on top starting platform
    this.playerSpawnX = 2.5 * this.tileSize
    this.playerSpawnY = 1.5 * this.tileSize

    // Goal position
    this.goalX = 23 * this.tileSize
    this.goalY = 2.5 * this.tileSize
  }

  createFragments() {
    // Drums - on mid platform in shaft
    this.placeFragment(6 * this.tileSize, 9.5 * this.tileSize, "drums", 0)

    // Bass - on safe landing left
    this.placeFragment(10 * this.tileSize, 16.5 * this.tileSize, "bass", 1)

    // Guitar - on ascent platform 2
    this.placeFragment(16.5 * this.tileSize, 8.5 * this.tileSize, "guitar", 2)

    // Note - on ascent platform 3
    this.placeFragment(20.5 * this.tileSize, 5.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // The spike pit at bottom - deadly!
    for (let i = 1; i < 24; i++) {
      this.createSpike(i * this.tileSize, 19.5 * this.tileSize)
    }
    
    // Saw blades in the descent and ascent paths
    this.createMovingSawBlade(7.5 * this.tileSize, 8 * this.tileSize, 150, "vertical")
    this.createMovingSawBlade(12 * this.tileSize, 14 * this.tileSize, 100, "horizontal")
    this.createMovingSawBlade(17 * this.tileSize, 7 * this.tileSize, 100, "vertical")
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
    
    this.tweens.add({
      targets: saw,
      angle: 360,
      duration: 800,
      repeat: -1,
      ease: "Linear"
    })

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
      alpha: { start: 0.15, end: 0 },
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
