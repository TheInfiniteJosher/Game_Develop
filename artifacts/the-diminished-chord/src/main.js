import Phaser from "phaser"
import { screenSize, debugConfig, renderConfig } from "./gameConfig.json"

// Import scenes
import { InitialLoadingScene } from "./InitialLoadingScene.js"
import { IntroScene } from "./IntroScene.js"
import { PreTitleScreen } from "./PreTitleScreen.js"
import { StartScreen } from "./StartScreen.js"
import { TitleScreen } from "./TitleScreen.js"

// Level Scenes (Legacy 11 levels - kept for backward compatibility)
import { Level1Scene } from "./Level1Scene.js"
import { Level2Scene } from "./Level2Scene.js"
import { Level3Scene } from "./Level3Scene.js"
import { Level4Scene } from "./Level4Scene.js"
import { Level5Scene } from "./Level5Scene.js"
import { Level6Scene } from "./Level6Scene.js"
import { Level7Scene } from "./Level7Scene.js"
import { Level8Scene } from "./Level8Scene.js"
import { Level9Scene } from "./Level9Scene.js"
import { Level10Scene } from "./Level10Scene.js"
import { Level11Scene } from "./Level11Scene.js"

// New World/Level System (301 levels)
import { UniverseSelectScene } from "./UniverseSelectScene.js"
import { WorldLevelSelectScene } from "./WorldLevelSelectScene.js"
import { DynamicLevelScene } from "./DynamicLevelScene.js"
import { TutorialWorldScene } from "./TutorialWorldScene.js"

// Cutscene System - World Intro Scenes
import { World1IntroScene } from "./World1IntroScene.js"
import { World2IntroScene } from "./World2IntroScene.js"
import { World3IntroScene } from "./World3IntroScene.js"
import { World4IntroScene } from "./World4IntroScene.js"
import { World5IntroScene } from "./World5IntroScene.js"
import { World6IntroScene } from "./World6IntroScene.js"
import { World7IntroScene } from "./World7IntroScene.js"
import { World8IntroScene } from "./World8IntroScene.js"
import { World9IntroScene } from "./World9IntroScene.js"
import { World10IntroScene } from "./World10IntroScene.js"
import { World11IntroScene } from "./World11IntroScene.js"
import { World12IntroScene } from "./World12IntroScene.js"
import { World13IntroScene } from "./World13IntroScene.js"
import { World14IntroScene } from "./World14IntroScene.js"
import { World15IntroScene } from "./World15IntroScene.js"
import { CutsceneGalleryScene } from "./CutsceneGalleryScene.js"

// Cutscene System - Post-Boss Scenes
import { World1PostBossScene } from "./World1PostBossScene.js"
import { World2PostBossScene } from "./World2PostBossScene.js"
import { World3PostBossScene } from "./World3PostBossScene.js"
import { World4PostBossScene } from "./World4PostBossScene.js"
import { World5PostBossScene } from "./World5PostBossScene.js"
import { World6PostBossScene } from "./World6PostBossScene.js"
import { World7PostBossScene } from "./World7PostBossScene.js"
import { World8PostBossScene } from "./World8PostBossScene.js"
import { World9PostBossScene } from "./World9PostBossScene.js"
import { World10PostBossScene } from "./World10PostBossScene.js"
import { World11PostBossScene } from "./World11PostBossScene.js"
import { World12PostBossScene } from "./World12PostBossScene.js"
import { World13PostBossScene } from "./World13PostBossScene.js"
import { World14PostBossScene } from "./World14PostBossScene.js"
import { World15PostBossScene } from "./World15PostBossScene.js"

// Cutscene System - End of Act Scenes
import { Act1EndScene } from "./Act1EndScene.js"
import { Act2EndScene } from "./Act2EndScene.js"
import { Act3EndScene } from "./Act3EndScene.js"

// Cutscene System - Epilogue and Bonus Scenes
import { EpilogueScene } from "./EpilogueScene.js"
import { BonusUnlock1Scene } from "./BonusUnlock1Scene.js"
import { BonusUnlock2Scene } from "./BonusUnlock2Scene.js"

// Cutscene Flow Handler
import { PostBossCutsceneHandler } from "./PostBossCutsceneHandler.js"

// Boss Level Scenes (dedicated scenes with unique mechanics)
import { BossLevel1Scene } from "./BossLevel1Scene.js"

// UI Scenes
import { UIScene } from "./UIScene.js"
import { GameOverUIScene } from "./GameOverUIScene.js"
import { VictoryUIScene } from "./VictoryUIScene.js"
import { GameCompleteUIScene } from "./GameCompleteUIScene.js"
import { PauseMenuScene } from "./PauseMenuScene.js"
import { MusicLibraryScene } from "./MusicLibraryScene.js"
import { MusicControlScene } from "./MusicControlScene.js"
import { InterstitialAdScene } from "./InterstitialAdScene.js"
import { GhostReplayScene } from "./GhostReplayScene.js"

// Authentication & Profile Scenes
import { SignInScene } from "./SignInScene.js"
import { AuthScene } from "./AuthScene.js"
import { ProfileScene } from "./ProfileScene.js"

// Developer Mode Scenes
import { DeveloperMenuScene } from "./DeveloperMenuScene.js"
import { LevelSelectScene } from "./LevelSelectScene.js"
import { LevelDesignerScene } from "./LevelDesignerScene.js"
import { CustomLevelTestScene } from "./CustomLevelTestScene.js"
import { SprintModeScene } from "./SprintModeScene.js"
import { LevelBrowserScene } from "./LevelBrowserScene.js"
import { TrackUploaderScene } from "./TrackUploaderScene.js"
import { TrackPublishScene } from "./TrackPublishScene.js"
import { GameConfigScene } from "./GameConfigScene.js"
import { SettingsScene } from "./SettingsScene.js"
import { ControlsSettingsScene } from "./ControlsSettingsScene.js"
import { TouchMappingScene } from "./TouchMappingScene.js"
import { TouchButtonMapper } from "./TouchButtonMapper.js"
import { GamepadManager } from "./GamepadManager.js"
import { AudioAdminScene } from "./AudioAdminScene.js"
import { MobileControlsScene } from "./MobileControlsScene.js"

// Story & Content Editor Scenes
import { StoryEditorScene } from "./StoryEditorScene.js"
import { WorldEditorScene } from "./WorldEditorScene.js"
import { BossDesignerScene } from "./BossDesignerScene.js"
import { BandMemberEditorScene } from "./BandMemberEditorScene.js"
import { ArtPromptLibraryScene } from "./ArtPromptLibraryScene.js"
import { AdConfigEditorScene } from "./AdConfigEditorScene.js"

/**
 * The Diminished Chord
 * A Super Meat Boy-style precision platformer with music collection mechanics
 * 
 * Features:
 * - 301 levels across 15 worlds + tutorial
 * - Music fragment collection system
 * - 15 unique boss fights
 * - Developer mode with level designer
 * - Track management system for 301 tracks
 */
const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: screenSize.width.value,
  height: screenSize.height.value,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true, // Enable gamepad support
  },
  physics: {
    default: "arcade",
    arcade: {
      fps: 120,
      gravity: { y: 0 }, // Default no gravity - individual objects set their own
      debug: debugConfig.debug.value,
      debugShowBody: debugConfig.debugShowBody.value,
      debugShowStaticBody: debugConfig.debugShowStaticBody.value,
      debugShowVelocity: debugConfig.debugShowVelocity.value,
    },
  },
  pixelArt: renderConfig.pixelArt.value,
  scene: [
    // Preloader
    InitialLoadingScene,
    
    // Pre-Title Screen (user input gate for audio)
    PreTitleScreen,
    
    // Cinematic Intro
    IntroScene,
    
    // Start Screen (logo + start button)
    StartScreen,
    
    // Main Menu
    TitleScreen,
    
    // World Selection System (NEW - 301 levels)
    UniverseSelectScene,
    WorldLevelSelectScene,
    DynamicLevelScene,
    TutorialWorldScene,

    // Boss Level Scenes
    BossLevel1Scene,
    
    // Cutscene System - World Intros
    World1IntroScene,
    World2IntroScene,
    World3IntroScene,
    World4IntroScene,
    World5IntroScene,
    World6IntroScene,
    World7IntroScene,
    World8IntroScene,
    World9IntroScene,
    World10IntroScene,
    World11IntroScene,
    World12IntroScene,
    World13IntroScene,
    World14IntroScene,
    World15IntroScene,
    CutsceneGalleryScene,
    
    // Cutscene System - Post-Boss Scenes
    World1PostBossScene,
    World2PostBossScene,
    World3PostBossScene,
    World4PostBossScene,
    World5PostBossScene,
    World6PostBossScene,
    World7PostBossScene,
    World8PostBossScene,
    World9PostBossScene,
    World10PostBossScene,
    World11PostBossScene,
    World12PostBossScene,
    World13PostBossScene,
    World14PostBossScene,
    World15PostBossScene,
    
    // Cutscene System - End of Act Scenes
    Act1EndScene,
    Act2EndScene,
    Act3EndScene,
    
    // Cutscene System - Epilogue and Bonus
    EpilogueScene,
    BonusUnlock1Scene,
    BonusUnlock2Scene,
    
    // Cutscene Flow Handler
    PostBossCutsceneHandler,
    
    // Legacy Game Levels (kept for backward compatibility)
    Level1Scene,
    Level2Scene,
    Level3Scene,
    Level4Scene,
    Level5Scene,
    Level6Scene,
    Level7Scene,
    Level8Scene,
    Level9Scene,
    Level10Scene,
    Level11Scene,
    
    // UI Overlays
    UIScene,
    VictoryUIScene,
    GameCompleteUIScene,
    GameOverUIScene,
    PauseMenuScene,
    MusicLibraryScene,
    MusicControlScene,
    InterstitialAdScene,
    GhostReplayScene,
    SettingsScene,
    ControlsSettingsScene,
    TouchMappingScene,
    
    // Authentication & Profile
    SignInScene,
    AuthScene,
    ProfileScene,
    
    // Developer Mode
    DeveloperMenuScene,
    LevelSelectScene,
    LevelDesignerScene,
    CustomLevelTestScene,
    SprintModeScene,
    LevelBrowserScene,
    TrackUploaderScene,
    TrackPublishScene,
    GameConfigScene,
    AudioAdminScene,
    
    // Story & Content Editors
    StoryEditorScene,
    WorldEditorScene,
    BossDesignerScene,
    BandMemberEditorScene,
    ArtPromptLibraryScene,
    AdConfigEditorScene,
    
    // Mobile Controls (touch screen overlay)
    MobileControlsScene
  ],
}

export default new Phaser.Game(config)
