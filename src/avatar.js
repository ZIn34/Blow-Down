// Sparky, the foreman: a moustached builder in a yellow hard hat, blue shirt and
// yellow overalls. Drawn as SVG so it's crisp at any size and needs no image file.

export const SPARKY_SVG = `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Sparky">
  <defs>
    <radialGradient id="spBg" cx="50%" cy="35%" r="70%">
      <stop offset="0" stop-color="#7fb2e0"/><stop offset="1" stop-color="#3d6d9e"/>
    </radialGradient>
    <linearGradient id="spHat" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe067"/><stop offset="1" stop-color="#f0a818"/>
    </linearGradient>
    <linearGradient id="spSkin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7c49a"/><stop offset="1" stop-color="#e6a577"/>
    </linearGradient>
    <clipPath id="spClip"><circle cx="32" cy="32" r="32"/></clipPath>
  </defs>
  <g clip-path="url(#spClip)">
    <rect width="64" height="64" fill="url(#spBg)"/>
    <!-- shoulders: blue work shirt -->
    <path d="M4 66 C6 51 17 46.5 32 46.5 C47 46.5 58 51 60 66 Z" fill="#2c5ea8"/>
    <path d="M26 46.5 L32 53 L38 46.5 Z" fill="#234c8a"/>
    <!-- overalls bib and straps -->
    <path d="M20 66 L21 54 L43 54 L44 66 Z" fill="#f6c01e"/>
    <rect x="20.5" y="46" width="4.5" height="9" rx="1" fill="#f6c01e"/>
    <rect x="39" y="46" width="4.5" height="9" rx="1" fill="#f6c01e"/>
    <circle cx="22.7" cy="54.5" r="1.3" fill="#8a6a1a"/>
    <circle cx="41.3" cy="54.5" r="1.3" fill="#8a6a1a"/>
    <rect x="27" y="57" width="10" height="5" rx="1" fill="#e3ab12"/>
    <!-- neck -->
    <rect x="26.5" y="40" width="11" height="8" fill="#e0a071"/>
    <!-- ears -->
    <ellipse cx="18.6" cy="31.5" rx="3" ry="3.8" fill="#eaae80"/>
    <ellipse cx="45.4" cy="31.5" rx="3" ry="3.8" fill="#eaae80"/>
    <!-- head -->
    <ellipse cx="32" cy="30.5" rx="13.4" ry="14.2" fill="url(#spSkin)"/>
    <!-- sideburns -->
    <path d="M18.8 25 L21.5 25 L21 33 L19.2 32 Z" fill="#6a3a1c"/>
    <path d="M45.2 25 L42.5 25 L43 33 L44.8 32 Z" fill="#6a3a1c"/>
    <!-- eyebrows -->
    <path d="M22.5 25.2 Q26 22.6 29.2 24.6" stroke="#5a2f15" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M34.8 24.6 Q38 22.6 41.5 25.2" stroke="#5a2f15" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <!-- eyes -->
    <ellipse cx="26.3" cy="28.6" rx="2" ry="2.4" fill="#2a1a12"/>
    <ellipse cx="37.7" cy="28.6" rx="2" ry="2.4" fill="#2a1a12"/>
    <circle cx="27" cy="27.8" r="0.7" fill="#fff"/>
    <circle cx="38.4" cy="27.8" r="0.7" fill="#fff"/>
    <!-- cheeks -->
    <ellipse cx="22.5" cy="34" rx="2.6" ry="1.6" fill="#ef9a7a" opacity=".55"/>
    <ellipse cx="41.5" cy="34" rx="2.6" ry="1.6" fill="#ef9a7a" opacity=".55"/>
    <!-- nose -->
    <ellipse cx="32" cy="33" rx="3.2" ry="2.8" fill="#e09468"/>
    <ellipse cx="31" cy="32.2" rx="1" ry=".7" fill="#f6c3a0" opacity=".8"/>
    <!-- grin -->
    <path d="M25.5 38.6 Q32 44.5 38.5 38.6 Q32 41.4 25.5 38.6 Z" fill="#7a2e22"/>
    <path d="M27.4 39.6 Q32 41.6 36.6 39.6 L36 40.6 Q32 42.2 28 40.6 Z" fill="#fff"/>
    <!-- big handlebar moustache -->
    <path d="M32 35.2 C28.5 34 24.5 34.4 22 36.4 C20.4 37.7 18.8 37.8 17.6 36.8 C18.4 39.8 21.6 40.6 24.6 39.6 C27.2 38.8 29.6 37.8 32 37.6
             C34.4 37.8 36.8 38.8 39.4 39.6 C42.4 40.6 45.6 39.8 46.4 36.8 C45.2 37.8 43.6 37.7 42 36.4 C39.5 34.4 35.5 34 32 35.2 Z"
          fill="#6b3a1a"/>
    <path d="M24 36.3 Q28 35.2 31 36.2" stroke="#8a5028" stroke-width=".8" fill="none" opacity=".7"/>
    <path d="M40 36.3 Q36 35.2 33 36.2" stroke="#8a5028" stroke-width=".8" fill="none" opacity=".7"/>
    <!-- hard hat -->
    <path d="M16.5 23.8 C16.5 11.5 23.5 7.2 32 7.2 C40.5 7.2 47.5 11.5 47.5 23.8 Z" fill="url(#spHat)"/>
    <rect x="29.6" y="7.4" width="4.8" height="16" rx="2" fill="#ffd84a"/>
    <path d="M21 17 Q23 10.5 29 9" stroke="#fff6c8" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="32" cy="24.2" rx="19.5" ry="3.3" fill="#e39f12"/>
    <ellipse cx="32" cy="23.5" rx="19.5" ry="2.4" fill="#f7c328"/>
  </g>
</svg>`;
