# Carte vectorielle et ouvrages fluviaux

Paramètres → Carte et ouvrages fluviaux : choix entre MapLibre et Carte classique.
Le moteur classique conserve son fond, son inclinaison et ses réglages. MapLibre
est utilisé par défaut dans cette version ; le choix classique reste mémorisé.
Un échec de chargement, une absence de WebGL ou une perte du contexte graphique
rend la carte classique visible sans changer le choix mémorisé. Pour réessayer,
sélectionner à nouveau MapLibre dans les paramètres ou dans le choix de carte.

MapLibre GL JS 5.6.1 et sa feuille de style sont chargés en HTTPS depuis unpkg.
Le fond vectoriel est Liberty d'OpenFreeMap, avec son attribution intégrée.
Le fond vectoriel n'est pas une carte officielle de navigation. Le chargement
initial exige Internet et un WebView avec WebGL. Les libellés vectoriels sont
alignés sur l'écran ; les libellés des anciens fonds raster restent incorporés
aux images. La trace du trajet et les ouvrages sont affichés dans les deux moteurs.
Le bateau reste au tiers inférieur de la carte, orientée selon le cap GPS filtré.

Les ouvrages proviennent d'OpenStreetMap via Overpass, pas d'un inventaire VNF.
Recherche réglable à 2, 5 ou 10 km ; récupération d'une marge de 1,5 km.
Les géométries du dernier périmètre sont conservées localement et la liste est
recalculée pendant le déplacement. Nouvelle requête après déplacement d'environ
un tiers du rayon (au plus 1 km), ou après 24 h ; délai minimum de 2 minutes entre
requêtes. Les erreurs gardent le cache existant avec indication de son usage.
Aucun paquet de cartes hors ligne ni cache couvrant tout un parcours n'est fourni.

Le calcul utilise un graphe non orienté des segments river/canal/fairway reliés
par leurs identifiants OSM. Le départ est projeté sur la voie la plus proche à
moins de 150 m, puis filtré selon le cap courant quand il est connu. Les distances
sont des plus courts chemins dans le périmètre récupéré. Sans raccordement,
la distance affichée est explicitement à vol d'oiseau. Les bifurcations ne sont
pas résolues sans itinéraire choisi : il peut y avoir plusieurs branches en avant.
Des voies mal raccordées ou manquantes dans OSM peuvent exclure des ouvrages.
Les ponts routiers et ferroviaires sont retenus s'ils croisent ou approchent la
voie d'eau. Les portes proches d'une écluse sont regroupées quand possible.

Dimensions et horaires ne sont affichés que s'ils sont renseignés dans OSM.
Les hauteurs ne sont pas corrigées du niveau d'eau du jour. Ne pas interpréter
l'absence d'une valeur comme une absence de restriction. La couverture locale,
le rendu WebGL et le coût graphique avec les caméras restent à tester à bord.

Contrôles : `node tools/navigation/waterways.test.cjs`. Les contrôles d'interface
ont aussi vérifié l'activation du moteur, l'alignement des textes et le repli après
perte WebGL avec un moteur simulé. Le rendu distant réel n'a pas été validé ici.

## Priorité aux gestes de carte

Pendant un geste tactile ou à la molette, Nautic suspend ses callbacks périodiques
(interface, suivi automatique, calcul d'ouvrages, actualisation des aperçus).
Les temporisations internes du moteur de carte restent actives pour traiter le geste.
Les lecteurs RTSP d'aperçu sont libérés en conservant leur dernière image ; la bordure
animée s'arrête aussi. Les lecteurs sont recréés après la fin du geste, avec un délai
normal de reconnexion vidéo. Reprise après 650 ms sans geste, y compris après annulation,
perte de focus ou passage en arrière-plan. Un garde-fou évite une pause permanente.
Le dernier résultat GPS reçu pendant le geste est traité à la reprise. L'écoute
native des alertes caméra reste active. La rotation utilisateur est mémorisée à chaque
événement de rotation, même si le moteur ne fournit pas originalEvent à la fin du geste.

## Catégories et rayon jusqu'à 100 km

Les paramètres proposent huit cases indépendantes : écluses, ports/marinas,
haltes/amarrages, ponts, barrages, seuils, tunnels et cales de mise à l'eau.
Le rayon géographique d'affichage est saisi de 1 à 100 km et conservé. Toutes les
directions autour du bateau sont incluses ; la sélection ne se limite plus à l'avant.
Les catégories décochées sont exclues de la requête et de l'affichage. Tout décocher
retire les points et ne lance aucune requête. Les valeurs de rayon sont bornées à
l'enregistrement et à la lecture.

Pour les grands rayons, Overpass renvoie seulement les centres des points distants.
Le graphe détaillé des voies d'eau est limité à environ 11,5 km autour du bateau.
La recherche des ponts est restreinte aux alentours des voies d'eau ; les centres
lointains restent approximatifs. Les distances lointaines sont donc à vol d'oiseau,
explicitement indiquées. Un réseau non raccordé n'exclut plus un ouvrage situé dans
le rayon : il apparaît avec sa distance de proximité. Les requêtes larges peuvent
être longues ou refusées par le serveur public ; le dernier cache reste disponible.
La couverture dépend des éléments renseignés dans OpenStreetMap.

MapLibre regroupe les points au dézoom. La carte classique ne crée des marqueurs
que pour la zone visible, regroupés en cellules de 45 pixels. Toucher un groupe
classique ouvre sa liste ; le bouton des ouvrages ouvre la liste générale. Chaque
liste affiche jusqu'à 200 entrées triées par distance. Aucun téléchargement massif
des géométries de toutes les rivières dans un rayon de 100 km n'est effectué.
