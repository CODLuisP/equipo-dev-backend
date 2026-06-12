const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const router = express.Router();

// Protección por clave de administrador (header x-admin-key)
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_PASSWORD || 'admin123';
  if (!key || key !== expected) {
    return res.status(401).json({ error: 'Clave de administrador incorrecta' });
  }
  next();
}

// GET /admin/teams — lista de equipos con estadísticas
router.get('/teams', adminAuth, (_req, res) => {
  const teamStats = (teamId) => ({
    members:  db.getAll(teamId, 'members').length,
    tasks:    db.getAll(teamId, 'tasks').length,
    snippets: db.getAll(teamId, 'snippets').length,
    vault:    db.getAll(teamId, 'vault').length,
    memberNames: db.getAll(teamId, 'members').map(m => m.name),
  });

  const legacy = {
    id: db.LEGACY_TEAM_ID,
    name: 'Equipo Dev',
    createdAt: null,
    legacy: true,
    ...teamStats(db.LEGACY_TEAM_ID),
  };

  const registered = db.getTeams().map(t => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    legacy: false,
    disabled: !!t.disabled,
    ...teamStats(t.id),
  }));

  res.json([legacy, ...registered]);
});

// Función auxiliar para actualizar el archivo .env
function updateEnvVariable(key, value) {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
  }
  process.env[key] = value;
}

// PATCH /admin/teams/:id — actualizar contraseñas o habilitar/deshabilitar
router.patch('/teams/:id', adminAuth, (req, res) => {
  const patch = {};

  if (req.params.id === db.LEGACY_TEAM_ID) {
    // Equipo principal
    if (req.body.password !== undefined) {
      const pwd = String(req.body.password).trim();
      if (pwd.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
      const clash = db.findTeamByPassword(pwd);
      if (clash) return res.status(409).json({ error: 'Esa contraseña ya está en uso por otro equipo' });
      updateEnvVariable('TEAM_PASSWORD', pwd);
      patch.password = 'updated';
    }
    if (req.body.vaultPassword !== undefined) {
      const vp = String(req.body.vaultPassword).trim();
      if (vp.length < 4) return res.status(400).json({ error: 'La clave de la bóveda debe tener al menos 4 caracteres' });
      updateEnvVariable('VAULT_PASSWORD', vp);
      patch.vaultPassword = 'updated';
    }
    if (req.body.disabled !== undefined) {
      return res.status(400).json({ error: 'El equipo principal no se puede deshabilitar' });
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    console.log(`✏️  Equipo Principal actualizado: ${Object.keys(patch).join(', ')}`);
    return res.json({ ok: true, disabled: false });
  }

  // Equipos registrados
  const team = db.getTeamById(req.params.id);
  if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });

  if (req.body.password !== undefined) {
    const pwd = String(req.body.password).trim();
    if (pwd.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    const clash = db.findTeamByPassword(pwd);
    if (pwd === process.env.TEAM_PASSWORD || (clash && clash.id !== team.id)) {
      return res.status(409).json({ error: 'Esa contraseña ya está en uso por otro equipo' });
    }
    patch.password = pwd;
  }

  if (req.body.vaultPassword !== undefined) {
    const vp = String(req.body.vaultPassword).trim();
    if (vp.length < 4) return res.status(400).json({ error: 'La clave de la bóveda debe tener al menos 4 caracteres' });
    patch.vaultPassword = vp;
  }

  if (req.body.disabled !== undefined) {
    patch.disabled = !!req.body.disabled;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }

  const updated = db.updateTeam(team.id, patch);
  console.log(`✏️  Equipo actualizado: ${updated.name} (${Object.keys(patch).join(', ')})`);
  res.json({ ok: true, disabled: !!updated.disabled });
});

// DELETE /admin/teams/:id — elimina un equipo y todos sus datos
router.delete('/teams/:id', adminAuth, (req, res) => {
  if (req.params.id === db.LEGACY_TEAM_ID) {
    // En lugar de borrar la cuenta, vaciamos todos sus datos
    const collections = ['members', 'tasks', 'snippets', 'notes', 'vault', 'custom_shapes', 'shared_files'];
    collections.forEach(c => {
      // Usamos los métodos de db internos
      const store = require('../db').getAll(db.LEGACY_TEAM_ID, c);
      store.length = 0; // vaciar array
      const file = path.join(__dirname, '..', '..', 'data', `${c}.json`);
      fs.writeFileSync(file, '[]', 'utf8');
    });
    const pizarrasFile = path.join(__dirname, '..', '..', 'data', 'pizarras.json');
    fs.writeFileSync(pizarrasFile, '{}', 'utf8');
    
    // Necesitamos que db.js recargue su caché o mutarla directamente
    // Mutar los arrays en memoria garantiza que db.getAll() refleje los cambios
    console.log(`🗑️  Datos del equipo principal limpiados`);
    return res.json({ ok: true, cleared: true });
  }

  if (!db.getTeamById(req.params.id)) {
    return res.status(404).json({ error: 'Equipo no encontrado' });
  }
  db.removeTeam(req.params.id);
  console.log(`🗑️  Equipo eliminado: ${req.params.id}`);
  res.json({ ok: true });
});

module.exports = router;
