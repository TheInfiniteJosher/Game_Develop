import Phaser from "phaser"
import { supabase } from "./integrations/supabase/client.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * BossDesignerScene - Design and configure boss fights for each world
 * Manages phases, attacks, weak points, and narrative elements
 */
export class BossDesignerScene extends Phaser.Scene {
  constructor() {
    super({ key: "BossDesignerScene" })
    this.bosses = []
    this.worlds = []
    this.selectedBossIndex = 0
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
    this.add.text(centerX, 30, "BOSS DESIGNER", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff4444"
    }).setOrigin(0.5)
    
    this.add.text(centerX, 55, "Configure boss fights, phases, and attacks", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    
    // Create UI
    this.createBossSelector()
    this.createDetailPanel()
    this.createActionButtons()
    this.createBackButton()
    
    // Setup input
    this.setupInput()
    
    // Load data
    this.loadData()
  }
  
  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x1a0a0a)
      .setOrigin(0, 0)
    
    // Dramatic grid pattern
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x441111, 0.3)
    
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
  
  createBossSelector() {
    // Left panel - boss list
    this.bossListPanel = this.add.container(10, 80)
    
    const panelBg = this.add.rectangle(0, 0, 220, 580, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.add.text(110, 15, "WORLD BOSSES", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff4444"
    }).setOrigin(0.5)
    
    this.bossListPanel.add(panelBg)
    
    // Boss buttons container
    this.bossButtonsContainer = this.add.container(20, 130)
    
    // Loading text
    this.loadingText = this.add.text(120, 350, "Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5)
  }
  
  createDetailPanel() {
    // Right panel - boss details
    this.detailPanel = this.add.container(240, 80)
    
    const panelBg = this.add.rectangle(0, 0, 600, 580, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.detailTitle = this.add.text(300, 15, "BOSS DETAILS", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff4444"
    }).setOrigin(0.5)
    
    this.detailPanel.add([panelBg, this.detailTitle])
    
    // Detail content container
    this.detailContent = this.add.container(255, 120)
    
    // Placeholder
    this.placeholder = this.add.text(540, 380, "Select a boss to view/edit details", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#555555"
    }).setOrigin(0.5)
  }
  
  createActionButtons() {
    const buttonY = this.cameras.main.height - 50
    
    // Add Phase button
    this.addPhaseBtn = this.createSmallButton(500, buttonY, "ADD PHASE", 0x00ff88, () => this.addPhase())
    
    // Add Attack button
    this.addAttackBtn = this.createSmallButton(620, buttonY, "ADD ATTACK", 0xffaa00, () => this.addAttack())
    
    // Save button
    this.saveBtn = this.createSmallButton(750, buttonY, "SAVE", 0x00ffff, () => this.saveBoss())
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
  
  async loadData() {
    this.isLoading = true
    this.loadingText.setVisible(true)
    
    try {
      // Load worlds first
      const { data: worldData, error: worldError } = await supabase
        .from("world_metadata")
        .select("world_number, world_name, act_number")
        .order("world_number", { ascending: true })
      
      if (worldError) throw worldError
      this.worlds = worldData || []
      
      // Load bosses
      const { data: bossData, error: bossError } = await supabase
        .from("boss_designs")
        .select("*")
        .order("world_number", { ascending: true })
      
      if (bossError) throw bossError
      this.bosses = bossData || []
      
      // Create boss entries for worlds that don't have one
      await this.ensureAllBossesExist()
      
      this.updateBossList()
      this.updateDetailPanel()
      
    } catch (e) {
      console.error("[BossDesigner] Failed to load data:", e)
      this.showError("Failed to load boss data")
    } finally {
      this.isLoading = false
      this.loadingText.setVisible(false)
    }
  }
  
  async ensureAllBossesExist() {
    // Create boss entries for any worlds that don't have one
    for (const world of this.worlds) {
      const existingBoss = this.bosses.find(b => b.world_number === world.world_number)
      
      if (!existingBoss) {
        const defaultBossNames = {
          1: "Assembly Foreman",
          2: "DJ Mech",
          3: "Idol AI Swarm",
          4: "Royal Guard Bot",
          5: "Speaker Titan",
          6: "Ice Resonance Beast",
          7: "Talent Agent",
          8: "Shark Amp",
          9: "Media Titan",
          10: "Robot 1-Man-Band",
          11: "Shadow Teddy",
          12: "Time Fracture Entity",
          13: "Noise Colossus",
          14: "Harmony Guardian",
          15: "Algorithm Core"
        }
        
        try {
          const { data, error } = await supabase
            .from("boss_designs")
            .insert({
              world_number: world.world_number,
              boss_name: defaultBossNames[world.world_number] || `Boss ${world.world_number}`,
              phases: [],
              attacks: [],
              weak_points: []
            })
            .select()
            .single()
          
          if (!error && data) {
            this.bosses.push(data)
          }
        } catch (e) {
          console.warn(`Failed to create boss for world ${world.world_number}:`, e)
        }
      }
    }
    
    // Sort bosses by world number
    this.bosses.sort((a, b) => a.world_number - b.world_number)
  }
  
  updateBossList() {
    this.bossButtonsContainer.removeAll(true)
    
    const actColors = {
      1: 0x00ff88,
      2: 0xffaa00,
      3: 0xaa44ff
    }
    
    this.bosses.forEach((boss, index) => {
      const world = this.worlds.find(w => w.world_number === boss.world_number)
      const actColor = actColors[world?.act_number] || 0xffffff
      
      const y = index * 35
      const isSelected = index === this.selectedBossIndex
      
      const btn = this.add.container(0, y)
      
      const bg = this.add.rectangle(95, 0, 185, 32, isSelected ? 0x442222 : 0x1a1a2e)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xff4444 : actColor)
        .setInteractive({ useHandCursor: true })
      
      // World number badge
      const badge = this.add.rectangle(-5, 0, 24, 24, actColor)
      const badgeText = this.add.text(-5, 0, String(boss.world_number), {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#000000"
      }).setOrigin(0.5)
      
      // Boss name
      const nameText = this.add.text(15, -5, boss.boss_name || "Unnamed Boss", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: isSelected ? "#ff4444" : "#ffffff"
      })
      
      // World name subtitle
      const worldText = this.add.text(15, 8, world?.world_name || "Unknown", {
        fontFamily: "RetroPixel",
        fontSize: "8px",
        color: "#666666"
      })
      
      btn.add([bg, badge, badgeText, nameText, worldText])
      
      bg.on("pointerdown", () => {
        this.selectedBossIndex = index
        this.sound.play("ui_select_sound", { volume: 0.2 })
        this.updateBossList()
        this.updateDetailPanel()
      })
      
      this.bossButtonsContainer.add(btn)
    })
  }
  
  updateDetailPanel() {
    this.detailContent.removeAll(true)
    this.placeholder.setVisible(false)
    
    const boss = this.bosses[this.selectedBossIndex]
    if (!boss) {
      this.placeholder.setVisible(true)
      return
    }
    
    const world = this.worlds.find(w => w.world_number === boss.world_number)
    this.detailTitle.setText(`${boss.boss_name} - ${world?.world_name || "World " + boss.world_number}`)
    
    let y = 0
    const lineHeight = 26
    
    // Basic Info Section
    this.addSectionHeader("IDENTITY", y)
    y += 25
    
    this.addEditableField("Boss Name:", boss.boss_name || "", "boss_name", y)
    y += lineHeight
    
    this.addEditableField("Subtitle:", boss.boss_subtitle || "", "boss_subtitle", y)
    y += lineHeight
    
    this.addEditableField("Description:", boss.boss_description || "", "boss_description", y)
    y += lineHeight + 10
    
    // Visual Section
    this.addSectionHeader("VISUALS", y)
    y += 25
    
    this.addEditableField("Appearance:", boss.appearance_description || "", "appearance_description", y)
    y += lineHeight
    
    this.addEditableField("Arena:", boss.arena_description || "", "arena_description", y)
    y += lineHeight + 10
    
    // Narrative Section
    this.addSectionHeader("DIALOGUE", y)
    y += 25
    
    this.addEditableField("Pre-Battle:", boss.pre_battle_dialogue || "", "pre_battle_dialogue", y)
    y += lineHeight
    
    this.addEditableField("Defeat:", boss.defeat_dialogue || "", "defeat_dialogue", y)
    y += lineHeight + 10
    
    // Phases Section
    this.addSectionHeader(`PHASES (${(boss.phases || []).length})`, y)
    y += 25
    
    const phases = boss.phases || []
    if (phases.length === 0) {
      const noPhases = this.add.text(0, y, "No phases defined. Click 'ADD PHASE' to create one.", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#666666"
      })
      this.detailContent.add(noPhases)
      y += 20
    } else {
      phases.forEach((phase, i) => {
        this.addPhaseDisplay(phase, i, y)
        y += 45
      })
    }
    
    y += 10
    
    // Attacks Section
    this.addSectionHeader(`ATTACKS (${(boss.attacks || []).length})`, y)
    y += 25
    
    const attacks = boss.attacks || []
    if (attacks.length === 0) {
      const noAttacks = this.add.text(0, y, "No attacks defined. Click 'ADD ATTACK' to create one.", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#666666"
      })
      this.detailContent.add(noAttacks)
    } else {
      attacks.forEach((attack, i) => {
        this.addAttackDisplay(attack, i, y)
        y += 25
      })
    }
  }
  
  addSectionHeader(text, y) {
    const header = this.add.text(0, y, text, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff4444"
    })
    
    const line = this.add.rectangle(280, y + 8, 560, 1, 0xff4444, 0.3)
    
    this.detailContent.add([header, line])
  }
  
  addEditableField(label, value, fieldKey, y) {
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    })
    
    const displayValue = value.length > 50 ? value.substring(0, 50) + "..." : value
    
    const valueBg = this.add.rectangle(340, y, 430, 20, 0x0a0a0a)
      .setStrokeStyle(1, 0x333333)
      .setInteractive({ useHandCursor: true })
    
    const valueText = this.add.text(130, y, displayValue || "(empty)", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: value ? "#ffffff" : "#555555"
    }).setOrigin(0, 0.5)
    
    this.detailContent.add([labelText, valueBg, valueText])
    
    valueBg.on("pointerdown", () => this.editField(fieldKey, value))
    valueBg.on("pointerover", () => valueBg.setStrokeStyle(1, 0xff4444))
    valueBg.on("pointerout", () => valueBg.setStrokeStyle(1, 0x333333))
  }
  
  addPhaseDisplay(phase, index, y) {
    const container = this.add.container(0, y)
    
    const bg = this.add.rectangle(280, 15, 560, 40, 0x221111)
      .setStrokeStyle(1, 0x553333)
    
    const phaseNum = this.add.text(10, 15, `Phase ${index + 1}`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff8888"
    }).setOrigin(0, 0.5)
    
    const phaseName = this.add.text(90, 15, phase.name || "Unnamed Phase", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffffff"
    }).setOrigin(0, 0.5)
    
    const phaseDesc = this.add.text(250, 15, phase.description || "", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#888888"
    }).setOrigin(0, 0.5)
    
    // Edit button
    const editBtn = this.add.text(530, 15, "[EDIT]", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#00ffff"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    editBtn.on("pointerdown", () => this.editPhase(index))
    
    container.add([bg, phaseNum, phaseName, phaseDesc, editBtn])
    this.detailContent.add(container)
  }
  
  addAttackDisplay(attack, index, y) {
    const attackName = this.add.text(10, y, `• ${attack.name || "Attack " + (index + 1)}`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffaa00"
    })
    
    const attackType = this.add.text(200, y, attack.type || "unknown", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    })
    
    const editBtn = this.add.text(530, y, "[EDIT]", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#00ffff"
    }).setInteractive({ useHandCursor: true })
    
    editBtn.on("pointerdown", () => this.editAttack(index))
    
    this.detailContent.add([attackName, attackType, editBtn])
  }
  
  editField(fieldKey, currentValue) {
    const newValue = window.prompt(`Edit ${fieldKey}:`, currentValue)
    
    if (newValue !== null && newValue !== currentValue) {
      const boss = this.bosses[this.selectedBossIndex]
      boss[fieldKey] = newValue
      boss._dirty = true
      this.updateDetailPanel()
      this.showSuccess("Field updated - click SAVE to persist")
    }
  }
  
  addPhase() {
    const boss = this.bosses[this.selectedBossIndex]
    if (!boss) return
    
    const phases = boss.phases || []
    const newPhase = {
      name: `Phase ${phases.length + 1}`,
      description: "Enter phase description",
      health_threshold: 100 - (phases.length * 33),
      attacks_enabled: []
    }
    
    boss.phases = [...phases, newPhase]
    boss._dirty = true
    this.updateDetailPanel()
    this.showSuccess("Phase added - click SAVE to persist")
  }
  
  editPhase(index) {
    const boss = this.bosses[this.selectedBossIndex]
    const phase = boss.phases[index]
    
    const newName = window.prompt("Phase name:", phase.name)
    if (newName !== null) {
      phase.name = newName
      
      const newDesc = window.prompt("Phase description:", phase.description)
      if (newDesc !== null) {
        phase.description = newDesc
      }
      
      boss._dirty = true
      this.updateDetailPanel()
    }
  }
  
  addAttack() {
    const boss = this.bosses[this.selectedBossIndex]
    if (!boss) return
    
    const attacks = boss.attacks || []
    const newAttack = {
      name: `Attack ${attacks.length + 1}`,
      type: "projectile",
      damage: 1,
      telegraph_duration: 0.5,
      description: "Enter attack description"
    }
    
    boss.attacks = [...attacks, newAttack]
    boss._dirty = true
    this.updateDetailPanel()
    this.showSuccess("Attack added - click SAVE to persist")
  }
  
  editAttack(index) {
    const boss = this.bosses[this.selectedBossIndex]
    const attack = boss.attacks[index]
    
    const newName = window.prompt("Attack name:", attack.name)
    if (newName !== null) {
      attack.name = newName
      
      const newType = window.prompt("Attack type (projectile/melee/aoe/shockwave):", attack.type)
      if (newType !== null) {
        attack.type = newType
      }
      
      boss._dirty = true
      this.updateDetailPanel()
    }
  }
  
  async saveBoss() {
    const boss = this.bosses[this.selectedBossIndex]
    if (!boss) return
    
    try {
      const updateData = { ...boss }
      delete updateData._dirty
      delete updateData.id
      delete updateData.created_at
      delete updateData.updated_at
      
      const { error } = await supabase
        .from("boss_designs")
        .update(updateData)
        .eq("id", boss.id)
      
      if (error) throw error
      
      boss._dirty = false
      this.showSuccess("Boss saved successfully!")
      
    } catch (e) {
      console.error("[BossDesigner] Failed to save boss:", e)
      this.showError("Failed to save boss")
    }
  }
  
  navigateUp() {
    // Cycle to bottom if at top (menu looping)
    if (this.selectedBossIndex <= 0) {
      this.selectedBossIndex = this.bosses.length - 1
    } else {
      this.selectedBossIndex--
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updateBossList()
    this.updateDetailPanel()
  }
  
  navigateDown() {
    // Cycle to top if at bottom (menu looping)
    if (this.selectedBossIndex >= this.bosses.length - 1) {
      this.selectedBossIndex = 0
    } else {
      this.selectedBossIndex++
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updateBossList()
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
