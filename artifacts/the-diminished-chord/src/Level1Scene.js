import Phaser from "phaser"
import { BaseLevelScene } from "./BaseLevelScene.js"

/**
 * Level1Scene - First level: Basement Show (Detroit)
 * Introduces basic mechanics: running, jumping, wall jumping, collecting fragments
 * 
 * World 1 - Basement Show:
 * - Pure movement mastery
 * - Jump arc mastery, coyote time trust
 * - Basic spikes, wall jumps, tight spike corridors
 */
export class Level1Scene extends BaseLevelScene {
  constructor() {
    super({ key: "Level1Scene" })
    
    // Level-specific settings - no tilemap, use custom platforms
    this.backgroundKey = "metroid_cavern_background"
    
    // Force custom platform mode (no tilemap)
    this.useCustomPlatforms = true
  }

  create() {
    // Force custom platform mode before parent create
    this.useOverrideData = false
    this.levelOverride = null
    
    // Call parent create
    super.create()

    // Add atmospheric elements specific to this level
    this.createAtmosphere()
  }

  setupMapSize() {
    // Map is 30x12 tiles at 64px each
    this.tileSize = 64
    this.mapWidth = 30 * this.tileSize  // 1920
    this.mapHeight = 12 * this.tileSize  // 768

    // Player spawn - left side on starting platform
    this.playerSpawnX = 3 * this.tileSize
    this.playerSpawnY = 10 * this.tileSize

    // Goal position - right side on final platform
    this.goalX = 28 * this.tileSize
    this.goalY = 6 * this.tileSize
  }

  /**
   * Override createTileMap to create platforms directly instead of using a tilemap
   */
  createTileMap() {
    // Create platforms group for collision
    this.platforms = this.add.group()
    
    // Level 1 Layout: Tutorial Basics
    // - Starting platform (0-6, y:10-12)
    // - First floating platform (8-12, y:9)
    // - Second floating platform (14-17, y:7)
    // - Wall jump section (19-24, walls)
    // - Top platform (20-23, y:3)
    // - Final platform (26-30, y:6-7)

    // Platform color for basement/underground theme
    const platformColor = 0x3a3a4a
    const accentColor = 0xff6b6b

    // Starting ground platform
    this.createPlatformRect(0, 10, 7, 2, platformColor, accentColor)

    // First floating platform
    this.createPlatformRect(8, 9, 5, 1, platformColor, accentColor)

    // Second floating platform
    this.createPlatformRect(14, 7, 4, 1, platformColor, accentColor)

    // Wall jump section - left wall
    this.createPlatformRect(19, 4, 1, 8, platformColor, accentColor)

    // Wall jump section - right wall
    this.createPlatformRect(24, 4, 1, 8, platformColor, accentColor)

    // Top platform in wall jump section
    this.createPlatformRect(20, 3, 4, 1, platformColor, accentColor)

    // Final platform
    this.createPlatformRect(26, 6, 4, 2, platformColor, accentColor)
  }

  /**
   * Create a platform rectangle with physics
   */
  createPlatformRect(tileX, tileY, tileWidth, tileHeight, fillColor, strokeColor) {
    const x = tileX * this.tileSize
    const y = tileY * this.tileSize
    const width = tileWidth * this.tileSize
    const height = tileHeight * this.tileSize

    const platform = this.add.rectangle(
      x + width / 2,
      y + height / 2,
      width,
      height,
      fillColor
    )
    platform.setStrokeStyle(2, strokeColor)
    
    this.physics.add.existing(platform, true) // Static body
    this.platforms.add(platform)

    return platform
  }

  createFragments() {
    // Place 4 fragments throughout the level
    // Fragment positions based on level layout

    // Drums - on first floating platform
    this.placeFragment(10 * this.tileSize, 8.5 * this.tileSize, "drums", 0)

    // Bass - on second floating platform
    this.placeFragment(15.5 * this.tileSize, 6.5 * this.tileSize, "bass", 1)

    // Guitar - at top of wall jump section
    this.placeFragment(21.5 * this.tileSize, 2.5 * this.tileSize, "guitar", 2)

    // Note - on final platform before goal
    this.placeFragment(27 * this.tileSize, 5.5 * this.tileSize, "note", 3)
  }

  createHazards() {
    // Add some spikes at the bottom of the wall jump section
    // to make it more challenging
    this.createSpike(20 * this.tileSize, 11.5 * this.tileSize)
    this.createSpike(21 * this.tileSize, 11.5 * this.tileSize)
    this.createSpike(22 * this.tileSize, 11.5 * this.tileSize)
  }

  createSpike(x, y) {
    // Check if spike texture exists, otherwise create colored triangle
    if (this.textures.exists("spike_hazard")) {
      const spike = this.physics.add.image(x, y, "spike_hazard")
      spike.setOrigin(0.5, 1)
      
      // Scale spike to fit tile
      const targetHeight = 32
      spike.setScale(targetHeight / spike.height)
      
      spike.body.setAllowGravity(false)
      spike.body.setImmovable(true)
      spike.body.setSize(spike.width * 0.6, spike.height * 0.5)
      spike.body.setOffset(spike.width * 0.2, spike.height * 0.5)
      
      this.hazards.add(spike)
    } else {
      // Create triangle hazard if texture doesn't exist
      const spike = this.add.triangle(x, y, 0, 32, 16, 0, 32, 32, 0xff4444)
      spike.setOrigin(0.5, 1)
      this.physics.add.existing(spike, true)
      spike.body.setSize(24, 24)
      this.hazards.add(spike)
    }
  }

  setupCollisions() {
    // Player vs platforms
    if (this.platforms) {
      this.physics.add.collider(this.player, this.platforms.getChildren())
    }

    // Player vs fragments
    this.physics.add.overlap(
      this.player,
      this.fragments,
      (player, fragment) => {
        fragment.collect()
      },
      null,
      this
    )

    // Player vs hazards
    this.physics.add.overlap(
      this.player,
      this.hazards,
      (player, hazard) => {
        player.hitHazard()
      },
      null,
      this
    )

    // Player vs goal
    this.physics.add.overlap(
      this.player,
      this.goal,
      this.onReachGoal,
      null,
      this
    )
  }

  createAtmosphere() {
    // Add some ambient particles or effects
    // Subtle dust particles floating
    if (this.textures.exists("music_fragment_note")) {
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

  update(time, delta) {
    super.update(time, delta)
  }
}
