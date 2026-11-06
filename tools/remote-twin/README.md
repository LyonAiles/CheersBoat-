# Jumelle distante — première étape

Le module Android se configure dans Paramètres → Liaison avec une jumelle distante.
Il reste désactivé par défaut. Aucune connexion n'est établie avant configuration.

## Transport préparé

- Même URL HTTPS et clé de jumelage aléatoire sur les deux appareils.
- Rôle À bord : PUT de l'état toutes les 5 secondes.
- Rôle À distance : GET du dernier état toutes les 5 secondes.
- Autorisation : `Authorization: Bearer <clé>` ; redirections refusées.
- Charge JSON : `protocol: nautic-twin-v1`, `sentAt` (millisecondes UTC),
  `camera42` et `camera44` contenant `active`, `status`, `alert`, `alertTime`.
- La clé est enregistrée dans les préférences privées Android, sans ajout aux paramètres du tableau de bord.
- Les dernières données reçues sont consultables en rouvrant la configuration du module ; leur ancienneté est affichée. Un état ancien n'est pas une preuve de connexion active.

## Relais fourni, à héberger séparément

`relay.py` fournit une paire par instance, stockage du dernier état en mémoire uniquement.
Lancer avec `NAUTIC_TWIN_TOKEN` (secret aléatoire de 24 caractères minimum) et, si nécessaire,
`NAUTIC_TWIN_PORT` (8787 par défaut). Il écoute uniquement sur 127.0.0.1.
Placer derrière un reverse proxy HTTPS avec certificat valide, limitation de débit et délais
pour les clients lents. Utiliser l'URL publique terminant par `/state` sur les deux Nautic.
Ne pas exposer directement le port HTTP. Aucun serveur n'est déployé par cette modification.
Chaque nouvelle paire exige une instance et une clé distinctes. Changer la clé sur le relais
et les deux appareils pour révoquer le jumelage. Un lecteur possédant cette clé peut aussi
écrire l'état : cette première version suppose les deux appareils de confiance.

## Limites actuelles

Ce module prépare le transport des états des veilles et de leur dernière alerte.
Il ne transmet pas les vidéos, les positions GPS, les données du sondeur, ni les commandes.
Il ne déclenche pas de notification à partir des données distantes et ne remplace pas
un service de notifications push. L'exécution en veille prolongée reste à valider sur
les appareils. Après arrêt du système, relancer Nautic pour reprendre le module.
Le relais doit recevoir un premier état de l'appareil à bord avant que le lecteur puisse le lire.
