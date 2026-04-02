import Phaser from "phaser"
import { supabase } from "./integrations/supabase/client.js"
import { BGMManager, MENU_KEYS } from "./BGMManager.js"
import { CutsceneFlowManager, CUTSCENE_SCENE_KEYS } from "./CutsceneFlowManager.js"

/**
 * StoryEditorScene - Full cutscene and dialogue management
 * Allows editing all narrative content stored in Supabase
 */
export class StoryEditorScene extends Phaser.Scene {
  constructor() {
    super({ key: "StoryEditorScene" })
    this.cutscenes = []
    this.selectedCutsceneIndex = 0
    this.currentCutscene = null
    this.shots = []
    this.selectedShotIndex = 0
    this.dialogues = []
    this.viewMode = "list" // "list", "cutscene", "shot", "dialogue"
    this.isLoading = false
    this.scrollOffset = 0
  }

  create() {
    const centerX = this.cameras.main.width / 2
    
    // Play dev mode music
    BGMManager.setDevMode(true)
    BGMManager.playMenuMusic(this, MENU_KEYS.DEV_MODE)
    
    // Background
    this.createBackground()
    
    // Title
    this.titleText = this.add.text(centerX, 30, "STORY EDITOR", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    
    this.subtitleText = this.add.text(centerX, 55, "Manage cutscenes, shots, and dialogue", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)
    
    // Create UI containers
    this.createListPanel()
    this.createDetailPanel()
    this.createActionButtons()
    this.createBackButton()
    
    // Setup input
    this.setupInput()
    
    // Load cutscenes
    this.loadCutscenes()
  }
  
  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)
    
    // Grid pattern
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x331144, 0.3)
    
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
  
  createListPanel() {
    // Left panel for cutscene list
    this.listPanel = this.add.container(10, 80)
    
    const panelBg = this.add.rectangle(0, 0, 320, 580, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.listTitle = this.add.text(160, 15, "CUTSCENES", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    
    this.listPanel.add([panelBg, this.listTitle])
    
    // Scrollable list container
    this.listItemsContainer = this.add.container(10, 130)
    
    // Loading indicator
    this.loadingText = this.add.text(170, 300, "Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#666666"
    }).setOrigin(0.5)
  }
  
  createDetailPanel() {
    // Right panel for selected item details
    this.detailPanel = this.add.container(340, 80)
    
    const panelBg = this.add.rectangle(0, 0, 500, 580, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x333366)
    
    this.detailTitle = this.add.text(250, 15, "DETAILS", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5)
    
    this.detailPanel.add([panelBg, this.detailTitle])
    
    // Detail content container
    this.detailContent = this.add.container(350, 120)
    
    // Placeholder text
    this.detailPlaceholder = this.add.text(590, 380, "Select a cutscene to view details", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#555555"
    }).setOrigin(0.5)
  }
  
  createActionButtons() {
    const buttonY = this.cameras.main.height - 50
    
    // Add Shot button
    this.addShotBtn = this.createSmallButton(400, buttonY, "ADD SHOT", 0x00ff88, () => this.addShot())
    this.addShotBtn.setVisible(false)
    
    // Add Dialogue button
    this.addDialogueBtn = this.createSmallButton(520, buttonY, "ADD DIALOGUE", 0x00ffff, () => this.addDialogue())
    this.addDialogueBtn.setVisible(false)
    
    // Preview button (only in list view for cutscenes)
    this.previewBtn = this.createSmallButton(640, buttonY, "PREVIEW", 0x00ff88, () => this.previewCutscene())
    
    // Edit button
    this.editBtn = this.createSmallButton(740, buttonY, "EDIT", 0xffaa00, () => this.editSelected())
    
    // Delete button
    this.deleteBtn = this.createSmallButton(830, buttonY, "DELETE", 0xff4444, () => this.deleteSelected())
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
      this.goBack()
    })
  }
  
  setupInput() {
    this.input.keyboard.on("keydown-ESC", () => this.goBack())
    this.input.keyboard.on("keydown-UP", () => this.navigateUp())
    this.input.keyboard.on("keydown-DOWN", () => this.navigateDown())
    this.input.keyboard.on("keydown-ENTER", () => this.selectItem())
    this.input.keyboard.on("keydown-BACKSPACE", () => this.goBackLevel())
    
    // Mouse wheel scrolling
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollList(deltaY > 0 ? 1 : -1)
    })
  }
  
  goBack() {
    if (this.viewMode === "dialogue") {
      this.viewMode = "shot"
      this.loadShotDialogues(this.shots[this.selectedShotIndex])
      this.updateListDisplay()
    } else if (this.viewMode === "shot") {
      this.viewMode = "cutscene"
      this.loadCutsceneShots(this.currentCutscene)
      this.updateListDisplay()
    } else if (this.viewMode === "cutscene") {
      this.viewMode = "list"
      this.updateListDisplay()
    } else {
      this.scene.start("DeveloperMenuScene")
    }
  }
  
  goBackLevel() {
    if (this.viewMode !== "list") {
      this.goBack()
    }
  }
  
  async loadCutscenes() {
    this.isLoading = true
    this.loadingText.setVisible(true)
    
    try {
      const { data, error } = await supabase
        .from("cutscenes")
        .select(`
          *,
          music_tracks (
            id, name, artist
          )
        `)
        .order("sort_order", { ascending: true })
      
      if (error) throw error
      
      this.cutscenes = data || []
      this.viewMode = "list"
      this.updateListDisplay()
      
    } catch (e) {
      console.error("[StoryEditor] Failed to load cutscenes:", e)
      this.showError("Failed to load cutscenes")
    } finally {
      this.isLoading = false
      this.loadingText.setVisible(false)
    }
  }
  
  async loadCutsceneShots(cutscene) {
    this.isLoading = true
    
    try {
      const { data, error } = await supabase
        .from("cutscene_shots")
        .select("*")
        .eq("cutscene_id", cutscene.id)
        .order("shot_order", { ascending: true })
      
      if (error) throw error
      
      this.shots = data || []
      this.selectedShotIndex = 0
      this.viewMode = "cutscene"
      this.updateListDisplay()
      
    } catch (e) {
      console.error("[StoryEditor] Failed to load shots:", e)
      this.showError("Failed to load shots")
    } finally {
      this.isLoading = false
    }
  }
  
  async loadShotDialogues(shot) {
    this.isLoading = true
    
    try {
      const { data, error } = await supabase
        .from("cutscene_dialogue")
        .select("*")
        .eq("shot_id", shot.id)
        .order("dialogue_order", { ascending: true })
      
      if (error) throw error
      
      this.dialogues = data || []
      this.viewMode = "shot"
      this.updateListDisplay()
      
    } catch (e) {
      console.error("[StoryEditor] Failed to load dialogues:", e)
      this.showError("Failed to load dialogues")
    } finally {
      this.isLoading = false
    }
  }
  
  updateListDisplay() {
    // Clear existing items
    this.listItemsContainer.removeAll(true)
    this.detailContent.removeAll(true)
    this.detailPlaceholder.setVisible(false)
    
    // Update title based on view mode
    switch (this.viewMode) {
      case "list":
        this.listTitle.setText("CUTSCENES")
        this.displayCutsceneList()
        this.addShotBtn.setVisible(false)
        this.addDialogueBtn.setVisible(false)
        this.previewBtn.setVisible(true)
        break
      case "cutscene":
        this.listTitle.setText(`SHOTS: ${this.currentCutscene?.title || ""}`)
        this.displayShotList()
        this.addShotBtn.setVisible(true)
        this.addDialogueBtn.setVisible(false)
        this.previewBtn.setVisible(true) // Can still preview from cutscene view
        break
      case "shot":
        this.listTitle.setText(`DIALOGUE: Shot ${this.shots[this.selectedShotIndex]?.shot_order || 0}`)
        this.displayDialogueList()
        this.addShotBtn.setVisible(false)
        this.addDialogueBtn.setVisible(true)
        this.previewBtn.setVisible(false)
        break
    }
  }
  
  displayCutsceneList() {
    const itemHeight = 50
    const maxVisible = 10
    
    this.cutscenes.forEach((cutscene, index) => {
      const y = index * itemHeight - this.scrollOffset
      
      if (y < -itemHeight || y > maxVisible * itemHeight) return
      
      const item = this.createListItem(
        index,
        cutscene.title,
        `${cutscene.cutscene_type} | World ${cutscene.world_number || "N/A"} | Act ${cutscene.act_number || "N/A"}`,
        this.getTypeColor(cutscene.cutscene_type),
        y
      )
      
      this.listItemsContainer.add(item)
    })
    
    if (this.cutscenes.length > 0) {
      this.displayCutsceneDetails(this.cutscenes[this.selectedCutsceneIndex])
    }
  }
  
  displayShotList() {
    const itemHeight = 50
    
    if (this.shots.length === 0) {
      const emptyText = this.add.text(150, 100, "No shots yet.\nClick 'ADD SHOT' to create one.", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#666666",
        align: "center"
      }).setOrigin(0.5)
      this.listItemsContainer.add(emptyText)
      return
    }
    
    this.shots.forEach((shot, index) => {
      const y = index * itemHeight - this.scrollOffset
      
      const item = this.createListItem(
        index,
        `Shot ${shot.shot_order}: ${shot.shot_type}`,
        shot.visual_description?.substring(0, 40) + "..." || "No description",
        this.getShotTypeColor(shot.shot_type),
        y
      )
      
      this.listItemsContainer.add(item)
    })
    
    if (this.shots.length > 0 && this.selectedShotIndex < this.shots.length) {
      this.displayShotDetails(this.shots[this.selectedShotIndex])
    }
  }
  
  displayDialogueList() {
    const itemHeight = 50
    
    if (this.dialogues.length === 0) {
      const emptyText = this.add.text(150, 100, "No dialogue yet.\nClick 'ADD DIALOGUE' to create one.", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#666666",
        align: "center"
      }).setOrigin(0.5)
      this.listItemsContainer.add(emptyText)
      return
    }
    
    this.dialogues.forEach((dialogue, index) => {
      const y = index * itemHeight - this.scrollOffset
      
      const item = this.createListItem(
        index,
        `${dialogue.speaker.toUpperCase()}`,
        dialogue.dialogue_text?.substring(0, 40) + "..." || "...",
        this.getSpeakerColor(dialogue.speaker),
        y
      )
      
      this.listItemsContainer.add(item)
    })
    
    if (this.dialogues.length > 0) {
      this.displayDialogueDetails(this.dialogues[this.selectedShotIndex])
    }
  }
  
  createListItem(index, title, subtitle, color, y) {
    const container = this.add.container(0, y)
    
    const isSelected = this.getSelectedIndex() === index
    
    const bg = this.add.rectangle(150, 0, 290, 45, isSelected ? 0x333355 : 0x1a1a2e)
      .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffffff : color)
      .setInteractive({ useHandCursor: true })
    
    const titleText = this.add.text(15, -8, title, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: isSelected ? "#ffffff" : Phaser.Display.Color.IntegerToColor(color).rgba
    })
    
    const subtitleText = this.add.text(15, 8, subtitle, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    })
    
    container.add([bg, titleText, subtitleText])
    
    bg.on("pointerdown", () => {
      this.setSelectedIndex(index)
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.updateListDisplay()
    })
    
    bg.on("pointerdblclick", () => {
      this.selectItem()
    })
    
    return container
  }
  
  displayCutsceneDetails(cutscene) {
    if (!cutscene) return
    
    const startY = 0
    const lineHeight = 22
    let y = startY
    
    const fields = [
      { label: "Key:", value: cutscene.cutscene_key },
      { label: "Title:", value: cutscene.title },
      { label: "Type:", value: cutscene.cutscene_type },
      { label: "World:", value: cutscene.world_number || "N/A" },
      { label: "Act:", value: cutscene.act_number || "N/A" },
      { label: "Duration:", value: `${cutscene.estimated_duration_seconds}s` },
      { label: "Skippable:", value: cutscene.is_skippable ? "Yes" : "No" },
      { label: "Published:", value: cutscene.is_published ? "Yes" : "No" },
      { label: "Description:", value: cutscene.description || "No description" }
    ]
    
    fields.forEach(field => {
      const label = this.add.text(0, y, field.label, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#888888"
      })
      
      const value = this.add.text(100, y, String(field.value).substring(0, 45), {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#ffffff"
      })
      
      this.detailContent.add([label, value])
      y += lineHeight
    })
    
    // Show shot count
    y += 10
    const shotCountLabel = this.add.text(0, y, "Shots:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    
    const shotCountValue = this.add.text(100, y, `${this.shots.length || "?"} shots`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#00ff88"
    })
    
    this.detailContent.add([shotCountLabel, shotCountValue])
    
    // Music Track Assignment Section
    y += 30
    const musicLabel = this.add.text(0, y, "Music:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    this.detailContent.add(musicLabel)

    const hasTrack = cutscene.music_track_id !== null
    const trackName = cutscene.music_tracks?.name || "No music assigned"
    const trackColor = hasTrack ? "#ff8844" : "#666666"

    const musicValue = this.add.text(100, y, trackName, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: trackColor
    })
    this.detailContent.add(musicValue)

    // Music assign/change button
    y += 25
    const musicBtnBg = this.add.rectangle(70, y, 140, 28, hasTrack ? 0x2a2a1a : 0x1a2a1a)
      .setStrokeStyle(1, 0xff8844)
      .setInteractive({ useHandCursor: true })
    
    const musicBtnText = this.add.text(70, y, hasTrack ? "🎵 CHANGE MUSIC" : "🎵 ASSIGN MUSIC", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ff8844"
    }).setOrigin(0.5)

    musicBtnBg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.openCutsceneMusicPicker(cutscene)
    })
    musicBtnBg.on("pointerover", () => musicBtnBg.setStrokeStyle(2, 0xffffff))
    musicBtnBg.on("pointerout", () => musicBtnBg.setStrokeStyle(1, 0xff8844))

    this.detailContent.add([musicBtnBg, musicBtnText])

    // Clear music button (if track is assigned)
    if (hasTrack) {
      const clearBtnBg = this.add.rectangle(180, y, 60, 28, 0x2a1a1a)
        .setStrokeStyle(1, 0xff4444)
        .setInteractive({ useHandCursor: true })
      
      const clearBtnText = this.add.text(180, y, "CLEAR", {
        fontFamily: "RetroPixel",
        fontSize: "9px",
        color: "#ff4444"
      }).setOrigin(0.5)

      clearBtnBg.on("pointerdown", async () => {
        this.sound.play("ui_select_sound", { volume: 0.2 })
        await this.clearCutsceneMusic(cutscene)
      })
      clearBtnBg.on("pointerover", () => clearBtnBg.setStrokeStyle(2, 0xffffff))
      clearBtnBg.on("pointerout", () => clearBtnBg.setStrokeStyle(1, 0xff4444))

      this.detailContent.add([clearBtnBg, clearBtnText])
    }
    
    // Instructions
    y += 40
    const instructions = this.add.text(0, y, "Press ENTER to view/edit shots\nPress E to edit cutscene details", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#555555"
    })
    this.detailContent.add(instructions)
  }

  async openCutsceneMusicPicker(cutscene) {
    // Import TrackPickerModal
    const { TrackPickerModal } = await import("./TrackPickerModal.js")

    const picker = new TrackPickerModal(this, {
      title: "SELECT CUTSCENE MUSIC",
      subtitle: `For: ${cutscene.title || cutscene.cutscene_key}`,
      currentTrackId: cutscene.music_track_id,
      onSelect: async (track) => {
        await this.assignCutsceneMusic(cutscene, track)
      },
      onCancel: () => {
        // Nothing to do
      },
      onUpload: () => {
        this.scene.start("TrackUploaderScene")
      }
    })

    await picker.open()
  }

  async assignCutsceneMusic(cutscene, track) {
    try {
      const { error } = await supabase
        .from("cutscenes")
        .update({ music_track_id: track.id })
        .eq("id", cutscene.id)

      if (error) throw error

      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      
      // Update local data
      cutscene.music_track_id = track.id
      cutscene.music_tracks = { id: track.id, name: track.name, artist: track.artist }
      
      // Refresh display
      this.updateListDisplay()
    } catch (e) {
      console.error("[StoryEditor] Failed to assign music:", e)
      this.showError("Failed to assign music")
    }
  }

  async clearCutsceneMusic(cutscene) {
    try {
      const { error } = await supabase
        .from("cutscenes")
        .update({ music_track_id: null })
        .eq("id", cutscene.id)

      if (error) throw error

      this.sound.play("ui_select_sound", { volume: 0.2 })
      
      // Update local data
      cutscene.music_track_id = null
      cutscene.music_tracks = null
      
      // Refresh display
      this.updateListDisplay()
    } catch (e) {
      console.error("[StoryEditor] Failed to clear music:", e)
      this.showError("Failed to clear music")
    }
  }
  
  displayShotDetails(shot) {
    if (!shot) return
    
    const startY = 0
    const lineHeight = 22
    let y = startY
    
    const fields = [
      { label: "Order:", value: shot.shot_order },
      { label: "Type:", value: shot.shot_type },
      { label: "Duration:", value: `${shot.duration_seconds}s` },
      { label: "Camera:", value: shot.camera_direction || "None" },
      { label: "Lighting:", value: shot.lighting_notes || "None" },
      { label: "Transition In:", value: shot.transition_in },
      { label: "Transition Out:", value: shot.transition_out }
    ]
    
    fields.forEach(field => {
      const label = this.add.text(0, y, field.label, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#888888"
      })
      
      const value = this.add.text(100, y, String(field.value), {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#ffffff"
      })
      
      this.detailContent.add([label, value])
      y += lineHeight
    })
    
    // Visual description (multiline)
    y += 10
    const descLabel = this.add.text(0, y, "Visual:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    this.detailContent.add(descLabel)
    
    y += lineHeight
    const descValue = this.add.text(0, y, shot.visual_description || "No description", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#cccccc",
      wordWrap: { width: 380 }
    })
    this.detailContent.add(descValue)
    
    // AI Prompt
    y += descValue.height + 20
    const promptLabel = this.add.text(0, y, "AI Prompt:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    this.detailContent.add(promptLabel)
    
    y += lineHeight
    const promptValue = this.add.text(0, y, shot.ai_prompt || "No prompt set", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#aa88ff",
      wordWrap: { width: 380 }
    })
    this.detailContent.add(promptValue)
  }
  
  displayDialogueDetails(dialogue) {
    if (!dialogue) return
    
    const startY = 0
    const lineHeight = 22
    let y = startY
    
    const fields = [
      { label: "Speaker:", value: dialogue.speaker },
      { label: "Emotion:", value: dialogue.emotion || "neutral" },
      { label: "Voice Dir:", value: dialogue.voice_direction || "normal" },
      { label: "Delay:", value: `${dialogue.delay_before_seconds}s` },
      { label: "Duration:", value: dialogue.display_duration_seconds ? `${dialogue.display_duration_seconds}s` : "auto" }
    ]
    
    fields.forEach(field => {
      const label = this.add.text(0, y, field.label, {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#888888"
      })
      
      const value = this.add.text(100, y, String(field.value), {
        fontFamily: "RetroPixel",
        fontSize: "11px",
        color: "#ffffff"
      })
      
      this.detailContent.add([label, value])
      y += lineHeight
    })
    
    // Full dialogue text
    y += 20
    const textLabel = this.add.text(0, y, "Dialogue Text:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    this.detailContent.add(textLabel)
    
    y += lineHeight
    const textValue = this.add.text(0, y, `"${dialogue.dialogue_text}"`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ffff",
      fontStyle: "italic",
      wordWrap: { width: 380 }
    })
    this.detailContent.add(textValue)
  }
  
  getTypeColor(type) {
    const colors = {
      intro: 0xff69b4,
      world_intro: 0x00ff88,
      post_boss: 0xffaa00,
      end_of_act: 0xff4444,
      epilogue: 0x00ffff,
      bonus_unlock: 0xaa44ff,
      special: 0xffff00
    }
    return colors[type] || 0xffffff
  }
  
  getShotTypeColor(type) {
    const colors = {
      establishing: 0x00ff88,
      close_up: 0xff69b4,
      medium: 0x00ffff,
      wide: 0xffaa00,
      action: 0xff4444,
      dialogue: 0xaa44ff,
      transition: 0x888888,
      title_card: 0xffff00,
      montage: 0xff00ff
    }
    return colors[type] || 0xffffff
  }
  
  getSpeakerColor(speaker) {
    const colors = {
      narrator: 0x888888,
      teddy: 0x00ff88,
      scientist: 0x00ffff,
      algorithm: 0xff0000,
      robot_1man_band: 0xff4444,
      riff: 0xffaa00,
      groove: 0x00aaff,
      echo: 0xaa44ff,
      human_self: 0xff69b4,
      crowd: 0x666666,
      radio: 0xaaaa00,
      system: 0x444444
    }
    return colors[speaker] || 0xffffff
  }
  
  getSelectedIndex() {
    switch (this.viewMode) {
      case "list": return this.selectedCutsceneIndex
      case "cutscene": return this.selectedShotIndex
      case "shot": return this.selectedShotIndex
      default: return 0
    }
  }
  
  setSelectedIndex(index) {
    switch (this.viewMode) {
      case "list": 
        this.selectedCutsceneIndex = index
        break
      case "cutscene": 
      case "shot":
        this.selectedShotIndex = index
        break
    }
  }
  
  navigateUp() {
    const currentIndex = this.getSelectedIndex()
    const maxIndex = this.getMaxIndex()
    // Cycle to bottom if at top (menu looping)
    if (currentIndex <= 0) {
      this.setSelectedIndex(maxIndex - 1)
    } else {
      this.setSelectedIndex(currentIndex - 1)
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updateListDisplay()
  }
  
  navigateDown() {
    const currentIndex = this.getSelectedIndex()
    const maxIndex = this.getMaxIndex()
    // Cycle to top if at bottom (menu looping)
    if (currentIndex >= maxIndex - 1) {
      this.setSelectedIndex(0)
    } else {
      this.setSelectedIndex(currentIndex + 1)
    }
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.updateListDisplay()
  }
  
  getMaxIndex() {
    switch (this.viewMode) {
      case "list": return this.cutscenes.length
      case "cutscene": return this.shots.length
      case "shot": return this.dialogues.length
      default: return 0
    }
  }
  
  scrollList(direction) {
    const maxScroll = Math.max(0, (this.getMaxIndex() - 10) * 50)
    this.scrollOffset = Phaser.Math.Clamp(
      this.scrollOffset + direction * 50,
      0,
      maxScroll
    )
    this.updateListDisplay()
  }
  
  selectItem() {
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    
    switch (this.viewMode) {
      case "list":
        this.currentCutscene = this.cutscenes[this.selectedCutsceneIndex]
        this.loadCutsceneShots(this.currentCutscene)
        break
      case "cutscene":
        if (this.shots.length > 0) {
          this.loadShotDialogues(this.shots[this.selectedShotIndex])
        }
        break
      case "shot":
        // Open dialogue editor
        this.editSelected()
        break
    }
  }
  
  async addShot() {
    if (!this.currentCutscene) return
    
    const newOrder = this.shots.length + 1
    
    try {
      const { data, error } = await supabase
        .from("cutscene_shots")
        .insert({
          cutscene_id: this.currentCutscene.id,
          shot_order: newOrder,
          shot_type: "medium",
          visual_description: "New shot - edit description",
          duration_seconds: 3.0
        })
        .select()
        .single()
      
      if (error) throw error
      
      this.shots.push(data)
      this.selectedShotIndex = this.shots.length - 1
      this.updateListDisplay()
      this.showSuccess("Shot added!")
      
    } catch (e) {
      console.error("[StoryEditor] Failed to add shot:", e)
      this.showError("Failed to add shot")
    }
  }
  
  async addDialogue() {
    if (this.shots.length === 0) return
    
    const currentShot = this.shots[this.selectedShotIndex]
    const newOrder = this.dialogues.length
    
    try {
      const { data, error } = await supabase
        .from("cutscene_dialogue")
        .insert({
          shot_id: currentShot.id,
          dialogue_order: newOrder,
          speaker: "teddy",
          dialogue_text: "New dialogue line - edit me"
        })
        .select()
        .single()
      
      if (error) throw error
      
      this.dialogues.push(data)
      this.updateListDisplay()
      this.showSuccess("Dialogue added!")
      
    } catch (e) {
      console.error("[StoryEditor] Failed to add dialogue:", e)
      this.showError("Failed to add dialogue")
    }
  }
  
  /**
   * Preview the selected cutscene by launching its scene
   */
  previewCutscene() {
    // Get the cutscene to preview (current cutscene or selected from list)
    const cutscene = this.viewMode === "list" 
      ? this.cutscenes[this.selectedCutsceneIndex]
      : this.currentCutscene
    
    if (!cutscene) {
      this.showError("No cutscene selected")
      return
    }
    
    // Get the scene key for this cutscene
    const sceneKey = CUTSCENE_SCENE_KEYS[cutscene.cutscene_key]
    
    if (!sceneKey) {
      this.showError(`No scene found for: ${cutscene.cutscene_key}`)
      return
    }
    
    // Check if scene exists
    if (!this.scene.get(sceneKey)) {
      this.showError(`Scene not registered: ${sceneKey}`)
      return
    }
    
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    BGMManager.stop()
    
    // Launch the cutscene with return to story editor
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(300, () => {
      this.scene.start(sceneKey, {
        returnScene: "StoryEditorScene",
        returnData: {}
      })
    })
  }
  
  editSelected() {
    // For now, show a prompt - in full implementation, open modal editor
    const item = this.getSelectedItem()
    if (!item) return
    
    // Store current editing context
    this.registry.set("storyEditor_editItem", item)
    this.registry.set("storyEditor_editType", this.viewMode)
    
    // Open the edit modal scene
    this.scene.launch("StoryEditModalScene", {
      item: item,
      type: this.viewMode,
      callback: () => {
        // Refresh after edit
        if (this.viewMode === "list") {
          this.loadCutscenes()
        } else if (this.viewMode === "cutscene") {
          this.loadCutsceneShots(this.currentCutscene)
        } else if (this.viewMode === "shot") {
          this.loadShotDialogues(this.shots[this.selectedShotIndex])
        }
      }
    })
  }
  
  async deleteSelected() {
    const item = this.getSelectedItem()
    if (!item) return
    
    // Confirm deletion
    const confirmDelete = window.confirm(`Delete this ${this.viewMode}? This cannot be undone.`)
    if (!confirmDelete) return
    
    try {
      let table = ""
      switch (this.viewMode) {
        case "cutscene": table = "cutscene_shots"; break
        case "shot": table = "cutscene_dialogue"; break
        default: 
          this.showError("Cannot delete cutscenes (protected)")
          return
      }
      
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", item.id)
      
      if (error) throw error
      
      this.showSuccess("Deleted successfully")
      
      // Refresh list
      if (this.viewMode === "cutscene") {
        this.loadCutsceneShots(this.currentCutscene)
      } else if (this.viewMode === "shot") {
        this.loadShotDialogues(this.shots[this.selectedShotIndex])
      }
      
    } catch (e) {
      console.error("[StoryEditor] Failed to delete:", e)
      this.showError("Failed to delete")
    }
  }
  
  getSelectedItem() {
    switch (this.viewMode) {
      case "list": return this.cutscenes[this.selectedCutsceneIndex]
      case "cutscene": return this.shots[this.selectedShotIndex]
      case "shot": return this.dialogues[this.selectedShotIndex]
      default: return null
    }
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
