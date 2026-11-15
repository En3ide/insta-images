# Insta Images — Edge et Chrome, version 1.4.0

Téléchargement des photos et vidéos accessibles des posts, Reels et stories ouverts dans Instagram.

Mode sombre automatique sur AliExpress (.com, .us, .ru), Alibaba (.com), Amazon.fr, eBay.fr et Yeggi (.com), y compris leurs sous-domaines. Aucun clic sur l’extension n’est nécessaire. Le thème utilise une inversion des couleurs avec correction des images et vidéos ; certains visuels en arrière-plan peuvent apparaître différents.

## Installation et mise à jour

Cloner ce dépôt ou télécharger son ZIP depuis GitHub puis l’extraire. L’extension se trouve à la racine du dépôt ; aucune compilation et aucune installation npm ne sont nécessaires pour l’utiliser. Dans Chrome, utiliser `chrome://extensions` à la place de `edge://extensions`.

Ouvrir `edge://extensions`, activer **Mode développeur**, puis **Charger l’extension décompressée** et sélectionner ce dossier. Si elle est déjà installée, cliquer sur **Recharger** sur sa carte, puis actualiser les onglets concernés (Instagram ou sites avec mode sombre). Accepter l’accès aux sites si Edge le demande.

## Utilisation

1. Ouvrir un post, un Reel ou une story précise (URL `/stories/compte/identifiant/`).
2. Lancer la vidéo dans Instagram. Mettre la story en pause pour éviter le passage automatique à la suivante.
3. Ouvrir l’extension, sélectionner les médias et télécharger.
4. Pour un carrousel, afficher les médias suivants puis rouvrir l’extension. Les résultats sont conservés pour le dernier post pendant la session. Chaque story est traitée séparément.

Fichiers dans `Instagram/<identifiant>/` sous le dossier de téléchargement configuré dans Edge. Le message indique le lancement ; vérifier la réussite finale dans Edge.

## Limites

- Le compte connecté doit avoir accès au contenu. Pas de parcours automatique de profils, carrousels ou stories.
- Les MP4 sont recherchés dans les éléments vidéo et dans les métadonnées correspondant à l’identifiant exact du contenu.
- Pour une URL temporaire `blob:`, la recherche dans les métadonnées peut retrouver un MP4. Les flux segmentés DASH/HLS sans MP4 accessible ne sont pas reconstitués. Les pistes audio et vidéo séparées ne sont pas fusionnées ; un fichier proposé par Instagram peut ne pas contenir d’audio.
- Instagram peut modifier son HTML et ses métadonnées. La détection doit être vérifiée sur un compte réel. Vérifier les aperçus, surtout si plusieurs contenus sont à l’écran.
- Les URL expirent : réafficher le contenu et relancer l’analyse si nécessaire. La meilleure taille proposée dans le srcset est utilisée pour les photos, sans garantie d’obtenir le fichier original.
- Aucun serveur, aucune API privée, aucune lecture des mots de passe ou cookies. Permissions : activeTab, scripting, downloads et storage.session. L’analyse des métadonnées React se fait dans le contexte de la page sans modifier ses données.

## Vérifications

Tests simulés : `node --test tests/media.test.cjs`. Ils vérifient les filtres, les identifiants de stories, les métadonnées et les téléchargements.

Avec Node.js 20 ou plus récent : `npm test`. Aucune dépendance à installer.

Dans Edge, tester une photo, un carrousel mixte, un Reel avec audio, une story photo et une story vidéo. Vérifier le contenu, l’audio et la durée des fichiers reçus. Tester aussi un onglet hors Instagram et un changement de story pendant l’analyse.

Documentation : [installation Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads).
