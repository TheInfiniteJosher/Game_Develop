import Phaser from "phaser"
import { supabase } from "./integrations/supabase/client.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * BandMemberEditorScene - Edit band member profiles and abilities
 * Manages Teddy, Riff, Groove, Echo and other characters
 */
export class BandMemberEditorScene extends Phaser.Scene {
  constructor() {
    super({ key: "BandMemberEditorScene" })
    this.members = []
    this.selectedIndex = 0
    this.isLoading = false
  }

  create() {
    const centerX = this.cameras.main.width / 2
    
    // Play dev mode music
    BGMManager.setDevMode(true)
    BGMManager.playMenuMusic(this, MENU_KEYS.DEV_MODE)
    
    // Background
    this.createBackground()
    
    // Title
    this.add.text(centerX, 30, "BAND MEMBER EDITOR", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    
    this.add.text(centerX, 55, "Edit character profiles, personalities, and abilities", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    
    // Create UI
    this.createMemberSelector()
    this.createDetailPanel()
    this.createActionButtons()
    this.createBackButton()
    
    // Setup input
    this.setupInput()
    
    // Load data
    this.loadMembers()
  }
  
  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)
    
    // Grid pattern with pink tint
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x331133, 0.3)
    
    for (let x = 0; x < this.cameras.main.width; x += 40) {
      graphics.beginPath()
      graphics.moveTo(x, 0)
      graphics.lineTo(x, this.cameras.main.height)
      graphics.strokePath()
    }
    for (let y = 0; y < this.cameras.main.height; y += 40) {
      graphics.beginPath()
      graphics.moveTo(0, y)
      graphics.lineTo(this.cameras.main.width, y)
      graphics.strokePath()
    }
  }
  
  createMemberSelector() {
    // Left panel
    this.memberListPanel = this.add.container(10, 80)
    
    const panelBg = this.add.rectangle(0, 0, 200, 580, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.add.text(100, 15, "BAND MEMBERS", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    
    this.memberListPanel.add(panelBg)
    
    // Member buttons container
    this.memberButtonsContainer = this.add.container(20, 130)
    
    // Loading text
    this.loadingText = this.add.text(110, 350, "Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5)
  }
  
  createDetailPanel() {
    // Right panel
    this.detailPanel = this.add.container(220, 80)
    
    const panelBg = this.add.rectangle(0, 0, 620, 580, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.detailTitle = this.add.text(310, 15, "CHARACTER PROFILE", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5)
    
    this.detailPanel.add([panelBg, this.detailTitle])
    
    // Detail content container
    this.detailContent = this.add.container(235, 120)
  }
  
  createActionButtons() {
    const buttonY = this.cameras.main.height - 50
    
    // Add Member button
    this.addMemberBtn = this.createSmallButton(550, buttonY, "ADD MEMBER", 0x00ff88, () => this.addMember())
    
    // Save button
    this.saveBtn = this.createSmallButton(680, buttonY, "SAVE", 0x00ffff, () => this.saveMember())
    
    // Delete button
    this.deleteBtn = this.createSmallButton(780, buttonY, "DELETE", 0xff4444, () => this.deleteMember())
  }
  
  createSmallButton(x, y, text, color, callback) {
    const container = this.add.container(x, y)
    
    const bg = this.add.rectangle(0, 0, 100, 30, 0x1a1a2e)
      .setStrokeStyle(2, color)
      .setInteractive({ useHandCursor: true })
    
    const label = this.add.text(0, 0, text, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)
    
    container.add([bg, label])
    
    bg.on("pointerover", () => bg.setStrokeStyle(2, 0xffffff))
    bg.on("pointerout", () => bg.setStrokeStyle(2, color))
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      callback()
    })
    
    return container
  }
  
  createBackButton() {
    const backBtn = this.add.container(60, this.cameras.main.height - 50)
    
    const bg = this.add.rectangle(0, 0, 100, 35, 0x1a1a2e)
      .setStrokeStyle(2, 0xff69b4)
      .setInteractive({ useHandCursor: true })
    
    const label = this.add.text(0, 0, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    
    backBtn.add([bg, label])
    
    bg.on("pointerover", () => bg.setStrokeStyle(2, 0xffffff))
    bg.on("pointerout", () => bg.setStrokeStyle(2, 0xff69b4))
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("DeveloperMenuScene")
    })
  }
  
  setupInput() {
    this.input.keyboard.on("keydown-ESC", () => this.scene.start("DeveloperMenuScene"))
    this.input.keyboard.on("keydown-UP", () => this.navigateUp())
    this.input.keyboard.on("keydown-DOWN", () => this.navigateDown())
  }
  
  async loadMembers() {
    this.isLoading = true
    this.loadingText.setVisible(true)
    
    try {
      const { data, error } = await supabase
        .from("band_members")
        .select("*")
        .order("unlock_world", { ascending: true, nullsFirst: true })
      
      if (error) throw error
      
      this.members = data || []
      this.updateMemberList()
      this.updateDetailPanel()
      
    } catch (e) {
      console.error("[BandMemberEditor] Failed to load members:", e)
      this.showError("Failed to load band members")
    } finally {
      this.isLoading = false
      this.loadingText.setVisible(false)
    }
  }
  
  updateMemberList() {
    this.memberButtonsContainer.removeAll(true)
    
    const memberColors = {
      teddy: 0x00ff88,
      riff: 0xffaa00,
      groove: 0x00aaff,
      echo: 0xaa44ff,
      scientist: 0x00ffff,
      human_self: 0xff69b4
    }
    
    this.members.forEach((member, index) => {
      const y = index * 55
      const isSelected = index === this.selectedIndex
      const color = memberColors[member.character_key] || 0xffffff
      
      const btn = this.add.container(0, y)
      
      const bg = this.add.rectangle(85, 0, 165, 50, isSelected ? 0x333355 : 0x1a1a2e)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffffff : color)
        .setInteractive({ useHandCursor: true })
      
      // Character avatar placeholder
      const avatar = this.add.circle(-5, 0, 18, color)
      const avatarText = this.add.text(-5, 0, member.display_name?.charAt(0) || "?", {
        fontFamily: "RetroPixel",
        fontSize: "14px",
        color: "#000000"
      }).setOrigin(0.5)
      
      // Name
      const nameText = this.add.text(25, -10, member.display_name || member.character_key, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: isSelected ? "#ffffff" : "#cccccc"
      })
      
      // Instrument
      const instrumentText = this.add.text(25, 8, member.instrument || "Unknown", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#666666"
      })
      
      btn.add([bg, avatar, avatarText, nameText, instrumentText])
      
      bg.on("pointerdown", () => {
        this.selectedIndex = index
        this.sound.play("ui_select_sound", { volume: 0.2 })
        this.updateMemberList()
        this.updateDetailPanel()
      })
      
      this.memberButtonsContainer.add(btn)
    })
  }
  
  updateDetailPanel() {
    this.detailContent.removeAll(true)
    
    const member = this.members[this.selectedIndex]
    if (!member) return
    
    this.detailTitle.setText(member.display_name || "Character Profile")
    
    let y = 0
    const lineHeight = 28
    
    // Identity Section
    this.addSectionHeader("IDENTITY", y)
    y += 25
    
    this.addEditableField("Key:", member.character_key, "character_key", y, true)
    y += lineHeight
    
    this.addEditableField("Display Name:", member.display_name || "", "display_name", y)
    y += lineHeight
    
    this.addEditableField("Instrument:", member.instrument || "", "instrument", y)
    y += lineHeight
    
    this.addEditableField("Unlock World:", member.unlock_world ? String(member.unlock_world) : "Start", "unlock_world", y)
    y += lineHeight + 10
    
    // Personality Section
    this.addSectionHeader("PERSONALITY", y)
    y += 25
    
    const traits = member.personality_traits || []
    this.addEditableField("Traits:", traits.join(", "), "personality_traits", y)
    y += lineHeight
    
    this.addEditableField("Speaking Style:", member.speaking_style || "", "speaking_style", y)
    y += lineHeight
    
    this.addMultilineField("Backstory:", member.backstory || "", "backstory", y)
    y += 70
    
    // Gameplay Section
    this.addSectionHeader("GAMEPLAY", y)
    y += 25
    
    this.addEditableField("Ability:", member.ability_granted || "", "ability_granted", y)
    y += lineHeight
    
    this.addEditableField("Ability Desc:", member.ability_description || "", "ability_description", y)
    y += lineHeight + 10
    
    // Voice Section
    this.addSectionHeader("VOICE", y)
    y += 25
    
    this.addEditableField("Voice Style:", member.voice_style || "", "voice_style", y)
    y += lineHeight
    
    const sampleLines = member.sample_lines || []
    this.addMultilineField("Sample Lines:", sampleLines.join("\n"), "sample_lines", y)
  }
  
  addSectionHeader(text, y) {
    const header = this.add.text(0, y, text, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff69b4"
    })
    
    const line = this.add.rectangle(290, y + 8, 580, 1, 0xff69b4, 0.3)
    
    this.detailContent.add([header, line])
  }
  
  addEditableField(label, value, fieldKey, y, readonly = false) {
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    
    const displayValue = value.length > 55 ? value.substring(0, 55) + "..." : value
    
    const valueBg = this.add.rectangle(350, y, 460, 22, 0x0a0a1a)
      .setStrokeStyle(1, readonly ? 0x222222 : 0x444466)
    
    const valueText = this.add.text(125, y, displayValue || "(empty)", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: readonly ? "#555555" : (value ? "#ffffff" : "#555555")
    }).setOrigin(0, 0.5)
    
    this.detailContent.add([labelText, valueBg, valueText])
    
    if (!readonly) {
      valueBg.setInteractive({ useHandCursor: true })
      valueBg.on("pointerdown", () => this.editField(fieldKey, value))
      valueBg.on("pointerover", () => valueBg.setStrokeStyle(1, 0xff69b4))
      valueBg.on("pointerout", () => valueBg.setStrokeStyle(1, 0x444466))
    }
  }
  
  addMultilineField(label, value, fieldKey, y) {
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    
    const valueBg = this.add.rectangle(290, y + 25, 580, 45, 0x0a0a1a)
      .setStrokeStyle(1, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const valueText = this.add.text(5, y + 10, value.substring(0, 200) || "(empty)", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: value ? "#cccccc" : "#555555",
      wordWrap: { width: 560 }
    })
    
    this.detailContent.add([labelText, valueBg, valueText])
    
    valueBg.on("pointerdown", () => this.editField(fieldKey, value))
    valueBg.on("pointerover", () => valueBg.setStrokeStyle(1, 0xff69b4))
    valueBg.on("pointerout", () => valueBg.setStrokeStyle(1, 0x444466))
  }
  
  editField(fieldKey, currentValue) {
    let newValue
    
    // Handle array fields
    if (fieldKey === "personality_traits" || fieldKey === "sample_lines") {
      newValue = window.prompt(`Edit ${fieldKey} (comma-separated):`, currentValue)
      if (newValue !== null && newValue !== currentValue) {
        const member = this.members[this.selectedIndex]
        member[fieldKey] = newValue.split(",").map(s => s.trim()).filter(s => s)
        member._dirty = true
        this.updateDetailPanel()
        this.showSuccess("Field updated - click SAVE to persist")
      }
    } else if (fieldKey === "unlock_world") {
      newValue = window.prompt(`Edit ${fieldKey} (number or empty for start):`, currentValue)
      if (newValue !== null) {
        const member = this.members[this.selectedIndex]
        member[fieldKey] = newValue ? parseInt(newValue) : null
        member._dirty = true
        this.updateDetailPanel()
        this.showSuccess("Field updated - click SAVE to persist")
      }
    } else {
      newValue = window.prompt(`Edit ${fieldKey}:`, currentValue)
      if (newValue !== null && newValue !== currentValue) {
        const member = this.members[this.selectedIndex]
        member[fieldKey] = newValue
        member._dirty = true
        this.updateDetailPanel()
        this.showSuccess("Field updated - click SAVE to persist")
      }
    }
  }
  
  async addMember() {
    const characterKey = window.prompt("Enter character key (e.g., 'new_member'):")
    if (!characterKey) return
    
    const displayName = window.prompt("Enter display name:")
    if (!displayName) return
    
    const instrument = window.prompt("Enter instrument:")
    
    try {
      const { data, error } = await supabase
        .from("band_members")
        .insert({
          character_key: characterKey,
          display_name: displayName,
          instrument: instrument || "Unknown"
        })
        .select()
        .single()
      
      if (error) throw error
      
      this.members.push(data)
      this.selectedIndex = this.members.length - 1
      this.updateMemberList()
      this.updateDetailPanel()
      this.showSuccess("Member added!")
      
    } catch (e) {
      console.error("[BandMemberEditor] Failed to add member:", e)
      this.showError("Failed to add member: " + e.message)
    }
  }
  
  async saveMember() {
    const member = this.members[this.selectedIndex]
    if (!member) return
    
    try {
      const updateData = { ...member }
      delete updateData._dirty
      delete updateData.id
      delete updateData.created_at
      delete updateData.updated_at
      
      const { error } = await supabase
        .from("band_members")
        .update(updateData)
        .eq("id", member.id)
      
      if (error) throw error
      
      member._dirty = false
      this.showSuccess("Member saved successfully!")
      
    } catch (e) {
      console.error("[BandMemberEditor] Failed to save member:", e)
      this.showError("Failed to save member")
    }
  }
  
  async deleteMember() {
    const member = this.members[this.selectedIndex]
    if (!member) return
    
    // Protect core members
    const protectedKeys = ["teddy", "riff", "groove", "echo", "scientist"]
    if (protectedKeys.includes(member.character_key)) {
      this.showError("Cannot delete core band members")
      return
    }
    
    const confirm = window.confirm(`Delete ${member.display_name}? This cannot be undone.`)
    if (!confirm) return
    
    try {
      const { error } = await supabase
        .from("band_members")
        .delete()
        .eq("id", member.id)
      
      if (error) throw error
      
      this.members.splice(this.selectedIndex, 1)
      if (this.selectedIndex >= this.members.length) {
        this.selectedIndex = Math.max(0, this.members.length - 1)
      }
      
      this.updateMemberList()
      this.updateDetailPanel()
      this.showSuccess("Member deleted")
      
    } catch (e) {
      console.error("[BandMemberEditor] Failed to delete member:", e)
      this.showError("Failed to delete member")
    }
  }
  
  navigateUp() {
    // Cycle to bottom if at top (menu looping)
    if (this.selectedIndex <= 0) {
      this.selectedIndex = this.members.length - 1
    } else {
      this.selectedIndex--
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updateMemberList()
    this.updateDetailPanel()
  }
  
  navigateDown() {
    // Cycle to top if at bottom (menu looping)
    if (this.selectedIndex >= this.members.length - 1) {
      this.selectedIndex = 0
    } else {
      this.selectedIndex++
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updateMemberList()
    this.updateDetailPanel()
  }
  
  showError(message) {
    const text = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 100,
      message,
      { fontFamily: "RetroPixel", fontSize: "14px", color: "#ff4444" }
    ).setOrigin(0.5)
    
    this.time.delayedCall(2000, () => text.destroy())
  }
  
  showSuccess(message) {
    const text = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 100,
      message,
      { fontFamily: "RetroPixel", fontSize: "14px", color: "#00ff88" }
    ).setOrigin(0.5)
    
    this.time.delayedCall(2000, () => text.destroy())
  }
}
