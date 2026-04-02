/**
 * SoundEffectManager - Manages game sound effects from Supabase
 * 
 * Features:
 * - Loads sound effects from Supabase database
 * - Supports sound variations (multiple sounds for same action)
 * - Caches sounds for performance
 * - Respects volume and overlap settings
 */

import { supabase } from "./integrations/supabase/client.js"

// Storage bucket name for sound effects
const SOUNDS_BUCKET = "sound-effects"

class SoundEffectManagerClass {
  constructor() {
    this.sounds = new Map() // key -> sound config
    this.variationGroups = new Map() // group -> [keys]
    this.loadedSounds = new Map() // key -> Phaser sound object
    this.isInitialized = false
    this.initPromise = null
    this.scene = null
  }
  
  /**
   * Initialize the sound effect manager
   */
  async initialize() {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise
    
    this.initPromise = this._doInitialize()
    return this.initPromise
  }
  
  async _doInitialize() {
    try {
      const { data, error } = await supabase
        .from('sound_effects')
        .select('*')
        .order('category')
      
      if (error) {
        console.warn("[SoundEffectManager] Supabase error:", error.message)
        return
      }
      
      if (data) {
        data.forEach(sound => {
          this.sounds.set(sound.key, {
            id: sound.id,
            key: sound.key,
            name: sound.name,
            category: sound.category,
            fileUrl: sound.file_url,
            volume: sound.default_volume || 0.3,
            allowOverlap: sound.allow_overlap !== false,
            maxInstances: sound.max_instances || 3,
            variationGroup: sound.variation_group,
            variationWeight: sound.variation_weight || 1
          })
          
          // Track variation groups
          if (sound.variation_group) {
            if (!this.variationGroups.has(sound.variation_group)) {
              this.variationGroups.set(sound.variation_group, [])
            }
            this.variationGroups.get(sound.variation_group).push(sound.key)
          }
        })
        
        console.log(`[SoundEffectManager] Loaded ${data.length} sound effects from Supabase`)
      }
      
      this.isInitialized = true
    } catch (e) {
      console.error("[SoundEffectManager] Init error:", e)
    }
  }
  
  /**
   * Set the active Phaser scene for sound playback
   */
  setScene(scene) {
    this.scene = scene
  }
  
  /**
   * Load a sound effect into the Phaser sound system
   */
  loadSound(scene, key) {
    const config = this.sounds.get(key)
    if (!config) {
      console.warn(`[SoundEffectManager] Sound not found: ${key}`)
      return false
    }
    
    // Load the audio file
    scene.load.audio(key, config.fileUrl)
    return true
  }
  
  /**
   * Load all sounds in a category
   */
  loadCategory(scene, category) {
    const keys = []
    this.sounds.forEach((config, key) => {
      if (config.category === category) {
        this.loadSound(scene, key)
        keys.push(key)
      }
    })
    return keys
  }
  
  /**
   * Load all sound effects
   */
  loadAll(scene) {
    this.sounds.forEach((config, key) => {
      this.loadSound(scene, key)
    })
  }
  
  /**
   * Play a sound effect
   * If the sound has variations, randomly picks one
   */
  play(scene, key, volumeMultiplier = 1) {
    // Check for variation group
    const config = this.sounds.get(key)
    if (config?.variationGroup) {
      const variations = this.variationGroups.get(config.variationGroup)
      if (variations && variations.length > 0) {
        // Weighted random selection
        key = this.selectWeightedVariation(variations)
      }
    }
    
    const soundConfig = this.sounds.get(key)
    if (!soundConfig) {
      // Fall back to trying to play directly (for bundled sounds)
      try {
        scene.sound.play(key, { volume: 0.3 * volumeMultiplier })
        return true
      } catch (e) {
        console.warn(`[SoundEffectManager] Sound not found: ${key}`)
        return false
      }
    }
    
    const volume = soundConfig.volume * volumeMultiplier
    
    try {
      scene.sound.play(key, { volume })
      return true
    } catch (e) {
      console.warn(`[SoundEffectManager] Failed to play: ${key}`, e)
      return false
    }
  }
  
  /**
   * Select a weighted random variation
   */
  selectWeightedVariation(keys) {
    const weights = keys.map(key => this.sounds.get(key)?.variationWeight || 1)
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    let random = Math.random() * totalWeight
    
    for (let i = 0; i < keys.length; i++) {
      random -= weights[i]
      if (random <= 0) return keys[i]
    }
    
    return keys[0]
  }
  
  /**
   * Get all sounds in a category
   */
  getSoundsByCategory(category) {
    const result = []
    this.sounds.forEach((config, key) => {
      if (config.category === category) {
        result.push(config)
      }
    })
    return result
  }
  
  /**
   * Get all categories
   */
  getCategories() {
    const categories = new Set()
    this.sounds.forEach(config => {
      if (config.category) categories.add(config.category)
    })
    return Array.from(categories)
  }
  
  /**
   * Add a new sound effect to Supabase
   */
  async addSound(soundData) {
    try {
      const { data, error } = await supabase
        .from('sound_effects')
        .insert({
          key: soundData.key,
          name: soundData.name,
          category: soundData.category,
          file_url: soundData.fileUrl,
          description: soundData.description || null,
          default_volume: soundData.volume || 0.3,
          allow_overlap: soundData.allowOverlap !== false,
          max_instances: soundData.maxInstances || 3,
          variation_group: soundData.variationGroup || null,
          variation_weight: soundData.variationWeight || 1
        })
        .select()
        .single()
      
      if (error) throw new Error(error.message)
      
      // Add to local cache
      this.sounds.set(soundData.key, {
        id: data.id,
        ...soundData
      })
      
      console.log(`[SoundEffectManager] Added sound: ${soundData.key}`)
      return { success: true, data }
    } catch (e) {
      console.error("[SoundEffectManager] Add error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Update a sound effect in Supabase
   */
  async updateSound(key, updates) {
    const config = this.sounds.get(key)
    if (!config?.id) {
      return { success: false, error: "Sound not found" }
    }
    
    try {
      const { error } = await supabase
        .from('sound_effects')
        .update({
          name: updates.name,
          file_url: updates.fileUrl,
          description: updates.description,
          default_volume: updates.volume,
          category: updates.category,
          variation_group: updates.variationGroup,
          variation_weight: updates.variationWeight
        })
        .eq('id', config.id)
      
      if (error) throw new Error(error.message)
      
      // Update local cache
      Object.assign(config, updates)
      
      console.log(`[SoundEffectManager] Updated sound: ${key}`)
      return { success: true }
    } catch (e) {
      console.error("[SoundEffectManager] Update error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Delete a sound effect from Supabase
   */
  async deleteSound(key) {
    const config = this.sounds.get(key)
    if (!config?.id) {
      return { success: false, error: "Sound not found" }
    }
    
    try {
      const { error } = await supabase
        .from('sound_effects')
        .delete()
        .eq('id', config.id)
      
      if (error) throw new Error(error.message)
      
      // Remove from local cache
      this.sounds.delete(key)
      
      console.log(`[SoundEffectManager] Deleted sound: ${key}`)
      return { success: true }
    } catch (e) {
      console.error("[SoundEffectManager] Delete error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Upload a sound effect file to Supabase Storage and create a record
   * @param {File} file - The audio file to upload
   * @param {Object} metadata - Sound effect metadata
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async uploadSound(file, metadata = {}) {
    try {
      // Generate a unique filename
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const filePath = `${timestamp}_${safeName}`
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SOUNDS_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        })
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from(SOUNDS_BUCKET)
        .getPublicUrl(filePath)
      
      const publicUrl = urlData.publicUrl
      
      // Generate a key from filename if not provided
      const baseName = file.name.replace(/\.[^/.]+$/, "")
      const key = metadata.key || baseName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
      
      // Create the sound effect record
      const soundData = {
        key: key,
        name: metadata.name || baseName,
        category: metadata.category || "custom",
        fileUrl: publicUrl,
        description: metadata.description || null,
        volume: metadata.volume || 0.3,
        allowOverlap: metadata.allowOverlap !== false,
        maxInstances: metadata.maxInstances || 3,
        variationGroup: metadata.variationGroup || null,
        variationWeight: metadata.variationWeight || 1
      }
      
      const result = await this.addSound(soundData)
      
      if (result.success) {
        console.log(`[SoundEffectManager] Uploaded and created sound: ${soundData.name}`)
        return { success: true, data: result.data, url: publicUrl }
      } else {
        // If database insert failed, try to clean up the uploaded file
        await supabase.storage.from(SOUNDS_BUCKET).remove([filePath])
        throw new Error(result.error)
      }
    } catch (e) {
      console.error("[SoundEffectManager] Upload sound error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Delete a sound effect's audio file from storage
   * @param {string} fileUrl - The public URL of the file to delete
   */
  async deleteSoundFile(fileUrl) {
    try {
      // Extract the file path from the URL
      const urlParts = fileUrl.split(`${SOUNDS_BUCKET}/`)
      if (urlParts.length < 2) {
        throw new Error("Invalid file URL")
      }
      const filePath = urlParts[1]
      
      const { error } = await supabase.storage
        .from(SOUNDS_BUCKET)
        .remove([filePath])
      
      if (error) throw new Error(error.message)
      
      console.log(`[SoundEffectManager] Deleted file: ${filePath}`)
      return { success: true }
    } catch (e) {
      console.error("[SoundEffectManager] Delete file error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Bulk upload multiple sound effects (useful for variation groups)
   * @param {FileList|File[]} files - Array of audio files
   * @param {string} variationGroup - Group name for all sounds
   * @param {string} category - Category for all sounds
   */
  async uploadVariationGroup(files, variationGroup, category = "custom") {
    const results = []
    
    for (const file of files) {
      const result = await this.uploadSound(file, {
        variationGroup,
        category,
        variationWeight: 1
      })
      results.push(result)
    }
    
    const successful = results.filter(r => r.success).length
    console.log(`[SoundEffectManager] Uploaded ${successful}/${files.length} sounds to group: ${variationGroup}`)
    
    return {
      success: successful === files.length,
      results,
      successCount: successful,
      totalCount: files.length
    }
  }
}

export const SoundEffectManager = new SoundEffectManagerClass()
