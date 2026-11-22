# Official portal logo sources

These portal marks are copied from assets exposed by the listed government recruiting authorities and portals. The interface displays them only as source identifiers; it does not imply affiliation. Where no usable official image is exposed, the UI shows the portal acronym instead of inventing an official seal.

| Local asset | Official source |
| --- | --- |
| `rpsc.png` | https://rpsc.rajasthan.gov.in/Images/RPSC_Logo.png |
| `hpsc.png` | https://hpsc.gov.in/Portals/0/Images/hpsc-logo.png |
| `tpsc-emblem.png` | https://tpsc.tripura.gov.in/sites/default/files/2024-04/LOGO_0.png |
| `gpsc.png` | https://gpsc.gujarat.gov.in/images/Logo-GPSC.png |
| `uppsc-official.png` | https://uppsc.up.nic.in/Assets/image/UPPSC.png |
| `mppsc.png` | https://mppsc.mp.gov.in/assets/img/logo.png |
| `ssc.webp` | https://ssc.gov.in/assets/sscLogo.webp |
| `dsssb.png` | https://dsssb.delhi.gov.in/sites/default/files/DSSSB/logo/dsssb.png |
| `railways.png` | https://rrb.indianrailways.gov.in/admin/images/logo-ir.png |
| `hssc.png` | https://hssc.gov.in/images/logo.png |
| `manipur-mpsc.ico` | https://mpscmanipur.gov.in/favico.ico |
| `supreme-court.ico` | https://www.sci.gov.in/favicon.ico |
| `nta.png` | https://nta.ac.in/img/NTA_logo.png |
| `rssb.png` | https://rssb.rajasthan.gov.in/images/logo_img.png |
| `mpesb.jpg` | https://esb.mp.gov.in/new_look_images/PEB_LOGO_NEW1.jpg |
| `upsc.png` | https://www.upsc.gov.in/sites/all/themes/upsc/images/logo.png |
| `apsc.png` | https://apsc.nic.in/header_logo.png |
| `tnpsc.png` | https://www.tnpsc.gov.in/English/images/TNPSC-logo.png |
| `mizoram-psc.png` | https://mpsc.mizoram.gov.in/apple-touch-icon.png |
| `rbi.png` | https://www.rbi.org.in/images/logo_for_rbi_website.png |
| `cbse.png` | https://www.cbse.gov.in/images/logo.png |
| `nicl.svg` | https://nationalinsurance.nic.co.in/themes/custom/nicl/logo.svg |
| `aai.png` | https://www.aai.aero/sites/default/files/logo_15042021.png |
| `bsf.png` | https://d3t79nicn48uzj.cloudfront.net/bsf/custom/1746079135.png |
| `bob.png` | https://bankofbaroda.bank.in/chat/bob/countrywebsite/india/build/logo/logo512.png |
| `ncs-official.png` | https://ncs.gov.in/assets/logo/ncs-small-logo.png |

Category cards use custom inline SVG icons, since a category such as Banking or Teaching has no single official recruiting-portal logo.

## Display normalization on the homepage

The homepage trust ribbon displays six of these marks (UPSC, SSC, Indian Railways, NCS, RBI and IBPS). The image files themselves are unchanged. Each mark sits in an identically sized tile, and CSS scales the image to a computed height based on its intrinsic width/height ratio; portrait marks are clamped so no single logo dominates the row. This follows the equal-area approach in 9elements' "Building the Perfect Logo Strip" and uses `object-fit: contain` (MDN) so nothing is cropped or distorted. The strip identifies source examples only — it is not a partner, sponsor or endorsement list.
