import type { RegionCategory } from '@prisma/client'

/** All 14, north to south order is not useful here so alphabetical it is. */
export const KERALA_DISTRICTS = [
  'Alappuzha',
  'Ernakulam',
  'Idukki',
  'Kannur',
  'Kasaragod',
  'Kollam',
  'Kottayam',
  'Kozhikode',
  'Malappuram',
  'Palakkad',
  'Pathanamthitta',
  'Thiruvananthapuram',
  'Thrissur',
  'Wayanad',
] as const

/** Chennai first - it is the primary Tamil Nadu target. */
export const TN_DISTRICTS = [
  'Chennai',
  'Chengalpattu',
  'Coimbatore',
  'Cuddalore',
  'Dindigul',
  'Erode',
  'Kanchipuram',
  'Kanyakumari',
  'Madurai',
  'Nagapattinam',
  'Namakkal',
  'Salem',
  'Thanjavur',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tiruppur',
  'Vellore',
] as const

export const MIDDLE_EAST_COUNTRIES = [
  'UAE',
  'Saudi Arabia',
  'Qatar',
  'Oman',
  'Kuwait',
  'Bahrain',
] as const

export const REGION_LABELS: Record<RegionCategory, string> = {
  KERALA: 'Kerala',
  TAMIL_NADU: 'Tamil Nadu',
  MIDDLE_EAST: 'Middle East',
  OTHER_STATE: 'Other State',
}

/** What the "District" column is actually called for each region. */
export const DISTRICT_LABELS: Record<RegionCategory, string> = {
  KERALA: 'District',
  TAMIL_NADU: 'District',
  MIDDLE_EAST: 'Country',
  OTHER_STATE: 'State',
}

/**
 * Suggestions only - district is free text, so an unexpected place name from an
 * Excel tab still imports cleanly instead of being rejected.
 */
/** Offered everywhere a district is asked for, alongside the real ones. */
export const DISTRICT_NA = 'NA'

export function districtsFor(region: RegionCategory): readonly string[] {
  switch (region) {
    case 'KERALA':
      return [...KERALA_DISTRICTS, DISTRICT_NA]
    case 'TAMIL_NADU':
      return [...TN_DISTRICTS, DISTRICT_NA]
    case 'MIDDLE_EAST':
      return [...MIDDLE_EAST_COUNTRIES, DISTRICT_NA]
    default:
      return [DISTRICT_NA]
  }
}

const NORMALIZED_DISTRICTS: { region: RegionCategory; name: string; key: string }[] = [
  ...KERALA_DISTRICTS.map((d) => ({ region: 'KERALA' as const, name: d, key: norm(d) })),
  ...TN_DISTRICTS.map((d) => ({ region: 'TAMIL_NADU' as const, name: d, key: norm(d) })),
  ...MIDDLE_EAST_COUNTRIES.map((d) => ({ region: 'MIDDLE_EAST' as const, name: d, key: norm(d) })),
]

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

/**
 * Excel tab names are the main source of district data on import ("Malappuram",
 * "TVM ", "kozhikode-2"). Resolve one to a canonical district and its region so
 * the import wizard can pre-fill both, and the user only corrects the misses.
 */
export function matchDistrict(
  raw: string
): { region: RegionCategory; district: string } | null {
  const key = norm(raw)
  if (!key) return null

  const exact = NORMALIZED_DISTRICTS.find((d) => d.key === key)
  if (exact) return { region: exact.region, district: exact.name }

  // The three-letter codes below are the actual tab names in the team's
  // 'School List - Oly 2026' workbook, so a district-per-tab import resolves
  // without anyone re-typing 14 district names.
  const aliases: Record<string, string> = {
    tvm: 'Thiruvananthapuram',
    klm: 'Kollam',
    pat: 'Pathanamthitta',
    pta: 'Pathanamthitta',
    alp: 'Alappuzha',
    ktm: 'Kottayam',
    idk: 'Idukki',
    ekm: 'Ernakulam',
    thr: 'Thrissur',
    tsr: 'Thrissur',
    pkd: 'Palakkad',
    plk: 'Palakkad',
    mlp: 'Malappuram',
    mpm: 'Malappuram',
    kzh: 'Kozhikode',
    kkd: 'Kozhikode',
    wyd: 'Wayanad',
    way: 'Wayanad',
    wnd: 'Wayanad',
    knr: 'Kannur',
    ksd: 'Kasaragod',
    ksg: 'Kasaragod',
    kgd: 'Kasaragod',
    // Tamil Nadu - 'TCH' is the Chennai tab in their workbook.
    tch: 'Chennai',
    chn: 'Chennai',
    // Older/colonial names still used in some lists.
    trivandrum: 'Thiruvananthapuram',
    tcr: 'Thrissur',
    trichur: 'Thrissur',
    cochin: 'Ernakulam',
    kochi: 'Ernakulam',
    calicut: 'Kozhikode',
    alleppey: 'Alappuzha',
    quilon: 'Kollam',
    palghat: 'Palakkad',
    cannanore: 'Kannur',
    madras: 'Chennai',
    trichy: 'Tiruchirappalli',
  }
  const aliased = aliases[key]
  if (aliased) {
    const hit = NORMALIZED_DISTRICTS.find((d) => d.name === aliased)
    if (hit) return { region: hit.region, district: hit.name }
  }

  // Last resort: a substring match, but only for keys long enough that the
  // match means something. "alp" must never resolve via "chengalpattu".
  if (key.length >= 4) {
    const partial = NORMALIZED_DISTRICTS.find(
      (d) => key.includes(d.key) || d.key.includes(key)
    )
    if (partial) return { region: partial.region, district: partial.name }
  }

  return null
}
