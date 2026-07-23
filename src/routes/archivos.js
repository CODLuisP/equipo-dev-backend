const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/all', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'shared_files'));
});

router.post('/', auth, (req, res) => {
  const { name, type, size = 0, dataUrl, x = 100, y = 100, authorName = '' } = req.body;
  if (!name || !dataUrl) return res.status(400).json({ error: 'Datos incompletos' });

  const file = {
    id: req.body.id || uuid(),
    name, type, size, dataUrl, x, y,
    createdAt: req.body.createdAt || Date.now(),
    authorName,
  };
  db.insert(req.teamId, 'shared_files', file);
  req.io.to(`team:${req.teamId}`).emit('file:added', file);
  res.status(201).json(file);
});

router.patch('/:id', auth, (req, res) => {
  const allowed = ['name', 'x', 'y', 'authorName'];
  const patch = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
  const updated = db.update(req.teamId, 'shared_files', req.params.id, patch);
  if (!updated) return res.status(404).json({ error: 'Archivo no encontrado' });
  req.io.to(`team:${req.teamId}`).emit('file:updated', updated);
  res.json(updated);
});

router.delete('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'shared_files', req.params.id)) return res.status(404).json({ error: 'Archivo no encontrado' });
  db.remove(req.teamId, 'shared_files', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('file:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
