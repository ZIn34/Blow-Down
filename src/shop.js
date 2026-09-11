// What cash buys. Charge types change how you play; the rest is style.
// `slot` items are equipped (one per slot); the first item in each slot is free.

export const SHOP = [
  { id: 'cutter', cat: 'Charges', icon: '🔵', name: 'Cutter charge', price: 2500,
    desc: 'Cuts only the piece it sits on, even brick. For precise work.' },
  { id: 'heavy', cat: 'Charges', icon: '⚫', name: 'Heavy charge', price: 5000,
    desc: 'Also takes out any supports within 3 m. One charge, several columns.' },
  { id: 'longfuse', cat: 'Charges', icon: '⏱️', name: 'Long fuse', price: 3000,
    desc: 'Your timeline runs to 5 seconds.' },

  { id: 'fx-classic', cat: 'Explosions', slot: 'fx', value: 'classic', icon: '🔥', name: 'Classic', price: 0, desc: 'Orange fire, white-hot flash.' },
  { id: 'fx-blue', cat: 'Explosions', slot: 'fx', value: 'blue', icon: '🔷', name: 'Blue flame', price: 2000, desc: 'Burns hot and blue.' },
  { id: 'fx-toxic', cat: 'Explosions', slot: 'fx', value: 'toxic', icon: '🟢', name: 'Toxic', price: 3000, desc: 'Green, glowing, probably fine.' },
  { id: 'fx-party', cat: 'Explosions', slot: 'fx', value: 'party', icon: '🎉', name: 'Confetti', price: 4000, desc: 'Every blast is a celebration.' },
  { id: 'fx-gold', cat: 'Explosions', slot: 'fx', value: 'gold', icon: '✨', name: 'Gold rush', price: 8000, desc: 'Sparks of pure gold.' },

  { id: 'det-red', cat: 'Detonator', slot: 'det', value: 'red', icon: '🔴', name: 'Standard red', price: 0, desc: 'The classic big red button.' },
  { id: 'det-hazard', cat: 'Detonator', slot: 'det', value: 'hazard', icon: '🚧', name: 'Hazard', price: 1500, desc: 'Black and yellow stripes.' },
  { id: 'det-chrome', cat: 'Detonator', slot: 'det', value: 'chrome', icon: '🪩', name: 'Chrome', price: 2500, desc: 'Polished steel.' },
  { id: 'det-gold', cat: 'Detonator', slot: 'det', value: 'gold', icon: '🏆', name: 'Solid gold', price: 6000, desc: 'For the Tycoon who has everything.' },

  { id: 'crew-sparky', cat: 'Crew', slot: 'crew', value: 'sparky', icon: '👷', name: 'Sparky', price: 0, desc: 'Your foreman. Moustache included.' },
  { id: 'crew-rubble', cat: 'Crew', slot: 'crew', value: '🐶', icon: '🐶', name: 'Rubble', price: 1500, desc: 'Site dog. Good boy. Knows about explosives.' },
  { id: 'crew-tex', cat: 'Crew', slot: 'crew', value: '🤠', icon: '🤠', name: 'Tex', price: 2000, desc: 'Blew up his first barn at age nine.' },
  { id: 'crew-bolt', cat: 'Crew', slot: 'crew', value: '🤖', icon: '🤖', name: 'Bolt', price: 3000, desc: 'Calculates collapse angles for fun.' },
  { id: 'crew-cosmo', cat: 'Crew', slot: 'crew', value: '🧑‍🚀', icon: '🧑‍🚀', name: 'Cosmo', price: 5000, desc: 'Retired from rockets. Misses the noise.' },
];

export const isFree = item => item.price === 0;

export const ownsItem = (profile, item) => isFree(item) || profile.has(item.id);

// Charge types the player can currently place.
export function chargeTypes(profile) {
  const t = [{ id: 'std', name: 'Standard', icon: '🔴' }];
  if (profile.has('cutter')) t.push({ id: 'cutter', name: 'Cutter', icon: '🔵' });
  if (profile.has('heavy')) t.push({ id: 'heavy', name: 'Heavy', icon: '⚫' });
  return t;
}
