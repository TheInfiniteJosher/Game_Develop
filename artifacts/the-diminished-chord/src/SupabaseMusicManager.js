/**
 * SupabaseMusicManager - Manages music tracks and level assignments from Supabase
 * 
 * This integrates with:
 * - music_tracks: The full music library
 * - level_track_assignments: Which track plays on which level
 * - worlds: World-specific ambient tracks
 */

import { supabase } from "./integrations/supabase/client.js"

// Storage bucket name for music tracks
const MUSIC_BUCKET = "music-tracks"

class SupabaseMusicManagerClass {
  constructor() {
    this.tracks = new Map() // trackId -> track data
    this.levelAssignments = new Map() // levelId -> assignment data
    this.worldAmbient = new Map() // worldNumber -> track data
    this.isInitialized = false
    this.initPromise = null
  }
  
  /**
   * Initialize by loading from Supabase
   */
  async initialize() {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise
    
    this.initPromise = this._doInitialize()
    return this.initPromise
  }
  
  async _doInitialize() {
    try {
      await Promise.all([
        this.loadTracks(),
        this.loadLevelAssignments(),
        this.loadWorldAmbient()
      ])
      
      this.isInitialized = true
      console.log("[SupabaseMusicManager] Initialized", {
        tracks: this.tracks.size,
        levelAssignments: this.levelAssignments.size
      })
    } catch (e) {
      console.error("[SupabaseMusicManager] Initialization failed:", e)
      // Reset initPromise so we can retry on next call
      this.initPromise = null
      throw e
    }
  }
  
  /**
   * Load all music tracks from Supabase
   */
  async loadTracks() {
    try {
      const { data, error } = await supabase
        .from('music_tracks')
        .select('*')
        .order('name')
      
      if (error) {
        console.warn("[SupabaseMusicManager] Track load error:", error.message)
        return
      }
      
      if (data) {
        data.forEach(track => {
          this.tracks.set(track.id, {
            id: track.id,
            name: track.name,
            artist: track.artist,
            album: track.album,
            genre: track.genre,
            mood: track.mood,
            bpm: track.bpm,
            duration: track.duration_seconds,
            fileUrl: track.file_url,
            fileFormat: track.file_format,
            unlockedByDefault: track.unlocked_by_default,
            unlockCondition: track.unlock_condition
          })
        })
        console.log(`[SupabaseMusicManager] Loaded ${data.length} tracks`)
      }
    } catch (e) {
      console.error("[SupabaseMusicManager] Track load error:", e)
    }
  }
  
  /**
   * Load level-to-track assignments from Supabase
   */
  async loadLevelAssignments() {
    try {
      const { data, error } = await supabase
        .from('level_track_assignments')
        .select(`
          *,
          music_tracks (
            id, name, artist, file_url, file_format
          )
        `)
      
      if (error) {
        console.warn("[SupabaseMusicManager] Assignment load error:", error.message)
        return
      }
      
      if (data) {
        data.forEach(assignment => {
          this.levelAssignments.set(assignment.level_id, {
            id: assignment.id,
            levelId: assignment.level_id,
            trackId: assignment.track_id,
            track: assignment.music_tracks,
            volume: assignment.volume || 0.6,
            loop: assignment.loop !== false,
            fadeInSeconds: assignment.fade_in_seconds || 0,
            fadeOutSeconds: assignment.fade_out_seconds || 1,
            startOffset: assignment.start_offset_seconds || 0,
            priority: assignment.priority || 0
          })
        })
        console.log(`[SupabaseMusicManager] Loaded ${data.length} level assignments`)
      }
    } catch (e) {
      console.error("[SupabaseMusicManager] Assignment load error:", e)
    }
  }
  
  /**
   * Load world ambient track assignments
   */
  async loadWorldAmbient() {
    try {
      const { data, error } = await supabase
        .from('worlds')
        .select(`
          world_number,
          ambient_track_id,
          music_tracks (
            id, name, file_url
          )
        `)
        .not('ambient_track_id', 'is', null)
      
      if (error) {
        console.warn("[SupabaseMusicManager] World ambient load error:", error.message)
        return
      }
      
      if (data) {
        data.forEach(world => {
          if (world.music_tracks) {
            this.worldAmbient.set(world.world_number, world.music_tracks)
          }
        })
        console.log(`[SupabaseMusicManager] Loaded ${data.length} world ambient tracks`)
      }
    } catch (e) {
      console.error("[SupabaseMusicManager] World ambient load error:", e)
    }
  }
  
  /**
   * Force reload all data from Supabase (clears cache and re-fetches)
   */
  async forceReload() {
    console.log("[SupabaseMusicManager] Force reloading...")
    this.tracks.clear()
    this.levelAssignments.clear()
    this.worldAmbient.clear()
    this.isInitialized = false
    this.initPromise = null
    await this.initialize()
  }

  /**
   * Get the music track assignment for a level
   */
  getLevelTrack(levelId) {
    return this.levelAssignments.get(levelId) || null
  }
  
  /**
   * Get a track by ID
   */
  getTrack(trackId) {
    return this.tracks.get(trackId) || null
  }
  
  /**
   * Get all tracks
   */
  getAllTracks() {
    return Array.from(this.tracks.values())
  }
  
  /**
   * Get tracks by genre
   */
  getTracksByGenre(genre) {
    return this.getAllTracks().filter(t => t.genre === genre)
  }
  
  /**
   * Get tracks by mood
   */
  getTracksByMood(mood) {
    return this.getAllTracks().filter(t => t.mood === mood)
  }
  
  /**
   * Add a new music track to Supabase
   */
  async addTrack(trackData) {
    try {
      const { data, error } = await supabase
        .from('music_tracks')
        .insert({
          name: trackData.name,
          artist: trackData.artist || "The Diminished Chord",
          album: trackData.album || null,
          genre: trackData.genre || null,
          mood: trackData.mood || null,
          bpm: trackData.bpm || null,
          duration_seconds: trackData.duration || null,
          file_url: trackData.fileUrl,
          file_format: trackData.fileFormat || "mp3",
          unlocked_by_default: trackData.unlockedByDefault || false,
          unlock_condition: trackData.unlockCondition || null
        })
        .select()
        .single()
      
      if (error) throw new Error(error.message)
      
      // Add to local cache
      this.tracks.set(data.id, {
        id: data.id,
        ...trackData
      })
      
      console.log(`[SupabaseMusicManager] Added track: ${trackData.name}`)
      return { success: true, data }
    } catch (e) {
      console.error("[SupabaseMusicManager] Add track error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Assign a track to a level
   */
  async assignTrackToLevel(levelId, trackId, options = {}) {
    try {
      console.log(`[SupabaseMusicManager] Assigning track ${trackId} to level ${levelId}`)
      
      // First, check if an assignment already exists
      const { data: existing } = await supabase
        .from('level_track_assignments')
        .select('id')
        .eq('level_id', levelId)
        .single()
      
      let result
      
      if (existing) {
        // Update existing assignment
        const { data, error } = await supabase
          .from('level_track_assignments')
          .update({
            track_id: trackId,
            volume: options.volume || 0.6,
            loop: options.loop !== false,
            fade_in_seconds: options.fadeIn || 0,
            fade_out_seconds: options.fadeOut || 1,
            start_offset_seconds: options.startOffset || 0,
            priority: options.priority || 0,
            updated_at: new Date().toISOString()
          })
          .eq('level_id', levelId)
          .select(`
            *,
            music_tracks (id, name, artist, file_url)
          `)
          .single()
        
        if (error) {
          console.error("[SupabaseMusicManager] Update error details:", error)
          throw new Error(error.message || error.details || JSON.stringify(error))
        }
        result = data
      } else {
        // Insert new assignment
        const { data, error } = await supabase
          .from('level_track_assignments')
          .insert({
            level_id: levelId,
            track_id: trackId,
            volume: options.volume || 0.6,
            loop: options.loop !== false,
            fade_in_seconds: options.fadeIn || 0,
            fade_out_seconds: options.fadeOut || 1,
            start_offset_seconds: options.startOffset || 0,
            priority: options.priority || 0
          })
          .select(`
            *,
            music_tracks (id, name, artist, file_url)
          `)
          .single()
        
        if (error) {
          console.error("[SupabaseMusicManager] Insert error details:", error)
          throw new Error(error.message || error.details || JSON.stringify(error))
        }
        result = data
      }
      
      // Update local cache
      this.levelAssignments.set(levelId, {
        id: result.id,
        levelId: levelId,
        trackId: trackId,
        track: result.music_tracks,
        volume: result.volume,
        loop: result.loop,
        fadeInSeconds: result.fade_in_seconds,
        fadeOutSeconds: result.fade_out_seconds,
        startOffset: result.start_offset_seconds,
        priority: result.priority
      })
      
      console.log(`[SupabaseMusicManager] Successfully assigned track to level: ${levelId}`)
      return { success: true, data: result }
    } catch (e) {
      const errorMsg = e?.message || e?.toString() || "Unknown error occurred"
      console.error("[SupabaseMusicManager] Assign track error:", errorMsg, e)
      return { success: false, error: errorMsg }
    }
  }
  
  /**
   * Remove track assignment from a level
   */
  async removeTrackFromLevel(levelId) {
    try {
      const { error } = await supabase
        .from('level_track_assignments')
        .delete()
        .eq('level_id', levelId)
      
      if (error) throw new Error(error.message)
      
      this.levelAssignments.delete(levelId)
      console.log(`[SupabaseMusicManager] Removed track from level: ${levelId}`)
      return { success: true }
    } catch (e) {
      console.error("[SupabaseMusicManager] Remove track error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Update a track's metadata
   */
  async updateTrack(trackId, updates) {
    try {
      const { error } = await supabase
        .from('music_tracks')
        .update({
          name: updates.name,
          artist: updates.artist,
          album: updates.album,
          genre: updates.genre,
          mood: updates.mood,
          bpm: updates.bpm,
          duration_seconds: updates.duration,
          file_url: updates.fileUrl
        })
        .eq('id', trackId)
      
      if (error) throw new Error(error.message)
      
      // Update local cache
      const track = this.tracks.get(trackId)
      if (track) {
        Object.assign(track, updates)
      }
      
      console.log(`[SupabaseMusicManager] Updated track: ${trackId}`)
      return { success: true }
    } catch (e) {
      console.error("[SupabaseMusicManager] Update track error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Delete a track from Supabase
   */
  async deleteTrack(trackId) {
    try {
      const { error } = await supabase
        .from('music_tracks')
        .delete()
        .eq('id', trackId)
      
      if (error) throw new Error(error.message)
      
      this.tracks.delete(trackId)
      console.log(`[SupabaseMusicManager] Deleted track: ${trackId}`)
      return { success: true }
    } catch (e) {
      console.error("[SupabaseMusicManager] Delete track error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Upload an audio file to Supabase Storage and create a track record
   * @param {File} file - The audio file to upload
   * @param {Object} metadata - Track metadata (name, artist, genre, etc.)
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async uploadTrack(file, metadata = {}) {
    try {
      // Generate a unique filename
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const filePath = `${timestamp}_${safeName}`
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(MUSIC_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        })
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from(MUSIC_BUCKET)
        .getPublicUrl(filePath)
      
      const publicUrl = urlData.publicUrl
      
      // Extract file format from extension
      const fileFormat = file.name.split(".").pop()?.toLowerCase() || "mp3"
      
      // Create the track record in the database
      const trackData = {
        name: metadata.name || file.name.replace(/\.[^/.]+$/, ""),
        artist: metadata.artist || "The Diminished Chord",
        album: metadata.album || null,
        genre: metadata.genre || null,
        mood: metadata.mood || null,
        bpm: metadata.bpm || null,
        fileUrl: publicUrl,
        fileFormat: fileFormat,
        unlockedByDefault: metadata.unlockedByDefault || false,
        unlockCondition: metadata.unlockCondition || null
      }
      
      const result = await this.addTrack(trackData)
      
      if (result.success) {
        console.log(`[SupabaseMusicManager] Uploaded and created track: ${trackData.name}`)
        return { success: true, data: result.data, url: publicUrl }
      } else {
        // If database insert failed, try to clean up the uploaded file
        await supabase.storage.from(MUSIC_BUCKET).remove([filePath])
        throw new Error(result.error)
      }
    } catch (e) {
      console.error("[SupabaseMusicManager] Upload track error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Delete a track's audio file from storage
   * @param {string} fileUrl - The public URL of the file to delete
   */
  async deleteTrackFile(fileUrl) {
    try {
      // Extract the file path from the URL
      const urlParts = fileUrl.split(`${MUSIC_BUCKET}/`)
      if (urlParts.length < 2) {
        throw new Error("Invalid file URL")
      }
      const filePath = urlParts[1]
      
      const { error } = await supabase.storage
        .from(MUSIC_BUCKET)
        .remove([filePath])
      
      if (error) throw new Error(error.message)
      
      console.log(`[SupabaseMusicManager] Deleted file: ${filePath}`)
      return { success: true }
    } catch (e) {
      console.error("[SupabaseMusicManager] Delete file error:", e)
      return { success: false, error: e.message }
    }
  }
  
  /**
   * Get a signed URL for a track (for private buckets)
   * @param {string} filePath - The path to the file in storage
   * @param {number} expiresIn - Seconds until URL expires (default 1 hour)
   */
  async getSignedUrl(filePath, expiresIn = 3600) {
    const { data, error } = await supabase.storage
      .from(MUSIC_BUCKET)
      .createSignedUrl(filePath, expiresIn)
    
    if (error) {
      console.error("[SupabaseMusicManager] Signed URL error:", error)
      return null
    }
    
    return data.signedUrl
  }
}

export const SupabaseMusicManager = new SupabaseMusicManagerClass()
