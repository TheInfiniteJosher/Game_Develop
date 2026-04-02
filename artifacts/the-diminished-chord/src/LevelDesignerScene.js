import Phaser from "phaser"
import { SavedLevelsManager } from "./SavedLevelsManager.js"
import { LEVEL_ORDER, LEVEL_METADATA } from "./LevelManager.js"
import { WORLDS, getAllLevelIds, parseLevelId, LEVEL_TYPES, getLevelId } from "./WorldManager.js"
import { LevelDataManager } from "./LevelDataManager.js"
import { PlatformRenderer } from "./PlatformRenderer.js"
import { SupabaseMusicManager } from "./SupabaseMusicManager.js"
import { BGMManager } from "./BGMManager.js"
import { 
  REQUIRED_INSTRUMENTS, 
  NOTE_COLLECTIBLE, 
  BONUS_COLLECTIBLES, 
  DEMO_FRAGMENT,
  SPEED_RUN_STOPWATCH,
  validateLevelCollectibles, 
  countLevelCollectibles,
  getCollectibleSummary,
  canAddCollectible 
} from "./CollectibleTypes.js"

/**
 * LevelDesignerScene - Drag-and-drop level editor
 * Create and test custom levels in real-time
 * Now with persistent state and save/load functionality
 */
export class LevelDesignerScene extends Phaser.Scene {
  constructor() {
    super({ key: "LevelDesignerScene" })
  }

  init(data) {
    // Check if we're returning from test mode or loading a level
    this.returnFromTest = data?.returnFromTest || false
    this.loadLevelId = data?.loadLevelId || null
    this.loadBuiltinKey = data?.loadBuiltinKey || null
    this.editingLevelId = data?.editingLevelId || null
    this.editingBuiltinKey = data?.editingBuiltinKey || null
    // World Tour level support
    this.loadWorldTourLevel = data?.loadWorldTourLevel || null
  }

  create() {
    // Load persisted editor preferences
    this.loadEditorPreferences()
    
    // Designer state
    this.gridSize = 64
    this.mapWidth = this.editorPrefs.defaultMapWidth || 30
    this.mapHeight = this.editorPrefs.defaultMapHeight || 12
    this.selectedTool = "platform"
    this.placedObjects = []
    this.isDragging = false
    this.dragStart = { x: 0, y: 0 }
    this.currentLevelTitle = ""
    this.hasUnsavedChanges = false
    this.isTutorialLevel = false  // Initialize tutorial level flag
    
    // Speed run target times (in milliseconds)
    this.speedRunAnyTargetMs = null  // Target time for Any% speed run medal
    this.speedRun100TargetMs = null  // Target time for 100% speed run medal

    // Move tool state
    this.movingObject = null // Object currently being moved
    this.movePreview = null // Visual preview of move destination
    this.moveOffset = { x: 0, y: 0 } // Offset from object origin to click point

    // Viewport state for zoom and pan
    this.viewportX = 0  // Pan offset X (in grid pixels)
    this.viewportY = 0  // Pan offset Y (in grid pixels)
    this.zoomLevel = this.editorPrefs.defaultZoom || 1.0  // 1.0 = fit to viewport, higher = zoomed in
    this.minZoom = 0.5
    this.maxZoom = 3.0
    this.isPanning = false
    this.panStart = { x: 0, y: 0 }
    this.isSpaceHeld = false  // Spacebar for pan mode
    
    // Viewport bounds (the visible area for the grid)
    this.viewportLeft = 180
    this.viewportTop = 60
    this.viewportWidth = 720
    this.viewportHeight = 420

    // Scroll offset for large maps (legacy, kept for compatibility)
    this.scrollX = 0
    this.scrollY = 0

    // Undo/Redo stacks
    this.undoStack = []
    this.redoStack = []
    this.maxUndoStates = 50

    // Clipboard for copy/paste
    this.clipboard = null

    // Eraser hold state (E key must be held)
    this.isEraserHeld = false

    // Modifier key states for pointer tool
    this.isCommandHeld = false  // Command/Ctrl for platform placement in pointer mode
    this.isOptionHeld = false   // Option/Alt for duplicate drag
    this.isDuplicating = false  // True when duplicating an object via Option+drag

    // Lasso selection state (for pointer tool multi-select)
    this.isLassoSelecting = false  // True when dragging lasso rectangle
    this.lassoStartTile = { x: 0, y: 0 }  // Starting tile of lasso
    this.lassoRect = null  // Visual rectangle for lasso
    this.selectedObjects = []  // Array of multi-selected objects
    this.selectionHighlights = []  // Array of highlight rectangles for multi-selected objects
    this.isMovingMultiple = false  // True when moving multiple selected objects
    this.multiMoveOffset = { x: 0, y: 0 }  // Offset for multi-object move
    this.multiMovePreviews = []  // Preview rectangles for multi-object move

    // Single-instance tool types (auto-deselect after placement)
    this.singleInstanceTools = [
      "spawn", "goal", "stopwatch",
      "fragment_drums", "fragment_guitar", "fragment_bass",
      "fragment_keyboard", "fragment_microphone",
      "bonus_mixtape", "bonus_cd", "bonus_vinyl",
      "bonus_waveform", "bonus_recordDeal", "demo_fragment"
    ]
    
    // Style settings for unified level architecture
    // styleWorld: which world's palette to use for platform rendering
    // null = auto (uses destination world when published), 1-15 = specific world palette
    this.styleWorld = null
    this.stylePreset = "auto" // "auto", "minimal", or specific preset name
    
    // Preview mode: when enabled, shows platforms with actual styled rendering
    // instead of plain colored blocks (for WYSIWYG editing)
    this.previewMode = false
    
    // Music track assignment for level
    // Stores the assigned music track ID and name for the level being edited
    this.assignedTrackId = null   // Track UUID from Supabase music_tracks table
    this.assignedTrackName = null // Human-readable track name
    
    // Test mode music settings - controls which music plays during test
    // "assigned" = play the assigned track, "dev" = dev mode music, "off" = no music
    this.testMusicMode = "assigned"

    // Background contrast/brightness settings for visual clarity
    // 1.0 = normal, <1 = darker/less contrast, >1 = brighter/more contrast
    this.backgroundContrast = 1.0
    this.backgroundBrightness = 1.0
    this.useWorldBackgroundSettings = true // If true, inherit from world settings

    // Create UI
    this.createBackground()
    this.createGrid()
    this.createToolbar()
    this.createObjectPalette()
    this.createActionButtons()
    this.createStatusBar()

    // Setup input
    this.setupInput()

    // Check if we should restore previous state
    if (this.returnFromTest) {
      this.restoreFromRegistry()
      // Restart dev-mode music that was interrupted by the test scene
      BGMManager.playMenuMusic(this, "developer_menu")
    } else if (this.loadLevelId) {
      this.loadSavedLevel(this.loadLevelId)
    } else if (this.loadBuiltinKey) {
      this.loadBuiltinLevel(this.loadBuiltinKey)
    } else if (this.loadWorldTourLevel) {
      this.loadWorldTourLevelData(this.loadWorldTourLevel)
    } else {
      // Show instructions for new design
      this.showInstructions()
    }

    // Select default tool - pointer is the default for safe navigation
    this.selectTool("pointer")
  }

  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0f0f1a)
      .setOrigin(0, 0)
  }

  // ==========================================
  // Editor Preferences Persistence
  // ==========================================
  
  loadEditorPreferences() {
    const PREFS_KEY = "diminished_chord_editor_prefs"
    try {
      const data = localStorage.getItem(PREFS_KEY)
      this.editorPrefs = data ? JSON.parse(data) : {}
    } catch (e) {
      console.error("Error loading editor preferences:", e)
      this.editorPrefs = {}
    }
  }
  
  saveEditorPreferences() {
    const PREFS_KEY = "diminished_chord_editor_prefs"
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.editorPrefs))
    } catch (e) {
      console.error("Error saving editor preferences:", e)
    }
  }

  // ==========================================
  // Viewport Zoom/Pan System
  // ==========================================
  
  /**
   * Calculate the base scale that fits the map in the viewport
   */
  getBaseScale() {
    const scaleX = this.viewportWidth / (this.mapWidth * this.gridSize)
    const scaleY = this.viewportHeight / (this.mapHeight * this.gridSize)
    return Math.min(scaleX, scaleY, 0.5)
  }
  
  /**
   * Get current display scale (base scale * zoom level)
   */
  getDisplayScale() {
    return this.getBaseScale() * this.zoomLevel
  }
  
  /**
   * Zoom in/out centered on a point (or viewport center)
   */
  setZoom(newZoom, centerX = null, centerY = null) {
    const oldZoom = this.zoomLevel
    this.zoomLevel = Phaser.Math.Clamp(newZoom, this.minZoom, this.maxZoom)
    
    // If zoom changed, adjust pan to keep focus point stable
    if (centerX !== null && centerY !== null && oldZoom !== this.zoomLevel) {
      const zoomRatio = this.zoomLevel / oldZoom
      // Adjust viewport to keep the center point in the same screen position
      this.viewportX = centerX - (centerX - this.viewportX) * zoomRatio
      this.viewportY = centerY - (centerY - this.viewportY) * zoomRatio
    }
    
    // Clamp viewport to valid range
    this.clampViewport()
    
    // Update display
    this.rebuildGridViewport()
    this.updateZoomDisplay()
    
    // Save preference
    this.editorPrefs.defaultZoom = this.zoomLevel
    this.saveEditorPreferences()
  }
  
  /**
   * Pan the viewport by delta amounts (in screen pixels)
   * Positive deltaX (drag right) = content moves right with cursor = viewportX decreases
   * Negative deltaX (drag left) = content moves left with cursor = viewportX increases
   */
  panViewport(deltaX, deltaY) {
    const scale = this.getDisplayScale()
    // Convert screen pixels to grid pixels
    // Subtract delta so dragging right moves content right (natural "grab" behavior)
    this.viewportX -= deltaX / scale
    this.viewportY -= deltaY / scale
    this.clampViewport()
    this.rebuildGridViewport()
  }
  
  /**
   * Pan the viewport by tile amounts (for arrow key navigation)
   * @param {number} tilesX - Number of tiles to pan horizontally (positive = right)
   * @param {number} tilesY - Number of tiles to pan vertically (positive = down)
   */
  panViewportByTiles(tilesX, tilesY) {
    // Pan by grid units (each tile is gridSize pixels)
    this.viewportX += tilesX * this.gridSize
    this.viewportY += tilesY * this.gridSize
    this.clampViewport()
    this.rebuildGridViewport()
  }
  
  /**
   * Clamp viewport to valid range (can't pan past edges)
   */
  clampViewport() {
    const scale = this.getDisplayScale()
    const visibleGridWidth = this.viewportWidth / scale
    const visibleGridHeight = this.viewportHeight / scale
    const totalGridWidth = this.mapWidth * this.gridSize
    const totalGridHeight = this.mapHeight * this.gridSize
    
    // If zoomed out enough to see everything, center it
    if (visibleGridWidth >= totalGridWidth) {
      this.viewportX = (totalGridWidth - visibleGridWidth) / 2
    } else {
      this.viewportX = Phaser.Math.Clamp(this.viewportX, 0, totalGridWidth - visibleGridWidth)
    }
    
    if (visibleGridHeight >= totalGridHeight) {
      this.viewportY = (totalGridHeight - visibleGridHeight) / 2
    } else {
      this.viewportY = Phaser.Math.Clamp(this.viewportY, 0, totalGridHeight - visibleGridHeight)
    }
  }
  
  /**
   * Reset zoom to fit map in viewport
   */
  resetZoom() {
    this.zoomLevel = 1.0
    this.viewportX = 0
    this.viewportY = 0
    this.rebuildGridViewport()
    this.updateZoomDisplay()
  }

  createGrid() {
    // Create viewport mask to clip the grid area
    this.createViewportMask()
    
    // Calculate display scale
    this.currentDisplayScale = this.getDisplayScale()
    const displayScale = this.currentDisplayScale

    // Grid master container (will be masked)
    this.gridMasterContainer = this.add.container(this.viewportLeft, this.viewportTop)
    this.gridMasterContainer.setMask(this.viewportMask)

    // Grid background - full grid size
    const gridBg = this.add.rectangle(0, 0, this.mapWidth * this.gridSize * displayScale, this.mapHeight * this.gridSize * displayScale, 0x1a1a2e)
      .setOrigin(0, 0)
    this.gridMasterContainer.add(gridBg)

    // Grid lines container
    this.gridLinesGraphics = this.add.graphics()
    this.gridMasterContainer.add(this.gridLinesGraphics)
    this.drawGridLines()

    // Objects container (for placed items)
    this.objectsContainer = this.add.container(0, 0)
    this.gridMasterContainer.add(this.objectsContainer)

    // Apply initial viewport offset
    this.applyViewportTransform()

    // Interactive zone for the viewport area (not the grid itself)
    this.gridZone = this.add.zone(this.viewportLeft, this.viewportTop, this.viewportWidth, this.viewportHeight)
      .setOrigin(0, 0)
      .setInteractive()

    this.gridZone.on("pointerdown", (pointer) => this.onGridClick(pointer))
    this.gridZone.on("pointermove", (pointer) => this.onGridMove(pointer))
    this.gridZone.on("pointerup", () => this.onGridRelease())
    
    // Mouse wheel zoom and pan on viewport
    this.gridZone.on("wheel", (pointer, dx, dy, dz) => {
      // Check if Ctrl/Cmd is held for zoom, otherwise pan
      if (pointer.event.ctrlKey || pointer.event.metaKey) {
        // Zoom centered on mouse position
        const zoomDelta = dy > 0 ? -0.1 : 0.1
        const mouseGridX = this.screenToGridX(pointer.x)
        const mouseGridY = this.screenToGridY(pointer.y)
        this.setZoom(this.zoomLevel + zoomDelta, mouseGridX, mouseGridY)
      } else {
        // Pan viewport with scroll wheel/trackpad
        // Adding the delta (not subtracting) matches standard non-natural-scroll direction:
        // scroll right → see content to the right (viewportX increases)
        // scroll down  → see content below      (viewportY increases)
        const scale = this.getDisplayScale()
        this.viewportX += dx / scale
        this.viewportY += dy / scale
        this.clampViewport()
        this.rebuildGridViewport()
      }
    })

    // Right-click context menu
    this.input.on("pointerdown", (pointer) => {
      if (pointer.rightButtonDown()) {
        this.showContextMenu(pointer)
      }
    })
    
    // Disable default browser context menu on game canvas
    this.game.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault()
    })
    
    // Draw viewport border
    this.viewportBorder = this.add.rectangle(
      this.viewportLeft, this.viewportTop, 
      this.viewportWidth, this.viewportHeight,
      0x000000, 0
    ).setOrigin(0, 0).setStrokeStyle(2, 0x444466)
  }
  
  /**
   * Create the mask for the viewport area
   */
  createViewportMask() {
    const maskGraphics = this.make.graphics()
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(this.viewportLeft, this.viewportTop, this.viewportWidth, this.viewportHeight)
    this.viewportMask = maskGraphics.createGeometryMask()
  }
  
  /**
   * Draw grid lines based on current zoom and pan
   */
  drawGridLines() {
    if (!this.gridLinesGraphics) return
    
    this.gridLinesGraphics.clear()
    const displayScale = this.getDisplayScale()
    
    this.gridLinesGraphics.lineStyle(1, 0x333355, 0.5)
    
    // Draw vertical lines
    for (let x = 0; x <= this.mapWidth; x++) {
      this.gridLinesGraphics.beginPath()
      this.gridLinesGraphics.moveTo(x * this.gridSize * displayScale, 0)
      this.gridLinesGraphics.lineTo(x * this.gridSize * displayScale, this.mapHeight * this.gridSize * displayScale)
      this.gridLinesGraphics.strokePath()
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= this.mapHeight; y++) {
      this.gridLinesGraphics.beginPath()
      this.gridLinesGraphics.moveTo(0, y * this.gridSize * displayScale)
      this.gridLinesGraphics.lineTo(this.mapWidth * this.gridSize * displayScale, y * this.gridSize * displayScale)
      this.gridLinesGraphics.strokePath()
    }
  }
  
  /**
   * Apply viewport transform (pan offset) to grid container
   */
  applyViewportTransform() {
    if (!this.gridMasterContainer) return
    const displayScale = this.getDisplayScale()
    this.gridMasterContainer.x = this.viewportLeft - this.viewportX * displayScale
    this.gridMasterContainer.y = this.viewportTop - this.viewportY * displayScale
  }
  
  /**
   * Convert screen X to grid X coordinate
   */
  screenToGridX(screenX) {
    const displayScale = this.getDisplayScale()
    return (screenX - this.viewportLeft) / displayScale + this.viewportX
  }
  
  /**
   * Convert screen Y to grid Y coordinate
   */
  screenToGridY(screenY) {
    const displayScale = this.getDisplayScale()
    return (screenY - this.viewportTop) / displayScale + this.viewportY
  }
  
  /**
   * Convert screen position to grid tile coordinates
   */
  screenToTile(screenX, screenY) {
    const gridX = this.screenToGridX(screenX)
    const gridY = this.screenToGridY(screenY)
    return {
      x: Math.floor(gridX / this.gridSize),
      y: Math.floor(gridY / this.gridSize)
    }
  }
  
  /**
   * Rebuild grid viewport after zoom/pan/resize changes
   */
  rebuildGridViewport() {
    this.currentDisplayScale = this.getDisplayScale()
    const displayScale = this.currentDisplayScale
    
    // Update grid background size
    if (this.gridMasterContainer && this.gridMasterContainer.list[0]) {
      const gridBg = this.gridMasterContainer.list[0]
      gridBg.setSize(this.mapWidth * this.gridSize * displayScale, this.mapHeight * this.gridSize * displayScale)
    }
    
    // Redraw grid lines
    this.drawGridLines()
    
    // Store references to selected objects before rebuild
    const selectedObjectRefs = this.selectedObjects.map(obj => ({
      type: obj.type, x: obj.x, y: obj.y, width: obj.width, height: obj.height
    }))
    const singleSelectedRef = this.selectedObject ? {
      type: this.selectedObject.type, x: this.selectedObject.x, y: this.selectedObject.y,
      width: this.selectedObject.width, height: this.selectedObject.height
    } : null
    
    // Clear selection highlights before rebuilding (they'll be in objectsContainer)
    this.selectionHighlights = []
    this.selectionHighlight = null
    
    // Re-render all objects at new scale
    if (this.objectsContainer) {
      // Clear and rebuild objects
      this.objectsContainer.removeAll(true)
      const existingObjects = [...this.placedObjects]
      this.placedObjects = []
      existingObjects.forEach(obj => {
        this.placeObjectFromData(obj)
      })
    }
    
    // Restore multi-selection after rebuild
    if (selectedObjectRefs.length > 0) {
      const restoredObjects = selectedObjectRefs.map(ref => 
        this.placedObjects.find(obj => 
          obj.type === ref.type && obj.x === ref.x && obj.y === ref.y && 
          obj.width === ref.width && obj.height === ref.height
        )
      ).filter(Boolean)
      
      if (restoredObjects.length > 0) {
        this.selectMultipleObjects(restoredObjects)
      }
    }
    // Restore single selection after rebuild
    else if (singleSelectedRef) {
      const restoredObj = this.placedObjects.find(obj => 
        obj.type === singleSelectedRef.type && obj.x === singleSelectedRef.x && 
        obj.y === singleSelectedRef.y && obj.width === singleSelectedRef.width && 
        obj.height === singleSelectedRef.height
      )
      if (restoredObj) {
        this.selectedObject = restoredObj
        const x = restoredObj.x * this.gridSize * displayScale + (restoredObj.width * this.gridSize * displayScale) / 2
        const y = restoredObj.y * this.gridSize * displayScale + (restoredObj.height * this.gridSize * displayScale) / 2
        
        this.selectionHighlight = this.add.rectangle(
          x, y,
          restoredObj.width * this.gridSize * displayScale + 4,
          restoredObj.height * this.gridSize * displayScale + 4,
          0xffffff, 0
        ).setStrokeStyle(2, 0xffffff)
        this.objectsContainer.add(this.selectionHighlight)
      }
    }
    
    // Apply viewport transform
    this.applyViewportTransform()
  }

  createToolbar() {
    // Toolbar panel - Two rows for better organization
    const toolbarRow1Y = 18
    const toolbarRow2Y = 42
    
    // Main toolbar background (spans both rows)
    this.add.rectangle(this.cameras.main.width / 2, 30, this.cameras.main.width - 200, 50, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x444466)

    // Row 1: Title and level name
    this.add.text(110, toolbarRow1Y, "LEVEL DESIGNER", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ff88"
    }).setOrigin(0, 0.5)

    // Level title display - to the right of LEVEL DESIGNER
    this.titleDisplay = this.add.text(260, toolbarRow1Y, "", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ff69b4"
    }).setOrigin(0, 0.5)

    // Row 2: Map size, resize, and zoom controls
    // Map size display
    this.mapSizeText = this.add.text(110, toolbarRow2Y, `Map: ${this.mapWidth}x${this.mapHeight}`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    }).setOrigin(0, 0.5)

    // Resize button
    const resizeBtn = this.add.text(220, toolbarRow2Y, "[RESIZE]", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#00ffff"
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })

    resizeBtn.on("pointerover", () => resizeBtn.setColor("#ffffff"))
    resizeBtn.on("pointerout", () => resizeBtn.setColor("#00ffff"))
    resizeBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.showResizeDialog()
    })
    
    // Zoom controls on row 2
    this.createZoomControls(toolbarRow2Y)
  }
  
  /**
   * Create zoom control UI elements
   */
  createZoomControls(toolbarY) {
    const zoomX = 320
    
    // Zoom label
    this.add.text(zoomX, toolbarY, "Zoom:", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0, 0.5)
    
    // Zoom out button
    const zoomOutBtn = this.add.text(zoomX + 50, toolbarY, "[-]", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffaa00"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    zoomOutBtn.on("pointerover", () => zoomOutBtn.setColor("#ffffff"))
    zoomOutBtn.on("pointerout", () => zoomOutBtn.setColor("#ffaa00"))
    zoomOutBtn.on("pointerdown", () => {
      this.setZoom(this.zoomLevel - 0.25)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    
    // Zoom display
    this.zoomText = this.add.text(zoomX + 90, toolbarY, `${Math.round(this.zoomLevel * 100)}%`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffaa00"
    }).setOrigin(0.5)
    
    // Zoom in button
    const zoomInBtn = this.add.text(zoomX + 130, toolbarY, "[+]", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffaa00"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    zoomInBtn.on("pointerover", () => zoomInBtn.setColor("#ffffff"))
    zoomInBtn.on("pointerout", () => zoomInBtn.setColor("#ffaa00"))
    zoomInBtn.on("pointerdown", () => {
      this.setZoom(this.zoomLevel + 0.25)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    
    // Reset zoom button
    const resetZoomBtn = this.add.text(zoomX + 165, toolbarY, "[FIT]", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#888888"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    resetZoomBtn.on("pointerover", () => resetZoomBtn.setColor("#ffffff"))
    resetZoomBtn.on("pointerout", () => resetZoomBtn.setColor("#888888"))
    resetZoomBtn.on("pointerdown", () => {
      this.resetZoom()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    
    // Preview mode toggle - shows styled platforms instead of colored blocks
    const previewX = zoomX + 230
    this.previewToggleText = this.add.text(previewX, toolbarY, "[PREVIEW: OFF]", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
    
    this.previewToggleText.on("pointerover", () => this.previewToggleText.setColor("#ffffff"))
    this.previewToggleText.on("pointerout", () => this.previewToggleText.setColor(this.previewMode ? "#00ff88" : "#666666"))
    this.previewToggleText.on("pointerdown", () => {
      this.togglePreviewMode()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
  }
  
  /**
   * Toggle preview mode (shows styled platforms vs colored blocks)
   */
  togglePreviewMode() {
    this.previewMode = !this.previewMode
    
    // Update toggle button appearance
    if (this.previewToggleText) {
      this.previewToggleText.setText(this.previewMode ? "[PREVIEW: ON]" : "[PREVIEW: OFF]")
      this.previewToggleText.setColor(this.previewMode ? "#00ff88" : "#666666")
    }
    
    // Rebuild the grid to show/hide styled platforms
    this.rebuildGridViewport()
    
    // Show status message
    this.statusText.setText(this.previewMode ? 
      "PREVIEW MODE: Showing styled platforms" : 
      "EDIT MODE: Showing block outlines"
    )
  }
  
  /**
   * Update zoom percentage display
   */
  updateZoomDisplay() {
    if (this.zoomText) {
      this.zoomText.setText(`${Math.round(this.zoomLevel * 100)}%`)
    }
  }

  showResizeDialog() {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 400, 280, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0x00ffff)

    const titleText = this.add.text(0, -110, "RESIZE MAP", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ffff"
    }).setOrigin(0.5)

    const currentText = this.add.text(0, -70, `Current: ${this.mapWidth} x ${this.mapHeight}`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5)

    // Width controls
    this.add.text(-80, -30, "Width:", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(1, 0.5)

    let newWidth = this.mapWidth
    const widthText = this.add.text(0, -30, `${newWidth}`, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ff88"
    }).setOrigin(0.5)

    const widthMinus = this.add.text(-50, -30, "◄", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff6666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    const widthPlus = this.add.text(50, -30, "►", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#66ff66"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    widthMinus.on("pointerdown", () => {
      newWidth = Math.max(10, newWidth - 5)
      widthText.setText(`${newWidth}`)
    })
    widthPlus.on("pointerdown", () => {
      newWidth = Math.min(100, newWidth + 5)
      widthText.setText(`${newWidth}`)
    })

    // Height controls
    this.add.text(-80, 20, "Height:", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(1, 0.5)

    let newHeight = this.mapHeight
    const heightText = this.add.text(0, 20, `${newHeight}`, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ff88"
    }).setOrigin(0.5)

    const heightMinus = this.add.text(-50, 20, "◄", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff6666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    const heightPlus = this.add.text(50, 20, "►", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#66ff66"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    heightMinus.on("pointerdown", () => {
      newHeight = Math.max(8, newHeight - 2)
      heightText.setText(`${newHeight}`)
    })
    heightPlus.on("pointerdown", () => {
      newHeight = Math.min(50, newHeight + 2)
      heightText.setText(`${newHeight}`)
    })

    // Info text
    const infoText = this.add.text(0, 60, "Note: Objects outside new bounds\nwill be removed", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ff6666",
      align: "center"
    }).setOrigin(0.5)

    // Buttons
    const applyBtn = this.add.rectangle(-70, 100, 100, 35, 0x00ffff, 0.8)
      .setStrokeStyle(2, 0x44ffff)
      .setInteractive({ useHandCursor: true })
    const applyText = this.add.text(-70, 100, "APPLY", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#000000"
    }).setOrigin(0.5)

    const cancelBtn = this.add.rectangle(70, 100, 100, 35, 0x444444, 0.8)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(70, 100, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    dialog.add([bg, titleText, currentText, widthText, widthMinus, widthPlus,
      heightText, heightMinus, heightPlus, infoText, applyBtn, applyText, cancelBtn, cancelText])

    // Add labels to dialog
    dialog.add(this.add.text(-80, -30, "Width:", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(1, 0.5))
    dialog.add(this.add.text(-80, 20, "Height:", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(1, 0.5))

    applyBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.resizeMap(newWidth, newHeight)
      dialog.destroy()
    })

    cancelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
    })
  }

  resizeMap(newWidth, newHeight) {
    // Remove objects that would be outside new bounds
    const toRemove = this.placedObjects.filter(obj => {
      return obj.x >= newWidth || obj.y >= newHeight ||
             obj.x + obj.width > newWidth || obj.y + obj.height > newHeight
    })

    toRemove.forEach(obj => {
      obj.visual.destroy()
      const index = this.placedObjects.indexOf(obj)
      if (index > -1) {
        this.placedObjects.splice(index, 1)
      }
    })

    // Update map dimensions
    this.mapWidth = newWidth
    this.mapHeight = newHeight
    
    // Save as default for future sessions
    this.editorPrefs.defaultMapWidth = newWidth
    this.editorPrefs.defaultMapHeight = newHeight
    this.saveEditorPreferences()

    // Mark as unsaved
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()

    // Reset viewport and rebuild the grid
    this.viewportX = 0
    this.viewportY = 0
    this.rebuildGrid()

    // Update display
    this.mapSizeText.setText(`Map: ${this.mapWidth}x${this.mapHeight}`)
    this.objectCountText.setText(`Objects: ${this.placedObjects.length}`)
    this.statusText.setText(`Resized to ${newWidth}x${newHeight} - Scroll to pan, +/- to zoom`)
    this.time.delayedCall(3000, () => {
      if (this.selectedTool === "pointer") {
        this.statusText.setText("POINTER - Click to select, Cmd+drag for platform, Opt+drag to duplicate")
      } else {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      }
    })
  }

  rebuildGrid() {
    // Destroy old grid elements
    if (this.gridMasterContainer) this.gridMasterContainer.destroy()
    if (this.gridZone) this.gridZone.destroy()
    if (this.viewportBorder) this.viewportBorder.destroy()
    
    // Recreate viewport mask
    this.createViewportMask()
    
    // Calculate display scale
    this.currentDisplayScale = this.getDisplayScale()
    const displayScale = this.currentDisplayScale

    // Grid master container (will be masked)
    this.gridMasterContainer = this.add.container(this.viewportLeft, this.viewportTop)
    this.gridMasterContainer.setMask(this.viewportMask)

    // Grid background - full grid size
    const gridBg = this.add.rectangle(0, 0, this.mapWidth * this.gridSize * displayScale, this.mapHeight * this.gridSize * displayScale, 0x1a1a2e)
      .setOrigin(0, 0)
    this.gridMasterContainer.add(gridBg)

    // Grid lines container
    this.gridLinesGraphics = this.add.graphics()
    this.gridMasterContainer.add(this.gridLinesGraphics)
    this.drawGridLines()

    // Objects container (for placed items)
    this.objectsContainer = this.add.container(0, 0)
    this.gridMasterContainer.add(this.objectsContainer)
    
    // Re-render existing objects with new scale
    const existingObjects = [...this.placedObjects]
    this.placedObjects = []
    existingObjects.forEach(obj => {
      this.placeObjectFromData(obj)
    })

    // Apply viewport offset
    this.clampViewport()
    this.applyViewportTransform()

    // Interactive zone for the viewport area
    this.gridZone = this.add.zone(this.viewportLeft, this.viewportTop, this.viewportWidth, this.viewportHeight)
      .setOrigin(0, 0)
      .setInteractive()

    this.gridZone.on("pointerdown", (pointer) => this.onGridClick(pointer))
    this.gridZone.on("pointermove", (pointer) => this.onGridMove(pointer))
    this.gridZone.on("pointerup", () => this.onGridRelease())
    
    // Mouse wheel/trackpad scroll for panning (not zooming)
    // Negate deltas so scroll direction matches standard (non-natural-scroll) trackpad behaviour:
    // scroll right → see content to the right, scroll down → see content below
    this.gridZone.on("wheel", (pointer, dx, dy, dz) => {
      const panSpeed = 1.5
      this.panViewport(-dx * panSpeed, -dy * panSpeed)
    })
    
    // Viewport border
    this.viewportBorder = this.add.rectangle(
      this.viewportLeft, this.viewportTop, 
      this.viewportWidth, this.viewportHeight,
      0x000000, 0
    ).setOrigin(0, 0).setStrokeStyle(2, 0x444466)
    
    // Update zoom display
    this.updateZoomDisplay()
  }

  createObjectPalette() {
    // Left panel - Object palette with scrolling support
    const paletteX = 90
    const paletteY = 360
    const panelHeight = 620
    const visibleHeight = panelHeight - 40  // Account for header

    // Panel background
    this.paletteBg = this.add.rectangle(paletteX, paletteY, 160, panelHeight, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x444466)
      .setDepth(99)

    this.add.text(paletteX, paletteY - panelHeight / 2 + 15, "TOOLS", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#00ffff"
    }).setOrigin(0.5).setDepth(99)

    // Create a mask for scrolling content
    const maskGraphics = this.make.graphics()
    maskGraphics.fillRect(paletteX - 80, paletteY - panelHeight / 2 + 35, 160, visibleHeight)
    const mask = maskGraphics.createGeometryMask()

    // Scrollable container for tool buttons
    this.paletteContainer = this.add.container(paletteX, paletteY - panelHeight / 2 + 50)
    this.paletteContainer.setMask(mask)
    this.paletteContainer.setDepth(100) // Ensure palette is above grid
    
    // Store palette bounds for input checking
    this.paletteBounds = {
      x: paletteX - 80,
      y: paletteY - panelHeight / 2 + 35,
      width: 160,
      height: visibleHeight
    }
    
    // Track scroll position
    this.paletteScrollY = 0
    this.paletteContentHeight = 0

    // Tool buttons organized by category
    this.tools = []
    let currentY = 0
    
    // === POINTER & ERASER (selection/utility tools) ===
    const pointerLabel = this.add.text(0, currentY, "— Select —", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5)
    this.paletteContainer.add(pointerLabel)
    currentY += 14
    
    const pointerBtn = this.createToolButtonInContainer(0, currentY, "pointer", "Pointer [F]", 0xffffff)
    this.tools.push(pointerBtn)
    currentY += 22
    
    const eraserBtn = this.createToolButtonInContainer(0, currentY, "eraser", "Eraser [E]", 0xff6666)
    this.tools.push(eraserBtn)
    currentY += 22
    
    // === TERRAIN ===
    currentY += 6
    const terrainLabel = this.add.text(0, currentY, "— Terrain —", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5)
    this.paletteContainer.add(terrainLabel)
    currentY += 14
    
    // Define terrain tools including new Cables type
    this.terrainTools = [
      { key: "platform", label: "Platform [P]", color: 0x4a90d9 },
      { key: "spike", label: "Spike [T]", color: 0xff4444 },
      { key: "saw", label: "Saw Static", color: 0xff8800 },
      { key: "saw_h", label: "Saw Horiz", color: 0xff6600 },
      { key: "saw_v", label: "Saw Vert", color: 0xff4400 },
      { key: "saw_c", label: "Saw Circle", color: 0xff2200 },
      { key: "cables", label: "Cables", color: 0x8844aa }
    ]
    this.terrainTools.forEach(tool => {
      const btn = this.createToolButtonInContainer(0, currentY, tool.key, tool.label, tool.color)
      this.tools.push(btn)
      currentY += 22
    })
    
    // === REQUIRED INSTRUMENTS (1 each) ===
    currentY += 6
    const instLabel = this.add.text(0, currentY, "— Instruments —", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5)
    this.paletteContainer.add(instLabel)
    currentY += 14
    
    // Instrument tools with hotkeys
    this.instrumentTools = [
      { key: "fragment_drums", label: "Drums [D]", color: REQUIRED_INSTRUMENTS.drums.color },
      { key: "fragment_guitar", label: "Guitar [G]", color: REQUIRED_INSTRUMENTS.guitar.color },
      { key: "fragment_bass", label: "Bass [B]", color: REQUIRED_INSTRUMENTS.bass.color },
      { key: "fragment_keyboard", label: "Keyboard [K]", color: REQUIRED_INSTRUMENTS.keyboard.color },
      { key: "fragment_microphone", label: "Mic [M]", color: REQUIRED_INSTRUMENTS.microphone.color }
    ]
    this.instrumentTools.forEach(tool => {
      const btn = this.createToolButtonInContainer(0, currentY, tool.key, tool.label, tool.color)
      this.tools.push(btn)
      currentY += 22
    })
    
    // === NOTES (0-45) ===
    currentY += 6
    const noteLabel = this.add.text(0, currentY, "— Notes (0-45) —", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5)
    this.paletteContainer.add(noteLabel)
    currentY += 14
    
    const noteBtn = this.createToolButtonInContainer(0, currentY, "fragment_note", "Note [N]", NOTE_COLLECTIBLE.color)
    this.tools.push(noteBtn)
    currentY += 22
    
    // === SPECIAL (Bonus/Demo) ===
    currentY += 6
    const specialLabel = this.add.text(0, currentY, "— Special [S] —", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5)
    this.paletteContainer.add(specialLabel)
    currentY += 14
    
    this.specialTools = [
      { key: "bonus_mixtape", label: "Mixtape", color: BONUS_COLLECTIBLES.mixtape.color },
      { key: "bonus_cd", label: "CD", color: BONUS_COLLECTIBLES.cd.color },
      { key: "bonus_vinyl", label: "Vinyl", color: BONUS_COLLECTIBLES.vinyl.color },
      { key: "bonus_waveform", label: "Waveform", color: BONUS_COLLECTIBLES.waveform.color },
      { key: "bonus_recordDeal", label: "Record Deal", color: BONUS_COLLECTIBLES.recordDeal.color },
      { key: "demo_fragment", label: "Demo Tape", color: DEMO_FRAGMENT.color },
      { key: "stopwatch", label: "⏱ Stopwatch", color: SPEED_RUN_STOPWATCH.color }
    ]
    this.specialTools.forEach(tool => {
      const btn = this.createToolButtonInContainer(0, currentY, tool.key, tool.label, tool.color)
      this.tools.push(btn)
      currentY += 22
    })
    
    // === LEVEL MARKERS ===
    currentY += 6
    const markerLabel = this.add.text(0, currentY, "— Markers —", {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#666666"
    }).setOrigin(0.5)
    this.paletteContainer.add(markerLabel)
    currentY += 14
    
    const markerTools = [
      { key: "spawn", label: "Spawn [1]", color: 0x00ff88 },
      { key: "goal", label: "Goal [2]", color: 0xffff00 }
    ]
    markerTools.forEach(tool => {
      const btn = this.createToolButtonInContainer(0, currentY, tool.key, tool.label, tool.color)
      this.tools.push(btn)
      currentY += 22
    })

    // Track total content height for scrolling
    this.paletteContentHeight = currentY
    
    // Mouse wheel scrolling on the palette area - use scene-level input instead of blocking zone
    this.input.on("wheel", (pointer, gameObjects, dx, dy, dz) => {
      // Check if pointer is over the palette area
      if (pointer.x >= paletteX - 80 && pointer.x <= paletteX + 80 &&
          pointer.y >= paletteY - panelHeight / 2 && pointer.y <= paletteY + panelHeight / 2) {
        this.scrollPalette(dy > 0 ? 30 : -30)
      }
    })
    
    // Store palette info for the scene-level click handler (set up in setupInput)
    this.paletteInfo = {
      x: paletteX,
      panelHeight: panelHeight
    }

    // Scroll indicators
    this.scrollUpIndicator = this.add.text(paletteX, paletteY - panelHeight / 2 + 38, "▲", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#444466"
    }).setOrigin(0.5).setAlpha(0.5)
    
    this.scrollDownIndicator = this.add.text(paletteX, paletteY + panelHeight / 2 - 8, "▼", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ffff"
    }).setOrigin(0.5)
    
    // Update scroll indicators
    this.updateScrollIndicators()
  }

  /**
   * Create a tool button inside the scrollable container
   */
  createToolButtonInContainer(x, y, key, label, color) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 140, 20, 0x222244, 0.8)
      .setStrokeStyle(1, color)

    const colorBox = this.add.rectangle(-58, 0, 12, 12, color)

    const text = this.add.text(-46, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#ffffff"
    }).setOrigin(0, 0.5)

    container.add([bg, colorBox, text])
    this.paletteContainer.add(container)

    // Make the entire container interactive with a larger hit area
    container.setSize(140, 20)
    container.setInteractive(new Phaser.Geom.Rectangle(-70, -10, 140, 20), Phaser.Geom.Rectangle.Contains, { useHandCursor: true })
    container.on("pointerdown", () => {
      this.selectTool(key)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    container.on("pointerover", () => {
      bg.setFillStyle(0x333366)
    })
    container.on("pointerout", () => {
      bg.setFillStyle(0x222244, 0.8)
    })

    container.bg = bg
    container.key = key
    container.color = color

    return container
  }

  /**
   * Scroll the palette by a given amount
   */
  scrollPalette(amount) {
    const maxScroll = Math.max(0, this.paletteContentHeight - 560)
    this.paletteScrollY = Phaser.Math.Clamp(this.paletteScrollY + amount, 0, maxScroll)
    this.paletteContainer.y = (360 - 310 + 40) - this.paletteScrollY
    this.updateScrollIndicators()
  }

  /**
   * Update scroll indicator visibility
   */
  updateScrollIndicators() {
    if (!this.scrollUpIndicator || !this.scrollDownIndicator) return
    
    const maxScroll = Math.max(0, this.paletteContentHeight - 560)
    
    // Show up arrow if scrolled down
    this.scrollUpIndicator.setAlpha(this.paletteScrollY > 0 ? 1 : 0.3)
    this.scrollUpIndicator.setColor(this.paletteScrollY > 0 ? "#00ffff" : "#444466")
    
    // Show down arrow if more content below
    this.scrollDownIndicator.setAlpha(this.paletteScrollY < maxScroll ? 1 : 0.3)
    this.scrollDownIndicator.setColor(this.paletteScrollY < maxScroll ? "#00ffff" : "#444466")
  }

  // Note: createToolButton kept for backwards compatibility with action buttons
  createToolButton(x, y, key, label, color) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 140, 30, 0x222244, 0.8)
      .setStrokeStyle(1, color)

    const colorBox = this.add.rectangle(-55, 0, 20, 20, color)

    const text = this.add.text(-35, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffffff"
    }).setOrigin(0, 0.5)

    container.add([bg, colorBox, text])

    bg.setInteractive({ useHandCursor: true })
    bg.on("pointerdown", () => {
      this.selectTool(key)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    container.bg = bg
    container.key = key
    container.color = color

    return container
  }

  selectTool(key) {
    // Cancel any ongoing move operation when switching tools
    if (this.movingObject) {
      this.cancelMoveOperation()
    }
    
    this.selectedTool = key
    
    // Update tool button visuals
    this.tools.forEach(tool => {
      if (tool.key === key) {
        tool.bg.setStrokeStyle(3, 0xffffff)
        tool.setScale(1.05)
      } else {
        tool.bg.setStrokeStyle(1, tool.color)
        tool.setScale(1)
      }
    })

    // Update status with tool-specific messages
    if (key === "pointer") {
      this.statusText.setText("POINTER: Click select | Cmd+drag platform | Opt+drag duplicate")
      this.game.canvas.style.cursor = "default"
    } else if (key === "eraser") {
      this.statusText.setText("ERASER: Click or drag to delete")
      this.game.canvas.style.cursor = "crosshair"
    } else if (key === "platform") {
      this.statusText.setText("PLATFORM: Click+drag to draw")
      this.game.canvas.style.cursor = "default"
    } else if (key.startsWith("saw")) {
      this.statusText.setText(`${key.toUpperCase()}: Click+drag to place`)
      this.game.canvas.style.cursor = "default"
    } else if (key.startsWith("fragment_") || key.startsWith("bonus_") || key === "demo_fragment") {
      this.statusText.setText(`${key.replace('fragment_', '').replace('bonus_', '').toUpperCase()}: Click to place (1 per level)`)
      this.game.canvas.style.cursor = "default"
    } else if (key === "stopwatch") {
      this.statusText.setText("METRONOME: Click to place - Timer starts when collected (1 per level)")
      this.game.canvas.style.cursor = "default"
    } else if (key === "spawn") {
      this.statusText.setText("SPAWN: Click to place, then choose facing direction (←/→)")
      this.game.canvas.style.cursor = "default"
    } else {
      this.statusText.setText(`${key.toUpperCase()}: Click to place`)
      this.game.canvas.style.cursor = "default"
    }
  }

  createActionButtons() {
    // Right panel - Actions
    const panelX = this.cameras.main.width - 90
    const panelY = 300

    this.add.rectangle(panelX, panelY, 160, 440, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x444466)

    this.add.text(panelX, panelY - 200, "ACTIONS", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    const actions = [
      { label: "TEST LEVEL", color: 0x00ff88, callback: () => this.testLevel() },
      { label: "⚡ SPRINT MODE", color: 0xff00ff, callback: () => this.enterSprintMode() },
      { label: "LEVEL SETTINGS", color: 0xffcc00, callback: () => this.showLevelSettingsDialog() },
      { label: "PUBLISH", color: 0x00ffff, callback: () => this.showSaveDialog() },
      { label: "EXPORT CSV", color: 0xff00ff, callback: () => this.showExportDialog() },
      { label: "LOAD LEVEL", color: 0xffaa00, callback: () => this.scene.start("LevelBrowserScene") },
      { label: "WORLD LEVELS", color: 0xff69b4, callback: () => this.showWorldLevelPicker() },
      { label: "CLEAR ALL", color: 0xff4444, callback: () => this.confirmClearLevel() },
      { label: "NEW LEVEL", color: 0xaaaaaa, callback: () => this.confirmNewLevel() },
      { label: "BACK", color: 0x666666, callback: () => this.goBack() }
    ]

    // Initialize action buttons array for controller navigation
    this.actionButtons = []

    actions.forEach((action, index) => {
      const y = panelY - 175 + index * 36
      const btn = this.createActionButton(panelX, y, action.label, action.color, action.callback)
      this.actionButtons.push(btn)
    })
  }

  createActionButton(x, y, label, color, callback) {
    const bg = this.add.rectangle(x, y, 130, 32, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, color)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(x, y, label, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba
    }).setOrigin(0.5)

    bg.on("pointerover", () => {
      bg.setStrokeStyle(3, 0xffffff)
      text.setColor("#ffffff")
    })
    bg.on("pointerout", () => {
      bg.setStrokeStyle(2, color)
      text.setColor(Phaser.Display.Color.IntegerToColor(color).rgba)
    })
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      callback()
    })
    
    // Return button reference for controller navigation
    return { bg, text, color, callback, label }
  }

  createStatusBar() {
    // Tooltip bar beneath viewport (shows tool tips and controls)
    const tooltipY = this.viewportTop + this.viewportHeight + 18
    
    this.add.rectangle(this.viewportLeft + this.viewportWidth / 2, tooltipY, this.viewportWidth, 24, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x333355)

    this.statusText = this.add.text(this.viewportLeft + 10, tooltipY, "POINTER - Click to select, Cmd+drag for platform", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#00ff88"
    }).setOrigin(0, 0.5)

    this.coordsText = this.add.text(this.viewportLeft + this.viewportWidth - 10, tooltipY, "Grid: 0, 0", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#888888"
    }).setOrigin(1, 0.5)

    // Bottom status bar (object count and save status)
    const statusY = this.cameras.main.height - 20

    this.add.rectangle(this.cameras.main.width / 2, statusY, this.cameras.main.width - 20, 28, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x333355)

    this.objectCountText = this.add.text(this.cameras.main.width / 2 - 80, statusY, `Objects: ${this.placedObjects.length}`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffaa00"
    }).setOrigin(0.5)

    // Unsaved changes indicator
    this.unsavedIndicator = this.add.text(this.cameras.main.width / 2 + 80, statusY, "", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ff4444"
    }).setOrigin(0.5)
  }

  updateTitleDisplay() {
    if (this.currentLevelTitle) {
      let displayText = `Editing: "${this.currentLevelTitle}"`
      if (this.editingBuiltinKey) {
        const metadata = LEVEL_METADATA[this.editingBuiltinKey]
        displayText = `Editing: ${metadata?.name || this.editingBuiltinKey}`
      }
      this.titleDisplay.setText(displayText)
    } else {
      this.titleDisplay.setText("New Level")
    }
  }

  updateUnsavedIndicator() {
    if (this.hasUnsavedChanges) {
      this.unsavedIndicator.setText("* Unsaved")
    } else {
      this.unsavedIndicator.setText("")
    }
  }

  showInstructions() {
    const instructionBox = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    
    const bg = this.add.rectangle(0, 0, 450, 280, 0x0a0a1a, 0.95)
      .setStrokeStyle(2, 0x00ff88)
    
    const title = this.add.text(0, -110, "LEVEL DESIGNER", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ff88"
    }).setOrigin(0.5)

    const instructions = [
      "• Click to place, drag for platforms",
      "• [F] Pointer - drag empty space to lasso select",
      "• Selected items: drag or arrows to move, DEL to delete",
      "• Scroll/Arrows to pan, [+/-] zoom, [0] fit",
      "• Space+drag to pan, [ ; ] back from test",
      "• TEST LEVEL to play your creation"
    ]

    const instrText = this.add.text(0, 10, instructions.join("\n"), {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc",
      lineSpacing: 8
    }).setOrigin(0.5)

    const closeBtn = this.add.text(0, 105, "[ CLICK TO START ]", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5)

    instructionBox.add([bg, title, instrText, closeBtn])

    // Pulsing animation
    this.tweens.add({
      targets: closeBtn,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1
    })

    // Click to dismiss
    bg.setInteractive()
    bg.on("pointerdown", () => {
      instructionBox.destroy()
    })
  }

  onGridClick(pointer) {
    // Skip if right-click
    if (pointer.rightButtonDown()) return
    
    // Skip if clicking on palette area (let palette buttons handle it)
    if (this.paletteBounds && 
        pointer.x >= this.paletteBounds.x && 
        pointer.x <= this.paletteBounds.x + this.paletteBounds.width &&
        pointer.y >= this.paletteBounds.y && 
        pointer.y <= this.paletteBounds.y + this.paletteBounds.height) {
      return
    }
    
    // Handle panning with spacebar or middle mouse
    if (this.isSpaceHeld || pointer.middleButtonDown()) {
      this.isPanning = true
      this.panStart = { x: pointer.x, y: pointer.y }
      return
    }
    
    // Convert screen coordinates to grid tile coordinates
    const tile = this.screenToTile(pointer.x, pointer.y)
    const gridX = tile.x
    const gridY = tile.y

    if (gridX < 0 || gridX >= this.mapWidth || gridY < 0 || gridY >= this.mapHeight) return

    this.isDragging = true
    this.dragStart = { x: gridX, y: gridY }

    // First check if we're clicking on an existing object (for selection/moving)
    const clickedObject = this.getObjectAt(gridX, gridY)
    
    // Check if eraser mode is active (E key held OR eraser tool selected) - erase takes priority
    if (this.isEraserHeld || this.selectedTool === "eraser") {
      this.saveUndoState()
      this.eraseAt(gridX, gridY)
      return
    }
    
    // Handle Option+click for duplicating objects
    if (clickedObject && this.isOptionHeld) {
      // Start duplicate operation - save undo state, create duplicate while dragging
      this.saveUndoState()
      this.startDuplicateOperation(clickedObject, gridX, gridY)
      return
    }
    
    if (clickedObject) {
      // Select the object and prepare for potential drag-move
      this.selectObjectForMove(clickedObject, gridX, gridY)
      return
    }

    // Pointer tool on blank space - lasso select or Command+drag for platform
    if (this.selectedTool === "pointer") {
      if (this.isCommandHeld) {
        // Command+click in pointer mode = place platform (handled on release for drag)
        // Just deselect and let the drag release handle placement
        this.deselectObject()
        this.deselectAllObjects()
      } else {
        // Start lasso selection on blank space
        this.deselectObject()
        this.deselectAllObjects()
        this.startLassoSelection(gridX, gridY)
      }
      return
    }

    // Deselect any selected object when placing new ones
    this.deselectObject()

    // Check if it's a single-tile placement tool
    const singleTileTools = [
      "spawn", "goal", "stopwatch",
      "fragment_drums", "fragment_guitar", "fragment_bass", 
      "fragment_keyboard", "fragment_microphone", "fragment_note",
      "bonus_mixtape", "bonus_cd", "bonus_vinyl", 
      "bonus_waveform", "bonus_recordDeal", "demo_fragment"
    ]
    
    if (singleTileTools.includes(this.selectedTool)) {
      // Save state for undo before placing
      this.saveUndoState()
      
      // Special handling for spawn - show direction dialog
      if (this.selectedTool === "spawn") {
        this.isDragging = false
        this.showSpawnDirectionDialog(gridX, gridY)
        return
      }
      
      // Single-tile objects place immediately
      const placed = this.placeObject(gridX, gridY, this.selectedTool)
      // Auto-deselect single-instance tools after successful placement
      if (placed && this.singleInstanceTools.includes(this.selectedTool)) {
        // IMPORTANT: Stop dragging immediately to prevent platform placement on release
        this.isDragging = false
        this.selectTool("pointer")
        this.statusText.setText("Item placed - switched to POINTER")
        this.time.delayedCall(1500, () => {
          this.statusText.setText("POINTER - Click to select, Cmd+drag for platform")
        })
      }
    }
    // For platform/spike/saw/cables - wait for drag release
  }

  /**
   * Show dialog to select spawn point facing direction
   * Called immediately after placing a spawn point
   */
  showSpawnDirectionDialog(gridX, gridY) {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 350, 180, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0x00ff88)

    const titleText = this.add.text(0, -60, "SPAWN DIRECTION", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#00ff88"
    }).setOrigin(0.5)

    const subtitleText = this.add.text(0, -30, "Which way should the player face?", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)

    // Left button
    const leftBtn = this.add.rectangle(-80, 30, 120, 60, 0x1a1a2e, 0.9)
      .setStrokeStyle(3, 0x00ffff)
      .setInteractive({ useHandCursor: true })
    
    const leftArrow = this.add.text(-80, 20, "←", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#00ffff"
    }).setOrigin(0.5)
    
    const leftLabel = this.add.text(-80, 50, "LEFT", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ffff"
    }).setOrigin(0.5)

    // Right button
    const rightBtn = this.add.rectangle(80, 30, 120, 60, 0x1a1a2e, 0.9)
      .setStrokeStyle(3, 0x00ff88)
      .setInteractive({ useHandCursor: true })
    
    const rightArrow = this.add.text(80, 20, "→", {
      fontFamily: "RetroPixel",
      fontSize: "32px",
      color: "#00ff88"
    }).setOrigin(0.5)
    
    const rightLabel = this.add.text(80, 50, "RIGHT", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ff88"
    }).setOrigin(0.5)

    dialog.add([bg, titleText, subtitleText, leftBtn, leftArrow, leftLabel, rightBtn, rightArrow, rightLabel])

    // Hover effects
    leftBtn.on("pointerover", () => {
      leftBtn.setStrokeStyle(4, 0xffffff)
      leftArrow.setColor("#ffffff")
      leftLabel.setColor("#ffffff")
    })
    leftBtn.on("pointerout", () => {
      leftBtn.setStrokeStyle(3, 0x00ffff)
      leftArrow.setColor("#00ffff")
      leftLabel.setColor("#00ffff")
    })
    
    rightBtn.on("pointerover", () => {
      rightBtn.setStrokeStyle(4, 0xffffff)
      rightArrow.setColor("#ffffff")
      rightLabel.setColor("#ffffff")
    })
    rightBtn.on("pointerout", () => {
      rightBtn.setStrokeStyle(3, 0x00ff88)
      rightArrow.setColor("#00ff88")
      rightLabel.setColor("#00ff88")
    })

    // Click handlers
    const placeSpawnWithDirection = (direction) => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      dialog.destroy()
      
      // Remove keyboard listeners
      this.input.keyboard.off("keydown-LEFT", selectLeft)
      this.input.keyboard.off("keydown-RIGHT", selectRight)
      
      // Place spawn with direction
      this.placeSpawnWithDirection(gridX, gridY, direction)
      
      // Switch to pointer tool
      this.selectTool("pointer")
      this.statusText.setText(`Spawn placed facing ${direction.toUpperCase()} - switched to POINTER`)
      this.time.delayedCall(1500, () => {
        this.statusText.setText("POINTER - Click to select, Cmd+drag for platform")
      })
    }

    const selectLeft = () => placeSpawnWithDirection("left")
    const selectRight = () => placeSpawnWithDirection("right")
    
    leftBtn.on("pointerdown", selectLeft)
    rightBtn.on("pointerdown", selectRight)

    // Keyboard shortcuts
    this.input.keyboard.on("keydown-LEFT", selectLeft)
    this.input.keyboard.on("keydown-RIGHT", selectRight)
    
    // Gamepad support
    if (this.input.gamepad && this.input.gamepad.total > 0) {
      const gamepad = this.input.gamepad.getPad(0)
      if (gamepad) {
        const checkGamepad = () => {
          if (!dialog.active) return
          if (gamepad.leftStick.x < -0.5 || gamepad.buttons[14]?.pressed) { // D-pad left
            selectLeft()
          } else if (gamepad.leftStick.x > 0.5 || gamepad.buttons[15]?.pressed) { // D-pad right
            selectRight()
          } else {
            this.time.delayedCall(50, checkGamepad)
          }
        }
        this.time.delayedCall(100, checkGamepad)
      }
    }
  }

  /**
   * Place spawn point with specified facing direction
   */
  placeSpawnWithDirection(x, y, direction) {
    const displayScale = this.currentDisplayScale
    const type = "spawn"

    // For single-instance tools, remove any existing instance first
    const existing = this.placedObjects.filter(obj => obj.type === type)
    existing.forEach(obj => {
      obj.visual.destroy()
      const index = this.placedObjects.indexOf(obj)
      if (index > -1) {
        this.placedObjects.splice(index, 1)
      }
    })

    // Get color for spawn
    const color = this.getObjectColor(type)

    // Create visual representation with direction indicator
    const visualContainer = this.add.container(
      x * this.gridSize * displayScale + (this.gridSize * displayScale) / 2,
      y * this.gridSize * displayScale + (this.gridSize * displayScale) / 2
    )
    
    // Background rectangle
    const rect = this.add.rectangle(
      0, 0,
      this.gridSize * displayScale - 2,
      this.gridSize * displayScale - 2,
      color,
      0.8
    )
    
    // Direction arrow indicator
    const arrowText = direction === "left" ? "←" : "→"
    const arrow = this.add.text(0, 0, arrowText, {
      fontFamily: "RetroPixel",
      fontSize: `${Math.floor(24 * displayScale)}px`,
      color: "#ffffff"
    }).setOrigin(0.5)
    
    visualContainer.add([rect, arrow])
    this.objectsContainer.add(visualContainer)

    // Store object data with direction
    const obj = {
      type,
      x,
      y,
      width: 1,
      height: 1,
      facingDirection: direction,
      visual: visualContainer
    }
    
    this.placedObjects.push(obj)

    // Mark as having unsaved changes
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()

    // Update collectible count display
    this.updateCollectibleCount()
    
    // Clear redo stack on new action
    this.redoStack = []
    
    return true
  }

  /**
   * Start a duplicate operation - create a copy of the object that follows cursor
   */
  startDuplicateOperation(obj, gridX, gridY) {
    this.isDuplicating = true
    
    // Create a duplicate object data (but don't add to placedObjects yet)
    this.duplicateSource = obj
    this.duplicateData = {
      type: obj.type,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      movement: obj.movement ? { ...obj.movement } : undefined
    }
    
    // Store offset for dragging
    this.moveOffset = {
      x: gridX - obj.x,
      y: gridY - obj.y
    }
    
    // Create preview for the duplicate
    const displayScale = this.currentDisplayScale
    const color = this.getObjectColor(obj.type)
    const previewX = obj.x * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
    const previewY = obj.y * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2

    this.movePreview = this.add.rectangle(
      previewX,
      previewY,
      obj.width * this.gridSize * displayScale - 2,
      obj.height * this.gridSize * displayScale - 2,
      color,
      0.6
    ).setStrokeStyle(2, 0x00ffff)  // Cyan border to indicate duplicate
    
    this.objectsContainer.add(this.movePreview)
    
    this.statusText.setText(`Duplicating: ${obj.type.toUpperCase()} - Drag to place copy`)
    this.sound.play("ui_select_sound", { volume: 0.2 })
  }

  /**
   * Complete the duplicate operation - place the copy at new position
   */
  completeDuplicateOperation(gridX, gridY) {
    if (!this.isDuplicating || !this.duplicateData) return
    
    const data = this.duplicateData
    
    // Calculate new position
    let newX = gridX - this.moveOffset.x
    let newY = gridY - this.moveOffset.y
    
    // Clamp to grid bounds
    newX = Math.max(0, Math.min(this.mapWidth - data.width, newX))
    newY = Math.max(0, Math.min(this.mapHeight - data.height, newY))
    
    // Place the duplicate
    this.placeObject(newX, newY, data.type, data.width, data.height)
    
    // If it had movement data, update the newly placed object
    if (data.movement) {
      const newObj = this.placedObjects[this.placedObjects.length - 1]
      if (newObj) {
        newObj.movement = { ...data.movement }
      }
    }
    
    // Clean up
    if (this.movePreview) {
      this.movePreview.destroy()
      this.movePreview = null
    }
    
    this.isDuplicating = false
    this.duplicateSource = null
    this.duplicateData = null
    this.moveOffset = { x: 0, y: 0 }
    
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.statusText.setText(`Duplicated ${data.type.toUpperCase()} to (${newX}, ${newY})`)
    this.time.delayedCall(1500, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Cancel duplicate operation
   */
  cancelDuplicateOperation() {
    if (!this.isDuplicating) return
    
    if (this.movePreview) {
      this.movePreview.destroy()
      this.movePreview = null
    }
    
    this.isDuplicating = false
    this.duplicateSource = null
    this.duplicateData = null
    this.moveOffset = { x: 0, y: 0 }
    
    this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
  }

  // ==================== LASSO SELECTION SYSTEM ====================

  /**
   * Start lasso selection from an empty grid position
   */
  startLassoSelection(gridX, gridY) {
    this.isLassoSelecting = true
    this.lassoStartTile = { x: gridX, y: gridY }
    
    // Create visual lasso rectangle
    const displayScale = this.currentDisplayScale
    const startX = gridX * this.gridSize * displayScale
    const startY = gridY * this.gridSize * displayScale
    
    this.lassoRect = this.add.rectangle(
      startX, startY,
      1, 1,  // Initial size, will grow during drag
      0x00ffff, 0.2
    ).setOrigin(0, 0).setStrokeStyle(2, 0x00ffff, 0.8)
    this.objectsContainer.add(this.lassoRect)
    
    this.statusText.setText("LASSO SELECT - Drag to select multiple objects")
  }

  /**
   * Update lasso rectangle during drag
   */
  updateLassoSelection(gridX, gridY) {
    if (!this.isLassoSelecting || !this.lassoRect) return
    
    const displayScale = this.currentDisplayScale
    
    // Calculate rectangle bounds in tile space
    const x0 = Math.min(this.lassoStartTile.x, gridX)
    const y0 = Math.min(this.lassoStartTile.y, gridY)
    const x1 = Math.max(this.lassoStartTile.x, gridX) + 1
    const y1 = Math.max(this.lassoStartTile.y, gridY) + 1
    
    // Update visual rectangle
    const rectX = x0 * this.gridSize * displayScale
    const rectY = y0 * this.gridSize * displayScale
    const rectW = (x1 - x0) * this.gridSize * displayScale
    const rectH = (y1 - y0) * this.gridSize * displayScale
    
    this.lassoRect.setPosition(rectX, rectY)
    this.lassoRect.setSize(rectW, rectH)
  }

  /**
   * Complete lasso selection and select all objects within bounds
   */
  completeLassoSelection(gridX, gridY) {
    if (!this.isLassoSelecting) return
    
    // Calculate selection bounds in tile space
    const x0 = Math.min(this.lassoStartTile.x, gridX)
    const y0 = Math.min(this.lassoStartTile.y, gridY)
    const x1 = Math.max(this.lassoStartTile.x, gridX) + 1
    const y1 = Math.max(this.lassoStartTile.y, gridY) + 1
    
    // Find all objects that intersect with the lasso bounds
    const selectedObjs = this.placedObjects.filter(obj => {
      // Check if object overlaps with lasso rectangle
      const objRight = obj.x + obj.width
      const objBottom = obj.y + obj.height
      return obj.x < x1 && objRight > x0 && obj.y < y1 && objBottom > y0
    })
    
    // Clean up lasso rectangle
    if (this.lassoRect) {
      this.lassoRect.destroy()
      this.lassoRect = null
    }
    this.isLassoSelecting = false
    
    // Select the objects
    if (selectedObjs.length > 0) {
      this.selectMultipleObjects(selectedObjs)
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.statusText.setText(`Selected ${selectedObjs.length} object(s) - Arrow keys or drag to move, DEL to delete`)
    } else {
      this.statusText.setText("POINTER - Click to select, drag empty space to lasso")
    }
  }

  /**
   * Cancel lasso selection
   */
  cancelLassoSelection() {
    if (!this.isLassoSelecting) return
    
    if (this.lassoRect) {
      this.lassoRect.destroy()
      this.lassoRect = null
    }
    this.isLassoSelecting = false
    this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
  }

  /**
   * Select multiple objects (for lasso selection)
   */
  selectMultipleObjects(objects) {
    // Clear any previous selection
    this.deselectAllObjects()
    this.deselectObject()
    
    this.selectedObjects = [...objects]
    
    // Create highlight for each selected object
    const displayScale = this.currentDisplayScale
    this.selectedObjects.forEach(obj => {
      const x = obj.x * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
      const y = obj.y * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
      
      const highlight = this.add.rectangle(
        x, y,
        obj.width * this.gridSize * displayScale + 4,
        obj.height * this.gridSize * displayScale + 4,
        0x00ffff, 0
      ).setStrokeStyle(2, 0x00ffff)
      this.objectsContainer.add(highlight)
      this.selectionHighlights.push(highlight)
    })
  }

  /**
   * Deselect all multi-selected objects
   */
  deselectAllObjects() {
    // Destroy all selection highlights
    this.selectionHighlights.forEach(highlight => highlight.destroy())
    this.selectionHighlights = []
    this.selectedObjects = []
    
    // Cancel any multi-move in progress
    this.cancelMultiMove()
  }

  /**
   * Start moving multiple selected objects
   */
  startMultiMove(gridX, gridY) {
    if (this.selectedObjects.length === 0) return
    
    this.isMovingMultiple = true
    
    // Find the "anchor" object (the one that was clicked) to calculate offset
    // Use the first selected object's position as reference
    const anchorObj = this.selectedObjects[0]
    this.multiMoveOffset = {
      x: gridX - anchorObj.x,
      y: gridY - anchorObj.y
    }
    
    // Store original positions for all objects
    this.multiMoveOriginalPositions = this.selectedObjects.map(obj => ({
      obj: obj,
      x: obj.x,
      y: obj.y
    }))
    
    // Make all objects semi-transparent
    this.selectedObjects.forEach(obj => obj.visual.setAlpha(0.5))
    
    // Create preview rectangles for all objects
    const displayScale = this.currentDisplayScale
    this.multiMovePreviews = this.selectedObjects.map(obj => {
      const color = this.getObjectColor(obj.type)
      const previewX = obj.x * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
      const previewY = obj.y * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
      
      const preview = this.add.rectangle(
        previewX, previewY,
        obj.width * this.gridSize * displayScale - 2,
        obj.height * this.gridSize * displayScale - 2,
        color, 0.6
      ).setStrokeStyle(2, 0x00ffff)
      this.objectsContainer.add(preview)
      return { preview, obj }
    })
    
    this.statusText.setText(`Moving ${this.selectedObjects.length} object(s) - Drag to new position`)
    this.sound.play("ui_select_sound", { volume: 0.2 })
  }

  /**
   * Update multi-object move preview positions
   */
  updateMultiMovePreview(gridX, gridY) {
    if (!this.isMovingMultiple || this.multiMovePreviews.length === 0) return
    
    const displayScale = this.currentDisplayScale
    
    // Calculate the delta movement
    const deltaX = gridX - this.multiMoveOffset.x - this.multiMoveOriginalPositions[0].x
    const deltaY = gridY - this.multiMoveOffset.y - this.multiMoveOriginalPositions[0].y
    
    // Update each preview position
    this.multiMovePreviews.forEach(({ preview, obj }, index) => {
      const origPos = this.multiMoveOriginalPositions[index]
      let newX = origPos.x + deltaX
      let newY = origPos.y + deltaY
      
      // Clamp to grid bounds (for this individual object)
      newX = Math.max(0, Math.min(this.mapWidth - obj.width, newX))
      newY = Math.max(0, Math.min(this.mapHeight - obj.height, newY))
      
      const previewX = newX * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
      const previewY = newY * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
      
      preview.setPosition(previewX, previewY)
    })
    
    // Also update the selection highlights
    this.selectionHighlights.forEach((highlight, index) => {
      const preview = this.multiMovePreviews[index]?.preview
      if (preview) {
        highlight.setPosition(preview.x, preview.y)
      }
    })
  }

  /**
   * Complete multi-object move
   */
  completeMultiMove(gridX, gridY) {
    if (!this.isMovingMultiple) return
    
    const displayScale = this.currentDisplayScale
    
    // Calculate the delta movement
    const deltaX = gridX - this.multiMoveOffset.x - this.multiMoveOriginalPositions[0].x
    const deltaY = gridY - this.multiMoveOffset.y - this.multiMoveOriginalPositions[0].y
    
    // Check if actually moved
    if (deltaX === 0 && deltaY === 0) {
      this.cancelMultiMove()
      return
    }
    
    // Save undo state before moving
    this.saveUndoState()
    
    // Update each object's position
    this.selectedObjects.forEach((obj, index) => {
      const origPos = this.multiMoveOriginalPositions[index]
      let newX = origPos.x + deltaX
      let newY = origPos.y + deltaY
      
      // Clamp to grid bounds
      newX = Math.max(0, Math.min(this.mapWidth - obj.width, newX))
      newY = Math.max(0, Math.min(this.mapHeight - obj.height, newY))
      
      obj.x = newX
      obj.y = newY
      
      // Update visual position
      const visualX = newX * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
      const visualY = newY * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
      obj.visual.setPosition(visualX, visualY)
      obj.visual.setAlpha(0.8)
    })
    
    // Clean up previews
    this.multiMovePreviews.forEach(({ preview }) => preview.destroy())
    this.multiMovePreviews = []
    
    // Update selection highlights to new positions
    this.selectionHighlights.forEach((highlight, index) => {
      const obj = this.selectedObjects[index]
      const x = obj.x * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
      const y = obj.y * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
      highlight.setPosition(x, y)
    })
    
    this.isMovingMultiple = false
    this.multiMoveOriginalPositions = null
    this.multiMoveOffset = { x: 0, y: 0 }
    
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.statusText.setText(`Moved ${this.selectedObjects.length} object(s)`)
    this.time.delayedCall(1500, () => {
      if (this.selectedObjects.length > 0) {
        this.statusText.setText(`${this.selectedObjects.length} object(s) selected - Arrow keys or drag to move, DEL to delete`)
      } else {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      }
    })
  }

  /**
   * Cancel multi-object move
   */
  cancelMultiMove() {
    if (!this.isMovingMultiple) return
    
    // Restore object opacities
    this.selectedObjects.forEach(obj => obj.visual.setAlpha(0.8))
    
    // Clean up previews
    this.multiMovePreviews.forEach(({ preview }) => preview.destroy())
    this.multiMovePreviews = []
    
    // Restore highlight positions
    const displayScale = this.currentDisplayScale
    this.selectionHighlights.forEach((highlight, index) => {
      const obj = this.selectedObjects[index]
      if (obj) {
        const x = obj.x * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
        const y = obj.y * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
        highlight.setPosition(x, y)
      }
    })
    
    this.isMovingMultiple = false
    this.multiMoveOriginalPositions = null
    this.multiMoveOffset = { x: 0, y: 0 }
    
    this.statusText.setText(`${this.selectedObjects.length} object(s) selected - Arrow keys or drag to move, DEL to delete`)
  }

  /**
   * Move multi-selected objects by tiles (for arrow key movement)
   */
  moveSelectedObjectsByTiles(tilesX, tilesY) {
    if (this.selectedObjects.length === 0) return
    
    // Save undo state
    this.saveUndoState()
    
    const displayScale = this.currentDisplayScale
    
    // Check if any object would go out of bounds
    let canMove = true
    this.selectedObjects.forEach(obj => {
      const newX = obj.x + tilesX
      const newY = obj.y + tilesY
      if (newX < 0 || newX + obj.width > this.mapWidth || 
          newY < 0 || newY + obj.height > this.mapHeight) {
        canMove = false
      }
    })
    
    if (!canMove) return
    
    // Move all objects
    this.selectedObjects.forEach((obj, index) => {
      obj.x += tilesX
      obj.y += tilesY
      
      // Update visual position
      const visualX = obj.x * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
      const visualY = obj.y * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
      obj.visual.setPosition(visualX, visualY)
      
      // Update highlight position
      if (this.selectionHighlights[index]) {
        this.selectionHighlights[index].setPosition(visualX, visualY)
      }
    })
    
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    
    this.sound.play("ui_select_sound", { volume: 0.15 })
    this.statusText.setText(`Moved ${this.selectedObjects.length} object(s)`)
    this.time.delayedCall(1000, () => {
      this.statusText.setText(`${this.selectedObjects.length} object(s) selected - Arrow keys or drag to move, DEL to delete`)
    })
  }

  /**
   * Delete all multi-selected objects
   */
  deleteSelectedObjects() {
    if (this.selectedObjects.length === 0) return
    
    // Save undo state
    this.saveUndoState()
    
    const count = this.selectedObjects.length
    
    // Remove each selected object
    this.selectedObjects.forEach(obj => {
      const index = this.placedObjects.indexOf(obj)
      if (index > -1) {
        obj.visual.destroy()
        this.placedObjects.splice(index, 1)
      }
    })
    
    // Clear selection
    this.deselectAllObjects()
    
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    this.updateCollectibleCount()
    
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.statusText.setText(`Deleted ${count} object(s)`)
    this.time.delayedCall(1000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Get object at grid position
   */
  getObjectAt(gridX, gridY) {
    return this.placedObjects.find(obj => {
      return gridX >= obj.x && gridX < obj.x + obj.width &&
             gridY >= obj.y && gridY < obj.y + obj.height
    })
  }

  /**
   * Select an object and prepare for move
   */
  selectObjectForMove(obj, gridX, gridY) {
    // Check if clicking on an object that's part of multi-selection
    if (this.selectedObjects.length > 0 && this.selectedObjects.includes(obj)) {
      // Start moving the entire multi-selection group
      this.startMultiMove(gridX, gridY)
      return
    }
    
    // Deselect previous selection (single and multi)
    this.deselectObject()
    this.deselectAllObjects()
    
    // Select new object
    this.selectedObject = obj
    
    // Create selection highlight
    const displayScale = this.currentDisplayScale
    const x = obj.x * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
    const y = obj.y * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
    
    this.selectionHighlight = this.add.rectangle(
      x, y,
      obj.width * this.gridSize * displayScale + 4,
      obj.height * this.gridSize * displayScale + 4,
      0xffffff, 0
    ).setStrokeStyle(2, 0xffffff)
    this.objectsContainer.add(this.selectionHighlight)
    
    // Store offset for dragging
    this.moveOffset = {
      x: gridX - obj.x,
      y: gridY - obj.y
    }
    
    // Start move operation
    this.movingObject = obj
    obj.visual.setAlpha(0.5)
    
    // Create move preview
    this.createMovePreview(obj, gridX, gridY)
    
    this.statusText.setText(`Selected: ${obj.type.toUpperCase()} - Arrow keys or drag to move, DEL to delete`)
  }

  /**
   * Pick up an object at the given grid position for moving
   */
  pickUpObjectAt(gridX, gridY) {
    // Find an object at this position
    const obj = this.placedObjects.find(obj => {
      return gridX >= obj.x && gridX < obj.x + obj.width &&
             gridY >= obj.y && gridY < obj.y + obj.height
    })

    if (obj) {
      this.movingObject = obj
      // Calculate offset from object's top-left to click position
      this.moveOffset = {
        x: gridX - obj.x,
        y: gridY - obj.y
      }
      // Make the original object semi-transparent while moving
      obj.visual.setAlpha(0.3)
      // Create a preview visual
      this.createMovePreview(obj, gridX, gridY)
      this.statusText.setText(`Moving: ${obj.type.toUpperCase()}`)
      this.sound.play("ui_select_sound", { volume: 0.2 })
    }
  }

  /**
   * Create a preview visual for the object being moved
   */
  createMovePreview(obj, gridX, gridY) {
    const displayScale = this.currentDisplayScale
    const color = this.getObjectColor(obj.type)
    
    // Calculate position based on where the object would be placed
    const previewX = (gridX - this.moveOffset.x) * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
    const previewY = (gridY - this.moveOffset.y) * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2

    this.movePreview = this.add.rectangle(
      previewX,
      previewY,
      obj.width * this.gridSize * displayScale - 2,
      obj.height * this.gridSize * displayScale - 2,
      color,
      0.6
    ).setStrokeStyle(2, 0xffffff)
    
    this.objectsContainer.add(this.movePreview)
  }

  /**
   * Update the move preview position
   */
  updateMovePreview(gridX, gridY) {
    if (!this.movePreview || !this.movingObject) return

    const displayScale = this.currentDisplayScale
    const obj = this.movingObject
    
    // Calculate new position, clamping to grid bounds
    let newX = gridX - this.moveOffset.x
    let newY = gridY - this.moveOffset.y
    
    // Clamp to grid bounds
    newX = Math.max(0, Math.min(this.mapWidth - obj.width, newX))
    newY = Math.max(0, Math.min(this.mapHeight - obj.height, newY))
    
    // Update preview position
    const previewX = newX * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
    const previewY = newY * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
    
    this.movePreview.setPosition(previewX, previewY)
  }

  /**
   * Complete the move operation and place the object at its new position
   */
  completeMoveOperation(gridX, gridY) {
    if (!this.movingObject) return

    const obj = this.movingObject
    const displayScale = this.currentDisplayScale
    
    // Calculate new position
    let newX = gridX - this.moveOffset.x
    let newY = gridY - this.moveOffset.y
    
    // Clamp to grid bounds
    newX = Math.max(0, Math.min(this.mapWidth - obj.width, newX))
    newY = Math.max(0, Math.min(this.mapHeight - obj.height, newY))
    
    // Update object data
    obj.x = newX
    obj.y = newY
    
    // Update visual position
    const visualX = newX * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
    const visualY = newY * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
    
    obj.visual.setPosition(visualX, visualY)
    obj.visual.setAlpha(0.8) // Restore opacity
    
    // Clean up preview
    if (this.movePreview) {
      this.movePreview.destroy()
      this.movePreview = null
    }
    
    // Mark as unsaved
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    
    // Play confirmation sound
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    
    // Update status
    this.statusText.setText(`Moved ${obj.type.toUpperCase()} to (${newX}, ${newY})`)
    this.time.delayedCall(1500, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
    
    // Reset moving state
    this.movingObject = null
    this.moveOffset = { x: 0, y: 0 }
  }

  /**
   * Cancel the move operation
   */
  cancelMoveOperation() {
    if (!this.movingObject) return
    
    // Restore original object opacity
    this.movingObject.visual.setAlpha(0.8)
    
    // Clean up preview
    if (this.movePreview) {
      this.movePreview.destroy()
      this.movePreview = null
    }
    
    // Reset state
    this.movingObject = null
    this.moveOffset = { x: 0, y: 0 }
    
    this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
  }

  /**
   * Move the selected object by a number of tiles (for arrow key movement)
   * @param {number} tilesX - Number of tiles to move horizontally (positive = right)
   * @param {number} tilesY - Number of tiles to move vertically (positive = down)
   */
  moveSelectedObjectByTiles(tilesX, tilesY) {
    if (!this.selectedObject) return
    
    const obj = this.selectedObject
    const displayScale = this.currentDisplayScale
    
    // Calculate new position
    let newX = obj.x + tilesX
    let newY = obj.y + tilesY
    
    // Clamp to grid bounds
    newX = Math.max(0, Math.min(this.mapWidth - obj.width, newX))
    newY = Math.max(0, Math.min(this.mapHeight - obj.height, newY))
    
    // Check if position actually changed
    if (newX === obj.x && newY === obj.y) return
    
    // Save undo state before moving
    this.saveUndoState()
    
    // Update object data
    obj.x = newX
    obj.y = newY
    
    // Update visual position
    const visualX = newX * this.gridSize * displayScale + (obj.width * this.gridSize * displayScale) / 2
    const visualY = newY * this.gridSize * displayScale + (obj.height * this.gridSize * displayScale) / 2
    obj.visual.setPosition(visualX, visualY)
    
    // Update selection highlight position
    if (this.selectionHighlight) {
      this.selectionHighlight.setPosition(visualX, visualY)
    }
    
    // Mark as unsaved
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    
    // Play subtle sound
    this.sound.play("ui_select_sound", { volume: 0.15 })
    
    // Update status briefly
    this.statusText.setText(`Moved ${obj.type.toUpperCase()} to (${newX}, ${newY})`)
    this.time.delayedCall(1000, () => {
      if (this.selectedObject) {
        this.statusText.setText(`Selected: ${obj.type.toUpperCase()} - Arrow keys to move, DEL to delete`)
      }
    })
  }

  onGridMove(pointer) {
    // Handle panning
    if (this.isPanning) {
      const deltaX = pointer.x - this.panStart.x
      const deltaY = pointer.y - this.panStart.y
      this.panViewport(deltaX, deltaY)
      this.panStart = { x: pointer.x, y: pointer.y }
      return
    }
    
    // Convert screen coordinates to grid tile coordinates
    const tile = this.screenToTile(pointer.x, pointer.y)
    const gridX = tile.x
    const gridY = tile.y

    // Update coords display
    this.coordsText.setText(`Grid: ${gridX}, ${gridY}`)

    // Handle eraser when E key is held OR eraser tool is selected
    if (this.isDragging && (this.isEraserHeld || this.selectedTool === "eraser")) {
      this.eraseAt(gridX, gridY)
    }
    
    // Update duplicate preview if duplicating an object
    if (this.isDuplicating && this.movePreview && this.duplicateData) {
      this.updateDuplicatePreview(gridX, gridY)
    }
    // Update lasso selection rectangle
    else if (this.isLassoSelecting) {
      this.updateLassoSelection(gridX, gridY)
    }
    // Update multi-object move preview
    else if (this.isMovingMultiple) {
      this.updateMultiMovePreview(gridX, gridY)
    }
    // Update move preview if moving an object
    else if (this.movingObject && this.movePreview) {
      this.updateMovePreview(gridX, gridY)
      // Also update selection highlight position during move
      if (this.selectionHighlight) {
        this.selectionHighlight.setPosition(this.movePreview.x, this.movePreview.y)
      }
    }
    
    // Show hover highlight for objects (when not dragging)
    if (!this.isDragging && !this.movingObject && !this.isDuplicating && !this.isLassoSelecting && !this.isMovingMultiple) {
      this.updateHoverHighlight(gridX, gridY)
    }
  }

  /**
   * Update duplicate preview position
   */
  updateDuplicatePreview(gridX, gridY) {
    if (!this.movePreview || !this.duplicateData) return

    const displayScale = this.currentDisplayScale
    const data = this.duplicateData
    
    // Calculate new position, clamping to grid bounds
    let newX = gridX - this.moveOffset.x
    let newY = gridY - this.moveOffset.y
    
    // Clamp to grid bounds
    newX = Math.max(0, Math.min(this.mapWidth - data.width, newX))
    newY = Math.max(0, Math.min(this.mapHeight - data.height, newY))
    
    // Update preview position
    const previewX = newX * this.gridSize * displayScale + (data.width * this.gridSize * displayScale) / 2
    const previewY = newY * this.gridSize * displayScale + (data.height * this.gridSize * displayScale) / 2
    
    this.movePreview.setPosition(previewX, previewY)
  }

  /**
   * Update hover highlight when mouse moves over objects
   */
  updateHoverHighlight(gridX, gridY) {
    const hoveredObject = this.getObjectAt(gridX, gridY)
    
    // Remove previous hover highlight if different object
    if (this.hoverHighlight && this.lastHoveredObject !== hoveredObject) {
      this.hoverHighlight.destroy()
      this.hoverHighlight = null
    }
    
    // Don't show hover on selected object or multi-selected objects (they have selection highlights)
    const isMultiSelected = this.selectedObjects.includes(hoveredObject)
    if (hoveredObject && hoveredObject !== this.selectedObject && !isMultiSelected && !this.hoverHighlight) {
      const displayScale = this.currentDisplayScale
      const x = hoveredObject.x * this.gridSize * displayScale + (hoveredObject.width * this.gridSize * displayScale) / 2
      const y = hoveredObject.y * this.gridSize * displayScale + (hoveredObject.height * this.gridSize * displayScale) / 2
      
      this.hoverHighlight = this.add.rectangle(
        x, y,
        hoveredObject.width * this.gridSize * displayScale + 2,
        hoveredObject.height * this.gridSize * displayScale + 2,
        0xffffff, 0
      ).setStrokeStyle(1, 0x888888)
      this.objectsContainer.add(this.hoverHighlight)
      
      // Change cursor to pointer
      this.game.canvas.style.cursor = "pointer"
    } else if (!hoveredObject) {
      // Reset cursor when not hovering
      this.game.canvas.style.cursor = "default"
    }
    
    this.lastHoveredObject = hoveredObject
  }

  onGridRelease() {
    // Handle pan release
    if (this.isPanning) {
      this.isPanning = false
      return
    }
    
    if (!this.isDragging) return

    const pointer = this.input.activePointer
    const tile = this.screenToTile(pointer.x, pointer.y)
    const gridX = tile.x
    const gridY = tile.y

    // Handle duplicate release (Option+drag)
    if (this.isDuplicating) {
      this.completeDuplicateOperation(gridX, gridY)
      this.isDragging = false
      return
    }

    // Handle lasso selection release
    if (this.isLassoSelecting) {
      this.completeLassoSelection(gridX, gridY)
      this.isDragging = false
      return
    }

    // Handle multi-object move release
    if (this.isMovingMultiple) {
      this.completeMultiMove(gridX, gridY)
      this.isDragging = false
      return
    }

    // Handle object move release
    if (this.movingObject) {
      // Check if we actually moved (not just a click)
      const startX = this.dragStart.x - this.moveOffset.x
      const startY = this.dragStart.y - this.moveOffset.y
      const endX = gridX - this.moveOffset.x
      const endY = gridY - this.moveOffset.y
      
      if (startX !== endX || startY !== endY) {
        // Actually moved - complete the move
        this.completeMoveOperation(gridX, gridY)
      } else {
        // Just a click - keep selected but cancel move operation
        this.movingObject.visual.setAlpha(0.8)
        if (this.movePreview) {
          this.movePreview.destroy()
          this.movePreview = null
        }
        this.movingObject = null
        // Keep selectedObject and selectionHighlight
      }
    } 
    // Handle Command+drag in pointer mode for platform placement
    else if (this.selectedTool === "pointer" && this.isCommandHeld) {
      const x0 = Math.min(this.dragStart.x, gridX)
      const y0 = Math.min(this.dragStart.y, gridY)
      const x1 = Math.max(this.dragStart.x, gridX) + 1
      const y1 = Math.max(this.dragStart.y, gridY) + 1

      // Save state for undo before placing
      this.saveUndoState()
      this.placeObject(x0, y0, "platform", x1 - x0, y1 - y0)
    }
    // Normal tool placement
    else if (!this.isEraserHeld && (this.selectedTool === "platform" || this.selectedTool === "spike" || 
               this.selectedTool === "saw" || this.selectedTool === "saw_h" || 
               this.selectedTool === "saw_v" || this.selectedTool === "saw_c" ||
               this.selectedTool === "cables")) {
      const x0 = Math.min(this.dragStart.x, gridX)
      const y0 = Math.min(this.dragStart.y, gridY)
      const x1 = Math.max(this.dragStart.x, gridX) + 1
      const y1 = Math.max(this.dragStart.y, gridY) + 1

      // Save state for undo before placing
      this.saveUndoState()
      this.placeObject(x0, y0, this.selectedTool, x1 - x0, y1 - y0)
    }

    this.isDragging = false
  }

  placeObject(x, y, type, width = 1, height = 1) {
    const displayScale = this.currentDisplayScale

    // Check collectible placement restrictions
    if (type.startsWith('fragment_') || type.startsWith('bonus_') || type === 'demo_fragment') {
      const check = canAddCollectible(type, this.placedObjects)
      if (!check.canAdd) {
        this.showCollectibleAlert(check.reason)
        return false
      }
    }
    
    // For single-instance tools, remove any existing instance first
    if (this.singleInstanceTools.includes(type) && !type.startsWith('fragment_note')) {
      const existing = this.placedObjects.filter(obj => obj.type === type)
      existing.forEach(obj => {
        obj.visual.destroy()
        const index = this.placedObjects.indexOf(obj)
        if (index > -1) {
          this.placedObjects.splice(index, 1)
        }
      })
    }

    // Get color based on type
    let color = this.getObjectColor(type)

    // Create visual representation
    const rect = this.add.rectangle(
      x * this.gridSize * displayScale + (width * this.gridSize * displayScale) / 2,
      y * this.gridSize * displayScale + (height * this.gridSize * displayScale) / 2,
      width * this.gridSize * displayScale - 2,
      height * this.gridSize * displayScale - 2,
      color,
      0.8
    )
    this.objectsContainer.add(rect)

    // Store object data
    const obj = {
      type,
      x,
      y,
      width,
      height,
      visual: rect
    }
    
    // Add movement data for moving saws
    if (type === "saw_h") {
      obj.movement = { type: "horizontal", distance: 3, speed: 2000 }
    } else if (type === "saw_v") {
      obj.movement = { type: "vertical", distance: 3, speed: 2000 }
    } else if (type === "saw_c") {
      obj.movement = { type: "circular", distance: 2, speed: 2000 }
    }
    
    this.placedObjects.push(obj)

    // Mark as having unsaved changes
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()

    // Update collectible count display
    this.updateCollectibleCount()
    
    // Clear redo stack on new action
    this.redoStack = []
    
    return true
  }

  /**
   * Get color for any object type
   */
  getObjectColor(type) {
    // Terrain
    if (type === "platform") return 0x4a90d9
    if (type === "spike") return 0xff4444
    if (type === "saw") return 0xff8800
    if (type === "saw_h") return 0xff6600
    if (type === "saw_v") return 0xff4400
    if (type === "saw_c") return 0xff2200
    if (type === "cables") return 0x8844aa
    
    // Level markers
    if (type === "spawn") return 0x00ff88
    if (type === "goal") return 0xffff00
    if (type === "stopwatch") return 0x00ffff  // Cyan for speed run stopwatch
    
    // Required instruments
    if (type.startsWith('fragment_')) {
      const subType = type.replace('fragment_', '')
      if (REQUIRED_INSTRUMENTS[subType]) {
        return REQUIRED_INSTRUMENTS[subType].color
      }
      if (subType === 'note') {
        return NOTE_COLLECTIBLE.color
      }
    }
    
    // Bonus collectibles
    if (type.startsWith('bonus_')) {
      const bonusType = type.replace('bonus_', '')
      if (BONUS_COLLECTIBLES[bonusType]) {
        return BONUS_COLLECTIBLES[bonusType].color
      }
    }
    
    // Demo fragment
    if (type === 'demo_fragment') {
      return DEMO_FRAGMENT.color
    }
    
    return 0x4a90d9
  }

  /**
   * Show alert when collectible placement is blocked
   */
  showCollectibleAlert(message) {
    // Play error sound
    this.sound.play("ui_select_sound", { volume: 0.3 })
    
    // Create alert popup
    const alert = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    alert.setDepth(1000)
    
    const bg = this.add.rectangle(0, 0, 400, 100, 0x1a0a0a, 0.95)
      .setStrokeStyle(2, 0xff4444)
    
    const icon = this.add.text(-180, 0, "⚠", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#ff4444"
    }).setOrigin(0.5)
    
    const text = this.add.text(20, 0, message, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff",
      wordWrap: { width: 320 }
    }).setOrigin(0.5)
    
    alert.add([bg, icon, text])
    
    // Fade out after 2 seconds
    this.tweens.add({
      targets: alert,
      alpha: 0,
      duration: 500,
      delay: 2000,
      onComplete: () => alert.destroy()
    })
  }

  /**
   * Update the collectible count display in status bar
   */
  updateCollectibleCount() {
    const summary = getCollectibleSummary(this.placedObjects)
    this.objectCountText.setText(summary)
  }

  eraseAt(x, y) {
    const toRemove = this.placedObjects.filter(obj => {
      return x >= obj.x && x < obj.x + obj.width &&
             y >= obj.y && y < obj.y + obj.height
    })

    if (toRemove.length > 0) {
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
    }

    toRemove.forEach(obj => {
      obj.visual.destroy()
      const index = this.placedObjects.indexOf(obj)
      if (index > -1) {
        this.placedObjects.splice(index, 1)
      }
    })

    this.objectCountText.setText(`Objects: ${this.placedObjects.length}`)
  }

  clearLevel() {
    this.placedObjects.forEach(obj => obj.visual.destroy())
    this.placedObjects = []
    this.objectCountText.setText(`Objects: 0`)
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
  }

  confirmClearLevel() {
    this.showConfirmDialog(
      "CLEAR ALL OBJECTS?",
      "This will remove all placed objects.\nThis cannot be undone.",
      () => this.clearLevel()
    )
  }

  confirmNewLevel() {
    if (this.hasUnsavedChanges) {
      this.showConfirmDialog(
        "CREATE NEW LEVEL?",
        "You have unsaved changes.\nThey will be lost.",
        () => {
          this.clearLevel()
          this.currentLevelTitle = ""
          this.editingLevelId = null
          this.editingBuiltinKey = null
          this.hasUnsavedChanges = false
          this.updateTitleDisplay()
          this.updateUnsavedIndicator()
        }
      )
    } else {
      this.clearLevel()
      this.currentLevelTitle = ""
      this.editingLevelId = null
      this.editingBuiltinKey = null
      this.hasUnsavedChanges = false
      this.updateTitleDisplay()
      this.updateUnsavedIndicator()
    }
  }

  showConfirmDialog(title, message, onConfirm) {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 350, 180, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0xff4444)

    const titleText = this.add.text(0, -60, title, {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff4444"
    }).setOrigin(0.5)

    const msgText = this.add.text(0, -10, message, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc",
      align: "center"
    }).setOrigin(0.5)

    const confirmBtn = this.add.rectangle(-70, 55, 100, 35, 0xff4444, 0.8)
      .setStrokeStyle(2, 0xff6666)
      .setInteractive({ useHandCursor: true })
    const confirmText = this.add.text(-70, 55, "CONFIRM", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    const cancelBtn = this.add.rectangle(70, 55, 100, 35, 0x444444, 0.8)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(70, 55, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    dialog.add([bg, titleText, msgText, confirmBtn, confirmText, cancelBtn, cancelText])

    confirmBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      dialog.destroy()
      onConfirm()
    })

    cancelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
    })
  }

  testLevel() {
    // Store current state in registry for restoration
    this.saveToRegistry()
    
    // Store level data for test scene
    const levelData = this.generateLevelData()
    this.registry.set("customLevelData", levelData)
    this.scene.start("CustomLevelTestScene")
  }

  /**
   * Enter Sprint Mode - Time trial testing with ghost recording and record setting
   * Features: 3-2-1 countdown, level timer, ghost recording, Any%/100% record tracking
   */
  enterSprintMode() {
    // Store current state in registry for restoration
    this.saveToRegistry()
    
    // Generate level data for sprint mode
    const levelData = this.generateLevelData()
    this.registry.set("customLevelData", levelData)
    
    // Get existing record times from level data or stored records
    const levelId = this.editingBuiltinKey || this.editingLevelId || "custom_level"
    
    // Check for any previously set sprint records
    const anyRecord = this.registry.get("sprintAnyRecord")
    const record100 = this.registry.get("sprint100Record")
    
    // Launch sprint mode with record data
    this.scene.start("SprintModeScene", {
      levelData: levelData,
      levelTitle: this.currentLevelTitle || "Untitled Level",
      levelId: levelId,
      bestAnyTimeMs: this.speedRunAnyTargetMs || (anyRecord?.timeMs) || null,
      best100TimeMs: this.speedRun100TargetMs || (record100?.timeMs) || null,
      targetAnyTimeMs: this.speedRunAnyTargetMs,
      target100TimeMs: this.speedRun100TargetMs,
      bestAnyGhostData: anyRecord?.ghostData || null,
      best100GhostData: record100?.ghostData || null
    })
  }

  saveToRegistry() {
    // Save full designer state to registry
    const designerState = {
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      placedObjects: this.placedObjects.map(obj => {
        const data = {
          type: obj.type,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height
        }
        if (obj.movement) data.movement = obj.movement
        if (obj.facingDirection) data.facingDirection = obj.facingDirection
        return data
      }),
      currentLevelTitle: this.currentLevelTitle,
      currentLevelDescription: this.currentLevelDescription,
      editingLevelId: this.editingLevelId,
      editingBuiltinKey: this.editingBuiltinKey,
      hasUnsavedChanges: this.hasUnsavedChanges,
      levelSoundtrackName: this.levelSoundtrackName,
      levelSoundtrackUrl: this.levelSoundtrackUrl,
      isTutorialLevel: this.isTutorialLevel || false,
      // Style settings for unified rendering
      styleWorld: this.styleWorld,
      stylePreset: this.stylePreset,
      // Speed run targets
      speedRunAnyTargetMs: this.speedRunAnyTargetMs,
      speedRun100TargetMs: this.speedRun100TargetMs,
      // Music track assignment
      assignedTrackId: this.assignedTrackId,
      assignedTrackName: this.assignedTrackName,
      testMusicMode: this.testMusicMode,
      // Background visual settings
      backgroundBrightness: this.backgroundBrightness,
      backgroundContrast: this.backgroundContrast,
      useWorldBackgroundSettings: this.useWorldBackgroundSettings
    }
    this.registry.set("levelDesignerState", designerState)
  }

  restoreFromRegistry() {
    const state = this.registry.get("levelDesignerState")
    if (!state) return

    this.mapWidth = state.mapWidth
    this.mapHeight = state.mapHeight
    this.currentLevelTitle = state.currentLevelTitle || ""
    this.currentLevelDescription = state.currentLevelDescription || ""
    this.editingLevelId = state.editingLevelId || null
    this.editingBuiltinKey = state.editingBuiltinKey || null
    this.hasUnsavedChanges = state.hasUnsavedChanges || false
    this.levelSoundtrackName = state.levelSoundtrackName || null
    this.levelSoundtrackUrl = state.levelSoundtrackUrl || null
    this.isTutorialLevel = state.isTutorialLevel || false
    // Restore style settings
    this.styleWorld = state.styleWorld ?? null
    this.stylePreset = state.stylePreset || "auto"
    // Restore speed run targets
    this.speedRunAnyTargetMs = state.speedRunAnyTargetMs ?? null
    this.speedRun100TargetMs = state.speedRun100TargetMs ?? null
    // Restore music track assignment
    this.assignedTrackId = state.assignedTrackId ?? null
    this.assignedTrackName = state.assignedTrackName ?? null
    this.testMusicMode = state.testMusicMode || "assigned"
    // Restore background visual settings
    this.backgroundBrightness = state.backgroundBrightness ?? 1.0
    this.backgroundContrast = state.backgroundContrast ?? 1.0
    this.useWorldBackgroundSettings = state.useWorldBackgroundSettings ?? true

    // Recreate placed objects
    state.placedObjects.forEach(obj => {
      this.placeObjectFromData(obj)
    })

    this.updateTitleDisplay()
    this.updateUnsavedIndicator()
    this.statusText.setText("Restored from test mode")
    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  placeObjectFromData(objData) {
    const displayScale = this.currentDisplayScale
    const { type, x, y, width, height, movement, facingDirection } = objData

    // Get color based on type using new unified function
    const color = this.getObjectColor(type)
    
    let visual

    // Special handling for spawn with direction indicator
    if (type === "spawn") {
      const visualContainer = this.add.container(
        x * this.gridSize * displayScale + (this.gridSize * displayScale) / 2,
        y * this.gridSize * displayScale + (this.gridSize * displayScale) / 2
      )
      
      // Background rectangle
      const rect = this.add.rectangle(
        0, 0,
        this.gridSize * displayScale - 2,
        this.gridSize * displayScale - 2,
        color,
        0.8
      )
      
      // Direction arrow indicator
      const direction = facingDirection || "right"
      const arrowText = direction === "left" ? "←" : "→"
      const arrow = this.add.text(0, 0, arrowText, {
        fontFamily: "RetroPixel",
        fontSize: `${Math.floor(24 * displayScale)}px`,
        color: "#ffffff"
      }).setOrigin(0.5)
      
      visualContainer.add([rect, arrow])
      this.objectsContainer.add(visualContainer)
      visual = visualContainer
      
      const obj = {
        type,
        x,
        y,
        width,
        height,
        facingDirection: direction,
        visual
      }
      this.placedObjects.push(obj)
      this.updateCollectibleCount()
      return
    }

    // In preview mode, render platforms with actual styled rendering
    if (this.previewMode && type === "platform") {
      // Use PlatformRenderer for WYSIWYG preview
      // Create a container to hold the styled platform
      const platformX = x * this.gridSize * displayScale
      const platformY = y * this.gridSize * displayScale
      const platformWidth = width * this.gridSize
      const platformHeight = height * this.gridSize
      
      // Lazy-init the platform renderer for preview
      if (!this.previewRenderer) {
        this.previewRenderer = new PlatformRenderer(this, this.gridSize)
      }
      
      // Create styled platform at (0, 0) in a container, then position container
      const container = this.add.container(platformX, platformY)
      const palette = this.previewRenderer.getPalette(this.styleWorld)
      
      // Create a scaled-down version for the editor grid
      const styledContainer = this.add.container(0, 0)
      
      // Main platform body (scaled)
      const mainRect = this.add.rectangle(
        (platformWidth * displayScale) / 2, 
        (platformHeight * displayScale) / 2, 
        platformWidth * displayScale - 2, 
        platformHeight * displayScale - 2, 
        palette.platform
      )
      mainRect.setStrokeStyle(2, palette.accent)
      styledContainer.add(mainRect)
      
      // Top highlight
      const topH = this.add.rectangle(
        (platformWidth * displayScale) / 2, 
        4 * displayScale, 
        (platformWidth - 4) * displayScale, 
        6 * displayScale, 
        palette.highlight, 0.7
      )
      styledContainer.add(topH)
      
      // Bottom shadow
      const botH = this.add.rectangle(
        (platformWidth * displayScale) / 2, 
        (platformHeight * displayScale) - 4 * displayScale, 
        (platformWidth - 4) * displayScale, 
        6 * displayScale, 
        palette.dark, 0.7
      )
      styledContainer.add(botH)
      
      container.add(styledContainer)
      this.objectsContainer.add(container)
      visual = container
    } else {
      // Standard block rendering
      const rect = this.add.rectangle(
        x * this.gridSize * displayScale + (width * this.gridSize * displayScale) / 2,
        y * this.gridSize * displayScale + (height * this.gridSize * displayScale) / 2,
        width * this.gridSize * displayScale - 2,
        height * this.gridSize * displayScale - 2,
        color,
        0.8
      )
      this.objectsContainer.add(rect)
      visual = rect
    }

    const obj = {
      type,
      x,
      y,
      width,
      height,
      visual
    }
    
    // Restore movement data if present
    if (movement) {
      obj.movement = movement
    }
    
    this.placedObjects.push(obj)
    this.updateCollectibleCount()
  }

  generateLevelData() {
    const levelData = {
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      title: this.currentLevelTitle || "Untitled Level",
      description: this.currentLevelDescription || "",
      isTutorialLevel: this.isTutorialLevel || false,
      // Style settings for unified rendering (TEST and GAMEPLAY will look IDENTICAL)
      styleWorld: this.styleWorld,
      stylePreset: this.stylePreset || "auto",
      // Speed run target times for medals
      speedRunAnyTargetMs: this.speedRunAnyTargetMs,
      speedRun100TargetMs: this.speedRun100TargetMs,
      // Music track assignment
      assignedTrackId: this.assignedTrackId,
      assignedTrackName: this.assignedTrackName,
      // Test music mode (persisted for returning from test)
      testMusicMode: this.testMusicMode,
      // Background contrast/brightness settings
      backgroundContrast: this.backgroundContrast ?? 1.0,
      backgroundBrightness: this.backgroundBrightness ?? 1.0,
      useWorldBackgroundSettings: this.useWorldBackgroundSettings ?? true,
      objects: this.placedObjects.map(obj => {
        const objData = {
          type: obj.type,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height
        }
        // Include movement data for moving saws
        if (obj.movement) {
          objData.movement = obj.movement
        }
        // Include facing direction for spawn points
        if (obj.facingDirection) {
          objData.facingDirection = obj.facingDirection
        }
        return objData
      })
    }
    
    // Include soundtrack info if set
    if (this.levelSoundtrackUrl) {
      levelData.soundtrack = {
        name: this.levelSoundtrackName,
        url: this.levelSoundtrackUrl
      }
    }
    
    return levelData
  }

  /**
   * Show Level Settings dialog for editing title and tutorial toggle
   * Implements scrollable content within a fixed dialog
   */
  showLevelSettingsDialog() {
    const screenWidth = this.cameras.main.width
    const screenHeight = this.cameras.main.height
    const dialogWidth = 450
    const dialogHeight = Math.min(620, screenHeight - 40) // Fit within screen with padding
    
    // Main dialog container (fixed position)
    const dialog = this.add.container(screenWidth / 2, screenHeight / 2)
    dialog.setDepth(1000)

    // Background
    const bg = this.add.rectangle(0, 0, dialogWidth, dialogHeight, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0xffcc00)

    // Title (fixed, outside scroll area)
    const headerY = -dialogHeight / 2 + 25
    const titleText = this.add.text(0, headerY, "LEVEL SETTINGS", {
      fontFamily: "RetroPixel",
      fontSize: "22px",
      color: "#ffcc00"
    }).setOrigin(0.5)
    
    // Scroll hint
    const scrollHint = this.add.text(0, headerY + 22, "(Scroll for more options)", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0.5)
    
    // Close button (fixed at bottom)
    const closeY = dialogHeight / 2 - 30
    const closeBtn = this.add.rectangle(0, closeY, 120, 35, 0xffcc00, 0.9)
      .setStrokeStyle(2, 0xffdd44)
      .setInteractive({ useHandCursor: true })
    const closeText = this.add.text(0, closeY, "DONE", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#000000"
    }).setOrigin(0.5)
    
    // Wheel scroll handler - store reference for cleanup
    const wheelHandler = (pointer, gameObjects, deltaX, deltaY) => {
      // Check if pointer is within dialog bounds
      const dialogBounds = {
        left: screenWidth / 2 - dialogWidth / 2,
        right: screenWidth / 2 + dialogWidth / 2,
        top: screenHeight / 2 - dialogHeight / 2,
        bottom: screenHeight / 2 + dialogHeight / 2
      }
      if (pointer.x >= dialogBounds.left && pointer.x <= dialogBounds.right &&
          pointer.y >= dialogBounds.top && pointer.y <= dialogBounds.bottom) {
        updateScroll(deltaY * 0.5)
      }
    }
    this.input.on("wheel", wheelHandler)
    
    closeBtn.on("pointerover", () => closeBtn.setFillStyle(0xffdd44))
    closeBtn.on("pointerout", () => closeBtn.setFillStyle(0xffcc00, 0.9))
    closeBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      // Stop audition if one is playing, then restore dev-mode music
      if (BGMManager.currentAudioKey?.startsWith("audition_")) {
        BGMManager.stop()
        BGMManager.playMenuMusic(this, "developer_menu")
      }
      // Clean up wheel listener
      this.input.off("wheel", wheelHandler)
      maskGraphics.destroy()
      dialog.destroy()
      scrollContent.destroy()
    })
    
    // Create scrollable content area
    const scrollAreaTop = headerY + 45
    const scrollAreaBottom = closeY - 20
    const scrollAreaHeight = scrollAreaBottom - scrollAreaTop
    
    // Scroll content container - all scrollable content goes here
    const scrollContent = this.add.container(screenWidth / 2, screenHeight / 2 + scrollAreaTop)
    scrollContent.setDepth(1000)
    
    // Create mask for scroll area
    const maskGraphics = this.make.graphics({ x: 0, y: 0 })
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(
      screenWidth / 2 - dialogWidth / 2 + 10,
      screenHeight / 2 + scrollAreaTop,
      dialogWidth - 20,
      scrollAreaHeight
    )
    const mask = maskGraphics.createGeometryMask()
    scrollContent.setMask(mask)
    
    // Track scroll position
    let scrollY = 0
    const contentHeight = 620 // Will be calculated based on content
    const maxScroll = Math.max(0, contentHeight - scrollAreaHeight)
    
    // Scroll function
    const updateScroll = (delta) => {
      scrollY = Phaser.Math.Clamp(scrollY + delta, 0, maxScroll)
      scrollContent.y = screenHeight / 2 + scrollAreaTop - scrollY
    }
    
    // Make background interactive for scroll detection
    bg.setInteractive()

    // Content Y positions (relative to scroll container, starting from 0)
    let yPos = 15
    
    // Level Title section
    const levelTitleLabel = this.add.text(-180, yPos, "Level Title:", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    const currentTitle = this.currentLevelTitle || "Untitled Level"
    const titleValueBg = this.add.rectangle(60, yPos, 240, 30, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const titleValueText = this.add.text(60, yPos, currentTitle, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)
    
    scrollContent.add([levelTitleLabel, titleValueBg, titleValueText])

    // Click to edit title
    titleValueBg.on("pointerdown", () => {
      const newTitle = prompt("Enter level title:", this.currentLevelTitle || "Untitled Level")
      if (newTitle && newTitle.trim()) {
        this.currentLevelTitle = newTitle.trim()
        titleValueText.setText(this.currentLevelTitle)
        this.hasUnsavedChanges = true
        this.updateTitleDisplay()
        this.updateUnsavedIndicator()
      }
    })
    titleValueBg.on("pointerover", () => titleValueBg.setStrokeStyle(2, 0x00ffff))
    titleValueBg.on("pointerout", () => titleValueBg.setStrokeStyle(2, 0x444466))

    // Level Description section
    yPos += 40
    const descLabel = this.add.text(-180, yPos, "Description:", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    // Initialize description if not set
    if (this.currentLevelDescription === undefined) {
      this.currentLevelDescription = ""
    }

    const currentDesc = this.currentLevelDescription || "(click to add)"
    const descValueBg = this.add.rectangle(60, yPos, 240, 30, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const descValueText = this.add.text(60, yPos, currentDesc.length > 25 ? currentDesc.substring(0, 25) + "..." : currentDesc, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: this.currentLevelDescription ? "#ffffff" : "#666666"
    }).setOrigin(0.5)
    
    scrollContent.add([descLabel, descValueBg, descValueText])

    // Click to edit description
    descValueBg.on("pointerdown", () => {
      const newDesc = prompt("Enter level description:", this.currentLevelDescription || "")
      if (newDesc !== null) {
        this.currentLevelDescription = newDesc.trim()
        const displayText = this.currentLevelDescription || "(click to add)"
        descValueText.setText(displayText.length > 25 ? displayText.substring(0, 25) + "..." : displayText)
        descValueText.setColor(this.currentLevelDescription ? "#ffffff" : "#666666")
        this.hasUnsavedChanges = true
        this.updateUnsavedIndicator()
      }
    })
    descValueBg.on("pointerover", () => descValueBg.setStrokeStyle(2, 0x00ffff))
    descValueBg.on("pointerout", () => descValueBg.setStrokeStyle(2, 0x444466))

    // Tutorial Level toggle section
    yPos += 45
    const tutorialLabel = this.add.text(-180, yPos, "Tutorial Level:", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    const tutorialHint = this.add.text(-180, yPos + 15, "(Adds to Tutorial World)", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0, 0.5)

    // Toggle switch
    const toggleWidth = 60
    const toggleHeight = 28
    const toggleX = 60
    const toggleY = yPos
    
    // Initialize isTutorialLevel if not set
    if (this.isTutorialLevel === undefined) {
      this.isTutorialLevel = false
    }

    const toggleBg = this.add.rectangle(toggleX, toggleY, toggleWidth, toggleHeight, 
      this.isTutorialLevel ? 0x00ff88 : 0x444466)
      .setStrokeStyle(2, this.isTutorialLevel ? 0x44ffaa : 0x666666)
      .setInteractive({ useHandCursor: true })

    const toggleKnob = this.add.circle(
      this.isTutorialLevel ? toggleX + toggleWidth/2 - 12 : toggleX - toggleWidth/2 + 12, 
      toggleY, 10, 0xffffff)

    const toggleText = this.add.text(toggleX + 50, toggleY, this.isTutorialLevel ? "ON" : "OFF", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: this.isTutorialLevel ? "#00ff88" : "#888888"
    }).setOrigin(0, 0.5)
    
    scrollContent.add([tutorialLabel, tutorialHint, toggleBg, toggleKnob, toggleText])

    toggleBg.on("pointerdown", () => {
      this.isTutorialLevel = !this.isTutorialLevel
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
      
      // Animate toggle
      toggleBg.setFillStyle(this.isTutorialLevel ? 0x00ff88 : 0x444466)
      toggleBg.setStrokeStyle(2, this.isTutorialLevel ? 0x44ffaa : 0x666666)
      toggleText.setText(this.isTutorialLevel ? "ON" : "OFF")
      toggleText.setColor(this.isTutorialLevel ? "#00ff88" : "#888888")
      
      this.tweens.add({
        targets: toggleKnob,
        x: this.isTutorialLevel ? toggleX + toggleWidth/2 - 12 : toggleX - toggleWidth/2 + 12,
        duration: 150,
        ease: "Quad.easeOut"
      })
      
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    // Map dimensions display (read-only info)
    yPos += 45
    const dimLabel = this.add.text(-180, yPos, "Map Size:", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    const dimValue = this.add.text(60, yPos, `${this.mapWidth} x ${this.mapHeight} tiles`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5)
    
    scrollContent.add([dimLabel, dimValue])

    // ==========================================
    // STYLE WORLD SELECTOR (Unified Level Architecture)
    // ==========================================
    yPos += 40
    const styleLabel = this.add.text(-180, yPos, "Platform Style:", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    // World names for display
    const worldNames = {
      null: "Auto (Match Dest.)",
      1: "W1: Underground",
      2: "W2: Industrial", 
      3: "W3: Neon",
      4: "W4: Rainy",
      5: "W5: Festival",
      6: "W6: Arctic",
      7: "W7: Corporate",
      8: "W8: Arena",
      9: "W9: Media",
      10: "W10: Contract",
      11: "W11: Psychological",
      12: "W12: Time",
      13: "W13: Glitch",
      14: "W14: Clarity",
      15: "W15: Finale"
    }

    // Style selector display - positioned on same line as label
    const currentStyleText = worldNames[this.styleWorld] || "Auto (Match Dest.)"
    const styleValueBg = this.add.rectangle(60, yPos, 200, 28, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const styleValueText = this.add.text(60, yPos, currentStyleText, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: this.styleWorld ? "#00ff88" : "#888888"
    }).setOrigin(0.5)

    // Decrease world button
    const stylePrevBtn = this.add.text(-55, yPos, "◄", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    // Increase world button
    const styleNextBtn = this.add.text(175, yPos, "►", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    scrollContent.add([styleLabel, styleValueBg, styleValueText, stylePrevBtn, styleNextBtn])

    // Update style display helper
    const updateStyleDisplay = () => {
      const text = worldNames[this.styleWorld] || "Auto (Match Destination)"
      styleValueText.setText(text)
      styleValueText.setColor(this.styleWorld ? "#00ff88" : "#888888")
    }

    stylePrevBtn.on("pointerdown", () => {
      if (this.styleWorld === null) {
        this.styleWorld = 15
      } else if (this.styleWorld === 1) {
        this.styleWorld = null
      } else {
        this.styleWorld--
      }
      updateStyleDisplay()
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    stylePrevBtn.on("pointerover", () => stylePrevBtn.setColor("#ffffff"))
    stylePrevBtn.on("pointerout", () => stylePrevBtn.setColor("#00ffff"))

    styleNextBtn.on("pointerdown", () => {
      if (this.styleWorld === null) {
        this.styleWorld = 1
      } else if (this.styleWorld === 15) {
        this.styleWorld = null
      } else {
        this.styleWorld++
      }
      updateStyleDisplay()
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })
    styleNextBtn.on("pointerover", () => styleNextBtn.setColor("#ffffff"))
    styleNextBtn.on("pointerout", () => styleNextBtn.setColor("#00ffff"))

    // ==========================================
    // SPEED RUN TARGET TIMES
    // ==========================================
    yPos += 45
    const speedRunSectionLabel = this.add.text(0, yPos, "⚡ SPEED RUN TARGETS", {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#ffaa00"
    }).setOrigin(0.5)
    
    scrollContent.add([speedRunSectionLabel])

    // Helper to format time for display
    const formatTimeMs = (ms) => {
      if (ms === null || ms === undefined) return "Not Set"
      const seconds = Math.floor(ms / 1000)
      const milliseconds = ms % 1000
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      if (mins > 0) {
        return `${mins}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
      }
      return `${secs}.${String(milliseconds).padStart(3, '0')}s`
    }

    // Any% Speed Run Target
    yPos += 30
    const anyLabel = this.add.text(-180, yPos, "Any%:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    const anyValueBg = this.add.rectangle(60, yPos, 180, 26, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const anyValueText = this.add.text(60, yPos, formatTimeMs(this.speedRunAnyTargetMs), {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: this.speedRunAnyTargetMs ? "#00ff88" : "#666666"
    }).setOrigin(0.5)
    
    scrollContent.add([anyLabel, anyValueBg, anyValueText])

    // Click to edit Any% target
    anyValueBg.on("pointerdown", () => {
      const currentVal = this.speedRunAnyTargetMs ? (this.speedRunAnyTargetMs / 1000).toFixed(3) : ""
      const input = prompt("Enter Any% target time in seconds (e.g. 45.500):", currentVal)
      if (input !== null) {
        if (input.trim() === "") {
          this.speedRunAnyTargetMs = null
        } else {
          const parsed = parseFloat(input)
          if (!isNaN(parsed) && parsed > 0) {
            this.speedRunAnyTargetMs = Math.round(parsed * 1000)
          }
        }
        anyValueText.setText(formatTimeMs(this.speedRunAnyTargetMs))
        anyValueText.setColor(this.speedRunAnyTargetMs ? "#00ff88" : "#666666")
        this.hasUnsavedChanges = true
        this.updateUnsavedIndicator()
      }
    })
    anyValueBg.on("pointerover", () => anyValueBg.setStrokeStyle(2, 0x00ffff))
    anyValueBg.on("pointerout", () => anyValueBg.setStrokeStyle(2, 0x444466))

    // 100% Speed Run Target
    yPos += 35
    const fullLabel = this.add.text(-180, yPos, "100%:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    const fullValueBg = this.add.rectangle(60, yPos, 180, 26, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const fullValueText = this.add.text(60, yPos, formatTimeMs(this.speedRun100TargetMs), {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: this.speedRun100TargetMs ? "#00ff88" : "#666666"
    }).setOrigin(0.5)
    
    scrollContent.add([fullLabel, fullValueBg, fullValueText])

    // Click to edit 100% target
    fullValueBg.on("pointerdown", () => {
      const currentVal = this.speedRun100TargetMs ? (this.speedRun100TargetMs / 1000).toFixed(3) : ""
      const input = prompt("Enter 100% target time in seconds (e.g. 60.000):", currentVal)
      if (input !== null) {
        if (input.trim() === "") {
          this.speedRun100TargetMs = null
        } else {
          const parsed = parseFloat(input)
          if (!isNaN(parsed) && parsed > 0) {
            this.speedRun100TargetMs = Math.round(parsed * 1000)
          }
        }
        fullValueText.setText(formatTimeMs(this.speedRun100TargetMs))
        fullValueText.setColor(this.speedRun100TargetMs ? "#00ff88" : "#666666")
        this.hasUnsavedChanges = true
        this.updateUnsavedIndicator()
      }
    })
    fullValueBg.on("pointerover", () => fullValueBg.setStrokeStyle(2, 0x00ffff))
    fullValueBg.on("pointerout", () => fullValueBg.setStrokeStyle(2, 0x444466))

    // ==========================================
    // MUSIC TRACK ASSIGNMENT SECTION
    // ==========================================
    yPos += 45
    const musicSectionLabel = this.add.text(0, yPos, "🎵 LEVEL MUSIC", {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    
    scrollContent.add([musicSectionLabel])

    // Music track display
    yPos += 30
    const musicLabel = this.add.text(-180, yPos, "Track:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    const currentTrackName = this.assignedTrackName || "(No track assigned)"
    const musicValueBg = this.add.rectangle(40, yPos, 200, 26, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const musicValueText = this.add.text(40, yPos, currentTrackName.length > 18 ? currentTrackName.substring(0, 18) + "..." : currentTrackName, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: this.assignedTrackId ? "#ff69b4" : "#666666"
    }).setOrigin(0.5)

    // Audition (play) button for assigned track
    const auditionBtn = this.add.text(160, yPos, "▶", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: this.assignedTrackId ? "#00ff88" : "#444444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: this.assignedTrackId ? true : false })

    // Stop audition button
    const stopAuditionBtn = this.add.text(185, yPos, "■", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffaa00"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    scrollContent.add([musicLabel, musicValueBg, musicValueText, auditionBtn, stopAuditionBtn])

    // Click to open track picker
    musicValueBg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.showMusicTrackPicker((trackId, trackName) => {
        this.assignedTrackId = trackId
        this.assignedTrackName = trackName
        const displayName = trackName || "(No track assigned)"
        musicValueText.setText(displayName.length > 18 ? displayName.substring(0, 18) + "..." : displayName)
        musicValueText.setColor(trackId ? "#ff69b4" : "#666666")
        auditionBtn.setColor(trackId ? "#00ff88" : "#444444")
        this.hasUnsavedChanges = true
        this.updateUnsavedIndicator()
      })
    })
    musicValueBg.on("pointerover", () => musicValueBg.setStrokeStyle(2, 0xff69b4))
    musicValueBg.on("pointerout", () => musicValueBg.setStrokeStyle(2, 0x444466))

    auditionBtn.on("pointerdown", () => {
      if (this.assignedTrackId) {
        this.sound.play("ui_select_sound", { volume: 0.2 })
        this.auditionAssignedTrack()
      }
    })
    auditionBtn.on("pointerover", () => {
      if (this.assignedTrackId) auditionBtn.setColor("#ffffff")
    })
    auditionBtn.on("pointerout", () => {
      auditionBtn.setColor(this.assignedTrackId ? "#00ff88" : "#444444")
    })

    stopAuditionBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      BGMManager.stop()
      // Restore dev-mode music after stopping the audition
      BGMManager.playMenuMusic(this, "developer_menu")
    })
    stopAuditionBtn.on("pointerover", () => stopAuditionBtn.setColor("#ffffff"))
    stopAuditionBtn.on("pointerout", () => stopAuditionBtn.setColor("#ffaa00"))

    // Clear track button
    yPos += 28
    const clearTrackBtn = this.add.text(0, yPos, "[CLEAR TRACK]", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#ff6666"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    scrollContent.add([clearTrackBtn])

    clearTrackBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.assignedTrackId = null
      this.assignedTrackName = null
      musicValueText.setText("(No track assigned)")
      musicValueText.setColor("#666666")
      auditionBtn.setColor("#444444")
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
      BGMManager.stop()
      // Restore dev-mode music after clearing
      BGMManager.playMenuMusic(this, "developer_menu")
    })
    clearTrackBtn.on("pointerover", () => clearTrackBtn.setColor("#ffffff"))
    clearTrackBtn.on("pointerout", () => clearTrackBtn.setColor("#ff6666"))

    // ==========================================
    // BACKGROUND VISUAL SETTINGS SECTION
    // ==========================================
    yPos += 40
    const bgSectionLabel = this.add.text(0, yPos, "🎨 BACKGROUND VISUALS", {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#88aaff"
    }).setOrigin(0.5)
    
    scrollContent.add([bgSectionLabel])

    // Brightness slider
    yPos += 30
    const brightnessLabel = this.add.text(-180, yPos, "Brightness:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    // Brightness slider track
    const brightnessTrack = this.add.rectangle(50, yPos, 160, 6, 0x333355)
      .setStrokeStyle(1, 0x444477)

    // Brightness slider knob
    const brightnessValue = Math.round(this.backgroundBrightness * 100)
    const brightnessKnobX = -30 + (this.backgroundBrightness * 160)
    const brightnessKnob = this.add.circle(brightnessKnobX, yPos, 8, 0x88aaff)
      .setInteractive({ useHandCursor: true, draggable: true })

    // Brightness value text
    const brightnessValueText = this.add.text(145, yPos, `${brightnessValue}%`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#88aaff"
    }).setOrigin(0, 0.5)
    
    scrollContent.add([brightnessLabel, brightnessTrack, brightnessKnob, brightnessValueText])

    // Brightness drag handling
    brightnessKnob.on("drag", (pointer, dragX) => {
      const minX = -30
      const maxX = 130
      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX)
      brightnessKnob.x = clampedX
      this.backgroundBrightness = (clampedX - minX) / (maxX - minX)
      brightnessValueText.setText(`${Math.round(this.backgroundBrightness * 100)}%`)
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
    })

    // Contrast slider
    yPos += 30
    const contrastLabel = this.add.text(-180, yPos, "Contrast:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    // Contrast slider track
    const contrastTrack = this.add.rectangle(50, yPos, 160, 6, 0x333355)
      .setStrokeStyle(1, 0x444477)

    // Contrast slider knob
    const contrastValue = Math.round(this.backgroundContrast * 100)
    const contrastKnobX = -30 + (this.backgroundContrast * 160)
    const contrastKnob = this.add.circle(contrastKnobX, yPos, 8, 0x88aaff)
      .setInteractive({ useHandCursor: true, draggable: true })

    // Contrast value text
    const contrastValueText = this.add.text(145, yPos, `${contrastValue}%`, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#88aaff"
    }).setOrigin(0, 0.5)
    
    scrollContent.add([contrastLabel, contrastTrack, contrastKnob, contrastValueText])

    // Contrast drag handling
    contrastKnob.on("drag", (pointer, dragX) => {
      const minX = -30
      const maxX = 130
      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX)
      contrastKnob.x = clampedX
      this.backgroundContrast = (clampedX - minX) / (maxX - minX)
      contrastValueText.setText(`${Math.round(this.backgroundContrast * 100)}%`)
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
    })

    // Use World Settings toggle
    yPos += 35
    const useWorldLabel = this.add.text(-180, yPos, "Use World Settings:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#cccccc"
    }).setOrigin(0, 0.5)

    const useWorldToggleX = 60
    const useWorldToggleBg = this.add.rectangle(useWorldToggleX, yPos, 50, 22, 
      this.useWorldBackgroundSettings ? 0x00ff88 : 0x444466)
      .setStrokeStyle(2, this.useWorldBackgroundSettings ? 0x44ffaa : 0x666666)
      .setInteractive({ useHandCursor: true })

    const useWorldKnob = this.add.circle(
      this.useWorldBackgroundSettings ? useWorldToggleX + 14 : useWorldToggleX - 14, 
      yPos, 7, 0xffffff)

    const useWorldText = this.add.text(100, yPos, this.useWorldBackgroundSettings ? "ON" : "OFF", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: this.useWorldBackgroundSettings ? "#00ff88" : "#888888"
    }).setOrigin(0, 0.5)
    
    scrollContent.add([useWorldLabel, useWorldToggleBg, useWorldKnob, useWorldText])

    useWorldToggleBg.on("pointerdown", () => {
      this.useWorldBackgroundSettings = !this.useWorldBackgroundSettings
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
      
      useWorldToggleBg.setFillStyle(this.useWorldBackgroundSettings ? 0x00ff88 : 0x444466)
      useWorldToggleBg.setStrokeStyle(2, this.useWorldBackgroundSettings ? 0x44ffaa : 0x666666)
      useWorldText.setText(this.useWorldBackgroundSettings ? "ON" : "OFF")
      useWorldText.setColor(this.useWorldBackgroundSettings ? "#00ff88" : "#888888")
      
      this.tweens.add({
        targets: useWorldKnob,
        x: this.useWorldBackgroundSettings ? useWorldToggleX + 14 : useWorldToggleX - 14,
        duration: 150,
        ease: "Quad.easeOut"
      })
      
      // Enable/disable sliders based on toggle
      const sliderAlpha = this.useWorldBackgroundSettings ? 0.4 : 1
      brightnessKnob.setAlpha(sliderAlpha)
      contrastKnob.setAlpha(sliderAlpha)
      brightnessValueText.setAlpha(sliderAlpha)
      contrastValueText.setAlpha(sliderAlpha)
      
      this.sound.play("ui_select_sound", { volume: 0.2 })
    })

    // Set initial slider opacity based on toggle state
    if (this.useWorldBackgroundSettings) {
      brightnessKnob.setAlpha(0.4)
      contrastKnob.setAlpha(0.4)
      brightnessValueText.setAlpha(0.4)
      contrastValueText.setAlpha(0.4)
    }

    // Apply to World button
    yPos += 40
    const applyWorldBtn = this.add.rectangle(0, yPos, 180, 26, 0x6666aa, 0.8)
      .setStrokeStyle(2, 0x8888cc)
      .setInteractive({ useHandCursor: true })
    
    const applyWorldText = this.add.text(0, yPos, "APPLY TO WORLD", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#ffffff"
    }).setOrigin(0.5)
    
    scrollContent.add([applyWorldBtn, applyWorldText])

    applyWorldBtn.on("pointerover", () => applyWorldBtn.setStrokeStyle(2, 0xffffff))
    applyWorldBtn.on("pointerout", () => applyWorldBtn.setStrokeStyle(2, 0x8888cc))
    applyWorldBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.showApplyToWorldConfirmation()
    })
    
    // Add scroll indicator at bottom if content overflows
    yPos += 30 // Final content height marker
    
    // Add fixed elements to dialog (not scrollable)
    dialog.add([bg, titleText, scrollHint, closeBtn, closeText])
  }

  /**
   * Show confirmation dialog for applying background settings to all levels in world
   */
  showApplyToWorldConfirmation() {
    const worldNum = this.styleWorld || this.extractWorldFromLevelId()
    if (!worldNum) {
      this.showStatusMessage("No world selected - set Platform Style first", "#ff6666")
      return
    }

    const confirmDialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    confirmDialog.setDepth(1100)

    const confirmBg = this.add.rectangle(0, 0, 400, 220, 0x0a0a1a, 0.98)
      .setStrokeStyle(3, 0xffaa00)

    const confirmTitle = this.add.text(0, -80, "⚠️ APPLY TO WORLD?", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ffaa00"
    }).setOrigin(0.5)

    const confirmText = this.add.text(0, -30, 
      `This will apply these background settings\nto ALL levels in World ${worldNum}.\n\nBrightness: ${Math.round(this.backgroundBrightness * 100)}%\nContrast: ${Math.round(this.backgroundContrast * 100)}%`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#cccccc",
      align: "center"
    }).setOrigin(0.5)

    const yesBtn = this.add.rectangle(-70, 70, 100, 35, 0x00ff88, 0.9)
      .setStrokeStyle(2, 0x44ffaa)
      .setInteractive({ useHandCursor: true })
    const yesText = this.add.text(-70, 70, "YES", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#000000"
    }).setOrigin(0.5)

    const noBtn = this.add.rectangle(70, 70, 100, 35, 0xff6666, 0.9)
      .setStrokeStyle(2, 0xff8888)
      .setInteractive({ useHandCursor: true })
    const noText = this.add.text(70, 70, "NO", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#000000"
    }).setOrigin(0.5)

    confirmDialog.add([confirmBg, confirmTitle, confirmText, yesBtn, yesText, noBtn, noText])

    yesBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.applyBackgroundSettingsToWorld(worldNum)
      confirmDialog.destroy()
    })

    noBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      confirmDialog.destroy()
    })
  }

  /**
   * Apply current background settings to all levels in a world
   */
  async applyBackgroundSettingsToWorld(worldNum) {
    try {
      // Import supabase client
      const { supabase } = await import("./integrations/supabase/client.js")
      
      // Update world_metadata with background settings
      const { error } = await supabase
        .from("world_metadata")
        .update({
          background_brightness: this.backgroundBrightness,
          background_contrast: this.backgroundContrast
        })
        .eq("world_number", worldNum)

      if (error) throw error

      this.showStatusMessage(`Background settings applied to World ${worldNum}!`, "#00ff88")
    } catch (e) {
      console.error("[LevelDesigner] Failed to apply world settings:", e)
      this.showStatusMessage("Failed to apply settings - check console", "#ff6666")
    }
  }

  /**
   * Extract world number from current level ID
   */
  extractWorldFromLevelId() {
    const levelId = this.loadWorldTourLevel || this.editingLevelId
    if (!levelId) return null
    
    const match = levelId.match(/W(\d+)/)
    return match ? parseInt(match[1]) : null
  }

  /**
   * Show music track picker dialog to select a track for the level
   * Uses the new TrackPickerModal with real-time search and scroll
   * @param {function} onSelect - Callback with (trackId, trackName) when track is selected
   */
  async showMusicTrackPicker(onSelect) {
    // Import TrackPickerModal
    const { TrackPickerModal } = await import("./TrackPickerModal.js")

    const picker = new TrackPickerModal(this, {
      title: "SELECT MUSIC TRACK",
      subtitle: `For: ${this.currentLevelTitle || "Current Level"}`,
      currentTrackId: this.assignedTrackId,
      depth: 1001, // Above level settings dialog
      onSelect: (track) => {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        onSelect(track.id, track.name)
      },
      onCancel: () => {
        this.sound.play("ui_select_sound", { volume: 0.2 })
      },
      onUpload: () => {
        // Go to Track Manager
        this.scene.start("TrackUploaderScene")
      }
    })

    await picker.open()
  }

  /**
   * Audition the currently assigned track
   */
  async auditionAssignedTrack() {
    if (!this.assignedTrackId) return
    
    // Ensure Supabase music manager is initialized
    if (!SupabaseMusicManager.isInitialized) {
      await SupabaseMusicManager.initialize()
    }
    
    const track = SupabaseMusicManager.getTrack(this.assignedTrackId)
    if (track && track.fileUrl) {
      BGMManager.playMusic(this, `audition_${track.id}`, track.fileUrl, true)
      this.statusText.setText(`Now playing: ${track.name}`)
    } else {
      this.statusText.setText("Track not found or no audio URL")
    }
  }

  showSaveDialog() {
    // Get current/source level ID
    const sourceLevelId = this.loadWorldTourLevel || this.editingLevelId || null
    const isWorldTourSource = sourceLevelId && this.isWorldTourLevelId(sourceLevelId)
    
    // Default title based on current state
    let defaultTitle = this.currentLevelTitle || `Level ${SavedLevelsManager.getNextLevelNumber()}`
    if (this.editingBuiltinKey) {
      const metadata = LEVEL_METADATA[this.editingBuiltinKey]
      defaultTitle = metadata?.name || this.editingBuiltinKey
    }

    // Build the publish dialog with destination selection
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 500, 320, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0x00ffff)

    const titleText = this.add.text(0, -130, "PUBLISH LEVEL", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#00ffff"
    }).setOrigin(0.5)

    // Source info display
    const sourceLabel = this.add.text(-220, -95, "Source:", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    })
    const sourceValue = this.add.text(-170, -95, sourceLevelId || "New Level", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffaa00"
    })

    // Level Title Section
    const titleLabel = this.add.text(-220, -60, "Level Title:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#cccccc"
    })
    
    const titleInputBg = this.add.rectangle(30, -60, 280, 28, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const titleInputText = this.add.text(30, -60, defaultTitle, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5)

    // Track current title value
    let currentTitle = defaultTitle

    titleInputBg.on("pointerdown", () => {
      const newTitle = prompt("Enter level title:", currentTitle)
      if (newTitle && newTitle.trim()) {
        currentTitle = newTitle.trim()
        titleInputText.setText(currentTitle.length > 25 ? currentTitle.substring(0, 25) + "..." : currentTitle)
      }
    })

    // Destination Section
    const destLabel = this.add.text(-220, -15, "Destination:", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#cccccc"
    })

    // Track selected destination
    let selectedDestination = sourceLevelId || "NEW"

    const destInputBg = this.add.rectangle(30, -15, 280, 28, 0x1a1a2e)
      .setStrokeStyle(2, 0x444466)
      .setInteractive({ useHandCursor: true })
    
    const destInputText = this.add.text(30, -15, selectedDestination === "NEW" ? "Save as New Level" : selectedDestination, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: selectedDestination === sourceLevelId ? "#00ff88" : "#ff69b4"
    }).setOrigin(0.5)

    // Click to show destination selector
    destInputBg.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.showDestinationSelector(dialog, sourceLevelId, (newDest) => {
        selectedDestination = newDest
        if (newDest === "NEW") {
          destInputText.setText("Save as New Level")
          destInputText.setColor("#ff69b4")
        } else {
          destInputText.setText(newDest)
          destInputText.setColor(newDest === sourceLevelId ? "#00ff88" : "#ff69b4")
        }
      })
    })

    // Quick destination buttons for World Tour levels
    const quickDestY = 35
    const quickDestLabel = this.add.text(-220, quickDestY, "Quick Select:", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    })

    // Same as Source button (if we have a source)
    const sameBtn = this.add.rectangle(-120, quickDestY + 25, 90, 24, sourceLevelId ? 0x00aa66 : 0x333333, 0.8)
      .setStrokeStyle(1, sourceLevelId ? 0x00ff88 : 0x444444)
      .setInteractive({ useHandCursor: sourceLevelId ? true : false })
    const sameText = this.add.text(-120, quickDestY + 25, "SAME", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: sourceLevelId ? "#ffffff" : "#666666"
    }).setOrigin(0.5)

    if (sourceLevelId) {
      sameBtn.on("pointerdown", () => {
        this.sound.play("ui_select_sound", { volume: 0.2 })
        selectedDestination = sourceLevelId
        destInputText.setText(sourceLevelId)
        destInputText.setColor("#00ff88")
      })
    }

    // New Level button
    const newBtn = this.add.rectangle(0, quickDestY + 25, 90, 24, 0x663399, 0.8)
      .setStrokeStyle(1, 0x9966cc)
      .setInteractive({ useHandCursor: true })
    const newText = this.add.text(0, quickDestY + 25, "NEW", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffffff"
    }).setOrigin(0.5)

    newBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      selectedDestination = "NEW"
      destInputText.setText("Save as New Level")
      destInputText.setColor("#ff69b4")
    })

    // Browse button (opens full selector)
    const browseBtn = this.add.rectangle(120, quickDestY + 25, 90, 24, 0x336699, 0.8)
      .setStrokeStyle(1, 0x6699cc)
      .setInteractive({ useHandCursor: true })
    const browseText = this.add.text(120, quickDestY + 25, "BROWSE...", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffffff"
    }).setOrigin(0.5)

    browseBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.showDestinationSelector(dialog, sourceLevelId, (newDest) => {
        selectedDestination = newDest
        if (newDest === "NEW") {
          destInputText.setText("Save as New Level")
          destInputText.setColor("#ff69b4")
        } else {
          destInputText.setText(newDest)
          destInputText.setColor(newDest === sourceLevelId ? "#00ff88" : "#ff69b4")
        }
      })
    })

    // Warning text (shows when destination differs from source)
    const warningText = this.add.text(0, 95, "", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffaa00"
    }).setOrigin(0.5)

    // Update warning when destination changes
    const updateWarning = () => {
      if (selectedDestination !== "NEW" && selectedDestination !== sourceLevelId) {
        warningText.setText("⚠ Will overwrite existing data in destination level")
      } else if (selectedDestination === "NEW" && sourceLevelId) {
        warningText.setText("ℹ Source level will remain unchanged")
      } else {
        warningText.setText("")
      }
    }

    // Action buttons
    const publishBtn = this.add.rectangle(-80, 130, 120, 40, 0x00ffff, 0.9)
      .setStrokeStyle(2, 0x44ffff)
      .setInteractive({ useHandCursor: true })
    const publishText = this.add.text(-80, 130, "PUBLISH", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#000000"
    }).setOrigin(0.5)

    const cancelBtn = this.add.rectangle(80, 130, 120, 40, 0x444444, 0.8)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(80, 130, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5)

    dialog.add([
      bg, titleText, 
      sourceLabel, sourceValue,
      titleLabel, titleInputBg, titleInputText,
      destLabel, destInputBg, destInputText,
      quickDestLabel, sameBtn, sameText, newBtn, newText, browseBtn, browseText,
      warningText,
      publishBtn, publishText, cancelBtn, cancelText
    ])

    // Publish button handler
    publishBtn.on("pointerdown", async () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      
      // Update current title
      this.currentLevelTitle = currentTitle

      // If saving to a different World Tour level, show confirmation
      if (selectedDestination !== "NEW" && 
          this.isWorldTourLevelId(selectedDestination) && 
          selectedDestination !== sourceLevelId) {
        dialog.destroy()
        this.showOverwriteConfirmation(selectedDestination, currentTitle, async () => {
          await this.performSaveToDestination(currentTitle, selectedDestination)
        })
      } else {
        dialog.destroy()
        await this.performSaveToDestination(currentTitle, selectedDestination)
      }
    })

    cancelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
    })

    // Initial warning update
    updateWarning()

    // Poll for warning updates (simple approach since we can't easily observe changes)
    const warningTimer = this.time.addEvent({
      delay: 100,
      callback: updateWarning,
      loop: true
    })

    // Clean up timer when dialog is destroyed
    dialog.once("destroy", () => {
      warningTimer.destroy()
    })
  }

  /**
   * Show destination level selector dialog
   */
  showDestinationSelector(parentDialog, sourceLevelId, onSelect) {
    const selector = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    selector.setDepth(1001)

    const bg = this.add.rectangle(0, 0, 600, 450, 0x0a0a1a, 0.99)
      .setStrokeStyle(2, 0xff69b4)

    const titleText = this.add.text(0, -200, "SELECT DESTINATION LEVEL", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff69b4"
    }).setOrigin(0.5)

    const instructionText = this.add.text(0, -175, "Choose where to publish this level data", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)

    selector.add([bg, titleText, instructionText])

    // World selector tabs
    const worldTabsY = -145
    const worldTabs = []
    
    // Tutorial tab
    const tutorialTab = this.add.text(-270, worldTabsY, "TUT", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#00ffff",
      backgroundColor: "#1a1a2e",
      padding: { x: 4, y: 2 }
    }).setInteractive({ useHandCursor: true })
    worldTabs.push({ tab: tutorialTab, world: 0 })
    selector.add(tutorialTab)

    // World tabs (1-15)
    for (let w = 1; w <= 15; w++) {
      const tab = this.add.text(-270 + (w * 35), worldTabsY, `W${w}`, {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#aaaaaa",
        backgroundColor: "#1a1a2e",
        padding: { x: 4, y: 2 }
      }).setInteractive({ useHandCursor: true })
      worldTabs.push({ tab, world: w })
      selector.add(tab)
    }

    // Level list container
    const listContainer = this.add.container(0, 30)
    selector.add(listContainer)

    let selectedWorld = sourceLevelId ? (parseLevelId(sourceLevelId)?.world || 1) : 1
    if (sourceLevelId === "Tutorial") selectedWorld = 0

    const renderWorldLevels = (worldNum) => {
      listContainer.removeAll(true)
      
      // Highlight selected tab
      worldTabs.forEach(({ tab, world }) => {
        tab.setColor(world === worldNum ? "#00ffff" : "#aaaaaa")
      })

      if (worldNum === 0) {
        // Tutorial level only
        const levelBtn = this.createLevelButton("Tutorial", sourceLevelId === "Tutorial", -200, 0)
        levelBtn.on("pointerdown", () => {
          this.sound.play("ui_select_sound", { volume: 0.2 })
          onSelect("Tutorial")
          selector.destroy()
        })
        listContainer.add(levelBtn)
        return
      }

      // Normal levels (1-14)
      const normalLabel = this.add.text(-270, -100, "Normal Levels:", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#888888"
      })
      listContainer.add(normalLabel)

      for (let i = 1; i <= 14; i++) {
        const levelId = getLevelId(worldNum, i, LEVEL_TYPES.NORMAL)
        const col = (i - 1) % 7
        const row = Math.floor((i - 1) / 7)
        const x = -240 + (col * 75)
        const y = -75 + (row * 35)
        
        const levelBtn = this.createLevelButton(levelId, levelId === sourceLevelId, x, y)
        levelBtn.on("pointerdown", () => {
          this.sound.play("ui_select_sound", { volume: 0.2 })
          onSelect(levelId)
          selector.destroy()
        })
        listContainer.add(levelBtn)
      }

      // Bonus levels (B1-B5)
      const bonusLabel = this.add.text(-270, 10, "Bonus Levels:", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#888888"
      })
      listContainer.add(bonusLabel)

      for (let i = 1; i <= 5; i++) {
        const levelId = getLevelId(worldNum, i, LEVEL_TYPES.BONUS)
        const x = -240 + ((i - 1) * 75)
        const y = 35
        
        const levelBtn = this.createLevelButton(levelId, levelId === sourceLevelId, x, y, 0xffaa00)
        levelBtn.on("pointerdown", () => {
          this.sound.play("ui_select_sound", { volume: 0.2 })
          onSelect(levelId)
          selector.destroy()
        })
        listContainer.add(levelBtn)
      }

      // Boss level
      const bossLabel = this.add.text(-270, 80, "Boss:", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#888888"
      })
      listContainer.add(bossLabel)

      const bossId = getLevelId(worldNum, 0, LEVEL_TYPES.BOSS)
      const bossBtn = this.createLevelButton(bossId, bossId === sourceLevelId, -240, 105, 0xff4444)
      bossBtn.on("pointerdown", () => {
        this.sound.play("ui_select_sound", { volume: 0.2 })
        onSelect(bossId)
        selector.destroy()
      })
      listContainer.add(bossBtn)
    }

    // Tab click handlers
    worldTabs.forEach(({ tab, world }) => {
      tab.on("pointerdown", () => {
        this.sound.play("ui_select_sound", { volume: 0.2 })
        selectedWorld = world
        renderWorldLevels(world)
      })
    })

    // New Level option at bottom
    const newLevelBtn = this.add.rectangle(0, 175, 200, 35, 0x663399, 0.9)
      .setStrokeStyle(2, 0x9966cc)
      .setInteractive({ useHandCursor: true })
    const newLevelText = this.add.text(0, 175, "SAVE AS NEW LEVEL", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5)
    selector.add([newLevelBtn, newLevelText])

    newLevelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      onSelect("NEW")
      selector.destroy()
    })

    // Cancel button
    const cancelBtn = this.add.rectangle(220, 175, 80, 35, 0x444444, 0.8)
      .setStrokeStyle(1, 0x666666)
      .setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(220, 175, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5)
    selector.add([cancelBtn, cancelText])

    cancelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      selector.destroy()
    })

    // Render initial world
    renderWorldLevels(selectedWorld)
  }

  /**
   * Create a level button for the destination selector
   */
  createLevelButton(levelId, isSource, x, y, baseColor = 0x00ffff) {
    const container = this.add.container(x, y)
    
    const shortId = levelId.replace("W", "").replace("L", "-").replace("B", "B").replace("BOSS", "★")
    const displayText = levelId === "Tutorial" ? "Tutorial" : shortId
    
    const btnColor = isSource ? 0x00ff88 : baseColor
    const bg = this.add.rectangle(0, 0, 68, 28, 0x1a1a2e, 0.9)
      .setStrokeStyle(isSource ? 2 : 1, btnColor)
      .setInteractive({ useHandCursor: true })
    
    const text = this.add.text(0, 0, displayText, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: isSource ? "#00ff88" : "#ffffff"
    }).setOrigin(0.5)

    container.add([bg, text])
    
    // Make container interactive via bg
    bg.on("pointerover", () => {
      bg.setFillStyle(0x2a2a4e, 0.9)
    })
    bg.on("pointerout", () => {
      bg.setFillStyle(0x1a1a2e, 0.9)
    })

    // Forward pointer events to container
    container.on = bg.on.bind(bg)

    return container
  }

  /**
   * Show overwrite confirmation dialog
   */
  showOverwriteConfirmation(destinationId, title, onConfirm) {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1002)

    const bg = this.add.rectangle(0, 0, 450, 200, 0x1a0a0a, 0.98)
      .setStrokeStyle(3, 0xff6600)

    const warningIcon = this.add.text(0, -70, "⚠️", {
      fontSize: "32px"
    }).setOrigin(0.5)

    const titleText = this.add.text(0, -35, "OVERWRITE EXISTING LEVEL?", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#ff6600"
    }).setOrigin(0.5)

    const messageText = this.add.text(0, 5, `This will replace all data in ${destinationId}\nwith "${title}". This cannot be undone.`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#cccccc",
      align: "center"
    }).setOrigin(0.5)

    const confirmBtn = this.add.rectangle(-80, 65, 130, 40, 0xff4400, 0.9)
      .setStrokeStyle(2, 0xff6600)
      .setInteractive({ useHandCursor: true })
    const confirmText = this.add.text(-80, 65, "OVERWRITE", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    const cancelBtn = this.add.rectangle(80, 65, 130, 40, 0x444444, 0.8)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(80, 65, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    dialog.add([bg, warningIcon, titleText, messageText, confirmBtn, confirmText, cancelBtn, cancelText])

    confirmBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      dialog.destroy()
      onConfirm()
    })

    cancelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
      // Re-show save dialog
      this.showSaveDialog()
    })
  }

  /**
   * Perform save to the specified destination
   */
  async performSaveToDestination(title, destination) {
    // Validate collectibles before saving
    const levelType = destination !== "NEW" && this.isWorldTourLevelId(destination) 
      ? (parseLevelId(destination)?.type || 'normal')
      : this.determineLevelType()
    const bonusLevelNum = destination !== "NEW" && this.isWorldTourLevelId(destination)
      ? (parseLevelId(destination)?.type === LEVEL_TYPES.BONUS ? parseLevelId(destination)?.level : null)
      : this.getBonusLevelNum()
    
    const validation = validateLevelCollectibles(this.placedObjects, levelType, bonusLevelNum)
    
    // If there are errors, show them and don't save
    if (!validation.valid) {
      this.showValidationErrors(validation.errors, validation.warnings)
      return
    }
    
    // If there are warnings, show them but allow save to proceed
    if (validation.warnings.length > 0) {
      this.showValidationWarnings(validation.warnings)
    }

    const levelData = this.generateLevelData()
    this.currentLevelTitle = title

    // Handle World Tour level destination
    if (destination !== "NEW" && this.isWorldTourLevelId(destination)) {
      // Update our editing references to point to the new destination
      this.loadWorldTourLevel = destination
      this.editingLevelId = destination
      await this.saveToWorldTourLevel(destination, levelData)
      return
    }

    // Handle non-World Tour saves (NEW or existing custom level)
    if (destination === "NEW" || !this.editingLevelId) {
      // Save as new level (async - saves to Supabase)
      const saved = await SavedLevelsManager.saveLevel(title, levelData)
      this.editingLevelId = saved.id
      this.loadWorldTourLevel = null
      this.currentLevelTitle = title
      this.statusText.setText(`Saved "${title}" as Level #${saved.levelNumber}!`)
      this.showSaveToast(`Saved to database`)
    } else if (this.editingBuiltinKey) {
      // Save as built-in level override
      SavedLevelsManager.saveBuiltinOverride(this.editingBuiltinKey, levelData)
      this.statusText.setText(`Saved override for ${title}!`)
      this.showSaveToast(`Saved to saved-levels.json`)
    } else if (this.editingLevelId) {
      // Update existing saved level (async - saves to Supabase)
      await SavedLevelsManager.updateLevel(this.editingLevelId, { title, data: levelData })
      this.currentLevelTitle = title
      this.statusText.setText(`Updated "${title}"!`)
      this.showSaveToast(`Saved to database`)
    }

    this.hasUnsavedChanges = false
    this.updateTitleDisplay()
    this.updateUnsavedIndicator()
    this.sound.play("ui_confirm_sound", { volume: 0.3 })

    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  async performSave(title) {
    // Validate collectibles before saving
    const levelType = this.determineLevelType()
    const bonusLevelNum = this.getBonusLevelNum()
    const validation = validateLevelCollectibles(this.placedObjects, levelType, bonusLevelNum)
    
    // If there are errors, show them and don't save
    if (!validation.valid) {
      this.showValidationErrors(validation.errors, validation.warnings)
      return
    }
    
    // If there are warnings, show them but allow save to proceed
    if (validation.warnings.length > 0) {
      this.showValidationWarnings(validation.warnings)
    }

    const levelData = this.generateLevelData()

    // Check if we're editing a World Tour level (301 levels from WorldManager)
    if (this.loadWorldTourLevel || this.isWorldTourLevelId(this.editingLevelId)) {
      await this.saveToWorldTourLevel(this.loadWorldTourLevel || this.editingLevelId, levelData)
      return
    }

    if (this.editingBuiltinKey) {
      // Save as built-in level override
      SavedLevelsManager.saveBuiltinOverride(this.editingBuiltinKey, levelData)
      this.statusText.setText(`Saved override for ${title}!`)
      this.showSaveToast(`Saved to saved-levels.json`)
    } else if (this.editingLevelId) {
      // Update existing saved level (async - saves to Supabase)
      await SavedLevelsManager.updateLevel(this.editingLevelId, { title, data: levelData })
      this.currentLevelTitle = title
      this.statusText.setText(`Updated "${title}"!`)
      this.showSaveToast(`Saved to database`)
    } else {
      // Save as new level (async - saves to Supabase)
      const saved = await SavedLevelsManager.saveLevel(title, levelData)
      this.editingLevelId = saved.id
      this.currentLevelTitle = title
      this.statusText.setText(`Saved "${title}" as Level #${saved.levelNumber}!`)
      this.showSaveToast(`Saved to database`)
    }

    this.hasUnsavedChanges = false
    this.updateTitleDisplay()
    this.updateUnsavedIndicator()
    this.sound.play("ui_confirm_sound", { volume: 0.3 })

    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Determine the level type based on what we're editing
   */
  determineLevelType() {
    const levelId = this.loadWorldTourLevel || this.editingLevelId
    if (levelId && this.isWorldTourLevelId(levelId)) {
      const parsed = parseLevelId(levelId)
      if (parsed) {
        return parsed.type // 'normal', 'bonus', or 'boss'
      }
    }
    return 'normal'
  }

  /**
   * Get bonus level number if editing a bonus level
   */
  getBonusLevelNum() {
    const levelId = this.loadWorldTourLevel || this.editingLevelId
    if (levelId && this.isWorldTourLevelId(levelId)) {
      const parsed = parseLevelId(levelId)
      if (parsed && parsed.type === LEVEL_TYPES.BONUS) {
        return parsed.level
      }
    }
    return null
  }

  /**
   * Show validation errors dialog
   */
  showValidationErrors(errors, warnings) {
    this.sound.play("death_sound", { volume: 0.3 })
    
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)
    
    const totalLines = errors.length + warnings.length + 2
    const dialogHeight = Math.max(200, 80 + totalLines * 22)
    
    const bg = this.add.rectangle(0, 0, 500, dialogHeight, 0x1a0a0a, 0.98)
      .setStrokeStyle(3, 0xff4444)
    
    const titleText = this.add.text(0, -dialogHeight/2 + 30, "⚠ CANNOT SAVE - MISSING COLLECTIBLES", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#ff4444"
    }).setOrigin(0.5)
    
    let y = -dialogHeight/2 + 60
    
    // Show errors
    errors.forEach(err => {
      const errText = this.add.text(-220, y, `✗ ${err}`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ff6666"
      })
      dialog.add(errText)
      y += 22
    })
    
    // Show warnings
    warnings.forEach(warn => {
      const warnText = this.add.text(-220, y, `⚡ ${warn}`, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ffaa00"
      })
      dialog.add(warnText)
      y += 22
    })
    
    const closeBtn = this.add.rectangle(0, dialogHeight/2 - 30, 100, 30, 0x444444)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const closeText = this.add.text(0, dialogHeight/2 - 30, "OK", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)
    
    dialog.add([bg, titleText, closeBtn, closeText])
    
    closeBtn.on("pointerdown", () => {
      dialog.destroy()
    })
  }

  /**
   * Show validation warnings (level will still save)
   */
  showValidationWarnings(warnings) {
    // Show brief warning toast
    const toast = this.add.container(this.cameras.main.width / 2, 120)
    toast.setDepth(1000)
    
    const bg = this.add.rectangle(0, 0, 400, 60, 0x2a2a0a, 0.95)
      .setStrokeStyle(2, 0xffaa00)
    
    const text = this.add.text(0, 0, `⚡ ${warnings.join(" | ")}`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffaa00",
      wordWrap: { width: 380 }
    }).setOrigin(0.5)
    
    toast.add([bg, text])
    
    this.tweens.add({
      targets: toast,
      alpha: 0,
      duration: 500,
      delay: 3000,
      onComplete: () => toast.destroy()
    })
  }

  /**
   * Show a brief success toast message for file saves
   */
  showSaveToast(message) {
    const toast = this.add.container(this.cameras.main.width / 2, 80)
    toast.setDepth(1000)
    
    const bg = this.add.rectangle(0, 0, 350, 40, 0x0a2a0a, 0.95)
      .setStrokeStyle(2, 0x00ff88)
    
    const text = this.add.text(0, 0, `✓ ${message}`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#00ff88"
    }).setOrigin(0.5)
    
    toast.add([bg, text])
    
    // Fade in
    toast.setAlpha(0)
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        // Then fade out after delay
        this.tweens.add({
          targets: toast,
          alpha: 0,
          duration: 500,
          delay: 2500,
          onComplete: () => toast.destroy()
        })
      }
    })
  }

  /**
   * Check if a level ID is a World Tour level (from the 301 level system)
   */
  isWorldTourLevelId(levelId) {
    if (!levelId) return false
    if (levelId === "Tutorial") return true
    // World Tour levels have format W{n}L{n}, W{n}B{n}, or W{n}BOSS
    return /^W\d+(L\d+|B\d+|BOSS)$/.test(levelId)
  }

  /**
   * Save the current editor state to a World Tour level
   * This PUBLISHES the level directly to the codebase (src/levels/*.js)
   */
  async saveToWorldTourLevel(levelId, editorLevelData) {
    // Ensure LevelDataManager is initialized before saving
    await LevelDataManager.waitForReady()
    
    // Convert editor format to LevelDataManager format
    const gridSize = 64
    const worldLevelData = LevelDataManager.getLevel(levelId) || {}
    
    // Update settings
    worldLevelData.settings = worldLevelData.settings || {}
    worldLevelData.settings.width = this.mapWidth * gridSize
    worldLevelData.settings.height = this.mapHeight * gridSize
    
    // Preserve version and ensure metadata exists
    worldLevelData.version = worldLevelData.version || 1
    worldLevelData.metadata = worldLevelData.metadata || {}
    worldLevelData.metadata.name = this.currentLevelTitle || levelId
    worldLevelData.metadata.description = this.currentLevelDescription || ""
    worldLevelData.metadata.modified = Date.now()
    worldLevelData.metadata.isTutorialLevel = this.isTutorialLevel || false  // Include tutorial flag
    if (!worldLevelData.metadata.created) {
      worldLevelData.metadata.created = Date.now()
    }
    
    // Convert objects to proper format
    worldLevelData.platforms = []
    worldLevelData.hazards = []
    worldLevelData.fragments = []
    worldLevelData.spawn = { x: 100, y: 600 }
    worldLevelData.goal = { x: 1800, y: 600 }
    worldLevelData.layers = worldLevelData.layers || {
      background: [],
      terrain: [],
      hazards: [],
      decoration: [],
      foreground: []
    }
    worldLevelData.movingPlatforms = worldLevelData.movingPlatforms || []
    worldLevelData.checkpoints = worldLevelData.checkpoints || []
    worldLevelData.objects = worldLevelData.objects || []
    worldLevelData.enemies = worldLevelData.enemies || []
    worldLevelData.triggers = worldLevelData.triggers || []
    
    editorLevelData.objects.forEach(obj => {
      const x = obj.x * gridSize
      const y = obj.y * gridSize
      const width = obj.width * gridSize
      const height = obj.height * gridSize
      const tileW = obj.width || 1
      const tileH = obj.height || 1
      
      switch (obj.type) {
        case "platform":
          worldLevelData.platforms.push({ x, y, width, height, type: "solid" })
          break
        case "spike":
          // Expand multi-tile spike blocks into individual per-tile entries
          for (let dy = 0; dy < tileH; dy++) {
            for (let dx = 0; dx < tileW; dx++) {
              worldLevelData.hazards.push({ type: "spike", x: x + dx * gridSize, y: y + dy * gridSize })
            }
          }
          break
        case "saw":
          // Expand multi-tile saw blocks into individual per-tile entries
          for (let dy = 0; dy < tileH; dy++) {
            for (let dx = 0; dx < tileW; dx++) {
              worldLevelData.hazards.push({ type: "saw", x: x + dx * gridSize, y: y + dy * gridSize })
            }
          }
          break
        case "saw_h":
          for (let dy = 0; dy < tileH; dy++) {
            for (let dx = 0; dx < tileW; dx++) {
              worldLevelData.hazards.push({ type: "saw_h", x: x + dx * gridSize, y: y + dy * gridSize, movement: obj.movement || { type: "horizontal", distance: 3, speed: 2000 } })
            }
          }
          break
        case "saw_v":
          for (let dy = 0; dy < tileH; dy++) {
            for (let dx = 0; dx < tileW; dx++) {
              worldLevelData.hazards.push({ type: "saw_v", x: x + dx * gridSize, y: y + dy * gridSize, movement: obj.movement || { type: "vertical", distance: 3, speed: 2000 } })
            }
          }
          break
        case "saw_c":
          for (let dy = 0; dy < tileH; dy++) {
            for (let dx = 0; dx < tileW; dx++) {
              worldLevelData.hazards.push({ type: "saw_c", x: x + dx * gridSize, y: y + dy * gridSize, movement: obj.movement || { type: "circular", distance: 2, speed: 2000 } })
            }
          }
          break
        case "cables":
          // Save cables as slow-zone hazards
          worldLevelData.hazards.push({ type: "cables", x, y, width, height })
          break
        case "spawn":
          worldLevelData.spawn = { x, y, facingDirection: obj.facingDirection || "right" }
          break
        case "goal":
          worldLevelData.goal = { x, y, width: 64, height: 64 }
          break
        case "fragment_drums":
        case "fragment_bass":
        case "fragment_guitar":
        case "fragment_keyboard":
        case "fragment_microphone":
        case "fragment_note":
          const fragType = obj.type.replace("fragment_", "")
          console.log(`[LevelDesigner] Saving fragment: editorType="${obj.type}" -> dbType="${fragType}" at (${x}, ${y})`)
          worldLevelData.fragments.push({ 
            type: fragType, 
            x, 
            y 
          })
          break
        case "bonus_mixtape":
        case "bonus_cd":
        case "bonus_vinyl":
        case "bonus_waveform":
        case "bonus_recordDeal":
          const bonusType = obj.type.replace("bonus_", "")
          console.log(`[LevelDesigner] Saving bonus: editorType="${obj.type}" -> dbType="${bonusType}" at (${x}, ${y})`)
          worldLevelData.fragments.push({ 
            type: bonusType, 
            x, 
            y 
          })
          break
        case "demo_fragment":
          console.log(`[LevelDesigner] Saving demo fragment at (${x}, ${y})`)
          worldLevelData.fragments.push({ 
            type: "demoFragment", 
            x, 
            y 
          })
          break
        case "stopwatch":
          console.log(`[LevelDesigner] Saving stopwatch at (${x}, ${y})`)
          worldLevelData.stopwatch = { x, y }
          break
      }
    })
    
    // Apply current editor style settings (may differ from cached DB values)
    worldLevelData.styleWorld = this.styleWorld ?? worldLevelData.styleWorld ?? null
    worldLevelData.stylePreset = this.stylePreset || worldLevelData.stylePreset || "auto"
    worldLevelData.backgroundContrast = this.backgroundContrast ?? worldLevelData.backgroundContrast ?? 1.0
    worldLevelData.backgroundBrightness = this.backgroundBrightness ?? worldLevelData.backgroundBrightness ?? 1.0
    worldLevelData.useWorldBackgroundSettings = this.useWorldBackgroundSettings ?? worldLevelData.useWorldBackgroundSettings ?? true
    
    // PUBLISH the level to Supabase database
    this.statusText.setText(`Publishing ${this.currentLevelTitle} to database...`)
    
    const result = await LevelDataManager.publishLevel(levelId, worldLevelData)
    
    if (result.success) {
      this.hasUnsavedChanges = false
      this.updateTitleDisplay()
      this.updateUnsavedIndicator()
      this.statusText.setText(`Published: ${this.currentLevelTitle}!`)
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      
      // Show success toast
      this.showPublishToast(result.message, true)
    } else {
      // Publish failed - show warning but level is still saved to localStorage
      this.hasUnsavedChanges = false
      this.updateTitleDisplay()
      this.updateUnsavedIndicator()
      this.statusText.setText(`Saved locally: ${this.currentLevelTitle}`)
      this.sound.play("ui_select_sound", { volume: 0.3 })
      
      // Show warning toast
      this.showPublishToast(result.message, false)
    }
    
    this.time.delayedCall(3000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }
  
  /**
   * Show publish result toast
   */
  showPublishToast(message, success) {
    const toast = this.add.container(this.cameras.main.width / 2, 80)
    toast.setDepth(1000)
    
    const bgColor = success ? 0x0a2a0a : 0x2a2a0a
    const borderColor = success ? 0x00ff88 : 0xffaa00
    const textColor = success ? "#00ff88" : "#ffaa00"
    const icon = success ? "✓" : "⚠"
    
    const bg = this.add.rectangle(0, 0, 450, 50, bgColor, 0.95)
      .setStrokeStyle(2, borderColor)
    
    const text = this.add.text(0, 0, `${icon} ${message}`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: textColor,
      wordWrap: { width: 420 }
    }).setOrigin(0.5)
    
    toast.add([bg, text])
    
    // Fade in
    toast.setAlpha(0)
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        // Then fade out after delay
        this.tweens.add({
          targets: toast,
          alpha: 0,
          duration: 500,
          delay: 4000,
          onComplete: () => toast.destroy()
        })
      }
    })
  }

  loadSavedLevel(levelId) {
    const level = SavedLevelsManager.getLevel(levelId)
    if (!level) {
      this.statusText.setText("Error loading level!")
      return
    }

    this.clearLevelSilent()
    this.mapWidth = level.data.mapWidth || 30
    this.mapHeight = level.data.mapHeight || 12
    this.currentLevelTitle = level.data.title || level.title
    this.currentLevelDescription = level.data.description || ""
    this.editingLevelId = level.id
    this.editingBuiltinKey = null
    this.isTutorialLevel = level.data.isTutorialLevel || false
    // Load speed run target times
    this.speedRunAnyTargetMs = level.data.speedRunAnyTargetMs || null
    this.speedRun100TargetMs = level.data.speedRun100TargetMs || null

    // Rebuild grid for new map size
    this.rebuildGrid()
    this.mapSizeText.setText(`Map: ${this.mapWidth}x${this.mapHeight}`)

    level.data.objects.forEach(obj => {
      this.placeObjectFromData(obj)
    })

    this.hasUnsavedChanges = false
    this.updateTitleDisplay()
    this.updateUnsavedIndicator()
    
    // Show tutorial status in load message
    const tutorialTag = this.isTutorialLevel ? " [Tutorial]" : ""
    this.statusText.setText(`Loaded "${level.title}"${tutorialTag}`)
    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  loadBuiltinLevel(levelKey) {
    const override = SavedLevelsManager.getBuiltinOverride(levelKey)
    const metadata = LEVEL_METADATA[levelKey]

    this.clearLevelSilent()
    this.editingBuiltinKey = levelKey
    this.editingLevelId = null
    this.currentLevelTitle = metadata?.name || levelKey

    if (override) {
      // Load the override
      this.mapWidth = override.data.mapWidth || 30
      this.mapHeight = override.data.mapHeight || 12
      // Rebuild grid for new map size
      this.rebuildGrid()
      this.mapSizeText.setText(`Map: ${this.mapWidth}x${this.mapHeight}`)
      override.data.objects.forEach(obj => {
        this.placeObjectFromData(obj)
      })
      this.statusText.setText(`Loaded custom "${this.currentLevelTitle}"`)
    } else {
      // No override exists - try to extract level data from the built-in level
      const extractedData = this.extractBuiltinLevelData(levelKey)
      if (extractedData) {
        this.mapWidth = extractedData.mapWidth
        this.mapHeight = extractedData.mapHeight
        // Rebuild grid for new map size
        this.rebuildGrid()
        this.mapSizeText.setText(`Map: ${this.mapWidth}x${this.mapHeight}`)
        extractedData.objects.forEach(obj => {
          this.placeObjectFromData(obj)
        })
        this.statusText.setText(`Loaded "${this.currentLevelTitle}" structure`)
      } else {
        this.statusText.setText(`Editing "${this.currentLevelTitle}" (start from scratch)`)
      }
    }

    this.hasUnsavedChanges = false
    this.updateTitleDisplay()
    this.updateUnsavedIndicator()
    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Load a World Tour level (one of the 301 levels)
   */
  async loadWorldTourLevelData(levelId) {
    // Ensure LevelDataManager is initialized before loading
    await LevelDataManager.waitForReady()
    
    const levelData = LevelDataManager.getLevel(levelId)
    
    this.clearLevelSilent()
    this.editingLevelId = levelId
    this.editingBuiltinKey = null
    
    // Check if level has a custom name saved in metadata (from database)
    // This takes priority over auto-generated names
    const customName = levelData?.metadata?.name
    const hasCustomName = customName && customName !== levelId && !customName.includes(" - Stage ") && !customName.includes(" - Boss")
    
    if (hasCustomName) {
      // Use the custom name from the database
      this.currentLevelTitle = customName
      console.log(`[LevelDesigner] Using custom title from database: "${customName}"`)
    } else {
      // Generate a default title from the level ID
      const parsed = parseLevelId(levelId)
      if (levelId === "Tutorial") {
        this.currentLevelTitle = "Tutorial"
      } else if (parsed) {
        const world = WORLDS[parsed.world]
        if (parsed.type === LEVEL_TYPES.NORMAL) {
          this.currentLevelTitle = `W${parsed.world}-${parsed.level}: ${world?.location || "Unknown"}`
        } else if (parsed.type === LEVEL_TYPES.BONUS) {
          const bonus = BONUS_PURPOSES[`b${parsed.level}`]
          this.currentLevelTitle = `W${parsed.world}-B${parsed.level}: ${bonus?.name || "Bonus"}`
        } else if (parsed.type === LEVEL_TYPES.BOSS) {
          this.currentLevelTitle = `W${parsed.world}-BOSS: ${world?.bossName || "Boss"}`
        }
      } else {
        this.currentLevelTitle = levelId
      }
    }
    
    if (levelData) {
      // Get map dimensions from level data
      const mapWidth = Math.floor((levelData.settings?.width || 1920) / 64)
      const mapHeight = Math.floor((levelData.settings?.height || 768) / 64)
      
      this.mapWidth = mapWidth
      this.mapHeight = mapHeight
      this.rebuildGrid()
      this.mapSizeText.setText(`Map: ${this.mapWidth}x${this.mapHeight}`)
      
      // Load tutorial flag and description from level data
      this.isTutorialLevel = levelData.metadata?.isTutorialLevel || false
      this.currentLevelDescription = levelData.metadata?.description || ""
      
      // Load speed run target times
      this.speedRunAnyTargetMs = levelData.settings?.speedRunAnyTargetMs || levelData.speed_run_any_target_ms || null
      this.speedRun100TargetMs = levelData.settings?.speedRun100TargetMs || levelData.speed_run_100_target_ms || null
      
      // Convert level data format to editor format
      const objects = this.convertLevelDataToObjects(levelData)
      objects.forEach(obj => {
        this.placeObjectFromData(obj)
      })
      
      const tutorialTag = this.isTutorialLevel ? " [Tutorial]" : ""
      this.statusText.setText(`Loaded "${this.currentLevelTitle}"${tutorialTag}`)
    } else {
      this.statusText.setText(`Editing "${this.currentLevelTitle}" (blank template)`)
    }
    
    this.hasUnsavedChanges = false
    this.updateTitleDisplay()
    this.updateUnsavedIndicator()
    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Convert LevelDataManager format to editor object format
   */
  convertLevelDataToObjects(levelData) {
    const objects = []
    const gridSize = 64
    
    // Helper to check if coordinates are valid (not null, undefined, or NaN)
    const isValidCoord = (val) => val !== null && val !== undefined && !isNaN(val)
    
    // Add spawn point
    if (levelData.spawn && isValidCoord(levelData.spawn.x) && isValidCoord(levelData.spawn.y)) {
      objects.push({
        type: "spawn",
        x: Math.floor(levelData.spawn.x / gridSize),
        y: Math.floor(levelData.spawn.y / gridSize),
        width: 1,
        height: 1
      })
    }
    
    // Add goal
    if (levelData.goal && isValidCoord(levelData.goal.x) && isValidCoord(levelData.goal.y)) {
      objects.push({
        type: "goal",
        x: Math.floor(levelData.goal.x / gridSize),
        y: Math.floor(levelData.goal.y / gridSize),
        width: 1,
        height: 1
      })
    }
    
    // Add platforms
    if (levelData.platforms) {
      levelData.platforms.forEach(platform => {
        // Skip platforms with invalid coordinates
        if (!isValidCoord(platform.x) || !isValidCoord(platform.y)) {
          console.warn('[LevelDesigner] Skipping platform with invalid coordinates:', platform)
          return
        }
        objects.push({
          type: "platform",
          x: Math.floor(platform.x / gridSize),
          y: Math.floor(platform.y / gridSize),
          width: Math.ceil((platform.width || gridSize) / gridSize),
          height: Math.ceil((platform.height || gridSize) / gridSize)
        })
      })
    }
    
    // Add hazards
    if (levelData.hazards) {
      levelData.hazards.forEach(hazard => {
        // Skip hazards with invalid coordinates
        if (!isValidCoord(hazard.x) || !isValidCoord(hazard.y)) {
          console.warn('[LevelDesigner] Skipping hazard with invalid coordinates:', hazard)
          return
        }
        // Map DB type to editor type, preserving saw subtypes and cables
        let hazardType
        switch (hazard.type) {
          case "spike": hazardType = "spike"; break
          case "saw_h": hazardType = "saw_h"; break
          case "saw_v": hazardType = "saw_v"; break
          case "saw_c": hazardType = "saw_c"; break
          case "cables": hazardType = "cables"; break
          default: hazardType = "saw"; break
        }
        const obj = {
          type: hazardType,
          x: Math.floor(hazard.x / gridSize),
          y: Math.floor(hazard.y / gridSize),
          width: hazard.width ? Math.ceil(hazard.width / gridSize) : 1,
          height: hazard.height ? Math.ceil(hazard.height / gridSize) : 1
        }
        // Preserve movement data for moving saws
        if (hazard.movement) {
          obj.movement = hazard.movement
        }
        objects.push(obj)
      })
    }
    
    // Add fragments - map fragment types properly
    if (levelData.fragments) {
      levelData.fragments.forEach((fragment) => {
        // Skip fragments with invalid coordinates
        if (!isValidCoord(fragment.x) || !isValidCoord(fragment.y)) {
          console.warn('[LevelDesigner] Skipping fragment with invalid coordinates:', fragment)
          return
        }
        
        // Map fragment type to editor type - direct mapping from saved format
        const fragType = (fragment.type || "").toLowerCase()
        let editorType
        
        // Direct instrument mappings (saved as "drums", "bass", etc.)
        switch (fragType) {
          case "drums":
          case "drum_fill":
            editorType = "fragment_drums"
            break
          case "bass":
          case "verse_stem":
            editorType = "fragment_bass"
            break
          case "guitar":
          case "chorus_hook":
            editorType = "fragment_guitar"
            break
          case "keyboard":
          case "bridge_layer":
            editorType = "fragment_keyboard"
            break
          case "microphone":
          case "vocal_harmony":
            editorType = "fragment_microphone"
            break
          case "note":
          case "intro_riff":
            editorType = "fragment_note"
            break
          // Bonus items
          case "mixtape":
            editorType = "bonus_mixtape"
            break
          case "cd":
            editorType = "bonus_cd"
            break
          case "vinyl":
            editorType = "bonus_vinyl"
            break
          case "waveform":
            editorType = "bonus_waveform"
            break
          case "recorddeal":
            editorType = "bonus_recordDeal"
            break
          case "demofragment":
            editorType = "demo_fragment"
            break
          default:
            console.warn(`[LevelDesigner] Unknown fragment type: "${fragment.type}", defaulting to note`)
            editorType = "fragment_note"
        }
        
        console.log(`[LevelDesigner] Loading fragment: type="${fragment.type}" -> editorType="${editorType}" at (${fragment.x}, ${fragment.y})`)
        
        objects.push({
          type: editorType,
          x: Math.floor(fragment.x / gridSize),
          y: Math.floor(fragment.y / gridSize),
          width: 1,
          height: 1
        })
      })
    }
    
    // Add stopwatch if present (for speed run timing)
    // Can be in levelData.stopwatch or levelData.settings.stopwatch
    const stopwatch = levelData.stopwatch || levelData.settings?.stopwatch
    if (stopwatch && isValidCoord(stopwatch.x) && isValidCoord(stopwatch.y)) {
      console.log(`[LevelDesigner] Loading stopwatch at (${stopwatch.x}, ${stopwatch.y})`)
      objects.push({
        type: "stopwatch",
        x: Math.floor(stopwatch.x / gridSize),
        y: Math.floor(stopwatch.y / gridSize),
        width: 1,
        height: 1
      })
    }
    
    console.log(`[LevelDesigner] Converted level data to ${objects.length} editor objects`)
    return objects
  }

  /**
   * Extract level structure from built-in level configurations
   * This provides default layouts based on level metadata
   */
  extractBuiltinLevelData(levelKey) {
    // Pre-defined level structures for all 11 built-in levels
    // These match the actual level layouts from LevelXScene.js files
    const builtinLevelData = {
      "Level1Scene": {
        mapWidth: 30,
        mapHeight: 12,
        objects: [
          // Starting platform
          { type: "platform", x: 0, y: 10, width: 7, height: 2 },
          // First floating platform
          { type: "platform", x: 8, y: 9, width: 5, height: 1 },
          // Second floating platform
          { type: "platform", x: 14, y: 7, width: 4, height: 1 },
          // Wall jump section - left wall
          { type: "platform", x: 19, y: 4, width: 1, height: 8 },
          // Wall jump section - right wall
          { type: "platform", x: 24, y: 4, width: 1, height: 8 },
          // Top platform
          { type: "platform", x: 20, y: 3, width: 4, height: 1 },
          // Final platform
          { type: "platform", x: 26, y: 6, width: 4, height: 2 },
          // Spikes in wall jump section
          { type: "spike", x: 20, y: 11, width: 1, height: 1 },
          { type: "spike", x: 21, y: 11, width: 1, height: 1 },
          { type: "spike", x: 22, y: 11, width: 1, height: 1 },
          // Spawn point
          { type: "spawn", x: 3, y: 9, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 10, y: 8, width: 1, height: 1 },
          { type: "fragment_bass", x: 15, y: 6, width: 1, height: 1 },
          { type: "fragment_guitar", x: 21, y: 2, width: 1, height: 1 },
          { type: "fragment_note", x: 27, y: 5, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 28, y: 5, width: 1, height: 1 }
        ]
      },
      "Level2Scene": {
        mapWidth: 35,
        mapHeight: 12,
        objects: [
          // Starting platform
          { type: "platform", x: 0, y: 10, width: 6, height: 2 },
          // First floating platform
          { type: "platform", x: 7, y: 9, width: 4, height: 1 },
          // Wall section left wall
          { type: "platform", x: 17, y: 2, width: 1, height: 10 },
          // Wall section right wall
          { type: "platform", x: 22, y: 2, width: 1, height: 10 },
          // Middle platform in wall section
          { type: "platform", x: 18, y: 7, width: 4, height: 1 },
          // Top platform after wall jump
          { type: "platform", x: 18, y: 2, width: 4, height: 1 },
          // Bridge platform
          { type: "platform", x: 24, y: 4, width: 4, height: 1 },
          // Final platform
          { type: "platform", x: 29, y: 6, width: 6, height: 2 },
          // Spikes below wall section
          { type: "spike", x: 18, y: 11, width: 1, height: 1 },
          { type: "spike", x: 19, y: 11, width: 1, height: 1 },
          { type: "spike", x: 20, y: 11, width: 1, height: 1 },
          { type: "spike", x: 21, y: 11, width: 1, height: 1 },
          // Spawn point
          { type: "spawn", x: 2, y: 9, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 8, y: 8, width: 1, height: 1 },
          { type: "fragment_bass", x: 19, y: 6, width: 1, height: 1 },
          { type: "fragment_guitar", x: 19, y: 1, width: 1, height: 1 },
          { type: "fragment_note", x: 25, y: 3, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 32, y: 5, width: 1, height: 1 }
        ]
      },
      "Level3Scene": {
        mapWidth: 25,
        mapHeight: 16,
        objects: [
          // Starting floor
          { type: "platform", x: 0, y: 14, width: 6, height: 2 },
          // Ascending platforms (staircase style)
          { type: "platform", x: 7, y: 13, width: 3, height: 1 },
          { type: "platform", x: 9, y: 11, width: 3, height: 1 },
          { type: "platform", x: 10, y: 9, width: 3, height: 1 },
          { type: "platform", x: 11, y: 7, width: 3, height: 1 },
          { type: "platform", x: 12, y: 5, width: 3, height: 1 },
          { type: "platform", x: 11, y: 3, width: 5, height: 1 },
          // Exit platform
          { type: "platform", x: 18, y: 5, width: 7, height: 1 },
          // Spikes at bottom
          { type: "spike", x: 7, y: 15, width: 1, height: 1 },
          { type: "spike", x: 8, y: 15, width: 1, height: 1 },
          // Spawn point
          { type: "spawn", x: 3, y: 13, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 10, y: 10, width: 1, height: 1 },
          { type: "fragment_bass", x: 11, y: 6, width: 1, height: 1 },
          { type: "fragment_guitar", x: 13, y: 2, width: 1, height: 1 },
          { type: "fragment_note", x: 20, y: 4, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 22, y: 4, width: 1, height: 1 }
        ]
      },
      "Level4Scene": {
        mapWidth: 40,
        mapHeight: 12,
        objects: [
          // Starting platform
          { type: "platform", x: 0, y: 10, width: 5, height: 2 },
          // Low corridor ceiling
          { type: "platform", x: 5, y: 7, width: 10, height: 1 },
          // Corridor floor
          { type: "platform", x: 5, y: 10, width: 10, height: 2 },
          // Gap platforms
          { type: "platform", x: 16, y: 9, width: 3, height: 1 },
          { type: "platform", x: 20, y: 8, width: 3, height: 1 },
          { type: "platform", x: 24, y: 7, width: 3, height: 1 },
          // Wall jump corridor - left
          { type: "platform", x: 29, y: 0, width: 1, height: 12 },
          // Wall jump corridor - right
          { type: "platform", x: 34, y: 0, width: 1, height: 12 },
          // Exit platform (top)
          { type: "platform", x: 30, y: 1, width: 4, height: 1 },
          // Final platform
          { type: "platform", x: 36, y: 3, width: 4, height: 1 },
          // Spikes below gap
          { type: "spike", x: 16, y: 11, width: 1, height: 1 },
          { type: "spike", x: 17, y: 11, width: 1, height: 1 },
          { type: "spike", x: 18, y: 11, width: 1, height: 1 },
          { type: "spike", x: 20, y: 11, width: 1, height: 1 },
          { type: "spike", x: 21, y: 11, width: 1, height: 1 },
          { type: "spike", x: 22, y: 11, width: 1, height: 1 },
          // Wall jump spikes
          { type: "spike", x: 30, y: 11, width: 1, height: 1 },
          { type: "spike", x: 31, y: 11, width: 1, height: 1 },
          { type: "spike", x: 32, y: 11, width: 1, height: 1 },
          // Spawn
          { type: "spawn", x: 2, y: 9, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 10, y: 8, width: 1, height: 1 },
          { type: "fragment_bass", x: 22, y: 7, width: 1, height: 1 },
          { type: "fragment_guitar", x: 26, y: 6, width: 1, height: 1 },
          { type: "fragment_note", x: 31, y: 0, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 37, y: 2, width: 1, height: 1 }
        ]
      },
      "Level5Scene": {
        mapWidth: 50,
        mapHeight: 12,
        objects: [
          // Starting platform
          { type: "platform", x: 0, y: 10, width: 6, height: 2 },
          // Gauntlet platforms
          { type: "platform", x: 8, y: 9, width: 3, height: 1 },
          { type: "platform", x: 13, y: 8, width: 3, height: 1 },
          { type: "platform", x: 18, y: 7, width: 3, height: 1 },
          { type: "platform", x: 23, y: 7, width: 4, height: 1 },
          { type: "platform", x: 29, y: 8, width: 3, height: 1 },
          { type: "platform", x: 34, y: 6, width: 4, height: 1 },
          { type: "platform", x: 40, y: 7, width: 3, height: 1 },
          // Final platform
          { type: "platform", x: 45, y: 8, width: 5, height: 2 },
          // Spikes
          { type: "spike", x: 7, y: 11, width: 1, height: 1 },
          { type: "spike", x: 12, y: 11, width: 1, height: 1 },
          { type: "spike", x: 17, y: 11, width: 1, height: 1 },
          { type: "spike", x: 22, y: 11, width: 1, height: 1 },
          { type: "spike", x: 23, y: 11, width: 1, height: 1 },
          { type: "spike", x: 28, y: 11, width: 1, height: 1 },
          { type: "spike", x: 35, y: 11, width: 1, height: 1 },
          { type: "spike", x: 39, y: 11, width: 1, height: 1 },
          { type: "spike", x: 43, y: 11, width: 1, height: 1 },
          // Saw blades
          { type: "saw", x: 9, y: 5, width: 1, height: 1 },
          { type: "saw", x: 19, y: 5, width: 1, height: 1 },
          { type: "saw", x: 37, y: 2, width: 1, height: 1 },
          // Spawn
          { type: "spawn", x: 3, y: 9, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 14, y: 7, width: 1, height: 1 },
          { type: "fragment_bass", x: 25, y: 6, width: 1, height: 1 },
          { type: "fragment_guitar", x: 37, y: 5, width: 1, height: 1 },
          { type: "fragment_note", x: 46, y: 7, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 47, y: 7, width: 1, height: 1 }
        ]
      },
      "Level6Scene": {
        mapWidth: 20,
        mapHeight: 20,
        objects: [
          // Starting floor
          { type: "platform", x: 0, y: 18, width: 6, height: 2 },
          // Tower walls - left
          { type: "platform", x: 5, y: 2, width: 1, height: 16 },
          // Tower walls - right  
          { type: "platform", x: 14, y: 2, width: 1, height: 16 },
          // Internal platforms
          { type: "platform", x: 6, y: 15, width: 4, height: 1 },
          { type: "platform", x: 10, y: 12, width: 4, height: 1 },
          { type: "platform", x: 6, y: 9, width: 4, height: 1 },
          { type: "platform", x: 10, y: 6, width: 4, height: 1 },
          // Top platform
          { type: "platform", x: 6, y: 3, width: 8, height: 1 },
          // Exit platform
          { type: "platform", x: 16, y: 2, width: 4, height: 1 },
          // Spikes at bottom of shaft
          { type: "spike", x: 7, y: 17, width: 1, height: 1 },
          { type: "spike", x: 8, y: 17, width: 1, height: 1 },
          { type: "spike", x: 9, y: 17, width: 1, height: 1 },
          { type: "spike", x: 10, y: 17, width: 1, height: 1 },
          { type: "spike", x: 11, y: 17, width: 1, height: 1 },
          { type: "spike", x: 12, y: 17, width: 1, height: 1 },
          { type: "spike", x: 13, y: 17, width: 1, height: 1 },
          // Saw blades
          { type: "saw", x: 5, y: 8, width: 1, height: 1 },
          { type: "saw", x: 14, y: 8, width: 1, height: 1 },
          // Spawn
          { type: "spawn", x: 10, y: 17, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 8, y: 14, width: 1, height: 1 },
          { type: "fragment_bass", x: 12, y: 11, width: 1, height: 1 },
          { type: "fragment_guitar", x: 12, y: 5, width: 1, height: 1 },
          { type: "fragment_note", x: 10, y: 2, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 18, y: 1, width: 1, height: 1 }
        ]
      },
      "Level7Scene": {
        mapWidth: 45,
        mapHeight: 12,
        objects: [
          // Starting platform
          { type: "platform", x: 0, y: 10, width: 5, height: 2 },
          // Narrow platforms with saw gauntlet
          { type: "platform", x: 7, y: 9, width: 2, height: 1 },
          { type: "platform", x: 11, y: 8, width: 2, height: 1 },
          { type: "platform", x: 15, y: 9, width: 2, height: 1 },
          { type: "platform", x: 19, y: 10, width: 4, height: 2 },
          { type: "platform", x: 25, y: 9, width: 2, height: 1 },
          { type: "platform", x: 29, y: 8, width: 2, height: 1 },
          { type: "platform", x: 32, y: 7, width: 2, height: 1 },
          { type: "platform", x: 36, y: 8, width: 2, height: 1 },
          // Final platform
          { type: "platform", x: 40, y: 9, width: 5, height: 2 },
          // Spikes
          { type: "spike", x: 6, y: 11, width: 1, height: 1 },
          { type: "spike", x: 10, y: 11, width: 1, height: 1 },
          { type: "spike", x: 14, y: 11, width: 1, height: 1 },
          { type: "spike", x: 18, y: 11, width: 1, height: 1 },
          { type: "spike", x: 27, y: 11, width: 1, height: 1 },
          { type: "spike", x: 31, y: 11, width: 1, height: 1 },
          { type: "spike", x: 35, y: 11, width: 1, height: 1 },
          { type: "spike", x: 39, y: 11, width: 1, height: 1 },
          // Moving saw blades
          { type: "saw", x: 10, y: 5, width: 1, height: 1 },
          { type: "saw", x: 14, y: 6, width: 1, height: 1 },
          { type: "saw", x: 18, y: 7, width: 1, height: 1 },
          { type: "saw", x: 27, y: 5, width: 1, height: 1 },
          { type: "saw", x: 31, y: 4, width: 1, height: 1 },
          { type: "saw", x: 35, y: 5, width: 1, height: 1 },
          { type: "saw", x: 38, y: 6, width: 1, height: 1 },
          // Spawn
          { type: "spawn", x: 2, y: 9, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 12, y: 7, width: 1, height: 1 },
          { type: "fragment_bass", x: 22, y: 9, width: 1, height: 1 },
          { type: "fragment_guitar", x: 33, y: 6, width: 1, height: 1 },
          { type: "fragment_note", x: 42, y: 8, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 42, y: 8, width: 1, height: 1 }
        ]
      },
      "Level8Scene": {
        mapWidth: 35,
        mapHeight: 18,
        objects: [
          // Starting platform
          { type: "platform", x: 0, y: 16, width: 6, height: 2 },
          // Lower path
          { type: "platform", x: 8, y: 16, width: 15, height: 2 },
          // Upper path entrance
          { type: "platform", x: 6, y: 13, width: 3, height: 1 },
          // Upper path platforms
          { type: "platform", x: 8, y: 11, width: 4, height: 1 },
          { type: "platform", x: 14, y: 9, width: 4, height: 1 },
          // Top route
          { type: "platform", x: 17, y: 4, width: 4, height: 1 },
          { type: "platform", x: 22, y: 6, width: 4, height: 1 },
          // Convergence platform
          { type: "platform", x: 28, y: 10, width: 4, height: 1 },
          // Exit platform
          { type: "platform", x: 31, y: 7, width: 4, height: 1 },
          // Spikes in lower corridor
          { type: "spike", x: 11, y: 17, width: 1, height: 1 },
          { type: "spike", x: 13, y: 17, width: 1, height: 1 },
          { type: "spike", x: 15, y: 17, width: 1, height: 1 },
          { type: "spike", x: 17, y: 17, width: 1, height: 1 },
          { type: "spike", x: 19, y: 17, width: 1, height: 1 },
          { type: "spike", x: 21, y: 17, width: 1, height: 1 },
          { type: "spike", x: 23, y: 17, width: 1, height: 1 },
          // Saw blades
          { type: "saw", x: 8, y: 13, width: 1, height: 1 },
          { type: "saw", x: 16, y: 7, width: 1, height: 1 },
          { type: "saw", x: 22, y: 5, width: 1, height: 1 },
          { type: "saw", x: 26, y: 8, width: 1, height: 1 },
          // Spawn
          { type: "spawn", x: 4, y: 15, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 17, y: 15, width: 1, height: 1 },
          { type: "fragment_bass", x: 10, y: 10, width: 1, height: 1 },
          { type: "fragment_guitar", x: 19, y: 3, width: 1, height: 1 },
          { type: "fragment_note", x: 30, y: 9, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 33, y: 6, width: 1, height: 1 }
        ]
      },
      "Level9Scene": {
        mapWidth: 40,
        mapHeight: 14,
        objects: [
          // Starting tiny platform
          { type: "platform", x: 0, y: 12, width: 3, height: 2 },
          // Tiny platforms - precision jumping
          { type: "platform", x: 5, y: 10, width: 2, height: 1 },
          { type: "platform", x: 8, y: 8, width: 1, height: 1 },
          { type: "platform", x: 11, y: 9, width: 1, height: 1 },
          // Wall jump section
          { type: "platform", x: 14, y: 3, width: 1, height: 9 },
          { type: "platform", x: 17, y: 3, width: 1, height: 9 },
          // High tiny platform
          { type: "platform", x: 19, y: 4, width: 2, height: 1 },
          // Descending tiny platforms
          { type: "platform", x: 23, y: 5, width: 1, height: 1 },
          { type: "platform", x: 26, y: 8, width: 1, height: 1 },
          { type: "platform", x: 29, y: 7, width: 1, height: 1 },
          // Almost there platform
          { type: "platform", x: 32, y: 9, width: 3, height: 1 },
          // Final platform
          { type: "platform", x: 37, y: 8, width: 3, height: 1 },
          // Spikes at bottom
          { type: "spike", x: 4, y: 13, width: 1, height: 1 },
          { type: "spike", x: 6, y: 13, width: 1, height: 1 },
          { type: "spike", x: 8, y: 13, width: 1, height: 1 },
          { type: "spike", x: 10, y: 13, width: 1, height: 1 },
          { type: "spike", x: 12, y: 13, width: 1, height: 1 },
          { type: "spike", x: 20, y: 13, width: 1, height: 1 },
          { type: "spike", x: 22, y: 13, width: 1, height: 1 },
          { type: "spike", x: 24, y: 13, width: 1, height: 1 },
          { type: "spike", x: 26, y: 13, width: 1, height: 1 },
          { type: "spike", x: 28, y: 13, width: 1, height: 1 },
          { type: "spike", x: 30, y: 13, width: 1, height: 1 },
          { type: "spike", x: 32, y: 13, width: 1, height: 1 },
          { type: "spike", x: 34, y: 13, width: 1, height: 1 },
          { type: "spike", x: 36, y: 13, width: 1, height: 1 },
          // Saw blades
          { type: "saw", x: 7, y: 9, width: 1, height: 1 },
          { type: "saw", x: 13, y: 9, width: 1, height: 1 },
          { type: "saw", x: 22, y: 5, width: 1, height: 1 },
          { type: "saw", x: 28, y: 9, width: 1, height: 1 },
          // Spawn
          { type: "spawn", x: 1, y: 11, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 8, y: 7, width: 1, height: 1 },
          { type: "fragment_bass", x: 20, y: 3, width: 1, height: 1 },
          { type: "fragment_guitar", x: 26, y: 7, width: 1, height: 1 },
          { type: "fragment_note", x: 34, y: 8, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 38, y: 7, width: 1, height: 1 }
        ]
      },
      "Level10Scene": {
        mapWidth: 25,
        mapHeight: 22,
        objects: [
          // Starting platform at TOP
          { type: "platform", x: 0, y: 2, width: 5, height: 1 },
          // Descent shaft walls
          { type: "platform", x: 4, y: 3, width: 1, height: 16 },
          { type: "platform", x: 9, y: 3, width: 1, height: 16 },
          // Mid platforms in shaft
          { type: "platform", x: 5, y: 10, width: 2, height: 1 },
          { type: "platform", x: 7, y: 14, width: 2, height: 1 },
          // Safe landing left
          { type: "platform", x: 8, y: 17, width: 4, height: 1 },
          // Ascent section
          { type: "platform", x: 13, y: 15, width: 3, height: 1 },
          { type: "platform", x: 15, y: 11, width: 3, height: 1 },
          { type: "platform", x: 17, y: 7, width: 3, height: 1 },
          { type: "platform", x: 19, y: 4, width: 3, height: 1 },
          // Final platform
          { type: "platform", x: 21, y: 3, width: 4, height: 1 },
          // Spike pit at bottom
          { type: "spike", x: 1, y: 19, width: 1, height: 1 },
          { type: "spike", x: 3, y: 19, width: 1, height: 1 },
          { type: "spike", x: 5, y: 19, width: 1, height: 1 },
          { type: "spike", x: 7, y: 19, width: 1, height: 1 },
          { type: "spike", x: 9, y: 19, width: 1, height: 1 },
          { type: "spike", x: 11, y: 19, width: 1, height: 1 },
          { type: "spike", x: 13, y: 19, width: 1, height: 1 },
          { type: "spike", x: 15, y: 19, width: 1, height: 1 },
          { type: "spike", x: 17, y: 19, width: 1, height: 1 },
          { type: "spike", x: 19, y: 19, width: 1, height: 1 },
          { type: "spike", x: 21, y: 19, width: 1, height: 1 },
          { type: "spike", x: 23, y: 19, width: 1, height: 1 },
          // Saw blades
          { type: "saw", x: 7, y: 8, width: 1, height: 1 },
          { type: "saw", x: 12, y: 14, width: 1, height: 1 },
          { type: "saw", x: 17, y: 7, width: 1, height: 1 },
          // Spawn
          { type: "spawn", x: 2, y: 1, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 6, y: 9, width: 1, height: 1 },
          { type: "fragment_bass", x: 10, y: 16, width: 1, height: 1 },
          { type: "fragment_guitar", x: 16, y: 8, width: 1, height: 1 },
          { type: "fragment_note", x: 20, y: 5, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 23, y: 2, width: 1, height: 1 }
        ]
      },
      "Level11Scene": {
        mapWidth: 55,
        mapHeight: 16,
        objects: [
          // Starting platform
          { type: "platform", x: 0, y: 14, width: 4, height: 2 },
          // First gauntlet section
          { type: "platform", x: 6, y: 12, width: 3, height: 1 },
          { type: "platform", x: 10, y: 10, width: 3, height: 1 },
          // Wall jump 1 - left
          { type: "platform", x: 15, y: 3, width: 1, height: 13 },
          // Wall jump 1 - right
          { type: "platform", x: 22, y: 3, width: 1, height: 13 },
          // Top platform wall jump 1
          { type: "platform", x: 16, y: 4, width: 6, height: 1 },
          // Precision bridge
          { type: "platform", x: 24, y: 5, width: 2, height: 1 },
          { type: "platform", x: 27, y: 4, width: 2, height: 1 },
          { type: "platform", x: 30, y: 5, width: 2, height: 1 },
          // Corridor
          { type: "platform", x: 33, y: 7, width: 10, height: 1 },
          { type: "platform", x: 33, y: 5, width: 10, height: 1 },
          // Final wall jump section - left
          { type: "platform", x: 44, y: 2, width: 1, height: 12 },
          // Final wall jump section - right
          { type: "platform", x: 49, y: 2, width: 1, height: 12 },
          // Final top platform
          { type: "platform", x: 45, y: 1, width: 4, height: 1 },
          // Exit platform
          { type: "platform", x: 51, y: 3, width: 4, height: 1 },
          // Gauntlet spikes
          { type: "spike", x: 5, y: 15, width: 1, height: 1 },
          { type: "spike", x: 7, y: 15, width: 1, height: 1 },
          { type: "spike", x: 9, y: 15, width: 1, height: 1 },
          { type: "spike", x: 11, y: 15, width: 1, height: 1 },
          { type: "spike", x: 13, y: 15, width: 1, height: 1 },
          { type: "spike", x: 15, y: 15, width: 1, height: 1 },
          // Wall jump 1 spikes
          { type: "spike", x: 19, y: 15, width: 1, height: 1 },
          { type: "spike", x: 20, y: 15, width: 1, height: 1 },
          { type: "spike", x: 21, y: 15, width: 1, height: 1 },
          // Final section spikes
          { type: "spike", x: 44, y: 13, width: 1, height: 1 },
          { type: "spike", x: 45, y: 13, width: 1, height: 1 },
          { type: "spike", x: 46, y: 13, width: 1, height: 1 },
          { type: "spike", x: 47, y: 13, width: 1, height: 1 },
          { type: "spike", x: 48, y: 13, width: 1, height: 1 },
          // Saw blades
          { type: "saw", x: 26, y: 4, width: 1, height: 1 },
          { type: "saw", x: 29, y: 5, width: 1, height: 1 },
          { type: "saw", x: 35, y: 6, width: 1, height: 1 },
          { type: "saw", x: 39, y: 6, width: 1, height: 1 },
          { type: "saw", x: 46, y: 8, width: 1, height: 1 },
          // Spawn
          { type: "spawn", x: 2, y: 13, width: 1, height: 1 },
          // Fragments
          { type: "fragment_drums", x: 11, y: 9, width: 1, height: 1 },
          { type: "fragment_bass", x: 20, y: 3, width: 1, height: 1 },
          { type: "fragment_guitar", x: 37, y: 6, width: 1, height: 1 },
          { type: "fragment_note", x: 46, y: 0, width: 1, height: 1 },
          // Goal
          { type: "goal", x: 52, y: 2, width: 1, height: 1 }
        ]
      }
    }

    // Return level data if we have it
    if (builtinLevelData[levelKey]) {
      return builtinLevelData[levelKey]
    }

    // Default template for unknown levels
    return {
      mapWidth: 30,
      mapHeight: 12,
      objects: [
        { type: "platform", x: 0, y: 10, width: 6, height: 2 },
        { type: "platform", x: 24, y: 8, width: 6, height: 2 },
        { type: "spawn", x: 2, y: 9, width: 1, height: 1 },
        { type: "goal", x: 27, y: 7, width: 1, height: 1 }
      ]
    }
  }

  clearLevelSilent() {
    this.placedObjects.forEach(obj => obj.visual.destroy())
    this.placedObjects = []
    this.objectCountText.setText(`Objects: 0`)
    
    // Clear test state when loading a new level
    // This ensures spawn-shift doesn't carry over between different levels
    this.clearTestState()
  }

  /**
   * Clear test-related state (player position, shifted spawn, etc.)
   * Called when loading a new level to start fresh
   */
  clearTestState() {
    this.registry.set("testPlayerState", null)
    this.registry.set("shiftedSpawnPoint", null)
  }

  exportLevel() {
    const data = this.generateLevelData()
    const json = JSON.stringify(data, null, 2)
    
    // Copy to clipboard
    navigator.clipboard.writeText(json).then(() => {
      this.statusText.setText("Level JSON copied to clipboard!")
      this.time.delayedCall(2000, () => {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      })
    }).catch(() => {
      console.log("Level JSON:", json)
      this.statusText.setText("Check console for JSON output")
    })
  }
  
  /**
   * Export level data in a format ready for publishing to source files.
   * This creates the full level data structure that can be pasted into src/levels/*.js
   */
  exportForPublish() {
    const levelId = this.loadWorldTourLevel || this.editingLevelId || "NewLevel"
    const gridSize = 64
    
    // Build the full level data structure
    const worldLevelData = {
      version: 1,
      metadata: {
        name: this.currentLevelTitle || levelId,
        description: "",
        difficulty: "Medium",
        author: "The Diminished Chord",
        created: Date.now(),
        modified: Date.now()
      },
      settings: {
        width: this.mapWidth * gridSize,
        height: this.mapHeight * gridSize,
        tileSize: 32,
        gravity: 1200,
        backgroundColor: "#1a1a2e",
        musicTrackId: null,
        timeLimit: null,
        parTime: null
      },
      spawn: { x: 100, y: 600 },
      goal: { x: 1800, y: 600, width: 64, height: 64 },
      layers: {
        background: [],
        terrain: [],
        hazards: [],
        decoration: [],
        foreground: []
      },
      platforms: [],
      hazards: [],
      movingPlatforms: [],
      fragments: [],
      checkpoints: [],
      objects: [],
      enemies: [],
      triggers: []
    }
    
    // Convert placed objects to level format
    this.placedObjects.forEach(obj => {
      const x = obj.gridX * gridSize
      const y = obj.gridY * gridSize
      const width = obj.width * gridSize
      const height = obj.height * gridSize
      
      switch (obj.type) {
        case "platform":
          worldLevelData.platforms.push({ x, y, width, height, type: "solid" })
          break
        case "spike":
          worldLevelData.hazards.push({ type: "spike", x, y })
          break
        case "saw":
          worldLevelData.hazards.push({ type: "saw", x, y })
          break
        case "spawn":
          worldLevelData.spawn = { x, y, facingDirection: obj.facingDirection || "right" }
          break
        case "goal":
          worldLevelData.goal = { x, y, width: 64, height: 64 }
          break
        case "fragment_drums":
        case "fragment_bass":
        case "fragment_guitar":
        case "fragment_keyboard":
        case "fragment_microphone":
        case "fragment_note":
          worldLevelData.fragments.push({ type: obj.type.replace("fragment_", ""), x, y })
          break
        case "bonus_mixtape":
        case "bonus_cd":
        case "bonus_vinyl":
        case "bonus_waveform":
        case "bonus_recordDeal":
          worldLevelData.fragments.push({ type: obj.type.replace("bonus_", ""), x, y })
          break
        case "demo_fragment":
          worldLevelData.fragments.push({ type: "demoFragment", x, y })
          break
      }
    })
    
    // Create export package
    const exportData = {
      levelId: levelId,
      levelData: worldLevelData
    }
    
    const json = JSON.stringify(exportData, null, 2)
    
    // Copy to clipboard and log to console
    navigator.clipboard.writeText(json).then(() => {
      console.log("=== LEVEL PUBLISH DATA ===")
      console.log(`Level ID: ${levelId}`)
      console.log("Copy this data and ask Claude to update the level file:")
      console.log(json)
      console.log("=== END PUBLISH DATA ===")
      
      this.statusText.setText(`Publish data copied! Share with Claude to update ${levelId}.js`)
      this.showPublishExportToast(levelId)
    }).catch(() => {
      console.log("=== LEVEL PUBLISH DATA ===")
      console.log(json)
      console.log("=== END PUBLISH DATA ===")
      this.statusText.setText("Check console for publish data")
    })
  }
  
  showPublishExportToast(levelId) {
    const toast = this.add.container(this.cameras.main.width / 2, 100)
    toast.setDepth(1000)
    
    const bg = this.add.rectangle(0, 0, 500, 80, 0x0a2a2a, 0.98)
      .setStrokeStyle(2, 0x00ffff)
    
    const text = this.add.text(0, -15, `Level "${levelId}" data copied to clipboard!`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff"
    }).setOrigin(0.5)
    
    const subtext = this.add.text(0, 15, "Paste to Claude to permanently update the level file", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)
    
    toast.add([bg, text, subtext])
    
    toast.setAlpha(0)
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        this.tweens.add({
          targets: toast,
          alpha: 0,
          duration: 500,
          delay: 5000,
          onComplete: () => toast.destroy()
        })
      }
    })
  }

  /**
   * Show export dialog with options for CSV download or clipboard copy
   */
  showExportDialog() {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 450, 220, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0xff00ff)

    const titleText = this.add.text(0, -80, "EXPORT FOR SUPABASE", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff00ff"
    }).setOrigin(0.5)

    const subtitleText = this.add.text(0, -50, "Manual fallback - use if Publish fails", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#888888"
    }).setOrigin(0.5)

    // Download CSV button
    const downloadBtn = this.add.rectangle(-100, 10, 160, 45, 0x00ff88, 0.8)
      .setStrokeStyle(2, 0x44ff88)
      .setInteractive({ useHandCursor: true })
    const downloadText = this.add.text(-100, 10, "DOWNLOAD CSV", {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#000000"
    }).setOrigin(0.5)

    // Copy to clipboard button
    const copyBtn = this.add.rectangle(100, 10, 160, 45, 0x00ffff, 0.8)
      .setStrokeStyle(2, 0x44ffff)
      .setInteractive({ useHandCursor: true })
    const copyText = this.add.text(100, 10, "COPY TO CLIPBOARD", {
      fontFamily: "RetroPixel",
      fontSize: "13px",
      color: "#000000"
    }).setOrigin(0.5)

    const instructionText = this.add.text(0, 60, "CSV format works with Supabase Table Editor import", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#666666"
    }).setOrigin(0.5)

    // Cancel button
    const cancelBtn = this.add.rectangle(0, 90, 100, 30, 0x444444, 0.8)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
    const cancelText = this.add.text(0, 90, "CANCEL", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5)

    dialog.add([bg, titleText, subtitleText, downloadBtn, downloadText, copyBtn, copyText, instructionText, cancelBtn, cancelText])

    // Button handlers
    downloadBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.downloadCSV()
      dialog.destroy()
    })

    copyBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.copyCSVToClipboard()
      dialog.destroy()
    })

    cancelBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
    })

    // Hover effects
    downloadBtn.on("pointerover", () => downloadBtn.setFillStyle(0x44ff88))
    downloadBtn.on("pointerout", () => downloadBtn.setFillStyle(0x00ff88, 0.8))
    copyBtn.on("pointerover", () => copyBtn.setFillStyle(0x44ffff))
    copyBtn.on("pointerout", () => copyBtn.setFillStyle(0x00ffff, 0.8))
  }

  /**
   * Generate CSV data for Supabase import
   * Headers match the levels table schema exactly
   */
  generateCSVData() {
    const levelId = this.loadWorldTourLevel || this.editingLevelId || "NewLevel"
    const gridSize = 64
    
    // Build the level data structure
    const worldLevelData = {
      platforms: [],
      hazards: [],
      fragments: [],
      spawn: { x: 100, y: 600 },
      goal: { x: 1800, y: 600, width: 64, height: 64 },
      movingPlatforms: [],
      checkpoints: [],
      enemies: [],
      triggers: []
    }
    
    // Convert placed objects
    this.placedObjects.forEach(obj => {
      const x = obj.gridX * gridSize
      const y = obj.gridY * gridSize
      const width = obj.width * gridSize
      const height = obj.height * gridSize
      
      switch (obj.type) {
        case "platform":
          worldLevelData.platforms.push({ x, y, width, height, type: "solid" })
          break
        case "spike":
          worldLevelData.hazards.push({ type: "spike", x, y })
          break
        case "saw":
          worldLevelData.hazards.push({ type: "saw", x, y })
          break
        case "spawn":
          worldLevelData.spawn = { x, y, facingDirection: obj.facingDirection || "right" }
          break
        case "goal":
          worldLevelData.goal = { x, y, width: 64, height: 64 }
          break
        case "fragment_drums":
        case "fragment_bass":
        case "fragment_guitar":
        case "fragment_keyboard":
        case "fragment_microphone":
        case "fragment_note":
          worldLevelData.fragments.push({ type: obj.type.replace("fragment_", ""), x, y })
          break
        case "bonus_mixtape":
        case "bonus_cd":
        case "bonus_vinyl":
        case "bonus_waveform":
        case "bonus_recordDeal":
          worldLevelData.fragments.push({ type: obj.type.replace("bonus_", ""), x, y })
          break
        case "demo_fragment":
          worldLevelData.fragments.push({ type: "demoFragment", x, y })
          break
      }
    })

    // Parse level ID to get world/level numbers
    const parsed = parseLevelId(levelId)
    
    // Format datetime as YYYY-MM-DD HH:mm:ss
    const now = new Date()
    const formatDateTime = (date) => {
      const pad = (n) => n.toString().padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }
    const timestamp = formatDateTime(now)

    // CSV headers - must match Supabase levels table exactly
    // No special characters except hyphens and underscores
    const headers = [
      'id',
      'name', 
      'description',
      'difficulty',
      'author',
      'world_number',
      'level_number',
      'level_type',
      'settings',
      'spawn',
      'goal',
      'platforms',
      'hazards',
      'moving_platforms',
      'fragments',
      'checkpoints',
      'enemies',
      'triggers',
      'is_published',
      'created_at',
      'updated_at'
    ]

    // Determine level type string
    let levelType = null
    if (levelId === "Tutorial") {
      levelType = "tutorial"
    } else if (parsed) {
      levelType = parsed.type // 'normal', 'bonus', or 'boss'
    }

    // Build row data
    const row = [
      levelId,  // id
      this.currentLevelTitle || levelId,  // name
      '',  // description
      'Medium',  // difficulty
      'The Diminished Chord',  // author
      parsed?.world || '',  // world_number
      parsed?.level || '',  // level_number
      levelType || '',  // level_type
      JSON.stringify({
        width: this.mapWidth * gridSize,
        height: this.mapHeight * gridSize,
        tileSize: 32,
        gravity: 1200,
        backgroundColor: "#1a1a2e"
      }),  // settings (JSON)
      JSON.stringify(worldLevelData.spawn),  // spawn (JSON)
      JSON.stringify(worldLevelData.goal),  // goal (JSON)
      JSON.stringify(worldLevelData.platforms),  // platforms (JSON array)
      JSON.stringify(worldLevelData.hazards),  // hazards (JSON array)
      JSON.stringify(worldLevelData.movingPlatforms),  // moving_platforms (JSON array)
      JSON.stringify(worldLevelData.fragments),  // fragments (JSON array)
      JSON.stringify(worldLevelData.checkpoints),  // checkpoints (JSON array)
      JSON.stringify(worldLevelData.enemies),  // enemies (JSON array)
      JSON.stringify(worldLevelData.triggers),  // triggers (JSON array)
      'true',  // is_published
      timestamp,  // created_at
      timestamp   // updated_at
    ]

    return { headers, row, levelId }
  }

  /**
   * Escape CSV field value (handle quotes and commas)
   */
  escapeCSVField(value) {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\t')) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  /**
   * Download level data as CSV file
   */
  downloadCSV() {
    const { headers, row, levelId } = this.generateCSVData()
    
    // Build CSV content
    const csvContent = [
      headers.join(','),
      row.map(val => this.escapeCSVField(val)).join(',')
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${levelId}_level.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    this.statusText.setText(`Downloaded ${levelId}_level.csv`)
    this.showExportToast(`CSV file downloaded: ${levelId}_level.csv`, true)
  }

  /**
   * Copy level data as tab-separated values (TSV) for pasting into spreadsheets/Supabase
   */
  copyCSVToClipboard() {
    const { headers, row, levelId } = this.generateCSVData()
    
    // For clipboard paste into spreadsheets/Supabase, use tab-separated values
    // This is the format expected when pasting from Excel/Google Sheets
    const tsvContent = [
      headers.join('\t'),
      row.map(val => {
        // For TSV, we don't need to escape commas, just handle tabs and newlines
        if (val === null || val === undefined) return ''
        const str = String(val)
        // Replace tabs and newlines that would break TSV format
        return str.replace(/\t/g, ' ').replace(/\n/g, ' ')
      }).join('\t')
    ].join('\n')

    navigator.clipboard.writeText(tsvContent).then(() => {
      console.log("=== SUPABASE IMPORT DATA (TSV) ===")
      console.log("Paste directly into Supabase Table Editor or a spreadsheet")
      console.log(tsvContent)
      console.log("=== END SUPABASE IMPORT DATA ===")
      
      this.statusText.setText(`Level data copied to clipboard!`)
      this.showExportToast(`Copied! Paste into Supabase Table Editor`, true)
    }).catch((err) => {
      console.error("Failed to copy to clipboard:", err)
      this.statusText.setText("Copy failed - check console")
      this.showExportToast(`Copy failed: ${err.message}`, false)
    })
  }

  /**
   * Show export result toast
   */
  showExportToast(message, success) {
    const toast = this.add.container(this.cameras.main.width / 2, 80)
    toast.setDepth(1000)
    
    const bgColor = success ? 0x0a2a0a : 0x2a0a0a
    const borderColor = success ? 0xff00ff : 0xff4444
    const textColor = success ? "#ff00ff" : "#ff4444"
    const icon = success ? "✓" : "✗"
    
    const bg = this.add.rectangle(0, 0, 400, 40, bgColor, 0.95)
      .setStrokeStyle(2, borderColor)
    
    const text = this.add.text(0, 0, `${icon} ${message}`, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: textColor
    }).setOrigin(0.5)
    
    toast.add([bg, text])
    
    toast.setAlpha(0)
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        this.tweens.add({
          targets: toast,
          alpha: 0,
          duration: 500,
          delay: 3000,
          onComplete: () => toast.destroy()
        })
      }
    })
  }

  importLevel() {
    // For simplicity, prompt for JSON
    const json = prompt("Paste level JSON:")
    if (!json) return

    try {
      const data = JSON.parse(json)
      this.clearLevelSilent()
      this.mapWidth = data.mapWidth || 30
      this.mapHeight = data.mapHeight || 12
      this.currentLevelTitle = ""
      this.editingLevelId = null
      this.editingBuiltinKey = null

      data.objects.forEach(obj => {
        this.placeObjectFromData(obj)
      })

      this.hasUnsavedChanges = true
      this.updateTitleDisplay()
      this.updateUnsavedIndicator()
      this.statusText.setText("Level loaded from JSON!")
    } catch (e) {
      this.statusText.setText("Error loading level JSON")
    }
  }

  goBack() {
    if (this.hasUnsavedChanges) {
      this.showConfirmDialog(
        "UNSAVED CHANGES",
        "You have unsaved changes.\nAre you sure you want to exit?",
        () => this.scene.start("DeveloperMenuScene")
      )
    } else {
      this.scene.start("DeveloperMenuScene")
    }
  }

  /**
   * Show world/level picker for editing 301 levels
   */
  showWorldLevelPicker() {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 700, 500, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0xff69b4)
    dialog.add(bg)

    const titleText = this.add.text(0, -230, "SELECT WORLD LEVEL TO EDIT", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff69b4"
    }).setOrigin(0.5)
    dialog.add(titleText)

    // World selector
    let selectedWorld = 1
    const worldText = this.add.text(0, -190, `World ${selectedWorld}: ${WORLDS[selectedWorld].name}`, {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ff88"
    }).setOrigin(0.5)
    dialog.add(worldText)

    // World navigation arrows
    const worldPrev = this.add.text(-200, -190, "◄", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffaa00"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    worldPrev.on("pointerdown", () => {
      selectedWorld = Math.max(1, selectedWorld - 1)
      worldText.setText(`World ${selectedWorld}: ${WORLDS[selectedWorld].name}`)
      updateLevelButtons()
    })
    dialog.add(worldPrev)

    const worldNext = this.add.text(200, -190, "►", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ffaa00"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    worldNext.on("pointerdown", () => {
      selectedWorld = Math.min(15, selectedWorld + 1)
      worldText.setText(`World ${selectedWorld}: ${WORLDS[selectedWorld].name}`)
      updateLevelButtons()
    })
    dialog.add(worldNext)

    // Level buttons container
    const levelContainer = this.add.container(0, 20)
    dialog.add(levelContainer)
    const levelButtons = []

    const updateLevelButtons = () => {
      // Clear existing buttons
      levelContainer.removeAll(true)
      levelButtons.length = 0

      const startY = -120

      // Normal levels (14) - 2 rows of 7
      this.add.text(-300, startY - 30, "Normal Levels:", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#888888"
      }).setOrigin(0, 0.5)
      levelContainer.add(this.children.list[this.children.list.length - 1])

      for (let i = 1; i <= 14; i++) {
        const col = (i - 1) % 7
        const row = Math.floor((i - 1) / 7)
        const x = -280 + col * 85
        const y = startY + row * 45

        const levelId = getLevelId(selectedWorld, i, LEVEL_TYPES.NORMAL)
        const btn = this.createWorldLevelButton(levelContainer, x, y, `L${i}`, levelId, 0x4a90d9)
        levelButtons.push(btn)
      }

      // Bonus levels (5)
      this.add.text(-300, startY + 110, "Bonus Levels:", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ffaa00"
      }).setOrigin(0, 0.5)
      levelContainer.add(this.children.list[this.children.list.length - 1])

      for (let i = 1; i <= 5; i++) {
        const x = -280 + (i - 1) * 85
        const y = startY + 140

        const levelId = getLevelId(selectedWorld, i, LEVEL_TYPES.BONUS)
        const btn = this.createWorldLevelButton(levelContainer, x, y, `B${i}`, levelId, 0xffaa00)
        levelButtons.push(btn)
      }

      // Boss level
      this.add.text(-300, startY + 190, "Boss Level:", {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: "#ff4444"
      }).setOrigin(0, 0.5)
      levelContainer.add(this.children.list[this.children.list.length - 1])

      const bossLevelId = getLevelId(selectedWorld, 0, LEVEL_TYPES.BOSS)
      const bossBtn = this.createWorldLevelButton(levelContainer, -280, startY + 220, "BOSS", bossLevelId, 0xff4444)
      levelButtons.push(bossBtn)

      // Tutorial button (only show for world 1)
      if (selectedWorld === 1) {
        const tutorialBtn = this.createWorldLevelButton(levelContainer, -100, startY + 220, "TUTORIAL", "Tutorial", 0x00ff88)
        levelButtons.push(tutorialBtn)
      }
    }

    // Initial render
    updateLevelButtons()

    // Close button
    const closeBtn = this.add.text(330, -230, "✕", {
      fontFamily: "RetroPixel",
      fontSize: "24px",
      color: "#ff4444"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    closeBtn.on("pointerover", () => closeBtn.setColor("#ffffff"))
    closeBtn.on("pointerout", () => closeBtn.setColor("#ff4444"))
    closeBtn.on("pointerdown", () => {
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
    })
    dialog.add(closeBtn)
  }

  createWorldLevelButton(container, x, y, label, levelId, color) {
    const btnContainer = this.add.container(x, y)
    container.add(btnContainer)

    // Check if level has been modified
    const isModified = LevelDataManager.isLevelModified(levelId)

    const bg = this.add.rectangle(0, 0, 75, 35, isModified ? 0x2a2a4a : 0x1a1a2e, 0.9)
      .setStrokeStyle(2, color)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(0, 0, label, {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: isModified ? "#ffffff" : "#888888"
    }).setOrigin(0.5)

    // Modified indicator
    if (isModified) {
      const star = this.add.text(30, -12, "★", {
        fontFamily: "RetroPixel",
        fontSize: "10px",
        color: "#ffaa00"
      }).setOrigin(0.5)
      btnContainer.add(star)
    }

    btnContainer.add([bg, text])

    bg.on("pointerover", () => {
      bg.setStrokeStyle(3, 0xffffff)
      text.setColor("#ffffff")
    })
    bg.on("pointerout", () => {
      bg.setStrokeStyle(2, color)
      text.setColor(isModified ? "#ffffff" : "#888888")
    })
    bg.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.loadWorldLevel(levelId)
      // Find and destroy the dialog
      const dialogContainer = container.parentContainer
      if (dialogContainer) dialogContainer.destroy()
    })

    return btnContainer
  }

  /**
   * Load a world level for editing using LevelDataManager
   */
  loadWorldLevel(levelId) {
    const levelData = LevelDataManager.getLevel(levelId)
    if (!levelData) {
      this.statusText.setText("Error: Could not load level data")
      return
    }

    this.clearLevelSilent()

    // Store editing reference
    this.editingWorldLevelId = levelId
    this.editingLevelId = null
    this.editingBuiltinKey = null

    // Parse level ID for display
    const parsed = parseLevelId(levelId)
    if (levelId === "Tutorial") {
      this.currentLevelTitle = "Tutorial"
    } else if (parsed) {
      const world = WORLDS[parsed.world]
      if (parsed.type === LEVEL_TYPES.NORMAL) {
        this.currentLevelTitle = `${world.location} - Level ${parsed.level}`
      } else if (parsed.type === LEVEL_TYPES.BONUS) {
        this.currentLevelTitle = `${world.location} - Bonus ${parsed.level}`
      } else if (parsed.type === LEVEL_TYPES.BOSS) {
        this.currentLevelTitle = `${world.location} - ${world.bossName}`
      }
    }

    // Set map dimensions from level data
    this.mapWidth = Math.ceil(levelData.settings.width / this.gridSize)
    this.mapHeight = Math.ceil(levelData.settings.height / this.gridSize)

    // Rebuild grid for new size
    this.rebuildGrid()
    this.mapSizeText.setText(`Map: ${this.mapWidth}x${this.mapHeight}`)

    // Convert level data to placed objects
    this.placeObjectsFromLevelData(levelData)

    this.hasUnsavedChanges = false
    this.updateTitleDisplay()
    this.updateUnsavedIndicator()
    this.statusText.setText(`Loaded "${this.currentLevelTitle}" from World Tour`)
    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Place objects directly from LevelDataManager format (for World Tour levels)
   */
  placeObjectsFromLevelData(levelData) {
    // Spawn point
    if (levelData.spawn) {
      this.placeObjectFromData({
        type: "spawn",
        x: Math.floor(levelData.spawn.x / this.gridSize),
        y: Math.floor(levelData.spawn.y / this.gridSize),
        width: 1,
        height: 1
      })
    }

    // Goal
    if (levelData.goal) {
      this.placeObjectFromData({
        type: "goal",
        x: Math.floor(levelData.goal.x / this.gridSize),
        y: Math.floor(levelData.goal.y / this.gridSize),
        width: 1,
        height: 1
      })
    }

    // Platforms
    if (levelData.platforms) {
      levelData.platforms.forEach(plat => {
        this.placeObjectFromData({
          type: "platform",
          x: Math.floor(plat.x / this.gridSize),
          y: Math.floor(plat.y / this.gridSize),
          width: Math.ceil(plat.width / this.gridSize),
          height: Math.ceil(plat.height / this.gridSize)
        })
      })
    }

    // Fragments
    if (levelData.fragments) {
      levelData.fragments.forEach(frag => {
        let fragType = "fragment_note"
        if (frag.type.includes("drums") || frag.type.includes("drum")) fragType = "fragment_drums"
        else if (frag.type.includes("bass")) fragType = "fragment_bass"
        else if (frag.type.includes("guitar")) fragType = "fragment_guitar"

        this.placeObjectFromData({
          type: fragType,
          x: Math.floor(frag.x / this.gridSize),
          y: Math.floor(frag.y / this.gridSize),
          width: 1,
          height: 1
        })
      })
    }

    // Hazards
    if (levelData.hazards) {
      levelData.hazards.forEach(hazard => {
        let hazardType = "spike"
        if (hazard.type === "saw") hazardType = "saw"

        this.placeObjectFromData({
          type: hazardType,
          x: Math.floor(hazard.x / this.gridSize),
          y: Math.floor(hazard.y / this.gridSize),
          width: 1,
          height: 1
        })
      })
    }
  }

  /**
   * Save current level to LevelDataManager (for World Tour levels)
   */
  saveToWorldLevel() {
    if (!this.editingWorldLevelId) return

    const levelData = this.generateWorldLevelData()
    LevelDataManager.saveLevel(this.editingWorldLevelId, levelData)

    this.hasUnsavedChanges = false
    this.updateUnsavedIndicator()
    this.statusText.setText(`Saved "${this.currentLevelTitle}" to World Tour!`)
    this.sound.play("ui_confirm_sound", { volume: 0.3 })

    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Convert placed objects to LevelDataManager format
   */
  generateWorldLevelData() {
    const levelData = {
      version: 1,
      metadata: {
        name: this.currentLevelTitle,
        modified: Date.now()
      },
      settings: {
        width: this.mapWidth * this.gridSize,
        height: this.mapHeight * this.gridSize,
        tileSize: this.gridSize
      },
      spawn: { x: 100, y: 600 },
      goal: { x: 1800, y: 600, width: 64, height: 64 },
      platforms: [],
      hazards: [],
      fragments: []
    }

    this.placedObjects.forEach(obj => {
      const pixelX = obj.x * this.gridSize
      const pixelY = obj.y * this.gridSize

      switch (obj.type) {
        case "spawn":
          levelData.spawn = { x: pixelX, y: pixelY }
          break
        case "goal":
          levelData.goal = { x: pixelX, y: pixelY, width: 64, height: 64 }
          break
        case "platform":
          levelData.platforms.push({
            x: pixelX,
            y: pixelY,
            width: obj.width * this.gridSize,
            height: obj.height * this.gridSize,
            type: "solid"
          })
          break
        case "spike":
          levelData.hazards.push({ x: pixelX, y: pixelY, type: "spike" })
          break
        case "saw":
          levelData.hazards.push({ x: pixelX, y: pixelY, type: "saw" })
          break
        case "fragment_drums":
          levelData.fragments.push({ x: pixelX, y: pixelY, type: "drum_fill" })
          break
        case "fragment_bass":
          levelData.fragments.push({ x: pixelX, y: pixelY, type: "verse_stem" })
          break
        case "fragment_guitar":
          levelData.fragments.push({ x: pixelX, y: pixelY, type: "chorus_hook" })
          break
        case "fragment_note":
          levelData.fragments.push({ x: pixelX, y: pixelY, type: "intro_riff" })
          break
      }
    })

    return levelData
  }

  setupInput() {
    // Track terrain and special tool cycle indices
    this.terrainCycleIndex = 1  // Start at spike (index 1, skip platform)
    this.specialCycleIndex = 0

    this.input.keyboard.on("keydown-ESC", () => {
      // If duplicating, cancel the duplicate operation
      if (this.isDuplicating) {
        this.cancelDuplicateOperation()
      }
      // If lasso selecting, cancel it
      else if (this.isLassoSelecting) {
        this.cancelLassoSelection()
      }
      // If moving multiple objects, cancel the move
      else if (this.isMovingMultiple) {
        this.cancelMultiMove()
      }
      // If moving a single object, cancel the move instead of going back
      else if (this.movingObject) {
        this.cancelMoveOperation()
      } 
      // If multi-selection exists, clear it
      else if (this.selectedObjects.length > 0) {
        this.deselectAllObjects()
      } 
      // If single selection exists, clear it
      else if (this.selectedObject) {
        this.deselectObject()
      } else {
        this.goBack()
      }
    })

    // === POINTER TOOL ===
    // F = Pointer tool (select/move only, no placement on blank space)
    this.input.keyboard.on("keydown-F", () => {
      this.selectTool("pointer")
      this.statusText.setText("POINTER MODE - Click to select, Cmd+drag for platform, Opt+drag to duplicate")
    })

    // === MODIFIER KEYS ===
    // Track Command/Ctrl key for platform placement in pointer mode
    this.input.keyboard.on("keydown", (event) => {
      if (event.key === "Meta" || event.key === "Control") {
        this.isCommandHeld = true
        if (this.selectedTool === "pointer") {
          this.statusText.setText("POINTER + CMD - Click/drag to place platform")
        }
      }
      if (event.key === "Alt") {
        this.isOptionHeld = true
        if (this.selectedTool === "pointer" || this.selectedObject) {
          this.statusText.setText("Hold OPT + drag object to duplicate")
        }
      }
      if (event.key === " ") {
        event.preventDefault()
        this.isSpaceHeld = true
        this.game.canvas.style.cursor = "grab"
        this.statusText.setText("PAN MODE - Drag to scroll viewport")
      }
    })
    this.input.keyboard.on("keyup", (event) => {
      if (event.key === "Meta" || event.key === "Control") {
        this.isCommandHeld = false
        if (this.selectedTool === "pointer") {
          this.statusText.setText("POINTER MODE - Click to select, Cmd+drag for platform")
        }
      }
      if (event.key === "Alt") {
        this.isOptionHeld = false
        // Cancel duplicate if in progress and option released
        if (this.isDuplicating) {
          this.cancelDuplicateOperation()
        }
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      }
      if (event.key === " ") {
        this.isSpaceHeld = false
        this.isPanning = false
        this.game.canvas.style.cursor = "default"
        if (this.selectedTool === "pointer") {
          this.statusText.setText("POINTER - Click to select, Cmd+drag for platform, Opt+drag to duplicate")
        } else {
          this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
        }
      }
    })

    // === TERRAIN SHORTCUTS ===
    // P = Platform
    this.input.keyboard.on("keydown-P", () => this.selectTool("platform"))
    
    // T = Cycle through terrain hazards (spike, saws, cables)
    this.input.keyboard.on("keydown-T", () => {
      const hazardTools = this.terrainTools.filter(t => t.key !== "platform")
      this.terrainCycleIndex = (this.terrainCycleIndex + 1) % hazardTools.length
      // Handle when terrainCycleIndex points outside after platform is filtered
      if (this.terrainCycleIndex === 0) this.terrainCycleIndex = 0
      this.selectTool(hazardTools[this.terrainCycleIndex].key)
    })

    // === INSTRUMENT SHORTCUTS ===
    // D = Drums
    this.input.keyboard.on("keydown-D", () => this.selectTool("fragment_drums"))
    // G = Guitar
    this.input.keyboard.on("keydown-G", () => this.selectTool("fragment_guitar"))
    // B = Bass
    this.input.keyboard.on("keydown-B", () => this.selectTool("fragment_bass"))
    // K = Keyboard
    this.input.keyboard.on("keydown-K", () => this.selectTool("fragment_keyboard"))
    // Shift+M = Microphone (M alone is for something else potentially)
    this.input.keyboard.on("keydown-M", (event) => {
      if (event.shiftKey) {
        this.selectTool("fragment_microphone")
      }
    })
    // N = Note
    this.input.keyboard.on("keydown-N", () => this.selectTool("fragment_note"))

    // === SPECIAL SHORTCUTS ===
    // S = Cycle through special collectibles (unless Ctrl+S for save)
    this.input.keyboard.on("keydown-S", (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        if (this.editingLevelId || this.editingBuiltinKey) {
          const title = this.currentLevelTitle || "Untitled Level"
          this.performSave(title)
        } else {
          this.showSaveDialog()
        }
      } else {
        // Cycle through special tools
        this.specialCycleIndex = (this.specialCycleIndex + 1) % this.specialTools.length
        this.selectTool(this.specialTools[this.specialCycleIndex].key)
      }
    })

    // === LEVEL MARKER SHORTCUTS ===
    // 1 = Player Spawn
    this.input.keyboard.on("keydown-ONE", () => this.selectTool("spawn"))
    // 2 = Goal
    this.input.keyboard.on("keydown-TWO", () => this.selectTool("goal"))

    // === UTILITY SHORTCUTS ===
    // E = Eraser - can be used two ways:
    // 1. Quick tap to select eraser tool (stays active until another tool is selected)
    // 2. Hold E while using another tool for temporary eraser mode
    this.input.keyboard.on("keydown-E", () => {
      // If eraser is already the selected tool, do nothing special
      if (this.selectedTool === "eraser") {
        return
      }
      // Otherwise enable hold-to-erase mode for temporary erasing
      this.isEraserHeld = true
      this.game.canvas.style.cursor = "crosshair"
      this.statusText.setText("ERASER MODE (Hold E) - Release to return to " + this.selectedTool.toUpperCase())
      // Track time pressed for determining tap vs hold
      this.eraserKeyDownTime = Date.now()
    })
    this.input.keyboard.on("keyup-E", () => {
      // Check if it was a quick tap (less than 200ms) - if so, select eraser tool
      const tapDuration = Date.now() - (this.eraserKeyDownTime || 0)
      if (tapDuration < 200 && this.selectedTool !== "eraser") {
        this.selectTool("eraser")
      } else if (this.selectedTool !== "eraser") {
        // It was a hold, restore previous tool state
        this.isEraserHeld = false
        this.game.canvas.style.cursor = "default"
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      }
      this.isEraserHeld = false
    })

    // Delete/Backspace = Delete selected object(s)
    this.input.keyboard.on("keydown-DELETE", () => {
      if (this.selectedObjects.length > 0) {
        this.deleteSelectedObjects()
      } else {
        this.saveUndoState()
        this.deleteSelectedObject()
      }
    })
    this.input.keyboard.on("keydown-BACKSPACE", () => {
      if (this.selectedObjects.length > 0) {
        this.deleteSelectedObjects()
      } else {
        this.saveUndoState()
        this.deleteSelectedObject()
      }
    })

    // === UNDO/REDO SHORTCUTS ===
    // Cmd/Ctrl+Z = Undo
    this.input.keyboard.on("keydown-Z", (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        if (event.shiftKey) {
          this.redo()
        } else {
          this.undo()
        }
      }
    })

    // === COPY/PASTE SHORTCUTS ===
    // Cmd/Ctrl+C = Copy selected object(s)
    this.input.keyboard.on("keydown-C", (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        this.copySelected()
      }
    })
    
    // Cmd/Ctrl+V = Paste
    this.input.keyboard.on("keydown-V", (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        this.paste()
      }
    })
    
    // === ZOOM SHORTCUTS ===
    // + or = = Zoom in
    this.input.keyboard.on("keydown-PLUS", () => {
      this.setZoom(this.zoomLevel + 0.25)
    })
    this.input.keyboard.on("keydown-NUMPAD_ADD", () => {
      this.setZoom(this.zoomLevel + 0.25)
    })
    // Use raw keydown for = key since Phaser doesn't have EQUALS
    this.input.keyboard.on("keydown", (event) => {
      if (event.key === "=" && !event.ctrlKey && !event.metaKey) {
        this.setZoom(this.zoomLevel + 0.25)
      }
    })
    
    // - = Zoom out
    this.input.keyboard.on("keydown-MINUS", () => {
      this.setZoom(this.zoomLevel - 0.25)
    })
    this.input.keyboard.on("keydown-NUMPAD_SUBTRACT", () => {
      this.setZoom(this.zoomLevel - 0.25)
    })
    
    // 0 = Reset zoom to fit
    this.input.keyboard.on("keydown-ZERO", (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        this.resetZoom()
      }
    })
    
    // === ARROW KEY MOVEMENT/PANNING ===
    // Arrow keys: Navigate menus when focused, or move selected object(s), or pan viewport
    
    this.input.keyboard.on("keydown-LEFT", () => {
      // If menu is focused, left key exits menu focus
      if (this.menuFocus) {
        this.clearMenuFocus()
        return
      }
      if (this.selectedObjects.length > 0) {
        this.moveSelectedObjectsByTiles(-1, 0)
      } else if (this.selectedObject) {
        this.moveSelectedObjectByTiles(-1, 0)
      } else {
        this.panViewportByTiles(-1, 0)
      }
    })
    this.input.keyboard.on("keydown-RIGHT", () => {
      // If menu is focused, right key exits menu focus
      if (this.menuFocus) {
        this.clearMenuFocus()
        return
      }
      if (this.selectedObjects.length > 0) {
        this.moveSelectedObjectsByTiles(1, 0)
      } else if (this.selectedObject) {
        this.moveSelectedObjectByTiles(1, 0)
      } else {
        this.panViewportByTiles(1, 0)
      }
    })
    this.input.keyboard.on("keydown-UP", () => {
      // If menu is focused, navigate up in menu
      if (this.menuFocus) {
        this.navigateMenuUp()
        return
      }
      if (this.selectedObjects.length > 0) {
        this.moveSelectedObjectsByTiles(0, -1)
      } else if (this.selectedObject) {
        this.moveSelectedObjectByTiles(0, -1)
      } else {
        this.panViewportByTiles(0, -1)
      }
    })
    this.input.keyboard.on("keydown-DOWN", () => {
      // If menu is focused, navigate down in menu
      if (this.menuFocus) {
        this.navigateMenuDown()
        return
      }
      if (this.selectedObjects.length > 0) {
        this.moveSelectedObjectsByTiles(0, 1)
      } else if (this.selectedObject) {
        this.moveSelectedObjectByTiles(0, 1)
      } else {
        this.panViewportByTiles(0, 1)
      }
    })
    
    // ENTER key = Confirm menu selection when menu is focused
    this.input.keyboard.on("keydown-ENTER", () => {
      if (this.menuFocus) {
        this.confirmMenuSelection()
      }
    })
    
    // === QUICK TEST SHORTCUT ===
    // Semicolon (;) = Quick test level - same key as returning from test for rapid iteration
    this.input.keyboard.on("keydown-SEMICOLON", () => {
      this.testLevel()
    })
    
    // === CONTROLLER MENU NAVIGATION ===
    // Controller support for accessing menus in Level Designer
    // L button (mapped to /) = Focus left tools menu
    // R button (mapped to Q) = Focus right actions menu
    
    // Initialize menu focus state
    this.menuFocus = null  // null = grid, "tools" = left tools menu, "actions" = right actions menu
    this.selectedToolIndex = 0  // Selected index in tools menu
    this.selectedActionIndex = 0  // Selected index in actions menu
    
    // Forward slash (/) = L button - Focus left tools menu
    this.input.keyboard.on("keydown-FORWARD_SLASH", () => {
      this.focusToolsMenu()
    })
    
    // Q = R button - Focus right actions menu (when not using as modifier)
    this.input.keyboard.on("keydown-Q", (event) => {
      // Only focus actions menu if Q is pressed alone (not with ctrl/cmd)
      if (!event.ctrlKey && !event.metaKey) {
        this.focusActionsMenu()
      }
    })
    
    // === PALETTE CLICK HANDLER ===
    // Handle clicks on palette tool buttons (workaround for container+mask input issues)
    this.input.on("pointerdown", (pointer) => {
      if (!this.paletteInfo || !this.paletteBounds) return
      
      // Only handle left clicks
      if (pointer.rightButtonDown()) return
      
      // Check if click is in palette bounds
      const paletteX = this.paletteInfo.x
      if (pointer.x < paletteX - 80 || pointer.x > paletteX + 80) return
      if (pointer.y < this.paletteBounds.y || pointer.y > this.paletteBounds.y + this.paletteBounds.height) return
      
      // Calculate click position relative to the scrollable container
      const relativeY = pointer.y - this.paletteContainer.y
      
      // Find the tool at this position
      for (const tool of this.tools) {
        const toolY = tool.y
        // Each tool button is 24px tall, check if click is within button bounds
        if (relativeY >= toolY - 12 && relativeY <= toolY + 12) {
          this.selectTool(tool.key)
          this.sound.play("ui_select_sound", { volume: 0.2 })
          return
        }
      }
    })
  }

  /**
   * Show track upload dialog for changing level background music
   */
  showTrackUploadDialog() {
    const dialog = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
    dialog.setDepth(1000)

    const bg = this.add.rectangle(0, 0, 500, 350, 0x0a0a1a, 0.98)
      .setStrokeStyle(2, 0xff00ff)

    const titleText = this.add.text(0, -150, "CHANGE LEVEL SOUNDTRACK", {
      fontFamily: "RetroPixel",
      fontSize: "20px",
      color: "#ff00ff"
    }).setOrigin(0.5)

    // Current track display
    const currentTrackName = this.levelSoundtrackName || "Default Track"
    const currentLabel = this.add.text(0, -100, `Current: ${currentTrackName}`, {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#888888"
    }).setOrigin(0.5)

    // Drop zone visual
    const dropZone = this.add.rectangle(0, 0, 400, 120, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0x444466, 1)

    const dropText = this.add.text(0, -20, "DRAG & DROP AUDIO FILE HERE", {
      fontFamily: "RetroPixel",
      fontSize: "16px",
      color: "#00ffff"
    }).setOrigin(0.5)

    const formatText = this.add.text(0, 15, "Supported: MP3, WAV, OGG", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#666666"
    }).setOrigin(0.5)

    // Or click to browse
    const browseBtn = this.add.rectangle(0, 80, 200, 40, 0x00ffff, 0.2)
      .setStrokeStyle(2, 0x00ffff)
      .setInteractive({ useHandCursor: true })
    
    const browseText = this.add.text(0, 80, "CLICK TO BROWSE", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#00ffff"
    }).setOrigin(0.5)

    // Close button
    const closeBtn = this.add.rectangle(0, 140, 120, 35, 0x666666, 0.8)
      .setStrokeStyle(2, 0x888888)
      .setInteractive({ useHandCursor: true })
    
    const closeText = this.add.text(0, 140, "CLOSE", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: "#ffffff"
    }).setOrigin(0.5)

    dialog.add([bg, titleText, currentLabel, dropZone, dropText, formatText, browseBtn, browseText, closeBtn, closeText])

    // Create hidden file input
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = "audio/*"
    fileInput.style.display = "none"
    document.body.appendChild(fileInput)

    // Browse button click
    browseBtn.on("pointerdown", () => {
      fileInput.click()
    })

    browseBtn.on("pointerover", () => {
      browseBtn.setFillStyle(0x00ffff, 0.4)
    })
    browseBtn.on("pointerout", () => {
      browseBtn.setFillStyle(0x00ffff, 0.2)
    })

    // File selected
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0]
      if (file) {
        this.handleTrackUpload(file, dialog, currentLabel)
      }
    })

    // Drag and drop handlers
    const gameCanvas = this.game.canvas
    
    const dragOverHandler = (e) => {
      e.preventDefault()
      dropZone.setStrokeStyle(3, 0x00ff88)
      dropText.setColor("#00ff88")
    }
    
    const dragLeaveHandler = (e) => {
      e.preventDefault()
      dropZone.setStrokeStyle(2, 0x444466)
      dropText.setColor("#00ffff")
    }
    
    const dropHandler = (e) => {
      e.preventDefault()
      dropZone.setStrokeStyle(2, 0x444466)
      dropText.setColor("#00ffff")
      
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith("audio/")) {
        this.handleTrackUpload(file, dialog, currentLabel)
      } else {
        dropText.setText("Invalid file type!")
        dropText.setColor("#ff4444")
        this.time.delayedCall(2000, () => {
          dropText.setText("DRAG & DROP AUDIO FILE HERE")
          dropText.setColor("#00ffff")
        })
      }
    }

    gameCanvas.addEventListener("dragover", dragOverHandler)
    gameCanvas.addEventListener("dragleave", dragLeaveHandler)
    gameCanvas.addEventListener("drop", dropHandler)

    // Close button
    closeBtn.on("pointerdown", () => {
      // Clean up event listeners
      gameCanvas.removeEventListener("dragover", dragOverHandler)
      gameCanvas.removeEventListener("dragleave", dragLeaveHandler)
      gameCanvas.removeEventListener("drop", dropHandler)
      document.body.removeChild(fileInput)
      
      this.sound.play("ui_select_sound", { volume: 0.2 })
      dialog.destroy()
    })
  }

  /**
   * Handle uploaded track file
   */
  handleTrackUpload(file, dialog, currentLabel) {
    // Create object URL for the audio file
    const audioUrl = URL.createObjectURL(file)
    
    // Store the track info
    this.levelSoundtrackUrl = audioUrl
    this.levelSoundtrackName = file.name.replace(/\.[^/.]+$/, "")  // Remove extension
    this.levelSoundtrackFile = file  // Keep reference for saving
    
    // Update display
    currentLabel.setText(`Current: ${this.levelSoundtrackName}`)
    currentLabel.setColor("#00ff88")
    
    // Mark as unsaved
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    
    // Show success feedback
    this.statusText.setText(`Track loaded: ${this.levelSoundtrackName}`)
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    
    this.time.delayedCall(2000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Delete the currently selected object
   */
  deleteSelectedObject() {
    if (!this.selectedObject) return
    
    // Find and remove the object
    const index = this.placedObjects.indexOf(this.selectedObject)
    if (index > -1) {
      this.selectedObject.visual.destroy()
      if (this.selectionHighlight) {
        this.selectionHighlight.destroy()
        this.selectionHighlight = null
      }
      this.placedObjects.splice(index, 1)
      this.selectedObject = null
      
      this.hasUnsavedChanges = true
      this.updateUnsavedIndicator()
      this.updateCollectibleCount()
      this.sound.play("ui_select_sound", { volume: 0.2 })
      this.statusText.setText("Object deleted")
      this.time.delayedCall(1000, () => {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      })
    }
  }

  /**
   * Deselect the currently selected object
   */
  deselectObject() {
    if (this.selectionHighlight) {
      this.selectionHighlight.destroy()
      this.selectionHighlight = null
    }
    this.selectedObject = null
  }

  // ==================== CONTROLLER MENU FOCUS SYSTEM ====================
  
  /**
   * Focus the left tools menu for controller navigation
   * L button (/) activates this
   */
  focusToolsMenu() {
    // If already focused on tools, clear focus
    if (this.menuFocus === "tools") {
      this.clearMenuFocus()
      return
    }
    
    this.menuFocus = "tools"
    this.selectedToolIndex = this.tools.findIndex(t => t.key === this.selectedTool)
    if (this.selectedToolIndex < 0) this.selectedToolIndex = 0
    
    // Update visual highlighting
    this.updateToolsMenuHighlight()
    
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.statusText.setText("TOOLS MENU - Use UP/DOWN to navigate, ENTER to select, / to exit")
  }
  
  /**
   * Focus the right actions menu for controller navigation
   * R button (Q) activates this
   */
  focusActionsMenu() {
    // If already focused on actions, clear focus
    if (this.menuFocus === "actions") {
      this.clearMenuFocus()
      return
    }
    
    this.menuFocus = "actions"
    this.selectedActionIndex = 0
    
    // Update visual highlighting
    this.updateActionsMenuHighlight()
    
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.statusText.setText("ACTIONS MENU - Use UP/DOWN to navigate, ENTER to select, Q to exit")
  }
  
  /**
   * Clear menu focus and return to grid editing mode
   */
  clearMenuFocus() {
    this.menuFocus = null
    
    // Clear any visual highlights
    this.clearMenuHighlights()
    
    this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
  }
  
  /**
   * Update visual highlighting for tools menu
   */
  updateToolsMenuHighlight() {
    // Clear previous highlights
    this.clearMenuHighlights()
    
    // Highlight the selected tool
    if (this.tools && this.tools[this.selectedToolIndex]) {
      const tool = this.tools[this.selectedToolIndex]
      if (tool.bg) {
        tool.bg.setStrokeStyle(3, 0xffffff)
      }
      tool.setScale(1.08)
      
      // Scroll to make selected item visible
      this.scrollPaletteToIndex(this.selectedToolIndex)
    }
  }
  
  /**
   * Update visual highlighting for actions menu
   */
  updateActionsMenuHighlight() {
    // Clear previous highlights
    this.clearMenuHighlights()
    
    // Actions menu highlighting will be handled via button backgrounds
    // We need to add visual indicators to the action buttons
    if (this.actionButtons && this.actionButtons[this.selectedActionIndex]) {
      const btn = this.actionButtons[this.selectedActionIndex]
      if (btn.bg) {
        btn.bg.setStrokeStyle(3, 0xffffff)
      }
    }
  }
  
  /**
   * Clear all menu visual highlights
   */
  clearMenuHighlights() {
    // Reset tool button styles
    if (this.tools) {
      this.tools.forEach((tool, index) => {
        if (tool.bg) {
          // Keep selected tool highlighted, others reset
          if (tool.key === this.selectedTool) {
            tool.bg.setStrokeStyle(3, 0xffffff)
            tool.setScale(1.05)
          } else {
            tool.bg.setStrokeStyle(1, tool.color)
            tool.setScale(1)
          }
        }
      })
    }
    
    // Reset action button styles
    if (this.actionButtons) {
      this.actionButtons.forEach(btn => {
        if (btn.bg && btn.color) {
          btn.bg.setStrokeStyle(2, btn.color)
        }
      })
    }
  }
  
  /**
   * Scroll the palette to make a specific index visible
   */
  scrollPaletteToIndex(index) {
    if (!this.tools || !this.paletteContainer) return
    
    const tool = this.tools[index]
    if (!tool) return
    
    const itemY = tool.y
    const visibleHeight = 560  // Approximate visible height
    
    // If item is above visible area, scroll up
    if (itemY - this.paletteScrollY < 0) {
      this.paletteScrollY = Math.max(0, itemY - 20)
    }
    // If item is below visible area, scroll down
    else if (itemY - this.paletteScrollY > visibleHeight) {
      this.paletteScrollY = itemY - visibleHeight + 40
    }
    
    // Apply scroll position
    const maxScroll = Math.max(0, this.paletteContentHeight - 560)
    this.paletteScrollY = Phaser.Math.Clamp(this.paletteScrollY, 0, maxScroll)
    this.paletteContainer.y = (360 - 310 + 40) - this.paletteScrollY
    this.updateScrollIndicators()
  }
  
  /**
   * Navigate up in the currently focused menu (with cycling)
   */
  navigateMenuUp() {
    if (this.menuFocus === "tools") {
      // Cycle to bottom if at top
      if (this.selectedToolIndex <= 0) {
        this.selectedToolIndex = this.tools.length - 1
      } else {
        this.selectedToolIndex--
      }
      this.updateToolsMenuHighlight()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    } else if (this.menuFocus === "actions") {
      // Cycle to bottom if at top
      if (this.selectedActionIndex <= 0) {
        this.selectedActionIndex = this.actionButtons.length - 1
      } else {
        this.selectedActionIndex--
      }
      this.updateActionsMenuHighlight()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    }
  }
  
  /**
   * Navigate down in the currently focused menu (with cycling)
   */
  navigateMenuDown() {
    if (this.menuFocus === "tools") {
      // Cycle to top if at bottom
      if (this.selectedToolIndex >= this.tools.length - 1) {
        this.selectedToolIndex = 0
      } else {
        this.selectedToolIndex++
      }
      this.updateToolsMenuHighlight()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    } else if (this.menuFocus === "actions") {
      // Cycle to top if at bottom
      if (this.selectedActionIndex >= this.actionButtons.length - 1) {
        this.selectedActionIndex = 0
      } else {
        this.selectedActionIndex++
      }
      this.updateActionsMenuHighlight()
      this.sound.play("ui_select_sound", { volume: 0.2 })
    }
  }
  
  /**
   * Confirm selection in the currently focused menu
   */
  confirmMenuSelection() {
    if (this.menuFocus === "tools") {
      const tool = this.tools[this.selectedToolIndex]
      if (tool) {
        this.selectTool(tool.key)
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.clearMenuFocus()
      }
    } else if (this.menuFocus === "actions") {
      const action = this.actionButtons[this.selectedActionIndex]
      if (action && action.callback) {
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
        this.clearMenuFocus()
        action.callback()
      }
    }
  }

  // ==================== UNDO/REDO SYSTEM ====================
  
  /**
   * Save current state to undo stack
   */
  saveUndoState() {
    // Create a snapshot of current placed objects
    const state = this.placedObjects.map(obj => ({
      type: obj.type,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      movement: obj.movement ? { ...obj.movement } : undefined
    }))
    
    this.undoStack.push(state)
    
    // Limit undo stack size
    if (this.undoStack.length > this.maxUndoStates) {
      this.undoStack.shift()
    }
    
    // Clear redo stack on new action
    this.redoStack = []
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0) {
      this.statusText.setText("Nothing to undo")
      this.time.delayedCall(1000, () => {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      })
      return
    }

    // Save current state to redo stack
    const currentState = this.placedObjects.map(obj => ({
      type: obj.type,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      movement: obj.movement ? { ...obj.movement } : undefined
    }))
    this.redoStack.push(currentState)

    // Restore previous state
    const previousState = this.undoStack.pop()
    this.restoreState(previousState)
    
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.statusText.setText("Undo successful")
    this.time.delayedCall(1000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.redoStack.length === 0) {
      this.statusText.setText("Nothing to redo")
      this.time.delayedCall(1000, () => {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      })
      return
    }

    // Save current state to undo stack
    const currentState = this.placedObjects.map(obj => ({
      type: obj.type,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      movement: obj.movement ? { ...obj.movement } : undefined
    }))
    this.undoStack.push(currentState)

    // Restore next state
    const nextState = this.redoStack.pop()
    this.restoreState(nextState)
    
    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.statusText.setText("Redo successful")
    this.time.delayedCall(1000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Restore a saved state
   */
  restoreState(state) {
    // Clear current objects
    this.placedObjects.forEach(obj => obj.visual.destroy())
    this.placedObjects = []
    
    // Deselect any selection
    this.deselectObject()
    
    // Recreate objects from state
    state.forEach(objData => {
      this.placeObjectFromData(objData)
    })
    
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    this.updateCollectibleCount()
  }

  // ==================== COPY/PASTE SYSTEM ====================

  /**
   * Copy selected object(s) to clipboard
   */
  copySelected() {
    if (!this.selectedObject) {
      this.statusText.setText("No object selected to copy")
      this.time.delayedCall(1000, () => {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      })
      return
    }

    // Store a copy of the selected object data
    this.clipboard = {
      type: this.selectedObject.type,
      width: this.selectedObject.width,
      height: this.selectedObject.height,
      movement: this.selectedObject.movement ? { ...this.selectedObject.movement } : undefined
    }

    this.sound.play("ui_select_sound", { volume: 0.2 })
    this.statusText.setText(`Copied: ${this.selectedObject.type.toUpperCase()}`)
    this.time.delayedCall(1000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Paste from clipboard
   */
  paste() {
    if (!this.clipboard) {
      this.statusText.setText("Clipboard is empty")
      this.time.delayedCall(1000, () => {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      })
      return
    }

    // Get mouse position in grid coordinates
    const displayScale = this.currentDisplayScale
    const pointer = this.input.activePointer
    const gridX = Math.floor((pointer.x - 180) / (this.gridSize * displayScale))
    const gridY = Math.floor((pointer.y - 80) / (this.gridSize * displayScale))

    // Clamp to grid bounds
    const x = Math.max(0, Math.min(this.mapWidth - this.clipboard.width, gridX))
    const y = Math.max(0, Math.min(this.mapHeight - this.clipboard.height, gridY))

    // Save state for undo
    this.saveUndoState()

    // Create the new object
    const objData = {
      type: this.clipboard.type,
      x: x,
      y: y,
      width: this.clipboard.width,
      height: this.clipboard.height,
      movement: this.clipboard.movement ? { ...this.clipboard.movement } : undefined
    }
    
    this.placeObjectFromData(objData)
    
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.statusText.setText(`Pasted: ${this.clipboard.type.toUpperCase()}`)
    this.time.delayedCall(1000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  /**
   * Duplicate selected object at offset position
   */
  duplicateSelected() {
    if (!this.selectedObject) {
      this.statusText.setText("No object selected to duplicate")
      this.time.delayedCall(1000, () => {
        this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
      })
      return
    }

    // Save state for undo
    this.saveUndoState()

    // Create duplicate at offset position
    const offsetX = 1
    const offsetY = 0
    const newX = Math.min(this.mapWidth - this.selectedObject.width, this.selectedObject.x + offsetX)
    const newY = Math.min(this.mapHeight - this.selectedObject.height, this.selectedObject.y + offsetY)

    const objData = {
      type: this.selectedObject.type,
      x: newX,
      y: newY,
      width: this.selectedObject.width,
      height: this.selectedObject.height,
      movement: this.selectedObject.movement ? { ...this.selectedObject.movement } : undefined
    }
    
    this.placeObjectFromData(objData)
    
    this.hasUnsavedChanges = true
    this.updateUnsavedIndicator()
    this.sound.play("ui_confirm_sound", { volume: 0.3 })
    this.statusText.setText(`Duplicated: ${this.selectedObject.type.toUpperCase()}`)
    this.time.delayedCall(1000, () => {
      this.statusText.setText(`Selected: ${this.selectedTool.toUpperCase()}`)
    })
  }

  // ==================== CONTEXT MENU ====================

  /**
   * Show right-click context menu
   */
  showContextMenu(pointer) {
    // Remove existing context menu if any
    if (this.contextMenu) {
      this.contextMenu.destroy()
      this.contextMenu = null
    }

    const displayScale = this.currentDisplayScale
    const gridX = Math.floor((pointer.x - 180) / (this.gridSize * displayScale))
    const gridY = Math.floor((pointer.y - 80) / (this.gridSize * displayScale))

    // Check if clicking on an object
    const clickedObject = this.getObjectAt(gridX, gridY)
    
    // Create menu container at pointer position
    this.contextMenu = this.add.container(pointer.x, pointer.y)
    this.contextMenu.setDepth(2000)

    const menuItems = []
    
    if (clickedObject) {
      // Select the clicked object
      this.selectObjectForMove(clickedObject, gridX, gridY)
      
      // Menu for object
      menuItems.push({ label: "Delete", color: 0xff4444, action: () => {
        this.saveUndoState()
        this.deleteSelectedObject()
      }})
      menuItems.push({ label: "Copy", color: 0x00ffff, action: () => this.copySelected() })
      menuItems.push({ label: "Duplicate", color: 0x00ff88, action: () => this.duplicateSelected() })
    } else if (this.clipboard) {
      // Menu for empty space with clipboard
      menuItems.push({ label: "Paste Here", color: 0x00ff88, action: () => {
        // Paste at this specific position
        this.saveUndoState()
        const objData = {
          type: this.clipboard.type,
          x: Math.max(0, Math.min(this.mapWidth - this.clipboard.width, gridX)),
          y: Math.max(0, Math.min(this.mapHeight - this.clipboard.height, gridY)),
          width: this.clipboard.width,
          height: this.clipboard.height,
          movement: this.clipboard.movement ? { ...this.clipboard.movement } : undefined
        }
        this.placeObjectFromData(objData)
        this.hasUnsavedChanges = true
        this.updateUnsavedIndicator()
        this.sound.play("ui_confirm_sound", { volume: 0.3 })
      }})
    }

    if (menuItems.length === 0) {
      // No menu to show
      this.contextMenu.destroy()
      this.contextMenu = null
      return
    }

    // Build menu UI
    const menuWidth = 120
    const itemHeight = 28
    const menuHeight = menuItems.length * itemHeight + 8

    const bg = this.add.rectangle(0, menuHeight / 2, menuWidth, menuHeight, 0x1a1a2e, 0.98)
      .setStrokeStyle(2, 0x444466)
      .setOrigin(0, 0)
    this.contextMenu.add(bg)

    menuItems.forEach((item, index) => {
      const y = 4 + index * itemHeight + itemHeight / 2
      
      const itemBg = this.add.rectangle(menuWidth / 2, y, menuWidth - 4, itemHeight - 2, 0x2a2a3e, 0)
        .setInteractive({ useHandCursor: true })
      
      const itemText = this.add.text(10, y, item.label, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: Phaser.Display.Color.IntegerToColor(item.color).rgba
      }).setOrigin(0, 0.5)
      
      itemBg.on("pointerover", () => {
        itemBg.setFillStyle(0x3a3a4e, 1)
        itemText.setColor("#ffffff")
      })
      itemBg.on("pointerout", () => {
        itemBg.setFillStyle(0x2a2a3e, 0)
        itemText.setColor(Phaser.Display.Color.IntegerToColor(item.color).rgba)
      })
      itemBg.on("pointerdown", () => {
        item.action()
        this.closeContextMenu()
      })
      
      this.contextMenu.add([itemBg, itemText])
    })

    // Close menu when clicking elsewhere
    this.input.once("pointerdown", (p) => {
      // Small delay to allow menu item click to process
      this.time.delayedCall(50, () => {
        this.closeContextMenu()
      })
    })
  }

  /**
   * Close context menu
   */
  closeContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.destroy()
      this.contextMenu = null
    }
  }
}
