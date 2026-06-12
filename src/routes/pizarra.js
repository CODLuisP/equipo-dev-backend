const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// ─── Custom shapes (compartidas) ─────────────────────────────────────────────
// IMPORTANT: Rutas fijas siempre ANTES de parámetros dinámicos

router.get('/shapes/all', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'custom_shapes'));
});

router.post('/shapes', auth, (req, res) => {
  const { label, svgContent, viewBox, defaultW = 100, defaultH = 100 } = req.body;
  if (!label || !svgContent) return res.status(400).json({ error: 'Datos incompletos' });

  const shape = { id: req.body.id || uuid(), label, svgContent, viewBox, defaultW, defaultH };
  db.insert(req.teamId, 'custom_shapes', shape);

  req.io.to(`team:${req.teamId}`).emit('shape:added', shape);
  res.status(201).json(shape);
});

router.delete('/shapes/:id', auth, (req, res) => {
  db.remove(req.teamId, 'custom_shapes', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('shape:deleted', { id: req.params.id });
  res.json({ ok: true });
});

// ─── Archivos compartidos ─────────────────────────────────────────────────────

router.get('/files/all', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'shared_files'));
});

router.post('/files', auth, (req, res) => {
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

router.patch('/files/:id', auth, (req, res) => {
  const updated = db.update(req.teamId, 'shared_files', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Archivo no encontrado' });
  req.io.to(`team:${req.teamId}`).emit('file:updated', updated);
  res.json(updated);
});

router.delete('/files/:id', auth, (req, res) => {
  db.remove(req.teamId, 'shared_files', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('file:deleted', { id: req.params.id });
  res.json({ ok: true });
});

// ─── Pizarra personal (rutas dinámicas AL FINAL) ──────────────────────────────

router.get('/:memberId', auth, (req, res) => {
  res.json(db.getPizarra(req.teamId, req.params.memberId));
});

router.put('/:memberId', auth, (req, res) => {
  db.setPizarra(req.teamId, req.params.memberId, req.body);
  // Solo notifica al dueño de esa pizarra
  req.io.to(`pizarra:${req.params.memberId}`).emit('pizarra:updated', req.body);
  res.json({ ok: true });
});

module.exports = router;
