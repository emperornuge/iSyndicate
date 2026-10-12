/**
 * SQLite persistence layer using Node's built-in node:sqlite (no native deps).
 * Replaces the original in-memory Map so player data survives restarts/deploys.
 * Data directory is configurable via DATA_DIR (mounted volume in production).
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'game.db'));
db.exec('PRAGMA journal_mode = WAL;');

const JSON_FIELDS = ['inventory', 'properties', 'mobMembers', 'logs'];

function rowToUser(row) {
  if (!row) return null;
  const user = { ...row };
  for (const f of JSON_FIELDS) {
    try {
      user[f] = JSON.parse(row[f]);
    } catch {
      user[f] = f === 'logs' || f === 'mobMembers' ? [] : {};
    }
  }
  return user;
}

function userToRow(user) {
  const row = { ...user };
  for (const f of JSON_FIELDS) {
    row[f] = JSON.stringify(user[f] ?? (f === 'logs' || f === 'mobMembers' ? [] : {}));
  }
  return row;
}

let stmtGet;
let stmtByUsername;
let stmtByCode;
let stmtAll;
let stmtCount;
let stmtInsert;
let stmtUpdate;

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      code TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      exp INTEGER NOT NULL DEFAULT 0,
      expNext INTEGER NOT NULL DEFAULT 100,
      energy INTEGER NOT NULL DEFAULT 20,
      maxEnergy INTEGER NOT NULL DEFAULT 20,
      stamina INTEGER NOT NULL DEFAULT 10,
      maxStamina INTEGER NOT NULL DEFAULT 10,
      health INTEGER NOT NULL DEFAULT 100,
      maxHealth INTEGER NOT NULL DEFAULT 100,
      cash INTEGER NOT NULL DEFAULT 500,
      bank INTEGER NOT NULL DEFAULT 0,
      mobSize INTEGER NOT NULL DEFAULT 1,
      inventory TEXT NOT NULL DEFAULT '{}',
      properties TEXT NOT NULL DEFAULT '{}',
      mobMembers TEXT NOT NULL DEFAULT '[]',
      logs TEXT NOT NULL DEFAULT '[]',
      lastTick INTEGER NOT NULL DEFAULT 0,
      lastIncomeTick INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(lower(username));
    CREATE INDEX IF NOT EXISTS idx_users_code_upper ON users(upper(code));
  `);

  stmtGet = db.prepare('SELECT * FROM users WHERE id = ?');
  stmtByUsername = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?) LIMIT 1');
  stmtByCode = db.prepare('SELECT * FROM users WHERE upper(code) = upper(?) LIMIT 1');
  stmtAll = db.prepare('SELECT * FROM users');
  stmtCount = db.prepare('SELECT COUNT(*) AS n FROM users');
  stmtInsert = db.prepare(`
    INSERT INTO users (id, username, code, level, exp, expNext, energy, maxEnergy,
      stamina, maxStamina, health, maxHealth, cash, bank, mobSize,
      inventory, properties, mobMembers, logs, lastTick, lastIncomeTick, createdAt)
    VALUES (@id, @username, @code, @level, @exp, @expNext, @energy, @maxEnergy,
      @stamina, @maxStamina, @health, @maxHealth, @cash, @bank, @mobSize,
      @inventory, @properties, @mobMembers, @logs, @lastTick, @lastIncomeTick, @createdAt)
  `);
  stmtUpdate = db.prepare(`
    UPDATE users SET username=@username, code=@code, level=@level, exp=@exp, expNext=@expNext,
      energy=@energy, maxEnergy=@maxEnergy, stamina=@stamina, maxStamina=@maxStamina,
      health=@health, maxHealth=@maxHealth, cash=@cash, bank=@bank, mobSize=@mobSize,
      inventory=@inventory, properties=@properties, mobMembers=@mobMembers, logs=@logs,
      lastTick=@lastTick, lastIncomeTick=@lastIncomeTick
    WHERE id=@id
  `);
}

function getUser(id) {
  return rowToUser(stmtGet.get(id));
}

function findByUsername(username) {
  return rowToUser(stmtByUsername.get(username));
}

function findByCode(code) {
  return rowToUser(stmtByCode.get(code));
}

function listUsers() {
  return stmtAll.all().map(rowToUser);
}

function countUsers() {
  return stmtCount.get().n;
}

function createUser(user) {
  const row = userToRow({ lastTick: Date.now(), createdAt: Date.now(), ...user });
  stmtInsert.run(row);
  return getUser(row.id);
}

function saveUser(user) {
  const row = userToRow(user);
  delete row.createdAt; // not part of the UPDATE statement
  stmtUpdate.run(row);
}

module.exports = {
  initDb,
  getUser,
  findByUsername,
  findByCode,
  listUsers,
  countUsers,
  createUser,
  saveUser,
};
