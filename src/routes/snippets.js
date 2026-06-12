const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'snippets'));
});

router.post('/', auth, (req, res) => {
  const { title, content = '', label = 'código', authorId = '' } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Título requerido' });

  const snippet = { id: uuid(), title: title.trim(), content, label, authorId, createdAt: Date.now() };
  db.insert(req.teamId, 'snippets', snippet);

  req.io.to(`team:${req.teamId}`).emit('snippet:added', snippet);
  res.status(201).json(snippet);
});

router.patch('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'snippets', req.params.id)) return res.status(404).json({ error: 'No encontrado' });

  const patch = {};
  if (req.body.title !== undefined)    patch.title = req.body.title;
  if (req.body.content !== undefined)  patch.content = req.body.content;
  if (req.body.label !== undefined)    patch.label = req.body.label;
  if (req.body.authorId !== undefined) patch.authorId = req.body.authorId;

  const updated = db.update(req.teamId, 'snippets', req.params.id, patch);
  req.io.to(`team:${req.teamId}`).emit('snippet:updated', updated);
  res.json(updated);
});

router.delete('/:id', auth, (req, res) => {
  db.remove(req.teamId, 'snippets', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('snippet:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
