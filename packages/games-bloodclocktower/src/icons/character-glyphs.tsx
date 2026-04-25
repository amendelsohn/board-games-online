import type { ReactNode } from "react";

/**
 * SVG glyphs for each character. Drawn in a 24×24 viewBox using
 * `currentColor`, so the parent sets the tint via CSS `color`.
 * Stroke-based and deliberately spare — recognizable at thumbnail
 * size, ornamental at full token size.
 *
 * Missing entries fall back to the character's initial in RoleToken.
 */
export const CHARACTER_GLYPHS: Record<string, ReactNode> = {
  // ============ Trouble Brewing — Townsfolk (13) ============

  // Clothesline with three hung garments.
  washerwoman: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 6 Q12 4 22 6" />
      <path d="M5 6 L4 13 L8 13 L7 6 M5.5 9 L7 9" />
      <path d="M11 6 L10 16 L15 16 L14 6 M11 9.5 L14 9.5" />
      <path d="M17 6 L16.5 12 L20 12 L19.5 6" />
    </g>
  ),

  // Open book seen from above.
  librarian: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6 Q8 4 12 6 L12 19 Q8 17 3 19 Z" />
      <path d="M21 6 Q16 4 12 6 L12 19 Q16 17 21 19 Z" />
      <path d="M5 9 L9 8.5 M5 12 L9 11.5 M15 8.5 L19 9 M15 11.5 L19 12" />
    </g>
  ),

  // Magnifying glass.
  investigator: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="6" />
      <line x1="14.5" y1="14.5" x2="20.5" y2="20.5" />
    </g>
  ),

  // Chef's toque (puffy hat + cuff).
  chef: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 13 Q3 10 5 7 Q7 4 10 6 Q12 3 14 6 Q17 4 19 7 Q21 10 18 13 Z" />
      <line x1="6" y1="13" x2="18" y2="13" />
      <path d="M6 13 L6 19 L18 19 L18 13" />
      <line x1="6" y1="16" x2="18" y2="16" />
    </g>
  ),

  // Heart with sparks (empathy + sensing).
  empath: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19 Q4 13 4.5 8 Q5 4.5 8.5 4.5 Q11 4.5 12 7 Q13 4.5 15.5 4.5 Q19 4.5 19.5 8 Q20 13 12 19 Z" />
      <line x1="2" y1="11" x2="0.5" y2="11" />
      <line x1="22" y1="11" x2="23.5" y2="11" />
      <line x1="3" y1="6" x2="1.5" y2="4.5" />
      <line x1="21" y1="6" x2="22.5" y2="4.5" />
      <line x1="2.5" y1="16" x2="1" y2="17.5" />
      <line x1="21.5" y1="16" x2="23" y2="17.5" />
    </g>
  ),

  // Eye in an oval frame.
  fortuneteller: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12 Q12 4 22 12 Q12 20 2 12 Z" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </g>
  ),

  // Shovel with T-grip and trapezoidal blade.
  undertaker: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="3" x2="16" y2="3" />
      <line x1="12" y1="3" x2="12" y2="13" />
      <path d="M7 13 L17 13 L15 22 L9 22 Z" />
    </g>
  ),

  // Latin cross.
  monk: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="5" y1="9" x2="19" y2="9" />
    </g>
  ),

  // Stylized bird in flight.
  ravenkeeper: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 14 L7 11 L11 9 Q15 6 19 9 L22 12 L19 14 L13 14 Z" />
      <line x1="13" y1="14" x2="11" y2="20" />
      <line x1="9" y1="14" x2="7" y2="19" />
      <line x1="22" y1="12" x2="19.5" y2="11" />
      <circle cx="18.5" cy="11" r="0.6" fill="currentColor" stroke="none" />
    </g>
  ),

  // Six-petal flower (lily).
  virgin: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="6" rx="2.2" ry="3.2" />
      <ellipse cx="17" cy="9" rx="3.2" ry="2.2" transform="rotate(60 17 9)" />
      <ellipse cx="17" cy="15" rx="3.2" ry="2.2" transform="rotate(-60 17 15)" />
      <ellipse cx="12" cy="18" rx="2.2" ry="3.2" />
      <ellipse cx="7" cy="15" rx="3.2" ry="2.2" transform="rotate(60 7 15)" />
      <ellipse cx="7" cy="9" rx="3.2" ry="2.2" transform="rotate(-60 7 9)" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </g>
  ),

  // Sword with crossguard and pommel.
  slayer: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="2" x2="12" y2="16" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <line x1="12" y1="16" x2="12" y2="20" />
      <circle cx="12" cy="21.2" r="1.2" />
    </g>
  ),

  // Heater shield with cross.
  soldier: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4 L5 12 Q5 19 12 22 Q19 19 19 12 L19 4 Z" />
      <line x1="12" y1="8" x2="12" y2="18" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </g>
  ),

  // Three-spike crown with jewel dots.
  mayor: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 18 L4 8 L9 13 L12 5 L15 13 L20 8 L21 18 Z" />
      <line x1="3" y1="20.5" x2="21" y2="20.5" />
      <circle cx="4" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="20" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5" r="0.9" fill="currentColor" stroke="none" />
    </g>
  ),

  // ============ Trouble Brewing — Outsiders (4) ============

  // Bow tie.
  butler: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8 L11 12 L11 16 L3 20 Z" />
      <path d="M21 8 L13 12 L13 16 L21 20 Z" />
      <rect x="10.5" y="11" width="3" height="6" rx="0.5" />
    </g>
  ),

  // Tankard with handle and foam.
  drunk: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7 L5 21 L17 21 L17 7 Z" />
      <path d="M17 10 Q21 10 21 13.5 Q21 17 17 17" />
      <path d="M5 7 Q5 5 7 5 Q9 7 11 5 Q13 7 15 5 Q17 5 17 7" />
    </g>
  ),

  // Hooded silhouette.
  recluse: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 22 Q4 11 12 4 Q20 11 20 22 Z" />
      <path d="M9 14 Q12 16 15 14" />
      <path d="M12 4 Q12 9 12 13" strokeDasharray="1 2" />
    </g>
  ),

  // Halo above a robed figure.
  saint: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="4" rx="6" ry="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M7 22 L8.5 14 L15.5 14 L17 22 Z" />
    </g>
  ),

  // ============ Trouble Brewing — Minions (4) ============

  // Apothecary flask with X mark.
  poisoner: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="9" y1="2.5" x2="15" y2="2.5" />
      <path d="M10 2.5 L10 8 Q5 13 5 17.5 Q5 21 9 21 L15 21 Q19 21 19 17.5 Q19 13 14 8 L14 2.5" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="11" y1="11" x2="13" y2="13" />
      <line x1="13" y1="11" x2="11" y2="13" />
    </g>
  ),

  // Domino mask.
  spy: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9 Q5 6 12 7 Q19 6 22 9 L20 14 Q15 16 12 14 Q9 16 4 14 Z" />
      <ellipse cx="7.5" cy="11" rx="1.6" ry="1.2" fill="currentColor" stroke="none" />
      <ellipse cx="16.5" cy="11" rx="1.6" ry="1.2" fill="currentColor" stroke="none" />
    </g>
  ),

  // Lips.
  scarletwoman: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12 Q6 7 12 11 Q18 7 21 12 Q18 17 12 14 Q6 17 3 12 Z" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </g>
  ),

  // Top hat with brim.
  baron: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="7" y="4" width="10" height="13" />
      <line x1="3" y1="17" x2="21" y2="17" />
      <line x1="7" y1="13.5" x2="17" y2="13.5" />
    </g>
  ),

  // ============ Trouble Brewing — Demons (1) ============

  // Trident / pitchfork.
  imp: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" y1="3" x2="6" y2="9" />
      <line x1="12" y1="2" x2="12" y2="9" />
      <line x1="18" y1="3" x2="18" y2="9" />
      <line x1="3.5" y1="9" x2="20.5" y2="9" />
      <line x1="12" y1="9" x2="12" y2="22" />
    </g>
  ),
};

/**
 * Renders a character glyph centered in its parent SVG layout box.
 * Designed to be embedded inside a larger SVG via a nested <svg>.
 * Returns null if no glyph exists for the id (caller can fall back).
 */
export function characterGlyphFor(id: string | undefined): ReactNode | null {
  if (!id) return null;
  return CHARACTER_GLYPHS[id] ?? null;
}
