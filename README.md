# WARDOGS Server Monitor 🎯

Tableau de bord tactique en temps réel pour surveiller l'état, les joueurs et les scores des factions sur l'ensemble des serveurs communautaires francophones du jeu **WARDOGS**.

## 📡 Communautés Surveillées (17 serveurs)

- **7ème Compagnie** (`wardogs.7ecompagnie.fr`) : 6 serveurs KOTH avec scores en direct des 3 factions.
- **WARDOGS FRANCE** (`wardogsfrance.fr`) : 4 serveurs KOTH standard.
- **WARDOGS FRANCE [WDFR]** (`wardogs-france.com`) : 7 serveurs Classique KOTH avec répartition des 3 factions.

---

## ⚡ Fonctionnalités Clés

- **Agrégation unifiée multi-sources** : centralisation des 17 serveurs avec rafraîchissement automatique toutes les 30 secondes.
- **Scores des 3 factions** (*Valkyra*, *Manticore*, *Lonestar*) avec jauges proportionnelles sur 100 points de victoire.
- **Copie 1-clic du Server ID** : bouton rapide pour copier l'UUID du serveur directement dans le presse-papiers et rejoindre en jeu.
- **Outils de tri et de recherche instantanés** :
  - Filtres par communauté (Tous, 7e Compagnie, .fr, .com).
  - Commutateur « Actifs uniquement » pour masquer les serveurs vides.
  - Recherche en direct par carte, nom de serveur ou mode.
  - Tri par affluence ou alphabétique.
- **Architecture ultra-légère** :
  - Développé en Node.js natif (zéro dépendance externe).
  - Cache mémoire avec TTL de 15 secondes pour préserver les serveurs sources.
  - Interface moderne, réactive et silencieuse.

---

## 🚀 Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) (v18+)

### Lancement

```bash
# Démarrer le serveur
node server.js

# Ou en mode dev (redémarrage auto lors des modifications)
npm run dev
```

Ouvrez ensuite votre navigateur sur **`http://localhost:3000`**.

---

## 📜 Licence
Projet personnel et indépendant sous licence [MIT](LICENSE). WARDOGS est la propriété de ses développeurs et éditeurs respectifs.
