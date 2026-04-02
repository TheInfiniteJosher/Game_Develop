import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level11Scene - The Finale, ultimate challenge combining all mechanics
 * Difficulty: Expert
 */
export class Level11Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level11Scene" })
    
    this.tilemapKey = "level_11_cavern"
    this.tilesetName = "metroid_cavern_tileset"
    this.tilesetKey = "metroid_cavern_tileset"
    this.backgroundKey = "metroid_cavern_background"
  }

  create() {
    super.create()
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 55x16 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 55 * this.tileSize
    this.mapHeight = 16 * this.tileSize

    // Player spawn
    this.playerSpawnX = 2 * this.tileSize
    this.playerSpawnY = 13.5 * this.tileSize

    // Goal position
    this.goalX = 52.5 * this.tileSize
    this.goalY = 2.5 * this.tileSize
  }

  createFragments() {
    // Drums - on second gauntlet platform
    this.placeFragment(11 * this.tileSize, 9.5 * this.tileSize, "drums", 0)

    // Bass - on top of wall jump 1
    this.placeFragment(20.5 * this.tileSize, 3.5 * this.tileSize, "bass", 1)

    // Guitar - in corridor
    this.placeFragment(37 * this.tileSize, 6.5 * this.tileSize, "guitar", 2)

    // Note - on final top platform
    this.placeFragment(46.5 * this.tileSize, 0.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Gauntlet section spikes
    for (let i = 5; i < 17; i++) {
      this.createSpike(i * this.tileSize, 15.5 * this.tileSize)
    }
    
    // Wall jump section spikes
    for (let i = 19; i < 23; i++) {
      this.createSpike(i * this.tileSize, 15.5 * this.tileSize)
    }
    
    // Precision bridge has saw blades
    this.createSawBlade(26 * this.tileSize, 4 * this.tileSize)
    this.createSawBlade(29 * this.tileSize, 5 * this.tileSize)
    
    // Corridor has moving saw blades
    this.createMovingSawBlade(35 * this.tileSize, 6.5 * this.tileSize, 80, "horizontal")
    this.createMovingSawBlade(39 * this.tileSize, 6.5 * this.tileSize, 80, "horizontal")
    
    // Final wall jump section
    for (let i = 44; i < 49; i++) {
      this.createSpike(i * this.tileSize, 13.5 * this.tileSize)
    }
    
    // Final saw blade gauntlet
    this.createMovingSawBlade(46.5 * this.tileSize, 8 * this.tileSize, 200, "vertical")
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
      duration: 700,
      repeat: -1,
      ease: "Linear"
    })

    if (direction === "vertical") {
      this.tweens.add({
        targets: saw,
        y: y + range,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    } else {
      this.tweens.add({
        targets: saw,
        x: x + range,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    }
    
    this.hazards.add(saw)
  }

  createAtmosphere() {
    // More intense atmosphere for the finale
    const particles = this.add.particles(0, 0, "music_fragment_note", {
      x: { min: 0, max: this.mapWidth },
      y: { min: 0, max: this.mapHeight },
      scale: { start: 0.025, end: 0.01 },
      alpha: { start: 0.3, end: 0 },
      speed: { min: 8, max: 20 },
      angle: { min: -90, max: -70 },
      lifespan: 3500,
      frequency: 250,
      quantity: 2,
      blendMode: "ADD"
    })
    particles.setDepth(-5)
  }
}
