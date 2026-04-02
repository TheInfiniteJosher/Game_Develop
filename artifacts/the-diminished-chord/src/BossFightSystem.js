import Phaser from "phaser"
import { WORLDS } from "./WorldManager.js"

/**
 * BossFightSystem - Manages boss encounters across all 15 worlds
 * 
 * Boss fights are platforming challenges, NOT traditional health-bar battles.
 * Each boss has 3 phases that test different skills:
 * - Phase 1: Introduction to the mechanic
 * - Phase 2: Increased intensity
 * - Phase 3: Final test / escape sequence
 */

// Boss definitions with detailed mechanics
export const BOSS_DATA = {
  // === ACT I BOSSES ===
  1: {
    name: "Rival Garage Band",
    subtitle: "The Copycats",
    description: "A rival band trying to steal your sound. Survive their aggressive stage show!",
    phases: [
      {
        name: "Soundcheck",
        description: "Dodge falling amplifiers and speaker stacks",
        duration: 30000,
        hazards: ["falling_amps", "speaker_waves"],
        platformPattern: "stable",
        musicIntensity: 1
      },
      {
        name: "The Riff-Off",
        description: "Navigate crumbling stage while avoiding guitar swings",
        duration: 40000,
        hazards: ["crumbling_platforms", "guitar_projectiles"],
        platformPattern: "unstable",
        musicIntensity: 2
      },
      {
        name: "Stage Collapse",
        description: "Escape the collapsing stage before it's too late!",
        duration: 25000,
        hazards: ["total_collapse", "falling_debris"],
        platformPattern: "escape",
        musicIntensity: 3
      }
    ],
    victoryCondition: "escape",
    defeatSong: "garage_band_defeated",
    arenaWidth: 40,
    arenaHeight: 15
  },

  2: {
    name: "The Machine",
    subtitle: "Industrial Nightmare",
    description: "A massive crushing apparatus controlled by the warehouse AI.",
    phases: [
      {
        name: "Warmup Cycle",
        description: "Learn the crusher patterns",
        duration: 35000,
        hazards: ["vertical_crushers", "steam_vents"],
        platformPattern: "rhythmic",
        musicIntensity: 1
      },
      {
        name: "Full Production",
        description: "All systems online - survive the synchronized assault",
        duration: 45000,
        hazards: ["multi_crushers", "conveyor_belts", "saw_blades"],
        platformPattern: "complex_rhythm",
        musicIntensity: 2
      },
      {
        name: "Overload",
        description: "The machine is breaking down - escape the chaos!",
        duration: 30000,
        hazards: ["random_crushers", "explosions", "sparks"],
        platformPattern: "chaotic",
        musicIntensity: 3
      }
    ],
    victoryCondition: "survive_escape",
    defeatSong: "machine_shutdown",
    arenaWidth: 50,
    arenaHeight: 12
  },

  3: {
    name: "Spotlight Drones",
    subtitle: "Eyes in the Sky",
    description: "Security drones scanning for unauthorized performers. Don't get caught!",
    phases: [
      {
        name: "Patrol Pattern",
        description: "Learn drone movements and find safe shadows",
        duration: 40000,
        hazards: ["scanning_drones", "alarm_triggers"],
        platformPattern: "stealth",
        musicIntensity: 1
      },
      {
        name: "Alert Status",
        description: "More drones deployed - timing is everything",
        duration: 45000,
        hazards: ["fast_drones", "laser_grids", "alarm_triggers"],
        platformPattern: "precision_timing",
        musicIntensity: 2
      },
      {
        name: "Lockdown",
        description: "Full lockdown! Reach the exit before total containment!",
        duration: 35000,
        hazards: ["converging_drones", "closing_walls"],
        platformPattern: "speedrun",
        musicIntensity: 3
      }
    ],
    victoryCondition: "reach_exit",
    defeatSong: "drone_evaded",
    arenaWidth: 45,
    arenaHeight: 18
  },

  4: {
    name: "The Critics",
    subtitle: "Judgment Day",
    description: "Music critics manifest as literal obstacles. Survive their harsh reviews!",
    phases: [
      {
        name: "Opening Reviews",
        description: "Dodge review score projectiles",
        duration: 35000,
        hazards: ["score_projectiles", "written_attacks"],
        platformPattern: "dodge",
        musicIntensity: 1
      },
      {
        name: "The Pile-On",
        description: "Multiple critics attack simultaneously",
        duration: 40000,
        hazards: ["multi_critics", "score_bombs"],
        platformPattern: "multi_dodge",
        musicIntensity: 2
      },
      {
        name: "Career Ender",
        description: "The ultimate bad review - climb to prove them wrong!",
        duration: 30000,
        hazards: ["rising_bad_reviews", "final_critic"],
        platformPattern: "vertical_escape",
        musicIntensity: 3
      }
    ],
    victoryCondition: "reach_top",
    defeatSong: "critics_silenced",
    arenaWidth: 35,
    arenaHeight: 25
  },

  5: {
    name: "The Headliner",
    subtitle: "Festival Showdown",
    description: "The main act won't share the stage. Survive the ultimate showdown!",
    phases: [
      {
        name: "Opening Act",
        description: "Navigate the pyrotechnics display",
        duration: 40000,
        hazards: ["pyrotechnics", "crowd_surge"],
        platformPattern: "spectacle",
        musicIntensity: 1
      },
      {
        name: "Main Event",
        description: "The headliner fights back with massive stage effects",
        duration: 50000,
        hazards: ["giant_speakers", "laser_show", "crowd_waves"],
        platformPattern: "arena",
        musicIntensity: 2
      },
      {
        name: "Encore Destruction",
        description: "The stage is collapsing! Escape to the crowd!",
        duration: 35000,
        hazards: ["total_stage_collapse", "falling_lights"],
        platformPattern: "dramatic_escape",
        musicIntensity: 3
      }
    ],
    victoryCondition: "escape_to_crowd",
    defeatSong: "headliner_defeated",
    arenaWidth: 60,
    arenaHeight: 20
  },

  // === ACT II BOSSES ===
  6: {
    name: "The Silence",
    subtitle: "Void of Sound",
    description: "Navigate through near-complete darkness using only brief flashes of light.",
    phases: [
      {
        name: "Dim Light",
        description: "Intermittent lighting reveals the path",
        duration: 45000,
        hazards: ["darkness", "ice_patches", "hidden_pits"],
        platformPattern: "memory",
        musicIntensity: 1
      },
      {
        name: "Blackout",
        description: "Almost total darkness - rely on sound cues",
        duration: 50000,
        hazards: ["total_darkness", "sound_hazards"],
        platformPattern: "audio_cues",
        musicIntensity: 2
      },
      {
        name: "Dawn",
        description: "Light returns but so do the hazards - escape quickly!",
        duration: 30000,
        hazards: ["blinding_light", "exposed_hazards"],
        platformPattern: "final_push",
        musicIntensity: 3
      }
    ],
    victoryCondition: "find_the_light",
    defeatSong: "silence_broken",
    arenaWidth: 50,
    arenaHeight: 15
  },

  7: {
    name: "Algorithm Engine",
    subtitle: "The Formula",
    description: "A predictive AI that adapts to your playstyle. Stay unpredictable!",
    phases: [
      {
        name: "Pattern Recognition",
        description: "The AI learns your movement patterns",
        duration: 40000,
        hazards: ["predictive_lasers", "tracking_drones"],
        platformPattern: "adaptive",
        musicIntensity: 1
      },
      {
        name: "Counter-Play",
        description: "The AI predicts where you'll go - be unpredictable!",
        duration: 50000,
        hazards: ["prediction_attacks", "pattern_traps"],
        platformPattern: "random_required",
        musicIntensity: 2
      },
      {
        name: "System Crash",
        description: "Overload the algorithm with chaos!",
        duration: 35000,
        hazards: ["glitching_attacks", "system_errors"],
        platformPattern: "exploit_glitches",
        musicIntensity: 3
      }
    ],
    victoryCondition: "crash_system",
    defeatSong: "algorithm_defeated",
    arenaWidth: 45,
    arenaHeight: 18
  },

  8: {
    name: "The Encore",
    subtitle: "Never Ending Show",
    description: "The crowd demands more! Survive increasingly demanding encores!",
    phases: [
      {
        name: "First Encore",
        description: "The crowd throws memorabilia - dodge with style!",
        duration: 35000,
        hazards: ["thrown_objects", "crowd_hands"],
        platformPattern: "performance",
        musicIntensity: 1
      },
      {
        name: "Second Encore",
        description: "The stage extends - more hazards, more glory!",
        duration: 45000,
        hazards: ["extending_stage", "pyro_hazards", "fan_rush"],
        platformPattern: "expanding",
        musicIntensity: 2
      },
      {
        name: "Final Bow",
        description: "Give them the show of a lifetime!",
        duration: 40000,
        hazards: ["everything_at_once", "ultimate_pyro"],
        platformPattern: "grand_finale",
        musicIntensity: 3
      }
    ],
    victoryCondition: "complete_encore",
    defeatSong: "crowd_satisfied",
    arenaWidth: 55,
    arenaHeight: 16
  },

  9: {
    name: "The Interview",
    subtitle: "Trial by Media",
    description: "Dodge loaded questions that manifest as physical attacks!",
    phases: [
      {
        name: "Softball Questions",
        description: "Easy questions, easy dodges",
        duration: 35000,
        hazards: ["question_projectiles", "microphone_swings"],
        platformPattern: "interview_set",
        musicIntensity: 1
      },
      {
        name: "Gotcha Journalism",
        description: "Trick questions come from all angles!",
        duration: 45000,
        hazards: ["multi_direction_questions", "camera_flashes"],
        platformPattern: "media_circus",
        musicIntensity: 2
      },
      {
        name: "Cancel Storm",
        description: "The internet has arrived - escape the cancel culture!",
        duration: 30000,
        hazards: ["viral_attacks", "trending_hazards"],
        platformPattern: "viral_escape",
        musicIntensity: 3
      }
    ],
    victoryCondition: "survive_interview",
    defeatSong: "media_handled",
    arenaWidth: 40,
    arenaHeight: 15
  },

  10: {
    name: "Auto-Tune Entity",
    subtitle: "Pitch Perfect Prison",
    description: "Platforms appear on beat - mistiming causes collapse!",
    phases: [
      {
        name: "4/4 Time",
        description: "Simple beat - platforms on the quarter note",
        duration: 45000,
        hazards: ["beat_platforms", "off_beat_collapse"],
        platformPattern: "rhythmic_simple",
        musicIntensity: 1
      },
      {
        name: "Syncopation",
        description: "Complex rhythms - feel the off-beats!",
        duration: 50000,
        hazards: ["syncopated_platforms", "tempo_changes"],
        platformPattern: "rhythmic_complex",
        musicIntensity: 2
      },
      {
        name: "Breakdown",
        description: "The beat drops - pure speed and precision!",
        duration: 35000,
        hazards: ["rapid_beats", "drop_collapse"],
        platformPattern: "rhythmic_intense",
        musicIntensity: 3
      }
    ],
    victoryCondition: "master_the_beat",
    defeatSong: "auto_tune_defeated",
    arenaWidth: 50,
    arenaHeight: 20
  },

  // === ACT III BOSSES ===
  11: {
    name: "The Reflection",
    subtitle: "Shadow Self",
    description: "Fight your own shadow that mimics your movements with a delay!",
    phases: [
      {
        name: "Mirror Match",
        description: "Your shadow follows - don't let it catch you!",
        duration: 40000,
        hazards: ["shadow_copy", "mirror_traps"],
        platformPattern: "mirror",
        musicIntensity: 1
      },
      {
        name: "Distortion",
        description: "Multiple shadows with different delays!",
        duration: 50000,
        hazards: ["multi_shadows", "distorted_mirrors"],
        platformPattern: "multi_mirror",
        musicIntensity: 2
      },
      {
        name: "Integration",
        description: "Merge with your shadow to become whole!",
        duration: 35000,
        hazards: ["convergence", "final_mirror"],
        platformPattern: "unity",
        musicIntensity: 3
      }
    ],
    victoryCondition: "accept_shadow",
    defeatSong: "reflection_merged",
    arenaWidth: 40,
    arenaHeight: 20
  },

  12: {
    name: "The Metronome",
    subtitle: "Keeper of Time",
    description: "Survive constantly shifting time speeds!",
    phases: [
      {
        name: "Steady Beat",
        description: "Alternating slow and fast zones",
        duration: 45000,
        hazards: ["time_zones", "speed_transitions"],
        platformPattern: "time_split",
        musicIntensity: 1
      },
      {
        name: "Time Warp",
        description: "Zones shift unpredictably!",
        duration: 50000,
        hazards: ["moving_time_zones", "paradox_traps"],
        platformPattern: "time_chaos",
        musicIntensity: 2
      },
      {
        name: "Temporal Collapse",
        description: "All times exist at once - find the right moment!",
        duration: 40000,
        hazards: ["overlapping_times", "moment_finding"],
        platformPattern: "time_mastery",
        musicIntensity: 3
      }
    ],
    victoryCondition: "master_time",
    defeatSong: "metronome_stopped",
    arenaWidth: 55,
    arenaHeight: 18
  },

  13: {
    name: "The Feedback Loop",
    subtitle: "Infinite Noise",
    description: "Escape infinitely spawning noise and corruption!",
    phases: [
      {
        name: "Static",
        description: "Glitching platforms and visual corruption",
        duration: 40000,
        hazards: ["glitch_platforms", "static_zones"],
        platformPattern: "glitch",
        musicIntensity: 1
      },
      {
        name: "Corruption",
        description: "The world is breaking down!",
        duration: 50000,
        hazards: ["spreading_corruption", "data_fragments"],
        platformPattern: "corruption",
        musicIntensity: 2
      },
      {
        name: "System Restore",
        description: "Find the clean signal in the noise!",
        duration: 35000,
        hazards: ["noise_walls", "signal_path"],
        platformPattern: "signal_finding",
        musicIntensity: 3
      }
    ],
    victoryCondition: "find_signal",
    defeatSong: "feedback_cleared",
    arenaWidth: 50,
    arenaHeight: 20
  },

  14: {
    name: "The Perfectionist",
    subtitle: "Flawless Execution",
    description: "A gauntlet requiring perfect platforming - no mistakes allowed!",
    phases: [
      {
        name: "Warm Up",
        description: "Practice the patterns",
        duration: 40000,
        hazards: ["precision_platforms", "tight_gaps"],
        platformPattern: "precision",
        musicIntensity: 1
      },
      {
        name: "The Test",
        description: "Execute the full gauntlet",
        duration: 50000,
        hazards: ["full_gauntlet", "no_checkpoints"],
        platformPattern: "gauntlet",
        musicIntensity: 2
      },
      {
        name: "Perfection",
        description: "The ultimate test - one chance!",
        duration: 60000,
        hazards: ["ultimate_precision", "single_attempt"],
        platformPattern: "ultimate",
        musicIntensity: 3
      }
    ],
    victoryCondition: "achieve_perfection",
    defeatSong: "perfectionist_humbled",
    arenaWidth: 80,
    arenaHeight: 15
  },

  15: {
    name: "Self-Doubt Manifestation",
    subtitle: "The Final Chord",
    description: "Face your ultimate fear - the belief that you're not good enough.",
    phases: [
      {
        name: "Whispers",
        description: "Doubts manifest as obstacles - push through!",
        duration: 50000,
        hazards: ["doubt_barriers", "negative_thoughts"],
        platformPattern: "psychological",
        musicIntensity: 1
      },
      {
        name: "The Void",
        description: "Platform through the emptiness within",
        duration: 60000,
        hazards: ["void_hazards", "falling_confidence"],
        platformPattern: "void",
        musicIntensity: 2
      },
      {
        name: "Acceptance",
        description: "The final speedrun - believe in yourself!",
        duration: 45000,
        hazards: ["everything", "final_rush"],
        platformPattern: "triumphant",
        musicIntensity: 3
      }
    ],
    victoryCondition: "overcome_doubt",
    defeatSong: "the_diminished_chord_complete",
    arenaWidth: 100,
    arenaHeight: 25
  }
}

/**
 * BossFightManager - Handles boss fight state and mechanics
 */
export class BossFightManager {
  constructor(scene, worldNum) {
    this.scene = scene
    this.worldNum = worldNum
    this.bossData = BOSS_DATA[worldNum]
    
    this.currentPhase = 0
    this.phaseTimer = 0
    this.isActive = false
    this.isDefeated = false
    
    this.hazards = []
    this.platforms = []
  }

  start() {
    this.isActive = true
    this.currentPhase = 0
    this.startPhase(0)
    
    // Create boss intro
    this.showBossIntro()
  }

  showBossIntro() {
    const { width, height } = this.scene.cameras.main
    
    // Dark overlay
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    overlay.setDepth(100)

    // Boss name
    const nameText = this.scene.add.text(width / 2, height / 2 - 40, this.bossData.name.toUpperCase(), {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#ff4444"
    }).setOrigin(0.5).setDepth(101)

    // Subtitle
    const subtitleText = this.scene.add.text(width / 2, height / 2, `"${this.bossData.subtitle}"`, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4"
    }).setOrigin(0.5).setDepth(101)

    // Description
    const descText = this.scene.add.text(width / 2, height / 2 + 40, this.bossData.description, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5).setDepth(101)

    // Animate intro
    this.scene.tweens.add({
      targets: [overlay, nameText, subtitleText, descText],
      alpha: 0,
      delay: 3000,
      duration: 1000,
      onComplete: () => {
        overlay.destroy()
        nameText.destroy()
        subtitleText.destroy()
        descText.destroy()
        this.beginPhase()
      }
    })
  }

  startPhase(phaseIndex) {
    this.currentPhase = phaseIndex
    const phase = this.bossData.phases[phaseIndex]
    
    this.phaseTimer = phase.duration
    
    // Show phase announcement
    this.showPhaseAnnouncement(phase)
  }

  showPhaseAnnouncement(phase) {
    const { width, height } = this.scene.cameras.main
    
    const phaseText = this.scene.add.text(width / 2, 100, `PHASE ${this.currentPhase + 1}: ${phase.name}`, {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffaa00",
      backgroundColor: "#000000aa",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(50)

    this.scene.tweens.add({
      targets: phaseText,
      alpha: 0,
      y: 80,
      delay: 2000,
      duration: 500,
      onComplete: () => phaseText.destroy()
    })
  }

  beginPhase() {
    // Override in specific boss implementations
    // This is where phase-specific hazards are created
  }

  update(delta) {
    if (!this.isActive || this.isDefeated) return

    this.phaseTimer -= delta

    // Check phase completion
    if (this.phaseTimer <= 0) {
      this.completePhase()
    }

    // Update hazards
    this.updateHazards(delta)
  }

  updateHazards(delta) {
    // Override for specific hazard behaviors
  }

  completePhase() {
    if (this.currentPhase < this.bossData.phases.length - 1) {
      // Move to next phase
      this.currentPhase++
      this.startPhase(this.currentPhase)
    } else {
      // Boss defeated!
      this.defeatBoss()
    }
  }

  defeatBoss() {
    this.isDefeated = true
    this.isActive = false

    // Show victory sequence
    this.showVictorySequence()
  }

  showVictorySequence() {
    const { width, height } = this.scene.cameras.main

    // Victory overlay
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    overlay.setDepth(100)

    const victoryText = this.scene.add.text(width / 2, height / 2 - 30, "BOSS DEFEATED!", {
      fontFamily: "RetroPixel",
      fontSize: "36px",
      color: "#00ff88"
    }).setOrigin(0.5).setDepth(101)

    const bossText = this.scene.add.text(width / 2, height / 2 + 20, this.bossData.name, {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4"
    }).setOrigin(0.5).setDepth(101)

    // Trigger level completion after delay
    this.scene.time.delayedCall(3000, () => {
      this.scene.events.emit("bossDefeated", this.worldNum)
    })
  }

  // Helper methods for creating common hazard types
  createFallingHazard(x, width, speed, type = "generic") {
    // Implementation for falling hazards
  }

  createMovingPlatform(x, y, width, pattern) {
    // Implementation for boss-specific platforms
  }

  createProjectile(x, y, velocityX, velocityY, type) {
    // Implementation for projectile hazards
  }
}

/**
 * Get boss data for a specific world
 */
export function getBossData(worldNum) {
  return BOSS_DATA[worldNum] || null
}

/**
 * Get all boss names for display
 */
export function getAllBossNames() {
  const names = []
  for (let i = 1; i <= 15; i++) {
    names.push({
      world: i,
      name: BOSS_DATA[i].name,
      subtitle: BOSS_DATA[i].subtitle
    })
  }
  return names
}
