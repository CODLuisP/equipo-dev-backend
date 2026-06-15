const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const sql = new Database(path.join(DATA_DIR, 'equipo.db'));
sql.pragma('journal_mode = WAL');


sql.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    password     TEXT NOT NULL,
    vault_password TEXT,
    created_at   INTEGER,
    disabled     INTEGER DEFAULT 0
  );
  

  CREATE TABLE IF NOT EXISTS items (
    id         TEXT NOT NULL,
    team_id    TEXT NOT NULL,
    collection TEXT NOT NULL,
    data       TEXT NOT NULL,
    PRIMARY KEY (id, team_id, collection)
  );

  CREATE TABLE IF NOT EXISTS pizarras (
    team_id   TEXT NOT NULL,
    member_id TEXT NOT NULL,
    data      TEXT NOT NULL,
    PRIMARY KEY (team_id, member_id)
  );
`);

const LEGACY_TEAM_ID = 'equipo-dev';

function rowToTeam(row) {
  return {
    id:            row.id,
    name:          row.name,
    password:      row.password,
    vaultPassword: row.vault_password,
    createdAt:     row.created_at,
    disabled:      !!row.disabled,
  };
}

const stmts = {
  getAllItems:    sql.prepare('SELECT data FROM items WHERE team_id = ? AND collection = ?'),
  getItemById:   sql.prepare('SELECT data FROM items WHERE id = ? AND team_id = ? AND collection = ?'),
  insertItem:    sql.prepare('INSERT INTO items (id, team_id, collection, data) VALUES (?, ?, ?, ?)'),
  updateItem:    sql.prepare('UPDATE items SET data = ? WHERE id = ? AND team_id = ? AND collection = ?'),
  deleteItem:    sql.prepare('DELETE FROM items WHERE id = ? AND team_id = ? AND collection = ?'),
  deleteTeamItems: sql.prepare('DELETE FROM items WHERE team_id = ?'),

  getPizarra:    sql.prepare('SELECT data FROM pizarras WHERE team_id = ? AND member_id = ?'),
  upsertPizarra: sql.prepare('INSERT INTO pizarras (team_id, member_id, data) VALUES (?, ?, ?) ON CONFLICT(team_id, member_id) DO UPDATE SET data = excluded.data'),
  deleteTeamPizarras: sql.prepare('DELETE FROM pizarras WHERE team_id = ?'),

  getTeams:      sql.prepare('SELECT * FROM teams'),
  getTeamById:   sql.prepare('SELECT * FROM teams WHERE id = ?'),
  getTeamByPwd:  sql.prepare('SELECT * FROM teams WHERE password = ?'),
  insertTeam:    sql.prepare('INSERT INTO teams (id, name, password, vault_password, created_at, disabled) VALUES (?, ?, ?, ?, ?, 0)'),
  updateTeamRow: sql.prepare('UPDATE teams SET name = ?, password = ?, vault_password = ?, created_at = ?, disabled = ? WHERE id = ?'),
  deleteTeam:    sql.prepare('DELETE FROM teams WHERE id = ?'),
};

const db = {
  LEGACY_TEAM_ID,

  // ─── Colecciones ────────────────────────────────────────────────────────────

  getAll(teamId, col) {
    return stmts.getAllItems.all(teamId, col).map(r => JSON.parse(r.data));
  },

  getById(teamId, col, id) {
    const row = stmts.getItemById.get(id, teamId, col);
    return row ? JSON.parse(row.data) : null;
  },

  insert(teamId, col, doc) {
    stmts.insertItem.run(doc.id, teamId, col, JSON.stringify(doc));
    return doc;
  },

  update(teamId, col, id, patch) {
    const row = stmts.getItemById.get(id, teamId, col);
    if (!row) return null;
    const updated = { ...JSON.parse(row.data), ...patch };
    stmts.updateItem.run(JSON.stringify(updated), id, teamId, col);
    return updated;
  },

  remove(teamId, col, id) {
    stmts.deleteItem.run(id, teamId, col);
  },

  // ─── Pizarras ───────────────────────────────────────────────────────────────

  getPizarra(teamId, memberId) {
    const row = stmts.getPizarra.get(teamId, memberId);
    return row ? JSON.parse(row.data) : {};
  },

  setPizarra(teamId, memberId, data) {
    stmts.upsertPizarra.run(teamId, memberId, JSON.stringify(data));
  },

  // ─── Equipos ────────────────────────────────────────────────────────────────

  getTeams() {
    return stmts.getTeams.all().map(rowToTeam);
  },

  getTeamById(id) {
    const row = stmts.getTeamById.get(id);
    return row ? rowToTeam(row) : null;
  },

  findTeamByPassword(password) {
    const row = stmts.getTeamByPwd.get(password);
    return row ? rowToTeam(row) : null;
  },

  addTeam(team) {
    stmts.insertTeam.run(team.id, team.name, team.password, team.vaultPassword || null, team.createdAt || Date.now());
    return team;
  },

  updateTeam(id, patch) {
    const row = stmts.getTeamById.get(id);
    if (!row) return null;
    const current = rowToTeam(row);
    const updated = { ...current, ...patch };
    stmts.updateTeamRow.run(updated.name, updated.password, updated.vaultPassword || null, updated.createdAt, updated.disabled ? 1 : 0, id);
    return updated;
  },

  removeTeam(id) {
    if (id === LEGACY_TEAM_ID) return false;
    sql.transaction(() => {
      stmts.deleteTeamItems.run(id);
      stmts.deleteTeamPizarras.run(id);
      stmts.deleteTeam.run(id);
    })();
    return true;
  },

  clearTeamData(teamId) {
    sql.transaction(() => {
      stmts.deleteTeamItems.run(teamId);
      stmts.deleteTeamPizarras.run(teamId);
    })();
  },

  evictCache() {}, // no-op: SQLite no necesita caché en memoria
};

module.exports = db;
