import Phaser from "phaser"
import { musicManager } from "./MusicTrackManager.js"
import { AuthManager } from "./AuthManager.js"

/**
 * InitialLoadingScene - Preloader with progress bar
 * Loads all game assets from asset-pack.json
 * 
 * Also handles OAuth callback detection - if we're returning from OAuth,
 * the URL will contain auth tokens that Supabase will process.
 */
export class InitialLoadingScene extends Phaser.Scene {
  constructor() {
    super({ key: "InitialLoadingScene" })
    // Check if this is an OAuth callback (has tokens in URL hash)
    this.isOAuthCallback = window.location.hash.includes('access_token')
  }

  preload() {
    // Create loading UI
    this.setupLoadingProgressUI()

    // Load asset pack
    this.load.pack("assetPack", "assets/asset-pack.json")
  }

  setupLoadingProgressUI() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Background
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a0f)
      .setOrigin(0, 0)

    // Title text
    this.add.text(centerX, centerY - 100, "THE DIMINISHED CHORD", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#00ff88"
    }).setOrigin(0.5)

    // Loading text
    this.loadingText = this.add.text(centerX, centerY - 20, "Loading...", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5)

    // Progress bar background
    const barWidth = 400
    const barHeight = 30
    this.add.rectangle(centerX, centerY + 40, barWidth + 4, barHeight + 4, 0x333333)

    // Progress bar fill
    this.progressBar = this.add.rectangle(
      centerX - barWidth / 2,
      centerY + 40,
      0,
      barHeight,
      0x00ff88
    ).setOrigin(0, 0.5)

    // Progress percentage text
    this.percentText = this.add.text(centerX, centerY + 40, "0%", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#000000"
    }).setOrigin(0.5)

    // Loading events
    this.load.on("progress", (value) => {
      this.progressBar.width = barWidth * value
      this.percentText.setText(`${Math.floor(value * 100)}%`)
    })

    this.load.on("fileprogress", (file) => {
      this.loadingText.setText(`Loading: ${file.key}`)
    })

    this.load.on("complete", () => {
      this.loadingText.setText("Complete!")
      this.percentText.setText("100%")
    })
  }

  async create() {
    // Load default track assignments from bundled JSON file
    // This ensures S3/CDN track URLs persist across all browsers/sessions
    this.loadingText.setText("Loading music assignments...")
    
    try {
      await musicManager.loadDefaultAssignments()
      this.loadingText.setText("Music loaded!")
    } catch (e) {
      console.warn("[InitialLoadingScene] Music load error:", e)
      this.loadingText.setText("Music loading skipped")
    }
    
    // If this is an OAuth callback, wait for auth to initialize and check session
    if (this.isOAuthCallback) {
      this.loadingText.setText("Completing sign in...")
      
      // Wait for AuthManager to process the OAuth tokens
      await AuthManager.waitForReady()
      
      // Clear the hash from URL to prevent re-processing on refresh
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname)
      }
      
      // Clear OAuth pending flag
      sessionStorage.removeItem('oauth_pending')
      
      if (AuthManager.isLoggedIn()) {
        this.loadingText.setText("Signed in! Loading...")
        console.log("[InitialLoadingScene] OAuth successful, user logged in")
        
        // Skip to main menu after brief delay
        this.time.delayedCall(500, () => {
          this.scene.start("TitleScreen")
        })
        return
      }
    }
    
    // Brief delay before transitioning, ensuring music data is ready
    this.time.delayedCall(300, () => {
      // Go to PreTitleScreen first to get user input (required for audio autoplay)
      // Then PreTitleScreen will transition to StartScreen where music plays
      this.scene.start("PreTitleScreen")
    })
  }
}
