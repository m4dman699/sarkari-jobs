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

module.exports = { MARK_BY_NAME, markPathFor };
