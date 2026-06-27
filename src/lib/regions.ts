// ============================================================
// Burst — Region Codes & Timezone Mapping
// ============================================================

export type RegionCode = 'NA' | 'SA' | 'EU' | 'AF' | 'AS' | 'OC';

export const ALL_REGION_CODES: RegionCode[] = ['NA', 'SA', 'EU', 'AF', 'AS', 'OC'];

export const REGIONS: Record<RegionCode, { name: string; color: string; emoji: string }> = {
 NA: { name: 'North America', color: '#3b82f6', emoji: '' },
 SA: { name: 'South America', color: '#10b981', emoji: '' },
 EU: { name: 'Europe', color: '#8b5cf6', emoji: '' },
 AF: { name: 'Africa', color: '#f59e0b', emoji: '' },
 AS: { name: 'Asia', color: '#ef4444', emoji: '' },
 OC: { name: 'Oceania', color: '#06b6d4', emoji: '' },
};

// Map IANA timezone to region code
const TIMEZONE_REGION_MAP: Record<string, RegionCode> = {
 // North America
 'America/New_York': 'NA', 'America/Chicago': 'NA', 'America/Denver': 'NA',
 'America/Los_Angeles': 'NA', 'America/Phoenix': 'NA', 'America/Anchorage': 'NA',
 'America/Toronto': 'NA', 'America/Vancouver': 'NA', 'America/Mexico_City': 'NA',
 'Pacific/Honolulu': 'NA',
 // South America
 'America/Sao_Paulo': 'SA', 'America/Argentina/Buenos_Aires': 'SA',
 'America/Bogota': 'SA', 'America/Lima': 'SA', 'America/Santiago': 'SA',
 'America/Caracas': 'SA',
 // Europe
 'Europe/London': 'EU', 'Europe/Paris': 'EU', 'Europe/Berlin': 'EU',
 'Europe/Madrid': 'EU', 'Europe/Rome': 'EU', 'Europe/Amsterdam': 'EU',
 'Europe/Stockholm': 'EU', 'Europe/Moscow': 'EU', 'Europe/Istanbul': 'EU',
 'Europe/Warsaw': 'EU', 'Europe/Zurich': 'EU',
 // Africa
 'Africa/Cairo': 'AF', 'Africa/Lagos': 'AF', 'Africa/Johannesburg': 'AF',
 'Africa/Nairobi': 'AF', 'Africa/Casablanca': 'AF',
 // Asia
 'Asia/Tokyo': 'AS', 'Asia/Shanghai': 'AS', 'Asia/Hong_Kong': 'AS',
 'Asia/Seoul': 'AS', 'Asia/Singapore': 'AS', 'Asia/Kolkata': 'AS',
 'Asia/Dubai': 'AS', 'Asia/Bangkok': 'AS', 'Asia/Jakarta': 'AS',
 'Asia/Taipei': 'AS', 'Asia/Manila': 'AS',
 // Oceania
 'Australia/Sydney': 'OC', 'Australia/Melbourne': 'OC',
 'Australia/Perth': 'OC', 'Pacific/Auckland': 'OC', 'Pacific/Fiji': 'OC',
};

export function detectUserRegion(): RegionCode {
 try {
 const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
 if (TIMEZONE_REGION_MAP[tz]) return TIMEZONE_REGION_MAP[tz];
 // Fallback: infer from timezone prefix
 if (tz.startsWith('America/')) {
 return tz.includes('Sao_Paulo') || tz.includes('Buenos') || tz.includes('Bogota') || tz.includes('Lima') || tz.includes('Santiago') ? 'SA' : 'NA';
 }
 if (tz.startsWith('Europe/')) return 'EU';
 if (tz.startsWith('Africa/')) return 'AF';
 if (tz.startsWith('Asia/')) return 'AS';
 if (tz.startsWith('Australia/') || tz.startsWith('Pacific/')) return 'OC';
 return 'NA'; // Default
 } catch {
 return 'NA';
 }
}
