const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '🚀 Equipo Dev API',
      version: '1.0.0',
      description: 'Backend para la app de gestión del equipo de desarrollo. Usa el botón **Authorize** e ingresa el token JWT.',
    },
    servers: [{ url: 'http://localhost:3003', description: 'Local' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Obtén el token con POST /auth/login y pégalo aquí.',
        },
      },
      schemas: {
        Member: {
          type: 'object',
          properties: {
            id:        { type: 'string', example: 'uuid-...' },
            name:      { type: 'string', example: 'Owen' },
            role:      { type: 'string', example: 'Full Stack Developer' },
            color:     { type: 'string', example: '#3498DB' },
            avatarSeed:{ type: 'string', nullable: true },
            createdAt: { type: 'integer', example: 1717800000000 },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id:         { type: 'string' },
            title:      { type: 'string', example: 'Arreglar bug en login' },
            status:     { type: 'string', enum: ['pendiente', 'en progreso', 'completada'] },
            assignedTo: { type: 'string', example: 'member-uuid' },
            createdAt:  { type: 'integer' },
          },
        },
        Snippet: {
          type: 'object',
          properties: {
            id:        { type: 'string' },
            title:     { type: 'string', example: 'Config DB' },
            content:   { type: 'string' },
            label:     { type: 'string', enum: ['env', 'código', 'config', 'otro'] },
            authorId:  { type: 'string' },
            createdAt: { type: 'integer' },
          },
        },
        VaultProject: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            name:        { type: 'string', example: 'Proyecto Velsat' },
            description: { type: 'string' },
            content:     { type: 'string' },
            color:       { type: 'string' },
            createdAt:   { type: 'integer' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth',     description: 'Login y token JWT' },
      { name: 'Members',  description: 'Miembros del equipo' },
      { name: 'Tasks',    description: 'Tareas' },
      { name: 'Snippets', description: 'Snippets de código' },
      { name: 'Notes',    description: 'Notas compartidas' },
      { name: 'Vault',    description: 'Bóveda de credenciales' },
      { name: 'Pizarra',  description: 'Pizarras personales y assets compartidos' },
    ],
    paths: {
      // ── Auth ──────────────────────────────────────────────────────────────
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login con contraseña compartida',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { password: { type: 'string', example: 'dev123' } }, required: ['password'] } } },
          },
          responses: {
            200: { description: 'Token JWT', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } } },
            401: { description: 'Contraseña incorrecta' },
          },
        },
      },

      // ── Members ───────────────────────────────────────────────────────────
      '/members': {
        get: {
          tags: ['Members'], summary: 'Listar todos los miembros',
          responses: { 200: { description: 'Array de miembros', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Member' } } } } } },
        },
        post: {
          tags: ['Members'], summary: 'Crear miembro',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } }, required: ['name'] } } } },
          responses: { 201: { description: 'Miembro creado', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Member' } } } } },
        },
      },
      '/members/{id}': {
        patch: {
          tags: ['Members'], summary: 'Actualizar miembro',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, color: { type: 'string' }, avatarSeed: { type: 'string' } } } } } },
          responses: { 200: { description: 'Miembro actualizado' } },
        },
        delete: {
          tags: ['Members'], summary: 'Eliminar miembro',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Eliminado' } },
        },
      },

      // ── Tasks ─────────────────────────────────────────────────────────────
      '/tasks': {
        get:  { tags: ['Tasks'], summary: 'Listar tareas', responses: { 200: { description: 'Array de tareas', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Task' } } } } } } },
        post: {
          tags: ['Tasks'], summary: 'Crear tarea',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string' }, assignedTo: { type: 'string' } }, required: ['title'] } } } },
          responses: { 201: { description: 'Tarea creada' } },
        },
      },
      '/tasks/{id}': {
        patch: { tags: ['Tasks'], summary: 'Actualizar tarea', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string' }, assignedTo: { type: 'string' } } } } } }, responses: { 200: { description: 'Actualizada' } } },
        delete: { tags: ['Tasks'], summary: 'Eliminar tarea', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Eliminada' } } },
      },

      // ── Snippets ──────────────────────────────────────────────────────────
      '/snippets': {
        get:  { tags: ['Snippets'], summary: 'Listar snippets', responses: { 200: { description: 'Array', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Snippet' } } } } } } },
        post: { tags: ['Snippets'], summary: 'Crear snippet', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, label: { type: 'string' }, authorId: { type: 'string' } }, required: ['title'] } } } }, responses: { 201: { description: 'Creado' } } },
      },
      '/snippets/{id}': {
        patch:  { tags: ['Snippets'], summary: 'Actualizar snippet', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Actualizado' } } },
        delete: { tags: ['Snippets'], summary: 'Eliminar snippet', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Eliminado' } } },
      },

      // ── Notes ─────────────────────────────────────────────────────────────
      '/notes': {
        get:  { tags: ['Notes'], summary: 'Listar notas compartidas', responses: { 200: { description: 'Array de notas' } } },
        post: { tags: ['Notes'], summary: 'Crear nota', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { content: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, authorId: { type: 'string' } } } } } }, responses: { 201: { description: 'Creada' } } },
      },
      '/notes/{id}': {
        patch:  { tags: ['Notes'], summary: 'Actualizar nota', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Actualizada' } } },
        delete: { tags: ['Notes'], summary: 'Eliminar nota', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Eliminada' } } },
      },

      // ── Vault ─────────────────────────────────────────────────────────────
      '/vault': {
        get:  { tags: ['Vault'], summary: 'Listar proyectos de la bóveda', responses: { 200: { description: 'Array', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/VaultProject' } } } } } } },
        post: { tags: ['Vault'], summary: 'Crear proyecto', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, content: { type: 'string' } }, required: ['name'] } } } }, responses: { 201: { description: 'Creado' } } },
      },
      '/vault/{id}': {
        patch:  { tags: ['Vault'], summary: 'Actualizar proyecto', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Actualizado' } } },
        delete: { tags: ['Vault'], summary: 'Eliminar proyecto', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Eliminado' } } },
      },

      // ── Pizarra ───────────────────────────────────────────────────────────
      '/pizarra/{memberId}': {
        get: { tags: ['Pizarra'], summary: 'Obtener pizarra personal', parameters: [{ name: 'memberId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Datos de la pizarra (JSON libre)' } } },
        put: { tags: ['Pizarra'], summary: 'Guardar pizarra personal', parameters: [{ name: 'memberId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Guardada' } } },
      },
      '/pizarra/shapes/all': {
        get: { tags: ['Pizarra'], summary: 'Listar formas customizadas compartidas', responses: { 200: { description: 'Array de formas' } } },
      },
      '/pizarra/shapes': {
        post: { tags: ['Pizarra'], summary: 'Agregar forma customizada', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { label: { type: 'string' }, svgContent: { type: 'string' }, viewBox: { type: 'string' } } } } } }, responses: { 201: { description: 'Creada' } } },
      },
      '/pizarra/shapes/{id}': {
        delete: { tags: ['Pizarra'], summary: 'Eliminar forma', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Eliminada' } } },
      },
      '/pizarra/files/all': {
        get: { tags: ['Pizarra'], summary: 'Listar archivos compartidos', responses: { 200: { description: 'Array de archivos' } } },
      },
      '/pizarra/files': {
        post: { tags: ['Pizarra'], summary: 'Subir archivo compartido', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, dataUrl: { type: 'string' } } } } } }, responses: { 201: { description: 'Subido' } } },
      },
      '/pizarra/files/{id}': {
        delete: { tags: ['Pizarra'], summary: 'Eliminar archivo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Eliminado' } } },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
