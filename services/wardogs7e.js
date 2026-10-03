/**
 * Service pour récupérer les serveurs de la 7ème Compagnie
 * Source officielle : https://wardogs.7ecompagnie.fr/api/public/live
 */

async function fetchWardogs7e(timeoutMs = 6000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://wardogs.7ecompagnie.fr/api/public/live', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WARDOGS-Dashboard/1.0',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    const rawServers = Array.isArray(data.servers) ? data.servers : [];

    return rawServers.map((s, idx) => {
      // Extraire les scores des factions
      const factions = { valkyra: 0, manticore: 0, lonestar: 0 };
      if (Array.isArray(s.scores)) {
        for (const sc of s.scores) {
          const name = (sc.name || '').toLowerCase();
          if (name.includes('valkyra')) factions.valkyra = sc.score || 0;
          else if (name.includes('manticore')) factions.manticore = sc.score || 0;
          else if (name.includes('lonestar')) factions.lonestar = sc.score || 0;
        }
      }

      const serverName = s.name ? `7e Cie · ${s.name}` : `7e Cie · Serveur #${idx + 1}`;
      const inGame = `[FR] 7e Compagnie ${s.name || `#${idx + 1}`}`;

      return {
        id: s.connectionId || s.id || `7e-${idx + 1}`,
        name: serverName,
        inGameName: inGame,
        source: '7e',
        sourceLabel: '7ecompagnie.fr',
        sourceUrl: 'https://wardogs.7ecompagnie.fr',
        online: Boolean(s.online),
        players: typeof s.playerCount === 'number' ? s.playerCount : 0,
        maxPlayers: typeof s.maxPlayers === 'number' ? s.maxPlayers : 100,
        currentMap: s.map || 'Zestafona',
        nextMap: null,
        gameMode: 'KOTH (3 Factions)',
        factions: factions,
        statsUrl: 'https://wardogs.7ecompagnie.fr',
        lastUpdated: new Date().toISOString()
      };
    });
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[Wardogs7e] Erreur lors de la récupération :', err.message);
    return [];
  }
}

module.exports = { fetchWardogs7e };
