import Phaser from "phaser"

/**
 * Create a trigger zone for collision detection
 */
export const createTrigger = (
  scene,
  x,
  y,
  width,
  height,
  origin = { x: 0.5, y: 0.5 }
) => {
  const customCollider = scene.add.zone(x, y, width, height).setOrigin(origin.x, origin.y)

  scene.physics.add.existing(customCollider)
  customCollider.body.setAllowGravity(false)
  customCollider.body.setImmovable(true)

  return customCollider
}

/**
 * Compute rotation angle for sprites based on movement direction
 * @param assetDirection - The direction the asset faces by default (e.g., right = (1, 0))
 * @param targetDirection - The direction to rotate towards
 * @returns Rotation in radians
 */
export function computeRotation(assetDirection, targetDirection) {
  const assetAngle = Math.atan2(assetDirection.y, assetDirection.x)
  const targetAngle = Math.atan2(targetDirection.y, targetDirection.x)
  return targetAngle - assetAngle
}

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0")
  const secs = (seconds % 60).toString().padStart(2, "0")
  return `${mins}:${secs}`
}

/**
 * Lerp (linear interpolation) helper
 */
export function lerp(start, end, t) {
  return start + (end - start) * t
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Check if two rectangles overlap
 */
export function rectOverlap(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  )
}
