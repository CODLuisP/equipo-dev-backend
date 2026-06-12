const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /auth/register  { teamName, password, vaultPassword }
// Crea un equipo nuevo con datos limpios.
router.post('/register', (req, res) => {
  const { teamName, password, vaultPassword } = req.body;

  if (!teamName?.trim())      return res.status(400).json({ error: 'El nombre del equipo es requerido' });
  if (!password?.trim())      return res.status(400).json({ error: 'La contraseña del equipo es requerida' });
  if (!vaultPassword?.trim()) return res.status(400).json({ error: 'La clave de la bóveda es requerida' });
  if (password.trim().length < 4)      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  if (vaultPassword.trim().length < 4) return res.status(400).json({ error: 'La clave de la bóveda debe tener al menos 4 caracteres' });

  const pwd = password.trim();

  // El login es solo con contraseña → debe ser única entre equipos
  if (pwd === process.env.TEAM_PASSWORD || db.findTeamByPassword(pwd)) {
    return res.status(409).json({ error: 'Esa contraseña ya está en uso por otro equipo, elige otra' });
  }

  const nameTaken = db.getTeams().some(t => t.name.toLowerCase() === teamName.trim().toLowerCase());
  if (nameTaken) {
    return res.status(409).json({ error: 'Ya existe un equipo con ese nombre' });
  }

  const team = {
    id: uuid(),
    name: teamName.trim(),
    password: pwd,
    vaultPassword: vaultPassword.trim(),
    createdAt: Date.now(),
  };
  db.addTeam(team);

  console.log(`🆕 Equipo creado: ${team.name} (${team.id})`);
  res.status(201).json({ ok: true, teamId: team.id, teamName: team.name });
});

// POST /auth/login  { password }
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(401).json({ error: 'Contraseña incorrecta' });

  // Equipo legacy (contraseña del .env)
  if (password === process.env.TEAM_PASSWORD) {
    const token = jwt.sign({ team: 'equipo-dev', teamId: db.LEGACY_TEAM_ID, teamName: 'Equipo Dev' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, teamName: 'Equipo Dev' });
  }

  // Equipos registrados
  const team = db.findTeamByPassword(password);
  if (!team) return res.status(401).json({ error: 'Contraseña incorrecta' });
  if (team.disabled) return res.status(403).json({ error: 'Este equipo está deshabilitado, contacta al administrador' });

  const token = jwt.sign({ team: team.id, teamId: team.id, teamName: team.name }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, teamName: team.name });
});

// POST /auth/vault  { password } — verifica la clave de la bóveda del equipo
router.post('/vault', auth, (req, res) => {
  const { password } = req.body;
  if (!password?.trim()) return res.status(400).json({ error: 'Clave requerida' });

  let expected;
  if (req.teamId === db.LEGACY_TEAM_ID) {
    expected = process.env.VAULT_PASSWORD || 'dev123';
  } else {
    const team = db.getTeamById(req.teamId);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado' });
    expected = team.vaultPassword;
  }

  if (password.trim() !== expected) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }
  res.json({ ok: true });
});

module.exports = router;
