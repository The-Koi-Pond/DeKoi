/** DeKoi surface/pond-mode identifiers — the single source of truth. */
export const BUBBLES = 'bubbles'
export const VN = 'vn'
export const RESERVED = 'reserved'

export type SurfaceId = typeof BUBBLES | typeof VN | typeof RESERVED
