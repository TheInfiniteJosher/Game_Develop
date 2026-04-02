import Phaser from "phaser"
import { playerConfig } from "./gameConfig.json"
import { isAutoRicochetActive } from "./SettingsScene.js"

/**
 * TeddyPlayer - Punk rock teddy bear with Super Meat Boy-style controls
 * Features: Wall jumping, wall sliding, coyote time, jump buffering, run mode
 */
export class TeddyPlayer extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "teddy_idle_frame1")

    // Add to scene and physics system
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Movement parameters - Super Meat Boy style
    this.walkSpeed = playerConfig.walkSpeed.value
    this.runSpeed = playerConfig.runSpeed.value
    this.isRunning = false
    this.jumpPower = playerConfig.jumpPower.value
    this.wallJumpPowerX = playerConfig.wallJumpPowerX.value
    this.wallJumpPowerY = playerConfig.wallJumpPowerY.value
    this.wallSlideSpeed = playerConfig.wallSlideSpeed.value
    this.airAcceleration = playerConfig.airAcceleration.value
    this.groundFriction = playerConfig.groundFriction.value

    // Timing parameters for responsive controls
    this.coyoteTime = playerConfig.coyoteTime.value
    this.jumpBufferTime = playerConfig.jumpBufferTime.value

    // State tracking
    this.facingDirection = "right"
    this.isDead = false
    this.isWallSliding = false
    this.wallJumpDirection = 0 // 1 to jump right, -1 to jump left
    
    // Slide state - baseball-style ground slide to fit through 1-tile corridors
    this.isSliding = false
    this.slideSpeed = this.runSpeed * 1.3 // Slide is faster than running for momentum feel
    this.slideDuration = 500 // Duration of slide in ms
    this.slideStartTime = 0
    this.canSlide = true // Cooldown flag
    this.slideCooldown = 150 // Short cooldown between slides for fluid gameplay
    this.slideMinSpeed = this.walkSpeed * 0.3 // Minimum speed to initiate slide
    this.slideDirection = 1 // 1 for right, -1 for left

    // Timing state
    this.lastOnGroundTime = 0
    this.lastJumpPressedTime = 0
    this.wasOnGround = false
    
    // Wall jump grace time - allows wall jump even after leaving wall or releasing direction
    // This creates the "sticky" feel where player can still jump off wall briefly after contact
    this.wallJumpGraceTime = playerConfig.wallJumpGraceTime.value
    this.lastWallContactTime = 0 // Track when we last touched a wall
    this.lastWallDirection = 0 // Remember which wall we last touched (1=left wall, -1=right wall)
    this.lastWallJumpTime = 0 // Track when we last wall jumped (for brief movement lockout)
    
    // Jump consumption tracking - ensures ONE PRESS = ONE JUMP
    // Must release and re-press jump button to jump again
    this.jumpConsumed = false // True after a jump until button is released

    // Auto-ricochet feature (turbo wall jump when holding jump button while wall sliding)
    // This is a premium/unlockable feature - the ONLY exception to "one press = one jump"
    this.autoRicochetCooldown = playerConfig.autoRicochetCooldown?.value || 80 // ms between auto wall jumps
    this.lastAutoRicochetTime = 0

    // Set physics properties
    this.body.setGravityY(playerConfig.gravityY.value)
    this.body.setMaxVelocity(this.runSpeed, 1200)

    // Set collision box based on idle animation (319x560)
    this.unscaledBodyWidth = 319 * 0.7
    this.unscaledBodyHeight = 560 * 0.85
    this.normalBodyHeight = this.unscaledBodyHeight
    // Slide body height is reduced to fit through 1-tile (64px) corridors
    // At character scale, we need the scaled height to be ~60px to fit through 64px gaps
    this.slideBodyHeight = this.unscaledBodyHeight * 0.4 // 40% height when sliding
    this.slideBodyWidth = this.unscaledBodyWidth * 1.5 // Wider when sliding (lying down)
    this.body.setSize(this.unscaledBodyWidth, this.unscaledBodyHeight)

    // Set character scale - 1.5 tiles tall for agile feel
    const standardHeight = 1.5 * 64
    this.characterScale = standardHeight / 560
    this.setScale(this.characterScale)

    // Set initial origin
    this.setOrigin(0.5, 1.0)

    // Create animations
    this.createAnimations()

    // Play idle animation
    this.play("teddy_idle_anim")
    this.resetOriginAndOffset()

    // Initialize sounds
    this.initializeSounds()

    // Spawn position for respawn
    this.spawnX = x
    this.spawnY = y
  }

  initializeSounds() {
    this.jumpSound = this.scene.sound.add("jump_sound", { volume: 0.3 })
    this.wallJumpSound = this.scene.sound.add("walljump_sound", { volume: 0.3 })
    this.landSound = this.scene.sound.add("land_sound", { volume: 0.2 })
    this.deathSound = this.scene.sound.add("death_sound", { volume: 0.4 })
  }

  createAnimations() {
    const anims = this.scene.anims

    // Idle animation
    if (!anims.exists("teddy_idle_anim")) {
      anims.create({
        key: "teddy_idle_anim",
        frames: [
          { key: "teddy_idle_frame1", duration: 800 },
          { key: "teddy_idle_frame2", duration: 800 }
        ],
        repeat: -1
      })
    }

    // Run animation
    if (!anims.exists("teddy_run_anim")) {
      anims.create({
        key: "teddy_run_anim",
        frames: [
          { key: "teddy_run_frame1", duration: 100 },
          { key: "teddy_run_frame2", duration: 100 }
        ],
        repeat: -1
      })
    }

    // Jump up animation (first frame of jump)
    if (!anims.exists("teddy_jump_up_anim")) {
      anims.create({
        key: "teddy_jump_up_anim",
        frames: [{ key: "teddy_jump_frame1", duration: 150 }],
        repeat: 0
      })
    }

    // Jump down/fall animation (second frame of jump)
    if (!anims.exists("teddy_jump_down_anim")) {
      anims.create({
        key: "teddy_jump_down_anim",
        frames: [{ key: "teddy_jump_frame2", duration: 200 }],
        repeat: 0
      })
    }

    // Wall slide animation
    if (!anims.exists("teddy_wallslide_anim")) {
      anims.create({
        key: "teddy_wallslide_anim",
        frames: [
          { key: "teddy_wallslide_frame1", duration: 200 },
          { key: "teddy_wallslide_frame2", duration: 200 }
        ],
        repeat: -1
      })
    }

    // Death animation
    if (!anims.exists("teddy_death_anim")) {
      anims.create({
        key: "teddy_death_anim",
        frames: [
          { key: "teddy_death_frame1", duration: 100 },
          { key: "teddy_death_frame2", duration: 300 }
        ],
        repeat: 0
      })
    }

    // Ground slide animation (baseball-style slide)
    if (!anims.exists("teddy_slide_anim")) {
      anims.create({
        key: "teddy_slide_anim",
        frames: [
          { key: "teddy_slide_frame1", duration: 200 },
          { key: "teddy_slide_frame2", duration: 200 }
        ],
        repeat: -1
      })
    }
  }

  update(cursors, time) {
    if (!this.body || !this.active || this.isDead) {
      return
    }

    const isTouchingLeftWall = this.body.blocked.left
    const isTouchingRightWall = this.body.blocked.right
    const isTouchingWall = isTouchingLeftWall || isTouchingRightWall
    
    // FIX: Handle seam detection - ignore "on ground" at wall seams
    // When touching a wall and blocked.down is true, check if we're actually at a seam
    // A seam occurs when touching a wall corner - we should NOT be considered "on ground" there
    let isOnGround = this.body.blocked.down
    if (isOnGround && isTouchingWall && this.body.velocity.y >= 0) {
      // Check if we're actually on a proper ground surface
      // At a seam, the player would be falling/sliding, not standing
      // Only consider it ground if we're NOT also touching a wall on the same side as our movement
      const movingIntoWall = (isTouchingLeftWall && this.body.velocity.x < 0) || 
                              (isTouchingRightWall && this.body.velocity.x > 0)
      // If we're in the air (not wasOnGround last frame) and hitting a corner, it's a seam
      if (!this.wasOnGround && movingIntoWall) {
        isOnGround = false
      }
    }

    // Track ground state for coyote time
    if (isOnGround) {
      this.lastOnGroundTime = time
      // Play land sound when just landed
      if (!this.wasOnGround) {
        this.landSound.play()
      }
    }
    this.wasOnGround = isOnGround

    // Track wall contact for wall jump grace time (sticky walls)
    if (isTouchingLeftWall || isTouchingRightWall) {
      this.lastWallContactTime = time
      this.lastWallDirection = isTouchingLeftWall ? 1 : -1 // Jump direction away from wall
      this.wallJumpDirection = this.lastWallDirection
    }

    // Handle sliding (down arrow while running on ground)
    this.handleSlide(cursors, isOnGround, time)

    // Handle wall sliding (only if not sliding on ground)
    if (!this.isSliding) {
      this.handleWallSlide(cursors, isTouchingLeftWall, isTouchingRightWall, isOnGround, time)
    }

    // Handle movement (only if not sliding)
    if (!this.isSliding) {
      this.handleMovement(cursors, isOnGround, time)
    }

    // Handle jumping
    this.handleJump(cursors, isOnGround, time)

    // Update animations
    this.updateAnimations(isOnGround, isTouchingLeftWall, isTouchingRightWall)

    // NOTE: Death from falling off map is handled by DynamicLevelScene.update()
    // Do NOT call checkDeath() here - it bypasses the scene's death handling
    // which is responsible for death counting and ghost replay recording
  }

  handleWallSlide(cursors, isTouchingLeftWall, isTouchingRightWall, isOnGround, time) {
    const isTouchingWall = isTouchingLeftWall || isTouchingRightWall
    const isPressingTowardsWall = 
      (isTouchingLeftWall && cursors.left.isDown) || 
      (isTouchingRightWall && cursors.right.isDown)
    
    // FIX: Check for wall jump grace period
    // Player can still wall jump briefly after leaving wall or releasing direction
    const withinWallGrace = (time - this.lastWallContactTime) < this.wallJumpGraceTime
    
    // Active wall slide: touching wall + falling + not on ground
    // NOTE: No longer requires pressing TOWARD the wall to maintain slide state
    // This allows player to press away from wall and still execute wall jump
    if (isTouchingWall && this.body.velocity.y > 0 && !isOnGround) {
      this.isWallSliding = true
      // Only apply wall slide speed reduction when pressing INTO the wall
      if (isPressingTowardsWall) {
        this.body.setVelocityY(this.wallSlideSpeed)
      }
      this.facingDirection = isTouchingLeftWall ? "right" : "left"
    } 
    // Grace period: Can still "wall jump" briefly after leaving wall
    // This creates the sticky feel where pressing away doesn't immediately kill the wall jump
    else if (withinWallGrace && !isOnGround && this.body.velocity.y >= 0) {
      // Keep wall sliding state active during grace period for wall jump ability
      // But don't apply visual wall slide or speed reduction
      this.isWallSliding = true
      // Use the remembered wall direction for the jump
      this.wallJumpDirection = this.lastWallDirection
    }
    else {
      this.isWallSliding = false
    }
  }

  /**
   * Handle slide mechanic - press down while moving to slide
   * Baseball-style slide that reduces character height to fit through 1-tile corridors
   * Animation begins immediately on button press, persists based on physics/inertia
   */
  handleSlide(cursors, isOnGround, time) {
    // Check for slide initiation: on ground, moving, pressing down
    const isMoving = Math.abs(this.body.velocity.x) > this.slideMinSpeed
    const wantsToSlide = cursors.down.isDown && isOnGround && isMoving && this.canSlide && !this.isSliding
    
    // Start slide immediately on button press
    if (wantsToSlide) {
      this.isSliding = true
      this.slideStartTime = time
      this.canSlide = false
      
      // Store the slide direction based on current movement
      this.slideDirection = this.body.velocity.x > 0 ? 1 : -1
      this.facingDirection = this.slideDirection > 0 ? "right" : "left"
      
      // Store initial velocity for physics-based decay
      this.slideInitialVelocity = Math.abs(this.body.velocity.x)
      
      // Reduce body height for sliding (fit through 1-tile spaces)
      this.body.setSize(this.slideBodyWidth, this.slideBodyHeight)
      
      // Keep current momentum - don't boost, let physics handle it naturally
      // Just ensure we maintain the direction
      this.body.setVelocityX(this.slideDirection * this.slideInitialVelocity)
      
      // Play slide animation IMMEDIATELY
      this.play("teddy_slide_anim", true)
      this.resetOriginAndOffset()
    }
    
    // Update sliding state - physics-based persistence
    if (this.isSliding) {
      const slideElapsed = time - this.slideStartTime
      const currentSpeed = Math.abs(this.body.velocity.x)
      
      // Apply ground friction to simulate natural slide deceleration
      // This creates a physics-based slowdown instead of artificial duration
      const slideFriction = 0.98 // Slight friction per frame for smooth deceleration
      const newVelocity = this.body.velocity.x * slideFriction
      this.body.setVelocityX(newVelocity)
      
      // End slide conditions:
      // 1. Speed drops below minimum threshold (natural physics stop)
      // 2. Player releases down AND has been sliding for minimum time
      // 3. Hits a wall
      // 4. Leaves the ground (falls off edge)
      // 5. Max duration reached (safety cap)
      const speedTooLow = currentSpeed < this.slideMinSpeed * 0.5
      const minSlideTime = 150 // Minimum slide duration before player can cancel
      const playerReleasedDown = !cursors.down.isDown && slideElapsed > minSlideTime
      const hitWall = this.body.blocked.left || this.body.blocked.right
      const leftGround = !isOnGround
      const maxDurationReached = slideElapsed >= this.slideDuration
      
      const shouldEndSlide = speedTooLow || hitWall || leftGround || playerReleasedDown || maxDurationReached
      
      if (shouldEndSlide) {
        this.endSlide()
        // Start cooldown
        this.scene.time.delayedCall(this.slideCooldown, () => {
          this.canSlide = true
        })
      }
    }
  }

  /**
   * End the slide and restore normal body size
   */
  endSlide() {
    if (!this.isSliding) return
    
    this.isSliding = false
    
    // Restore normal body size
    this.body.setSize(this.unscaledBodyWidth, this.normalBodyHeight)
    
    // Reset to idle animation - updateAnimations will pick the correct one next frame
    this.play("teddy_idle_anim", true)
    this.resetOriginAndOffset()
  }

  handleMovement(cursors, isOnGround, time) {
    // Don't allow horizontal control briefly after wall jump for better feel
    const recentlyWallJumped = time - this.lastWallJumpTime < 100
    if (recentlyWallJumped) return

    // Check if running (space bar held down while moving)
    this.isRunning = cursors.space.isDown
    const currentSpeed = this.isRunning ? this.runSpeed : this.walkSpeed

    if (cursors.left.isDown) {
      this.body.setVelocityX(-currentSpeed)
      if (!this.isWallSliding) {
        this.facingDirection = "left"
      }
    } else if (cursors.right.isDown) {
      this.body.setVelocityX(currentSpeed)
      if (!this.isWallSliding) {
        this.facingDirection = "right"
      }
    } else {
      // Quick stop on ground, slower in air
      if (isOnGround) {
        this.body.setVelocityX(this.body.velocity.x * this.groundFriction)
        if (Math.abs(this.body.velocity.x) < 10) {
          this.body.setVelocityX(0)
        }
      } else {
        // Air friction
        this.body.setVelocityX(this.body.velocity.x * 0.95)
      }
    }

    // Update facing direction
    this.setFlipX(this.facingDirection === "left")
  }

  handleJump(cursors, isOnGround, time) {
    const jumpHeld = cursors.up?.isDown || false
    
    // Reset consumed flag when button released
    if (!jumpHeld) {
      this.jumpConsumed = false
    }
    
    // Detect fresh press (works for both keyboard and mobile merged controls)
    const jumpJustPressed = cursors.up?._justDown ?? Phaser.Input.Keyboard.JustDown(cursors.up)
    
    // Store press time for jump buffer
    if (jumpJustPressed) {
      this.lastJumpPressedTime = time
    }
    
    // Coyote time: can still jump briefly after leaving ground
    const canCoyoteJump = (time - this.lastOnGroundTime) < this.coyoteTime
    // Jump buffer: pressed jump slightly before landing
    const hasBufferedJump = (time - this.lastJumpPressedTime) < this.jumpBufferTime
    
    // AUTO-RICOCHET: Hold jump while wall sliding for rapid bouncing (premium feature)
    if (isAutoRicochetActive() && jumpHeld && this.isWallSliding) {
      if ((time - this.lastAutoRicochetTime) > this.autoRicochetCooldown) {
        this.performWallJump()
        this.lastAutoRicochetTime = time
      }
      return
    }
    
    // WALL JUMP: Fresh press while wall sliding
    if (this.isWallSliding && jumpJustPressed && !this.jumpConsumed) {
      this.performWallJump()
      this.jumpConsumed = true
      this.lastJumpPressedTime = 0
      return
    }
    
    // GROUND JUMP: Fresh press (or buffered) while on ground (or coyote)
    if ((isOnGround || canCoyoteJump) && !this.jumpConsumed && (jumpJustPressed || hasBufferedJump)) {
      this.performJump()
      this.jumpConsumed = true
      this.lastJumpPressedTime = 0
      this.lastOnGroundTime = 0
    }
    
    // Variable jump height - release early for short hop
    if (!jumpHeld && this.body.velocity.y < -100) {
      this.body.setVelocityY(this.body.velocity.y * 0.5)
    }
  }

  performJump() {
    this.body.setVelocityY(-this.jumpPower)
    this.jumpSound.play()
  }

  performWallJump() {
    this.body.setVelocityX(this.wallJumpDirection * this.wallJumpPowerX)
    this.body.setVelocityY(-this.wallJumpPowerY)
    this.facingDirection = this.wallJumpDirection > 0 ? "right" : "left"
    this.isWallSliding = false
    this.lastWallJumpTime = this.scene.time.now // Track for movement lockout
    this.lastWallContactTime = 0 // Reset wall contact to prevent immediate re-slide
    this.wallJumpSound.play()
  }

  updateAnimations(isOnGround, isTouchingLeftWall, isTouchingRightWall) {
    let newAnim = "teddy_idle_anim"
    const isTouchingWall = isTouchingLeftWall || isTouchingRightWall

    // Always maintain normal scale (slide animation handles the visual)
    this.setScale(this.characterScale)

    if (this.isSliding) {
      // Use the proper slide animation - baseball-style ground slide
      newAnim = "teddy_slide_anim"
    } else if (this.isWallSliding && isTouchingWall) {
      // Only show wall slide animation when actually touching wall
      // (not during grace period when we're in the air)
      newAnim = "teddy_wallslide_anim"
    } else if (!isOnGround) {
      if (this.body.velocity.y < 0) {
        newAnim = "teddy_jump_up_anim"
      } else {
        newAnim = "teddy_jump_down_anim"
      }
    } else if (Math.abs(this.body.velocity.x) > 20) {
      newAnim = "teddy_run_anim"
    }

    // Only change animation if different
    if (!this.anims.currentAnim || this.anims.currentAnim.key !== newAnim) {
      this.play(newAnim, true)
      this.resetOriginAndOffset()
    }
    
    // Update flip based on facing direction
    this.setFlipX(this.facingDirection === "left")
  }

  resetOriginAndOffset() {
    let baseOriginX = 0.5
    let baseOriginY = 1.0
    const currentAnim = this.anims.currentAnim

    if (currentAnim) {
      switch (currentAnim.key) {
        case "teddy_idle_anim":
          baseOriginX = 0.5
          baseOriginY = 1.0
          break
        case "teddy_run_anim":
          baseOriginX = 0.5
          baseOriginY = 1.0
          break
        case "teddy_jump_up_anim":
        case "teddy_jump_down_anim":
          baseOriginX = 0.356
          baseOriginY = 1.0
          break
        case "teddy_wallslide_anim":
          baseOriginX = 0.271
          baseOriginY = 1.0
          break
        case "teddy_death_anim":
          baseOriginX = 0.23
          baseOriginY = 1.0
          break
        case "teddy_slide_anim":
          // Slide animation origin from asset generation (832x594, origin 0.192, 1.0)
          baseOriginX = 0.192
          baseOriginY = 1.0
          break
        default:
          baseOriginX = 0.5
          baseOriginY = 1.0
      }
    }

    // Flip origin for facing left
    let animOriginX = this.facingDirection === "left" ? (1 - baseOriginX) : baseOriginX

    this.setOrigin(animOriginX, baseOriginY)

    // Calculate offset to align body with animation
    // When sliding, use the slide body dimensions
    if (this.isSliding) {
      const unscaledOffsetX = this.width * animOriginX - this.slideBodyWidth / 2
      const unscaledOffsetY = this.height * baseOriginY - this.slideBodyHeight
      this.body.setOffset(unscaledOffsetX, unscaledOffsetY)
    } else {
      const unscaledOffsetX = this.width * animOriginX - this.unscaledBodyWidth / 2
      const unscaledOffsetY = this.height * baseOriginY - this.unscaledBodyHeight
      this.body.setOffset(unscaledOffsetX, unscaledOffsetY)
    }
  }

  checkDeath() {
    // Death from falling off map
    if (this.y > this.scene.mapHeight + 100 && !this.isDead) {
      this.die()
    }
  }

  die() {
    if (this.isDead) return

    this.isDead = true
    this.body.setVelocity(0, 0)
    this.body.setAllowGravity(false)
    
    this.deathSound.play()
    this.play("teddy_death_anim", true)
    this.resetOriginAndOffset()

    // NOTE: Respawn is now handled by DynamicLevelScene.onPlayerDeath()
    // which calls restartLevel() after a delay
    // Do NOT auto-respawn here - it conflicts with scene-level death handling
  }

  respawn() {
    this.isDead = false
    this.isSliding = false
    this.canSlide = true
    this.isWallSliding = false
    this.slideDirection = 1
    this.jumpConsumed = false // Reset jump state
    this.body.setAllowGravity(true)
    this.setPosition(this.spawnX, this.spawnY)
    this.body.setVelocity(0, 0)
    this.body.setSize(this.unscaledBodyWidth, this.normalBodyHeight)
    
    // Apply spawn facing direction (set by level scene, defaults to "right")
    this.facingDirection = this.spawnFacingDirection || "right"
    this.setFlipX(this.facingDirection === "left")
    
    this.setScale(this.characterScale)
    this.play("teddy_idle_anim", true)
    this.resetOriginAndOffset()

    // Emit respawn event for UI updates
    this.scene.events.emit("playerRespawn")
  }

  // Called when player touches a hazard
  hitHazard() {
    this.die()
  }

  // Set new spawn point (checkpoint)
  setSpawnPoint(x, y) {
    this.spawnX = x
    this.spawnY = y
  }
}
