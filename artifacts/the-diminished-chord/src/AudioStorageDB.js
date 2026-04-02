/**
 * AudioStorageDB - IndexedDB-based audio file storage
 * Handles persistent storage of audio files for tracks and menu music
 * IndexedDB can store large binary files (unlike localStorage)
 */

const DB_NAME = "diminished_chord_audio"
const DB_VERSION = 1
const STORE_NAME = "audio_files"

class AudioStorageDBClass {
  constructor() {
    this.db = null
    this.isReady = false
    this.readyPromise = this.initDB()
  }

  /**
   * Initialize the IndexedDB database
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = (event) => {
        console.error("[AudioStorageDB] Failed to open database:", event.target.error)
        reject(event.target.error)
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        this.isReady = true
        console.log("[AudioStorageDB] Database opened successfully")
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        // Create object store for audio files
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
          store.createIndex("type", "type", { unique: false })
          console.log("[AudioStorageDB] Created audio_files store")
        }
      }
    })
  }

  /**
   * Wait for database to be ready
   */
  async waitForReady() {
    if (this.isReady) return this.db
    return this.readyPromise
  }

  /**
   * Store an audio file
   * @param {string} id - Unique identifier (e.g., "track_001" or "menu_intro")
   * @param {File|Blob} file - The audio file
   * @param {string} type - Type of audio ("track" or "menu")
   * @param {object} metadata - Additional metadata (fileName, etc.)
   */
  async storeAudio(id, file, type, metadata = {}) {
    await this.waitForReady()

    return new Promise((resolve, reject) => {
      // Convert File to ArrayBuffer for storage
      const reader = new FileReader()
      
      reader.onload = (event) => {
        const arrayBuffer = event.target.result
        
        const transaction = this.db.transaction([STORE_NAME], "readwrite")
        const store = transaction.objectStore(STORE_NAME)

        const audioRecord = {
          id,
          type,
          data: arrayBuffer,
          mimeType: file.type || "audio/mpeg",
          fileName: metadata.fileName || file.name || "audio.mp3",
          size: file.size,
          storedAt: Date.now(),
          ...metadata
        }

        const request = store.put(audioRecord)

        request.onsuccess = () => {
          console.log(`[AudioStorageDB] Stored audio: ${id} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
          resolve(audioRecord)
        }

        request.onerror = (event) => {
          console.error(`[AudioStorageDB] Failed to store audio: ${id}`, event.target.error)
          reject(event.target.error)
        }
      }

      reader.onerror = () => {
        console.error("[AudioStorageDB] Failed to read file")
        reject(reader.error)
      }

      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Retrieve an audio file and return as a blob URL
   * @param {string} id - The audio identifier
   * @returns {Promise<string|null>} Blob URL or null if not found
   */
  async getAudioUrl(id) {
    await this.waitForReady()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = (event) => {
        const record = event.target.result
        if (record && record.data) {
          // Convert ArrayBuffer back to Blob and create URL
          const blob = new Blob([record.data], { type: record.mimeType })
          const url = URL.createObjectURL(blob)
          console.log(`[AudioStorageDB] Retrieved audio: ${id}`)
          resolve(url)
        } else {
          resolve(null)
        }
      }

      request.onerror = (event) => {
        console.error(`[AudioStorageDB] Failed to get audio: ${id}`, event.target.error)
        reject(event.target.error)
      }
    })
  }

  /**
   * Get audio metadata without loading the full file
   * @param {string} id - The audio identifier
   * @returns {Promise<object|null>} Metadata or null if not found
   */
  async getAudioMetadata(id) {
    await this.waitForReady()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = (event) => {
        const record = event.target.result
        if (record) {
          // Return metadata without the large data blob
          const { data, ...metadata } = record
          resolve(metadata)
        } else {
          resolve(null)
        }
      }

      request.onerror = (event) => {
        reject(event.target.error)
      }
    })
  }

  /**
   * Check if an audio file exists in storage
   * @param {string} id - The audio identifier
   * @returns {Promise<boolean>}
   */
  async hasAudio(id) {
    const metadata = await this.getAudioMetadata(id)
    return metadata !== null
  }

  /**
   * Delete an audio file
   * @param {string} id - The audio identifier
   */
  async deleteAudio(id) {
    await this.waitForReady()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => {
        console.log(`[AudioStorageDB] Deleted audio: ${id}`)
        resolve(true)
      }

      request.onerror = (event) => {
        console.error(`[AudioStorageDB] Failed to delete audio: ${id}`, event.target.error)
        reject(event.target.error)
      }
    })
  }

  /**
   * Get all stored audio metadata (for listing)
   * @param {string} type - Optional filter by type ("track" or "menu")
   * @returns {Promise<Array>} Array of metadata objects
   */
  async getAllAudioMetadata(type = null) {
    await this.waitForReady()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      
      let request
      if (type) {
        const index = store.index("type")
        request = index.getAll(type)
      } else {
        request = store.getAll()
      }

      request.onsuccess = (event) => {
        const records = event.target.result
        // Return metadata without the large data blobs
        const metadata = records.map(({ data, ...meta }) => meta)
        resolve(metadata)
      }

      request.onerror = (event) => {
        reject(event.target.error)
      }
    })
  }

  /**
   * Get total storage used (approximate)
   * @returns {Promise<number>} Total bytes used
   */
  async getStorageUsed() {
    const allMetadata = await this.getAllAudioMetadata()
    return allMetadata.reduce((total, item) => total + (item.size || 0), 0)
  }

  /**
   * Clear all stored audio
   */
  async clearAll() {
    await this.waitForReady()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        console.log("[AudioStorageDB] Cleared all audio")
        resolve(true)
      }

      request.onerror = (event) => {
        reject(event.target.error)
      }
    })
  }
}

// Singleton instance
export const AudioStorageDB = new AudioStorageDBClass()
