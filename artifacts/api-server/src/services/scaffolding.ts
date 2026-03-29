/**
 * GameForge Structured Generation Engine
 * 
 * Contains all base architecture templates for Structured and Hybrid generation modes.
 * When scaffolded into a project, these files provide a reusable primitive layer the
 * AI extends rather than reinventing from scratch on every build.
 */

import { writeFile } from "./filesystem.js";
import { existsSync } from "fs";
import { getProjectRoot } from "./filesystem.js";

// ─── Engine template files ─────────────────────────────────────────────────────

export const ENGINE_TEMPLATES: Record<string, string> = {

  // ── Core scenes ──────────────────────────────────────────────────────────────

  "engine/BaseScene.js": `/**
 * BaseScene — extend this for every non-level scene (menus, UI, transitions).
 * Override setupCamera() to customise the camera background/effects.
 */
export default class BaseScene extends Phaser.Scene {

  constructor(key) {
    super(key);
  }

  create() {
    this.setupCamera();
  }

  /** Override to customise camera settings, background colour, or post-fx. */
  setupCamera() {
    this.cameras.main.setBackgroundColor("#1a1a2e");
  }

}
`,

  "engine/BaseLevelScene.js": `import BaseScene from "./BaseScene.js";

/**
 * BaseLevelScene — extend this for every gameplay level.
 * Implements the standard flow: map → player → enemies → collisions → camera → win condition.
 *
 * Override:
 *   createMap()         — add tilemaps, platforms, decorations
 *   createPlayer()      — spawn the player entity
 *   createEnemies()     — spawn enemy entities
 *   setupCollisions()   — set up physics overlaps/colliders
 *   setupWinCondition() — define when/how the player wins
 */
export default class BaseLevelScene extends BaseScene {

  constructor(key) {
    super(key);
    this.player  = null;
    this.enemies = null;
  }

  create() {
    super.create();
    this.createMap();
    this.createPlayer();
    this.createEnemies();
    this.setupCollisions();
    this.setupCameraFollow();
    this.setupWinCondition();

    // Launch the shared UI overlay
    this.scene.launch("UIScene", { gameScene: this });
  }

  /** Override — build the level geometry, tilemap, platforms, background. */
  createMap() {}

  /** Override — instantiate and position the player entity. */
  createPlayer() {}

  /** Override — spawn enemies or set up a spawn system. */
  createEnemies() {}

  /** Override — register physics overlaps and colliders. */
  setupCollisions() {}

  /** Called automatically after createPlayer(). Override if camera needs tuning. */
  setupCameraFollow() {
    if (this.player) {
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setZoom(1);
    }
  }

  /** Override — implement the player-wins moment (reach goal, kill all enemies, etc.). */
  setupWinCondition() {}

  /** Called from subclasses when the player wins. */
  winLevel() {
    this.scene.stop("UIScene");
    this.scene.start("VictoryScene");
  }

  /** Called from subclasses when the player loses. */
  loseLevel() {
    this.scene.stop("UIScene");
    this.scene.start("GameOverScene");
  }

  update(time, delta) {
    if (this.player && this.player.update) this.player.update(time, delta);
    if (this.enemies) {
      this.enemies.getChildren().forEach(e => e.update && e.update(time, delta));
    }
  }

}
`,

  // ── Entity base classes ───────────────────────────────────────────────────────

  "engine/entities/BaseEntity.js": `/**
 * BaseEntity — the root of every interactive game object.
 * Extends Phaser.Physics.Arcade.Sprite and auto-registers with the scene.
 *
 * Override takeDamage(amount) to add hit reactions, invincibility frames, etc.
 * Override die() to add death animation, drops, or score events.
 */
export default class BaseEntity extends Phaser.Physics.Arcade.Sprite {

  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.health    = 100;
    this.maxHealth = 100;
  }

  /** Override to add hit flash, invincibility, or special logic. */
  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) this.die();
  }

  /** Override to add death effects, drops, or EventBus events. */
  die() {
    this.destroy();
  }

}
`,

  "engine/entities/BaseCharacter.js": `import BaseEntity from "./BaseEntity.js";

/**
 * BaseCharacter — a mobile entity with speed and an abilities map.
 * Extend this for any character that moves and has active abilities.
 *
 * abilities map schema:
 *   { primaryAttack: { damage: 10, cooldown: 400, animation: 'attack' } }
 */
export default class BaseCharacter extends BaseEntity {

  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    this.speed    = 200;
    this.abilities = {};
    this._abilityCooldowns = {};
  }

  /**
   * Trigger an ability by name. Respects cooldown automatically.
   * Override to add special logic per ability.
   */
  useAbility(name) {
    const ability = this.abilities[name];
    if (!ability) return false;
    const now = this.scene.time.now;
    if ((this._abilityCooldowns[name] || 0) > now) return false;
    this._abilityCooldowns[name] = now + (ability.cooldown || 0);
    return true;
  }

  /** Override in every subclass — called once per frame by BaseLevelScene. */
  update(time, delta) {}

}
`,

  "engine/entities/BasePlayer.js": `import BaseCharacter from "./BaseCharacter.js";

/**
 * BasePlayer — keyboard-controlled player entity.
 *
 * Override update() to add jump, attacks, dashes, or any game-specific input.
 * Call super.update() to preserve horizontal movement, or skip it to replace entirely.
 */
export default class BasePlayer extends BaseCharacter {

  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd    = scene.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump:  Phaser.Input.Keyboard.KeyCodes.SPACE,
    });
    this.score = 0;
  }

  /** Override to add platformer jump, shoot, dash, etc. */
  update(time, delta) {
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    if (left)       this.setVelocityX(-this.speed);
    else if (right) this.setVelocityX(this.speed);
    else            this.setVelocityX(0);
  }

  addScore(points) {
    this.score += points;
    this.scene.events.emit("score:update", this.score);
  }

}
`,

  "engine/entities/BaseEnemy.js": `import BaseCharacter from "./BaseCharacter.js";

/**
 * BaseEnemy — a simple patrol-based enemy.
 * Override patrol() for custom movement.
 * Override update() to implement a full state machine (idle → chase → attack → dead).
 *
 * State machine template:
 *   this.state = 'patrol' | 'chase' | 'attack' | 'dead'
 */
export default class BaseEnemy extends BaseCharacter {

  constructor(scene, x, y, texture, config = {}) {
    super(scene, x, y, texture);
    this.speed       = config.speed   ?? 80;
    this.health      = config.health  ?? 60;
    this.maxHealth   = this.health;
    this.damage      = config.damage  ?? 10;
    this.state       = "patrol";
    this.patrolDir   = 1;
    this._patrolTimer = 0;
  }

  update(time, delta) {
    switch (this.state) {
      case "patrol": this.patrol(time, delta); break;
      case "chase":  this.chase(time, delta);  break;
      case "attack": this.attack(time, delta); break;
    }
  }

  /** Override — default side-to-side patrol. */
  patrol(time, delta) {
    this.setVelocityX(this.speed * this.patrolDir);
    this._patrolTimer += delta;
    if (this._patrolTimer > 2000) {
      this.patrolDir  *= -1;
      this._patrolTimer = 0;
      this.flipX = this.patrolDir < 0;
    }
  }

  /** Override — move toward a target. */
  chase(time, delta) {
    if (!this.target) return this.setState("patrol");
    const dx = this.target.x - this.x;
    this.setVelocityX(Math.sign(dx) * this.speed * 1.5);
    this.flipX = dx < 0;
  }

  /** Override — trigger an attack on the target. */
  attack(time, delta) {}

  setState(newState) {
    this.state = newState;
  }

  setTarget(entity) {
    this.target = entity;
  }

  die() {
    this.scene.events.emit("enemy:died", this);
    super.die();
  }

}
`,

  // ── Systems ───────────────────────────────────────────────────────────────────

  "engine/systems/CombatSystem.js": `/**
 * CombatSystem — static helper for applying damage between entities.
 * All damage in the game should flow through here for consistent logic.
 *
 * Extend: add knockback, status effects, or armour calculations here.
 */
export default class CombatSystem {

  static applyDamage(attacker, target, amount) {
    if (!target || !target.active) return;
    target.takeDamage(amount);
    target.setTint(0xff4444);
    attacker.scene?.time.delayedCall(120, () => {
      if (target.active) target.clearTint();
    });
  }

  static applyHeal(target, amount) {
    if (!target || !target.active) return;
    target.health = Math.min(target.maxHealth, target.health + amount);
    target.scene?.events.emit("health:update", target.health, target.maxHealth);
  }

}
`,

  "engine/systems/HealthSystem.js": `/**
 * HealthSystem — utility for querying and displaying entity health.
 * Add drain-over-time, regen, or health-bar rendering here.
 */
export default class HealthSystem {

  static isAlive(entity) {
    return entity && entity.health > 0 && entity.active;
  }

  static getPercent(entity) {
    if (!entity || entity.maxHealth <= 0) return 0;
    return Math.max(0, entity.health / entity.maxHealth);
  }

}
`,

  "engine/systems/PhysicsSystem.js": `/**
 * PhysicsSystem — static helpers for common physics operations.
 * Extend: add magnetism, conveyor belts, custom gravity zones, etc.
 */
export default class PhysicsSystem {

  /** Apply a directional knockback impulse to a physics body. */
  static knockback(entity, fromX, fromY, force = 300) {
    if (!entity || !entity.body) return;
    const angle = Phaser.Math.Angle.Between(fromX, fromY, entity.x, entity.y);
    entity.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
  }

  /** Instantly stop an entity's velocity. */
  static stop(entity) {
    if (entity?.body) entity.setVelocity(0, 0);
  }

}
`,

  "engine/systems/AnimationSystem.js": `/**
 * AnimationSystem — static helper for playing animations safely.
 * Extend: add blending, prioritisation, or frame callbacks here.
 */
export default class AnimationSystem {

  static play(entity, key, ignoreIfPlaying = true) {
    if (!entity?.anims) return;
    entity.anims.play(key, ignoreIfPlaying);
  }

  static playOnce(entity, key, onComplete) {
    if (!entity?.anims) return;
    entity.anims.play(key, true);
    if (onComplete) {
      entity.once("animationcomplete", onComplete);
    }
  }

}
`,

  "engine/systems/AudioSystem.js": `/**
 * AudioSystem — static wrapper for Phaser audio with safety guards.
 * Extend: add positional audio, duck-on-pause, or cross-fade here.
 */
export default class AudioSystem {

  static play(scene, key, config = {}) {
    if (!scene.cache.audio.exists(key)) return null;
    return scene.sound.play(key, config);
  }

  static playMusic(scene, key, volume = 0.5) {
    if (!scene.cache.audio.exists(key)) return null;
    if (scene._bgMusic?.isPlaying) return scene._bgMusic;
    scene._bgMusic = scene.sound.add(key, { loop: true, volume });
    scene._bgMusic.play();
    return scene._bgMusic;
  }

  static stopMusic(scene) {
    scene._bgMusic?.stop();
    scene._bgMusic = null;
  }

}
`,

  "engine/systems/CameraEffects.js": `/**
 * CameraEffects — static helpers for screen-feel effects.
 * Extend: add custom flash colours, zoom pulses, or letterbox.
 */
export default class CameraEffects {

  static shake(scene, duration = 120, intensity = 0.01) {
    scene.cameras.main.shake(duration, intensity);
  }

  static flash(scene, duration = 200, color = 0xffffff) {
    scene.cameras.main.flash(duration, (color >> 16) & 255, (color >> 8) & 255, color & 255);
  }

  static zoomPulse(scene, targetZoom = 1.1, duration = 150) {
    scene.tweens.add({
      targets: scene.cameras.main,
      zoom:    targetZoom,
      duration,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

}
`,

  "engine/systems/DamageNumberSystem.js": `/**
 * DamageNumberSystem — shows floating damage/heal numbers above entities.
 * Extend: add critical hit styling, colour coding, or stacking.
 */
export default class DamageNumberSystem {

  static show(scene, x, y, value, color = "#ff4444") {
    const text = scene.add.text(x, y, \`-\${value}\`, {
      fontSize: "18px",
      fontFamily: "monospace",
      color,
      stroke: "#000",
      strokeThickness: 3,
    }).setDepth(100).setOrigin(0.5);

    scene.tweens.add({
      targets:  text,
      y:        y - 40,
      alpha:    0,
      scaleX:   1.4,
      scaleY:   1.4,
      duration: 700,
      ease:     "Quad.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  static showHeal(scene, x, y, value) {
    DamageNumberSystem.show(scene, x, y, \`+\${value}\`, "#44ff88");
  }

}
`,

  // ── Standard scenes ───────────────────────────────────────────────────────────

  "scenes/LoadingScene.js": `import BaseScene from "../engine/BaseScene.js";

/**
 * LoadingScene — preloads all project assets with a styled loading bar.
 * Override preloadAssets() to add this game's assets.
 * Override getNextScene() to control which scene follows loading.
 */
export default class LoadingScene extends BaseScene {

  constructor() { super("LoadingScene"); }

  preload() {
    this._buildLoadingBar();
    this.preloadAssets();
  }

  /** Override — add this.load.image(), this.load.audio(), etc. */
  preloadAssets() {}

  /** Override — return the scene key to start after loading. Default: TitleScene */
  getNextScene() { return "TitleScene"; }

  create() {
    this.scene.start(this.getNextScene());
  }

  _buildLoadingBar() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    this.add.text(cx, cy - 60, "LOADING", {
      fontSize: "28px", fontFamily: "monospace",
      color: "#ffffff", stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);

    const bg  = this.add.rectangle(cx, cy, 400, 24, 0x333333).setOrigin(0.5);
    const bar = this.add.rectangle(cx - 200, cy, 0, 20, 0xff8c00).setOrigin(0, 0.5);

    this.load.on("progress", p => { bar.width = 400 * p; });
  }

}
`,

  "scenes/TitleScene.js": `import BaseScene from "../engine/BaseScene.js";

/**
 * TitleScene — title / main menu screen.
 * Override buildUI() to customise the title, logo, and menu items.
 */
export default class TitleScene extends BaseScene {

  constructor() { super("TitleScene"); }

  create() {
    super.create();
    this.buildUI();
    this.setupInput();
  }

  /** Override — draw the logo, title text, and menu buttons. */
  buildUI() {
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add.text(cx, height * 0.3, "GAMEFORGE", {
      fontSize: "48px", fontFamily: "monospace",
      color: "#ff8c00", stroke: "#000", strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, height * 0.5, "Press SPACE or click to Start", {
      fontSize: "20px", fontFamily: "monospace", color: "#cccccc",
    }).setOrigin(0.5);
  }

  setupInput() {
    this.input.keyboard.on("keydown-SPACE", () => this.startGame());
    this.input.once("pointerdown", () => this.startGame());
  }

  /** Override — transition to the first level. */
  startGame() {
    this.scene.start("GameScene");
  }

}
`,

  "scenes/UIScene.js": `/**
 * UIScene — persistent HUD overlay launched in parallel with level scenes.
 * Listens to game events (score, health, lives) and updates the display.
 * Extend: add minimap, ability cooldown indicators, wave counter, etc.
 */
export default class UIScene extends Phaser.Scene {

  constructor() { super({ key: "UIScene", active: false }); }

  init(data) {
    this.gameScene = data?.gameScene || null;
  }

  create() {
    const { width } = this.scale;

    // Score
    this.scoreText = this.add.text(16, 16, "SCORE: 0", {
      fontSize: "18px", fontFamily: "monospace",
      color: "#ffffff", stroke: "#000", strokeThickness: 3,
    }).setScrollFactor(0);

    // Health bar background
    this.add.rectangle(16, 50, 152, 18, 0x333333).setOrigin(0, 0.5).setScrollFactor(0);
    this.healthBar = this.add.rectangle(16, 50, 150, 14, 0x44ff88).setOrigin(0, 0.5).setScrollFactor(0);

    // Health label
    this.healthText = this.add.text(174, 50, "HP", {
      fontSize: "14px", fontFamily: "monospace", color: "#cccccc",
    }).setOrigin(0, 0.5).setScrollFactor(0);

    // Wire up game events
    const scene = this.gameScene || this.scene.get("GameScene");
    if (scene?.events) {
      scene.events.on("score:update",  score   => this.setScore(score),             this);
      scene.events.on("health:update", (hp, max) => this.setHealth(hp, max),         this);
    }
  }

  setScore(score) {
    this.scoreText.setText(\`SCORE: \${score}\`);
  }

  setHealth(hp, maxHp) {
    const pct = Math.max(0, hp / maxHp);
    this.healthBar.width = 150 * pct;
    this.healthBar.fillColor = pct > 0.5 ? 0x44ff88 : pct > 0.25 ? 0xffaa00 : 0xff4444;
  }

}
`,

  "scenes/GameOverScene.js": `import BaseScene from "../engine/BaseScene.js";

/**
 * GameOverScene — shown when the player loses.
 * Receives { score } from the level scene via this.scene.start('GameOverScene', { score }).
 */
export default class GameOverScene extends BaseScene {

  constructor() { super("GameOverScene"); }

  init(data) { this.finalScore = data?.score ?? 0; }

  create() {
    super.create();
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add.text(cx, height * 0.3, "GAME OVER", {
      fontSize: "52px", fontFamily: "monospace",
      color: "#ff4444", stroke: "#000", strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, height * 0.48, \`Score: \${this.finalScore}\`, {
      fontSize: "24px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(0.5);

    this.add.text(cx, height * 0.63, "Press SPACE to try again", {
      fontSize: "18px", fontFamily: "monospace", color: "#aaaaaa",
    }).setOrigin(0.5);

    this.input.keyboard.once("keydown-SPACE", () => this.scene.start("TitleScene"));
    this.input.once("pointerdown", () => this.scene.start("TitleScene"));
  }

}
`,

  "scenes/VictoryScene.js": `import BaseScene from "../engine/BaseScene.js";

/**
 * VictoryScene — shown when the player wins a level.
 * Receives { score, nextScene } from the level.
 */
export default class VictoryScene extends BaseScene {

  constructor() { super("VictoryScene"); }

  init(data) {
    this.finalScore = data?.score    ?? 0;
    this.nextScene  = data?.nextScene ?? "TitleScene";
  }

  create() {
    super.create();
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add.text(cx, height * 0.3, "YOU WIN!", {
      fontSize: "52px", fontFamily: "monospace",
      color: "#44ff88", stroke: "#000", strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, height * 0.48, \`Score: \${this.finalScore}\`, {
      fontSize: "24px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(0.5);

    this.add.text(cx, height * 0.63, "Press SPACE to continue", {
      fontSize: "18px", fontFamily: "monospace", color: "#aaaaaa",
    }).setOrigin(0.5);

    this.input.keyboard.once("keydown-SPACE", () => this.scene.start(this.nextScene));
    this.input.once("pointerdown", () => this.scene.start(this.nextScene));
  }

}
`,

  "scenes/GameCompleteScene.js": `import BaseScene from "../engine/BaseScene.js";

/**
 * GameCompleteScene — shown when all levels are cleared.
 * Receives { totalScore } from the final level.
 */
export default class GameCompleteScene extends BaseScene {

  constructor() { super("GameCompleteScene"); }

  init(data) { this.totalScore = data?.totalScore ?? 0; }

  create() {
    super.create();
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add.text(cx, height * 0.25, "GAME COMPLETE!", {
      fontSize: "44px", fontFamily: "monospace",
      color: "#ffcc00", stroke: "#000", strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, height * 0.45, \`Final Score: \${this.totalScore}\`, {
      fontSize: "28px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(0.5);

    this.add.text(cx, height * 0.6, "Thanks for playing!", {
      fontSize: "20px", fontFamily: "monospace", color: "#aaaaaa",
    }).setOrigin(0.5);

    this.add.text(cx, height * 0.72, "Press SPACE to return to title", {
      fontSize: "16px", fontFamily: "monospace", color: "#888888",
    }).setOrigin(0.5);

    this.input.keyboard.once("keydown-SPACE", () => this.scene.start("TitleScene"));
  }

}
`,

  // ── Config ────────────────────────────────────────────────────────────────────

  "config/gameConfig.json": JSON.stringify({
    player: {
      speed:     200,
      jumpForce: 750,
      health:    100,
      damage:    15,
    },
    enemy: {
      speed:       80,
      health:      60,
      damage:      10,
      scoreValue:  50,
    },
    spawnSystem: {
      initialDelay:    2000,
      interval:        3000,
      maxEnemies:      12,
      difficultyScale: 0.1,
    },
    scoring: {
      pickupValue:  10,
      comboWindow:  1500,
      comboMultMax: 4,
    },
  }, null, 2),

  "config/userSettings.json": JSON.stringify({
    generationMode: "structured",
  }, null, 2),

};

// ─── Architecture overview injected into AI system prompt ─────────────────────

export const STRUCTURED_PROMPT_INJECTION = `
════════════════════════════════════════════════════════
GENERATION MODE: STRUCTURED — READ THIS BEFORE EVERYTHING ELSE
════════════════════════════════════════════════════════
This project uses the GameForge Structured Architecture. Every game you build MUST extend the engine base classes. Never create standalone single-file games.

AVAILABLE BASE CLASSES (already scaffolded into /engine/):

SCENE BASES:
  engine/BaseScene.js          — Extend for menus, title, transitions. Override setupCamera().
  engine/BaseLevelScene.js     — Extend for every gameplay level. Implements: createMap() → createPlayer() → createEnemies() → setupCollisions() → setupCameraFollow() → setupWinCondition(). Call super.create(). Use this.winLevel() / this.loseLevel() for transitions.

ENTITY BASES:
  engine/entities/BaseEntity.js     — Extends Phaser.Physics.Arcade.Sprite. Has: health, maxHealth, takeDamage(amount), die().
  engine/entities/BaseCharacter.js  — Extends BaseEntity. Has: speed, abilities {}, useAbility(name). Override update().
  engine/entities/BasePlayer.js     — Extends BaseCharacter. Has WASD + arrow keys. addScore(points) emits "score:update". Override update() for game-specific input.
  engine/entities/BaseEnemy.js      — Extends BaseCharacter. Has state machine (patrol/chase/attack/dead), patrol(), chase(), attack(). Set this.target to enable chasing.

SYSTEMS (all static — call directly):
  engine/systems/CombatSystem.js        — CombatSystem.applyDamage(attacker, target, amount) — applies damage + red flash
  engine/systems/HealthSystem.js        — HealthSystem.isAlive(entity), HealthSystem.getPercent(entity)
  engine/systems/PhysicsSystem.js       — PhysicsSystem.knockback(entity, fromX, fromY, force)
  engine/systems/AnimationSystem.js     — AnimationSystem.play(entity, key), AnimationSystem.playOnce(entity, key, cb)
  engine/systems/AudioSystem.js         — AudioSystem.play(scene, key), AudioSystem.playMusic(scene, key, volume)
  engine/systems/CameraEffects.js       — CameraEffects.shake(scene), CameraEffects.flash(scene), CameraEffects.zoomPulse(scene)
  engine/systems/DamageNumberSystem.js  — DamageNumberSystem.show(scene, x, y, value), .showHeal(scene, x, y, value)

STANDARD SCENE FLOW:
  scenes/LoadingScene.js      — Preload screen with progress bar. Override preloadAssets() and getNextScene().
  scenes/TitleScene.js        — Main menu. Override buildUI() and startGame().
  scenes/UIScene.js           — HUD overlay. Listens to "score:update" and "health:update" events.
  scenes/GameOverScene.js     — Game over. Receives { score }.
  scenes/VictoryScene.js      — Level win. Receives { score, nextScene }.
  scenes/GameCompleteScene.js — All levels done. Receives { totalScore }.

CONFIG:
  config/gameConfig.json  — ALL numeric constants live here. NEVER hardcode speeds, health, damage, spawn rates.

MANDATORY RULES FOR STRUCTURED MODE:
1. All player classes MUST extend BasePlayer.
2. All enemy classes MUST extend BaseEnemy.
3. All level scenes MUST extend BaseLevelScene — implement createMap(), createPlayer(), createEnemies(), setupWinCondition().
4. ALL numeric constants (speed, health, damage, spawn rate, score values) MUST be in config/gameConfig.json and imported.
5. UIScene is launched automatically by BaseLevelScene. Do not launch it manually.
6. Use CameraEffects, CombatSystem, DamageNumberSystem for all feedback — do not inline their logic.
7. Emit events on this.scene.events for score and health changes — UIScene listens automatically.

OUTPUT FORMAT FOR STRUCTURED MODE:
1. List files being created/modified
2. Output every new/modified file as a <file path="..."> block
3. List any config/gameConfig.json changes last
════════════════════════════════════════════════════════
`;

export const HYBRID_PROMPT_INJECTION = `
════════════════════════════════════════════════════════
GENERATION MODE: HYBRID
════════════════════════════════════════════════════════
This project has a structured engine layer available. Prefer extending base classes when they fit naturally. You may create a custom architecture if the base classes don't suit the game type, but justify why.

AVAILABLE BASE CLASSES (in /engine/ — use when they fit):
  engine/BaseScene.js, engine/BaseLevelScene.js
  engine/entities/BasePlayer.js, engine/entities/BaseEnemy.js, engine/entities/BaseEntity.js
  engine/systems/CombatSystem.js, CameraEffects.js, DamageNumberSystem.js, AudioSystem.js

PREFERENCE ORDER: extend engine class > create new class > inline logic
CONFIG: Always put numeric constants in config/gameConfig.json.
════════════════════════════════════════════════════════
`;

// ─── Scaffolding function ─────────────────────────────────────────────────────

/**
 * Writes all engine base architecture files into a project directory.
 * Only writes files that don't already exist (never overwrites customised code).
 * Returns the list of paths that were actually written.
 */
export async function scaffoldEngine(projectId: string): Promise<string[]> {
  const root    = getProjectRoot(projectId);
  const written: string[] = [];

  for (const [relativePath, content] of Object.entries(ENGINE_TEMPLATES)) {
    const fullPath = `${root}/${relativePath}`;
    if (existsSync(fullPath)) continue; // never overwrite existing files
    try {
      await writeFile(projectId, relativePath, content);
      written.push(relativePath);
    } catch {
      // non-fatal — keep going
    }
  }

  return written;
}

/**
 * Returns true if the engine has already been scaffolded into this project.
 */
export function isEngineScaffolded(projectId: string): boolean {
  const root = getProjectRoot(projectId);
  return existsSync(`${root}/engine/BaseScene.js`);
}
