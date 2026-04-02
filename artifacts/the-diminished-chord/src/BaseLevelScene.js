import Phaser from "phaser"
import { TeddyPlayer } from "./TeddyPlayer.js"
import { MusicFragment, LevelGoal } from "./MusicFragment.js"
import { musicManager } from "./MusicTrackManager.js"
import { LevelManager } from "./LevelManager.js"
import { SavedLevelsManager } from "./SavedLevelsManager.js"
import { levelConfig } from "./gameConfig.json"
import { BGMManager } from "./BGMManager.js"
import { getMergedControls } from "./MobileControlsScene.js"

/**
 * BaseLevelScene - Base class for all platformer levels
 * Handles common setup, physics, and game mechanics
 */
export class BaseLevelScene extends Phaser.Scene {
  constructor(config) {
    super(config)
  }

  create() {
    // Initialize game state
    this.gameCompleted = false
    this.deathCount = 0
    this.startTime = this.time.now
    this.tileSize = levelConfig.tileSize.value
    
    // Check if this level has a saved override from the Level Designer
    this.levelOverride = SavedLevelsManager.getBuiltinOverride(this.scene.key)
    this.useOverrideData = this.levelOverride && this.levelOverride.data

    // Reset music manager for new level attempt
    musicManager.resetLevelFragments()

    // Set up map dimensions (subclass should override setupMapSize)
    this.setupMapSize()

    // Create background
    this.createBackground()

    // Create tilemap or custom platforms based on override
    if (this.useOverrideData) {
      // Use custom platform system from level designer
      this.platforms = this.add.group()
      this.createCustomPlatforms()
    } else {
      // Use standard tilemap
      this.createTileMap()
    }

    // Create player
    this.createPlayer()

    // Create music fragments
    this.fragments = this.add.group()
    this.createFragments()

    // Create hazards
    this.hazards = this.add.group()
    this.createHazards()

    // Create goal
    this.createGoal()

    // Set up collisions
    this.setupCollisions()

    // Set up camera
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // Set world bounds (no bottom collision for falling death)
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight, true, true, true, false)
    this.player.body.setCollideWorldBounds(true)
    this.player.body.onWorldBounds = true

    // Create input controls
    this.setupInputs()

    // Launch UI
    this.scene.launch("UIScene", { gameSceneKey: this.scene.key })
    
    // Launch mobile controls if on touch device
    this.launchMobileControls()

    // Listen for fragment collection
    this.events.on("fragmentCollected", this.onFragmentCollected, this)
    this.events.on("playerRespawn", this.onPlayerRespawn, this)

    // Play background music for this level
    this.playLevelBackgroundMusic()
  }

  /**
   * Play the background music assigned to this level
   */
  playLevelBackgroundMusic() {
    // Use BGMManager for consistent music handling across all scenes
    BGMManager.playLevelMusic(this, this.scene.key)
  }

  /**
   * Stop the background music (call before scene transition)
   */
  stopLevelBackgroundMusic() {
    BGMManager.stop()
  }

  setupMapSize() {
    // Check for override data first
    if (this.useOverrideData) {
      const data = this.levelOverride.data
      this.mapWidth = (data.mapWidth || 30) * this.tileSize
      this.mapHeight = (data.mapHeight || 12) * this.tileSize
      return
    }
    
    // Override in subclass for default values
    this.mapWidth = 30 * this.tileSize
    this.mapHeight = 12 * this.tileSize
  }

  /**
   * Create custom platforms from level designer override data
   */
  createCustomPlatforms() {
    if (!this.useOverrideData) return

    const data = this.levelOverride.data
    
    // Process spawn and goal first to set positions
    data.objects.forEach(obj => {
      if (obj.type === "spawn") {
        this.playerSpawnX = (obj.x + 0.5) * this.tileSize
        this.playerSpawnY = (obj.y + 1) * this.tileSize
        this.playerSpawnFacingDirection = obj.facingDirection || "right"
      } else if (obj.type === "goal") {
        this.goalX = (obj.x + 0.5) * this.tileSize
        this.goalY = (obj.y + 1) * this.tileSize - 32
      }
    })

    // Create platforms
    data.objects.forEach(obj => {
      if (obj.type === "platform") {
        this.createCustomPlatform(obj)
      }
    })
  }

  createCustomPlatform(obj) {
    const x = obj.x * this.tileSize
    const y = obj.y * this.tileSize
    const width = obj.width * this.tileSize
    const height = obj.height * this.tileSize

    // Create textured platform using tileset
    this.createTexturedPlatform(x, y, width, height)
    
    // Create collision body as a separate invisible rectangle
    const collider = this.add.rectangle(x + width / 2, y + height / 2, width, height)
    collider.setVisible(false)
    this.physics.add.existing(collider, true) // Static body
    this.platforms.add(collider)
  }

  /**
   * Create a textured platform using tileset-based rendering
   * Creates proper 9-slice style tiled platform with edges and fill
   */
  createTexturedPlatform(x, y, width, height) {
    const tileSize = this.tileSize
    const container = this.add.container(x, y)
    
    // Use tileset if available, otherwise fall back to styled rectangles
    if (this.textures.exists("metroid_cavern_tileset")) {
      const tilesWide = Math.ceil(width / tileSize)
      const tilesHigh = Math.ceil(height / tileSize)
      
      for (let tx = 0; tx < tilesWide; tx++) {
        for (let ty = 0; ty < tilesHigh; ty++) {
          const tileX = tx * tileSize
          const tileY = ty * tileSize
          
          // Create individual tile from tileset with origin at top-left
          // This ensures proper positioning with setCrop
          const tile = this.add.image(tileX, tileY, "metroid_cavern_tileset")
          tile.setOrigin(0, 0)
          
          // Determine tile type based on position
          let frameX = 64, frameY = 64  // Default to center tile
          
          const isTop = ty === 0
          const isBottom = ty === tilesHigh - 1
          const isLeft = tx === 0
          const isRight = tx === tilesWide - 1
          
          if (isTop && isLeft) {
            frameX = 0; frameY = 0
          } else if (isTop && isRight) {
            frameX = 128; frameY = 0
          } else if (isBottom && isLeft) {
            frameX = 0; frameY = 128
          } else if (isBottom && isRight) {
            frameX = 128; frameY = 128
          } else if (isTop) {
            frameX = 64; frameY = 0
          } else if (isBottom) {
            frameX = 64; frameY = 128
          } else if (isLeft) {
            frameX = 0; frameY = 64
          } else if (isRight) {
            frameX = 128; frameY = 64
          }
          
          tile.setCrop(frameX, frameY, 64, 64)
          tile.setDisplaySize(tileSize, tileSize)
          container.add(tile)
        }
      }
    } else {
      // Fallback: Create styled platform
      this.createStyledPlatformContainer(container, width, height)
    }
    
    container.setDepth(-1)
    return container
  }

  /**
   * Create a styled platform with visual effects (fallback when tileset unavailable)
   */
  createStyledPlatformContainer(container, width, height) {
    const platformColor = this.getPlatformColor()
    const accentColor = this.getAccentColor()
    const highlightColor = 0x5a5a6a
    
    // Main platform body
    const mainRect = this.add.rectangle(width / 2, height / 2, width, height, platformColor)
    mainRect.setStrokeStyle(3, accentColor)
    container.add(mainRect)
    
    // Top highlight for 3D effect
    const topHighlight = this.add.rectangle(width / 2, 3, width - 6, 6, highlightColor, 0.6)
    container.add(topHighlight)
    
    // Bottom shadow
    const bottomShadow = this.add.rectangle(width / 2, height - 3, width - 6, 6, 0x1a1a2a, 0.5)
    container.add(bottomShadow)
    
    // Texture pattern
    const patternSpacing = 16
    for (let px = patternSpacing; px < width - patternSpacing; px += patternSpacing) {
      const line = this.add.rectangle(px, height / 2, 2, height - 10, accentColor, 0.1)
      container.add(line)
    }
  }

  /**
   * Get platform color based on level theme
   */
  getPlatformColor() {
    // Underground/basement theme default
    return this.platformColor || 0x3a3a4a
  }

  /**
   * Get accent color based on level theme
   */
  getAccentColor() {
    // Punk rock red accent default
    return this.accentColor || 0xff6b6b
  }

  createBackground() {
    // Override in subclass for specific background
    // Default implementation creates a tiled background
    const bgKey = this.backgroundKey || "metroid_cavern_background"
    
    if (this.textures.exists(bgKey)) {
      const bg = this.textures.get(bgKey)
      const bgWidth = bg.getSourceImage().width
      const bgHeight = bg.getSourceImage().height

      // Scale to fit map height
      const scale = this.mapHeight / bgHeight

      // Tile horizontally if needed
      const scaledWidth = bgWidth * scale
      const numTiles = Math.ceil(this.mapWidth / scaledWidth) + 1

      for (let i = 0; i < numTiles; i++) {
        const bgSprite = this.add.image(i * scaledWidth, this.mapHeight, bgKey)
        bgSprite.setOrigin(0, 1)
        bgSprite.setScale(scale)
        bgSprite.setScrollFactor(0.2) // Parallax effect
        bgSprite.setDepth(-10)
      }
    }
  }

  createTileMap() {
    // Override in subclass
    // Default creates from tilemap
    if (this.tilemapKey) {
      this.map = this.make.tilemap({ key: this.tilemapKey })
      
      if (!this.map) {
        console.error(`Failed to create tilemap with key: ${this.tilemapKey}`)
        return
      }
      
      const tileset = this.map.addTilesetImage(
        this.tilesetName || "metroid_cavern_tileset",
        this.tilesetKey || "metroid_cavern_tileset"
      )

      if (!tileset) {
        console.error(`Failed to add tileset image: ${this.tilesetName || "metroid_cavern_tileset"}`)
        return
      }

      // Create ground layer
      this.groundLayer = this.map.createLayer("ground", tileset, 0, 0)
      
      if (!this.groundLayer) {
        console.error(`Failed to create layer "ground" from tilemap`)
        return
      }
      
      this.groundLayer.setCollisionByExclusion([-1])
    }
  }

  createPlayer() {
    // Default spawn position - override in subclass or from level override
    const spawnX = this.playerSpawnX || 128
    const spawnY = this.playerSpawnY || this.mapHeight - 128

    this.player = new TeddyPlayer(this, spawnX, spawnY)
    
    // Set initial facing direction from spawn point (if specified)
    const facingDirection = this.playerSpawnFacingDirection || "right"
    if (facingDirection === "left") {
      this.player.facingDirection = "left"
      this.player.setFlipX(true)
    }
    
    // Store spawn facing direction on player for respawns
    this.player.spawnFacingDirection = facingDirection
  }

  createFragments() {
    // If using override data, create fragments from that
    if (this.useOverrideData) {
      this.createFragmentsFromOverride()
      return
    }
    // Otherwise subclass should override to place fragments
    // Example placement:
    // this.placeFragment(x, y, "drums")
  }

  createFragmentsFromOverride() {
    if (!this.useOverrideData) return

    const data = this.levelOverride.data
    let fragmentId = 0

    data.objects.forEach(obj => {
      if (obj.type.startsWith("fragment_")) {
        const type = obj.type.replace("fragment_", "")
        const x = (obj.x + 0.5) * this.tileSize
        const y = (obj.y + 0.5) * this.tileSize
        this.placeFragment(x, y, type, fragmentId++)
      }
    })
  }

  placeFragment(x, y, type, id = 0) {
    const fragment = new MusicFragment(this, x, y, type, id)
    this.fragments.add(fragment)
    return fragment
  }

  createHazards() {
    // If using override data, create hazards from that
    if (this.useOverrideData) {
      this.createHazardsFromOverride()
      return
    }
    // Otherwise subclass should override to place hazards
  }

  createHazardsFromOverride() {
    if (!this.useOverrideData) return

    const data = this.levelOverride.data

    data.objects.forEach(obj => {
      if (obj.type === "spike") {
        this.createSpikesFromOverride(obj)
      } else if (obj.type === "saw" || obj.type === "saw_h" || obj.type === "saw_v" || obj.type === "saw_c") {
        this.createSawBladesFromOverride(obj)
      }
    })
  }

  createSpikesFromOverride(obj) {
    for (let i = 0; i < obj.width; i++) {
      for (let j = 0; j < obj.height; j++) {
        const x = (obj.x + i + 0.5) * this.tileSize
        const y = (obj.y + j + 1) * this.tileSize

        const spike = this.physics.add.image(x, y, "spike_hazard")
        spike.setOrigin(0.5, 1)
        const targetHeight = this.tileSize * 0.5
        spike.setScale(targetHeight / spike.height)
        spike.body.setAllowGravity(false)
        spike.body.setImmovable(true)
        spike.body.setSize(spike.width * 0.6, spike.height * 0.5)
        spike.body.setOffset(spike.width * 0.2, spike.height * 0.5)
        this.hazards.add(spike)
      }
    }
  }

  createSawBladesFromOverride(obj) {
    for (let i = 0; i < obj.width; i++) {
      for (let j = 0; j < obj.height; j++) {
        const x = (obj.x + i + 0.5) * this.tileSize
        const y = (obj.y + j + 0.5) * this.tileSize

        const saw = this.physics.add.image(x, y, "saw_blade_hazard")
        saw.setOrigin(0.5, 0.5)
        const targetSize = this.tileSize * 0.7
        saw.setScale(targetSize / saw.height)
        saw.body.setAllowGravity(false)
        saw.body.setImmovable(true)
        saw.body.setCircle(saw.width * 0.4)
        saw.body.setOffset(saw.width * 0.1, saw.height * 0.1)

        // Rotation animation
        this.tweens.add({
          targets: saw,
          angle: 360,
          duration: 1000,
          repeat: -1,
          ease: "Linear"
        })

        // Apply movement if specified
        if (obj.movement) {
          this.applySawMovement(saw, x, y, obj.movement)
        }

        this.hazards.add(saw)
      }
    }
  }

  /**
   * Apply movement pattern to a saw blade
   */
  applySawMovement(saw, startX, startY, movement) {
    const { type, distance, speed, delay } = movement
    const duration = speed || 2000
    const moveDistance = (distance || 3) * this.tileSize
    
    switch (type) {
      case "horizontal":
        this.tweens.add({
          targets: saw,
          x: startX + moveDistance,
          duration: duration,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: delay || 0
        })
        break
        
      case "vertical":
        this.tweens.add({
          targets: saw,
          y: startY + moveDistance,
          duration: duration,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: delay || 0
        })
        break
        
      case "circular":
        const radius = moveDistance / 2
        let angle = 0
        this.time.addEvent({
          delay: 16,
          callback: () => {
            angle += (2 * Math.PI) / (duration / 16)
            saw.x = startX + Math.cos(angle) * radius
            saw.y = startY + Math.sin(angle) * radius
            saw.body.reset(saw.x, saw.y)
          },
          loop: true
        })
        break
        
      case "diagonal":
        this.tweens.add({
          targets: saw,
          x: startX + moveDistance,
          y: startY + moveDistance,
          duration: duration,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: delay || 0
        })
        break
    }
  }

  createGoal() {
    // Goal position may be set from override data in createCustomPlatforms
    // Default: place at right side of map
    const goalX = this.goalX || this.mapWidth - 64
    const goalY = this.goalY || this.mapHeight - 128

    this.goal = new LevelGoal(this, goalX, goalY, 64, 64)
  }

  setupCollisions() {
    // Player vs ground (tilemap layer)
    // Check that groundLayer exists and has valid layer data for collision
    if (this.groundLayer && this.groundLayer.layer && this.groundLayer.layer.tileWidth) {
      this.physics.add.collider(this.player, this.groundLayer)
    }

    // Player vs custom platforms (from level designer override)
    if (this.platforms) {
      this.physics.add.collider(this.player, this.platforms)
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

  setupInputs() {
    this.cursors = this.input.keyboard.createCursorKeys()
    // Add space for running
    this.cursors.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    
    // Pause with semicolon key
    this.input.keyboard.on("keydown-SEMICOLON", () => this.pauseGame())
    this.input.keyboard.on("keydown-ESC", () => this.pauseGame())
    
    // Reset player to spawn point with "/" key
    this.input.keyboard.on("keydown-FORWARD_SLASH", () => this.resetPlayerToSpawn())
  }

  /**
   * Launch mobile controls overlay if on a touch device
   */
  launchMobileControls() {
    // Check if touch device
    const isTouchDevice = (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    )
    
    if (isTouchDevice) {
      // Launch mobile controls scene as overlay
      if (!this.scene.isActive("MobileControlsScene")) {
        this.scene.launch("MobileControlsScene", { gameSceneKey: this.scene.key })
      }
    }
  }

  /**
   * Open pause menu - can be called by mobile controls
   */
  openPauseMenu() {
    this.pauseGame()
  }

  /**
   * Reset player to spawn point (manual respawn with "/" key)
   */
  resetPlayerToSpawn() {
    if (this.gameCompleted || !this.player || this.player.isDead) return
    
    // Trigger the respawn
    this.player.respawn()
  }

  pauseGame() {
    if (this.gameCompleted) return
    
    // Pause this scene
    this.scene.pause()
    
    // Pause UI scene
    this.scene.pause("UIScene")
    
    // Launch pause menu
    this.scene.launch("PauseMenuScene", { gameSceneKey: this.scene.key })
  }

  update(time, delta) {
    if (this.gameCompleted) return

    // Get merged controls (keyboard + touch)
    const controls = getMergedControls(this.cursors, this.registry)
    
    // Update player
    this.player.update(controls, time)
  }

  onFragmentCollected(data) {
    musicManager.collectFragment(data.type)
    
    // Update UI
    this.events.emit("updateFragmentUI", {
      collected: musicManager.getCollectedCount(),
      total: musicManager.getTotalFragments()
    })
  }

  onPlayerRespawn() {
    this.deathCount++
    // Reset fragments for this attempt
    musicManager.resetLevelFragments()
    
    // Re-create fragments
    this.fragments.clear(true, true)
    this.createFragments()

    // Re-create hazards (saw blades may have lost their tween)
    if (this.useOverrideData) {
      this.hazards.clear(true, true)
      this.createHazards()
    }

    // Update UI
    this.events.emit("updateFragmentUI", {
      collected: 0,
      total: musicManager.getTotalFragments()
    })
    this.events.emit("updateDeathCount", this.deathCount)
  }

  onReachGoal(player, goal) {
    if (this.gameCompleted) return

    this.gameCompleted = true

    // Calculate completion time
    const completionTime = Math.floor((this.time.now - this.startTime) / 1000)

    // Check if all fragments collected
    const allFragments = musicManager.hasAllFragments()

    // Unlock track if all fragments collected
    let unlockedTrack = null
    if (allFragments) {
      unlockedTrack = musicManager.unlockTrack(this.scene.key)
    }

    // Get level track info for the audio player
    const levelTrack = musicManager.getTrackForLevel(this.scene.key)

    // Play level complete sound
    this.sound.play("level_complete_sound", { volume: 0.5 })

    // Stop player
    this.player.body.setVelocity(0, 0)
    this.player.body.setAllowGravity(false)

    // Transfer BGM control to victory screen (don't stop it, let it continue)
    // The victory screen will take over control of the music
    const bgmReference = this.levelBgm
    this.levelBgm = null // Clear reference so shutdown() doesn't stop it

    // Determine which scene to launch
    if (LevelManager.isLastLevel(this.scene.key)) {
      this.scene.launch("GameCompleteUIScene", {
        currentLevelKey: this.scene.key,
        completionTime,
        deathCount: this.deathCount,
        allFragments,
        unlockedTrack,
        levelTrack,
        levelBgm: bgmReference
      })
    } else {
      this.scene.launch("VictoryUIScene", {
        currentLevelKey: this.scene.key,
        completionTime,
        deathCount: this.deathCount,
        allFragments,
        unlockedTrack,
        levelTrack,
        levelBgm: bgmReference
      })
    }
  }

  // Clean up when scene is stopped
  shutdown() {
    this.events.off("fragmentCollected", this.onFragmentCollected, this)
    this.events.off("playerRespawn", this.onPlayerRespawn, this)
    // Don't stop music here - let BGMManager handle it
    // Music will continue if retrying the same level, or stop when switching to a different level/menu
  }
}
