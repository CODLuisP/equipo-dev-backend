const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'links'));
});

router.post('/', auth, (req, res) => {
  const { name, url } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'URL requerida' });

  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

  const link = {
    id: uuid(),
    name: name?.trim() || normalized,
    url: normalized,
    createdAt: Date.now(),
    authorId: req.body.authorId || '',
  };
  db.insert(req.teamId, 'links', link);
  req.io.to(`team:${req.teamId}`).emit('link:added', link);
  res.status(201).json(link);
});

router.delete('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'links', req.params.id))
    return res.status(404).json({ error: 'No encontrado' });
  db.remove(req.teamId, 'links', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('link:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
