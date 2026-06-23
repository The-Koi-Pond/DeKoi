/** Inline SVG sprite — render once at app root, reference via <use href="#..."> */

export function KoiSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <g id="koi-mark">
          <path
            d="M32 8c-9 0-17 6-19 15-1 6 1 12 6 15-3-5-3-11 0-16 4-7 12-11 20-9 7 2 12 8 12 15 0 2 0 4-1 6 4-4 6-9 5-15C53 14 43 8 32 8z"
            fill="currentColor"
          />
          <circle cx="40" cy="22" r="3" fill="#0c1216" />
          <path
            d="M32 56c9 0 17-6 19-15 1-6-1-12-6-15 3 5 3 11 0 16-4 7-12 11-20 9-7-2-12-8-12-15 0-2 0-4 1-6-4 4-6 9-5 15 2 9 12 15 23 11z"
            fill="#f5ece1"
            opacity="0.92"
          />
          <circle cx="24" cy="42" r="3" fill="#0c1216" />
        </g>
        <symbol id="koi-swimmer" viewBox="0 0 32 18">
          <g className="tail">
            <path
              d="M7 9 L0 2.5 L3.5 9 L0 15.5 Z"
              fill="currentColor"
              opacity="0.92"
            />
          </g>
          <path d="M10 4.2 Q15 0 19 4.2 Z" fill="currentColor" opacity="0.9" />
          <path
            d="M7 9 C 9 3, 20 2.2, 26 6 C 30 8.4, 30 9.6, 26 12 C 20 15, 9 14, 7 9 Z"
            fill="currentColor"
          />
          <path
            d="M8 9.4 C 11 13, 20 14, 26 12 C 28 11, 28.6 10, 28 9.5 C 23 11.4, 12 12, 8 9.4 Z"
            fill="#f5ece1"
            opacity="0.95"
          />
          <path d="M17 11 Q21 14.5 22.5 11 Z" fill="currentColor" opacity="0.8" />
          <circle cx="25" cy="7.2" r="1.15" fill="#0c1216" />
          <circle cx="25.4" cy="6.8" r="0.4" fill="#f5ece1" opacity="0.9" />
        </symbol>
        <g id="fish">
          <path
            d="M2 9c4-6 12-8 18-5 3-4 7-4 9-1-2 0-3 2-2 4 4 1 6 4 5 8-3-2-6-2-9 0-5 3-13 2-18-2-3-2-4-3-3-4z"
            fill="currentColor"
          />
        </g>
      </defs>
    </svg>
  )
}
