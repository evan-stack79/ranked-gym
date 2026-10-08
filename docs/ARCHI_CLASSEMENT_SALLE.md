# Classement de ma salle : garder le moins de données possible

Auteur : Architecte Système. Date : 08/10/2026 (v2 : Google Places à la place d'OpenStreetMap). Statut : proposition, rien n'est codé (GO d'Evan obligatoire).
Répond aux questions C2, C3, C4 et C5 de `SPEC_CLASSEMENT_SALLE.md`.
Les chiffres marqués « réglage de départ » sont des choix techniques, **non sourcés**, à ajuster pendant la bêta.

## En bref pour Evan
1. Ta position ne quitte jamais ton téléphone. C'est le téléphone qui calcule si tu es près de la salle.
2. Le serveur reçoit juste : « ce compte, cette salle, ce jour, présence validée ». Pas l'heure, pas la position.
3. Le classement se met à jour une fois par nuit. Personne ne peut deviner qui vient d'arriver.
4. Les présences sont effacées après 2 mois. Si tu supprimes ton compte, tout part avec.
5. Les salles viennent de Google. On garde seulement le numéro Google de la salle. Le service s'arrête tout seul avant de devenir payant, et on peut alors ajouter sa salle à la main.

## 1. Vérifier la présence (C2)
- Le contrôle se fait **sur le téléphone**. L'app demande la position une seule fois, au moment de l'appui sur « Je suis à la salle ». Elle ne la demande jamais en arrière-plan.
- Le téléphone reçoit le point de la salle (gardé 30 jours au plus, voir §3.2) et le compare à sa position. Il envoie ensuite au serveur seulement « oui » ou « non ». Les coordonnées ne sont jamais envoyées, jamais enregistrées et jamais écrites dans les journaux d'erreurs.
- **Distance** : on accepte si (distance jusqu'à la salle − précision donnée par le téléphone) ≤ 150 m. Les 150 m sont un réglage de départ.
- **Position imprécise à l'intérieur** : si le téléphone donne une précision plus large que 500 m (réglage de départ), on ne refuse pas et on ne valide pas. On affiche : « Position pas assez précise. Réessaie près de l'entrée. » La personne peut réessayer, sans limite et sans reproche.
- **Triche** : un contrôle fait sur le téléphone peut être trompé. On l'accepte, parce que ça protège la vie privée. Le gain d'une triche reste petit : 1 séance par jour et 2 par semaine au maximum (règle du Vérificateur).

## 2. Ce qu'on garde (C3)
| Donnée | Où | Visible par les autres ? | Combien de temps |
|---|---|---|---|
| Salle choisie (numéro Google `place_id`, ou numéro d'une salle ajoutée à la main) | profil | non, seulement « membre du classement de cette salle » | jusqu'au changement de salle ou à la suppression du compte |
| Présence : compte, salle, **date du jour** (sans heure), validée oui | table à part | non | 60 jours (réglage de départ, assez pour l'onglet Mois), puis effacée automatiquement |
| Pseudo et avatar de l'app | entrée du classement | oui, dans sa salle | jusqu'à « Quitter le classement » |
| Points de la semaine et du mois | calculés chaque nuit | oui | recalculés, rien n'est gardé à part |
| Accord pour la position (oui/non + date) | réglages | non | tant que le compte existe |
| Point de la salle Google | fiche de la salle | non | 30 jours au maximum (règle Google), puis effacé |

**Jamais gardé** : la position de la personne (latitude, longitude), la distance, la précision, l'heure d'arrivée, l'adresse IP liée à une présence, le nom et l'adresse venant de Google.

## 3. La liste des salles : Google Places (C4)
Sources vérifiées le 08/10/2026 : [prix Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing), [facturation Places API](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing), [champs et prix](https://developers.google.com/maps/documentation/places/web-service/data-fields), [règles Places API](https://developers.google.com/maps/documentation/places/web-service/policies), [conditions EEE](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms), [usages permis EEE](https://cloud.google.com/terms/maps-platform/eea-places-api-permitted-uses). Evan facture depuis la France, donc ce sont les **conditions EEE** (Espace économique européen) qui s'appliquent.

### 3.1 Les demandes les moins chères
| Étape | Demande Google | Partie gratuite par mois |
|---|---|---|
| La personne tape le nom de sa salle | Autocomplete (New), avec un « jeton de session » et un filtre sur le type « gym » | Gratuit sans limite si la session finit par un choix (Autocomplete Session Usage). Sinon, chaque frappe compte : 10 000 gratuites (Autocomplete Requests) |
| Elle choisit une salle | Place Details avec **seulement** `location` et `formattedAddress` (niveau Essentials) | 10 000 |
| Afficher le nom de la salle | `displayName` est au niveau **Pro**, plus cher | 5 000 |

Règles pour rester dans le gratuit :
- On ne demande jamais d'autres champs (photos, avis, horaires, téléphone). Un seul champ Pro fait passer toute la demande en Pro.
- On attend que la personne ait tapé au moins 3 lettres et qu'elle s'arrête un court instant avant d'interroger Google.
- Un nouveau jeton de session à chaque recherche, jamais réutilisé. Sinon Google facture chaque frappe.
- Les appels à Google passent par notre serveur, pas directement par le téléphone :
  - la clé n'est jamais dans l'app ;
  - on limite le nombre de recherches par personne et par jour (réglage de départ : 20) ;
  - Google ne voit pas l'adresse internet de la personne.

### 3.2 Ce que Google nous laisse garder
| Donnée Google | Droit | Ce qu'on fait |
|---|---|---|
| Numéro de la salle (`place_id`) | Peut être gardé **sans limite** | C'est la clé du classement de la salle |
| Point de la salle (latitude, longitude) | **30 jours de suite au maximum**, puis à effacer | Gardé 30 jours au plus. Ensuite on l'efface, et on le redemande seulement quand quelqu'un valide sa présence |
| Nom, adresse | Pas d'exception à la règle « ne pas garder » | Jamais enregistrés sur notre serveur. Le nom est redemandé quand on ouvre le classement et reste en mémoire seulement pendant que l'app est ouverte |

### 3.3 Autres règles Google à respecter
- **Logo « Google Maps »** à côté de la liste de recherche et du nom de la salle (taille et style imposés par Google).
- **Pas de carte** à côté du nom ou de l'adresse venant de Google (règle EEE). Seuls le point et le numéro de la salle peuvent aller sur une carte. Notre classement n'a pas de carte : c'est bon.
- **Usage permis** : en EEE, le contenu Google Places n'est permis que pour une liste d'usages précis. Le choix de la salle relève de « la recherche et l'autocomplétion d'adresses ». L'affichage du nom dans le classement se rapproche de « un lieu comme objectif dans un jeu » ou « identifier un lieu dans une plateforme sociale ». **C'est mon interprétation, pas un avis juridique.** À relire avant la bêta.
- Nos conditions d'utilisation et notre politique de confidentialité doivent renvoyer à celles de Google. Google devient un service tiers à citer dans la politique de confidentialité, car le texte tapé dans la recherche lui est envoyé.

### 3.4 Ne jamais payer sans le vouloir
- **Quotas par jour** dans la console Google, pour chaque demande. C'est le quota qui **coupe** le service. Une alerte de budget, elle, prévient seulement. Réglages de départ, sous la partie gratuite (environ 30 jours par mois) :
  - Autocomplete Requests : 300 par jour ;
  - Place Details Essentials : 300 par jour ;
  - Place Details Pro : 150 par jour.
- **Alertes de budget** à 1 € et à 5 €, envoyées à Evan, en plus des quotas.
- Clé limitée à **Places API (New) seulement**, gardée sur le serveur. Elle n'est jamais écrite dans le code, ni dans le chat.
- Google exige une carte bancaire pour ouvrir le service. C'est Evan qui crée le compte de facturation : personne d'autre ne peut le faire à sa place.

### 3.5 Si le quota est atteint, ou si la salle n'est pas trouvée
- **Recherche coupée** : on affiche « La recherche est en pause. Réessaie demain, ou ajoute ta salle à la main. » L'app ne plante jamais.
- **Nom indisponible** : le classement marche quand même (il repose sur le numéro de la salle). L'en-tête affiche « Ma salle » à la place du nom.
- **« Ajouter ma salle à la main »** :
  1. La personne écrit le nom et la ville. Le nom est vérifié comme un pseudo et peut être signalé.
  2. Pour placer la salle, elle appuie sur « Je suis dans cette salle » une fois sur place. Le point est enregistré comme **point de la salle**. On ne garde pas qui l'a créée.
  3. Une salle ajoutée à la main a un classement seulement à partir de 3 membres, comme les autres. Ça évite de créer une fausse salle chez soi pour gagner.
  4. Les salles ajoutées à la main ne viennent pas de Google : pas de limite de 30 jours ni de logo Google pour elles.

## 4. Délais et changement de salle (C5)
- **Mise à jour du classement** : une fois par nuit, pas en direct. La présence du jour compte dès le lendemain. Il reste un petit risque : on peut voir que les points d'un pseudo ont bougé « hier ». C'est accepté, parce que l'heure et le jour exact ne sont jamais montrés.
- **Changer de salle** : 1 fois par 30 jours (réglage de départ). Les points ne suivent pas : on repart de 0 dans la nouvelle salle. Ça évite de passer d'une salle à l'autre pour gagner.
- **Pas de classement** si la salle compte moins de 3 membres (réglage de départ). Sinon, on sait trop facilement qui est qui.

## 5. Effacer (RGPD)
- **Quitter le classement** : le pseudo et les points disparaissent tout de suite. Les présences sont effacées.
- **Retirer l'accord pour la position** : on arrête de valider. Les présences déjà faites restent jusqu'à leur effacement après 60 jours, ou jusqu'à « Quitter le classement ».
- **Supprimer le compte** : la salle choisie, les présences, le pseudo et l'entrée du classement sont effacés. Ça s'ajoute à la correction du risque R-03 de `AUDIT_FIABILITE.md`, qui doit couvrir ces nouvelles tables.
- **Export des données** (R-03) : il doit contenir la salle choisie et la liste des présences (dates).
- Ajouter ces données à la politique de confidentialité et au registre des traitements avant la bêta.

## 6. Ancien système de salle (lien avec C6)
Si l'Ingénieur Développeur trouve d'anciennes positions enregistrées (coordonnées, historique de passages), il faut :
1. le dire avant tout code ;
2. ne plus jamais les lire ;
3. prévoir de les effacer dans une PR brouillon à part, avec le GO d'Evan.

## 7. Copie sur le cloud (lien avec R-04)
Une présence validée sans internet est gardée sur le téléphone avec sa date, puis envoyée plus tard. Le serveur accepte au maximum 1 présence par compte, par salle et par jour. Un envoi en double ne compte donc qu'une fois. Une présence vieille de plus de 7 jours (réglage de départ) est refusée.
