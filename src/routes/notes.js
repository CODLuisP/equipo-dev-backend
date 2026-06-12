const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'notes'));
});

router.post('/', auth, (req, res) => {
  const note = {
    id: req.body.id || uuid(),
    content: req.body.content || '',
    authorId: req.body.authorId || '',
    createdAt: req.body.createdAt || Date.now(),
    x: req.body.x ?? 100,
    y: req.body.y ?? 100,
    color: req.body.color || null,
    type: req.body.type || 'note',
    fontSize: req.body.fontSize || null,
    width: req.body.width || null,
    rotation: req.body.rotation || 0,
    fontFamily: req.body.fontFamily || null,
    textAlign: req.body.textAlign || 'left',
    fontWeight: req.body.fontWeight || 'normal',
  };
  db.insert(req.teamId, 'notes', note);

  req.io.to(`team:${req.teamId}`).emit('note:added', note);
  res.status(201).json(note);
});

router.patch('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'notes', req.params.id)) return res.status(404).json({ error: 'No encontrada' });

  const allowed = ['content','x','y','color','type','fontSize','width','rotation','fontFamily','textAlign','fontWeight'];
  const patch = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });

  const updated = db.update(req.teamId, 'notes', req.params.id, patch);
  req.io.to(`team:${req.teamId}`).emit('note:updated', updated);
  res.json(updated);
});

router.delete('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'notes', req.params.id)) return res.status(404).json({ error: 'No encontrada' });
  db.remove(req.teamId, 'notes', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('note:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
