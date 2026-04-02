import Phaser from "phaser"
import { supabase } from "./integrations/supabase/client.js"

/**
 * AdConfigEditorScene - Comprehensive ad management UI
 * 
 * Manages all advertising settings stored in Supabase ad_config table:
 * - Ad placement timing and frequency
 * - Interstitial ad settings
 * - Rewarded ad configuration
 * - Ad-skip credit system
 * - Premium/subscription settings
 * - Revenue optimization options
 */
export class AdConfigEditorScene extends Phaser.Scene {
  constructor() {
    super({ key: "AdConfigEditorScene" })
  }

  create() {
    this.centerX = this.cameras.main.width / 2
    this.centerY = this.cameras.main.height / 2

    // Background
    this.createBackground()

    // Title
    this.add.text(this.centerX, 40, "AD CONFIGURATION", {
      fontFamily: "RetroPixel",
      fontSize: "28px",
      color: "#00ff88"
    }).setOrigin(0.5)

    this.add.text(this.centerX, 70, "Manage advertising settings & monetization", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#888888"
    }).setOrigin(0.5)

    // Status text
    this.statusText = this.add.text(this.centerX, 95, "Loading...", {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffaa00"
    }).setOrigin(0.5)

    // Content container for scrolling
    this.contentContainer = this.add.container(0, 0)
    this.scrollY = 0

    // Create back button
    this.createBackButton()

    // Load config from Supabase
    this.loadAdConfig()

    // Setup input
    this.setupInput()
  }

  createBackground() {
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x0a0a1a)
      .setOrigin(0, 0)

    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x1a3a1a, 0.3)
    
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

  async loadAdConfig() {
    try {
      const { data, error } = await supabase
        .from('ad_config')
        .select('*')
        .order('config_key')

      if (error) throw error

      this.adConfigs = data || []
      this.statusText.setText(`☁️ Connected - ${this.adConfigs.length} settings loaded`)
      this.statusText.setColor("#00ff88")

      // If no configs exist, seed with defaults
      if (this.adConfigs.length === 0) {
        await this.seedDefaultConfigs()
      }

      this.renderConfigPanel()
    } catch (e) {
      console.error("Failed to load ad config:", e)
      this.statusText.setText("⚠️ Failed to load - " + e.message)
      this.statusText.setColor("#ff4444")
      
      // Show offline mode with local defaults
      this.adConfigs = this.getDefaultConfigs()
      this.renderConfigPanel()
    }
  }

  getDefaultConfigs() {
    return [
      // Core Ad Settings
      { config_key: "ads_enabled", config_value: { enabled: true }, description: "Master switch for all advertisements", is_active: true },
      { config_key: "interstitial_enabled", config_value: { enabled: true }, description: "Show interstitial ads between levels", is_active: true },
      { config_key: "interstitial_frequency", config_value: { levels: 3 }, description: "Show interstitial every N levels", is_active: true },
      { config_key: "rewarded_ads_enabled", config_value: { enabled: true }, description: "Enable rewarded video ads for bonuses", is_active: true },
      
      // Ad Timing
      { config_key: "min_time_between_ads", config_value: { seconds: 120 }, description: "Minimum seconds between any ads", is_active: true },
      { config_key: "first_ad_delay", config_value: { levels: 2 }, description: "Levels to play before first ad", is_active: true },
      { config_key: "ad_cooldown_after_purchase", config_value: { hours: 24 }, description: "Hours of no ads after any purchase", is_active: true },
      
      // Ad-Skip Credit System
      { config_key: "ad_skip_enabled", config_value: { enabled: true }, description: "Allow players to earn ad-skip credits", is_active: true },
      { config_key: "hole_in_one_reward", config_value: { credits: 1, enabled: true }, description: "Credits for completing level without dying", is_active: true },
      { config_key: "speedrun_reward", config_value: { credits: 1, enabled: true }, description: "Credits for beating level under target time", is_active: true },
      { config_key: "max_skip_credits", config_value: { max: 10 }, description: "Maximum ad-skip credits player can hold", is_active: true },
      
      // Premium/Subscription
      { config_key: "premium_removes_ads", config_value: { enabled: true }, description: "Premium subscription removes all ads", is_active: true },
      { config_key: "premium_price_monthly", config_value: { usd: 2.99 }, description: "Monthly premium subscription price", is_active: true },
      { config_key: "premium_price_yearly", config_value: { usd: 19.99 }, description: "Yearly premium subscription price", is_active: true },
      { config_key: "one_time_ad_removal", config_value: { usd: 4.99, enabled: true }, description: "One-time purchase to remove ads forever", is_active: true },
      
      // Rewarded Ad Bonuses
      { config_key: "rewarded_extra_life", config_value: { enabled: true }, description: "Watch ad to get extra life/continue", is_active: true },
      { config_key: "rewarded_double_fragments", config_value: { enabled: true, duration_levels: 3 }, description: "Watch ad to double fragment collection", is_active: true },
      { config_key: "rewarded_unlock_bonus_level", config_value: { enabled: true }, description: "Watch ad to unlock bonus level early", is_active: true },
      { config_key: "rewarded_skip_credits", config_value: { credits: 2 }, description: "Ad-skip credits earned from rewarded ad", is_active: true },
      
      // Ad Provider Settings
      { config_key: "ad_provider", config_value: { provider: "adsense", backup: "none" }, description: "Primary ad provider (adsense/admob)", is_active: true },
      { config_key: "adsense_client_id", config_value: { id: "" }, description: "Google AdSense client ID", is_active: true },
      { config_key: "adsense_slot_interstitial", config_value: { slot: "" }, description: "AdSense slot ID for interstitials", is_active: true },
      { config_key: "adsense_slot_rewarded", config_value: { slot: "" }, description: "AdSense slot ID for rewarded ads", is_active: true },
      
      // Analytics & Optimization
      { config_key: "track_ad_revenue", config_value: { enabled: true }, description: "Track ad impressions and estimated revenue", is_active: true },
      { config_key: "ab_test_frequency", config_value: { enabled: false, variant: "A" }, description: "A/B test different ad frequencies", is_active: true },
      { config_key: "geo_targeting", config_value: { enabled: false, rules: {} }, description: "Different ad rules by region", is_active: true },
    ]
  }

  async seedDefaultConfigs() {
    this.statusText.setText("Seeding default configs...")
    this.statusText.setColor("#ffaa00")

    const defaults = this.getDefaultConfigs()
    
    try {
      const { error } = await supabase
        .from('ad_config')
        .insert(defaults)

      if (error) throw error

      // Reload after seeding
      const { data } = await supabase
        .from('ad_config')
        .select('*')
        .order('config_key')

      this.adConfigs = data || []
      this.statusText.setText(`✓ Seeded ${this.adConfigs.length} default settings`)
      this.statusText.setColor("#00ff88")
    } catch (e) {
      console.error("Failed to seed configs:", e)
      this.statusText.setText("⚠️ Seed failed - using local defaults")
      this.statusText.setColor("#ff4444")
      this.adConfigs = defaults
    }
  }

  renderConfigPanel() {
    this.contentContainer.removeAll(true)

    const startY = 130
    const sectionSpacing = 35
    let currentY = startY

    // Group configs by category
    const categories = {
      "CORE AD SETTINGS": ["ads_enabled", "interstitial_enabled", "interstitial_frequency", "rewarded_ads_enabled"],
      "AD TIMING": ["min_time_between_ads", "first_ad_delay", "ad_cooldown_after_purchase"],
      "AD-SKIP CREDITS": ["ad_skip_enabled", "hole_in_one_reward", "speedrun_reward", "max_skip_credits"],
      "PREMIUM & SUBSCRIPTION": ["premium_removes_ads", "premium_price_monthly", "premium_price_yearly", "one_time_ad_removal"],
      "REWARDED AD BONUSES": ["rewarded_extra_life", "rewarded_double_fragments", "rewarded_unlock_bonus_level", "rewarded_skip_credits"],
      "AD PROVIDER": ["ad_provider", "adsense_client_id", "adsense_slot_interstitial", "adsense_slot_rewarded"],
      "ANALYTICS": ["track_ad_revenue", "ab_test_frequency", "geo_targeting"]
    }

    const categoryColors = {
      "CORE AD SETTINGS": "#00ff88",
      "AD TIMING": "#00ffff",
      "AD-SKIP CREDITS": "#ffaa00",
      "PREMIUM & SUBSCRIPTION": "#ff69b4",
      "REWARDED AD BONUSES": "#aa44ff",
      "AD PROVIDER": "#ff4444",
      "ANALYTICS": "#8888ff"
    }

    for (const [category, keys] of Object.entries(categories)) {
      // Category header
      const headerBg = this.add.rectangle(this.centerX, currentY, 700, 28, 0x1a2a1a, 0.9)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(categoryColors[category]).color)
      this.contentContainer.add(headerBg)

      const headerText = this.add.text(this.centerX, currentY, category, {
        fontFamily: "RetroPixel",
        fontSize: "12px",
        color: categoryColors[category]
      }).setOrigin(0.5)
      this.contentContainer.add(headerText)

      currentY += sectionSpacing

      // Config items in this category
      for (const key of keys) {
        const config = this.adConfigs.find(c => c.config_key === key)
        if (config) {
          this.createConfigRow(currentY, config, categoryColors[category])
          currentY += 32
        }
      }

      currentY += 15 // Gap between sections
    }

    // Save All button
    currentY += 20
    this.createSaveAllButton(currentY)

    // Set up scrolling
    this.maxScrollY = Math.max(0, currentY - this.cameras.main.height + 150)
    
    // Create scroll mask
    const maskShape = this.add.graphics()
    maskShape.fillStyle(0xffffff)
    maskShape.fillRect(0, 115, this.cameras.main.width, this.cameras.main.height - 165)
    maskShape.setVisible(false)
    const mask = maskShape.createGeometryMask()
    this.contentContainer.setMask(mask)
  }

  createConfigRow(y, config, accentColor) {
    const rowContainer = this.add.container(this.centerX, y)
    this.contentContainer.add(rowContainer)

    // Background
    const bg = this.add.rectangle(0, 0, 680, 28, 0x0a0a1a, 0.8)
      .setStrokeStyle(1, 0x333355)
    rowContainer.add(bg)

    // Config key (left side)
    const keyText = this.add.text(-330, 0, config.config_key, {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ffffff"
    }).setOrigin(0, 0.5)
    rowContainer.add(keyText)

    // Description (middle)
    const descText = this.add.text(-100, 0, config.description || "", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: "#666666"
    }).setOrigin(0, 0.5)
    rowContainer.add(descText)

    // Value editor (right side)
    this.createValueEditor(rowContainer, config, accentColor)

    // Active toggle
    const activeColor = config.is_active ? "#00ff88" : "#ff4444"
    const activeText = this.add.text(320, 0, config.is_active ? "●" : "○", {
      fontFamily: "RetroPixel",
      fontSize: "14px",
      color: activeColor
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    
    activeText.on("pointerdown", async () => {
      config.is_active = !config.is_active
      activeText.setText(config.is_active ? "●" : "○")
      activeText.setColor(config.is_active ? "#00ff88" : "#ff4444")
      await this.saveConfig(config)
    })
    rowContainer.add(activeText)
  }

  createValueEditor(container, config, accentColor) {
    const value = config.config_value
    const x = 220

    // Determine value type and create appropriate editor
    if (typeof value === 'object') {
      // Check for common patterns
      if ('enabled' in value) {
        // Boolean toggle
        const toggleBg = this.add.rectangle(x, 0, 60, 20, value.enabled ? 0x00aa44 : 0x442222, 0.9)
          .setStrokeStyle(1, value.enabled ? 0x00ff88 : 0xff4444)
          .setInteractive({ useHandCursor: true })
        
        const toggleText = this.add.text(x, 0, value.enabled ? "ON" : "OFF", {
          fontFamily: "RetroPixel",
          fontSize: "10px",
          color: value.enabled ? "#00ff88" : "#ff4444"
        }).setOrigin(0.5)

        toggleBg.on("pointerdown", async () => {
          value.enabled = !value.enabled
          toggleBg.setFillStyle(value.enabled ? 0x00aa44 : 0x442222)
          toggleBg.setStrokeStyle(1, value.enabled ? 0x00ff88 : 0xff4444)
          toggleText.setText(value.enabled ? "ON" : "OFF")
          toggleText.setColor(value.enabled ? "#00ff88" : "#ff4444")
          await this.saveConfig(config)
        })

        container.add([toggleBg, toggleText])

        // If there are additional numeric values, show them
        const numericKeys = Object.keys(value).filter(k => k !== 'enabled' && typeof value[k] === 'number')
        if (numericKeys.length > 0) {
          const numKey = numericKeys[0]
          this.createNumberInput(container, x + 80, value, numKey, config, accentColor)
        }
      } else if ('levels' in value || 'seconds' in value || 'credits' in value || 'hours' in value || 'max' in value || 'usd' in value) {
        // Single numeric value
        const numKey = Object.keys(value).find(k => typeof value[k] === 'number')
        if (numKey) {
          this.createNumberInput(container, x, value, numKey, config, accentColor)
        }
      } else if ('id' in value || 'slot' in value || 'provider' in value) {
        // String input
        const strKey = Object.keys(value).find(k => typeof value[k] === 'string')
        if (strKey) {
          this.createStringDisplay(container, x, value, strKey, config, accentColor)
        }
      } else {
        // Generic JSON display
        const jsonText = this.add.text(x, 0, JSON.stringify(value).substring(0, 30) + "...", {
          fontFamily: "RetroPixel",
          fontSize: "9px",
          color: "#888888"
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
        
        jsonText.on("pointerdown", () => this.editJsonValue(config))
        container.add(jsonText)
      }
    }
  }

  createNumberInput(container, x, valueObj, key, config, accentColor) {
    const currentVal = valueObj[key]
    
    // Decrease button
    const decBtn = this.add.text(x - 30, 0, "◀", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: accentColor
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    // Value display
    const valText = this.add.text(x, 0, `${currentVal}`, {
      fontFamily: "RetroPixel",
      fontSize: "11px",
      color: "#ffffff"
    }).setOrigin(0.5)

    // Unit label
    const unitText = this.add.text(x + 25, 0, key, {
      fontFamily: "RetroPixel",
      fontSize: "8px",
      color: "#555555"
    }).setOrigin(0, 0.5)

    // Increase button
    const incBtn = this.add.text(x + 60, 0, "▶", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: accentColor
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    decBtn.on("pointerdown", async () => {
      const step = key === 'usd' ? 0.5 : 1
      valueObj[key] = Math.max(0, valueObj[key] - step)
      valText.setText(`${valueObj[key]}`)
      await this.saveConfig(config)
    })

    incBtn.on("pointerdown", async () => {
      const step = key === 'usd' ? 0.5 : 1
      valueObj[key] = valueObj[key] + step
      valText.setText(`${valueObj[key]}`)
      await this.saveConfig(config)
    })

    container.add([decBtn, valText, unitText, incBtn])
  }

  createStringDisplay(container, x, valueObj, key, config, accentColor) {
    const currentVal = valueObj[key] || "(not set)"
    
    const strBg = this.add.rectangle(x + 30, 0, 120, 18, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x333355)
      .setInteractive({ useHandCursor: true })

    const strText = this.add.text(x + 30, 0, currentVal.substring(0, 15) || "click to set", {
      fontFamily: "RetroPixel",
      fontSize: "9px",
      color: currentVal ? "#ffffff" : "#555555"
    }).setOrigin(0.5)

    strBg.on("pointerdown", () => {
      const newVal = prompt(`Enter ${key}:`, valueObj[key] || "")
      if (newVal !== null) {
        valueObj[key] = newVal
        strText.setText(newVal.substring(0, 15) || "click to set")
        strText.setColor(newVal ? "#ffffff" : "#555555")
        this.saveConfig(config)
      }
    })

    container.add([strBg, strText])
  }

  editJsonValue(config) {
    const currentJson = JSON.stringify(config.config_value, null, 2)
    const newJson = prompt(`Edit JSON for ${config.config_key}:`, currentJson)
    
    if (newJson !== null) {
      try {
        config.config_value = JSON.parse(newJson)
        this.saveConfig(config)
        this.renderConfigPanel() // Re-render to show changes
      } catch (e) {
        alert("Invalid JSON: " + e.message)
      }
    }
  }

  async saveConfig(config) {
    try {
      if (config.id) {
        // Update existing
        const { error } = await supabase
          .from('ad_config')
          .update({
            config_value: config.config_value,
            is_active: config.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id)

        if (error) throw error
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('ad_config')
          .insert({
            config_key: config.config_key,
            config_value: config.config_value,
            description: config.description,
            is_active: config.is_active
          })
          .select()
          .single()

        if (error) throw error
        config.id = data.id
      }

      this.showSaveStatus("✓ Saved", "#00ff88")
    } catch (e) {
      console.error("Save error:", e)
      this.showSaveStatus("✗ Save failed", "#ff4444")
    }
  }

  showSaveStatus(message, color) {
    this.statusText.setText(message)
    this.statusText.setColor(color)

    // Reset after delay
    this.time.delayedCall(2000, () => {
      this.statusText.setText(`☁️ Connected - ${this.adConfigs.length} settings`)
      this.statusText.setColor("#00ff88")
    })
  }

  createSaveAllButton(y) {
    const btnBg = this.add.rectangle(this.centerX, y, 200, 40, 0x00aa44, 0.9)
      .setStrokeStyle(2, 0x00ff88)
      .setInteractive({ useHandCursor: true })
    this.contentContainer.add(btnBg)

    const btnText = this.add.text(this.centerX, y, "💾 SAVE ALL CHANGES", {
      fontFamily: "RetroPixel",
      fontSize: "12px",
      color: "#ffffff"
    }).setOrigin(0.5)
    this.contentContainer.add(btnText)

    btnBg.on("pointerdown", async () => {
      btnText.setText("Saving...")
      
      try {
        for (const config of this.adConfigs) {
          await this.saveConfig(config)
        }
        btnText.setText("✓ All Saved!")
        this.time.delayedCall(2000, () => btnText.setText("💾 SAVE ALL CHANGES"))
      } catch (e) {
        btnText.setText("✗ Error!")
        this.time.delayedCall(2000, () => btnText.setText("💾 SAVE ALL CHANGES"))
      }
    })

    btnBg.on("pointerover", () => btnBg.setStrokeStyle(3, 0xffffff))
    btnBg.on("pointerout", () => btnBg.setStrokeStyle(2, 0x00ff88))

    // Add Reset to Defaults button
    const resetBg = this.add.rectangle(this.centerX, y + 50, 160, 30, 0x442222, 0.9)
      .setStrokeStyle(1, 0xff4444)
      .setInteractive({ useHandCursor: true })
    this.contentContainer.add(resetBg)

    const resetText = this.add.text(this.centerX, y + 50, "Reset to Defaults", {
      fontFamily: "RetroPixel",
      fontSize: "10px",
      color: "#ff4444"
    }).setOrigin(0.5)
    this.contentContainer.add(resetText)

    resetBg.on("pointerdown", async () => {
      if (confirm("Reset all ad settings to defaults? This cannot be undone.")) {
        // Delete all existing configs
        await supabase.from('ad_config').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await this.seedDefaultConfigs()
        this.renderConfigPanel()
      }
    })
  }

  createBackButton() {
    const backBtn = this.add.text(30, this.cameras.main.height - 40, "< BACK", {
      fontFamily: "RetroPixel",
      fontSize: "18px",
      color: "#666666"
    })
    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"))
    backBtn.on("pointerout", () => backBtn.setColor("#666666"))
    backBtn.on("pointerdown", () => {
      this.sound.play("ui_confirm_sound", { volume: 0.3 })
      this.scene.start("DeveloperMenuScene")
    })

    // ESC key
    this.input.keyboard.on("keydown-ESC", () => this.scene.start("DeveloperMenuScene"))
  }

  setupInput() {
    // Mouse wheel scrolling
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollY = Phaser.Math.Clamp(
        this.scrollY + (deltaY > 0 ? 40 : -40),
        0,
        this.maxScrollY || 0
      )
      this.contentContainer.y = -this.scrollY
    })

    // Arrow keys for scrolling
    this.input.keyboard.on("keydown-UP", () => {
      this.scrollY = Math.max(0, this.scrollY - 40)
      this.contentContainer.y = -this.scrollY
    })

    this.input.keyboard.on("keydown-DOWN", () => {
      this.scrollY = Math.min(this.maxScrollY || 0, this.scrollY + 40)
      this.contentContainer.y = -this.scrollY
    })
  }
}
