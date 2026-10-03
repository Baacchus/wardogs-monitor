/**
 * Service pour récupérer et analyser les serveurs de WARDOGS France (.com)
 * Source : https://www.wardogs-france.com/serveurs
 */

async function fetchWardogsCom(timeoutMs = 6000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://www.wardogs-france.com/serveurs', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 WARDOGS-Dashboard/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const html = await res.text();
    const servers = [];
    const articles = html.split('<article');

    articles.slice(1).forEach((chunk, idx) => {
      const art = chunk.split('</article>')[0];

      // Extraction de l'UUID
      const idMatch = art.match(/<code[^>]*>([a-f0-9\-]{36})<\/code>/i) ||
                      art.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      const serverId = idMatch ? idMatch[1] : `wdfr-com-${idx + 1}`;

      // Extraction du nombre de joueurs
      const playersMatch = art.match(/(\d+)\s*\/\s*(\d+)\s*joueurs/i);
      const players = playersMatch ? parseInt(playersMatch[1], 10) : 0;
      const maxPlayers = playersMatch ? parseInt(playersMatch[2], 10) : 100;

      // Statut en ligne
      const isOnline = art.includes('En ligne');

      // Carte suivante
      const nextMapMatch = art.match(/Carte suivante\s*:\s*(?:<!-- -->)?\s*([a-zA-Z0-9_\-]+)/i);
      const nextMap = nextMapMatch ? nextMapMatch[1].trim() : null;

      // Lien vers les statistiques
      const statsMatch = art.match(/href="(\/serveurs\/[^"]+)"/i);
      const statsUrl = statsMatch ? `https://www.wardogs-france.com${statsMatch[1]}` : null;

      // Factions (Valkyra, Manticore, Lonestar)
      const factions = { valkyra: 0, manticore: 0, lonestar: 0 };
      const valkMatch = art.match(/Valkyra<\/span><span[^>]*>(\d+)<\/span>/i);
      const mantMatch = art.match(/Manticore<\/span><span[^>]*>(\d+)<\/span>/i);
      const loneMatch = art.match(/Lonestar<\/span><span[^>]*>(\d+)<\/span>/i);

      if (valkMatch) factions.valkyra = parseInt(valkMatch[1], 10);
      if (mantMatch) factions.manticore = parseInt(mantMatch[1], 10);
      if (loneMatch) factions.lonestar = parseInt(loneMatch[1], 10);

      const serverNum = idx + 1;
      servers.push({
        id: serverId,
        name: `WDFR Classique #${serverNum}`,
        inGameName: `[FR] WARDOGS FRANCE Classique #${serverNum}`,
        source: 'com',
        sourceLabel: 'wardogs-france.com',
        sourceUrl: 'https://www.wardogs-france.com/serveurs',
        online: isOnline,
        players: players,
        maxPlayers: maxPlayers,
        currentMap: 'Classique KOTH',
        nextMap: nextMap,
        gameMode: 'Classique KOTH (3 Factions)',
        factions: factions,
        statsUrl: statsUrl,
        lastUpdated: new Date().toISOString()
      });
    });

    return servers;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[WardogsCom] Erreur lors de la récupération :', err.message);
    return [];
  }
}

module.exports = { fetchWardogsCom };
