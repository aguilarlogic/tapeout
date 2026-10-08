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
];
