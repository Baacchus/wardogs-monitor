/**
 * Service pour récupérer les serveurs de WARDOGS France (.com) [WDFR]
 * Sources :
 * - API officielle des serveurs : https://api.wardogservers.com/v1/servers?q=WARDOGS%20FRANCE&limit=50
 * - API des scores des factions : https://www.wardogs-france.com/api/site/serveurs
 */

try {
  require('dns').setDefaultResultOrder('ipv4first');
} catch (_) {}

const MAP_NAMES = {
  Bakurani: 'Bakurani',
  Madrid: 'Ozeti',
  Detroit: 'Zestafona'
};

async function fetchWardogsCom(timeoutMs = 6000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WARDOGS-Dashboard/1.0',
    'Accept': 'application/json'
  };

  try {
    // Récupération en parallèle des données de l'API serveurs et des scores de factions
    const [serversRes, scoresRes] = await Promise.allSettled([
      fetch('https://api.wardogservers.com/v1/servers?q=WARDOGS%20FRANCE&limit=50', {
        headers: defaultHeaders,
        signal: controller.signal
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch('https://www.wardogs-france.com/api/site/serveurs', {
        headers: defaultHeaders,
        signal: controller.signal
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
    ]);

    clearTimeout(timeoutId);

    const rawList = serversRes.status === 'fulfilled' && Array.isArray(serversRes.value?.data)
      ? serversRes.value.data
      : [];

    // Indexer les scores des factions et l'état live par numéro de serveur
    const scoresMap = new Map();
    if (scoresRes.status === 'fulfilled' && Array.isArray(scoresRes.value)) {
      for (const item of scoresRes.value) {
        if (item && item.n) {
          const factions = { valkyra: 0, manticore: 0, lonestar: 0 };
          if (Array.isArray(item.scores)) {
            for (const sc of item.scores) {
              if (sc.key && Object.prototype.hasOwnProperty.call(factions, sc.key)) {
                factions[sc.key] = typeof sc.score === 'number' ? sc.score : 0;
              }
            }
          }
          scoresMap.set(item.n, {
            live: Boolean(item.live),
            factions
          });
        }
      }
    }

    // Filtrer les serveurs WDFR (.com) selon la même logique que le site officiel ([WDFR])
    const wdfrRaw = rawList.filter(srv => typeof srv.name === 'string' && srv.name.includes('[WDFR]'));

    // Si aucun [WDFR] n'est trouvé, fallback sur tous les serveurs WARDOGS FRANCE hors .FR
    const candidateServers = wdfrRaw.length > 0
      ? wdfrRaw
      : rawList.filter(srv => typeof srv.name === 'string' && !srv.name.includes('.FR'));

    const servers = candidateServers.map((srv, idx) => {
      const match = srv.name.match(/#\s?(\d+)/);
      const serverNum = match ? parseInt(match[1], 10) : idx + 1;
      const players = typeof srv.players === 'number' ? srv.players : 0;
      const scoreEntry = scoresMap.get(serverNum);

      // Si le serveur est vide (0 joueur) ou n'est pas en partie active (live: false),
      // les scores de la dernière partie sont remis à 0
      const factions = (players > 0 && scoreEntry && scoreEntry.live)
        ? scoreEntry.factions
        : { valkyra: 0, manticore: 0, lonestar: 0 };

      const mapVariant = srv.map?.variant;
      const currentMap = MAP_NAMES[mapVariant] || mapVariant || 'Ozeti';

      return {
        id: srv.serverId || srv.id || `wdfr-com-${serverNum}`,
        name: `WDFR Classique #${serverNum}`,
        inGameName: srv.name.trim(),
        serverNum,
        source: 'com',
        sourceLabel: 'wardogs-france.com',
        sourceUrl: 'https://www.wardogs-france.com/serveurs',
        online: srv.players !== null && srv.players !== undefined,
        players: typeof srv.players === 'number' ? srv.players : 0,
        maxPlayers: typeof srv.maxPlayers === 'number' ? srv.maxPlayers : 100,
        currentMap,
        nextMap: null,
        gameMode: 'Classique KOTH (3 Factions)',
        factions,
        statsUrl: `https://www.wardogs-france.com/serveurs/${serverNum}`,
        lastUpdated: srv.observedAt || new Date().toISOString()
      };
    });

    servers.sort((a, b) => a.serverNum - b.serverNum);

    return servers;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[WardogsCom] Erreur lors de la récupération :', err.message);
    return [];
  }
}

module.exports = { fetchWardogsCom };
