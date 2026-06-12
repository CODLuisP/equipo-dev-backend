/**
 * Base de datos en archivos JSON — multi-equipo.
 * Sin dependencias nativas — funciona en cualquier plataforma.
 *
 * Equipo legacy ('equipo-dev'): sus colecciones viven en /data/*.json (como siempre).
 * Equipos nuevos: cada uno tiene su carpeta /data/teams/<teamId>/*.json
 * El registro de equipos vive en /data/teams.json
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TEAMS_DIR = path.join(DATA_DIR, 'teams');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TEAMS_DIR)) fs.mkdirSync(TEAMS_DIR, { recursive: true });

const LEGACY_TEAM_ID = 'equipo-dev';
const collections = ['members', 'tasks', 'snippets', 'notes', 'vault', 'custom_shapes', 'shared_files'];

// ─── Helpers de archivos ─────────────────────────────────────────────────────

function teamDir(teamId) {
  if (teamId === LEGACY_TEAM_ID) return DATA_DIR;
  const dir = path.join(TEAMS_DIR, teamId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadFile(file, def) {
  if (!fs.existsSync(file)) return def;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
}

function saveFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Stores por equipo (caché en memoria, lazy) ──────────────────────────────

const stores = {}; // { teamId: { members: [], ..., pizarras: {} } }

function getStore(teamId) {
  if (!stores[teamId]) {
    const dir = teamDir(teamId);
    const store = {};
    collections.forEach(c => { store[c] = loadFile(path.join(dir, `${c}.json`), []); });
    store.pizarras = loadFile(path.join(dir, 'pizarras.json'), {});
    stores[teamId] = store;
  }
  return stores[teamId];
}

function persist(teamId, name) {
  saveFile(path.join(teamDir(teamId), `${name}.json`), getStore(teamId)[name]);
}

// ─── Registro de equipos ─────────────────────────────────────────────────────

let teams = loadFile(path.join(DATA_DIR, 'teams.json'), []);
function persistTeams() { saveFile(path.join(DATA_DIR, 'teams.json'), teams); }

// ─── API ─────────────────────────────────────────────────────────────────────

const db = {
  LEGACY_TEAM_ID,

  // Genérico (scoped por equipo)
  getAll(teamId, col) { return getStore(teamId)[col]; },
  getById(teamId, col, id) { return getStore(teamId)[col].find(r => r.id === id) || null; },
  insert(teamId, col, doc) {
    getStore(teamId)[col].push(doc);
    persist(teamId, col);
    return doc;
  },
  update(teamId, col, id, patch) {
    const store = getStore(teamId);
    const idx = store[col].findIndex(r => r.id === id);
    if (idx === -1) return null;
    store[col][idx] = { ...store[col][idx], ...patch };
    persist(teamId, col);
    return store[col][idx];
  },
  remove(teamId, col, id) {
    const store = getStore(teamId);
    store[col] = store[col].filter(r => r.id !== id);
    persist(teamId, col);
  },

  // Pizarras (por memberId, scoped por equipo)
  getPizarra(teamId, memberId) { return getStore(teamId).pizarras[memberId] || {}; },
  setPizarra(teamId, memberId, data) {
    getStore(teamId).pizarras[memberId] = data;
    saveFile(path.join(teamDir(teamId), 'pizarras.json'), getStore(teamId).pizarras);
  },

  // Equipos
  getTeams() { return teams; },
  getTeamById(id) { return teams.find(t => t.id === id) || null; },
  findTeamByPassword(password) { return teams.find(t => t.password === password) || null; },
  addTeam(team) {
    teams.push(team);
    persistTeams();
    // Inicializar carpeta y colecciones vacías
    const dir = teamDir(team.id);
    collections.forEach(c => {
      const file = path.join(dir, `${c}.json`);
      if (!fs.existsSync(file)) saveFile(file, []);
    });
    saveFile(path.join(dir, 'pizarras.json'), {});
    return team;
  },
  updateTeam(id, patch) {
    const idx = teams.findIndex(t => t.id === id);
    if (idx === -1) return null;
    teams[idx] = { ...teams[idx], ...patch };
    persistTeams();
    return teams[idx];
  },
  removeTeam(id) {
    if (id === LEGACY_TEAM_ID) return false;
    teams = teams.filter(t => t.id !== id);
    persistTeams();
    delete stores[id];
    const dir = path.join(TEAMS_DIR, id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    return true;
  },
};

module.exports = db;
