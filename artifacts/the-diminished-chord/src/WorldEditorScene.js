import Phaser from "phaser"
import { supabase } from "./integrations/supabase/client.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * WorldEditorScene - Edit world metadata, themes, and AI prompts
 * Manages all 15 worlds with their visual/audio/narrative settings
 */
export class WorldEditorScene extends Phaser.Scene {
  constructor() {
    super({ key: "WorldEditorScene" })
    this.worlds = []
    this.selectedWorldIndex = 0
    this.isLoading = false
    this.editingField = null
  }

  create() {
    const centerX = this.cameras.main.width / 2
    
    // Play dev mode music
    BGMManager.setDevMode(true)
    BGMManager.playMenuMusic(this, MENU_KEYS.DEV_MODE)
    
    // Background
    this.createBackground()
    
    // Title
    this.add.text(centerX, 30, "WORLD EDITOR", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ffff"
    }).setOrigin(0.5)
    
    this.add.text(centerX, 55, "Edit themes, prompts, and metadata for all 15 worlds", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    
    // Create UI
    this.createWorldSelector()
    this.createDetailPanel()
    this.createActionButtons()
    this.createBackButton()
    
    // Setup input
    this.setupInput()
    
    // Load worlds
    this.loadWorlds()
  }
  
  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)
    
    // Grid pattern
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x113344, 0.3)
    
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
  
  createWorldSelector() {
    // Left panel - world list
    this.worldListPanel = this.add.container(10, 80)
    
    const panelBg = this.add.rectangle(0, 0, 200, 580, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.add.text(100, 15, "WORLDS", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5)
    
    this.worldListPanel.add(panelBg)
    
    // World buttons container
    this.worldButtonsContainer = this.add.container(20, 130)
    
    // Loading text
    this.loadingText = this.add.text(110, 350, "Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5)
  }
  
  createDetailPanel() {
    // Right panel - world details
    this.detailPanel = this.add.container(220, 80)
    
    const panelBg = this.add.rectangle(0, 0, 620, 580, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.detailTitle = this.add.text(310, 15, "WORLD DETAILS", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    
    this.detailPanel.add([panelBg, this.detailTitle])
    
    // Detail content container
    this.detailContent = this.add.container(235, 120)
  }
  
  createActionButtons() {
    const buttonY = this.cameras.main.height - 50
    
    // Save button
    this.saveBtn = this.createSmallButton(600, buttonY, "SAVE CHANGES", 0x00ff88, () => this.saveCurrentWorld())
    
    // Preview Tileset Prompt button
    this.previewBtn = this.createSmallButton(740, buttonY, "COPY PROMPTS", 0xaa44ff, () => this.copyPrompts())
  }
  
  createSmallButton(x, y, text, color, callback) {
    const container = this.add.container(x, y)
    
    const bg = this.add.rectangle(0, 0, 120, 30, 0x1a1a2e)
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
    this.input.keyboard.on("keydown-S", (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
        this.saveCurrentWorld()
      }
    })
  }
  
  async loadWorlds() {
    this.isLoading = true
    this.loadingText.setVisible(true)
    
    try {
      const { data, error } = await supabase
        .from("world_metadata")
        .select("*")
        .order("world_number", { ascending: true })
      
      if (error) throw error
      
      this.worlds = data || []
      this.updateWorldList()
      this.updateDetailPanel()
      
    } catch (e) {
      console.error("[WorldEditor] Failed to load worlds:", e)
      this.showError("Failed to load worlds")
    } finally {
      this.isLoading = false
      this.loadingText.setVisible(false)
    }
  }
  
  updateWorldList() {
    this.worldButtonsContainer.removeAll(true)
    
    const actColors = {
      1: 0x00ff88,  // Act I - Underground (green)
      2: 0xffaa00,  // Act II - Industry (orange)
      3: 0xaa44ff   // Act III - Internal (purple)
    }
    
    this.worlds.forEach((world, index) => {
      const y = index * 35
      const isSelected = index === this.selectedWorldIndex
      const actColor = actColors[world.act_number] || 0xffffff
      
      const btn = this.add.container(0, y)
      
      const bg = this.add.rectangle(90, 0, 175, 32, isSelected ? 0x333355 : 0x1a1a2e)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffffff : actColor)
        .setInteractive({ useHandCursor: true })
      
      // World number badge
      const badge = this.add.rectangle(-5, 0, 24, 24, actColor)
      const badgeText = this.add.text(-5, 0, String(world.world_number), {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#000000"
      }).setOrigin(0.5)
      
      // World name
      const nameText = this.add.text(20, 0, world.world_name, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: isSelected ? "#ffffff" : "#cccccc"
      }).setOrigin(0, 0.5)
      
      btn.add([bg, badge, badgeText, nameText])
      
      bg.on("pointerdown", () => {
        this.selectedWorldIndex = index
        this.sound.play("ui_select_sound", { volume: 0.2 })
        this.updateWorldList()
        this.updateDetailPanel()
      })
      
      this.worldButtonsContainer.add(btn)
    })
  }
  
  updateDetailPanel() {
    this.detailContent.removeAll(true)
    
    const world = this.worlds[this.selectedWorldIndex]
    if (!world) return
    
    // Update title
    this.detailTitle.setText(`${world.world_name.toUpperCase()} - Act ${world.act_number}`)
    
    const startX = 0
    let y = 0
    const lineHeight = 28
    const labelWidth = 120
    const valueWidth = 450
    
    // Basic info section
    this.addSectionHeader("BASIC INFO", y)
    y += 25
    
    this.addEditableField("World Name:", world.world_name, "world_name", y, labelWidth, valueWidth)
    y += lineHeight
    
    this.addEditableField("Subtitle:", world.world_subtitle || "", "world_subtitle", y, labelWidth, valueWidth)
    y += lineHeight
    
    this.addEditableField("Act:", String(world.act_number), "act_number", y, labelWidth, 50, true)
    y += lineHeight + 10
    
    // Theme section
    this.addSectionHeader("THEMING", y)
    y += 25
    
    this.addEditableField("Theme:", world.theme_description || "", "theme_description", y, labelWidth, valueWidth)
    y += lineHeight
    
    this.addEditableField("Music Identity:", world.music_identity || "", "music_identity", y, labelWidth, valueWidth)
    y += lineHeight
    
    this.addEditableField("Visual Style:", world.visual_aesthetic || "", "visual_aesthetic", y, labelWidth, valueWidth)
    y += lineHeight + 10
    
    // Narrative section
    this.addSectionHeader("NARRATIVE", y)
    y += 25
    
    this.addEditableField("Story Theme:", world.narrative_theme || "", "narrative_theme", y, labelWidth, valueWidth)
    y += lineHeight
    
    this.addEditableField("Key Beat:", world.key_story_beat || "", "key_story_beat", y, labelWidth, valueWidth)
    y += lineHeight + 10
    
    // AI Prompts section
    this.addSectionHeader("AI GENERATION PROMPTS", y)
    y += 25
    
    this.addMultilineField("Tileset Prompt:", world.tileset_prompt || "", "tileset_prompt", y, 580)
    y += 70
    
    this.addMultilineField("Background Prompt:", world.background_prompt || "", "background_prompt", y, 580)
    y += 70
    
    // Colors section
    this.addSectionHeader("COLORS", y)
    y += 25
    
    this.addColorField("Primary:", world.primary_color, "primary_color", 0, y)
    this.addColorField("Secondary:", world.secondary_color, "secondary_color", 150, y)
    this.addColorField("Accent:", world.accent_color, "accent_color", 300, y)
    y += lineHeight + 15
    
    // Background Visual Settings section
    this.addSectionHeader("BACKGROUND VISUALS", y)
    y += 25
    
    this.addSliderField("Brightness:", world.background_brightness ?? 1.0, "background_brightness", y, 0, 2, (val) => `${Math.round(val * 100)}%`)
    y += lineHeight + 5
    
    this.addSliderField("Contrast:", world.background_contrast ?? 1.0, "background_contrast", y, 0, 2, (val) => `${Math.round(val * 100)}%`)
    y += lineHeight + 15
    
    // B2 Bonus Level Unlock Settings
    this.addSectionHeader("B2 BONUS UNLOCK", y)
    y += 25
    
    // Hidden item level (which level contains the B2 unlock item)
    const hiddenItemLevel = this.getHiddenItemLevel(world.world_number)
    this.addHiddenItemLevelSelector("Hidden Item in Level:", hiddenItemLevel, world.world_number, y)
    y += lineHeight
    
    // Hidden item type
    const hiddenItemType = this.getHiddenItemType(world.world_number)
    this.addHiddenItemTypeSelector("Item Type:", hiddenItemType, world.world_number, y)
  }
  
  /**
   * Get which level contains the hidden item for this world's B2 unlock
   */
  getHiddenItemLevel(worldNum) {
    const config = localStorage.getItem(`hidden_item_config_w${worldNum}`)
    if (config) {
      const parsed = JSON.parse(config)
      return parsed.level || 5
    }
    return 5 // Default to level 5
  }
  
  /**
   * Get the hidden item type for this world's B2 unlock
   */
  getHiddenItemType(worldNum) {
    const config = localStorage.getItem(`hidden_item_config_w${worldNum}`)
    if (config) {
      const parsed = JSON.parse(config)
      return parsed.itemType || "record_deal"
    }
    return "record_deal" // Default
  }
  
  /**
   * Save hidden item configuration for a world
   */
  saveHiddenItemConfig(worldNum, level, itemType) {
    const config = { level, itemType }
    localStorage.setItem(`hidden_item_config_w${worldNum}`, JSON.stringify(config))
    this.showSuccess(`B2 unlock: Level ${level} now contains ${itemType}`)
  }
  
  /**
   * Add a dropdown selector for which level contains the hidden item
   */
  addHiddenItemLevelSelector(label, currentLevel, worldNum, y) {
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    
    // Level number display
    const valueBg = this.add.rectangle(200, y, 100, 22, 0x0a0a1a)
      .setStrokeStyle(1, 0xffaa00)
      .setInteractive({ useHandCursor: true })
    
    const valueText = this.add.text(200, y, `Level ${currentLevel}`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffaa00"
    }).setOrigin(0.5)
    
    // Left/Right arrows for adjustment
    const leftArrow = this.add.text(145, y, "<", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffaa00"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    const rightArrow = this.add.text(255, y, ">", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffaa00"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    this.detailContent.add([labelText, valueBg, valueText, leftArrow, rightArrow])
    
    leftArrow.on("pointerdown", () => {
      let newLevel = currentLevel - 1
      if (newLevel < 1) newLevel = 14
      const itemType = this.getHiddenItemType(worldNum)
      this.saveHiddenItemConfig(worldNum, newLevel, itemType)
      valueText.setText(`Level ${newLevel}`)
    })
    
    rightArrow.on("pointerdown", () => {
      let newLevel = currentLevel + 1
      if (newLevel > 14) newLevel = 1
      const itemType = this.getHiddenItemType(worldNum)
      this.saveHiddenItemConfig(worldNum, newLevel, itemType)
      valueText.setText(`Level ${newLevel}`)
    })
  }
  
  /**
   * Add a dropdown selector for the hidden item type
   */
  addHiddenItemTypeSelector(label, currentType, worldNum, y) {
    const itemTypes = [
      { key: "record_deal", name: "Record Deal 💿" },
      { key: "vinyl", name: "Vinyl Record 📀" },
      { key: "mixtape", name: "Mixtape 📼" },
      { key: "cd", name: "CD 💽" },
      { key: "golden_note", name: "Golden Note 🎵" }
    ]
    
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    
    const currentItem = itemTypes.find(i => i.key === currentType) || itemTypes[0]
    let currentIndex = itemTypes.indexOf(currentItem)
    
    // Item type display
    const valueBg = this.add.rectangle(200, y, 140, 22, 0x0a0a1a)
      .setStrokeStyle(1, 0xff69b4)
      .setInteractive({ useHandCursor: true })
    
    const valueText = this.add.text(200, y, currentItem.name, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    
    // Left/Right arrows
    const leftArrow = this.add.text(120, y, "<", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff69b4"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    const rightArrow = this.add.text(280, y, ">", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff69b4"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    this.detailContent.add([labelText, valueBg, valueText, leftArrow, rightArrow])
    
    const updateType = (delta) => {
      currentIndex = (currentIndex + delta + itemTypes.length) % itemTypes.length
      const newItem = itemTypes[currentIndex]
      const level = this.getHiddenItemLevel(worldNum)
      this.saveHiddenItemConfig(worldNum, level, newItem.key)
      valueText.setText(newItem.name)
    }
    
    leftArrow.on("pointerdown", () => updateType(-1))
    rightArrow.on("pointerdown", () => updateType(1))
  }
  
  addSectionHeader(text, y) {
    const header = this.add.text(0, y, text, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ffff"
    })
    
    const line = this.add.rectangle(290, y + 8, 580, 1, 0x00ffff, 0.3)
    
    this.detailContent.add([header, line])
  }
  
  addEditableField(label, value, fieldKey, y, labelWidth, valueWidth, readonly = false) {
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    
    const valueBg = this.add.rectangle(labelWidth + valueWidth / 2, y, valueWidth, 22, 0x0a0a1a)
      .setStrokeStyle(1, readonly ? 0x333333 : 0x444466)
    
    const valueText = this.add.text(labelWidth + 5, y, value.substring(0, 60) + (value.length > 60 ? "..." : ""), {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: readonly ? "#666666" : "#ffffff"
    }).setOrigin(0, 0.5)
    
    this.detailContent.add([labelText, valueBg, valueText])
    
    if (!readonly) {
      valueBg.setInteractive({ useHandCursor: true })
      valueBg.on("pointerdown", () => {
        this.editField(fieldKey, value)
      })
      valueBg.on("pointerover", () => valueBg.setStrokeStyle(1, 0x00ffff))
      valueBg.on("pointerout", () => valueBg.setStrokeStyle(1, 0x444466))
    }
  }
  
  addMultilineField(label, value, fieldKey, y, width) {
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    
    const valueBg = this.add.rectangle(width / 2, y + 30, width, 45, 0x0a0a1a)
      .setStrokeStyle(1, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const valueText = this.add.text(5, y + 15, value.substring(0, 150) + (value.length > 150 ? "..." : ""), {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#aa88ff",
      wordWrap: { width: width - 20 }
    })
    
    this.detailContent.add([labelText, valueBg, valueText])
    
    valueBg.on("pointerdown", () => this.editField(fieldKey, value))
    valueBg.on("pointerover", () => valueBg.setStrokeStyle(1, 0x00ffff))
    valueBg.on("pointerout", () => valueBg.setStrokeStyle(1, 0x444466))
  }
  
  addColorField(label, value, fieldKey, x, y) {
    const labelText = this.add.text(x, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    })
    
    // Color swatch
    const colorValue = value ? parseInt(value.replace("#", ""), 16) : 0x333333
    const swatch = this.add.rectangle(x + 70, y, 20, 20, colorValue)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true })
    
    // Hex value
    const hexText = this.add.text(x + 90, y, value || "#000000", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffffff"
    }).setOrigin(0, 0.5)
    
    this.detailContent.add([labelText, swatch, hexText])
    
    swatch.on("pointerdown", () => this.editField(fieldKey, value || "#000000"))
  }
  
  /**
   * Add a slider field for numeric values (like brightness/contrast)
   */
  addSliderField(label, value, fieldKey, y, minVal, maxVal, formatter) {
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })

    // Slider track
    const trackX = 150
    const trackWidth = 200
    const track = this.add.rectangle(trackX + trackWidth / 2, y, trackWidth, 8, 0x333355)
      .setStrokeStyle(1, 0x444477)

    // Calculate knob position based on value
    const normalizedValue = (value - minVal) / (maxVal - minVal)
    const knobX = trackX + (normalizedValue * trackWidth)
    
    const knob = this.add.circle(knobX, y, 10, 0x88aaff)
      .setInteractive({ useHandCursor: true, draggable: true })

    // Value display
    const valueText = this.add.text(trackX + trackWidth + 20, y, formatter(value), {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#88aaff"
    }).setOrigin(0, 0.5)

    this.detailContent.add([labelText, track, knob, valueText])

    // Drag handling
    knob.on("drag", (pointer, dragX) => {
      const minX = trackX
      const maxX = trackX + trackWidth
      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX)
      knob.x = clampedX
      
      const newNormalized = (clampedX - minX) / (maxX - minX)
      const newValue = minVal + (newNormalized * (maxVal - minVal))
      
      // Update the world data
      const world = this.worlds[this.selectedWorldIndex]
      if (world) {
        world[fieldKey] = Math.round(newValue * 100) / 100 // Round to 2 decimals
        world._dirty = true
        valueText.setText(formatter(world[fieldKey]))
      }
    })

    // Click on track to set value
    track.setInteractive({ useHandCursor: true })
    track.on("pointerdown", (pointer) => {
      const localX = pointer.x - (this.detailContent.x + trackX)
      const clampedX = Phaser.Math.Clamp(localX, 0, trackWidth)
      const newNormalized = clampedX / trackWidth
      const newValue = minVal + (newNormalized * (maxVal - minVal))
      
      // Update knob position and value
      knob.x = trackX + clampedX
      
      const world = this.worlds[this.selectedWorldIndex]
      if (world) {
        world[fieldKey] = Math.round(newValue * 100) / 100
        world._dirty = true
        valueText.setText(formatter(world[fieldKey]))
      }
    })
  }
  
  editField(fieldKey, currentValue) {
    const newValue = window.prompt(`Edit ${fieldKey}:`, currentValue)
    
    if (newValue !== null && newValue !== currentValue) {
      // Update local data
      const world = this.worlds[this.selectedWorldIndex]
      world[fieldKey] = newValue
      
      // Mark as dirty (needs saving)
      world._dirty = true
      
      // Refresh display
      this.updateDetailPanel()
      this.showSuccess("Field updated - click SAVE to persist")
    }
  }
  
  async saveCurrentWorld() {
    const world = this.worlds[this.selectedWorldIndex]
    if (!world) return
    
    try {
      // Prepare update data (exclude internal fields)
      const updateData = { ...world }
      delete updateData._dirty
      delete updateData.id
      delete updateData.created_at
      delete updateData.updated_at
      
      const { error } = await supabase
        .from("world_metadata")
        .update(updateData)
        .eq("id", world.id)
      
      if (error) throw error
      
      world._dirty = false
      this.showSuccess("World saved successfully!")
      
    } catch (e) {
      console.error("[WorldEditor] Failed to save world:", e)
      this.showError("Failed to save world")
    }
  }
  
  copyPrompts() {
    const world = this.worlds[this.selectedWorldIndex]
    if (!world) return
    
    const prompts = `=== ${world.world_name} AI Prompts ===
    
TILESET:
${world.tileset_prompt || "No tileset prompt"}

BACKGROUND:
${world.background_prompt || "No background prompt"}

DECORATION:
${world.decoration_prompt || "No decoration prompt"}`
    
    navigator.clipboard.writeText(prompts)
      .then(() => this.showSuccess("Prompts copied to clipboard!"))
      .catch(() => this.showError("Failed to copy prompts"))
  }
  
  navigateUp() {
    // Cycle to bottom if at top (menu looping)
    if (this.selectedWorldIndex <= 0) {
      this.selectedWorldIndex = this.worlds.length - 1
    } else {
      this.selectedWorldIndex--
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updateWorldList()
    this.updateDetailPanel()
  }
  
  navigateDown() {
    // Cycle to top if at bottom (menu looping)
    if (this.selectedWorldIndex >= this.worlds.length - 1) {
      this.selectedWorldIndex = 0
    } else {
      this.selectedWorldIndex++
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updateWorldList()
    this.updateDetailPanel()
  }
  
  showError(message) {
    const errorText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 100,
      message,
      { fontFamily: "RetroPixel", fontSize: "14px", color: "#ff4444" }
    ).setOrigin(0.5)
    
    this.time.delayedCall(2000, () => errorText.destroy())
  }
  
  showSuccess(message) {
    const successText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 100,
      message,
      { fontFamily: "RetroPixel", fontSize: "14px", color: "#00ff88" }
    ).setOrigin(0.5)
    
    this.time.delayedCall(2000, () => successText.destroy())
  }
}
