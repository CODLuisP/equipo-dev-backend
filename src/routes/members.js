const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

const MEMBER_COLORS = ['#E85D2F','#3498DB','#2ECC71','#F1C40F','#9B59B6','#E74C3C','#1ABC9C','#F39C12','#D35400','#27AE60'];
const AVATAR_PRESETS = ['aventurero','creativo','tecnico','disenador','ninja','heroe','mago','explorador','lider','builder'];

// Normaliza seed: si es nulo o vacío, asigna uno determinístico por nombre
function normalizeSeed(member) {
  if (member.avatarSeed && member.avatarSeed.trim()) return member;
  // Determinístico basado en el nombre para que siempre sea el mismo
  const idx = Math.abs(
    member.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  ) % AVATAR_PRESETS.length;
  return { ...member, avatarSeed: AVATAR_PRESETS[idx] };
}

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'members').map(normalizeSeed));
});

router.post('/', auth, (req, res) => {
  const { name, role = 'Full Stack Developer' } = req.body;
  // Siempre garantiza un seed válido
  const rawSeed = req.body.avatarSeed;
  const avatarSeed = (rawSeed && rawSeed.trim()) ? rawSeed.trim() : AVATAR_PRESETS[0];

  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

  const existing = db.getAll(req.teamId, 'members');
  const color = MEMBER_COLORS[existing.length % MEMBER_COLORS.length];
  const member = { id: uuid(), name: name.trim(), role, color, avatarSeed, createdAt: Date.now() };
  db.insert(req.teamId, 'members', member);

  req.io.to(`team:${req.teamId}`).emit('member:added', member);
  res.status(201).json(member);
});

router.patch('/:id', auth, (req, res) => {
  const row = db.getById(req.teamId, 'members', req.params.id);
  if (!row) return res.status(404).json({ error: 'Miembro no encontrado' });

  const patch = {};
  if (req.body.name !== undefined)       patch.name = req.body.name;
  if (req.body.role !== undefined)       patch.role = req.body.role;
  if (req.body.color !== undefined)      patch.color = req.body.color;
  if (req.body.avatarSeed !== undefined) patch.avatarSeed = req.body.avatarSeed;

  const updated = db.update(req.teamId, 'members', req.params.id, patch);
  req.io.to(`team:${req.teamId}`).emit('member:updated', updated);
  res.json(updated);
});

router.delete('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'members', req.params.id)) return res.status(404).json({ error: 'No encontrado' });
  db.remove(req.teamId, 'members', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('member:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
