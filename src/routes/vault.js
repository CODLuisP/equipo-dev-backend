const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'vault'));
});

router.post('/', auth, (req, res) => {
  const { name, description = '', content = '', color = '#3498DB' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

  const project = { id: uuid(), name: name.trim(), description, content, color, createdAt: Date.now() };
  db.insert(req.teamId, 'vault', project);

  req.io.to(`team:${req.teamId}`).emit('vault:added', project);
  res.status(201).json(project);
});

router.patch('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'vault', req.params.id)) return res.status(404).json({ error: 'No encontrado' });

  const patch = {};
  if (req.body.name !== undefined)        patch.name = req.body.name;
  if (req.body.description !== undefined) patch.description = req.body.description;
  if (req.body.content !== undefined)     patch.content = req.body.content;
  if (req.body.color !== undefined)       patch.color = req.body.color;

  const updated = db.update(req.teamId, 'vault', req.params.id, patch);
  req.io.to(`team:${req.teamId}`).emit('vault:updated', updated);
  res.json(updated);
});

router.delete('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'vault', req.params.id)) return res.status(404).json({ error: 'No encontrado' });
  db.remove(req.teamId, 'vault', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('vault:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
