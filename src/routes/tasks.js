const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'tasks'));
});

router.post('/', auth, (req, res) => {
  const { title, status = 'pendiente', assignedTo = '' } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Título requerido' });

  const task = { id: uuid(), title: title.trim(), status, assignedTo, createdAt: Date.now() };
  db.insert(req.teamId, 'tasks', task);

  req.io.to(`team:${req.teamId}`).emit('task:added', task);
  res.status(201).json(task);
});

router.patch('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'tasks', req.params.id)) return res.status(404).json({ error: 'No encontrada' });

  const patch = {};
  if (req.body.title !== undefined)      patch.title = req.body.title;
  if (req.body.status !== undefined)     patch.status = req.body.status;
  if (req.body.assignedTo !== undefined) patch.assignedTo = req.body.assignedTo;

  const updated = db.update(req.teamId, 'tasks', req.params.id, patch);
  req.io.to(`team:${req.teamId}`).emit('task:updated', updated);
  res.json(updated);
});

router.delete('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'tasks', req.params.id)) return res.status(404).json({ error: 'No encontrada' });
  db.remove(req.teamId, 'tasks', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('task:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
