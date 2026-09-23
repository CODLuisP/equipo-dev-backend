const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

const PRIORITIES = ['normal', 'alta'];

const isValidDueDate = v => v === null || (typeof v === 'number' && Number.isFinite(v));

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'tasks'));
});

router.post('/', auth, (req, res) => {
  const { title, status = 'pendiente', assignedTo = '', description = '', attachments = [], priority = 'normal', dueDate = null } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Título requerido' });
  if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Prioridad inválida' });
  if (!isValidDueDate(dueDate)) return res.status(400).json({ error: 'Fecha límite inválida' });

  const task = {
    id: uuid(), title: title.trim(), status, assignedTo, description, attachments,
    priority, dueDate, focus: false,
    createdAt: Date.now(),
  };
  db.insert(req.teamId, 'tasks', task);

  req.io.to(`team:${req.teamId}`).emit('task:added', task);
  res.status(201).json(task);
});

router.patch('/:id', auth, (req, res) => {
  const current = db.getById(req.teamId, 'tasks', req.params.id);
  if (!current) return res.status(404).json({ error: 'No encontrada' });

  const patch = {};
  if (req.body.title       !== undefined) patch.title       = req.body.title;
  if (req.body.status      !== undefined) {
    patch.status = req.body.status;
    if (req.body.status === 'completada') patch.completedAt = Date.now();
    else patch.completedAt = null;
    // "Trabajando ahora" solo tiene sentido mientras la tarea está en progreso.
    if (req.body.status !== 'en progreso') patch.focus = false;
  }
  if (req.body.assignedTo  !== undefined) patch.assignedTo  = req.body.assignedTo;
  if (req.body.description !== undefined) patch.description = req.body.description;
  if (req.body.attachments !== undefined) patch.attachments = req.body.attachments;
  if (req.body.blocks      !== undefined) patch.blocks      = req.body.blocks;
  if (req.body.priority    !== undefined) {
    if (!PRIORITIES.includes(req.body.priority)) return res.status(400).json({ error: 'Prioridad inválida' });
    patch.priority = req.body.priority;
  }
  if (req.body.dueDate     !== undefined) {
    if (!isValidDueDate(req.body.dueDate)) return res.status(400).json({ error: 'Fecha límite inválida' });
    patch.dueDate = req.body.dueDate;
  }
  if (req.body.focus !== undefined && patch.focus === undefined) {
    const effectiveStatus = patch.status ?? current.status;
    patch.focus = effectiveStatus === 'en progreso' && !!req.body.focus;
  }

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
