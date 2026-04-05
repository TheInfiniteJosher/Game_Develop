import Phaser from "phaser"
import { TeddyPlayer } from "./TeddyPlayer.js"
import { WorldManager, LEVEL_TYPES } from "./WorldManager.js"
import { BGMManager } from "./BGMManager.js"
import { BOSS_DATA } from "./BossFightSystem.js"
import { getMergedControls } from "./MobileControlsScene.js"

/**
 * BossLevel1Scene - "BATTLE OF THE BANDS" (World 1 Boss)
 *
 * Lore:
 *   Teddy discovers a no-show opened a spot at the Battle of the Bands he missed the
 *   first time around. But the Rival Garage Band "The Copycats" caught wind of it too.
 *   It's a RACE across the collapsing warehouse stage to claim the slot — and then a
 *   guitar riff-off to seal the deal.
 *
 * Mechanics:
 *   1. Collapsing floor tiles  — step on one, it flashes and falls in ~1 second
 *   2. Rival Band chaser       — pursues from off-screen left, forces forward momentum
 *   3. Bottle hazards          — crowd throws bottles in the Act 2 crowd area
 *   4. Cable trip zones        — tangled cables on stage that slow the player
 *   5. Guitar Riff Battle      — rhythm key-press minigame at the venue finish line
 *   6. Poster system           — Teddy places posters; rival band tears them down
 */

// ─── Level constants ────────────────────────────────────────────────────────
const LEVEL_WIDTH  = 4480
const LEVEL_HEIGHT = 640
const GROUND_Y     = 576  // top of ground layer
const STAGE_Y      = 448  // top of elevated stage (Act 1)
const STAGE_H      = 24   // thickness of stage planks
const TILE_W       = 64
const CROWD_START  = 1536
const RACE_START   = 2944
const GOAL_X       = 4350

// Rival band speed (px/s). Player walk ≈ 200, run ≈ 320
const RIVAL_BASE_SPEED = 175

// ─── Guitar riff sequence ───────────────────────────────────────────────────
const RIFF_SEQUENCE = [
  { key: "LEFT",  label: "◄", color: "#ff4444", codes: [37, 65] },
  { key: "RIGHT", label: "►", color: "#44ff44", codes: [39, 68] },
  { key: "UP",    label: "▲", color: "#ffff44", codes: [38, 87] },
  { key: "RIGHT", label: "►", color: "#44ff44", codes: [39, 68] },
  { key: "LEFT",  label: "◄", color: "#ff4444", codes: [37, 65] },
  { key: "UP",    label: "▲", color: "#ffff44", codes: [38, 87] },
  { key: "STRUM", label: "✦", color: "#ff69b4", codes: [32, 90, 74] },
]

// ─── Scene ──────────────────────────────────────────────────────────────────
export class BossLevel1Scene extends Phaser.Scene {
  constructor() {
    super({ key: "BossLevel1Scene" })
  }

  // ── init ──────────────────────────────────────────────────────────────────
  init(data) {
    this.levelId = data.levelId || "W1BOSS"
    this.deathCount = 0
    this.raceStarted = false
    this.levelComplete = false
    this.isProcessingDeath = false
    this.riffBattleActive = false
    this.rivalBandStarted = false

    this.bottleTimer    = 0
    this.bottleInterval = 3200  // ms between bottles (in crowd area)

    this.collapsingTiles = []
    this.activeBottles   = []
    this.cables          = []
    this.posterSpots     = []
  }

  // ── create ────────────────────────────────────────────────────────────────
  create() {
    const { width, height } = this.cameras.main

    // Build world in correct Z-order
    this.createBackground()
    this.createDecorations()
    this.createPlatforms()       // solid floor + stage sections
    this.createCollapsingTiles() // Act 1 stage collapse section
    this.createCables()          // trip-wire slow zones
    this.createPosters()         // poster spots on walls

    // Player
    this.player = new TeddyPlayer(this, 96, STAGE_Y - 60)
    this.player.setDepth(10)

    // Physics colliders
    this.physics.add.collider(this.player, this.solidGroup)
    this.physics.add.collider(
      this.player,
      this.collapsingGroup,
      this.onCollapsingCollide,
      null,
      this
    )

    // Rival band (visual-only object, no physics sprite)
    this.createRivalBand()

    // Camera
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // Physics world bounds — bottom is OPEN so falling = death
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT, true, true, true, false)
    this.player.body.setCollideWorldBounds(false) // we handle left edge manually

    // Input
    this.cursors = this.input.keyboard.createCursorKeys()
    this.cursors.space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    // HUD
    this.createHUD()

    // Goal overlap (triggers riff battle)
    const goalZone = this.add.rectangle(GOAL_X, LEVEL_HEIGHT / 2, 80, LEVEL_HEIGHT, 0xffaa00, 0.08)
    this.physics.add.existing(goalZone, true)
    this.physics.add.overlap(this.player, goalZone, () => {
      if (!this.riffBattleActive && !this.levelComplete) this.triggerRiffBattle()
    })

    // Play BGM
    BGMManager.playLevelMusic(this, this.levelId)

    // Intro
    this.time.delayedCall(200, () => this.showBossIntro())
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKGROUND & DECORATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  createBackground() {
    // Base dark color
    this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, 0x090815)

    const g = this.add.graphics()

    // Ceiling beams (warehouse rafters)
    g.lineStyle(6, 0x111133, 0.6)
    for (let bx = 128; bx < LEVEL_WIDTH; bx += 384) {
      g.moveTo(bx, 0); g.lineTo(bx, 80); g.strokePath()
    }
    g.lineStyle(3, 0x0d0d22, 0.4)
    g.moveTo(0, 80); g.lineTo(LEVEL_WIDTH, 80); g.strokePath()

    // Stage boards texture (Act 1 only)
    g.lineStyle(1, 0x221100, 0.25)
    for (let bx = 128; bx < CROWD_START; bx += 24) {
      g.moveTo(bx, STAGE_Y); g.lineTo(bx, STAGE_Y + STAGE_H)
    }
    g.strokePath()

    // Crowd silhouettes (Act 2)
    const crowd = this.add.graphics()
    crowd.fillStyle(0x0d0d1a, 1)
    const rng = Phaser.Math.Between
    for (let cx = CROWD_START; cx < RACE_START; cx += 24) {
      const h = 45 + Math.sin(cx * 0.06) * 12 + (cx % 96 === 0 ? 22 : 0)
      crowd.fillRect(cx, GROUND_Y - h, 18, h)
    }

    // Venue end-wall backdrop
    const venue = this.add.graphics()
    venue.fillStyle(0x0a0025, 0.9)
    venue.fillRect(GOAL_X - 80, 0, 250, LEVEL_HEIGHT)
    venue.lineStyle(4, 0x330066, 0.8)
    venue.strokeRect(GOAL_X - 80, 0, 250, LEVEL_HEIGHT)

    // Stage spotlights (faint triangles, Act 1)
    const spots = this.add.graphics()
    spots.fillStyle(0xffffcc, 0.025)
    ;[320, 640, 960].forEach(sx => {
      spots.fillTriangle(sx, 0, sx - 80, STAGE_Y, sx + 80, STAGE_Y)
    })
  }

  createDecorations() {
    const g = this.add.graphics()

    // ─ Act 1: Warehouse Stage ─────────────────────────────────────────────

    // "BATTLE OF THE BANDS" banner
    this.add.text(768, 50, "⚡  BATTLE OF THE BANDS  ⚡", {
      fontFamily: "RetroPixel", fontSize: "22px",
      color: "#ff4444", stroke: "#000000", strokeThickness: 4
    }).setOrigin(0.5)

    this.add.text(768, 80, "\"The Warehouse\" — Detroit, MI", {
      fontFamily: "RetroPixel", fontSize: "10px", color: "#555555"
    }).setOrigin(0.5)

    // Amplifier stacks (left of stage)
    for (let ai = 0; ai < 3; ai++) {
      const ax = 16 + ai * 36
      g.fillStyle(0x1a1a1a, 1); g.fillRect(ax, 368, 32, 80)
      g.fillStyle(0x333333, 1); g.fillCircle(ax + 16, 408, 10)
      g.lineStyle(1, 0x555555, 0.5); g.strokeCircle(ax + 16, 408, 10)
    }

    // Amplifier stacks (right of stage)
    for (let ai = 0; ai < 3; ai++) {
      const ax = 1424 + ai * 36
      g.fillStyle(0x1a1a1a, 1); g.fillRect(ax, 368, 32, 80)
      g.fillStyle(0x333333, 1); g.fillCircle(ax + 16, 408, 10)
      g.lineStyle(1, 0x555555, 0.5); g.strokeCircle(ax + 16, 408, 10)
    }

    // Hanging cables on stage walls (decorative)
    g.lineStyle(3, 0x665500, 0.5)
    g.moveTo(128, 300); g.bezierCurveTo(200, 420, 310, 440, 320, STAGE_Y); g.strokePath()
    g.lineStyle(3, 0x443300, 0.5)
    g.moveTo(128, 340); g.bezierCurveTo(250, 430, 300, 445, 320, STAGE_Y); g.strokePath()

    // ─ Act 2: Crowd throws bottles sign ──────────────────────────────────
    this.add.text(CROWD_START + 200, 60, "🍺 CROWD AREA — WATCH OUT!", {
      fontFamily: "RetroPixel", fontSize: "12px",
      color: "#44aa44", stroke: "#000000", strokeThickness: 2
    })

    // ─ Venue end-sign ────────────────────────────────────────────────────
    this.add.text(GOAL_X + 40, 120, "🎸\nSHOWTIME!", {
      fontFamily: "RetroPixel", fontSize: "20px",
      color: "#ffaa00", stroke: "#000000", strokeThickness: 3,
      align: "center", lineSpacing: 4
    }).setOrigin(0.5)

    // Venue entrance pillars
    g.fillStyle(0x1a0033, 0.95)
    g.fillRect(GOAL_X - 20, 250, 18, 330)
    g.fillRect(GOAL_X + 90, 250, 18, 330)
    g.fillRect(GOAL_X - 20, 240, 128, 18)
    g.lineStyle(2, 0x6600cc, 0.7)
    g.strokeRect(GOAL_X - 20, 240, 128, 340)

    // Finish line dashes on ground
    g.lineStyle(4, 0xffaa00, 0.5)
    for (let dy = 0; dy < LEVEL_HEIGHT; dy += 24) {
      g.moveTo(GOAL_X, dy); g.lineTo(GOAL_X, dy + 12)
    }
    g.strokePath()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLATFORMS
  // ═══════════════════════════════════════════════════════════════════════════

  createPlatforms() {
    this.solidGroup = this.physics.add.staticGroup()

    // ─ Full ground floor (y=GROUND_Y, the floor of the whole level) ────────
    this.addSolid(0, GROUND_Y, LEVEL_WIDTH, 64, 0x0d0d1a)

    // ─ Act 1: Elevated stage ──────────────────────────────────────────────
    // Entry stable section x=128..320
    this.addSolid(128, STAGE_Y, 192, STAGE_H, 0x3b2200)
    // (Collapsing tiles fill x=320..1024 — added separately)
    // Exit stable section x=1024..1408
    this.addSolid(1024, STAGE_Y, 384, STAGE_H, 0x3b2200)

    // Stage ramp (step down from stage to ground)
    this.addSolid(1408, STAGE_Y + STAGE_H, 64, 16, 0x2b1800)
    this.addSolid(1472, GROUND_Y - 60, 64, 16, 0x2b1800)

    // ─ Act 2: Crowd area stepping stones ─────────────────────────────────
    this.addSolid(1660, 520, 96, 16, 0x1a2233)
    this.addSolid(1860, 504, 96, 16, 0x1a2233)
    this.addSolid(2080, 488, 80, 16, 0x1a2233)
    this.addSolid(2320, 508, 96, 16, 0x1a2233)
    this.addSolid(2560, 524, 80, 16, 0x1a2233)

    // ─ Act 3: Race to venue – mostly open ground, a couple hurdles ───────
    this.addSolid(3100, 528, 80, 16, 0x1a1a33)
    this.addSolid(3400, 512, 80, 16, 0x1a1a33)
    this.addSolid(3680, 528, 80, 16, 0x1a1a33)
  }

  addSolid(x, y, w, h, color = 0x222233) {
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, color)
    rect.setStrokeStyle(1, Phaser.Display.Color.ValueToColor(color).brighten(20).color, 0.3)
    this.physics.add.existing(rect, true)
    this.solidGroup.add(rect)
    return rect
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLAPSING TILES
  // ═══════════════════════════════════════════════════════════════════════════

  createCollapsingTiles() {
    this.collapsingGroup = this.physics.add.staticGroup()

    // Tiles on stage from x=320 to x=1024 (11 tiles × 64px wide)
    for (let tx = 320; tx < 1024; tx += TILE_W) {
      const tile = this.add.rectangle(
        tx + TILE_W / 2,
        STAGE_Y + STAGE_H / 2,
        TILE_W - 2,      // 2px gap between tiles for the planks-about-to-break look
        STAGE_H,
        0x4a2800
      )
      tile.setStrokeStyle(1, 0x7a4800, 0.6)
      tile.collapseState = "solid"   // "solid" | "shaking" | "fallen"
      this.physics.add.existing(tile, true)
      this.collapsingGroup.add(tile)
      this.collapsingTiles.push(tile)

      // Wood-grain lines (static graphics, decorative)
      const grain = this.add.graphics()
      grain.lineStyle(1, 0x2a1800, 0.4)
      for (let gx = tx + 10; gx < tx + TILE_W; gx += 16) {
        grain.moveTo(gx, STAGE_Y); grain.lineTo(gx, STAGE_Y + STAGE_H)
      }
      grain.strokePath()
      tile.grainGraphic = grain
    }
  }

  // Called every frame while player overlaps a collapsing tile
  onCollapsingCollide(player, tile) {
    if (tile.collapseState !== "solid") return
    // Only trigger if player is landing ON TOP (not clipping from side)
    if (!player.body.blocked.down) return

    tile.collapseState = "shaking"

    // Flash warning: orange → yellow → red → FALL
    let flashCount = 0
    const flashColors = [0xff8800, 0x4a2800, 0xff4400, 0x4a2800, 0xff0000]
    const flash = this.time.addEvent({
      delay: 120,
      repeat: flashColors.length - 1,
      callback: () => {
        tile.setFillStyle(flashColors[flashCount % flashColors.length])
        flashCount++
      }
    })

    // After 1 second: FALL
    this.time.delayedCall(900, () => {
      if (tile.collapseState === "shaking") {
        flash.destroy()
        this.dropTile(tile)
      }
    })
  }

  dropTile(tile) {
    tile.collapseState = "fallen"
    // Disable physics collision immediately
    this.collapsingGroup.remove(tile)
    if (tile.grainGraphic) tile.grainGraphic.setAlpha(0)

    // Visual fall + shatter effect
    this.tweens.add({
      targets: tile,
      y: LEVEL_HEIGHT + 200,
      angle: Phaser.Math.Between(-20, 20),
      alpha: 0,
      duration: 700,
      ease: "Power2",
      onComplete: () => tile.destroy()
    })

    // Dust puff where tile was
    const dust = this.add.graphics()
    dust.fillStyle(0x8b6022, 0.4)
    dust.fillEllipse(tile.x, STAGE_Y + STAGE_H, 80, 16)
    this.tweens.add({ targets: dust, alpha: 0, y: dust.y - 20, duration: 400, onComplete: () => dust.destroy() })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CABLE TRIP ZONES
  // ═══════════════════════════════════════════════════════════════════════════

  createCables() {
    const cableData = [
      { x: 1056, y: STAGE_Y + STAGE_H - 8 }, // On stage exit
      { x: 1680, y: GROUND_Y - 8 },           // Crowd area
      { x: 2200, y: GROUND_Y - 8 },
      { x: 2900, y: GROUND_Y - 8 },           // Race section
      { x: 3450, y: GROUND_Y - 8 },
    ]

    cableData.forEach(cd => {
      // Decorative cable squiggle
      const g = this.add.graphics()
      g.lineStyle(3, 0xaa7700, 0.85)
      g.beginPath()
      g.moveTo(cd.x - 44, cd.y)
      g.bezierCurveTo(cd.x - 22, cd.y - 18, cd.x + 22, cd.y - 18, cd.x + 44, cd.y)
      g.bezierCurveTo(cd.x + 22, cd.y + 14, cd.x - 22, cd.y + 14, cd.x - 44, cd.y + 6)
      g.strokePath()
      // Second loop
      g.lineStyle(2, 0x775500, 0.5)
      g.beginPath()
      g.moveTo(cd.x - 30, cd.y - 4)
      g.bezierCurveTo(cd.x, cd.y - 26, cd.x + 30, cd.y - 4, cd.x + 30, cd.y + 8)
      g.strokePath()

      // Invisible trigger zone
      const trigger = this.add.rectangle(cd.x, cd.y - 8, 88, 30, 0xffff00, 0)
      this.physics.add.existing(trigger, true)

      const cable = { trigger, graphic: g, pos: cd, tripped: false, cooldown: 0 }
      this.cables.push(cable)

      this.physics.add.overlap(this.player, trigger, () => {
        if (!cable.tripped) this.triggerCableTrip(cable)
      })
    })
  }

  triggerCableTrip(cable) {
    cable.tripped = true
    cable.cooldown = 2000

    // Speed penalty: 50% for 1.2 seconds
    const origWalk = this.player.walkSpeed
    const origRun  = this.player.runSpeed
    this.player.walkSpeed *= 0.5
    this.player.runSpeed  *= 0.5
    this.player.setTint(0xbbaa44)

    // Struggle wobble
    this.tweens.add({ targets: this.player, angle: 8, duration: 100, yoyo: true, repeat: 5,
      onComplete: () => this.player.angle = 0 })

    this.showWorldText("TANGLED IN CABLES!", this.player.x, this.player.y - 50, "#ffaa00")

    this.time.delayedCall(1200, () => {
      this.player.walkSpeed = origWalk
      this.player.runSpeed  = origRun
      this.player.clearTint()
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RIVAL BAND
  // ═══════════════════════════════════════════════════════════════════════════

  createRivalBand() {
    this.rival = {
      x: -260,
      y: GROUND_Y - 8,
      speed: RIVAL_BASE_SPEED
    }
    // Graphics object for drawing the 3-punk-silhouette chaser
    this.rivalGfx = this.add.graphics().setDepth(8)
  }

  updateRivalBand(delta) {
    if (!this.rivalBandStarted || !this.raceStarted || this.levelComplete) return

    const playerVX = Math.abs(this.player.body?.velocity?.x || 0)

    // Speed up when player barely moves, ease off when player sprints
    let chaseSpeed = this.rival.speed
    if (playerVX < 60)  chaseSpeed *= 1.45
    if (playerVX > 260) chaseSpeed *= 0.82

    this.rival.x += chaseSpeed * (delta / 1000)

    // Draw rival band
    this.rivalGfx.clear()
    const memberOffsets = [-44, 0, 44]
    memberOffsets.forEach((off, i) => {
      const mx = this.rival.x + off
      const my = this.rival.y
      const col = i === 0 ? 0xff3333 : 0xcc2222

      // Body
      this.rivalGfx.fillStyle(col, 0.92)
      this.rivalGfx.fillRect(mx - 11, my - 44, 22, 30)
      // Head
      this.rivalGfx.fillCircle(mx, my - 54, 10)
      // Mohawk
      this.rivalGfx.fillStyle(0xff6600, 0.9)
      this.rivalGfx.fillTriangle(mx - 3, my - 64, mx, my - 80, mx + 3, my - 64)
      // Running legs (phase offset)
      const legPhase = (Date.now() * 0.02 + i * 2) % (Math.PI * 2)
      this.rivalGfx.fillStyle(col, 0.92)
      this.rivalGfx.fillRect(mx - 10, my - 14, 8, 18 + Math.sin(legPhase) * 5)
      this.rivalGfx.fillRect(mx + 2,  my - 14, 8, 18 + Math.cos(legPhase) * 5)
      // Instrument arm
      this.rivalGfx.fillRect(mx + 10, my - 40, 22, 5)
    })

    // Dust cloud behind rival band
    this.rivalGfx.fillStyle(0x555566, 0.12)
    this.rivalGfx.fillEllipse(this.rival.x - 80, this.rival.y - 6, 120, 22)

    // Check caught condition
    const gap = this.player.x - this.rival.x
    if (gap < -10) {
      this.playerCaught()
      return
    }

    // Update chase meter HUD
    const safeDist = 450
    const meterW = Math.max(2, Math.min(280, (gap / safeDist) * 280))
    this.chaseFill.width = meterW
    this.chaseFill.setFillStyle(gap < 100 ? 0xff2222 : gap < 220 ? 0xff8800 : 0x44ee44)

    // Danger flash when very close
    if (gap < 140) {
      this.dangerLabel.setAlpha(Math.min(1, (140 - gap) / 100))
      if (gap < 60 && !this._shakeCooldown) {
        this.cameras.main.shake(80, 0.004)
        this._shakeCooldown = true
        this.time.delayedCall(200, () => { this._shakeCooldown = false })
      }
    } else {
      this.dangerLabel.setAlpha(0)
    }

    this.updatePosters()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POSTER SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  createPosters() {
    const positions = [450, 850, 1340, 1820, 2350, 2950, 3600]
    positions.forEach((px, i) => {
      const ph = 72, pw = 48
      const py = px < CROWD_START ? STAGE_Y - ph / 2 - 8 : GROUND_Y - ph / 2 - 10
      const bg = this.add.rectangle(px, py, pw, ph, 0x05004a, 0.75).setStrokeStyle(1, 0x2222aa, 0.5)
      const label = this.add.text(px, py, "TDC\nLIVE\nTONIGHT", {
        fontFamily: "RetroPixel", fontSize: "7px", color: "#5555ff", align: "center", lineSpacing: 2
      }).setOrigin(0.5)
      this.posterSpots.push({ bg, label, x: px, placed: false, torn: false })
    })
  }

  updatePosters() {
    let keptCount = 0
    this.posterSpots.forEach(spot => {
      if (!spot.placed && this.player.x > spot.x) {
        spot.placed = true
        spot.bg.setFillStyle(0x0000cc, 0.9)
        spot.label.setColor("#aaaaff")
        this.showWorldText("POSTER UP!", spot.x, spot.bg.y - 30, "#4444ff")
      }
      if (spot.placed && !spot.torn && this.rival.x > spot.x) {
        spot.torn = true
        spot.bg.setFillStyle(0x440000, 0.4)
        spot.label.setText("TORN\nDOWN!")
        spot.label.setColor("#ff3333")
        this.tweens.add({ targets: [spot.bg, spot.label], angle: Phaser.Math.Between(-25, 25), alpha: 0.3, duration: 250 })
        this.showWorldText("THEY TORE IT DOWN!", spot.x, spot.bg.y - 30, "#ff4444")
      }
      if (spot.placed && !spot.torn) keptCount++
    })
    this.posterLabel.setText(`POSTERS: ${keptCount}/7`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTTLE HAZARDS (Act 2 – crowd area)
  // ═══════════════════════════════════════════════════════════════════════════

  spawnBottle() {
    if (!this.raceStarted || this.levelComplete) return
    const px = this.player.x
    if (px < CROWD_START || px > RACE_START) return

    const camX  = this.cameras.main.scrollX
    const camW  = this.cameras.main.width
    const spawnX = Phaser.Math.Between(camX + 80, camX + camW - 80)
    const targetX = px + Phaser.Math.Between(-70, 70)
    const startY  = GROUND_Y + 30

    // Draw bottle (graphics)
    const g = this.add.graphics()
    g.fillStyle(0x336622, 0.92)
    g.fillRect(-4, -18, 8, 18)
    g.fillRect(-3, -22, 6, 6)
    g.fillStyle(0x66bb44, 0.4)
    g.fillRect(-3, -19, 3, 10)
    g.setPosition(spawnX, startY)
    g.setDepth(12)

    const arc = targetX > spawnX ? -90 : 90
    const midX = (spawnX + targetX) / 2
    const midY = GROUND_Y - 140

    this.tweens.add({
      targets: g, x: midX, y: midY, angle: arc,
      duration: 380, ease: "Sine.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: g, x: targetX, y: GROUND_Y - 20, angle: arc * 2,
          duration: 380, ease: "Sine.easeIn",
          onComplete: () => {
            // Smash
            const smash = this.add.graphics()
            smash.fillStyle(0x44aa33, 0.45)
            smash.fillEllipse(targetX, GROUND_Y - 10, 36, 14)
            this.time.delayedCall(350, () => smash.destroy())
            g.destroy()
            const idx = this.activeBottles.indexOf(g)
            if (idx > -1) this.activeBottles.splice(idx, 1)
          }
        })
      }
    })
    this.activeBottles.push(g)

    // Hit detection polling while bottle is in flight
    let checks = 0
    const hitCheck = this.time.addEvent({
      delay: 30, repeat: 25,
      callback: () => {
        checks++
        if (!g.active) { hitCheck.destroy(); return }
        const d = Phaser.Math.Distance.Between(g.x, g.y, this.player.x, this.player.y)
        if (d < 32 && !this.player.bottleStunned) {
          this.bottleHit()
          g.destroy()
          hitCheck.destroy()
        }
      }
    })
  }

  bottleHit() {
    if (this.player.bottleStunned) return
    this.player.bottleStunned = true
    this.player.setTint(0x44aa44)
    this.showWorldText("BOTTLE HIT! OW!", this.player.x, this.player.y - 55, "#44ff88")
    this.cameras.main.shake(200, 0.006)
    const dir = this.player.facingDirection === "right" ? -1 : 1
    this.player.body.setVelocity(dir * 250, -180)
    this.time.delayedCall(700, () => {
      this.player.clearTint()
      this.player.bottleStunned = false
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HUD
  // ═══════════════════════════════════════════════════════════════════════════

  createHUD() {
    const sw = this.cameras.main.width

    // Chase meter background bar
    this.add.rectangle(sw / 2, 18, 300, 14, 0x220000, 0.75)
      .setScrollFactor(0).setDepth(50).setOrigin(0.5)

    // Chase meter fill (origin left)
    this.chaseFill = this.add.rectangle(sw / 2 - 149, 18, 2, 10, 0x44ee44, 1)
      .setScrollFactor(0).setDepth(51).setOrigin(0, 0.5)

    // Labels
    this.add.text(sw / 2 - 149, 8, "RIVAL BAND ►", {
      fontFamily: "RetroPixel", fontSize: "8px", color: "#ff4444"
    }).setScrollFactor(0).setDepth(51)

    this.add.text(sw / 2 + 5, 8, "YOU", {
      fontFamily: "RetroPixel", fontSize: "8px", color: "#44ff44"
    }).setScrollFactor(0).setDepth(51)

    // Poster counter
    this.posterLabel = this.add.text(10, 30, "POSTERS: 0/7", {
      fontFamily: "RetroPixel", fontSize: "9px", color: "#5555ff",
      stroke: "#000", strokeThickness: 1
    }).setScrollFactor(0).setDepth(51)

    // Act label
    this.actLabel = this.add.text(sw / 2, 36, "ACT 1 — WAREHOUSE STAGE", {
      fontFamily: "RetroPixel", fontSize: "9px", color: "#888888"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51)

    // DANGER indicator (hidden until rival is close)
    this.dangerLabel = this.add.text(sw / 2, this.cameras.main.height / 2, "⚠  RIVAL BAND CLOSING IN!  ⚠", {
      fontFamily: "RetroPixel", fontSize: "15px",
      color: "#ff2222", stroke: "#000", strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setAlpha(0)
  }

  updateActLabel() {
    const px = this.player.x
    if (px < CROWD_START)   this.actLabel?.setText("ACT 1 — WAREHOUSE STAGE")
    else if (px < RACE_START) this.actLabel?.setText("ACT 2 — CROWD AREA")
    else                    this.actLabel?.setText("ACT 3 — RACE TO THE VENUE")
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTRO & COUNTDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  showBossIntro() {
    const { width, height } = this.cameras.main
    const bossData = BOSS_DATA[1]

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92)
      .setScrollFactor(0).setDepth(100)

    const worldLabel = this.add.text(width / 2, height / 2 - 120, "WORLD 1 — BOSS BATTLE", {
      fontFamily: "RetroPixel", fontSize: "13px", color: "#ff4444"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    const nameText = this.add.text(width / 2, height / 2 - 88, bossData.name.toUpperCase(), {
      fontFamily: "RetroPixel", fontSize: "30px", color: "#ff6600",
      stroke: "#000", strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    const subText = this.add.text(width / 2, height / 2 - 50, `"${bossData.subtitle}"`, {
      fontFamily: "RetroPixel", fontSize: "16px", color: "#ff69b4"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    const storyText = this.add.text(width / 2, height / 2, [
      "A no-show just opened the LAST SLOT at the Battle of the Bands.",
      "Teddy's band has a chance — but The Copycats found out too.",
      "",
      "Race across the collapsing stage, dodge the rowdy crowd,",
      "and reach the venue before they do.",
      "",
      "Then prove who really rocks in the GUITAR RIFF-OFF!"
    ].join("\n"), {
      fontFamily: "RetroPixel", fontSize: "10px", color: "#cccccc",
      align: "center", lineSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    const skipHint = this.add.text(width / 2, height - 28, "Press any key to start the race!", {
      fontFamily: "RetroPixel", fontSize: "10px", color: "#555555"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    this.tweens.add({ targets: skipHint, alpha: 0.2, duration: 550, yoyo: true, repeat: -1 })

    const elements = [overlay, worldLabel, nameText, subText, storyText, skipHint]

    const dismiss = () => {
      elements.forEach(e => e.destroy())
      this.rivalBandStarted = true
      this.showCountdown()
    }

    this.time.delayedCall(5500, dismiss)
    this.input.keyboard.once("keydown", dismiss)
    this.input.once("pointerdown", dismiss)
  }

  showCountdown() {
    const { width, height } = this.cameras.main
    let count = 3

    const txt = this.add.text(width / 2, height / 2, "3", {
      fontFamily: "RetroPixel", fontSize: "80px",
      color: "#ff4444", stroke: "#000", strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100)

    const tick = () => {
      this.tweens.add({
        targets: txt, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 750,
        onComplete: () => {
          count--
          if (count > 0) {
            txt.setText(`${count}`).setAlpha(1).setScale(1)
            txt.setColor(count === 2 ? "#ffaa00" : "#00ff88")
            this.time.delayedCall(280, tick)
          } else {
            txt.setText("GO!").setColor("#00ff88").setAlpha(1).setScale(1)
            this.time.delayedCall(700, () => { txt.destroy(); this.raceStarted = true })
          }
        }
      })
    }
    this.time.delayedCall(280, tick)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEATH
  // ═══════════════════════════════════════════════════════════════════════════

  playerCaught() {
    if (this.isProcessingDeath) return
    this.isProcessingDeath = true
    this.deathCount++

    this.cameras.main.shake(500, 0.012)
    const { width, height } = this.cameras.main

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0xff0000, 0.35)
      .setScrollFactor(0).setDepth(90)
    const msg = this.add.text(width / 2, height / 2 - 20, "CAUGHT BY THE RIVAL BAND!", {
      fontFamily: "RetroPixel", fontSize: "20px",
      color: "#ffffff", stroke: "#000", strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(91)
    this.add.text(width / 2, height / 2 + 20, "Restarting the race...", {
      fontFamily: "RetroPixel", fontSize: "12px", color: "#ffaaaa"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(91)

    this.time.delayedCall(1800, () => this.scene.restart({ levelId: this.levelId }))
  }

  playerFell() {
    if (this.isProcessingDeath) return
    this.isProcessingDeath = true
    this.deathCount++
    this.cameras.main.shake(300, 0.008)
    this.time.delayedCall(600, () => this.scene.restart({ levelId: this.levelId }))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GUITAR RIFF BATTLE (end-of-level minigame)
  // ═══════════════════════════════════════════════════════════════════════════

  triggerRiffBattle() {
    if (this.riffBattleActive) return
    this.riffBattleActive = true
    this.rivalBandStarted = false // Stop the rival

    this.player.body.setVelocity(0, 0)
    const { width, height } = this.cameras.main

    // "You made it!" cutscene
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.88)
      .setScrollFactor(0).setDepth(100)

    const makeText = (txt, y, size, col) =>
      this.add.text(width / 2, y, txt, {
        fontFamily: "RetroPixel", fontSize: `${size}px`, color: col,
        stroke: "#000", strokeThickness: 2, align: "center"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    const t1 = makeText("YOU MADE IT TO THE SHOW!", height / 2 - 80, 22, "#ffaa00")
    const t2 = makeText("The Copycats arrive seconds later...", height / 2 - 40, 13, "#ff4444")
    const t3 = makeText("They DEMAND a Guitar Riff-Off for the slot!", height / 2, 13, "#ffffff")
    const t4 = makeText("⚡ Get ready to SHRED! ⚡", height / 2 + 40, 16, "#ff69b4")

    this.cameras.main.flash(600, 255, 170, 0, false)

    this.time.delayedCall(3200, () => {
      ;[overlay, t1, t2, t3, t4].forEach(e => e.destroy())
      this.beginRiffBattle()
    })
  }

  beginRiffBattle() {
    const { width, height } = this.cameras.main

    this.riffIndex    = 0
    this.riffMistakes = 0
    this.maxMistakes  = 2

    // Background overlay
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.93)
      .setScrollFactor(0).setDepth(100)

    const title = this.add.text(width / 2, 45, "⚡  GUITAR RIFF-OFF  ⚡", {
      fontFamily: "RetroPixel", fontSize: "22px", color: "#ff4444"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    const subtitle = this.add.text(width / 2, 72, `Match the notes! You have ${this.maxMistakes} mistake(s).`, {
      fontFamily: "RetroPixel", fontSize: "10px", color: "#666666"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    // Prompt (current note)
    this.riffPrompt = this.add.text(width / 2, height / 2 - 20, "", {
      fontFamily: "RetroPixel", fontSize: "64px", color: "#ffaa00"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102)

    this.riffKeyLabel = this.add.text(width / 2, height / 2 + 55, "", {
      fontFamily: "RetroPixel", fontSize: "13px", color: "#aaaaaa"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102)

    // Mistake hearts
    this.heartIcons = []
    for (let i = 0; i < this.maxMistakes; i++) {
      this.heartIcons.push(
        this.add.text(width / 2 - 24 + i * 44, height - 56, "♥", {
          fontFamily: "RetroPixel", fontSize: "22px", color: "#ff4444"
        }).setScrollFactor(0).setDepth(101)
      )
    }

    // Progress dots
    const dotW = RIFF_SEQUENCE.length * 30
    this.riffDots = RIFF_SEQUENCE.map((_, i) =>
      this.add.circle(
        width / 2 - dotW / 2 + i * 30 + 15,
        height - 28, 8, 0x333333
      ).setScrollFactor(0).setDepth(101)
    )

    this.riffElements = [bg, title, subtitle, this.riffPrompt, this.riffKeyLabel, ...this.heartIcons, ...this.riffDots]

    this.showNextNote()
  }

  showNextNote() {
    if (this.riffIndex >= RIFF_SEQUENCE.length) { this.riffVictory(); return }

    const note = RIFF_SEQUENCE[this.riffIndex]
    this.riffPrompt.setText(note.label).setColor(note.color).setAlpha(1).setScale(1)

    const keyHint = note.key === "LEFT" ? "← or A" : note.key === "RIGHT" ? "→ or D" :
      note.key === "UP" ? "↑ or W" : "SPACE or Z"
    this.riffKeyLabel.setText(`Press  [ ${keyHint} ]`)

    this.tweens.killTweensOf(this.riffPrompt)
    this.tweens.add({ targets: this.riffPrompt, scaleX: 1.15, scaleY: 1.15, duration: 280, yoyo: true, repeat: -1 })

    this.riffDots[this.riffIndex]?.setFillStyle(0xffaa00)

    // Listen for ONE keydown
    if (this._riffHandler) this.input.keyboard.off("keydown", this._riffHandler)
    this._riffHandler = (event) => {
      const note = RIFF_SEQUENCE[this.riffIndex]
      const correct = note.codes.includes(event.keyCode)

      this.tweens.killTweensOf(this.riffPrompt)

      if (correct) {
        // Hit!
        this.riffPrompt.setColor("#ffffff").setScale(1.6)
        this.riffDots[this.riffIndex]?.setFillStyle(0x00ff88)
        this.cameras.main.flash(120, 255, 255, 100, false)
        this.input.keyboard.off("keydown", this._riffHandler)
        this.riffIndex++
        this.time.delayedCall(350, () => this.showNextNote())
      } else if (event.keyCode > 31) {
        // Wrong!
        this.riffMistakes++
        this.riffPrompt.setColor("#ff0000")
        this.cameras.main.shake(220, 0.012)
        if (this.heartIcons[this.riffMistakes - 1]) {
          this.heartIcons[this.riffMistakes - 1].setColor("#333333")
        }
        if (this.riffMistakes > this.maxMistakes) {
          this.input.keyboard.off("keydown", this._riffHandler)
          this.riffDefeat()
        } else {
          // Reset to start of sequence
          this.riffIndex = 0
          this.riffDots.forEach(d => d.setFillStyle(0x333333))
          this.time.delayedCall(500, () => this.showNextNote())
        }
      }
    }
    this.input.keyboard.on("keydown", this._riffHandler)
  }

  riffVictory() {
    if (this._riffHandler) this.input.keyboard.off("keydown", this._riffHandler)
    this.riffElements.forEach(e => e?.destroy())

    const { width, height } = this.cameras.main
    this.cameras.main.flash(1200, 255, 160, 0, false)

    const makeText = (txt, y, size, col) =>
      this.add.text(width / 2, y, txt, {
        fontFamily: "RetroPixel", fontSize: `${size}px`, color: col,
        stroke: "#000", strokeThickness: 2, align: "center"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    makeText("🎸  RIFF-OFF WON!  🎸", height / 2 - 70, 28, "#ffaa00")
    makeText("TEDDY & THE BAND HEADLINE THE SHOW!", height / 2 - 25, 15, "#ff69b4")
    makeText("The Rival Garage Band slinks away in defeat.", height / 2 + 20, 11, "#888888")
    makeText("WORLD 1 BOSS — CLEARED", height / 2 + 60, 13, "#00ff88")

    this.levelComplete = true
    this.time.delayedCall(3500, () => {
      WorldManager.completeLevel(this.levelId)
      this.scene.start("World1PostBossScene", { worldNum: 1 })
    })
  }

  riffDefeat() {
    this.riffElements.forEach(e => e?.destroy())
    const { width, height } = this.cameras.main

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x440000, 0.9)
      .setScrollFactor(0).setDepth(100)
    const msg = this.add.text(width / 2, height / 2, "RIFF-OFF LOST!\nThe crowd boos...\n\nRetrying...", {
      fontFamily: "RetroPixel", fontSize: "18px", color: "#ff4444",
      align: "center", lineSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)

    this.time.delayedCall(2200, () => {
      overlay.destroy(); msg.destroy()
      this.riffBattleActive = false
      this.riffIndex = 0
      this.riffMistakes = 0
      this.beginRiffBattle()
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  // Floating world-space text (follows the level camera)
  showWorldText(msg, x, y, color = "#ffaa00") {
    const txt = this.add.text(x, y, msg, {
      fontFamily: "RetroPixel", fontSize: "12px",
      color, stroke: "#000", strokeThickness: 2
    }).setOrigin(0.5).setDepth(70)

    this.tweens.add({ targets: txt, y: y - 44, alpha: 0, duration: 1400, ease: "Power1",
      onComplete: () => txt.destroy() })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════════════════

  update(time, delta) {
    if (this.levelComplete || this.riffBattleActive) return
    if (!this.player || this.isProcessingDeath) return

    // Player controls (only when race has started)
    if (this.raceStarted) {
      const controls = getMergedControls(this.cursors, this.registry)
      this.player.update(controls, time, delta)
    }

    // Keep player from backing into the rival band
    if (this.player.x < 64) this.player.setX(64)

    // Fall-off check
    if (this.player.y > LEVEL_HEIGHT + 80) {
      this.playerFell()
      return
    }

    // Rival band chase
    this.updateRivalBand(delta)

    // Bottle hazards (crowd area only)
    if (this.raceStarted) {
      this.bottleTimer += delta
      if (this.bottleTimer >= this.bottleInterval) {
        this.bottleTimer = 0
        this.spawnBottle()
      }
    }

    // Cable cooldowns
    this.cables.forEach(cable => {
      if (cable.tripped) {
        cable.cooldown -= delta
        if (cable.cooldown <= 0) cable.tripped = false
      }
    })

    // Act label
    this.updateActLabel()
  }
}
