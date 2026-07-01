const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

const normalizeUrl = (u = '') => {
  let s = (u || '').toString().trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s;
};

// Normaliza la lista de cuentas y garantiza una única principal.
const sanitizeAccounts = (accounts) => {
  if (!Array.isArray(accounts)) return [];
  const list = accounts
    .map(a => ({
      id: a.id || uuid(),
      label: (a.label || '').toString(),
      username: (a.username || '').toString(),
      password: (a.password || '').toString(),
      isPrimary: !!a.isPrimary,
    }))
    .filter(a => a.username || a.password || a.label);
  if (list.length && !list.some(a => a.isPrimary)) list[0].isPrimary = true;
  let primarySet = false;
  for (const a of list) {
    if (a.isPrimary && !primarySet) primarySet = true;
    else a.isPrimary = false;
  }
  return list;
};

router.get('/', auth, (req, res) => {
  res.json(db.getAll(req.teamId, 'websites'));
});

router.post('/', auth, (req, res) => {
  const { name, url, image = '', accounts = [], authorId = '', kind, description = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

  const safeKind = kind === 'resource' ? 'resource' : 'credentials';
  const site = {
    id: uuid(),
    name: name.trim(),
    url: normalizeUrl(url),
    image: image || '',
    kind: safeKind,
    description: safeKind === 'resource' ? (description || '').toString() : '',
    accounts: safeKind === 'resource' ? [] : sanitizeAccounts(accounts),
    authorId,
    createdAt: Date.now(),
  };
  db.insert(req.teamId, 'websites', site);
  req.io.to(`team:${req.teamId}`).emit('website:added', site);
  res.status(201).json(site);
});

router.patch('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'websites', req.params.id))
    return res.status(404).json({ error: 'No encontrado' });

  const patch = {};
  if (req.body.name        !== undefined) patch.name        = (req.body.name || '').toString().trim();
  if (req.body.url         !== undefined) patch.url         = normalizeUrl(req.body.url);
  if (req.body.image       !== undefined) patch.image       = req.body.image || '';
  if (req.body.kind        !== undefined) patch.kind        = req.body.kind === 'resource' ? 'resource' : 'credentials';
  if (req.body.description !== undefined) patch.description = (req.body.description || '').toString();
  if (req.body.accounts    !== undefined) patch.accounts    = sanitizeAccounts(req.body.accounts);

  // Si pasa a recurso, no conserva cuentas; si pasa a credenciales, limpia descripción.
  const finalKind = patch.kind ?? db.getById(req.teamId, 'websites', req.params.id)?.kind;
  if (finalKind === 'resource') patch.accounts = [];
  if (finalKind === 'credentials') patch.description = '';

  const updated = db.update(req.teamId, 'websites', req.params.id, patch);
  req.io.to(`team:${req.teamId}`).emit('website:updated', updated);
  res.json(updated);
});

router.delete('/:id', auth, (req, res) => {
  if (!db.getById(req.teamId, 'websites', req.params.id))
    return res.status(404).json({ error: 'No encontrado' });
  db.remove(req.teamId, 'websites', req.params.id);
  req.io.to(`team:${req.teamId}`).emit('website:deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
