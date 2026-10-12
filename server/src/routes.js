/**
 * REST API endpoints — ported 1:1 from the original prototype.
 */
const express = require('express');
const { getUser, findByUsername, findByCode, createUser, saveUser, listUsers } = require('./db');
const {
  MISSIONS, ITEMS, REAL_ESTATE,
  computeBattlePower, processLevelUp, sanitizeUser, addLog,
} = require('./game');

const router = express.Router();

// Auth & Load User
router.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username || !String(username).trim()) {
    return res.status(400).json({ error: 'Username required' });
  }
  const cleanName = String(username).trim().slice(0, 24);

  let user = findByUsername(cleanName);

  if (!user) {
    const id = `user_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    user = createUser({
      id,
      username: cleanName,
      code: randomCode,
      level: 1,
      exp: 0,
      expNext: 100,
      energy: 20,
      maxEnergy: 20,
      stamina: 10,
      maxStamina: 10,
      health: 100,
      maxHealth: 100,
      cash: 500,
      bank: 0,
      mobSize: 1, // Self
      inventory: {},
      properties: {},
      mobMembers: [],
      logs: [{ id: Date.now(), msg: 'Welcome to iSyndicate! Perform missions to start building your criminal empire.', time: 'Just now' }],
      lastTick: Date.now(),
      lastIncomeTick: Date.now(),
    });
  }

  res.json({ user: sanitizeUser(user) });
});

// Refresh State
router.get('/user/:id', (req, res) => {
  const user = getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: sanitizeUser(user) });
});

// Catalog Fetch
router.get('/catalogs', (req, res) => {
  res.json({ missions: MISSIONS, items: ITEMS, properties: REAL_ESTATE });
});

// Do Mission API
router.post('/mission/do', (req, res) => {
  const { userId, missionId } = req.body;
  const user = getUser(userId);
  const mission = MISSIONS.find(m => m.id === missionId);

  if (!user || !mission) return res.status(400).json({ error: 'Invalid operation' });
  if (user.level < mission.reqLevel) return res.status(400).json({ error: 'Level too low' });
  if (user.energy < mission.energy) return res.status(400).json({ error: 'Not enough energy!' });

  if (mission.reqItem) {
    const qty = user.inventory[mission.reqItem] || 0;
    if (qty < 1) {
      const itemDef = ITEMS.find(i => i.id === mission.reqItem);
      return res.status(400).json({ error: `Requires at least 1 x ${itemDef ? itemDef.name : 'required item'}` });
    }
  }

  // Deduct costs & generate rewards
  user.energy -= mission.energy;
  const cashWon = Math.floor(Math.random() * (mission.cashMax - mission.cashMin + 1)) + mission.cashMin;
  user.cash += cashWon;
  user.exp += mission.xp;

  processLevelUp(user);
  saveUser(user);

  res.json({
    success: true,
    cashWon,
    xpWon: mission.xp,
    user: sanitizeUser(user)
  });
});

// Buy Equipment / Property API
router.post('/shop/buy', (req, res) => {
  const { userId, type, id } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(400).json({ error: 'User missing' });

  if (type === 'item') {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (user.cash < item.cost) return res.status(400).json({ error: 'Insufficient cash' });

    user.cash -= item.cost;
    user.inventory[id] = (user.inventory[id] || 0) + 1;
  } else if (type === 'property') {
    const prop = REAL_ESTATE.find(p => p.id === id);
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    if (user.cash < prop.cost) return res.status(400).json({ error: 'Insufficient cash' });

    user.cash -= prop.cost;
    user.properties[id] = (user.properties[id] || 0) + 1;
  } else {
    return res.status(400).json({ error: 'Invalid purchase type' });
  }

  saveUser(user);
  res.json({ success: true, user: sanitizeUser(user) });
});

// Banking System API
router.post('/bank', (req, res) => {
  const { userId, action, amount } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(400).json({ error: 'User missing' });

  const numAmount = parseInt(amount, 10);
  if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  if (action === 'deposit') {
    if (user.cash < numAmount) return res.status(400).json({ error: 'Not enough cash on hand' });
    const fee = Math.floor(numAmount * 0.10); // 10% Bank Fee like classic Storm8
    const netDeposit = numAmount - fee;

    user.cash -= numAmount;
    user.bank += netDeposit;
    addLog(user, `Deposited $${numAmount.toLocaleString()} ($${fee.toLocaleString()} bank fee).`);
  } else if (action === 'withdraw') {
    if (user.bank < numAmount) return res.status(400).json({ error: 'Not enough bank balance' });
    user.bank -= numAmount;
    user.cash += numAmount;
    addLog(user, `Withdrew $${numAmount.toLocaleString()} from bank.`);
  } else {
    return res.status(400).json({ error: 'Invalid bank action' });
  }

  saveUser(user);
  res.json({ success: true, user: sanitizeUser(user) });
});

// PvP Fight Arena Endpoint
router.get('/fight/targets/:userId', (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(400).json({ error: 'User missing' });

  // Get list of targets around player level range
  const targets = listUsers()
    .filter(u => u.id !== user.id && Math.abs(u.level - user.level) <= 5)
    .map(u => ({
      id: u.id,
      username: u.username,
      level: u.level,
      mobSize: u.mobSize
    }));

  res.json({ targets });
});

router.post('/fight/attack', (req, res) => {
  const { userId, targetId } = req.body;
  const attacker = getUser(userId);
  const defender = getUser(targetId);

  if (!attacker || !defender) return res.status(400).json({ error: 'Invalid participants' });
  if (attacker.stamina < 1) return res.status(400).json({ error: 'Not enough Stamina to attack!' });
  if (attacker.health < 25) return res.status(400).json({ error: 'Health too low to engage in fights! Visit Hospital.' });

  attacker.stamina -= 1;

  const attStats = computeBattlePower(attacker);
  const defStats = computeBattlePower(defender);

  // Add RNG variability factor (+/- 15%)
  const attScore = attStats.attack * (0.85 + Math.random() * 0.3);
  const defScore = defStats.defense * (0.85 + Math.random() * 0.3);

  const won = attScore > defScore;
  let cashStolen = 0;
  let expGained = 0;

  if (won) {
    expGained = Math.max(2, Math.floor(defender.level * 1.5));
    // Steal up to 15% of target unbanked cash
    cashStolen = Math.floor(defender.cash * 0.15);

    attacker.cash += cashStolen;
    defender.cash -= cashStolen;
    attacker.exp += expGained;

    addLog(attacker, `You attacked ${defender.username} and WON! Took $${cashStolen.toLocaleString()} and ${expGained} XP.`);
    addLog(defender, `${attacker.username} attacked you and WON! They stole $${cashStolen.toLocaleString()}.`);

    processLevelUp(attacker);
  } else {
    // Attacker Lost
    const healthLost = Math.floor(10 + Math.random() * 15);
    attacker.health = Math.max(0, attacker.health - healthLost);

    addLog(attacker, `You attacked ${defender.username} and LOST! Took ${healthLost} damage.`);
    addLog(defender, `${attacker.username} attacked you and LOST! You defended your turf successfully.`);
  }

  saveUser(attacker);
  saveUser(defender);

  res.json({
    won,
    cashStolen,
    expGained,
    user: sanitizeUser(attacker)
  });
});

// Mob Invite System API
router.post('/mob/invite', (req, res) => {
  const { userId, inviteCode } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(400).json({ error: 'User missing' });
  if (!inviteCode || !String(inviteCode).trim()) return res.status(400).json({ error: 'Invite code required' });

  const targetMobster = findByCode(String(inviteCode).trim());

  if (!targetMobster) return res.status(404).json({ error: 'Mobster code not found!' });
  if (targetMobster.id === user.id) return res.status(400).json({ error: 'You cannot add yourself!' });
  if (user.mobMembers.includes(targetMobster.id)) return res.status(400).json({ error: 'Already in your mob!' });

  // Reciprocal Mob Addition
  user.mobMembers.push(targetMobster.id);
  user.mobSize += 1;

  targetMobster.mobMembers.push(user.id);
  targetMobster.mobSize += 1;

  addLog(user, `Joined forces with ${targetMobster.username}! Your Mob Size is now ${user.mobSize}.`);
  addLog(targetMobster, `${user.username} added you to their mob! Your Mob Size is now ${targetMobster.mobSize}.`);

  saveUser(user);
  saveUser(targetMobster);

  res.json({ success: true, user: sanitizeUser(user) });
});

// Hospital Heal API
router.post('/hospital/heal', (req, res) => {
  const { userId } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(400).json({ error: 'User missing' });

  const missingHealth = user.maxHealth - user.health;
  if (missingHealth <= 0) return res.status(400).json({ error: 'You already have maximum health!' });

  const healCost = missingHealth * 10;
  if (user.cash < healCost) return res.status(400).json({ error: `Requires $${healCost.toLocaleString()} to heal completely.` });

  user.cash -= healCost;
  user.health = user.maxHealth;
  addLog(user, `Healed to max health at local hospital for $${healCost.toLocaleString()}.`);

  saveUser(user);
  res.json({ success: true, user: sanitizeUser(user) });
});

module.exports = router;
