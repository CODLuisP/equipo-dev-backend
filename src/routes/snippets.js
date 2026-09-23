const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'snippets'));
});

// El proyecto es solo un nombre dentro del snippet ('' = sin proyecto).
const cleanProject = v => (typeof v === 'string' ? v.trim().slice(0, 60) : '');

router.post('/', auth, (req, res) => {
  const { title, content = '', label = 'código', authorId = '', project = '', pinned = false } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Título requerido' });

  const snippet = {
    id: uuid(), title: title.trim(), content, label, authorId,
    project: cleanProject(project), pinned: !!pinned,
    createdAt: Date.now(),
  };
  db.insert(req.teamId, 'snippets', snippet);

  req.io.to(`team:${req.teamId}`).emit('snippet:added', snippet);
  res.status(201).json(snippet);
});

// Renombra un proyecto en todos sus snippets de una sola vez (si el nombre nuevo
// ya existe, los proyectos quedan fusionados).
router.post('/rename-project', auth, (req, res) => {
  const from = cleanProject(req.body.from);
  const to   = cleanProject(req.body.to);
  if (!from || !to) return res.status(400).json({ error: 'Nombre de proyecto requerido' });

  const affected = db.getAll(req.teamId, 'snippets').filter(s => (s.project || '') === from);
  for (const s of affected) {
    const updated = db.update(req.teamId, 'snippets', s.id, { project: to });
    req.io.to(`team:${req.teamId}`).emit('snippet:updated', updated);
  }
  res.json({ ok: true, count: affected.length });
});

router.patch('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'snippets', req.params.id)) return res.status(404).json({ error: 'No encontrado' });

  const patch = {};
  if (req.body.title !== undefined)    patch.title = req.body.title;
  if (req.body.content !== undefined)  patch.content = req.body.content;
  if (req.body.label !== undefined)    patch.label = req.body.label;
  if (req.body.authorId !== undefined) patch.authorId = req.body.authorId;
  if (req.body.project !== undefined)  patch.project = cleanProject(req.body.project);
  if (req.body.pinned !== undefined)   patch.pinned = !!req.body.pinned;

  const updated = db.update(req.teamId, 'snippets', req.params.id, patch);
  req.io.to(`team:${req.teamId}`).emit('snippet:updated', updated);
  res.json(updated);
});

router.delete('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'snippets', req.params.id)) return res.status(404).json({ error: 'No encontrado' });
  db.remove(req.teamId, 'snippets', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('snippet:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
