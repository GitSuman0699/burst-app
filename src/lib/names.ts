// ============================================================
// Burst — Anonymous Display Name Generator
// ============================================================

const ADJECTIVES = [
  'Swift', 'Cosmic', 'Neon', 'Shadow', 'Thunder', 'Midnight',
  'Electric', 'Crimson', 'Phantom', 'Stellar', 'Frost', 'Blaze',
  'Cyber', 'Quantum', 'Turbo', 'Ultra', 'Hyper', 'Rapid',
  'Stealth', 'Apex', 'Venom', 'Sonic', 'Iron', 'Nova',
];

const NOUNS = [
  'Hawk', 'Wolf', 'Tiger', 'Falcon', 'Panther', 'Viper',
  'Phoenix', 'Dragon', 'Cobra', 'Eagle', 'Lynx', 'Fox',
  'Raven', 'Shark', 'Bear', 'Lion', 'Jaguar', 'Bolt',
  'Storm', 'Blade', 'Ghost', 'Flame', 'Fang', 'Pulse',
];

export function generateDisplayName(seed?: string): string {
  const s = seed || Math.random().toString(36).substring(2);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  const adjIdx = Math.abs(hash) % ADJECTIVES.length;
  const nounIdx = Math.abs(hash >> 8) % NOUNS.length;
  const num = (Math.abs(hash >> 16) % 99) + 1;
  return `${ADJECTIVES[adjIdx]}${NOUNS[nounIdx]}${num}`;
}
