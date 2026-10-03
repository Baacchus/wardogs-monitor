const http = require('http');
const fs = require('fs');
const path = require('path');
const { fetchWardogsFr } = require('./services/wardogsFr');
const { fetchWardogsCom } = require('./services/wardogsCom');
const { fetchWardogs7e } = require('./services/wardogs7e');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Configuration du cache
const CACHE_TTL_MS = 15 * 1000; // 15 secondes
let cachedData = null;
let lastFetchTime = 0;
let isFetching = false;

// Table des types MIME pour les fichiers statiques
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Agrège les données des 3 communautés et calcule les métriques globales
 */
async function getAggregatedServers(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedData && (now - lastFetchTime < CACHE_TTL_MS)) {
    return {
      ...cachedData,
      fromCache: true,
      cacheAgeSeconds: Math.round((now - lastFetchTime) / 1000)
    };
  }

  // Si une requête est déjà en cours, renvoyer le cache existant s'il existe
  if (isFetching && cachedData) {
    return {
      ...cachedData,
      fromCache: true,
      cacheAgeSeconds: Math.round((now - lastFetchTime) / 1000)
    };
  }

  isFetching = true;

  try {
    const [frServers, comServers, servers7e] = await Promise.all([
      fetchWardogsFr(),
      fetchWardogsCom(),
      fetchWardogs7e()
    ]);

    const allServers = [...frServers, ...comServers, ...servers7e];

    // Si toutes les sources ont échoué mais qu'on a un cache ancien, conserver le cache
    if (allServers.length === 0 && cachedData) {
      isFetching = false;
      return {
        ...cachedData,
        fromCache: true,
        stale: true,
        cacheAgeSeconds: Math.round((now - lastFetchTime) / 1000)
      };
    }

    const totalServers = allServers.length;
    const onlineServers = allServers.filter(s => s.online).length;
    const totalPlayers = allServers.reduce((sum, s) => sum + (s.players || 0), 0);
    const maxCapacity = allServers.reduce((sum, s) => sum + (s.maxPlayers || 100), 0);
    const occupancyRate = maxCapacity > 0 ? Math.round((totalPlayers / maxCapacity) * 100) : 0;

    // Factions globales pour les serveurs avec suivi des factions
    const serversWithFactions = [...comServers, ...servers7e];
    const globalFactions = {
      valkyra: serversWithFactions.reduce((acc, s) => acc + (s.factions?.valkyra || 0), 0),
      manticore: serversWithFactions.reduce((acc, s) => acc + (s.factions?.manticore || 0), 0),
      lonestar: serversWithFactions.reduce((acc, s) => acc + (s.factions?.lonestar || 0), 0)
    };

    cachedData = {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalServers,
        onlineServers,
        offlineServers: totalServers - onlineServers,
        totalPlayers,
        maxCapacity,
        occupancyRate,
        sources: {
          fr: {
            name: 'wardogsfrance.fr',
            count: frServers.length,
            players: frServers.reduce((acc, s) => acc + s.players, 0)
          },
          com: {
            name: 'wardogs-france.com',
            count: comServers.length,
            players: comServers.reduce((acc, s) => acc + s.players, 0)
          },
          cie7: {
            name: 'wardogs.7ecompagnie.fr',
            count: servers7e.length,
            players: servers7e.reduce((acc, s) => acc + s.players, 0)
          }
        },
        globalFactions
      },
      servers: allServers
    };

    lastFetchTime = Date.now();
    isFetching = false;

    return {
      ...cachedData,
      fromCache: false,
      cacheAgeSeconds: 0
    };
  } catch (err) {
    isFetching = false;
    console.error('[Server] Erreur lors de l\'agrégation :', err);
    if (cachedData) {
      return {
        ...cachedData,
        fromCache: true,
        error: err.message
      };
    }
    return {
      success: false,
      error: err.message,
      servers: []
    };
  }
}

/**
 * Serveur HTTP principal
 */
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Endpoint API : /api/servers
  if (pathname === '/api/servers') {
    const force = url.searchParams.get('force') === 'true';
    const data = await getAggregatedServers(force);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    return;
  }

  // Endpoint Santé / Info
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // Fichiers statiques
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Sécurité traversée de dossier
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Accès interdit');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback SPA vers index.html
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Fichier non trouvé');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`[WARDOGS Monitor] Serveur démarré sur http://localhost:${PORT}`);
});
