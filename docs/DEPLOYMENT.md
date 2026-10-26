# Déployer l’interface Air3Dex

[Français](DEPLOYMENT.md) | [English](DEPLOYMENT.en.md)

Air3Dex est une application web statique composée d’une page HTML et de
ressources JavaScript, CSS et images. Elle nécessite un serveur HTTP, mais
aucune extension Visual Studio Code et aucune machine virtuelle.

## Prérequis

- Node.js 20.19.0 ou une version ultérieure ;
- npm ;
- un navigateur récent avec WebGL activé ;
- un accès aux CDN publics utilisés par l’interface.

```bash
node --version
npm --version
```

La version minimale de Node.js correspond aux contraintes des versions de
Cesium et ESLint verrouillées dans `package-lock.json`.

## Installer le projet

Depuis la racine du dépôt :

```bash
npm ci
```

`npm ci` installe exactement les versions enregistrées dans
`package-lock.json`. Les traitements Python disposent d’une installation
distincte, décrite dans le [README](../README.md#installer-le-prétraitement-python).

## Lancer l’interface localement

```bash
npm start
```

Ouvrir ensuite :

```text
http://127.0.0.1:8000/
```

Le serveur redirige automatiquement vers
`/src/air3dex/templates/index.html`. `npm run serve` est un alias de
`npm start`.

Le serveur `scripts/serve.mjs` utilise uniquement les modules intégrés à
Node.js. Il sert la racine du dépôt afin que les chemins de `index.html` vers
`../static/` restent valides.

Pour choisir un autre port :

```bash
PORT=8080 npm start
```

Pour écouter sur toutes les interfaces réseau :

```bash
HOST=0.0.0.0 npm start
```

L’écoute est limitée à `127.0.0.1` par défaut. N’utiliser `0.0.0.0` que sur un
réseau maîtrisé ou derrière un frontal correctement configuré.

Ne pas ouvrir directement `index.html` avec une URL `file://`. Les modules ES
et les ressources doivent être chargés dans un contexte HTTP.

## Charger les données

L’interface permet de sélectionner un fichier local :

- `.json` pour les données converties par Air3Dex ;
- `.czml` pour les données compatibles Cesium.

Le navigateur lit directement le fichier sélectionné. Aucun backend de
téléversement n’est présent dans le dépôt analysé.


## Configurer Cesium Ion

Le viewer utilise Cesium World Terrain et nécessite un jeton Cesium Ion.

`src/air3dex/static/viewer.js` utilise actuellement le jeton public d’évaluation
fourni avec CesiumJS. Il ne s’agit pas d’un secret propre au projet : sa présence
dans le dépôt ne constitue donc pas une fuite d’identifiants. Ce jeton est
toutefois prévu pour les essais et les démonstrations, pas pour un service de
production durable.

Pour la production :

1. créer un jeton Cesium Ion dédié à Air3Dex ;
2. limiter ses droits aux ressources nécessaires ;
3. restreindre ses URL autorisées aux domaines de déploiement ;
4. définir une méthode de configuration adaptée à la cible.

Une valeur utilisée par le navigateur reste visible par l’utilisateur. La
protection repose donc sur des permissions minimales et des restrictions de
domaine, pas sur la confidentialité du code frontend.

Le mécanisme définitif nécessite une validation humaine : aucun système de
génération de configuration frontend n’existe actuellement dans le dépôt. Le
jeton d’évaluation peut être conservé pour le développement local.

## Vérifier le déploiement

Après `npm start`, vérifier :

1. que l’URL locale ouvre Air3Dex ;
2. que le logo, les icônes et les styles sont présents ;
3. que le globe Cesium et la minicarte Leaflet s’affichent ;
4. que la console ne contient ni erreur JavaScript ni réponse 404 ;
5. qu’un fichier JSON ou CZML représentatif peut être chargé ;
6. que la chronologie, les statistiques, la légende et les graphiques réagissent ;
7. que `npm run lint` termine sans erreur.

## Déployer en production

Le serveur Node fourni vise le développement local et la démonstration. Pour
la production, publier le frontend derrière un serveur statique institutionnel
ou un frontal HTTPS.

La racine publiée doit préserver cette structure :

```text
src/air3dex/
├── templates/
│   └── index.html
└── static/
    ├── assets/
    ├── styles.css
    └── *.js
```

Le serveur de production doit :

- utiliser HTTPS ;
- servir `.js` avec un type MIME JavaScript ;
- servir `.json` et `.czml` avec un type compatible JSON ;
- conserver les chemins relatifs entre `templates` et `static` ;
- appliquer une politique de sécurité compatible avec les services autorisés ;
- ne pas exposer les sources Python, tests ou données inutiles au frontend.

La configuration exacte dépend de la cible retenue et nécessite une validation
humaine. Aucune cible de production n’est définie dans le dépôt.

## Mettre à jour l’installation

```bash
npm ci
npm run lint
npm start
```

Tester ensuite un jeu de données représentatif. Toute évolution des
dépendances npm doit versionner ensemble `package.json` et `package-lock.json`,
puis aligner les URL correspondantes dans `index.html` tant que le projet
repose sur des CDN.
