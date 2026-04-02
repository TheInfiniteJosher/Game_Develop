/**
 * SignInScene - Required sign-in screen before accessing the main menu
 * 
 * Uses real HTML overlay for authentic, accessible authentication UI
 * while maintaining the game's visual backdrop for atmosphere.
 */

import Phaser from "phaser"
import { AuthManager } from "./AuthManager.js"
import { UserProfileManager } from "./UserProfileManager.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

export class SignInScene extends Phaser.Scene {
  constructor() {
    super({ key: "SignInScene" })
    this.mode = "login" // 'login', 'signup', 'reset'
    this.htmlOverlay = null
    this.isLoading = false
  }

  async create() {
    // Wait for AuthManager to fully initialize (important for OAuth redirects)
    await AuthManager.waitForReady()
    
    // Check if already signed in (e.g., returning from OAuth redirect)
    if (AuthManager.isLoggedIn()) {
      console.log("[SignInScene] User already logged in, going to main menu")
      // Load profile then go to main menu
      await UserProfileManager.loadProfile()
      this.goToMainMenu()
      return
    }

    // Create Phaser background for atmosphere
    this.createBackground()

    // Create HTML overlay for auth UI
    this.createHTMLOverlay()

    // Setup keyboard shortcuts
    this.setupInput()
    
    // Listen for auth state changes (in case OAuth completes while on this screen)
    this.authUnsubscribe = AuthManager.onAuthStateChange(async (event, session, user) => {
      if (event === "SIGNED_IN" && user) {
        console.log("[SignInScene] Auth state changed to SIGNED_IN")
        await UserProfileManager.loadProfile()
        this.goToMainMenu()
      }
    })
  }

  createBackground() {
    // Use the cavern background with dark overlay
    const bg = this.add.image(0, 0, "metroid_cavern_background")
    bg.setOrigin(0, 0)
    
    const scaleX = this.cameras.main.width / bg.width
    const scaleY = this.cameras.main.height / bg.height
    const scale = Math.max(scaleX, scaleY)
    bg.setScale(scale)

    // Dark overlay for better readability
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.8
    ).setOrigin(0, 0)

    // Subtle punk diagonal lines
    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0xff00ff, 0.05)

    for (let i = -this.cameras.main.height; i < this.cameras.main.width + this.cameras.main.height; i += 100) {
      graphics.beginPath()
      graphics.moveTo(i, 0)
      graphics.lineTo(i + this.cameras.main.height, this.cameras.main.height)
      graphics.strokePath()
    }
  }

  createHTMLOverlay() {
    // Remove existing overlay if any
    this.removeHTMLOverlay()

    // Create overlay container
    this.htmlOverlay = document.createElement("div")
    this.htmlOverlay.id = "auth-overlay"
    this.htmlOverlay.innerHTML = this.getAuthHTML()
    
    // Style the overlay
    this.htmlOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    `

    document.body.appendChild(this.htmlOverlay)

    // Bind event handlers
    this.bindEventHandlers()
  }

  getAuthHTML() {
    if (this.mode === "login") {
      return this.getLoginHTML()
    } else if (this.mode === "signup") {
      return this.getSignupHTML()
    } else {
      return this.getResetHTML()
    }
  }

  getLoginHTML() {
    return `
      <div class="auth-card">
        <style>
          .auth-card {
            background: rgba(15, 15, 25, 0.98);
            border: 1px solid #333;
            border-radius: 12px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }
          
          .auth-title {
            color: #fff;
            font-size: 24px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 8px;
          }
          
          .auth-subtitle {
            color: #888;
            font-size: 14px;
            text-align: center;
            margin-bottom: 32px;
          }
          
          .oauth-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
          }
          
          .oauth-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 14px 20px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            width: 100%;
          }
          
          .oauth-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          
          .oauth-btn:active {
            transform: translateY(0);
          }
          
          .oauth-btn.spotify {
            background: #1DB954;
            color: #fff;
          }
          
          .oauth-btn.google {
            background: #fff;
            color: #333;
            border: 1px solid #ddd;
          }
          
          .oauth-btn.twitch {
            background: #9146FF;
            color: #fff;
          }
          
          .oauth-btn.facebook {
            background: #1877F2;
            color: #fff;
          }
          
          .oauth-btn svg {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
          }
          
          .divider {
            display: flex;
            align-items: center;
            gap: 16px;
            margin: 24px 0;
            color: #666;
            font-size: 13px;
          }
          
          .divider::before,
          .divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #333;
          }
          
          .form-group {
            margin-bottom: 16px;
          }
          
          .form-label {
            display: block;
            color: #aaa;
            font-size: 13px;
            margin-bottom: 6px;
          }
          
          .form-input {
            width: 100%;
            padding: 14px 16px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            color: #fff;
            font-size: 15px;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
          }
          
          .form-input:focus {
            border-color: #ff69b4;
          }
          
          .form-input::placeholder {
            color: #666;
          }
          
          .error-message {
            color: #ff4444;
            font-size: 13px;
            text-align: center;
            margin-bottom: 16px;
            min-height: 20px;
          }
          
          .success-message {
            color: #00ff88;
            font-size: 13px;
            text-align: center;
            margin-bottom: 16px;
            min-height: 20px;
          }
          
          .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #ff69b4, #ff4488);
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 8px;
          }
          
          .submit-btn:hover {
            background: linear-gradient(135deg, #ff8fbc, #ff69b4);
            transform: translateY(-1px);
          }
          
          .submit-btn:active {
            transform: translateY(0);
          }
          
          .submit-btn:disabled {
            background: #444;
            cursor: not-allowed;
            transform: none;
          }
          
          .switch-mode {
            text-align: center;
            margin-top: 24px;
            color: #888;
            font-size: 14px;
          }
          
          .switch-mode a {
            color: #00ff88;
            text-decoration: none;
            font-weight: 500;
            cursor: pointer;
          }
          
          .switch-mode a:hover {
            text-decoration: underline;
          }
          
          .forgot-link {
            text-align: center;
            margin-top: 12px;
          }
          
          .forgot-link a {
            color: #ff69b4;
            font-size: 13px;
            text-decoration: none;
            cursor: pointer;
          }
          
          .forgot-link a:hover {
            text-decoration: underline;
          }
        </style>
        
        <h1 class="auth-title">Sign In to Play</h1>
        <p class="auth-subtitle">Join The Diminished Chord</p>
        
        <div class="oauth-section">
          <button class="oauth-btn spotify" data-provider="spotify">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Continue with Spotify
          </button>
          
          <button class="oauth-btn google" data-provider="google">
            <svg viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
          
          <button class="oauth-btn twitch" data-provider="twitch">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
            </svg>
            Continue with Twitch
          </button>
          
          <button class="oauth-btn facebook" data-provider="facebook">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Continue with Facebook
          </button>
        </div>
        
        <div class="divider">or sign in with email</div>
        
        <form id="auth-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="email-input" placeholder="you@example.com" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="password-input" placeholder="••••••••" required>
          </div>
          
          <div id="message-area" class="error-message"></div>
          
          <button type="submit" class="submit-btn" id="submit-btn">Sign In</button>
        </form>
        
        <div class="switch-mode">
          Don't have an account? <a id="switch-to-signup">Create Account</a>
        </div>
        
        <div class="forgot-link">
          <a id="switch-to-reset">Forgot Password?</a>
        </div>
      </div>
    `
  }

  getSignupHTML() {
    return `
      <div class="auth-card">
        <style>
          .auth-card {
            background: rgba(15, 15, 25, 0.98);
            border: 1px solid #333;
            border-radius: 12px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }
          
          .auth-title {
            color: #fff;
            font-size: 24px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 8px;
          }
          
          .auth-subtitle {
            color: #888;
            font-size: 14px;
            text-align: center;
            margin-bottom: 32px;
          }
          
          .oauth-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
          }
          
          .oauth-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 14px 20px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            width: 100%;
          }
          
          .oauth-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          
          .oauth-btn.spotify { background: #1DB954; color: #fff; }
          .oauth-btn.google { background: #fff; color: #333; border: 1px solid #ddd; }
          .oauth-btn.twitch { background: #9146FF; color: #fff; }
          .oauth-btn.facebook { background: #1877F2; color: #fff; }
          
          .oauth-btn svg { width: 20px; height: 20px; flex-shrink: 0; }
          
          .divider {
            display: flex;
            align-items: center;
            gap: 16px;
            margin: 24px 0;
            color: #666;
            font-size: 13px;
          }
          
          .divider::before, .divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #333;
          }
          
          .form-group { margin-bottom: 16px; }
          .form-label { display: block; color: #aaa; font-size: 13px; margin-bottom: 6px; }
          
          .form-input {
            width: 100%;
            padding: 14px 16px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            color: #fff;
            font-size: 15px;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
          }
          
          .form-input:focus { border-color: #ff69b4; }
          .form-input::placeholder { color: #666; }
          
          .error-message {
            color: #ff4444;
            font-size: 13px;
            text-align: center;
            margin-bottom: 16px;
            min-height: 20px;
          }
          
          .success-message {
            color: #00ff88;
            font-size: 13px;
            text-align: center;
            margin-bottom: 16px;
            min-height: 20px;
          }
          
          .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #ff69b4, #ff4488);
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 8px;
          }
          
          .submit-btn:hover { background: linear-gradient(135deg, #ff8fbc, #ff69b4); transform: translateY(-1px); }
          .submit-btn:disabled { background: #444; cursor: not-allowed; transform: none; }
          
          .switch-mode {
            text-align: center;
            margin-top: 24px;
            color: #888;
            font-size: 14px;
          }
          
          .switch-mode a {
            color: #00ff88;
            text-decoration: none;
            font-weight: 500;
            cursor: pointer;
          }
          
          .switch-mode a:hover { text-decoration: underline; }
        </style>
        
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-subtitle">Join The Diminished Chord</p>
        
        <div class="oauth-section">
          <button class="oauth-btn spotify" data-provider="spotify">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Continue with Spotify
          </button>
          
          <button class="oauth-btn google" data-provider="google">
            <svg viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>
        
        <div class="divider">or sign up with email</div>
        
        <form id="auth-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="email-input" placeholder="you@example.com" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-input" id="username-input" placeholder="yourname" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="password-input" placeholder="••••••••" required minlength="6">
          </div>
          
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input type="password" class="form-input" id="confirm-password-input" placeholder="••••••••" required>
          </div>
          
          <div id="message-area" class="error-message"></div>
          
          <button type="submit" class="submit-btn" id="submit-btn">Create Account</button>
        </form>
        
        <div class="switch-mode">
          Already have an account? <a id="switch-to-login">Sign In</a>
        </div>
      </div>
    `
  }

  getResetHTML() {
    return `
      <div class="auth-card">
        <style>
          .auth-card {
            background: rgba(15, 15, 25, 0.98);
            border: 1px solid #333;
            border-radius: 12px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          }
          
          .auth-title {
            color: #fff;
            font-size: 24px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 8px;
          }
          
          .auth-subtitle {
            color: #888;
            font-size: 14px;
            text-align: center;
            margin-bottom: 32px;
          }
          
          .form-group { margin-bottom: 16px; }
          .form-label { display: block; color: #aaa; font-size: 13px; margin-bottom: 6px; }
          
          .form-input {
            width: 100%;
            padding: 14px 16px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            color: #fff;
            font-size: 15px;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
          }
          
          .form-input:focus { border-color: #ff69b4; }
          .form-input::placeholder { color: #666; }
          
          .error-message {
            color: #ff4444;
            font-size: 13px;
            text-align: center;
            margin-bottom: 16px;
            min-height: 20px;
          }
          
          .success-message {
            color: #00ff88;
            font-size: 13px;
            text-align: center;
            margin-bottom: 16px;
            min-height: 20px;
          }
          
          .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #ff69b4, #ff4488);
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 8px;
          }
          
          .submit-btn:hover { background: linear-gradient(135deg, #ff8fbc, #ff69b4); transform: translateY(-1px); }
          .submit-btn:disabled { background: #444; cursor: not-allowed; transform: none; }
          
          .back-link {
            text-align: center;
            margin-top: 24px;
          }
          
          .back-link a {
            color: #00ff88;
            text-decoration: none;
            font-size: 14px;
            cursor: pointer;
          }
          
          .back-link a:hover { text-decoration: underline; }
        </style>
        
        <h1 class="auth-title">Reset Password</h1>
        <p class="auth-subtitle">We'll send you a reset link</p>
        
        <form id="auth-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="email-input" placeholder="you@example.com" required>
          </div>
          
          <div id="message-area" class="error-message"></div>
          
          <button type="submit" class="submit-btn" id="submit-btn">Send Reset Link</button>
        </form>
        
        <div class="back-link">
          <a id="switch-to-login">← Back to Sign In</a>
        </div>
      </div>
    `
  }

  bindEventHandlers() {
    // OAuth buttons
    const oauthButtons = this.htmlOverlay.querySelectorAll(".oauth-btn")
    oauthButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const provider = e.currentTarget.dataset.provider
        this.handleOAuthSignIn(provider)
      })
    })

    // Form submission
    const form = this.htmlOverlay.querySelector("#auth-form")
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault()
        this.handleSubmit()
      })
    }

    // Mode switch links
    const switchToSignup = this.htmlOverlay.querySelector("#switch-to-signup")
    if (switchToSignup) {
      switchToSignup.addEventListener("click", () => this.switchMode("signup"))
    }

    const switchToLogin = this.htmlOverlay.querySelector("#switch-to-login")
    if (switchToLogin) {
      switchToLogin.addEventListener("click", () => this.switchMode("login"))
    }

    const switchToReset = this.htmlOverlay.querySelector("#switch-to-reset")
    if (switchToReset) {
      switchToReset.addEventListener("click", () => this.switchMode("reset"))
    }
  }

  switchMode(newMode) {
    this.mode = newMode
    this.createHTMLOverlay()
  }

  async handleOAuthSignIn(provider) {
    const messageArea = this.htmlOverlay.querySelector("#message-area")
    if (messageArea) {
      messageArea.textContent = `Connecting to ${provider}...`
      messageArea.className = "success-message"
    }

    // Disable all OAuth buttons during authentication
    const oauthButtons = this.htmlOverlay.querySelectorAll(".oauth-btn")
    oauthButtons.forEach(btn => btn.disabled = true)

    const result = await AuthManager.signInWithProvider(provider)
    
    // Re-enable buttons
    oauthButtons.forEach(btn => btn.disabled = false)
    
    if (result.success) {
      // Popup flow returns success directly (no redirect)
      if (messageArea) {
        messageArea.textContent = "Success! Signing you in..."
        messageArea.className = "success-message"
      }
      await UserProfileManager.loadProfile()
      this.goToMainMenu()
    } else {
      if (messageArea) {
        messageArea.textContent = result.error || `Failed to connect to ${provider}`
        messageArea.className = "error-message"
      }
    }
  }

  async handleSubmit() {
    if (this.isLoading) return

    const emailInput = this.htmlOverlay.querySelector("#email-input")
    const passwordInput = this.htmlOverlay.querySelector("#password-input")
    const usernameInput = this.htmlOverlay.querySelector("#username-input")
    const confirmPasswordInput = this.htmlOverlay.querySelector("#confirm-password-input")
    const messageArea = this.htmlOverlay.querySelector("#message-area")
    const submitBtn = this.htmlOverlay.querySelector("#submit-btn")

    const email = emailInput?.value?.trim()
    const password = passwordInput?.value
    const username = usernameInput?.value?.trim()
    const confirmPassword = confirmPasswordInput?.value

    // Validate
    if (!email) {
      this.showError("Email is required")
      return
    }

    if (this.mode !== "reset" && !password) {
      this.showError("Password is required")
      return
    }

    if (this.mode === "signup") {
      if (password.length < 6) {
        this.showError("Password must be at least 6 characters")
        return
      }
      if (password !== confirmPassword) {
        this.showError("Passwords do not match")
        return
      }
    }

    // Show loading
    this.isLoading = true
    if (submitBtn) {
      submitBtn.textContent = "Loading..."
      submitBtn.disabled = true
    }

    let result

    if (this.mode === "login") {
      result = await AuthManager.signIn(email, password)
    } else if (this.mode === "signup") {
      result = await AuthManager.signUp(email, password, { username })
    } else if (this.mode === "reset") {
      result = await AuthManager.resetPassword(email)
    }

    this.isLoading = false
    if (submitBtn) {
      submitBtn.textContent = this.mode === "login" ? "Sign In" : 
                             this.mode === "signup" ? "Create Account" : "Send Reset Link"
      submitBtn.disabled = false
    }

    if (result.success) {
      if (this.mode === "reset") {
        this.showSuccess("Check your email for the reset link!")
      } else if (result.message) {
        // Email confirmation required
        this.showSuccess(result.message)
      } else {
        // Successfully logged in
        await UserProfileManager.loadProfile()
        this.goToMainMenu()
      }
    } else {
      this.showError(result.error || "An error occurred")
    }
  }

  showError(message) {
    const messageArea = this.htmlOverlay?.querySelector("#message-area")
    if (messageArea) {
      messageArea.textContent = message
      messageArea.className = "error-message"
    }
  }

  showSuccess(message) {
    const messageArea = this.htmlOverlay?.querySelector("#message-area")
    if (messageArea) {
      messageArea.textContent = message
      messageArea.className = "success-message"
    }
  }

  setupInput() {
    // ESC to go back (optional - could go to guest mode if implemented)
  }

  removeHTMLOverlay() {
    if (this.htmlOverlay && this.htmlOverlay.parentNode) {
      this.htmlOverlay.parentNode.removeChild(this.htmlOverlay)
    }
    this.htmlOverlay = null
  }

  goToMainMenu() {
    this.removeHTMLOverlay()
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.scene.start("TitleScreen")
  }

  shutdown() {
    // Clean up auth state listener
    if (this.authUnsubscribe) {
      this.authUnsubscribe()
      this.authUnsubscribe = null
    }
    this.removeHTMLOverlay()
  }
}
