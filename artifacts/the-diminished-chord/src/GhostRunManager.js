/**
 * GhostRunManager - Handles recording and playback of ghost runs
 * 
 * Records player input and position data during gameplay,
 * then allows playback as a "ghost" for racing/comparison.
 */

export class GhostRunManager {
  constructor() {
    this.isRecording = false
    this.isPlaying = false
    this.recordedInputs = []
    this.recordedPositions = []
    this.playbackIndex = 0
    this.recordStartTime = 0
    this.playbackStartTime = 0
    this.sampleRate = 50 // Record position every 50ms
    this.lastSampleTime = 0
  }

  /**
   * Start recording a ghost run
   */
  startRecording() {
    this.isRecording = true
    this.recordedInputs = []
    this.recordedPositions = []
    this.recordStartTime = Date.now()
    this.lastSampleTime = 0
    console.log("[GhostRunManager] Recording started")
  }

  /**
   * Stop recording and return the ghost data
   * @returns {object} Ghost run data
   */
  stopRecording() {
    this.isRecording = false
    const duration = Date.now() - this.recordStartTime
    
    console.log("[GhostRunManager] Recording stopped:", {
      inputs: this.recordedInputs.length,
      positions: this.recordedPositions.length,
      duration
    })

    return {
      inputs: this.compressInputs(this.recordedInputs),
      positions: this.compressPositions(this.recordedPositions),
      duration
    }
  }

  /**
   * Record a frame of input
   * @param {number} time - Time since start in ms
   * @param {object} input - Input state { left, right, up, down, jump, etc }
   */
  recordInput(time, input) {
    if (!this.isRecording) return

    // Only record if input state changed
    const lastInput = this.recordedInputs[this.recordedInputs.length - 1]
    if (lastInput && this.inputsEqual(lastInput.input, input)) {
      return
    }

    this.recordedInputs.push({
      time,
      input: { ...input }
    })
  }

  /**
   * Record player position
   * @param {number} time - Time since start in ms
   * @param {number} x - Player X position
   * @param {number} y - Player Y position
   * @param {string} anim - Current animation key
   * @param {boolean} flipX - Whether sprite is flipped
   */
  recordPosition(time, x, y, anim = null, flipX = false) {
    if (!this.isRecording) return

    // Sample at fixed rate to reduce data
    if (time - this.lastSampleTime < this.sampleRate) {
      return
    }
    this.lastSampleTime = time

    this.recordedPositions.push({
      t: time,
      x: Math.round(x * 10) / 10, // Round to 1 decimal
      y: Math.round(y * 10) / 10,
      a: anim,
      f: flipX ? 1 : 0
    })
  }

  /**
   * Check if two input states are equal
   */
  inputsEqual(a, b) {
    if (!a || !b) return false
    return (
      a.left === b.left &&
      a.right === b.right &&
      a.up === b.up &&
      a.down === b.down &&
      a.jump === b.jump
    )
  }

  /**
   * Compress inputs for storage
   * Uses run-length encoding
   */
  compressInputs(inputs) {
    // Convert to compact format
    return inputs.map(i => ({
      t: i.time,
      i: this.encodeInput(i.input)
    }))
  }

  /**
   * Encode input state to a single number
   */
  encodeInput(input) {
    let value = 0
    if (input.left) value |= 1
    if (input.right) value |= 2
    if (input.up) value |= 4
    if (input.down) value |= 8
    if (input.jump) value |= 16
    return value
  }

  /**
   * Decode input number to state object
   */
  decodeInput(value) {
    return {
      left: (value & 1) !== 0,
      right: (value & 2) !== 0,
      up: (value & 4) !== 0,
      down: (value & 8) !== 0,
      jump: (value & 16) !== 0
    }
  }

  /**
   * Compress positions for storage
   * Uses delta encoding for x/y
   */
  compressPositions(positions) {
    if (positions.length === 0) return []

    const compressed = [positions[0]] // First position is absolute
    
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1]
      const curr = positions[i]
      
      compressed.push({
        t: curr.t,
        dx: Math.round((curr.x - prev.x) * 10), // Delta * 10
        dy: Math.round((curr.y - prev.y) * 10),
        a: curr.a !== prev.a ? curr.a : undefined, // Only if changed
        f: curr.f !== prev.f ? curr.f : undefined
      })
    }

    return compressed
  }

  /**
   * Decompress positions from storage
   */
  decompressPositions(compressed) {
    if (compressed.length === 0) return []

    const positions = [compressed[0]]
    let lastAnim = compressed[0].a
    let lastFlip = compressed[0].f

    for (let i = 1; i < compressed.length; i++) {
      const delta = compressed[i]
      const prev = positions[i - 1]
      
      if (delta.a !== undefined) lastAnim = delta.a
      if (delta.f !== undefined) lastFlip = delta.f

      positions.push({
        t: delta.t,
        x: prev.x + (delta.dx || 0) / 10,
        y: prev.y + (delta.dy || 0) / 10,
        a: lastAnim,
        f: lastFlip
      })
    }

    return positions
  }

  /**
   * Start playing back a ghost run
   * @param {object} ghostData - The ghost run data to play
   */
  startPlayback(ghostData) {
    this.isPlaying = true
    this.playbackIndex = 0
    this.playbackStartTime = Date.now()
    this.playbackPositions = this.decompressPositions(ghostData.positions || [])
    this.playbackInputs = ghostData.inputs || []
    console.log("[GhostRunManager] Playback started:", {
      positions: this.playbackPositions.length
    })
  }

  /**
   * Stop playback
   */
  stopPlayback() {
    this.isPlaying = false
    this.playbackIndex = 0
    this.playbackPositions = []
    this.playbackInputs = []
  }

  /**
   * Get the ghost position at current playback time
   * @param {number} time - Time since playback start in ms
   * @returns {object|null} Position data or null if playback ended
   */
  getPlaybackPosition(time) {
    if (!this.isPlaying || !this.playbackPositions.length) return null

    // Find the position closest to current time
    while (
      this.playbackIndex < this.playbackPositions.length - 1 &&
      this.playbackPositions[this.playbackIndex + 1].t <= time
    ) {
      this.playbackIndex++
    }

    if (this.playbackIndex >= this.playbackPositions.length) {
      this.isPlaying = false
      return null
    }

    const pos = this.playbackPositions[this.playbackIndex]
    
    // Interpolate between current and next position for smooth movement
    const nextIndex = Math.min(this.playbackIndex + 1, this.playbackPositions.length - 1)
    const nextPos = this.playbackPositions[nextIndex]
    
    if (nextPos.t > pos.t) {
      const t = (time - pos.t) / (nextPos.t - pos.t)
      return {
        x: pos.x + (nextPos.x - pos.x) * t,
        y: pos.y + (nextPos.y - pos.y) * t,
        anim: pos.a,
        flipX: pos.f === 1
      }
    }

    return {
      x: pos.x,
      y: pos.y,
      anim: pos.a,
      flipX: pos.f === 1
    }
  }

  /**
   * Check if recording is active
   */
  isRecordingActive() {
    return this.isRecording
  }

  /**
   * Check if playback is active
   */
  isPlaybackActive() {
    return this.isPlaying
  }

  /**
   * Get estimated file size of ghost data in bytes
   */
  estimateSize(ghostData) {
    const json = JSON.stringify(ghostData)
    return new Blob([json]).size
  }
}

// Singleton instance for easy access
export const ghostRunManager = new GhostRunManager()
