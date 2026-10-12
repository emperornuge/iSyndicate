/**
 * Game data catalogs, combat math, leveling, and the server tick loop.
 * Logic ported 1:1 from the original single-file prototype.
 */
const { listUsers, saveUser, createUser, getUser } = require('./db');

// ==========================================================
// 1. GAME DATA CATALOGS (Missions, Items, Real Estate)
// ==========================================================

const MISSIONS = [
  // Tier 1: Street Level
  { id: 'm1', tier: 1, name: 'Mug a Tourist', energy: 1, cashMin: 10, cashMax: 25, xp: 1, reqLevel: 1, reqItem: null },
  { id: 'm2', tier: 1, name: 'Rob a Convenience Store', energy: 2, cashMin: 30, cashMax: 70, xp: 2, reqLevel: 1, reqItem: 'item_pistol' },
  { id: 'm3', tier: 1, name: 'Steal a Luxury Vehicle', energy: 4, cashMin: 120, cashMax: 250, xp: 5, reqLevel: 2, reqItem: 'item_crowbar' },

  // Tier 2: Underground Syndicate
  { id: 'm4', tier: 2, name: 'Hijack a Shipping Container', energy: 8, cashMin: 500, cashMax: 1100, xp: 11, reqLevel: 5, reqItem: 'item_shotgun' },
  { id: 'm5', tier: 2, name: 'Bribe Local Authorities', energy: 12, cashMin: 1500, cashMax: 3200, xp: 18, reqLevel: 8, reqItem: 'item_sedan' },
  { id: 'm6', tier: 2, name: 'Extort Downtown Businesses', energy: 18, cashMin: 4000, cashMax: 8500, xp: 28, reqLevel: 12, reqItem: 'item_tommy' },

  // Tier 3: High Society Syndicate
  { id: 'm7', tier: 3, name: 'Raid Rival Safehouse', energy: 25, cashMin: 12000, cashMax: 24000, xp: 45, reqLevel: 18, reqItem: 'item_ar' },
  { id: 'm8', tier: 3, name: 'Launder Money via Casino', energy: 35, cashMin: 35000, cashMax: 70000, xp: 70, reqLevel: 25, reqItem: 'item_limo' }
];

const ITEMS = [
  // Weapons
  { id: 'item_crowbar', name: 'Crowbar', type: 'weapon', atk: 3, def: 1, cost: 200, upkeep: 0 },
  { id: 'item_pistol', name: '9mm Pistol', type: 'weapon', atk: 7, def: 3, cost: 1200, upkeep: 0 },
  { id: 'item_shotgun', name: 'Pump Shotgun', type: 'weapon', atk: 15, def: 8, cost: 8500, upkeep: 0 },
  { id: 'item_tommy', name: 'Tommy Gun', type: 'weapon', atk: 35, def: 20, cost: 45000, upkeep: 0 },
  { id: 'item_ar', name: 'Assault Rifle', type: 'weapon', atk: 85, def: 45, cost: 250000, upkeep: 100 },

  // Protection / Armor
  { id: 'item_leather', name: 'Leather Jacket', type: 'armor', atk: 1, def: 4, cost: 400, upkeep: 0 },
  { id: 'item_vest', name: 'Kevlar Vest', type: 'armor', atk: 2, def: 12, cost: 5000, upkeep: 0 },
  { id: 'item_tactical', name: 'Tactical Suit', type: 'armor', atk: 10, def: 40, cost: 80000, upkeep: 0 },

  // Vehicles
  { id: 'item_sedan', name: 'Getaway Sedan', type: 'vehicle', atk: 12, def: 15, cost: 18000, upkeep: 50 },
  { id: 'item_limo', name: 'Armored Limousine', type: 'vehicle', atk: 25, def: 60, cost: 150000, upkeep: 300 }
];

const REAL_ESTATE = [
  { id: 'prop_slum', name: 'Tenement Building', cost: 1000, payout: 150, periodSec: 60 },
  { id: 'prop_pawn', name: 'Pawn Shop', cost: 5000, payout: 850, periodSec: 60 },
  { id: 'prop_bar', name: 'Speakeasy Bar', cost: 25000, payout: 4800, periodSec: 60 },
  { id: 'prop_casino', name: 'Underground Casino', cost: 150000, payout: 32000, periodSec: 60 }
];

// ==========================================================
// 2. STAT CALCULATIONS & COMBAT MATH ENGINE
// ==========================================================

function computeBattlePower(user) {
  // Classic Storm8 Combat Calculation:
  // Equipment selection scales directly up to maximum MOB SIZE multiplier.
  const mobCap = user.mobSize;

  let totalAtk = user.level * 2;
  let totalDef = user.level * 2;

  // Aggregate items owned
  let weapons = [];
  let armors = [];
  let vehicles = [];

  for (let itemId in user.inventory) {
    const qty = user.inventory[itemId] || 0;
    const def = ITEMS.find(i => i.id === itemId);
    if (!def || qty <= 0) continue;

    for (let i = 0; i < qty; i++) {
      if (def.type === 'weapon') weapons.push(def);
      if (def.type === 'armor') armors.push(def);
      if (def.type === 'vehicle') vehicles.push(def);
    }
  }

  // Sort descending by highest stats
  weapons.sort((a, b) => b.atk - a.atk);
  armors.sort((a, b) => b.def - a.def);
  vehicles.sort((a, b) => (b.atk + b.def) - (a.atk + a.def));

  // Take top N items where N = mobCap
  const activeWeapons = weapons.slice(0, mobCap);
  const activeArmors = armors.slice(0, mobCap);
  const activeVehicles = vehicles.slice(0, mobCap);

  activeWeapons.forEach(w => totalAtk += w.atk);
  activeArmors.forEach(a => totalDef += a.def);
  activeVehicles.forEach(v => {
    totalAtk += v.atk;
    totalDef += v.def;
  });

  return { attack: totalAtk, defense: totalDef };
}

function addLog(user, msg) {
  user.logs.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), msg, time: 'Just now' });
  // Keep stored history bounded; client only ever sees the latest 15.
  if (user.logs.length > 60) user.logs = user.logs.slice(0, 60);
}

function processLevelUp(user) {
  while (user.exp >= user.expNext) {
    user.level += 1;
    user.exp -= user.expNext;
    user.expNext = Math.floor(user.expNext * 1.5);
    user.maxEnergy += 2;
    user.maxStamina += 1;
    user.maxHealth += 5;
    user.energy = user.maxEnergy;
    user.stamina = user.maxStamina;
    user.health = user.maxHealth;
    addLog(user, `LEVEL UP! You reached Level ${user.level}!`);
  }
}

// Helper to sanitize player object before sending to client
function sanitizeUser(user) {
  const power = computeBattlePower(user);
  return {
    id: user.id,
    username: user.username,
    code: user.code,
    level: user.level,
    exp: user.exp,
    expNext: user.expNext,
    energy: user.energy,
    maxEnergy: user.maxEnergy,
    stamina: user.stamina,
    maxStamina: user.maxStamina,
    health: user.health,
    maxHealth: user.maxHealth,
    cash: user.cash,
    bank: user.bank,
    mobSize: user.mobSize,
    attackPower: power.attack,
    defensePower: power.defense,
    inventory: user.inventory || {},
    properties: user.properties || {},
    mobMembers: user.mobMembers || [],
    logs: (user.logs || []).slice(0, 15)
  };
}

// ==========================================================
// 3. SEED BOTS + SERVER TICK LOOP
// ==========================================================

function seedBots() {
  const bots = [
    { id: 'bot_1', username: 'Don_Corleone', code: 'BOT001', level: 10, mobSize: 15, cash: 50000, bank: 1000000 },
    { id: 'bot_2', username: 'Scarface_Tony', code: 'BOT002', level: 5, mobSize: 8, cash: 12000, bank: 20000 },
    { id: 'bot_3', username: 'Soprano_Tony', code: 'BOT003', level: 2, mobSize: 3, cash: 1500, bank: 5000 }
  ];

  for (const b of bots) {
    if (!getUser(b.id)) {
      createUser({
        id: b.id,
        username: b.username,
        code: b.code,
        level: b.level,
        exp: 0,
        expNext: b.level * 100,
        energy: 100,
        maxEnergy: 100,
        stamina: 20,
        maxStamina: 20,
        health: 100,
        maxHealth: 100,
        cash: b.cash,
        bank: b.bank,
        mobSize: b.mobSize,
        inventory: { item_pistol: 5, item_leather: 5 },
        properties: { prop_slum: 2 },
        mobMembers: [],
        logs: [],
        lastTick: Date.now(),
        lastIncomeTick: Date.now()
      });
      console.log(`Seeded bot: ${b.username}`);
    }
  }
}

// Active Game Engine Loop - Tick Handler (Timer Regeneration & Passive Real Estate Income)
function startTick() {
  setInterval(() => {
    const now = Date.now();
    for (let user of listUsers()) {
      // 1. Stat Regeneration (Every 3 seconds restores stats slightly)
      if (user.energy < user.maxEnergy) user.energy = Math.min(user.maxEnergy, user.energy + 1);
      if (user.stamina < user.maxStamina) user.stamina = Math.min(user.maxStamina, user.stamina + 1);
      if (user.health < user.maxHealth) user.health = Math.min(user.maxHealth, user.health + 2);

      // 2. Passive Real Estate Yield Calculations (Every minute equivalent)
      if (!user.lastIncomeTick) user.lastIncomeTick = now;
      if (now - user.lastIncomeTick >= 60000) {
        let incomeGained = 0;
        let totalUpkeep = 0;

        // Add Payouts
        for (let propId in user.properties) {
          const count = user.properties[propId] || 0;
          const propDef = REAL_ESTATE.find(p => p.id === propId);
          if (propDef && count > 0) {
            incomeGained += propDef.payout * count;
          }
        }

        // Subtract Upkeep
        for (let itemId in user.inventory) {
          const count = user.inventory[itemId] || 0;
          const itemDef = ITEMS.find(i => i.id === itemId);
          if (itemDef && count > 0) {
            totalUpkeep += itemDef.upkeep * count;
          }
        }

        const net = incomeGained - totalUpkeep;
        if (net > 0) {
          user.cash += net;
          addLog(user, `Collected $${net.toLocaleString()} from real estate income!`);
        }
        user.lastIncomeTick = now;
      }

      user.lastTick = now;
      saveUser(user);
    }
  }, 3000);
}

module.exports = {
  MISSIONS,
  ITEMS,
  REAL_ESTATE,
  computeBattlePower,
  processLevelUp,
  sanitizeUser,
  addLog,
  seedBots,
  startTick,
};
