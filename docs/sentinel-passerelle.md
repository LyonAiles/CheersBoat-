# Sentinel : reprise contrôlée sur le téléphone point d’accès

Objectif : récupérer une image avec VLC avant toute nouvelle affectation dans Nautic.
La découverte des caméras Tuya et l’authentification ont réussi. La lecture vidéo reste à valider.
Ne pas modifier les paramètres du point d’accès, de Tailscale ou des Tapo pendant cet essai.

## Préparer le correctif

Sur le Galaxy A20e, dans Termux, arrêter l’ancien serveur par Ctrl+C.
Les commandes suivantes conservent l’ancien exécutable et les identifiants déjà enregistrés.

```sh
cd ~/tuya-ipc-terminal &&
git fetch origin pull/33/head &&
git switch --detach FETCH_HEAD &&
go build -ldflags="-checklinkname=0" -o tuya-ipc-terminal-fixe .
```

Le point final est nécessaire. Ne continuer que si la compilation se termine sans erreur.
Ce correctif communautaire est encore proposé à l’intégration :
https://github.com/seydx/tuya-ipc-terminal/pull/33
Il corrige notamment la destination UDP, les profils HD/SD et les formats RTP.
Il n’est pas encore validé sur cet A20e avec ces Sentinel.

## Démarrer

```sh
cd ~/tuya-ipc-terminal
./tuya-ipc-terminal-fixe rtsp start --port 8556
```

Garder Termux ouvert et le téléphone alimenté pendant le test.

## Lire une seule caméra

Dans VLC, « Nouveau flux », sur le téléphone personnel relié à Tailscale :

```text
rtsp://100.112.74.86:8556/SVI0069_-_OutCam/sd
```

Sur le Galaxy A20e lui-même, l’adresse équivalente est :

```text
rtsp://127.0.0.1:8556/SVI0069_-_OutCam/sd
```

127.0.0.1 désigne toujours l’appareil sur lequel VLC est ouvert.
Le second modèle découvert a le chemin /SVI0069_-_OutCam_2/sd.
Vérifier visuellement quel côté chaque image montre avant de l’affecter à bâbord ou tribord.
La liste des caméras seule ne prouve pas que leur vidéo fonctionne.

## Décider selon le résultat

- Image stable : tester la seconde caméra, puis les deux simultanément avant intégration à Nautic.
- Pas d’image : arrêter le lecteur, puis Ctrl+C dans Termux. Conserver seulement les premières nouvelles lignes d’erreur après une tentative, en masquant les secrets.
- Ne pas réintroduire le flux dans le 41 avant résolution du précédent arrêt de Nautic.

L’accès au compte et la négociation Tuya utilisent Internet : cette passerelle n’est pas une solution autonome hors réseau.
