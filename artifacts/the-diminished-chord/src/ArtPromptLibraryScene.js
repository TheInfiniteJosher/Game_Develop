import Phaser from "phaser"
import { supabase } from "./integrations/supabase/client.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"

/**
 * ArtPromptLibraryScene - Manage AI generation prompts for all game assets
 * Organized by category: tileset, background, character, boss, cutscene, ui
 */
export class ArtPromptLibraryScene extends Phaser.Scene {
  constructor() {
    super({ key: "ArtPromptLibraryScene" })
    this.prompts = []
    this.filteredPrompts = []
    this.selectedIndex = 0
    this.currentCategory = "all"
    this.isLoading = false
    this.scrollOffset = 0
  }

  create() {
    const centerX = this.cameras.main.width / 2
    
    BGMManager.setDevMode(true)
    BGMManager.playMenuMusic(this, MENU_KEYS.DEV_MODE)
    
    this.createBackground()
    
    // Title
    this.add.text(centerX, 30, "ART PROMPT LIBRARY", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#aa44ff"
    }).setOrigin(0.5)
    
    this.add.text(centerX, 55, "AI generation prompts for tilesets, backgrounds, characters & more", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    
    // Create UI
    this.createCategoryTabs()
    this.createPromptList()
    this.createDetailPanel()
    this.createActionButtons()
    this.createBackButton()
    
    this.setupInput()
    this.loadPrompts()
  }
  
  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)
    
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x220044, 0.3)
    
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
  
  createCategoryTabs() {
    const categories = [
      { key: "all", label: "ALL", color: 0xffffff },
      { key: "tileset", label: "TILESETS", color: 0x00ff88 },
      { key: "background", label: "BACKGROUNDS", color: 0x00aaff },
      { key: "character", label: "CHARACTERS", color: 0xff69b4 },
      { key: "boss", label: "BOSSES", color: 0xff4444 },
      { key: "cutscene", label: "CUTSCENES", color: 0xffaa00 },
      { key: "ui", label: "UI", color: 0xaa44ff }
    ]
    
    this.categoryButtons = []
    const startX = 60
    const spacing = 110
    
    categories.forEach((cat, index) => {
      const x = startX + index * spacing
      const isActive = cat.key === this.currentCategory
      
      const btn = this.add.container(x, 90)
      
      const bg = this.add.rectangle(0, 0, 100, 25, isActive ? 0x333355 : 0x1a1a2e)
        .setStrokeStyle(isActive ? 2 : 1, isActive ? 0xffffff : cat.color)
        .setInteractive({ useHandCursor: true })
      
      const label = this.add.text(0, 0, cat.label, {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: isActive ? "#ffffff" : Phaser.Display.Color.IntegerToColor(cat.color).rgba
      }).setOrigin(0.5)
      
      btn.add([bg, label])
      btn.categoryKey = cat.key
      
      bg.on("pointerdown", () => {
        this.currentCategory = cat.key
        this.filterPrompts()
        this.updateCategoryTabs()
        this.updatePromptList()
        this.sound.play("ui_select_sound", { volume: 0.2 })
      })
      
      this.categoryButtons.push({ container: btn, bg, label, color: cat.color })
    })
  }
  
  updateCategoryTabs() {
    this.categoryButtons.forEach(btn => {
      const isActive = btn.container.categoryKey === this.currentCategory
      btn.bg.setStrokeStyle(isActive ? 2 : 1, isActive ? 0xffffff : btn.color)
      btn.bg.setFillStyle(isActive ? 0x333355 : 0x1a1a2e)
      btn.label.setColor(isActive ? "#ffffff" : Phaser.Display.Color.IntegerToColor(btn.color).rgba)
    })
  }
  
  createPromptList() {
    // Left panel
    this.listPanel = this.add.container(10, 115)
    
    const panelBg = this.add.rectangle(0, 0, 300, 535, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.listTitle = this.add.text(150, 15, "PROMPTS", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#aa44ff"
    }).setOrigin(0.5)
    
    this.listPanel.add([panelBg, this.listTitle])
    
    this.promptListContainer = this.add.container(20, 160)
    
    this.loadingText = this.add.text(160, 400, "Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5)
  }
  
  createDetailPanel() {
    this.detailPanel = this.add.container(320, 115)
    
    const panelBg = this.add.rectangle(0, 0, 520, 535, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.detailTitle = this.add.text(260, 15, "PROMPT DETAILS", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff"
    }).setOrigin(0.5)
    
    this.detailPanel.add([panelBg, this.detailTitle])
    
    this.detailContent = this.add.container(335, 160)
  }
  
  createActionButtons() {
    const buttonY = this.cameras.main.height - 50
    
    this.addPromptBtn = this.createSmallButton(500, buttonY, "NEW PROMPT", 0x00ff88, () => this.addPrompt())
    this.copyBtn = this.createSmallButton(620, buttonY, "COPY", 0xaa44ff, () => this.copyPrompt())
    this.saveBtn = this.createSmallButton(720, buttonY, "SAVE", 0x00ffff, () => this.savePrompt())
    this.deleteBtn = this.createSmallButton(810, buttonY, "DELETE", 0xff4444, () => this.deletePrompt())
  }
  
  createSmallButton(x, y, text, color, callback) {
    const container = this.add.container(x, y)
    
    const bg = this.add.rectangle(0, 0, 90, 30, 0x1a1a2e)
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
    
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollList(deltaY > 0 ? 1 : -1)
    })
  }
  
  async loadPrompts() {
    this.isLoading = true
    this.loadingText.setVisible(true)
    
    try {
      const { data, error } = await supabase
        .from("art_prompts")
        .select("*")
        .order("category", { ascending: true })
        .order("world_number", { ascending: true, nullsFirst: true })
      
      if (error) throw error
      
      this.prompts = data || []
      this.filterPrompts()
      this.updatePromptList()
      this.updateDetailPanel()
      
    } catch (e) {
      console.error("[ArtPromptLibrary] Failed to load prompts:", e)
      this.showError("Failed to load prompts")
    } finally {
      this.isLoading = false
      this.loadingText.setVisible(false)
    }
  }
  
  filterPrompts() {
    if (this.currentCategory === "all") {
      this.filteredPrompts = [...this.prompts]
    } else {
      this.filteredPrompts = this.prompts.filter(p => p.category === this.currentCategory)
    }
    this.selectedIndex = 0
    this.scrollOffset = 0
  }
  
  updatePromptList() {
    this.promptListContainer.removeAll(true)
    
    const categoryColors = {
      tileset: 0x00ff88,
      background: 0x00aaff,
      character: 0xff69b4,
      boss: 0xff4444,
      cutscene: 0xffaa00,
      ui: 0xaa44ff
    }
    
    const itemHeight = 45
    const maxVisible = 10
    
    this.listTitle.setText(`PROMPTS (${this.filteredPrompts.length})`)
    
    this.filteredPrompts.forEach((prompt, index) => {
      const y = index * itemHeight - this.scrollOffset
      
      if (y < -itemHeight || y > maxVisible * itemHeight) return
      
      const isSelected = index === this.selectedIndex
      const color = categoryColors[prompt.category] || 0xffffff
      
      const item = this.add.container(0, y)
      
      const bg = this.add.rectangle(140, 0, 275, 42, isSelected ? 0x333355 : 0x1a1a2e)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffffff : color)
        .setInteractive({ useHandCursor: true })
      
      // Category badge
      const badge = this.add.rectangle(5, 0, 8, 40, color)
      
      // Prompt name
      const nameText = this.add.text(20, -8, prompt.prompt_name || prompt.prompt_key, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: isSelected ? "#ffffff" : "#cccccc"
      })
      
      // World number if applicable
      const worldText = this.add.text(20, 8, 
        prompt.world_number ? `World ${prompt.world_number} • ${prompt.category}` : prompt.category, {
        fontFamily: "RetroPixel",
        fontSize: "8px",
        color: "#666666"
      })
      
      item.add([bg, badge, nameText, worldText])
      
      bg.on("pointerdown", () => {
        this.selectedIndex = index
        this.sound.play("ui_select_sound", { volume: 0.2 })
        this.updatePromptList()
        this.updateDetailPanel()
      })
      
      this.promptListContainer.add(item)
    })
  }
  
  updateDetailPanel() {
    this.detailContent.removeAll(true)
    
    const prompt = this.filteredPrompts[this.selectedIndex]
    if (!prompt) {
      this.detailTitle.setText("NO PROMPT SELECTED")
      return
    }
    
    this.detailTitle.setText(prompt.prompt_name || prompt.prompt_key)
    
    let y = 0
    const lineHeight = 26
    
    // Basic Info
    this.addSectionHeader("INFO", y)
    y += 25
    
    this.addEditableField("Key:", prompt.prompt_key, "prompt_key", y, true)
    y += lineHeight
    
    this.addEditableField("Name:", prompt.prompt_name || "", "prompt_name", y)
    y += lineHeight
    
    this.addEditableField("Category:", prompt.category, "category", y)
    y += lineHeight
    
    this.addEditableField("World:", prompt.world_number ? String(prompt.world_number) : "Global", "world_number", y)
    y += lineHeight + 10
    
    // Base Prompt
    this.addSectionHeader("BASE PROMPT", y)
    y += 25
    
    this.addMultilineField(prompt.base_prompt || "", "base_prompt", y, 480, 80)
    y += 95
    
    // Style Modifiers
    this.addSectionHeader("STYLE MODIFIERS", y)
    y += 25
    
    const modifiers = prompt.style_modifiers || []
    this.addEditableField("Modifiers:", modifiers.join(", "), "style_modifiers", y)
    y += lineHeight + 10
    
    // Negative Prompt
    this.addSectionHeader("NEGATIVE PROMPT", y)
    y += 25
    
    this.addMultilineField(prompt.negative_prompt || "No negative prompt", "negative_prompt", y, 480, 50)
    y += 65
    
    // Generated Results
    this.addSectionHeader("RESULTS", y)
    y += 25
    
    const urls = prompt.generated_urls || []
    const resultText = this.add.text(0, y, urls.length > 0 ? `${urls.length} generated assets` : "No generated assets yet", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: urls.length > 0 ? "#00ff88" : "#666666"
    })
    this.detailContent.add(resultText)
    
    if (prompt.selected_url) {
      y += 20
      const selectedText = this.add.text(0, y, `Selected: ${prompt.selected_url.substring(0, 50)}...`, {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#aa44ff"
      })
      this.detailContent.add(selectedText)
    }
  }
  
  addSectionHeader(text, y) {
    const header = this.add.text(0, y, text, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#aa44ff"
    })
    
    const line = this.add.rectangle(240, y + 6, 480, 1, 0xaa44ff, 0.3)
    
    this.detailContent.add([header, line])
  }
  
  addEditableField(label, value, fieldKey, y, readonly = false) {
    const labelText = this.add.text(0, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    })
    
    const valueBg = this.add.rectangle(290, y, 380, 20, 0x0a0a1a)
      .setStrokeStyle(1, readonly ? 0x222222 : 0x444466)
    
    const valueText = this.add.text(105, y, (value || "(empty)").substring(0, 45), {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: readonly ? "#555555" : (value ? "#ffffff" : "#555555")
    }).setOrigin(0, 0.5)
    
    this.detailContent.add([labelText, valueBg, valueText])
    
    if (!readonly) {
      valueBg.setInteractive({ useHandCursor: true })
      valueBg.on("pointerdown", () => this.editField(fieldKey, value))
      valueBg.on("pointerover", () => valueBg.setStrokeStyle(1, 0xaa44ff))
      valueBg.on("pointerout", () => valueBg.setStrokeStyle(1, 0x444466))
    }
  }
  
  addMultilineField(value, fieldKey, y, width, height) {
    const valueBg = this.add.rectangle(width / 2, y + height / 2, width, height, 0x0a0a1a)
      .setStrokeStyle(1, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const valueText = this.add.text(5, y + 5, (value || "(empty)").substring(0, 300), {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: value ? "#cccccc" : "#555555",
      wordWrap: { width: width - 20 }
    })
    
    this.detailContent.add([valueBg, valueText])
    
    valueBg.on("pointerdown", () => this.editField(fieldKey, value))
    valueBg.on("pointerover", () => valueBg.setStrokeStyle(1, 0xaa44ff))
    valueBg.on("pointerout", () => valueBg.setStrokeStyle(1, 0x444466))
  }
  
  editField(fieldKey, currentValue) {
    let newValue
    
    if (fieldKey === "style_modifiers") {
      newValue = window.prompt("Edit style modifiers (comma-separated):", currentValue)
      if (newValue !== null && newValue !== currentValue) {
        const prompt = this.filteredPrompts[this.selectedIndex]
        prompt[fieldKey] = newValue.split(",").map(s => s.trim()).filter(s => s)
        prompt._dirty = true
        this.updateDetailPanel()
        this.showSuccess("Updated - click SAVE to persist")
      }
    } else if (fieldKey === "world_number") {
      newValue = window.prompt("World number (or empty for global):", currentValue === "Global" ? "" : currentValue)
      if (newValue !== null) {
        const prompt = this.filteredPrompts[this.selectedIndex]
        prompt[fieldKey] = newValue ? parseInt(newValue) : null
        prompt._dirty = true
        this.updateDetailPanel()
        this.showSuccess("Updated - click SAVE to persist")
      }
    } else {
      newValue = window.prompt(`Edit ${fieldKey}:`, currentValue || "")
      if (newValue !== null && newValue !== currentValue) {
        const prompt = this.filteredPrompts[this.selectedIndex]
        prompt[fieldKey] = newValue
        prompt._dirty = true
        this.updateDetailPanel()
        this.showSuccess("Updated - click SAVE to persist")
      }
    }
  }
  
  async addPrompt() {
    const promptKey = window.prompt("Enter prompt key (e.g., 'world_1_tileset'):")
    if (!promptKey) return
    
    const category = window.prompt("Enter category (tileset/background/character/boss/cutscene/ui):")
    if (!category) return
    
    const promptName = window.prompt("Enter display name:")
    
    try {
      const { data, error } = await supabase
        .from("art_prompts")
        .insert({
          prompt_key: promptKey,
          category: category,
          prompt_name: promptName || promptKey,
          base_prompt: "Enter your AI prompt here"
        })
        .select()
        .single()
      
      if (error) throw error
      
      this.prompts.push(data)
      this.filterPrompts()
      this.selectedIndex = this.filteredPrompts.length - 1
      this.updatePromptList()
      this.updateDetailPanel()
      this.showSuccess("Prompt created!")
      
    } catch (e) {
      console.error("[ArtPromptLibrary] Failed to add prompt:", e)
      this.showError("Failed to add prompt: " + e.message)
    }
  }
  
  copyPrompt() {
    const prompt = this.filteredPrompts[this.selectedIndex]
    if (!prompt) return
    
    const fullPrompt = this.buildFullPrompt(prompt)
    
    navigator.clipboard.writeText(fullPrompt)
      .then(() => this.showSuccess("Prompt copied to clipboard!"))
      .catch(() => this.showError("Failed to copy"))
  }
  
  buildFullPrompt(prompt) {
    let full = prompt.base_prompt || ""
    
    const modifiers = prompt.style_modifiers || []
    if (modifiers.length > 0) {
      full += ", " + modifiers.join(", ")
    }
    
    // Add standard game style
    full += ", stylized pixel art, game asset, no real brands or logos"
    
    return full
  }
  
  async savePrompt() {
    const prompt = this.filteredPrompts[this.selectedIndex]
    if (!prompt) return
    
    try {
      const updateData = { ...prompt }
      delete updateData._dirty
      delete updateData.id
      delete updateData.created_at
      delete updateData.updated_at
      
      const { error } = await supabase
        .from("art_prompts")
        .update(updateData)
        .eq("id", prompt.id)
      
      if (error) throw error
      
      prompt._dirty = false
      this.showSuccess("Prompt saved!")
      
    } catch (e) {
      console.error("[ArtPromptLibrary] Failed to save:", e)
      this.showError("Failed to save prompt")
    }
  }
  
  async deletePrompt() {
    const prompt = this.filteredPrompts[this.selectedIndex]
    if (!prompt) return
    
    const confirm = window.confirm(`Delete "${prompt.prompt_name}"? This cannot be undone.`)
    if (!confirm) return
    
    try {
      const { error } = await supabase
        .from("art_prompts")
        .delete()
        .eq("id", prompt.id)
      
      if (error) throw error
      
      // Remove from arrays
      const mainIndex = this.prompts.findIndex(p => p.id === prompt.id)
      if (mainIndex >= 0) this.prompts.splice(mainIndex, 1)
      
      this.filterPrompts()
      if (this.selectedIndex >= this.filteredPrompts.length) {
        this.selectedIndex = Math.max(0, this.filteredPrompts.length - 1)
      }
      
      this.updatePromptList()
      this.updateDetailPanel()
      this.showSuccess("Prompt deleted")
      
    } catch (e) {
      console.error("[ArtPromptLibrary] Failed to delete:", e)
      this.showError("Failed to delete prompt")
    }
  }
  
  navigateUp() {
    // Cycle to bottom if at top (menu looping)
    if (this.selectedIndex <= 0) {
      this.selectedIndex = this.filteredPrompts.length - 1
    } else {
      this.selectedIndex--
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updatePromptList()
    this.updateDetailPanel()
  }
  
  navigateDown() {
    // Cycle to top if at bottom (menu looping)
    if (this.selectedIndex >= this.filteredPrompts.length - 1) {
      this.selectedIndex = 0
    } else {
      this.selectedIndex++
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updatePromptList()
    this.updateDetailPanel()
  }
  
  scrollList(direction) {
    const maxScroll = Math.max(0, (this.filteredPrompts.length - 10) * 45)
    this.scrollOffset = Phaser.Math.Clamp(
      this.scrollOffset + direction * 45,
      0,
      maxScroll
    )
    this.updatePromptList()
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
