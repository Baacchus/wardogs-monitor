/**
 * Service pour récupérer les serveurs de WARDOGS France (.fr)
 * Source officielle : https://wardogsfrance.fr/api/serveurs
 */

async function fetchWardogsFr(timeoutMs = 6000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://wardogsfrance.fr/api/serveurs', {
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
    const rawList = Array.isArray(data.serveurs) ? data.serveurs : [];

    return rawList.map((srv, index) => {
      // Nettoyer les guillemets résiduels ou entités dans le nom en jeu
      const cleanInGame = (srv.nomEnJeu || '')
        .replace(/&quot;/g, '"')
        .replace(/"$/, '')
        .trim();

      return {
        id: srv.idConnexion || `wdfr-fr-${index + 1}`,
        name: srv.nom || `WARDOGS FRANCE #${index + 1}`,
        inGameName: cleanInGame || srv.nom,
        source: 'fr',
        sourceLabel: 'wardogsfrance.fr',
        sourceUrl: srv.url || 'https://wardogsfrance.fr/serveurs',
        online: Boolean(srv.enLigne),
        players: typeof srv.joueurs === 'number' ? srv.joueurs : 0,
        maxPlayers: typeof srv.places === 'number' ? srv.places : 100,
        currentMap: srv.carte || 'Ozeti',
        nextMap: null,
        gameMode: srv.partie || 'KOTH Normale',
        factions: null,
        statsUrl: srv.url || null,
        lastUpdated: srv.verifieLe || new Date().toISOString()
      };
    });
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[WardogsFr] Erreur lors de la récupération :', err.message);
    return [];
  }
}

module.exports = { fetchWardogsFr };
