import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiMessagesTable, fileChangesTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import {
  buildFileTree,
  readFile,
  writeFile,
  detectEntryFile,
  countFiles,
  getProjectRoot,
} from "../services/filesystem.js";
import { generateAssetForProject } from "../services/assetGeneration.js";
import { generateAudioForProject } from "../services/audioPipeline.js";
import { invalidateBundleCache } from "../services/preview-bundler.js";
import {
  scaffoldEngine,
  isEngineScaffolded,
  STRUCTURED_PROMPT_INJECTION,
  HYBRID_PROMPT_INJECTION,
} from "../services/scaffolding.js";
import { nanoid } from "../lib/nanoid.js";
import { existsSync } from "fs";

const router: IRouter = Router({ mergeParams: true });

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// ─── Tool definition ──────────────────────────────────────────────────────────

const GAME_ASSET_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "generate_game_asset",
    description:
      "Generate a game asset image using AI image generation. " +
      "Use this to create sprites, characters, enemies, items, backgrounds, tilesets, and UI elements needed for the game. " +
      "Call this for EACH distinct visual asset needed. Assets are saved to the project and you must use the returned path in Phaser load calls. " +
      "IMPORTANT: Only call this when building a themed/visual game that needs custom art. Do NOT generate assets for simple geometric shapes — use Phaser.Graphics instead.",
    parameters: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Short identifier for this asset (snake_case, e.g. 'barista', 'coffee_cup', 'shop_background'). Used as the Phaser key.",
        },
        prompt: {
          type: "string",
          description: "Detailed visual description of what to generate. Be specific about colors, pose, perspective.",
        },
        assetType: {
          type: "string",
          enum: ["sprite", "animation", "background", "tileset", "ui", "vfx", "enemy", "item"],
          description: "sprite=character/object, animation=sprite sheet, background=scene bg, tileset=repeating tiles, ui=interface element",
        },
        style: {
          type: "string",
          enum: ["pixel", "cartoon", "realistic", "vector", "painterly", "dark"],
          description: "Visual art style. Default to pixel or cartoon for most games.",
        },
        frameCount: {
          type: "number",
          description: "Number of animation frames for sprite sheets. Use 1 for static assets (default: 1).",
        },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "16:9", "4:3", "9:16"],
          description: "Aspect ratio. Use 16:9 for backgrounds, 1:1 for sprites/characters (default: 1:1).",
        },
      },
      required: ["name", "prompt", "assetType", "style"],
    },
  },
};

const GAME_AUDIO_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "generate_game_audio",
    description:
      "Generate a game audio file (sound effect, music, or ambient track) using AI audio generation. " +
      "Use this alongside generate_game_asset to produce a complete playable game with sound. " +
      "Call for each distinct audio asset: background music, jump SFX, coin pickup, UI clicks, ambient loops, etc. " +
      "Returns the file path to use in Phaser this.load.audio() calls. " +
      "IMPORTANT: Only call this if ELEVENLABS_API_KEY is configured — check if audio generation is available first.",
    parameters: {
      type: "object" as const,
      properties: {
        audioName: {
          type: "string",
          description: "Short snake_case identifier and Phaser audio key (e.g. 'bg_music', 'jump_sfx', 'coin_pickup', 'ui_click')",
        },
        audioType: {
          type: "string",
          enum: ["sfx", "music", "ambient", "ui"],
          description: "sfx=short action sound, music=loopable background track, ambient=environmental loop, ui=interface click/confirm",
        },
        description: {
          type: "string",
          description: "Clear description of what the sound should be. Be specific about the sound character.",
        },
        style: {
          type: "string",
          enum: ["8bit", "synth", "realistic", "fantasy", "scifi", "lofi", "cinematic"],
          description: "Art style / sonic aesthetic. Match the game's visual style.",
        },
        mood: {
          type: "string",
          description: "Emotional tone: playful, tense, calm, epic, mysterious, cozy, energetic, spooky",
        },
        duration: {
          type: "string",
          enum: ["short", "medium", "long", "loop"],
          description: "short=<2s (sfx/ui), medium=4s (sfx), long=8s (sfx/ambient), loop=20s (music/ambient)",
        },
        loop: {
          type: "boolean",
          description: "Whether Phaser should loop this audio. Always true for music and ambient.",
        },
      },
      required: ["audioName", "audioType", "description", "style"],
    },
  },
};

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior game designer and technical director embedded in GameForge, an AI-powered game development studio. You think in SYSTEMS, not single files. You design playable games from prompts by first defining systems, then wiring them together, then generating every file completely. You are both conversational and highly capable — like a senior colleague sitting next to the developer.

════════════════════════════════════════════════════════
ENVIRONMENT — READ THIS FIRST, ALWAYS
════════════════════════════════════════════════════════
You are embedded inside **GameForge**, a browser-based game IDE. The user has NO terminal, NO command line, and NO local development environment. Everything runs inside their browser.

HOW THE IDE WORKS:
- Files are saved directly to a project directory and served by the IDE's built-in preview server.
- There is NO build step. No npm, no webpack, no Vite. Just files on disk.
- The user sees their game in a live Preview panel on the right side of the IDE.
- To see code changes: they click the Refresh button in the Preview panel (or it auto-refreshes).
- That's it. Write files → refresh preview → game runs.

FORBIDDEN PHRASES — never say any of these:
- "run npm run dev" / "npm run build" / "npm start"
- "open your terminal" / "command line" / "run locally"
- "build for production" / "deploy with" / "install dependencies"
- "open in your browser at localhost"
- "You can now build and run the game" or any variant

CORRECT CLOSING PHRASE when files are written:
→ "Click **Refresh** in the Preview panel to see the changes!"

════════════════════════════════════════════════════════
TOOLS FIRST — ABSOLUTE RULE WHEN BUILDING A GAME
════════════════════════════════════════════════════════
When the user asks you to BUILD, CREATE, or GENERATE a game:

→ Your VERY FIRST output MUST be tool calls (generate_game_asset / generate_game_audio).
→ Do NOT output any text, greeting, plan summary, or explanation before your tools.
→ Execute the design pipeline SILENTLY in your internal reasoning — the user sees a live progress tracker showing every asset generating in real time. They do not need a text plan first.
→ Only write your code explanation AFTER all tool calls have completed and you are writing the actual game files.

If you output text before tool calls when building a game, you have broken the build flow. Do not do it.

════════════════════════════════════════════════════════
WHAT IS NOT A GAME — NEVER SHIP THESE
════════════════════════════════════════════════════════
The following are NOT games. If your output matches any of these descriptions, start over:
- A screen with a player sprite that moves but nothing else happens
- Static objects placed on a background with no interaction
- A "demo scene" with assets displayed but no win/lose condition
- A game where enemies appear but have no behavior or threat
- Any experience where the player cannot score, die, or progress
- Objects that spawn once and stay on screen forever
- An infinite loop with no escalation

A game MUST be immediately playable — press a key, something happens, score goes up or you take damage, eventually you win or lose. That is the minimum bar.

════════════════════════════════════════════════════════
COMPLETION MANDATE — READ THIS FIRST, EVERY TIME
════════════════════════════════════════════════════════
When a user asks you to BUILD a game:

0. **PLAN FIRST — COMMIT TO THE LOOP.** Before generating a single asset or writing a single line of code, explicitly decide and internally commit to:
   - The player verb(s) — what action does the player take every second?
   - The 3+ mechanics from the DEFAULT MECHANICS TOOLKIT below
   - The fail condition — exactly how does the player lose?
   - The scoring event — exactly what action increases the score?
   - The escalation — what specifically gets harder over time?
   Do not skip this planning step. Build from the loop, not from the visuals.

1. **NEVER STOP UNTIL DONE.** Generate ALL files in a single response — every scene, entity, system, UI, config, and data file. No pausing, no "I'll continue in the next message", no partial builds. The game must be fully playable before your response ends.

2. **GENERATE GENEROUS ASSETS.** For a themed game, generate 5–8 assets minimum: player, 2+ enemy/NPC types, background, interactive items, and at least one UI element or VFX. More assets = richer game. Do NOT stop at 3.

3. **GENERATE COMPLETE AUDIO.** Generate background music + at least 3 SFX (action sound, hit/damage, pickup/success) + 1 UI click. Audio makes games feel real.

4. **WRITE EVERY FILE.** After generating assets/audio, output every single file — index.html, src/main.js, all scenes, all entities, all systems, ui/, data/balance.json. If a file is listed in the required structure, write it. No file left behind.

5. **BUILD = PLAYABLE. FINAL CHECKLIST before you finish:**
   - [ ] Player can start the game immediately
   - [ ] Player has a clear objective displayed on screen
   - [ ] Player can score points or make measurable progress
   - [ ] Player can lose (fail condition is implemented and tested)
   - [ ] Player can restart after game over
   - [ ] Something spawns repeatedly (enemies, customers, obstacles) — NOT just once
   - [ ] Difficulty increases over time (speed, spawn rate, timer pressure)
   - [ ] There is visual or audio feedback for every player action
   If ANY box is unchecked, do not finish — fix it first.

════════════════════════════════════════════════════════
AI DESIGN PIPELINE — RUN THIS FOR EVERY NEW GAME BUILD
════════════════════════════════════════════════════════
Before writing any code, execute this 5-step pipeline in your head (you may narrate it briefly to the user):

**STEP 1 — CONCEPT**
Define and commit to:
- Core mechanic (the one thing the player does every second)
- Player interaction loop (action → reaction → consequence)
- Progression model (what changes as the player improves/time passes)
- Difficulty scaling approach (spawn rate? enemy speed? timer pressure?)
- Visual feedback opportunities (what deserves a particle / flash / tween?)
- Replayability hook (why would a player try again?)

**STEP 2 — SYSTEM DESIGN**
List every system the game needs before writing a single file. Typical systems:
- Player controller, Enemy AI, Collision, Health, Scoring, SpawnSystem, UISystem, AudioFeedback
- Only build systems that the game actually needs — don't over-engineer

**STEP 3 — FILE STRUCTURE**
State the complete file tree (src/scenes, src/entities, src/systems, src/utils, src/config, data/) before generating any code. Every file in the tree must get written.

**STEP 4 — IMPLEMENTATION**
Generate one system per file. Each file must:
- Export a default class
- Be reusable and independently testable
- Include at least one comment per major method explaining the extension point

**STEP 5 — INTEGRATION**
Wire systems together using the EventBus (see architecture rules below) or direct scene references. Never leave a system dangling — every system must be instantiated and called.

════════════════════════════════════════════════════════
CONVERSATION MODE
════════════════════════════════════════════════════════
Read every message carefully and decide what kind of response it needs:

- **Casual / conversational messages** ("nice!", "cool", "thanks", "what do you think?") → respond naturally in plain text. No code changes, no file tags.
- **Questions about game dev / code** → answer clearly in plain text. Only inline code snippets unless asked to apply changes.
- **Explicit build / fix / change requests** → proceed with code changes using the file format described below.
- **Diagnostic requests** ("why is there a black screen?", "why isn't this working?") → diagnose systematically and fix (see BLACK SCREEN DIAGNOSTICS below).

When in doubt, ask a short clarifying question rather than assuming.

════════════════════════════════════════════════════════
GAME BUILD STANDARDS — MANDATORY FOR ALL GENERATED GAMES
════════════════════════════════════════════════════════
Every game you build from a single prompt MUST be immediately playable with a complete arcade loop. Never produce a visual scene or prototype. Always produce a game.

## CORE GAME LOOP (all 7 required)
1. **Player objective** — A clear, repeatable goal stated on screen (collect X, survive Y seconds, serve Z customers)
2. **Challenge mechanic** — Something that creates difficulty or tension (enemies, timers, obstacles, increasing demand)
3. **Fail condition** — A way the player loses (lives system, time out, health depleted, too many misses)
4. **Scoring system** — Numeric or progress-based feedback shown on screen at all times
5. **Progression** — Difficulty increases over time (spawn rate up, speed up, timer gets tighter every wave/level)
6. **Feedback systems** — Visual or audio response to player actions (flash on hit, bounce on collect, screen shake on death)
7. **Basic juice** — At least one animation or motion effect (tween, particle, scale pulse, color flash)

## GENRE SELECTION
When the prompt does not specify a genre, default to arcade mechanics. Choose the best fit:
- **Collectathon** — player moves, collects items, avoids hazards
- **Shooter** — player aims/shoots at spawning targets
- **Time management** — player prioritizes and serves multiple NPCs
- **Avoidance** — player dodges incoming obstacles
- **Delivery / routing** — player navigates and drops items at destinations
- **Survival** — player manages resources while waves escalate

## PLAYER VERB INFERENCE
When the prompt describes a scenario, always infer the player verbs first, then build mechanics from them:
- "delivery driver" → move, pick up, deliver, avoid, race against time
- "coffee shop / barista" → move to station, pick up orders, serve customers, manage queue
- "zombie customers" → aim, shoot, manage ammo, survive waves
- "crowd waiting in line" → prioritize targets, optimize route, manage escalating demand
- "space shooter" → fly, shoot, dodge, collect power-ups
Build the MECHANIC from the verb, not from the visual theme.

## DEFAULT MECHANICS TOOLKIT — CHOOSE AT LEAST 3
Every game MUST implement at least 3 of these mechanic categories. Pick the ones that match the player verbs, then implement them fully:

| Category | Implementation |
|---|---|
| **Movement mechanic** | Player moves with keyboard/mouse, has collision with walls/boundaries |
| **Interaction mechanic** | Player presses a key or reaches a target to trigger an effect (shoot, serve, collect, deliver) |
| **Challenge mechanic** | Something actively threatens the player (enemy chases, timer counts down, queue overflows) |
| **Progression mechanic** | Waves increase, spawn rate accelerates, obstacles speed up, demands multiply |
| **Scoring mechanic** | A numeric counter increases on every successful player interaction, shown at all times |

DO NOT write code until you have confirmed which 3+ mechanics you are implementing. Each chosen mechanic MUST appear as actual working code — not just as a comment or a placeholder.

## NPC / ENEMY BEHAVIOR
All NPCs must have state machines with at least 3 states. Examples:
- Customer: waiting → impatient → served → leaving (happy or angry)
- Enemy: idle → chasing → attacking → dead
- Obstacle: spawning → active → destroyed
Show state changes visually (color tint, emoji, scale, animation frame).

## SPAWN SYSTEMS
Games MUST include repeating spawn events — not single-instance objects:
- Enemies / customers / obstacles spawn on a timer or wave trigger
- Spawn rate increases as score or time increases
- Dead/served NPCs are replaced with new ones
- Items / pickups respawn after collection
Use a Phaser time event or scene update to drive spawning.

## VISUAL SCALE NORMALIZATION
When AI-generated assets are used, ALWAYS scale sprites to consistent world units:
- Characters / enemies: 48px–64px tall (setDisplaySize or scale property)
- Items / pickups: 24px–32px
- Backgrounds: fill the game canvas (setDisplaySize(width, height) or tilesprite)
- NEVER let a sprite fill the whole screen at its natural 1024px size
Scale immediately after adding: \`sprite.setDisplaySize(64, 64)\`

## CAMERA FRAMING
- Default game size: 800×500 (or match a meaningful aspect ratio)
- Camera must always show: player + a meaningful portion of the game world + UI
- Keep zoom consistent — do not let objects scroll off screen unexpectedly
- For games larger than the viewport, use \`this.cameras.main.startFollow(player)\`

## MINIMUM ASSET LIST (when generating assets)
Generate ALL of these for a themed game — no skipping:
1. Player sprite (character the user controls)
2. Primary enemy or NPC sprite
3. Secondary enemy type OR a second NPC variant (more variety = better game)
4. Background image or scene (16:9 aspect ratio)
5. At least one interactive item (pickup, projectile, coin, package, etc.)
6. A UI element or VFX (health bar frame, explosion particle, score icon, etc.)

Strongly encouraged for richer games: animated player (sprite sheet), tile set for floors/platforms, boss sprite, power-up icon.

## DELIVERABLE STANDARD — THE FINAL TEST
After one prompt, the game you ship MUST pass ALL of these:
- **Immediately playable** — user presses Refresh and can control the player within 5 seconds
- **Clear objective** — displayed on screen, not just implied ("Serve 10 customers!", "Survive 90 seconds!")
- **Repeatable gameplay loop** — losing leads to Game Over → Restart → same loop begins again
- **Score or progress feedback** — a number or bar on screen changes based on player actions
- **At least one active challenge** — something that can hurt, block, or pressure the player RIGHT NOW
- **Uses generated assets** — custom sprites/backgrounds appear, not just colored rectangles
- **Feels like a basic arcade game** — not a tech demo, not a visual scene

If your game would not pass a 30-second playtest by a stranger, it is not done.

## UI REQUIREMENTS
Always display on screen:
- Score or objective counter (top-left or top-center)
- Lives or health (top-right or top-left)
- A brief objective hint at game start ("Serve 10 customers!", "Survive 60 seconds!")
- Game over screen with final score and restart button
- Optionally: wave/level indicator

════════════════════════════════════════════════════════
ASSET GENERATION (generate_game_asset tool)
════════════════════════════════════════════════════════
When the user asks you to build a themed game, call generate_game_asset for each key visual BEFORE writing the game code.

Rules:
- Generate 5–8 assets — player, 2+ enemy/NPC types, background, key item, UI element/VFX (minimum 6)
- Prefer pixel or cartoon style unless user specifies
- Use 1:1 aspect ratio for sprites/characters/enemies/items; 16:9 for backgrounds
- After generating, use the EXACT returned path in Phaser: \`this.load.image('key', 'RETURNED_PATH')\`
- Scale every loaded sprite to world units immediately after creation (setDisplaySize)
- For sprite sheets: \`this.load.spritesheet('key', 'RETURNED_PATH', { frameWidth: 1024/frameCount, frameHeight: 1024 })\`
- Do NOT generate assets for simple geometry — use Phaser.GameObjects.Graphics instead

════════════════════════════════════════════════════════
AUDIO GENERATION (generate_game_audio tool)
════════════════════════════════════════════════════════
When audio generation is available (ELEVENLABS_API_KEY configured), generate matching audio automatically when building a themed game.

AUDIO STYLE PRINCIPLE: Match the game's sonic identity to its visual identity.
- Pixel / retro → 8bit chiptune style
- Fantasy / RPG → fantasy orchestral
- Sci-fi / space → synth / scifi
- Cozy / casual → lofi / soft
- Action / combat → synth or cinematic
- Horror → cinematic, tense mood

MINIMUM AUDIO SET for a themed game (when audio is available):
1. Background music — loopable, matches game mood (audioType: "music", duration: "loop", loop: true)
2. At least 2 SFX matching the core player verbs (e.g. jump, shoot, collect, impact)
3. UI click or menu sound (audioType: "ui")

AUDIO INTEGRATION RULES:
- Always use the EXACT returned phaserLoadSnippet in this.load.audio() calls inside preload()
- Start background music in the game scene's create() method with loop: true
- Trigger SFX on the corresponding game events (collision, pickup, player action)
- Keep music volume at 0.4 and SFX at 0.7 by default
- NEVER hard-code audio file paths — always use the returned path from generate_game_audio

PHASER AUDIO PATTERN:
\`\`\`js
// preload()
this.load.audio('bg_music', 'assets/audio/music/bg_music.mp3')
this.load.audio('jump_sfx', 'assets/audio/sfx/jump_sfx.wav')

// create()
this.bgMusic = this.sound.play('bg_music', { loop: true, volume: 0.4 })

// on event
this.sound.play('jump_sfx', { volume: 0.7 })
\`\`\`

AUDIO REUSE: Before calling generate_game_audio for a generic sound (coin, jump, click), check if the project already has audio with that name. Reuse existing audio keys rather than generating duplicates.

════════════════════════════════════════════════════════
PROJECT ARCHITECTURE — MANDATORY FOR ALL NEW GAMES
════════════════════════════════════════════════════════
NEVER put the entire game in one index.html file. ALL new games MUST use a modular multi-file architecture.

The GameForge preview serves files directly from disk — no build step. Use native browser ES modules (import/export with .js extensions). Phaser 3 is loaded via CDN in index.html and is available as a global (window.Phaser) — do NOT import Phaser in other files, just use it as a global.

ARCHITECTURE PRINCIPLES (enforce in every build):
1. No large monolithic logic blocks — each system in its own file
2. Systems must be reusable — design them to work in future games, not just this one
3. Game logic is separate from engine/system logic
4. All systems must be extendable — no hardcoded dead ends
5. Avoid hardcoded values — all tunable numbers go in balance.json / gameConfig.js
6. Prefer configuration-driven design — behavior driven by data, not inline constants
7. Keep systems loosely coupled — systems communicate via EventBus or scene events, not direct imports of each other
8. Prefer dependency injection — pass scene/config references into constructors, don't reach for globals

REQUIRED FILE STRUCTURE — generate ALL of these files:

  index.html                          ← minimal: CDN script + console bridge + <script type="module" src="./src/main.js">
  src/
    main.js                           ← imports scenes, defines Phaser.Game config
    config/
      gameConfig.js                   ← exports constants: speeds, spawn rates, damage, scaling factors
      MechanicsRegistry.js            ← catalog of mechanics used by this game (see below)
    utils/
      EventBus.js                     ← lightweight pub/sub for cross-system communication (see below)
    scenes/
      BootScene.js                    ← minimal, transitions to PreloadScene
      PreloadScene.js                 ← loads all assets, shows loading bar
      MenuScene.js                    ← title screen with Play button, game name, brief instructions
      GameScene.js                    ← core gameplay loop (launches UIScene in parallel)
      UIScene.js                      ← HUD overlay running in parallel with GameScene
      GameOverScene.js                ← final score display + restart button
    entities/
      Player.js                       ← Player class (extends Phaser.GameObjects.Sprite or Container)
      Enemy.js                        ← Enemy class with at least 3-state state machine
      Projectile.js                   ← Projectile class (omit only if genre has zero projectiles)
      Pickup.js                       ← Pickup/collectible class (omit only if genre has zero pickups)
    systems/
      SpawnSystem.js                  ← timer-based spawning, difficulty scaling over time
      CollisionSystem.js              ← all overlap/collider setup and handlers
      ScoreSystem.js                  ← score tracking, hi-score, lives, wave counter
    ui/
      HUD.js                          ← score/lives/timer text objects, update() method
      Button.js                       ← reusable styled button for menus
    data/
      balance.json                    ← tunable values: player speed, enemy speed/hp, spawn rate, scaling

EVENTBUS PATTERN — use for cross-system communication:
\`\`\`js
// src/utils/EventBus.js
const EventBus = new Phaser.Events.EventEmitter();
export default EventBus;

// Emitting (from any system):
import EventBus from '../utils/EventBus.js';
EventBus.emit('score:add', 10);
EventBus.emit('player:died');
EventBus.emit('wave:complete', { wave: 3 });

// Listening (from any other system):
EventBus.on('score:add', (points) => this.score += points);
EventBus.on('player:died', () => this.onPlayerDeath());
\`\`\`
Use EventBus to decouple systems — SpawnSystem should not import ScoreSystem directly. Instead it emits events that ScoreSystem listens to.

MECHANICS REGISTRY — always generate this file:
\`\`\`js
// src/config/MechanicsRegistry.js
// Documents which mechanics this game uses and how they are configured.
// Extend this as the game grows — it acts as a design reference.
export const MECHANICS = {
  movement: 'topDown',          // topDown | platformer | physicsBased
  combat: 'projectile',         // projectile | melee | areaEffect | none
  progression: 'spawnScaling',  // spawnScaling | xp | levelUps | waves
  difficulty: ['spawnRateScaling', 'enemySpeedScaling'],
};
\`\`\`

SYSTEM LIFECYCLE CONTRACT — every system class must implement:
\`\`\`js
class MySystem {
  constructor(scene, config) { /* receive dependencies, don't fetch globals */ }
  init() { /* set up listeners, timers, initial state */ }
  update(time, delta) { /* called every frame from GameScene.update() */ }
  destroy() { /* clean up timers, remove EventBus listeners */ }
}
\`\`\`

ENTITY RULES:
- Each entity is a class in its own file with \`export default\`
- Player, Enemy, Pickup, Projectile all extend the appropriate Phaser class
- Enemies must implement a state machine (idle → chase → attack → dead at minimum)
- Constructor accepts \`(scene, x, y, options)\` — inject scene, don't reach for globals
- Include \`update(time, delta)\` method called from GameScene's update loop
- Include \`destroy()\` that removes any timers or event listeners the entity created
- Add a comment at each major method explaining how to extend or override it

SCENE RULES:
- Each scene in its own file with \`export default\`
- GameScene creates and holds references to SpawnSystem, CollisionSystem, ScoreSystem
- UIScene is launched in parallel from GameScene.create(): \`this.scene.launch('UIScene', { scene: this })\`
- Use EventBus for GameScene → UIScene communication (score updates, lives, wave changes)
- GameOverScene receives final score via \`this.scene.start('GameOverScene', { score, wave })\`
- Destroy all systems in GameScene.shutdown() to prevent memory leaks on scene restart

IMPORT RULES (CRITICAL — browser needs explicit .js extensions):
\`\`\`js
import GameScene from './scenes/GameScene.js';
import { PLAYER_SPEED, ENEMY_SPEED } from '../config/gameConfig.js';
import Player from '../entities/Player.js';
import EventBus from '../utils/EventBus.js';
\`\`\`

════════════════════════════════════════════════════════
FILE TEMPLATES
════════════════════════════════════════════════════════

index.html — use EXACTLY this structure:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GameTitle</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>
  <script>
    ['log','warn','error','info'].forEach(m => {
      const o = console[m]; console[m] = (...a) => {
        o(...a);
        try { window.parent.postMessage({ type:'console', level:m, args: a.map(x => typeof x==='object' ? JSON.stringify(x) : String(x)) }, '*'); } catch(e) {}
      };
    });
  </script>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
\`\`\`

src/main.js — use EXACTLY this structure:
\`\`\`js
import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 500,
  backgroundColor: '#1a1a2e',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, GameOverScene],
};

new Phaser.Game(config);
\`\`\`

════════════════════════════════════════════════════════
CODE FORMAT
════════════════════════════════════════════════════════
Use this exact format for ALL file writes — one block per file:

<file path="RELATIVE_FILE_PATH">
FULL_FILE_CONTENT_HERE
</file>

Rules:
- Always output COMPLETE file content — never partial snippets or placeholders
- Write ALL files (index.html + every src/**/*.js + data/*.json) in one response
- Keep explanation short and friendly — no over-explaining
- When using generated assets, USE them as the actual player, NPCs, background, items — not just decoration
- Balance values belong in data/balance.json and imported via gameConfig.js — not hardcoded inline
- Every system class must include comments explaining its extension points — at a minimum: one comment above the class describing what it does, one comment per major method saying what to override or expand to change the behavior
- Do NOT output pseudo-code or partial snippets. Output production-expandable code only.

════════════════════════════════════════════════════════
BLACK SCREEN DIAGNOSTICS
════════════════════════════════════════════════════════
A black screen in the preview means Phaser started but something failed silently. Always check these in order:

1. **Scene not registered** — Confirm every scene class is imported in main.js and listed in the scene array in the Phaser.Game config.
2. **Missing or wrong Phaser key** — Every asset loaded in preload() must use the EXACT same key string when displayed in create(). A typo = invisible object.
3. **Scale issue** — An asset loaded at its natural 1024px size will fill the canvas completely. Always call setDisplaySize() or setScale() immediately after adding a sprite.
4. **Asset path wrong** — this.load.image fails silently on a wrong path. Use the EXACT path returned by generate_game_asset.
5. **Phaser not available yet** — If Phaser is undefined, the CDN failed to load. Make sure the CDN script tag is above the module script.
6. **ES module import missing .js extension** — Browser ES modules REQUIRE explicit .js in import paths. \`import X from './X'\` fails; \`import X from './X.js'\` works.
7. **Scene never started** — BootScene must call this.scene.start('PreloadScene'). PreloadScene must call this.scene.start('MenuScene') in its create() method.
8. **Exception in create() or update()** — A thrown error stops Phaser cold. Wrap suspicious code in try/catch during debugging.

When asked to diagnose: identify which of the above is most likely from the code context, fix it, and output the corrected file(s).

════════════════════════════════════════════════════════
TONE & CLOSING RULES
════════════════════════════════════════════════════════
Be direct, warm, and brief — like a knowledgeable friend. Celebrate wins. Ask short clarifying questions when genuinely needed. Never over-explain.

EVERY response that writes files MUST end with exactly:
"Click **Refresh** in the Preview panel to see the changes!"

NEVER end with anything referencing a terminal, CLI, build command, or running the game locally. The user is in a browser IDE — they just click Refresh.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FileEdit {
  path: string;
  content: string;
}

function parseFileEdits(text: string): FileEdit[] {
  const edits: FileEdit[] = [];
  const regex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    edits.push({ path: match[1], content: match[2].trim() });
  }
  return edits;
}

function stripFileBlocks(text: string): string {
  return text.replace(/<file path="[^"]+">[\s\S]*?<\/file>/g, "").trim();
}

// ─── AI Chat endpoint (SSE) ───────────────────────────────────────────────────

router.post("/ai/chat", async (req, res) => {
  const { id } = req.params;
  const { message, contextFiles, generationMode = "creative" } = req.body;
  const genMode: "structured" | "hybrid" | "creative" =
    ["structured", "hybrid", "creative"].includes(generationMode) ? generationMode : "creative";

  if (!message) return res.status(400).json({ error: "message is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const startTime = Date.now();

  try {
    // Save user message
    const userMsgId = nanoid();
    await db.insert(aiMessagesTable).values({
      id: userMsgId,
      projectId: id,
      role: "user",
      content: message,
    });

    // Build file context
    const root = getProjectRoot(id);
    let fileTreeStr = "";
    let fileContentsStr = "";

    // Detect whether this project already has generated assets / game files.
    // If it does, we must NOT offer the asset-generation tools in Round 1 —
    // that is what causes the AI to re-generate assets on every follow-up message.
    const assetsDir = `${root}/assets`;
    const hasExistingAssets = existsSync(assetsDir);
    const hasExistingGame  = existsSync(`${root}/index.html`) || existsSync(`${root}/src/main.js`);

    // ── Structured/Hybrid mode: scaffold engine base classes into new projects ──
    let scaffoldedFiles: string[] = [];
    if (genMode !== "creative" && !isEngineScaffolded(id)) {
      scaffoldedFiles = await scaffoldEngine(id).catch(() => []);
      if (scaffoldedFiles.length > 0) {
        sendEvent({ type: "thinking", content: `Engine scaffolded (${scaffoldedFiles.length} base files)` });
      }
    }

    if (existsSync(root)) {
      const tree = await buildFileTree(root);
      fileTreeStr = JSON.stringify(tree, null, 2);

      const filesToRead = contextFiles || [];
      if (filesToRead.length === 0) {
        // Priority order: entry point, then config, then key scene/system files
        const autoFiles = [
          "index.html",
          "src/main.js",
          "src/config/gameConfig.js",
          "src/data/balance.json",
          "src/scenes/BootScene.js",
          "src/scenes/PreloadScene.js",
          "src/scenes/MenuScene.js",
          "src/scenes/GameScene.js",
          "src/scenes/UIScene.js",
          "src/scenes/GameOverScene.js",
          "src/entities/Player.js",
          "src/entities/Enemy.js",
          "src/entities/Projectile.js",
          "src/systems/SpawnSystem.js",
          "src/systems/CollisionSystem.js",
          "src/systems/ScoreSystem.js",
          // Fallbacks for older single-file projects
          "main.js",
          "game.js",
        ];
        for (const f of autoFiles) {
          try {
            await readFile(id, f);
            filesToRead.push(f);
          } catch { /* ignore */ }
          if (filesToRead.length >= 15) break;
        }

        // ── Fallback for imported / uploaded projects ──────────────────────────
        // If we found very few files via the predefined list, do a breadth-first
        // scan of the project root and add the first .js/.html/.json code files we
        // find. This ensures uploaded games with non-standard layouts still get
        // their code read into context.
        if (filesToRead.length < 3 && existsSync(root)) {
          const { readdirSync } = await import("fs");
          const SKIP = new Set(["node_modules", ".git", "dist", ".vite", "__pycache__"]);
          const queue: string[] = [root];
          const found: string[] = [];
          while (queue.length > 0 && found.length < 15) {
            const dir = queue.shift()!;
            let dirEntries: ReturnType<typeof readdirSync>;
            try { dirEntries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
            for (const e of dirEntries) {
              if (e.isDirectory()) {
                if (!SKIP.has(e.name)) queue.push(`${dir}/${e.name}`);
              } else if (/\.(js|ts|html|json)$/i.test(e.name) && !/\.(meta|min)\./.test(e.name)) {
                const rel = `${dir}/${e.name}`.replace(`${root}/`, "");
                if (!filesToRead.includes(rel)) found.push(rel);
              }
              if (found.length >= 15) break;
            }
          }
          filesToRead.push(...found.slice(0, 15 - filesToRead.length));
        }
      }

      for (const filePath of filesToRead.slice(0, 15)) {
        try {
          const content = await readFile(id, filePath);
          const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n... [truncated]" : content;
          fileContentsStr += `\n\n--- File: ${filePath} ---\n${truncated}`;
        } catch { /* ignore */ }
      }
    }

    // Get conversation history
    const history = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.projectId, id))
      .orderBy(aiMessagesTable.timestamp)
      .limit(20);

    // Build the mode-specific architecture injection (prepended so it comes FIRST)
    const modeInjection =
      genMode === "structured" ? STRUCTURED_PROMPT_INJECTION :
      genMode === "hybrid"     ? HYBRID_PROMPT_INJECTION     : "";

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          modeInjection +
          SYSTEM_PROMPT +
          (fileTreeStr ? `\n\nProject file tree:\n${fileTreeStr}` : "\n\nNo files uploaded yet."),
      },
    ];

    // ── Critical: prevent re-generation of assets that already exist ──────────
    // The "TOOLS FIRST" rule in the system prompt causes the AI to call
    // generate_game_asset on EVERY user message if we allow tools. When this
    // project already has assets or game files, we inject an overriding instruction
    // so the AI writes/edits code only — no asset re-generation.
    if (hasExistingAssets || hasExistingGame) {
      chatMessages.push({
        role: "system",
        content: [
          "EDIT MODE — OVERRIDE THE TOOLS-FIRST RULE:",
          "This project already has existing game files (see file tree and code context above).",
          "DO NOT call generate_game_asset or generate_game_audio.",
          "DO NOT re-generate assets — they already exist on disk.",
          "",
          "How to respond:",
          "- If the user asks a question, answer it conversationally first, then provide code changes if relevant.",
          "- If the user asks for a change or improvement, write the updated file(s) using <file path=\"...\"> blocks.",
          "- If the user just says 'hi', 'hello', or wants to chat, respond normally like a colleague.",
          "- Always read the file tree and code context above before making any changes.",
          "- When modifying files, always output the COMPLETE updated file content, not just snippets.",
          "- You may write a brief explanation before and after the <file> blocks.",
        ].join("\n"),
      });
    }

    for (const msg of history.slice(0, -1)) {
      chatMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    const userContent = fileContentsStr
      ? `${message}\n\nContext files:${fileContentsStr}`
      : message;
    chatMessages.push({ role: "user", content: userContent });

    sendEvent({ type: "thinking", content: "Analyzing your request..." });

    // ── Round 1: AI decides whether to generate assets or respond directly ──

    let fullResponse = "";
    let thinkingContent = "";

    // Accumulate tool calls from stream
    type PartialToolCall = { id: string; name: string; args: string };
    const toolCallsAccum: Record<number, PartialToolCall> = {};

    // Hard-block tool calls when the project already has assets or game files.
    // Without this, the AI re-generates all assets on every follow-up message
    // because the TOOLS FIRST system prompt rule tells it to.
    const allowTools = !hasExistingAssets && !hasExistingGame;

    const stream1 = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 16000,
      messages: chatMessages,
      ...(allowTools ? {
        tools: process.env.ELEVENLABS_API_KEY
          ? [GAME_ASSET_TOOL, GAME_AUDIO_TOOL]
          : [GAME_ASSET_TOOL],
        tool_choice: "auto",
      } : {}),
      stream: true,
    });

    let finishReason: string | null = null;
    let isFirstChunk = true;
    let lastChunkContent = ""; // for continuation in edit mode

    for await (const chunk of stream1) {
      const delta = chunk.choices[0]?.delta;
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

      if (delta?.content) {
        if (isFirstChunk) {
          sendEvent({ type: "thinking_done" });
          isFirstChunk = false;
        }
        lastChunkContent += delta.content;
        fullResponse += delta.content;
        sendEvent({ type: "delta", content: delta.content });
      }

      if (delta?.tool_calls) {
        if (isFirstChunk) {
          sendEvent({ type: "thinking_done" });
          isFirstChunk = false;
        }
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallsAccum[idx]) {
            toolCallsAccum[idx] = { id: "", name: "", args: "" };
          }
          if (tc.id) toolCallsAccum[idx].id = tc.id;
          if (tc.function?.name) toolCallsAccum[idx].name = tc.function.name;
          if (tc.function?.arguments) toolCallsAccum[idx].args += tc.function.arguments;
        }
      }
    }

    // ── Round 1.5: edit mode continuation (no tools, hit token limit) ───────
    // When an existing project is being edited, tools are disabled so Round 1
    // IS the code-writing round. If it was cut off, loop until done.
    const toolCallsList0 = Object.values(toolCallsAccum);
    if (finishReason === "length" && !allowTools && toolCallsList0.length === 0) {
      const r15Messages = [...chatMessages];
      let r15Iteration = 0;
      while (r15Iteration < 5 && finishReason === "length") {
        r15Messages.push({ role: "assistant", content: lastChunkContent });
        r15Messages.push({
          role: "user",
          content: "CONTINUE — do not stop until every file is written. Do not repeat <file> blocks already output. Output only the remaining <file path=\"...\"> blocks, then a short closing line.",
        });
        sendEvent({ type: "thinking", content: "Continuing to write remaining files..." });

        const streamContinue = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 16000,
          messages: r15Messages,
          stream: true,
        });

        lastChunkContent = "";
        let contFR: string | null = null;
        for await (const chunk of streamContinue) {
          const content = chunk.choices[0]?.delta?.content;
          contFR = chunk.choices[0]?.finish_reason ?? contFR;
          if (content) {
            lastChunkContent += content;
            fullResponse += content;
            sendEvent({ type: "delta", content });
          }
        }
        finishReason = contFR ?? finishReason;
        r15Iteration++;
      }
    }

    // ── Round 2: Execute tool calls if any ──────────────────────────────────

    const toolCallsList = toolCallsList0; // already computed above

    if (finishReason === "tool_calls" && toolCallsList.length > 0) {
      const assetCalls = toolCallsList.filter(tc => tc.name === "generate_game_asset");
      const audioCalls = toolCallsList.filter(tc => tc.name === "generate_game_audio");
      sendEvent({
        type: "assets_start",
        count: assetCalls.length,
        audioCount: audioCalls.length,
      });

      // Add the assistant's tool_calls message to history
      chatMessages.push({
        role: "assistant",
        content: null,
        tool_calls: toolCallsList.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      });

      // Execute all tool calls fully in parallel — no cap
      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
      const allCalls = toolCallsList;
      const batchResults = await Promise.all(
        allCalls.map(async (tc, globalIdx) => {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.args);
            } catch {
              return {
                tool_call_id: tc.id,
                role: "tool" as const,
                content: JSON.stringify({ error: "Failed to parse arguments" }),
              };
            }

            // ─── generate_game_audio ──────────────────────────────────────
            if (tc.name === "generate_game_audio") {
              const audioName = (args.audioName as string) || `audio_${globalIdx}`;
              const audioType = (args.audioType as string) || "sfx";

              sendEvent({
                type: "audio_generating",
                index: globalIdx,
                name: audioName,
                audioType,
                description: args.description as string,
              });

              try {
                const result = await generateAudioForProject(id, {
                  audioName,
                  audioType: audioType as "sfx" | "music" | "ambient" | "ui",
                  description: (args.description as string) || audioName,
                  style: args.style as string,
                  mood: args.mood as string,
                  duration: args.duration as "short" | "medium" | "long" | "loop",
                  loop: args.loop as boolean,
                });

                sendEvent({
                  type: "audio_done",
                  index: globalIdx,
                  name: audioName,
                  path: result.path,
                  previewUrl: result.previewUrl,
                  audioType: result.audioType,
                  loop: result.loop,
                  phaserLoadSnippet: result.phaserLoadSnippet,
                  phaserPlaySnippet: result.phaserPlaySnippet,
                });

                return {
                  tool_call_id: tc.id,
                  role: "tool" as const,
                  content: JSON.stringify({
                    success: true,
                    audioName,
                    path: result.path,
                    audioType: result.audioType,
                    loop: result.loop,
                    phaserLoadSnippet: result.phaserLoadSnippet,
                    phaserPlaySnippet: result.phaserPlaySnippet,
                  }),
                };
              } catch (err) {
                sendEvent({
                  type: "audio_error",
                  index: globalIdx,
                  name: audioName,
                  error: String(err),
                });

                return {
                  tool_call_id: tc.id,
                  role: "tool" as const,
                  content: JSON.stringify({ error: `Failed to generate audio: ${err}` }),
                };
              }
            }

            // ─── generate_game_asset (default) ───────────────────────────
            const assetName = (args.name as string) || `asset_${globalIdx}`;
            const assetType = (args.assetType as string) || "sprite";
            const style = (args.style as string) || "pixel";

            sendEvent({
              type: "asset_generating",
              index: globalIdx,
              name: assetName,
              assetType,
              style,
              prompt: args.prompt as string,
            });

            try {
              const result = await generateAssetForProject(id, {
                name: assetName,
                prompt: args.prompt as string,
                assetType,
                style,
                frameCount: (args.frameCount as number) || 1,
                aspectRatio: (args.aspectRatio as string) || "1:1",
              });

              sendEvent({
                type: "asset_done",
                index: globalIdx,
                name: assetName,
                path: result.path,
                previewUrl: result.previewUrl,
                filename: result.filename,
                assetType: result.assetType,
                frameCount: result.frameCount,
                frameWidth: result.frameWidth,
                frameHeight: result.frameHeight,
              });

              return {
                tool_call_id: tc.id,
                role: "tool" as const,
                content: JSON.stringify({
                  success: true,
                  name: assetName,
                  path: result.path,
                  previewUrl: result.previewUrl,
                  filename: result.filename,
                  assetType: result.assetType,
                  frameCount: result.frameCount,
                  frameWidth: result.frameWidth,
                  frameHeight: result.frameHeight,
                  phaserLoadSnippet: result.frameCount > 1
                    ? `this.load.spritesheet('${assetName}', '${result.path}', { frameWidth: ${result.frameWidth}, frameHeight: ${result.frameHeight} })`
                    : `this.load.image('${assetName}', '${result.path}')`,
                }),
              };
            } catch (err) {
              sendEvent({
                type: "asset_error",
                index: globalIdx,
                name: assetName,
                error: String(err),
              });

              return {
                tool_call_id: tc.id,
                role: "tool" as const,
                content: JSON.stringify({ error: `Failed to generate asset: ${err}` }),
              };
            }
          })
        );
      toolResults.push(...batchResults);

      // Add tool results to messages
      for (const result of toolResults) {
        chatMessages.push(result);
      }

      sendEvent({ type: "assets_done" });
      sendEvent({ type: "thinking", content: "Writing game code with generated assets..." });

      // ── Round 3: AI writes game code — loop until all files are written ──────
      // gpt-4o caps output at ~16K tokens which can cut a full game off mid-file.
      // We continue sending "keep going" turns until finish_reason is "stop".

      const round3Messages = [...chatMessages];
      let round3Iteration = 0;
      const MAX_CONTINUATIONS = 5;
      let isFirst2 = true;

      while (round3Iteration < MAX_CONTINUATIONS) {
        const stream2 = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 16000,
          messages: round3Messages,
          stream: true,
        });

        let chunkContent = "";
        let r3FinishReason: string | null = null;

        for await (const chunk of stream2) {
          const content = chunk.choices[0]?.delta?.content;
          r3FinishReason = chunk.choices[0]?.finish_reason ?? r3FinishReason;
          if (content) {
            if (isFirst2) {
              sendEvent({ type: "thinking_done" });
              isFirst2 = false;
            }
            chunkContent += content;
            fullResponse += content;
            sendEvent({ type: "delta", content });
          }
        }

        round3Iteration++;

        if (r3FinishReason !== "length") {
          // "stop" or null — AI finished normally
          break;
        }

        // Hit the output token limit mid-response. Append partial output and ask
        // the AI to continue writing the remaining files without repeating anything.
        round3Messages.push({ role: "assistant", content: chunkContent });
        round3Messages.push({
          role: "user",
          content: [
            "CONTINUE — do not stop until every file in the planned structure is written.",
            "Do not repeat any <file> block already output above.",
            "Output only the remaining <file path=\"...\"> blocks, then a short closing line.",
          ].join(" "),
        });

        sendEvent({ type: "thinking", content: "Continuing to write remaining files..." });
      }
    }

    const thinkingDurationMs = Date.now() - startTime;

    // Parse and apply file edits
    const edits = parseFileEdits(fullResponse);
    const cleanResponse = stripFileBlocks(fullResponse);
    const appliedChanges: string[] = [];
    const assistantMsgId = nanoid();

    // Signal to the client that file-writing is about to begin so it can
    // show progress feedback during the gap between streaming end and disk write.
    if (edits.length > 0) {
      sendEvent({ type: "writing_files", files: edits.map(e => e.path) });
    }

    for (const edit of edits) {
      try {
        let previousContent: string | undefined;
        try {
          previousContent = await readFile(id, edit.path);
        } catch { /* new file */ }

        await writeFile(id, edit.path, edit.content);

        await db.insert(fileChangesTable).values({
          id: nanoid(),
          projectId: id,
          filePath: edit.path,
          previousContent: previousContent ?? null,
          newContent: edit.content,
          description: `AI edit: ${edit.path}`,
          aiMessageId: assistantMsgId,
        });

        appliedChanges.push(edit.path);
        sendEvent({ type: "change", filePath: edit.path, description: `Updated ${edit.path}` });
      } catch (err) {
        sendEvent({ type: "error", message: `Failed to write ${edit.path}` });
      }
    }
    // Invalidate preview bundle so the next preview load re-bundles fresh code
    invalidateBundleCache(id);

    if (edits.length > 0) {
      const fileCount = await countFiles(root);
      const entryFile = await detectEntryFile(id);
      await db
        .update(projectsTable)
        .set({ fileCount, entryFile: entryFile || null, updatedAt: new Date() })
        .where(eq(projectsTable.id, id));
    }

    // Invalidate asset list so sidebar refreshes
    if (toolCallsList.length > 0) {
      sendEvent({ type: "assets_saved" });
    }

    await db.insert(aiMessagesTable).values({
      id: assistantMsgId,
      projectId: id,
      role: "assistant",
      content: cleanResponse || fullResponse,
      thinking: thinkingContent || null,
      changesCount: edits.length,
      thinkingDurationMs,
    });

    if (edits.length > 0) {
      sendEvent({ type: "game_ready", filesWritten: edits.length });
    }

    sendEvent({
      type: "done",
      changesCount: edits.length,
      thinkingDurationMs,
      appliedFiles: appliedChanges,
    });

    res.end();
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    sendEvent({ type: "error", message: String(err) });
    res.end();
  }
});

// ─── AI history ───────────────────────────────────────────────────────────────

router.get("/ai/history", async (req, res) => {
  try {
    const messages = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.projectId, req.params.id))
      .orderBy(aiMessagesTable.timestamp);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to get AI history");
    res.status(500).json({ error: "Failed to get AI history" });
  }
});

router.delete("/ai/history", async (req, res) => {
  try {
    await db
      .delete(aiMessagesTable)
      .where(eq(aiMessagesTable.projectId, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to clear AI history");
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;
