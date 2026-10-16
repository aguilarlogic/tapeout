import type { Rule } from './types';

// G1.8 timing signoff, G1.9 backside power and advanced-node PD, G3.6 packaging detail, G3.8 EDA algorithms.
export const RULES_G_PD: Rule[] = [
  {
    id: 'G1.8-rc-corners',
    why: 'G1.8: setup uses Cworst (short) / RCworst (long); hold uses Cbest (short) / RCbest (long)',
    require: { file: /lessons\/vlsi/, re: /Cworst[^\n]*RCworst[^\n]*Cbest[^\n]*RCbest/ },
  },
  {
    id: 'G1.8-cworst-not-hold',
    why: 'G1.8: Cworst does not limit hold on short paths; hold is checked at Cbest',
    files: /lessons|practice|glossary|games\/sta2/,
    ban: /Cworst (limits|is (the )?(worst|worst-case|most pessimistic)( corner)? for) hold/i,
  },
  {
    id: 'G1.8-pocv',
    why: 'G1.8: POCV/SOCV carries a mean and sigma per arc (LVF); path sigma is the root-sum-square',
    require: { file: /lessons\/vlsi/, re: /root-sum-square/ },
  },
  {
    id: 'G1.8-mmmc',
    why: 'G1.8: each scenario is mode x corner; signoff runs dozens',
    require: { file: /lessons\/vlsi/, re: /multi-mode multi-corner/i },
  },
  {
    id: 'G1.8-lvf',
    why: 'G1.8: the library carries variation as LVF; CCS/ECSM are the accurate current-source models',
    require: { file: /lessons\/frontier/, re: /LVF/ },
  },
  {
    id: 'G1.8-sta-pocv-lab',
    why: 'G1.8: STA Lab mission sta-pocv',
    require: { file: /games\/sta2\/levels/, re: /id: 'sta-pocv'/ },
  },
  {
    id: 'G3.8-astar',
    why: 'G3.8: A* versus Lee in maze routing',
    require: { file: /lessons\/frontier/, re: /A\*/ },
  },
  {
    id: 'G3.8-steiner',
    why: 'G3.8: rectilinear Steiner trees beat spanning trees',
    require: { file: /lessons\/frontier/, re: /Steiner/ },
  },
  {
    id: 'G3.8-hpwl-exact',
    why: 'G3.8: HPWL is exact only for 2- and 3-pin nets',
    files: /lessons|practice|glossary/,
    ban: /HPWL (is|equals) (exact|the exact)(?![^\n]*(two|three|2|3))/,
  },
  {
    id: 'G1.9-backside-numbers',
    why: 'G1.9: backside power figures are vendor claims for a first production node (about 10x droop, 11% routing area, 6% Fmax); the 30% IR-drop cut was a 2023 test chip',
    files: /lessons|practice|glossary/,
    ban: /backside[^\n]{0,100}\b30 ?% (IR|droop|less IR|lower IR)|\b30 ?% (IR|droop)[^\n]{0,60}backside/i,
  },
  {
    id: 'G1.9-backside-vendor',
    why: 'G1.9: teach the backside-power numbers as about / up to, and as vendor claims',
    require: { file: /lessons\/roles/, re: /vendor claims/ },
  },
  {
    id: 'G1.9-backside-routing',
    why: 'G1.9: the main routing benefit is front-side tracks freed from power straps',
    require: { file: /lessons\/roles/, re: /front-side/ },
  },
  {
    id: 'G1.9-multipatterning-colour',
    why: 'G1.9: multi-patterning means colouring, with same-colour spacing rules',
    require: { file: /lessons\/roles/, re: /same-colour spacing/ },
  },
  {
    id: 'G1.9-quantized-widths',
    why: 'G1.9: fins and nanosheets give discrete transistor widths',
    require: { file: /lessons\/roles/, re: /discrete steps/ },
  },
  {
    id: 'G1.9-pd-data-formats',
    why: 'G1.9: LEF abstracts, DEF placement and routing, SPEF parasitics, GDS/OASIS masks',
    require: { file: /lessons\/roles/, re: /LEF[^\n]*DEF[^\n]*SPEF[^\n]*OASIS/ },
  },
  {
    id: 'G1.9-glossary',
    why: 'G1.9: glossary entries for backside power, multi-patterning and the PD data formats',
    require: { file: /glossary/, re: /'backside power\|/ },
  },
  {
    id: 'G3.6-thermal-paths',
    why: 'G3.6: junction-to-board and junction-to-case paths',
    require: { file: /lessons\/roles/, re: /[Jj]unction-to-board/ },
  },
  {
    id: 'G3.6-stack-classes',
    why: 'G3.6: interposer versus bridge versus hybrid-bonded stacks',
    require: { file: /lessons\/roles/, re: /bridge[^\n]*hybrid-bonded|hybrid-bonded[^\n]*bridge/ },
  },
];
