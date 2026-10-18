import type { Rule } from './types';

// Rules for G2.5 to G2.9 and G3.7: power converters, sensors, photonics, quantum error correction, device roadmap, wireless.
export const RULES_G_EMERGING: Rule[] = [
  { id: 'G2.5a', why: 'G2.5: the PMIC lesson teaches the CCM/DCM boundary I_load = ΔI/2', require: { file: /lessons\/roles/, re: /discontinuous conduction \(DCM\)/ } },
  { id: 'G2.5b', why: 'G2.5: the PMIC lesson teaches dead time and shoot-through', require: { file: /lessons\/roles/, re: /\*\*dead time\*\*/ } },
  { id: 'G2.5c', why: 'G2.5: the PMIC lesson teaches LDO PSRR versus frequency', require: { file: /lessons\/roles/, re: /\*\*PSRR\*\*/ } },
  { id: 'G2.5d', why: 'G2.5: USB Power Delivery levels are 100 W (20 V, 5 A) and 240 W (48 V, 5 A)', require: { file: /lessons\/roles/, re: /240 W in the extended power range \(48 V at 5 A\)/ } },
  { id: 'G2.5e', why: 'G2.5: the Circuit Lab has the light-load DCM mission', require: { file: /games\/circuit\/levels\.ts/, re: /id: 'clab-dcm'/ } },
  { id: 'G2.6a', why: 'G2.6: the sensors lesson teaches correlated double sampling for 4T pinned-photodiode pixels', require: { file: /lessons\/frontier/, re: /4-transistor pinned-photodiode pixel/ } },
  { id: 'G2.6b', why: 'G2.6: the sensors lesson teaches DSNU and PRNU', require: { file: /lessons\/frontier/, re: /photo-response non-uniformity \(PRNU\)/ } },
  { id: 'G2.6c', why: 'G2.6: the MEMS lesson teaches angle random walk = density x 60', require: { file: /lessons\/frontier/, re: /ARW = density × 60/ } },
  { id: 'G2.6d', why: 'G2.6: the MEMS lesson reads bias instability off an Allan plot', require: { file: /lessons\/frontier/, re: /\*\*bias instability\*\* is/ } },
  { id: 'G2.6e', why: 'G2.6: CDS is only for 4T pinned-photodiode pixels, never claimed for 3T hard-reset pixels', files: /^src\/(lessons|practice)\//, ban: /correlated double sampling[^.]*\b3T\b[^.]*\b(removes|cancels)\b/i },
  { id: 'G2.7a', why: 'G2.7: the dense grid is anchored at 193.1 THz', require: { file: /lessons\/roles/, re: /anchored at \*\*193\.1 THz\*\*/ } },
  { id: 'G2.7b', why: 'G2.7: the coarse grid is 18 channels from 1271 to 1611 nm', require: { file: /lessons\/roles/, re: /1271 to 1611 nm, which is 18 channels/ } },
  { id: 'G2.7c', why: 'G2.7: 800G and 1.6T lane arithmetic', require: { file: /lessons\/roles/, re: /1\.6T is 8 × 200G/ } },
  { id: 'G2.7d', why: 'G2.7: extinction ratio and OMA are taught', require: { file: /lessons\/roles/, re: /optical modulation amplitude \(OMA\)/ } },
  { id: 'G2.8a', why: 'G2.8: error correction below threshold divides the logical error by Λ per distance step', require: { file: /lessons\/quantum/, re: /divides the logical error rate by a factor Λ/ } },
  { id: 'G2.8b', why: 'G2.8: T2* <= T2 <= 2 T1', require: { file: /lessons\/quantum/, re: /T2\* ≤ T2 ≤ 2·T1/ } },
  { id: 'G2.8c', why: 'G2.8: DiVincenzo criteria are listed', require: { file: /lessons\/quantum/, re: /DiVincenzo\\'s five criteria/ } },
  { id: 'G2.8d', why: 'G2.8: randomized benchmarking r = (1 - p)(d - 1)/d', require: { file: /lessons\/quantum/, re: /r = \(1 - p\)\(d - 1\)\/d/ } },
  { id: 'G2.8e', why: 'G2.8: quantum volume is 2^n', require: { file: /lessons\/quantum/, re: /QV = 2\^n/ } },
  { id: 'G2.9a', why: 'G2.9: CFETs are expected from about the early 2030s', require: { file: /lessons\/frontier/, re: /CFETs\) from about the early 2030s/ } },
  { id: 'G2.9b', why: 'G2.9: compare nodes by drawn dimensions', require: { file: /lessons\/frontier/, re: /contacted gate pitch/ } },
  { id: 'G3.7a', why: 'G3.7: the RF lesson says where wireless is used (Wi-Fi 7 numbers, Bluetooth 6 channel sounding)', require: { file: /lessons\/roles/, re: /Wi-Fi 7 widens the channel to 320 MHz, packs 4096-QAM/ } },
  { id: 'G3.7b', why: 'G3.7: Bluetooth 6 channel sounding', require: { file: /lessons\/roles/, re: /Bluetooth 6 adds channel sounding/ } },
];
