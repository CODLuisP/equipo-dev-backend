const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    req.team = jwt.verify(token, process.env.JWT_SECRET);
    // Tokens antiguos no traen teamId → equipo legacy
    req.teamId = req.team.teamId || 'equipo-dev';
    // Tokens de equipos deshabilitados dejan de funcionar al instante
    if (req.teamId !== db.LEGACY_TEAM_ID) {
      const team = db.getTeamById(req.teamId);
      if (!team) return res.status(401).json({ error: 'Equipo no existe' });
      if (team.disabled) return res.status(403).json({ error: 'Este equipo está deshabilitado' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
