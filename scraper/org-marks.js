// Official recruiting-authority marks, matched on the organisation name.
//
// Shared by the detail-page builder and the sector-guide builder so a listing
// shows the same authority mark in both places. The match is on the authority
// named in the record, not the URL host: feeds routinely link a state portal
// (recruitment.rajasthan.gov.in) or a republisher, so host matching misses most
// authorities, while the organisation text is what the reader actually sees.
//
// Every entry points at an image the authority itself publishes, and every asset
// is checked before it is listed here. A wrong mark is worse than no mark: an
// organisation with no verified logo keeps its plain text label and the neutral
// listing-type glyph. Do not add a stand-in mark, a category icon or another
// authority's seal for an organisation that is not on this list.
const MARK_BY_NAME = [
  [/\bRPSC\b|Rajasthan Public Service/i, 'portal-logos/rpsc.png'],
  [/\bUPPSC\b|Uttar Pradesh Public Service/i, 'portal-logos/uppsc-official.png'],
  [/\bMPPSC\b|Madhya Pradesh Public Service/i, 'portal-logos/mppsc.png'],
  [/\bGPSC\b|Gujarat Public Service/i, 'portal-logos/gpsc.png'],
  [/\bHPSC\b|Haryana Public Service/i, 'portal-logos/hpsc.png'],
  [/\bTPSC\b|Tripura Public Service/i, 'portal-logos/tpsc-emblem.png'],
  [/\bHSSC\b|Haryana Staff Selection/i, 'portal-logos/hssc.png'],
  [/\bDSSSB\b|Delhi Subordinate Service/i, 'portal-logos/dsssb.png'],
  // Manipur only: `\bMPSC\b` alone would also claim Maharashtra's MPSC.
  [/Manipur Public Service|MPSC\s+Manipur|Manipur\s+MPSC/i, 'portal-logos/manipur-mpsc.ico'],
  [/National Testing Agency|\bNTA\b/i, 'portal-logos/nta.png'],
  [/Rajasthan Staff Selection|RSSB|RSMSSB/i, 'portal-logos/rssb.png'],
  [/Madhya Pradesh Employee Selection|\bMPESB\b|Madhya Pradesh Vyapam|\bVyapam\b/i, 'portal-logos/mpesb.jpg'],
  [/\bUPSC\b|Union Public Service/i, 'portal-logos/upsc.png'],
  [/\bAPSC\b|Assam Public Service/i, 'portal-logos/apsc.png'],
  [/\bTNPSC\b|Tamil Nadu Public Service/i, 'portal-logos/tnpsc.png'],
  [/Mizoram Public Service|Mizoram\s+PSC/i, 'portal-logos/mizoram-psc.png'],
  [/\bRBI\b|Reserve Bank of India/i, 'portal-logos/rbi.png'],
  [/\bCBSE\b|Central Board of Secondary Education/i, 'portal-logos/cbse.png'],
  [/National Insurance Company|\bNICL\b/i, 'portal-logos/nicl.svg'],
  [/Airports Authority of India|\bAAI\b/i, 'portal-logos/aai.png'],
  [/Border Security Force|\bBSF\b/i, 'portal-logos/bsf.png'],
  [/Bank of Baroda|\bBOB\b/i, 'portal-logos/bob.png'],
  [/\bSSC\b|Staff Selection Commission/i, 'portal-logos/ssc.webp'],
  [/\bRRB\b|Railway Recruitment Board|Ministry of Railways/i, 'portal-logos/railways.png'],
  [/Supreme Court of India/i, 'portal-logos/supreme-court.ico'],
  [/\bIBPS\b|Institute of Banking Personnel/i, 'logos/ibps-logo.png'],
  [/Kendriya Vidyalaya|\bKVS\b/i, 'logos/kvs-logo.svg'],
  [/Indian Air Force|\bIAF\b/i, 'logos/indian-air-force-logo.png'],
  [/Indian Police Service|\bIPS\b/i, 'logos/indian-police-service-logo.png']
];

// Returns an assets-relative path such as 'portal-logos/ssc.webp', or '' when no
// verified mark is on file for the authority in this record.
const markPathFor = item => {
  const org = String(item?.organization || item?.source || item?.publisher || '');
  const match = MARK_BY_NAME.find(([pattern]) => pattern.test(org));
  return match ? match[1] : '';
};

// Most feeds name an authority that publishes no usable logo, and inventing one
// (or borrowing a neighbour's seal) is worse than no mark at all. So every
// listing instead gets a monogram built from its own organisation name: two
// initials on a colour derived from the same string. It is obviously not an
// official emblem, but it makes a row scannable and gives each authority a
// stable identity across the site.
const MONO_STOPWORDS = new Set([
  'of', 'the', 'and', 'for', 'in', 'to', 'at', 'on', 'dept', 'department',
  'government', 'govt', 'india', 'indian', 'state', 'national', 'central'
]);

const monogramFor = item => {
  const org = String(item?.organization || item?.source || item?.publisher || '').trim();
  if (!org) return null;
  // Drop a trailing parenthetical or bracket, which usually repeats the acronym.
  const cleaned = org.replace(/[([][^)\]]*[)\]]/g, ' ').replace(/[^A-Za-z0-9&\s-]/g, ' ').trim();
  const words = cleaned.split(/[\s-]+/).filter(Boolean);
  // A published acronym (BSF, SSC, UPSC, RPSC) is the name readers recognise, so
  // prefer it when it is short enough to fit the badge. Read it from the raw
  // name: the parenthetical acronym is removed before the words are split.
  const acronym = (org.match(/\b[A-Z]{2,6}\b/g) || [])
    .find(token => !/^(19|20)\d{2}$/.test(token) && token.length <= 4);
  const meaningful = words.filter(word => !MONO_STOPWORDS.has(word.toLowerCase()));
  const source = meaningful.length ? meaningful : words;
  let initials;
  if (acronym) {
    initials = acronym;
  } else if (source.length === 1) {
    initials = source[0].slice(0, 2);
  } else {
    initials = source.slice(0, 2).map(word => word[0]).join('');
  }
  initials = initials.toUpperCase();
  // Stable hue per authority: same name, same colour, on every build.
  let hash = 0;
  for (let i = 0; i < org.length; i++) hash = (hash * 31 + org.charCodeAt(i)) >>> 0;
  return { initials, hue: hash % 360 };
};

module.exports = { MARK_BY_NAME, markPathFor, monogramFor };
