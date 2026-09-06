// data.js — pure data: card database & event table. No logic, no DOM.
(function (root) {
  const CR = root.CR = root.CR || {};

        const CARD_DATABASE = [
            { id: 1, name: "Commercial Space Launch", category: "economy", maturity: "driving", cost: { money: 12, materials: 0, energy: 0, research: 0 }, effect: "Earth-Venus supply costs permanently halved", type: "permanent", venusEffect: { money: 5 } },
            { id: 2, name: "Asteroid Mining Economy", category: "economy", maturity: "brewing", cost: { money: 30, materials: 10, energy: 5, research: 5 }, effect: "+12 Funds per turn after 3 turns", type: "contract", delay: 3, venusEffect: { money: 12 } },
            { id: 3, name: "Space Tourism Market", category: "economy", maturity: "trending", cost: { money: 15, materials: 0, energy: 3, research: 0 }, effect: "+6 Funds +3 Morale per turn", type: "permanent", venusEffect: { money: 6, morale: 3 } },
            { id: 4, name: "Orbital Solar Power Station", category: "economy", maturity: "emerging", cost: { money: 20, materials: 8, energy: 0, research: 2 }, effect: "+8 Funds -2 Energy per turn", type: "permanent", venusEffect: { money: 8, energy: -2 } },
            { id: 5, name: "Helium-3 Fuel Trade", category: "economy", maturity: "trending", cost: { money: 10, materials: 5, energy: 0, research: 0 }, effect: "One-time +15 Funds", type: "contract", venusEffect: { money: 15 } },
            { id: 6, name: "Space Manufacturing", category: "economy", maturity: "emerging", cost: { money: 18, materials: 12, energy: 5, research: 3 }, effect: "+4 Materials +4 Funds per turn", type: "permanent", venusEffect: { money: 4, materials: 4 } },
            { id: 7, name: "Interstellar Logistics Network", category: "economy", maturity: "signaling", cost: { money: 15, materials: 8, energy: 3, research: 5 }, effect: "All transport costs -20%", type: "permanent", venusEffect: { money: 3 } },
            { id: 8, name: "Rare Metal Futures", category: "economy", maturity: "trending", cost: { money: 8, materials: 0, energy: 0, research: 0 }, effect: "One-time +10 Funds (Risky)", type: "contract", venusEffect: { money: 10 }, risk: true },
            { id: 9, name: "Space Advertising", category: "economy", maturity: "signaling", cost: { money: 6, materials: 0, energy: 2, research: 0 }, effect: "+8 Funds -2 Morale (Controversial)", type: "contract", venusEffect: { money: 8, morale: -2 } },
            { id: 10, name: "Microgravity Pharmaceuticals", category: "economy", maturity: "emerging", cost: { money: 22, materials: 6, energy: 4, research: 8 }, effect: "+10 Funds +2 Research per turn", type: "permanent", venusEffect: { money: 10, research: 2 } },

            { id: 11, name: "Atmospheric Observation Network", category: "environment", maturity: "driving", cost: { money: 8, materials: 4, energy: 2, research: 0 }, effect: "+3 Research per turn", type: "permanent", venusEffect: { research: 3 } },
            { id: 12, name: "Trace Gas Detection", category: "environment", maturity: "signaling", cost: { money: 12, materials: 3, energy: 2, research: 5 }, effect: "Purification efficiency +10%", type: "permanent", venusEffect: { purification: 10 } },
            { id: 13, name: "Space Agriculture Research", category: "environment", maturity: "brewing", cost: { money: 25, materials: 15, energy: 8, research: 10 }, effect: "Unlock Floating Farms (Food Self-Sufficiency)", type: "permanent", venusEffect: { materials: 3, morale: 2 } },
            { id: 14, name: "Carbon Capture Technology", category: "environment", maturity: "emerging", cost: { money: 18, materials: 10, energy: 6, research: 4 }, effect: "Purification +8%", type: "contract", venusEffect: { purification: 8 } },
            { id: 15, name: "Ecological Closed-Loop System", category: "environment", maturity: "trending", cost: { money: 20, materials: 12, energy: 5, research: 6 }, effect: "+3 Materials +2 Energy per turn", type: "permanent", venusEffect: { materials: 3, energy: 2 } },
            { id: 16, name: "Climate Regulation Satellites", category: "environment", maturity: "signaling", cost: { money: 30, materials: 8, energy: 10, research: 8 }, effect: "Corrosion rate -0.5% per turn", type: "permanent", venusEffect: { corrosion: -0.5 } },
            { id: 17, name: "Biodegradable Materials", category: "environment", maturity: "emerging", cost: { money: 10, materials: 8, energy: 2, research: 3 }, effect: "Repair costs -25%", type: "permanent", venusEffect: { materials: 1 } },
            { id: 18, name: "Sulfuric Cloud Sampling", category: "environment", maturity: "trending", cost: { money: 8, materials: 4, energy: 3, research: 2 }, effect: "Purification +5% +3 Research", type: "contract", venusEffect: { purification: 5, research: 3 } },
            { id: 19, name: "Orbital Mirror Array", category: "environment", maturity: "brewing", cost: { money: 35, materials: 20, energy: 15, research: 12 }, effect: "Surface temperature control Morale +5", type: "permanent", venusEffect: { morale: 5 } },
            { id: 20, name: "Microbial Purification", category: "environment", maturity: "signaling", cost: { money: 15, materials: 8, energy: 4, research: 6 }, effect: "Purification +6% Funds -3", type: "contract", venusEffect: { purification: 6, money: -3 } },

            { id: 21, name: "Lunar Treaty Negotiation", category: "governance", maturity: "signaling", cost: { money: 10, materials: 0, energy: 0, research: 5 }, effect: "Share research with player (Both +3)", type: "contract", venusEffect: { research: 3 }, special: "share" },
            { id: 22, name: "Space Militarization", category: "governance", maturity: "trending", cost: { money: 20, materials: 12, energy: 8, research: 0 }, effect: "Routes unblockable Morale -3", type: "permanent", venusEffect: { morale: -3 } },
            { id: 23, name: "Interstellar Governance", category: "governance", maturity: "brewing", cost: { money: 40, materials: 0, energy: 0, research: 15 }, effect: "Unlock Res Publica Charter", type: "permanent", venusEffect: { morale: 5 }, special: "charter" },
            { id: 24, name: "Trade Agreement", category: "governance", maturity: "emerging", cost: { money: 8, materials: 0, energy: 0, research: 0 }, effect: "+2 Funds +2 Materials +2 Energy per turn (3 turns)", type: "contract", venusEffect: { money: 2, materials: 2, energy: 2 }, duration: 3 },
            { id: 25, name: "Emergency Mobilization", category: "governance", maturity: "trending", cost: { money: 5, materials: 0, energy: 0, research: 0 }, effect: "Play 1 extra card this turn", type: "contract", venusEffect: {}, special: "extraCard" },
            { id: 26, name: "Resource Sharing Protocol", category: "governance", maturity: "emerging", cost: { money: 0, materials: 0, energy: 0, research: 3 }, effect: "Gain 10% target player funds", type: "contract", venusEffect: { money: 5 }, special: "steal" },
            { id: 27, name: "Space Court", category: "governance", maturity: "signaling", cost: { money: 15, materials: 5, energy: 2, research: 8 }, effect: "Block next negative event", type: "permanent", venusEffect: {}, special: "shield" },
            { id: 28, name: "Colonial Act", category: "governance", maturity: "emerging", cost: { money: 12, materials: 0, energy: 0, research: 4 }, effect: "Habitat capacity +1", type: "permanent", venusEffect: { habitat: 1 } },
            { id: 29, name: "Tax Reform", category: "governance", maturity: "trending", cost: { money: 0, materials: 0, energy: 0, research: 0 }, effect: "Immediate +20 Funds Morale -5", type: "contract", venusEffect: { money: 20, morale: -5 } },
            { id: 30, name: "Diplomatic Mission", category: "governance", maturity: "driving", cost: { money: 6, materials: 0, energy: 0, research: 2 }, effect: "Morale +5 Purification +2%", type: "contract", venusEffect: { morale: 5, purification: 2 } },

            { id: 31, name: "Extraterrestrial Identity", category: "social", maturity: "signaling", cost: { money: 10, materials: 0, energy: 0, research: 4 }, effect: "Morale floor locked at 40", type: "permanent", venusEffect: { morale: 3 }, special: "moraleFloor" },
            { id: 32, name: "Space Survival Insurance", category: "social", maturity: "brewing", cost: { money: 25, materials: 0, energy: 0, research: 0 }, effect: "Retain 50% resources after crash", type: "permanent", venusEffect: {}, special: "insurance" },
            { id: 33, name: "Virtual Reality Entertainment", category: "social", maturity: "trending", cost: { money: 12, materials: 3, energy: 5, research: 0 }, effect: "Morale +8 Energy -3", type: "contract", venusEffect: { morale: 8, energy: -3 } },
            { id: 34, name: "Space Art Program", category: "social", maturity: "emerging", cost: { money: 8, materials: 2, energy: 2, research: 0 }, effect: "Morale +5 Funds +2", type: "contract", venusEffect: { morale: 5, money: 2 } },
            { id: 35, name: "Education Center", category: "social", maturity: "emerging", cost: { money: 15, materials: 8, energy: 4, research: 0 }, effect: "+2 Research +1 Morale per turn", type: "permanent", venusEffect: { research: 2, morale: 1 } },
            { id: 36, name: "Cultural Festival", category: "social", maturity: "trending", cost: { money: 10, materials: 5, energy: 3, research: 0 }, effect: "Morale +10 Materials -5", type: "contract", venusEffect: { morale: 10, materials: -5 } },
            { id: 37, name: "Mental Health Program", category: "social", maturity: "driving", cost: { money: 8, materials: 0, energy: 0, research: 2 }, effect: "Morale +6", type: "contract", venusEffect: { morale: 6 } },
            { id: 38, name: "Historical Archives", category: "social", maturity: "signaling", cost: { money: 12, materials: 6, energy: 2, research: 5 }, effect: "Endgame prestige +15 points", type: "permanent", venusEffect: {}, special: "prestige" },
            { id: 39, name: "Multicultural Integration", category: "social", maturity: "emerging", cost: { money: 10, materials: 0, energy: 0, research: 3 }, effect: "Morale +4 Research +2", type: "contract", venusEffect: { morale: 4, research: 2 } },
            { id: 40, name: "Space Sports League", category: "social", maturity: "trending", cost: { money: 14, materials: 8, energy: 5, research: 0 }, effect: "Morale +7 Integrity +2%", type: "contract", venusEffect: { morale: 7, integrity: 2 } },

            { id: 41, name: "Autonomous Space Robotics", category: "tech", maturity: "signaling", cost: { money: 18, materials: 10, energy: 5, research: 8 }, effect: "Corrosion -1% per turn", type: "permanent", venusEffect: { corrosion: -1 } },
            { id: 42, name: "Reusable Rocket Revolution", category: "tech", maturity: "driving", cost: { money: 25, materials: 15, energy: 0, research: 5 }, effect: "All transport costs -40%", type: "permanent", venusEffect: { money: 3 } },
            { id: 43, name: "Space Elevator", category: "tech", maturity: "brewing", cost: { money: 50, materials: 40, energy: 20, research: 20 }, effect: "Megastructure +15 Materials per turn", type: "permanent", venusEffect: { materials: 15 }, special: "megastructure" },
            { id: 44, name: "Quantum Communication Network", category: "tech", maturity: "signaling", cost: { money: 20, materials: 5, energy: 8, research: 10 }, effect: "Research output +25%", type: "permanent", venusEffect: { research: 2 } },
            { id: 45, name: "Nanobot Repair Technology", category: "tech", maturity: "emerging", cost: { money: 22, materials: 12, energy: 6, research: 8 }, effect: "Repair efficiency doubled", type: "permanent", venusEffect: { materials: 1 } },
            { id: 46, name: "AI Management System", category: "tech", maturity: "trending", cost: { money: 30, materials: 8, energy: 10, research: 12 }, effect: "Energy consumption -20% Funds +5/turn", type: "permanent", venusEffect: { money: 5, energy: -2 } },
            { id: 47, name: "Nuclear Fusion Thruster", category: "tech", maturity: "emerging", cost: { money: 35, materials: 20, energy: 0, research: 15 }, effect: "+10 Energy per turn", type: "permanent", venusEffect: { energy: 10 } },
            { id: 48, name: "Genetically Modified Crops", category: "tech", maturity: "trending", cost: { money: 15, materials: 8, energy: 4, research: 6 }, effect: "+5 Materials +2 Morale per turn", type: "permanent", venusEffect: { materials: 5, morale: 2 } },
            { id: 49, name: "Deep Space Detection Network", category: "tech", maturity: "signaling", cost: { money: 18, materials: 6, energy: 8, research: 10 }, effect: "+4 Research +3% Purification per turn", type: "permanent", venusEffect: { research: 4, purification: 3 } },
            { id: 50, name: "Holographic Projection", category: "tech", maturity: "emerging", cost: { money: 12, materials: 4, energy: 6, research: 4 }, effect: "Morale +3 Funds +3/turn", type: "permanent", venusEffect: { money: 3, morale: 3 } },
            { id: 51, name: "Superconducting Materials", category: "tech", maturity: "trending", cost: { money: 20, materials: 10, energy: 0, research: 8 }, effect: "Energy transmission loss -30%", type: "permanent", venusEffect: { energy: 3 } },
            { id: 52, name: "Consciousness Upload Backup", category: "tech", maturity: "brewing", cost: { money: 40, materials: 0, energy: 15, research: 20 }, effect: "Ultimate insurance No loss on crash", type: "permanent", venusEffect: {}, special: "ultimate" },

            { id: 53, name: "Space Radiation Medicine", category: "wellbeing", maturity: "brewing", cost: { money: 30, materials: 10, energy: 5, research: 12 }, effect: "Solar storms no longer cause casualties", type: "permanent", venusEffect: {}, special: "stormShield" },
            { id: 54, name: "Artificial Gravity System", category: "wellbeing", maturity: "brewing", cost: { money: 35, materials: 20, energy: 15, research: 15 }, effect: "Morale no longer decays naturally", type: "permanent", venusEffect: { morale: 5 }, special: "noMoraleDecay" },
            { id: 55, name: "Life Support Upgrade", category: "wellbeing", maturity: "emerging", cost: { money: 15, materials: 10, energy: 5, research: 5 }, effect: "+3 Energy +2 Morale per turn", type: "permanent", venusEffect: { energy: 3, morale: 2 } },
            { id: 56, name: "Medical Center", category: "wellbeing", maturity: "trending", cost: { money: 18, materials: 8, energy: 4, research: 0 }, effect: "Integrity +5% Morale +3", type: "contract", venusEffect: { integrity: 5, morale: 3 } },
            { id: 57, name: "Nutrient Synthesizer", category: "wellbeing", maturity: "emerging", cost: { money: 12, materials: 8, energy: 6, research: 4 }, effect: "+4 Materials per turn", type: "permanent", venusEffect: { materials: 4 } },
            { id: 58, name: "Psychological Support AI", category: "wellbeing", maturity: "trending", cost: { money: 10, materials: 0, energy: 3, research: 5 }, effect: "Morale +5 Research +1", type: "contract", venusEffect: { morale: 5, research: 1 } },
            { id: 59, name: "Emergency Shelter", category: "wellbeing", maturity: "driving", cost: { money: 8, materials: 6, energy: 2, research: 0 }, effect: "Integrity +3% Funds -2", type: "contract", venusEffect: { integrity: 3, money: -2 } },
            { id: 60, name: "Fitness Facilities", category: "wellbeing", maturity: "emerging", cost: { money: 10, materials: 5, energy: 3, research: 0 }, effect: "Morale +4 Integrity +1%", type: "contract", venusEffect: { morale: 4, integrity: 1 } },

            { id: 61, name: "Sulfuric Cloud Purification Pilot", category: "venus", maturity: "brewing", cost: { money: 30, materials: 15, energy: 10, research: 10 }, effect: "Purification progress +20%", type: "contract", venusEffect: { purification: 20 } },
            { id: 62, name: "Floating Bubble Expansion", category: "venus", maturity: "emerging", cost: { money: 40, materials: 30, energy: 15, research: 5 }, effect: "+1 Habitat (shared 5-expansion limit)", type: "contract", venusEffect: { habitat: 1 }, special: "expand" },
            { id: 63, name: "CO2 Electrolysis Oxygen", category: "venus", maturity: "emerging", cost: { money: 20, materials: 10, energy: 0, research: 8 }, effect: "Life support self-sufficient Energy +4/turn", type: "permanent", venusEffect: { energy: 4 } },
            { id: 64, name: "High-Altitude Wind Array", category: "venus", maturity: "trending", cost: { money: 25, materials: 15, energy: 0, research: 6 }, effect: "+6 Energy/turn (Utilizes super-rotation winds)", type: "permanent", venusEffect: { energy: 6 } },
            { id: 65, name: "Acid-Resistant Skin Coating", category: "venus", maturity: "driving", cost: { money: 15, materials: 12, energy: 3, research: 4 }, effect: "Corrosion -1% per turn", type: "permanent", venusEffect: { corrosion: -1 } },
            { id: 66, name: "Cloud Water Cycle", category: "venus", maturity: "emerging", cost: { money: 18, materials: 10, energy: 5, research: 5 }, effect: "Food/water self-sufficiency +25%", type: "permanent", venusEffect: { materials: 2, morale: 1 } }
        ];

        const EVENTS = [
            { id: 1, name: "Sulfuric Cloud Surge", desc: "Strong acidic clouds sweep through. Structural Integrity -3%", effect: { integrity: -3 } },
            { id: 2, name: "Solar Storm", desc: "High-energy particle burst. Energy -5 Research -2", effect: { energy: -5, research: -2 } },
            { id: 3, name: "Supply Window", desc: "Earth supply ship arrives. Funds +15 Materials +10", effect: { money: 15, materials: 10 } },
            { id: 4, name: "Investment Boom", desc: "Interstellar investors take notice. Funds +20", effect: { money: 20 } },
            { id: 5, name: "Major Discovery", desc: "Research team breakthrough. All players Research +6", effect: { research: 6 } },
            { id: 6, name: "Equipment Aging", desc: "Maintenance system failure. Materials -8 Energy -3", effect: { materials: -8, energy: -3 } },
            { id: 7, name: "Worker Strike", desc: "Labor rights protest. Morale -10 Cannot act this turn", effect: { morale: -10, strike: true } },
            { id: 8, name: "Trade Convoy", desc: "Merchant fleet passes by. Funds +12 Materials +8", effect: { money: 12, materials: 8 } },
            { id: 9, name: "Acid Rain Corrosion", desc: "Abnormal acid rain. Structural Integrity -4%", effect: { integrity: -4 } },
            { id: 10, name: "Tech Breakthrough", desc: "Unexpected discovery. Research +8 Purification +5%", effect: { research: 8, purification: 5 } },
            { id: 11, name: "Market Crash", desc: "Interstellar financial crisis. Funds -15", effect: { money: -15 } },
            { id: 12, name: "Immigration Wave", desc: "New colonists arrive. Morale +8 Materials -5", effect: { morale: 8, materials: -5 } },
            { id: 13, name: "Energy Leak", desc: "Reactor micro-leak. Energy -8 Integrity -2%", effect: { energy: -8, integrity: -2 } },
            { id: 14, name: "Diplomatic Visit", desc: "Earth delegation visits. Morale +6 Funds +5", effect: { morale: 6, money: 5 } },
            { id: 15, name: "Meteor Threat", desc: "Asteroid approach. Integrity -5% Materials -10 (Defense)", effect: { integrity: -5, materials: -10 } },
            { id: 16, name: "Research Competition", desc: "International competition win. Research +10 Funds +5", effect: { research: 10, money: 5 } },
            { id: 17, name: "Resource Depletion", desc: "Mine exhausted. Materials -12", effect: { materials: -12 } },
            { id: 18, name: "Cultural Renaissance", desc: "Art movement rises. Morale +12", effect: { morale: 12 } },
            { id: 19, name: "Grid Overload", desc: "Power system overload. Energy -6 Funds -5 (Repair)", effect: { energy: -6, money: -5 } },
            { id: 20, name: "Peaceful Period", desc: "Relative stability. All resources +2", effect: { money: 2, materials: 2, energy: 2, research: 2, morale: 2 } }
        ];


// ==================== DIFFICULTY LEVELS (spec §2, tuned via simulation — see plan appendix A) ====================
const DIFFICULTY_LEVELS = {
  easy: {
    key: 'easy',
    maxTurns: 24,
    corrosionRate: 1.5,
    initialHandSize: 4,
    handLimit: 8,
    drawPerTurn: 2,
    energyMaintenance: 4,
    guaranteedCards: [12],
    resources: { money: 90, materials: 100, energy: 35, research: 10, morale: 80, integrity: 100 }
  },
  medium: {
    key: 'medium',
    maxTurns: 22,
    corrosionRate: 2,
    initialHandSize: 4,
    handLimit: 8,
    drawPerTurn: 2,
    energyMaintenance: 4,
    guaranteedCards: [12],
    resources: { money: 65, materials: 75, energy: 25, research: 8, morale: 70, integrity: 100 }
  },
  hard: {
    key: 'hard',
    maxTurns: 19,
    corrosionRate: 2.5,
    initialHandSize: 3,
    handLimit: 8,
    drawPerTurn: 2,
    energyMaintenance: 5,
    guaranteedCards: [12],
    resources: { money: 50, materials: 55, energy: 20, research: 7, morale: 60, integrity: 100 }
  },
  // M3: sandbox defaults mirror medium exactly — a sandbox game with no custom
  // config (or an all-default one) plays identically to the medium baseline.
  sandbox: {
    key: 'sandbox',
    maxTurns: 22,
    corrosionRate: 2,
    initialHandSize: 4,
    handLimit: 8,
    drawPerTurn: 2,
    energyMaintenance: 4,
    guaranteedCards: [12],
    resources: { money: 65, materials: 75, energy: 25, research: 8, morale: 70, integrity: 100 }
  }
};

// ==================== SANDBOX LIMITS (M3 spec §2.1 — min/max/step/default per tunable rule) ====================
// resourcePreset scales the medium starting resources (rounded): poor x0.75 / standard x1.0 / rich x1.5.
// Note: initialHandSize def is 4 (= true medium base), not 3 as the spec table row stated — see plan "spec 偏差建议".
const SANDBOX_LIMITS = {
  maxTurns:          { min: 15, max: 30, step: 1,   def: 22 },
  corrosionRate:     { min: 0,  max: 4,  step: 0.5, def: 2 },
  energyMaintenance: { min: 0,  max: 8,  step: 1,   def: 4 },
  drawPerTurn:       { min: 1,  max: 4,  step: 1,   def: 2 },
  initialHandSize:   { min: 2,  max: 6,  step: 1,   def: 4 },
  resourcePreset:    { options: ['poor', 'standard', 'rich'], def: 'standard',
                       scale: { poor: 0.75, standard: 1, rich: 1.5 } }
};

// ==================== DECK RULES (M4 spec §2.2 — deck-building constraints) ====================
// 'full' = the whole CARD_DATABASE x1 (default). Custom decks: min/max total cards,
// max copies per single card. Persistence: cr_deck v1 { v, deckId, cards:{id:copies} }.
const DECK_RULES = {
  minSize: 20,
  maxSize: 40,
  maxCopies: 2,
  fullDeckId: 'full'
};

// ==================== TECH TREE (M5 spec §2.1 — in-run research tree, 3 branches x 3 tiers) ====================
// Every node effect maps onto an EXISTING state modifier field (the same fields
// factions/meta perks use) with the established floor semantics; engine.unlockTech
// is the only writer and no new consumption points are introduced. effect:
// { field, mode: 'add'|'multiply', value, floor? }. Costs per spec §2.1 table
// (dry-run calibration may adjust within the pacing guard, see plan §5).
const TECH_BRANCHES = ['atm', 'log', 'grid'];
const TECH_TREE = {
  atm_1:  { branch: 'atm',  tier: 1, cost: 6,  icon: 'cat.environment', effect: { field: 'purificationMultiplier', mode: 'add',      value: 0.10 } },
  atm_2:  { branch: 'atm',  tier: 2, cost: 12, icon: 'cat.environment', effect: { field: 'corrosionRate',          mode: 'add',      value: -0.3, floor: 1.0 } },
  atm_3:  { branch: 'atm',  tier: 3, cost: 18, icon: 'cat.environment', effect: { field: 'purificationMultiplier', mode: 'add',      value: 0.15 } },
  log_1:  { branch: 'log',  tier: 1, cost: 6,  icon: 'cat.economy',     effect: { field: 'moneyMultiplier',        mode: 'add',      value: 0.10 } },
  log_2:  { branch: 'log',  tier: 2, cost: 12, icon: 'cat.economy',     effect: { field: 'transportDiscount',      mode: 'multiply', value: 0.92, floor: 0.4 } },
  log_3:  { branch: 'log',  tier: 3, cost: 18, icon: 'cat.economy',     effect: { field: 'habitatMaterialsDelta',  mode: 'add',      value: -2, floor: -4 } },
  grid_1: { branch: 'grid', tier: 1, cost: 6,  icon: 'cat.tech',        effect: { field: 'energyMaintenance',      mode: 'add',      value: -1, floor: 2 } },
  grid_2: { branch: 'grid', tier: 2, cost: 12, icon: 'cat.tech',        effect: { field: 'researchIncome',         mode: 'add',      value: 1 } },
  grid_3: { branch: 'grid', tier: 3, cost: 18, icon: 'cat.tech',        effect: { field: 'handLimit',              mode: 'add',      value: 1 } }
};

// ==================== ZH TRANSLATIONS (cards: name_zh / effect_zh; events: name_zh / desc_zh) ====================
const CARD_ZH = {
  1:  { name_zh: '商业太空发射', effect_zh: '地金运输成本永久减半' },
  2:  { name_zh: '小行星采矿经济', effect_zh: '3 回合后每回合 +12 资金' },
  3:  { name_zh: '太空旅游市场', effect_zh: '每回合 +6 资金 +3 士气' },
  4:  { name_zh: '轨道太阳能电站', effect_zh: '每回合 +8 资金 -2 能源' },
  5:  { name_zh: '氦-3 燃料贸易', effect_zh: '一次性 +15 资金' },
  6:  { name_zh: '太空制造', effect_zh: '每回合 +4 材料 +4 资金' },
  7:  { name_zh: '星际物流网络', effect_zh: '全部运输成本 -20%' },
  8:  { name_zh: '稀有金属期货', effect_zh: '一次性 +10 资金（有风险）' },
  9:  { name_zh: '太空广告', effect_zh: '+8 资金 -2 士气（有争议）' },
  10: { name_zh: '微重力制药', effect_zh: '每回合 +10 资金 +2 科研' },
  11: { name_zh: '大气观测网络', effect_zh: '每回合 +3 科研' },
  12: { name_zh: '痕量气体检测', effect_zh: '净化效率 +10%' },
  13: { name_zh: '太空农业研究', effect_zh: '解锁浮空农场（食物自给）' },
  14: { name_zh: '碳捕获技术', effect_zh: '净化 +8%' },
  15: { name_zh: '生态闭环系统', effect_zh: '每回合 +3 材料 +2 能源' },
  16: { name_zh: '气候调节卫星', effect_zh: '腐蚀率每回合 -0.5%' },
  17: { name_zh: '可降解材料', effect_zh: '修理成本 -25%' },
  18: { name_zh: '硫酸云采样', effect_zh: '净化 +5%，科研 +3' },
  19: { name_zh: '轨道反射镜阵列', effect_zh: '地表温控，士气 +5' },
  20: { name_zh: '微生物净化', effect_zh: '净化 +6%，资金 -3' },
  21: { name_zh: '月球条约谈判', effect_zh: '与玩家共享科研（双方 +3）' },
  22: { name_zh: '太空军事化', effect_zh: '航线不可封锁，士气 -3' },
  23: { name_zh: '星际治理', effect_zh: '解锁《公共共和国宪章》' },
  24: { name_zh: '贸易协定', effect_zh: '全部资源产出 +10%（持续 3 回合）' },
  25: { name_zh: '紧急动员', effect_zh: '本回合可额外打出 1 张牌' },
  26: { name_zh: '资源共享协议', effect_zh: '获得目标玩家 10% 资金' },
  27: { name_zh: '太空法庭', effect_zh: '抵消下一次负面事件' },
  28: { name_zh: '殖民法案', effect_zh: '栖息地容量 +1' },
  29: { name_zh: '税制改革', effect_zh: '立即 +20 资金，士气 -5' },
  30: { name_zh: '外交使团', effect_zh: '士气 +5，净化 +2%' },
  31: { name_zh: '地外身份认同', effect_zh: '士气下限锁定为 40' },
  32: { name_zh: '太空生存保险', effect_zh: '坠毁后保留 50% 资源' },
  33: { name_zh: '虚拟现实娱乐', effect_zh: '士气 +8，能源 -3' },
  34: { name_zh: '太空艺术计划', effect_zh: '士气 +5，资金 +2' },
  35: { name_zh: '教育中心', effect_zh: '每回合 +2 科研 +1 士气' },
  36: { name_zh: '文化节', effect_zh: '士气 +10，材料 -5' },
  37: { name_zh: '心理健康计划', effect_zh: '士气 +6' },
  38: { name_zh: '历史档案馆', effect_zh: '终局声望 +15' },
  39: { name_zh: '多元文化融合', effect_zh: '士气 +4，科研 +2' },
  40: { name_zh: '太空体育联盟', effect_zh: '士气 +7，完整度 +2%' },
  41: { name_zh: '自主太空机器人', effect_zh: '腐蚀率每回合 -1%' },
  42: { name_zh: '可回收火箭革命', effect_zh: '全部运输成本 -40%' },
  43: { name_zh: '太空电梯', effect_zh: '巨构建筑，每回合 +15 材料' },
  44: { name_zh: '量子通信网络', effect_zh: '科研产出 +25%' },
  45: { name_zh: '纳米机器人修理技术', effect_zh: '修理效率翻倍' },
  46: { name_zh: 'AI 管理系统', effect_zh: '能耗 -20%，每回合 +5 资金' },
  47: { name_zh: '核聚变推进器', effect_zh: '每回合 +10 能源' },
  48: { name_zh: '转基因作物', effect_zh: '每回合 +5 材料 +2 士气' },
  49: { name_zh: '深空探测网络', effect_zh: '每回合 +4 科研 +3% 净化' },
  50: { name_zh: '全息投影', effect_zh: '士气 +3，每回合 +3 资金' },
  51: { name_zh: '超导材料', effect_zh: '能源传输损耗 -30%' },
  52: { name_zh: '意识上传备份', effect_zh: '终极保险：坠毁无损失' },
  53: { name_zh: '太空辐射医学', effect_zh: '太阳风暴不再造成伤害' },
  54: { name_zh: '人工重力系统', effect_zh: '士气不再自然衰减' },
  55: { name_zh: '生命维持升级', effect_zh: '每回合 +3 能源 +2 士气' },
  56: { name_zh: '医疗中心', effect_zh: '完整度 +5%，士气 +3' },
  57: { name_zh: '营养合成器', effect_zh: '每回合 +4 材料' },
  58: { name_zh: '心理支持 AI', effect_zh: '士气 +5，科研 +1' },
  59: { name_zh: '紧急避难所', effect_zh: '完整度 +3%，资金 -2' },
  60: { name_zh: '健身设施', effect_zh: '士气 +4，完整度 +1%' },
  61: { name_zh: '硫酸云净化试点', effect_zh: '净化进度 +20%' },
  62: { name_zh: '浮空气泡扩容', effect_zh: '+1 栖息地（与建造共享 5 次上限）' },
  63: { name_zh: 'CO2 电解制氧', effect_zh: '生命维持自给，每回合 +4 能源' },
  64: { name_zh: '高空风能阵列', effect_zh: '每回合 +6 能源（利用超旋转风）' },
  65: { name_zh: '耐酸表皮涂层', effect_zh: '腐蚀率每回合 -1%' },
  66: { name_zh: '云水循环', effect_zh: '食物/水自给率 +25%' }
};

const EVENT_ZH = {
  1:  { name_zh: '硫酸云激增', desc_zh: '强酸云席卷，结构完整度 -3%' },
  2:  { name_zh: '太阳风暴', desc_zh: '高能粒子爆发，能源 -5，科研 -2' },
  3:  { name_zh: '补给窗口', desc_zh: '地球补给船抵达，资金 +15，材料 +10' },
  4:  { name_zh: '投资热潮', desc_zh: '星际投资者关注，资金 +20' },
  5:  { name_zh: '重大发现', desc_zh: '科研团队突破，全体科研 +6' },
  6:  { name_zh: '设备老化', desc_zh: '维护系统故障，材料 -8，能源 -3' },
  7:  { name_zh: '工人罢工', desc_zh: '劳工权益抗议，士气 -10，本回合无法行动' },
  8:  { name_zh: '贸易船队', desc_zh: '商船队经过，资金 +12，材料 +8' },
  9:  { name_zh: '酸雨腐蚀', desc_zh: '异常酸雨，结构完整度 -4%' },
  10: { name_zh: '技术突破', desc_zh: '意外发现，科研 +8，净化 +5%' },
  11: { name_zh: '市场崩盘', desc_zh: '星际金融危机，资金 -15' },
  12: { name_zh: '移民潮', desc_zh: '新殖民者抵达，士气 +8，材料 -5' },
  13: { name_zh: '能源泄漏', desc_zh: '反应堆微泄漏，能源 -8，完整度 -2%' },
  14: { name_zh: '外交访问', desc_zh: '地球代表团访问，士气 +6，资金 +5' },
  15: { name_zh: '流星威胁', desc_zh: '小行星逼近，完整度 -5%，材料 -10（防御）' },
  16: { name_zh: '科研竞赛', desc_zh: '国际竞赛获胜，科研 +10，资金 +5' },
  17: { name_zh: '资源枯竭', desc_zh: '矿脉耗尽，材料 -12' },
  18: { name_zh: '文化复兴', desc_zh: '艺术运动兴起，士气 +12' },
  19: { name_zh: '电网过载', desc_zh: '电力系统过载，能源 -6，资金 -5（修理）' },
  20: { name_zh: '和平时期', desc_zh: '相对稳定，全部资源 +2' }
};

CARD_DATABASE.forEach(c => { if (CARD_ZH[c.id]) Object.assign(c, CARD_ZH[c.id]); });
EVENTS.forEach(e => { if (EVENT_ZH[e.id]) Object.assign(e, EVENT_ZH[e.id]); });

// ==================== FACTIONS (M2 spec §2.1 — values verbatim from spec) ====================
  // Consumption: state.js expands these into flat state modifier fields; unknown keys ignored.
  const FACTIONS = {
    none:        { modifiers: {} },                                  // 自由殖民地（基线，无修正）
    guild:       { moneyMultiplier: 1.25, transportDiscount: 0.9,    // 苍穹商会：经济特化
                   startResources: { money: 15, morale: -10 } },
    covenant:    { purificationMultiplier: 1.15, corrosionDelta: -0.5,// 生态公约：净化特化
                   habitatMaterialsDelta: 2 },                       // 代价：建造材料 12→14（M3 平衡修正：4→2，实测 medium 32.2%）
    technocracy: { researchIncome: 2, researchCostMultiplier: 0.75,  // 技术执政团：科研特化
                   moraleDecayDelta: 1 }                             // 代价：士气衰减 1→2/回合
  };

  // ==================== META PERKS (M2 spec §3.2 — costs per level, effect per level) ====================
  const META_PERKS = {
    fund:     { max: 2, costs: [1, 2], startResources: { money: 10 } },      // 启动资金：起始资金 +10/级
    supplies: { max: 2, costs: [1, 2], startResources: { materials: 8 } },   // 物资储备：起始材料 +8/级
    lab:      { max: 2, costs: [1, 2], startResources: { research: 4 } },    // 研究前哨：起始研究 +4/级
    coating:  { max: 2, costs: [2, 3], corrosionDelta: -0.2 },               // 防腐涂层：腐蚀速率 -0.2/级（钳 ≥1.0）
    grid:     { max: 1, costs: [2],    energyMaintenanceDelta: -1 },         // 高效电网：能源维护 -1（钳 ≥2）
    handbook: { max: 1, costs: [3],    initialHandSizeDelta: 1 }             // 殖民手册：起始手牌 +1
  };

    CR.data = { CARD_DATABASE, EVENTS, DIFFICULTY_LEVELS, FACTIONS, META_PERKS, SANDBOX_LIMITS, DECK_RULES, TECH_TREE, TECH_BRANCHES };
  if (typeof module !== 'undefined' && module.exports) module.exports = CR.data;
})(typeof window !== 'undefined' ? window : globalThis);
