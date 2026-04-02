/**
 * AuthScene - User authentication UI
 * 
 * Provides login, signup, and password reset functionality
 * with a punk rock themed interface
 */

import Phaser from "phaser"
import { AuthManager } from "./AuthManager.js"
import { UserProfileManager } from "./UserProfileManager.js"

export class AuthScene extends Phaser.Scene {
  constructor() {
    super({ key: "AuthScene" })
    this.mode = "login" // 'login', 'signup', 'reset'
    this.inputFields = {}
    this.isLoading = false
  }

  init(data) {
    this.returnScene = data?.returnScene || "TitleScreen"
    this.mode = data?.mode || "login"
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Background
    this.createBackground()

    // Container for all UI elements
    this.uiContainer = this.add.container(centerX, centerY)

    // Create form based on mode
    this.createForm()

    // Back button
    this.createBackButton()

    // Setup keyboard
    this.setupInput()
  }

  createBackground() {
    // Dark background
    this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x0a0a15
    ).setOrigin(0, 0)

    // Punk diagonal lines
    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0xff00ff, 0.1)

    for (let i = -this.cameras.main.height; i < this.cameras.main.width + this.cameras.main.height; i += 80) {
      graphics.beginPath()
      graphics.moveTo(i, 0)
      graphics.lineTo(i + this.cameras.main.height, this.cameras.main.height)
      graphics.strokePath()
    }
  }

  createForm() {
    this.uiContainer.removeAll(true)
    const yStart = -180

    // Title based on mode
    const titles = {
      login: "SIGN IN",
      signup: "CREATE ACCOUNT",
      reset: "RESET PASSWORD"
    }

    const title = this.add.text(0, yStart, titles[this.mode], {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.uiContainer.add(title)

    // Subtitle
    const subtitles = {
      login: "Enter your credentials to continue",
      signup: "Join The Diminished Chord community",
      reset: "We'll send you a reset link"
    }

    const subtitle = this.add.text(0, yStart + 45, subtitles[this.mode], {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5)
    this.uiContainer.add(subtitle)

    // Input fields - using placeholder text instead of labels
    let fieldY = yStart + 90

    // Email field (all modes)
    this.createInputField("email", "Email", fieldY)
    fieldY += 52

    // Password field (login and signup)
    if (this.mode !== "reset") {
      this.createInputField("password", "Password", fieldY, true)
      fieldY += 52
    }

    // Username field (signup only)
    if (this.mode === "signup") {
      this.createInputField("username", "Username", fieldY)
      fieldY += 52

      // Confirm password
      this.createInputField("confirmPassword", "Confirm Password", fieldY, true)
      fieldY += 52
    }

    // Error message area
    this.errorText = this.add.text(0, fieldY + 10, "", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff4444",
      wordWrap: { width: 280 }
    }).setOrigin(0.5)
    this.uiContainer.add(this.errorText)

    // Submit button
    this.submitButton = this.createActionButton(
      0, fieldY + 60,
      this.getSubmitLabel(),
      () => this.handleSubmit()
    )
    this.uiContainer.add(this.submitButton)

    // Mode switch buttons
    this.createModeSwitch(fieldY + 130)

    // OAuth providers (only for login and signup)
    if (this.mode !== "reset") {
      this.createOAuthButtons(fieldY + 200)
    }
  }

  createInputField(key, label, y, isPassword = false) {
    // Input background (no plain text label - using placeholder instead)
    const inputBg = this.add.rectangle(0, y, 280, 42, 0x1a1a2e)
    inputBg.setStrokeStyle(2, 0x444444)
    this.uiContainer.add(inputBg)

    // Create HTML input element
    const inputElement = document.createElement("input")
    inputElement.type = isPassword ? "password" : (key === "email" ? "email" : "text")
    inputElement.placeholder = label
    inputElement.style.cssText = `
      position: absolute;
      width: 260px;
      height: 34px;
      background: transparent;
      border: none;
      color: #ffffff;
      font-family: monospace;
      font-size: 14px;
      outline: none;
      padding: 0 10px;
    `
    
    // Position the input
    this.positionInput(inputElement, y)

    // Store reference
    this.inputFields[key] = {
      element: inputElement,
      bg: inputBg
    }

    // Add to DOM
    document.body.appendChild(inputElement)

    // Focus styling
    inputElement.addEventListener("focus", () => {
      inputBg.setStrokeStyle(2, 0xff69b4)
    })
    inputElement.addEventListener("blur", () => {
      inputBg.setStrokeStyle(2, 0x444444)
    })
  }

  positionInput(inputElement, y) {
    const canvas = this.game.canvas
    const rect = canvas.getBoundingClientRect()
    const scale = rect.width / this.cameras.main.width

    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    inputElement.style.left = `${centerX - 130 * scale}px`
    inputElement.style.top = `${centerY + y * scale - 17 * scale}px`
    inputElement.style.transform = `scale(${scale})`
    inputElement.style.transformOrigin = "left top"
  }

  createActionButton(x, y, text, callback) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 200, 45, 0xff69b4)
    bg.setInteractive({ useHandCursor: true })

    const label = this.add.text(0, 0, text, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#000000"
    }).setOrigin(0.5)

    container.add([bg, label])
    container.bg = bg
    container.label = label

    bg.on("pointerover", () => {
      bg.setFillStyle(0xff8fbc)
    })
    bg.on("pointerout", () => {
      bg.setFillStyle(0xff69b4)
    })
    bg.on("pointerdown", callback)

    return container
  }

  createModeSwitch(y) {
    if (this.mode === "login") {
      // Sign up link - stacked vertically for readability
      const signupText = this.add.text(0, y, "Don't have an account?", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }).setOrigin(0.5)
      this.uiContainer.add(signupText)

      const signupLink = this.add.text(0, y + 20, "Sign Up", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#00ff88"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      signupLink.on("pointerdown", () => this.switchMode("signup"))
      this.uiContainer.add(signupLink)

      // Forgot password link
      const forgotLink = this.add.text(0, y + 50, "Forgot Password?", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ff69b4"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      forgotLink.on("pointerdown", () => this.switchMode("reset"))
      this.uiContainer.add(forgotLink)

    } else if (this.mode === "signup") {
      // Login link - stacked vertically for readability
      const loginText = this.add.text(0, y, "Already have an account?", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }).setOrigin(0.5)
      this.uiContainer.add(loginText)

      const loginLink = this.add.text(0, y + 20, "Sign In", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#00ff88"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      loginLink.on("pointerdown", () => this.switchMode("login"))
      this.uiContainer.add(loginLink)

    } else if (this.mode === "reset") {
      const backLink = this.add.text(0, y, "Back to Sign In", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#00ff88"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      backLink.on("pointerdown", () => this.switchMode("login"))
      this.uiContainer.add(backLink)
    }
  }

  createOAuthButtons(y) {
    // Divider
    const dividerLeft = this.add.rectangle(-80, y, 60, 1, 0x444444)
    const dividerText = this.add.text(0, y, "or continue with", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5)
    const dividerRight = this.add.rectangle(80, y, 60, 1, 0x444444)
    this.uiContainer.add([dividerLeft, dividerText, dividerRight])

    // Get OAuth providers
    const providers = AuthManager.getOAuthProviders()
    const buttonSize = 42
    const spacing = 52
    const totalWidth = (providers.length - 1) * spacing
    const startX = -totalWidth / 2

    providers.forEach((provider, index) => {
      const btnX = startX + index * spacing
      const btnY = y + 40

      // Button background
      const btnBg = this.add.circle(btnX, btnY, buttonSize / 2, 
        Phaser.Display.Color.HexStringToColor(provider.color).color, 0.9)
      btnBg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(provider.color).color)
      btnBg.setInteractive({ useHandCursor: true })

      // Button icon/text
      const btnIcon = this.add.text(btnX, btnY, provider.icon, {
        fontFamily: provider.id === 'apple' ? 'Arial' : 'RetroPixel',
        fontSize: provider.id === 'apple' ? '20px' : '16px',
        color: provider.id === 'apple' ? '#ffffff' : '#ffffff'
      }).setOrigin(0.5)

      this.uiContainer.add([btnBg, btnIcon])

      // Hover effects
      btnBg.on("pointerover", () => {
        btnBg.setScale(1.1)
        btnBg.setStrokeStyle(2, 0xffffff)
      })
      btnBg.on("pointerout", () => {
        btnBg.setScale(1)
        btnBg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(provider.color).color)
      })
      btnBg.on("pointerdown", () => {
        this.handleOAuthSignIn(provider.id)
      })
    })
  }

  async handleOAuthSignIn(provider) {
    this.showError(`Connecting to ${provider}...`)
    this.errorText.setColor("#888888")

    const result = await AuthManager.signInWithProvider(provider)
    
    if (!result.success) {
      this.showError(result.error || `Failed to connect to ${provider}`)
    }
    // If successful, user will be redirected by OAuth flow
  }

  createBackButton() {
    const backBtn = this.add.text(30, 30, "← BACK", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#666666"
    }).setInteractive({ useHandCursor: true })

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => this.goBack())
  }

  setupInput() {
    this.input.keyboard.on("keydown-ESC", () => {
      this.goBack()
    })

    this.input.keyboard.on("keydown-ENTER", () => {
      this.handleSubmit()
    })
  }

  getSubmitLabel() {
    const labels = {
      login: "SIGN IN",
      signup: "CREATE ACCOUNT",
      reset: "SEND RESET EMAIL"
    }
    return labels[this.mode]
  }

  switchMode(newMode) {
    // Remove HTML inputs
    this.removeInputs()
    this.mode = newMode
    this.createForm()
  }

  removeInputs() {
    Object.values(this.inputFields).forEach(field => {
      if (field.element && field.element.parentNode) {
        field.element.parentNode.removeChild(field.element)
      }
    })
    this.inputFields = {}
  }

  async handleSubmit() {
    if (this.isLoading) return

    // Get values
    const email = this.inputFields.email?.element?.value?.trim()
    const password = this.inputFields.password?.element?.value
    const username = this.inputFields.username?.element?.value?.trim()
    const confirmPassword = this.inputFields.confirmPassword?.element?.value

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
    this.submitButton.label.setText("LOADING...")
    this.submitButton.bg.setFillStyle(0x666666)

    let result

    if (this.mode === "login") {
      result = await AuthManager.signIn(email, password)
    } else if (this.mode === "signup") {
      result = await AuthManager.signUp(email, password, { username })
    } else if (this.mode === "reset") {
      result = await AuthManager.resetPassword(email)
    }

    this.isLoading = false
    this.submitButton.label.setText(this.getSubmitLabel())
    this.submitButton.bg.setFillStyle(0xff69b4)

    if (result.success) {
      if (this.mode === "reset") {
        this.showSuccess("Check your email for the reset link!")
      } else if (result.message) {
        // Email confirmation required
        this.showSuccess(result.message)
      } else {
        // Successfully logged in
        await UserProfileManager.loadProfile()
        this.goBack()
      }
    } else {
      this.showError(result.error || "An error occurred")
    }
  }

  showError(message) {
    this.errorText.setText(message)
    this.errorText.setColor("#ff4444")
  }

  showSuccess(message) {
    this.errorText.setText(message)
    this.errorText.setColor("#00ff88")
  }

  goBack() {
    this.removeInputs()
    this.scene.start(this.returnScene)
  }

  shutdown() {
    this.removeInputs()
  }
}
