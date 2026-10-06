
// Game Constants
export const COLORS = {
    bg: 0x05060f,
    numbers: [0x00B4D8, 0x2D9B4E, 0xE63946, 0xD63384, 0x7B2CBF, 0x0D9488, 0xEA580C, 0xDB2777],
    operators: {
        '+': 0x5B21B6,
        '-': 0x059669,
        '×': 0xC2410C,
        '÷': 0x1D4ED8
    },
    specials: {
        bomb: 0x2a2a35,
        timer: 0x2563eb,
        hint: 0xd97706,
        recycle: 0x65a30d
    },
    selection: 0xFFE066,
    hint: 0x34D399
};

export const CONSTANTS = {
    RADIUS: 38,
    DIAMETER: 76,
    SPAWN_DELAY: 800,          // ms between pieces (paused while the timer power-up is active)
    TIMER_POWERUP_MS: 20000,   // matches the "+20s" power-up art
    HINT_POWERUP_MS: 20000,
    ICE_CHANCE: 0.15,          // share of number/operator pieces that freeze
    ICE_FREEZE_MS: 5000,       // time for the ice cover to go from clear to opaque
    DANGER_MS: 1200,           // a settled piece above the death line for this long ends the game
    DAILY_MS: 120000,          // daily challenge length (time attack)
    SPRINT_MS: 60000           // sprint mode length
};

// Matter.js body options shared by the game and the perf test
export const PIECE_BODY = {
    restitution: 0.1,
    friction: 0.02,
    frictionStatic: 0.3,
    frictionAir: 0.01,
    density: 0.0015,
    slop: 0.03
};

// Matter world config (Phaser 3.60 bundles Matter 0.19)
export const MATTER_CONFIG = {
    gravity: { y: 1 },
    enableSleeping: true,      // settled pieces stop costing CPU
    positionIterations: 6,
    velocityIterations: 4,
    debug: false
};

// Difficulty curve: a new level every few equations. Pieces fall faster and operators unlock.
export const LEVELS = {
    EQUATIONS_PER_LEVEL: 5,
    spawnDelay: (level) => Math.max(600, 1500 - (level - 1) * 100),
    ops: (level) => (level <= 1 ? ['+', '-'] : level === 2 ? ['+', '-', '×'] : ['+', '-', '×', '÷'])
};

// Points per operator, scaled by level and by the combo multiplier
export const SCORING = {
    base: { '+': 100, '-': 120, '×': 150, '÷': 200 },
    levelBonus: 0.1,      // +10% per level above 1
    iceBonus: 50,         // per frozen piece used
    failPenalty: 50,
    comboWindow: 6000,    // ms between correct equations to keep the combo
    comboStep: 0.5,       // x1, x1.5, x2 ...
    comboMax: 4
};
