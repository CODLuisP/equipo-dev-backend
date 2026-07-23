require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
const server = http.createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3001';

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // archivos pueden ser grandes (base64)

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB para imágenes base64
});

// Verificar JWT en conexión socket
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token requerido'));
  try {
    socket.team = jwt.verify(token, process.env.JWT_SECRET);
    // Tokens antiguos no traen teamId → equipo legacy
    socket.teamId = socket.team.teamId || 'equipo-dev';
    if (socket.teamId !== db.LEGACY_TEAM_ID) {
      const team = db.getTeamById(socket.teamId);
      if (!team || team.disabled) return next(new Error('Equipo deshabilitado'));
    }
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

// Estado AFK y presencia en memoria, separados por equipo
const radarState  = {}; // { teamId: { userId: RadarEntry } }
const presenceMap = {}; // { teamId: { userId: { userId, name, color, avatarSeed, lastSeen } } }
const userSockets = {}; // { teamId: { userId: Set<socketId> } } — para saber cuándo un usuario cierra TODAS sus pestañas

io.on('connection', (socket) => {
  const teamId = socket.teamId;
  const room = `team:${teamId}`;
  if (!radarState[teamId])  radarState[teamId]  = {};
  if (!presenceMap[teamId]) presenceMap[teamId] = {};
  if (!userSockets[teamId]) userSockets[teamId] = {};

  console.log(`✅ Cliente conectado: ${socket.id} (equipo: ${teamId})`);

  // Unirse a la sala del equipo
  socket.join(room);

  // Al conectarse: enviar estado AFK actual
  const activeAFK = Object.values(radarState[teamId]).filter(e => e.isAFK);
  if (activeAFK.length > 0) socket.emit('radar:sync', activeAFK);

  // Enviar presencia completa al nuevo cliente
  socket.emit('presence:sync', Object.values(presenceMap[teamId]));

  // El cliente también puede pedir el estado explícitamente
  socket.on('radar:request', () => {
    const afk = Object.values(radarState[teamId]).filter(e => e.isAFK);
    socket.emit('radar:sync', afk);
    console.log(`📡 radar:request → enviando ${afk.length} AFK activos`);
  });

  // ── Radar AFK ──────────────────────────────────────────────────────────────
  socket.on('radar:afk', (entry) => {
    radarState[teamId][entry.userId] = entry;
    socket.to(room).emit('radar:afk', entry);
    console.log(`🔴 ${entry.name} → AFK: ${entry.statusText}`);
  });

  socket.on('radar:back', (entry) => {
    delete radarState[teamId][entry.userId];
    socket.to(room).emit('radar:back', entry);
    console.log(`🟢 ${entry.name} → de vuelta`);
  });

  // ── Presencia en tiempo real ────────────────────────────────────────────────
  socket.on('presence:identify', (data) => {
    // data = { userId, name, color, avatarSeed }
    socket._presenceId = data.userId;
    // Registrar este socket para el usuario (soporta varias pestañas/dispositivos)
    if (!userSockets[teamId][data.userId]) userSockets[teamId][data.userId] = new Set();
    userSockets[teamId][data.userId].add(socket.id);
    const entry = { userId: data.userId, name: data.name, color: data.color, avatarSeed: data.avatarSeed, lastSeen: Date.now() };
    presenceMap[teamId][data.userId] = entry;
    // Notificar a todos (incluido el que se conecta) con info completa
    io.to(room).emit('presence:update', entry);
    console.log(`🟢 Presencia: ${data.name} conectado`);
  });

  socket.on('presence:ping', (userId) => {
    if (presenceMap[teamId][userId]) {
      presenceMap[teamId][userId].lastSeen = Date.now();
      // Solo broadcast a los demás (no echo al mismo socket)
      socket.to(room).emit('presence:update', { ...presenceMap[teamId][userId] });
    }
  });

  socket.on('presence:request', () => {
    socket.emit('presence:sync', Object.values(presenceMap[teamId]));
  });

  socket.on('disconnect', () => {
    const uid = socket._presenceId;
    if (uid) {
      // Quitar este socket del conjunto del usuario
      const set = userSockets[teamId][uid];
      if (set) {
        set.delete(socket.id);
        // Solo marcar offline si ya NO le quedan pestañas/dispositivos abiertos
        if (set.size === 0) {
          delete userSockets[teamId][uid];
          if (presenceMap[teamId][uid]) {
            delete presenceMap[teamId][uid];
            io.to(room).emit('presence:update', { userId: uid, lastSeen: null });
          }
          // Si estaba AFK, limpiar su estado para que no quede "fantasma" para los demás
          if (radarState[teamId][uid] && radarState[teamId][uid].isAFK) {
            const back = { ...radarState[teamId][uid], isAFK: false, timestamp: Date.now() };
            delete radarState[teamId][uid];
            io.to(room).emit('radar:back', back);
            console.log(`🚪 ${back.name || uid} se desconectó estando AFK → limpiado`);
          }
          console.log(`🔴 Presencia: ${uid} desconectado (sin pestañas activas)`);
        }
      }
    }
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// Inyectar io en req para que los routes puedan emitir
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/auth',     require('./routes/auth'));
app.use('/members',  require('./routes/members'));
app.use('/tasks',    require('./routes/tasks'));
app.use('/snippets', require('./routes/snippets'));
app.use('/notes',    require('./routes/notes'));
app.use('/vault',    require('./routes/vault'));
app.use('/pizarra/files', require('./routes/archivos'));
app.use('/links',    require('./routes/links'));
app.use('/websites', require('./routes/websites'));
app.use('/admin',    require('./routes/admin'));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Equipo Dev API',
  customCss: '.swagger-ui .topbar { background: #0a0c1a; } .swagger-ui .topbar-wrapper img { display: none; } .swagger-ui .topbar-wrapper::before { content: "🚀 Equipo Dev API"; color: #60a5fa; font-size: 18px; font-weight: 800; }',
}));

// ─── Limpieza automática de tareas completadas (+24h) ─────────────────────────
const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

function purgeCompletedTasks() {
  const now = Date.now();
  const teams = db.getTeams();
  let total = 0;
  for (const team of teams) {
    const tasks = db.getAll(team.id, 'tasks');
    for (const task of tasks) {
      if (task.status !== 'completada') continue;
      const ts = task.completedAt || task.createdAt || 0;
      if (now - ts >= TTL_MS) {
        db.remove(team.id, 'tasks', task.id);
        io.to(`team:${team.id}`).emit('task:deleted', { id: task.id });
        total++;
      }
    }
  }
  if (total > 0) console.log(`🗑️  Purge: ${total} tarea(s) completada(s) eliminada(s)`);
}

// ─── Arrancar ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`\n🚀 Equipo Dev Backend corriendo en http://localhost:${PORT}`);
  console.log(`📡 Socket.io listo`);
  console.log(`🗄️  Base de datos: JSON files\n`);

  purgeCompletedTasks(); // ejecutar al arrancar
  setInterval(purgeCompletedTasks, 60 * 60 * 1000); // cada hora
});
