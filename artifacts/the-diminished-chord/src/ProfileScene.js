/**
 * ProfileScene - User profile view and edit UI
 * 
 * Shows user stats, achievements, and allows profile editing
 */

import Phaser from "phaser"
import { AuthManager } from "./AuthManager.js"
import { UserProfileManager, ROLES } from "./UserProfileManager.js"
import { PlayerProgressManager } from "./PlayerProgressManager.js"
import { LeaderboardManager } from "./LeaderboardManager.js"

export class ProfileScene extends Phaser.Scene {
  constructor() {
    super({ key: "ProfileScene" })
  }

  init(data) {
    this.returnScene = data?.returnScene || "TitleScreen"
    this.viewUserId = data?.userId || null // If viewing another user's profile
  }

  create() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    // Background
    this.createBackground()

    // Check if logged in
    if (!AuthManager.isLoggedIn()) {
      this.showLoginPrompt(centerX, centerY)
      return
    }

    // Load and display profile
    this.createProfileUI(centerX)

    // Back button
    this.createBackButton()

    // Setup input
    this.setupInput()
  }

  createBackground() {
    this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x0a0a15
    ).setOrigin(0, 0)

    // Decorative lines
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0xff69b4, 0.1)

    for (let y = 0; y < this.cameras.main.height; y += 40) {
      graphics.beginPath()
      graphics.moveTo(0, y)
      graphics.lineTo(this.cameras.main.width, y)
      graphics.strokePath()
    }
  }

  showLoginPrompt(centerX, centerY) {
    this.add.text(centerX, centerY - 50, "You need to be signed in\nto view your profile", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#888888",
      align: "center"
    }).setOrigin(0.5)

    const loginBtn = this.createButton(centerX, centerY + 30, "SIGN IN", () => {
      this.scene.start("AuthScene", { returnScene: "ProfileScene" })
    })
  }

  createProfileUI(centerX) {
    const profile = UserProfileManager.getProfile()
    if (!profile) return

    let yPos = 50

    // Profile header
    this.add.text(centerX, yPos, "YOUR PROFILE", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    yPos += 50

    // Avatar placeholder
    const avatarBg = this.add.circle(centerX, yPos, 40, 0x1a1a2e)
    avatarBg.setStrokeStyle(3, 0xff69b4)

    const avatarText = this.add.text(centerX, yPos, profile.username?.charAt(0)?.toUpperCase() || "?", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    yPos += 60

    // Username and role
    this.add.text(centerX, yPos, profile.display_name || profile.username || "Player", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5)

    yPos += 25

    // Role badge
    const roleColors = {
      [ROLES.PLAYER]: { bg: 0x444444, text: "#888888" },
      [ROLES.DEVELOPER]: { bg: 0xff00ff, text: "#ff00ff" },
      [ROLES.ADMIN]: { bg: 0xff0000, text: "#ff0000" }
    }
    const roleStyle = roleColors[profile.role] || roleColors[ROLES.PLAYER]

    const roleBadge = this.add.rectangle(centerX, yPos, 90, 22, roleStyle.bg, 0.3)
    roleBadge.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(roleStyle.text).color)
    this.add.text(centerX, yPos, profile.role.toUpperCase(), {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: roleStyle.text
    }).setOrigin(0.5)

    yPos += 35

    // Stats section
    this.add.text(centerX, yPos, "─── STATISTICS ───", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    }).setOrigin(0.5)

    yPos += 25

    // Get stats
    const stats = PlayerProgressManager.getTotalStats()

    const statItems = [
      { label: "Levels Completed", value: `${stats.levelsCompleted} / ${stats.totalLevels}` },
      { label: "Total Stars", value: `${stats.totalStars} / ${stats.maxStars}` },
      { label: "Fragments Collected", value: stats.totalFragments.toString() },
      { label: "Playtime", value: this.formatPlaytime(profile.total_playtime_seconds || 0) }
    ]

    const statsContainer = this.add.container(centerX - 120, yPos)
    statItems.forEach((stat, index) => {
      const statY = index * 28

      // Label
      statsContainer.add(this.add.text(0, statY, stat.label, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }))

      // Value
      statsContainer.add(this.add.text(240, statY, stat.value, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#00ff88"
      }).setOrigin(1, 0))
    })

    yPos += statItems.length * 28 + 20

    // Permissions section (if developer or admin)
    if (profile.role === ROLES.DEVELOPER || profile.role === ROLES.ADMIN) {
      this.add.text(centerX, yPos, "─── PERMISSIONS ───", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#666666"
      }).setOrigin(0.5)

      yPos += 22

      const permissions = [
        { label: "Dev Menu", enabled: profile.can_access_dev_menu },
        { label: "Level Designer", enabled: profile.can_access_level_designer },
        { label: "Track Uploader", enabled: profile.can_access_track_uploader },
        { label: "Publish Levels", enabled: profile.can_publish_levels },
        { label: "Moderate", enabled: profile.can_moderate_content }
      ]

      const permContainer = this.add.container(centerX - 90, yPos)
      permissions.forEach((perm, index) => {
        const permY = Math.floor(index / 2) * 20
        const permX = (index % 2) * 100

        const color = perm.enabled ? "#00ff88" : "#444444"
        const icon = perm.enabled ? "✓" : "✗"

        permContainer.add(this.add.text(permX, permY, `${icon} ${perm.label}`, {
          fontFamily: "RetroPixel",
          fontSize: "10px",
          color
        }))
      })

      yPos += Math.ceil(permissions.length / 2) * 20 + 15
    }

    // Action buttons
    yPos = this.cameras.main.height - 130

    // Edit profile button
    this.createButton(centerX - 90, yPos, "EDIT PROFILE", () => {
      this.showEditModal()
    }, 0x00ff88, 140)

    // Sign out button
    this.createButton(centerX + 90, yPos, "SIGN OUT", () => {
      this.handleSignOut()
    }, 0xff4444, 140)

    // Legal links at bottom
    this.createLegalLinks(centerX)
  }

  createButton(x, y, text, callback, color = 0xff69b4, width = 180) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, width, 36, color, 0.2)
    bg.setStrokeStyle(2, color)
    bg.setInteractive({ useHandCursor: true })

    const label = this.add.text(0, 0, text, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)

    container.add([bg, label])

    bg.on("pointerover", () => bg.setFillStyle(color, 0.4))
    bg.on("pointerout", () => bg.setFillStyle(color, 0.2))
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      callback()
    })

    return container
  }

  createLegalLinks(centerX) {
    const y = this.cameras.main.height - 30

    // Privacy Policy link
    const privacyLink = this.add.text(centerX - 80, y, "Privacy Policy", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    privacyLink.on("pointerover", () => privacyLink.setColor("#ff69b4"))
    privacyLink.on("pointerout", () => privacyLink.setColor("#666666"))
    privacyLink.on("pointerdown", () => {
      window.open("/privacy-policy.html", "_blank")
    })

    // Separator
    this.add.text(centerX, y, "|", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#444444"
    }).setOrigin(0.5)

    // Terms of Service link
    const termsLink = this.add.text(centerX + 80, y, "Terms of Service", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    termsLink.on("pointerover", () => termsLink.setColor("#00ffff"))
    termsLink.on("pointerout", () => termsLink.setColor("#666666"))
    termsLink.on("pointerdown", () => {
      window.open("/terms-of-service.html", "_blank")
    })
  }

  createBackButton() {
    const backBtn = this.add.text(30, 30, "← BACK", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
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
  }

  formatPlaytime(seconds) {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }

  showEditModal() {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2
    const profile = UserProfileManager.getProfile()

    // Modal container
    this.editModal = this.add.container(centerX, centerY)
    this.editModal.setDepth(100)

    // Dark overlay
    const overlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.8)
    overlay.setInteractive() // Block clicks behind
    this.editModal.add(overlay)

    // Modal background
    const modalBg = this.add.rectangle(0, 0, 380, 320, 0x1a1a2e)
    modalBg.setStrokeStyle(2, 0xff69b4)
    this.editModal.add(modalBg)

    // Title
    const title = this.add.text(0, -130, "EDIT PROFILE", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.editModal.add(title)

    // Display Name label
    const nameLabel = this.add.text(-160, -85, "Display Name:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    })
    this.editModal.add(nameLabel)

    // Create HTML input for display name
    this.createDisplayNameInput(profile?.display_name || profile?.username || "")

    // Avatar section
    const avatarLabel = this.add.text(-160, -10, "Avatar:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    })
    this.editModal.add(avatarLabel)

    // Avatar preview
    const currentInitial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()
    const avatarPreview = this.add.circle(-100, 35, 30, 0x1a1a2e)
    avatarPreview.setStrokeStyle(2, 0xff69b4)
    this.editModal.add(avatarPreview)

    this.avatarInitialText = this.add.text(-100, 35, currentInitial, {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    this.editModal.add(this.avatarInitialText)

    // Avatar info text
    const avatarInfo = this.add.text(0, 35, "Avatar shows the first\nletter of your display name", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666",
      align: "center"
    }).setOrigin(0, 0.5)
    this.editModal.add(avatarInfo)

    // Error/success message area
    this.editMessage = this.add.text(0, 85, "", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff4444"
    }).setOrigin(0.5)
    this.editModal.add(this.editMessage)

    // Save button
    const saveBtn = this.add.container(-70, 125)
    const saveBg = this.add.rectangle(0, 0, 120, 36, 0x00ff88, 0.3)
    saveBg.setStrokeStyle(2, 0x00ff88)
    saveBg.setInteractive({ useHandCursor: true })
    const saveText = this.add.text(0, 0, "SAVE", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ff88"
    }).setOrigin(0.5)
    saveBtn.add([saveBg, saveText])
    this.editModal.add(saveBtn)

    saveBg.on("pointerover", () => saveBg.setFillStyle(0x00ff88, 0.5))
    saveBg.on("pointerout", () => saveBg.setFillStyle(0x00ff88, 0.3))
    saveBg.on("pointerdown", () => this.saveProfile())

    // Cancel button
    const cancelBtn = this.add.container(70, 125)
    const cancelBg = this.add.rectangle(0, 0, 120, 36, 0xff4444, 0.3)
    cancelBg.setStrokeStyle(2, 0xff4444)
    cancelBg.setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(0, 0, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff4444"
    }).setOrigin(0.5)
    cancelBtn.add([cancelBg, cancelText])
    this.editModal.add(cancelBtn)

    cancelBg.on("pointerover", () => cancelBg.setFillStyle(0xff4444, 0.5))
    cancelBg.on("pointerout", () => cancelBg.setFillStyle(0xff4444, 0.3))
    cancelBg.on("pointerdown", () => this.closeEditModal())
  }

  createDisplayNameInput(currentValue) {
    // Get canvas position for proper input alignment
    const canvas = this.sys.game.canvas
    const canvasRect = canvas.getBoundingClientRect()
    
    const centerX = canvasRect.left + canvasRect.width / 2
    const centerY = canvasRect.top + canvasRect.height / 2

    // Create HTML input
    this.displayNameInput = document.createElement("input")
    this.displayNameInput.type = "text"
    this.displayNameInput.value = currentValue
    this.displayNameInput.maxLength = 20
    this.displayNameInput.placeholder = "Enter display name"
    this.displayNameInput.style.cssText = `
      position: fixed;
      left: ${centerX - 140}px;
      top: ${centerY - 75}px;
      width: 280px;
      height: 32px;
      padding: 5px 10px;
      font-family: 'RetroPixel', monospace;
      font-size: 14px;
      background: #0a0a15;
      border: 2px solid #ff69b4;
      border-radius: 4px;
      color: #ffffff;
      outline: none;
      z-index: 1000;
    `
    
    document.body.appendChild(this.displayNameInput)
    this.displayNameInput.focus()

    // Update avatar preview on input change
    this.displayNameInput.addEventListener("input", () => {
      const value = this.displayNameInput.value.trim()
      const initial = value ? value.charAt(0).toUpperCase() : "?"
      if (this.avatarInitialText) {
        this.avatarInitialText.setText(initial)
      }
    })
  }

  async saveProfile() {
    const newDisplayName = this.displayNameInput?.value?.trim()

    if (!newDisplayName) {
      this.editMessage.setText("Display name cannot be empty")
      this.editMessage.setColor("#ff4444")
      return
    }

    if (newDisplayName.length < 2) {
      this.editMessage.setText("Display name must be at least 2 characters")
      this.editMessage.setColor("#ff4444")
      return
    }

    if (newDisplayName.length > 20) {
      this.editMessage.setText("Display name must be 20 characters or less")
      this.editMessage.setColor("#ff4444")
      return
    }

    // Show loading
    this.editMessage.setText("Saving...")
    this.editMessage.setColor("#888888")

    const result = await UserProfileManager.updateProfile({
      display_name: newDisplayName
    })

    if (result.success) {
      this.editMessage.setText("Profile updated!")
      this.editMessage.setColor("#00ff88")
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      
      // Close modal and refresh after short delay
      this.time.delayedCall(1000, () => {
        this.closeEditModal()
        this.scene.restart()
      })
    } else {
      this.editMessage.setText(result.error || "Failed to save")
      this.editMessage.setColor("#ff4444")
    }
  }

  closeEditModal() {
    // Remove HTML input
    if (this.displayNameInput && this.displayNameInput.parentNode) {
      this.displayNameInput.parentNode.removeChild(this.displayNameInput)
      this.displayNameInput = null
    }

    // Destroy modal
    if (this.editModal) {
      this.editModal.destroy()
      this.editModal = null
    }
  }

  async handleSignOut() {
    await AuthManager.signOut()
    this.scene.start("TitleScreen")
  }

  goBack() {
    this.closeEditModal()
    this.scene.start(this.returnScene)
  }

  shutdown() {
    this.closeEditModal()
  }
}
