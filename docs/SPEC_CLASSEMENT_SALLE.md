# Fiche produit : « Classement de ma salle »

Auteur : Product Manager Santé & Fitness. Date : 08/10/2026. Statut : à valider (maquette avant tout code, GO d'Evan obligatoire). Mise à jour 08/10 17 h 20 : réponses C1 à C5, barème des points et textes C7 intégrés.
Modèle visuel : `/workspace/ranked_gym/maquettes/classement_salle_reference.jpg` (podium 1-2-3 puis liste).
Règles liées : SPEC_SECURITE.md, SEC-COM-01 à 05, SEC-COM-07 et 08, SEC-DON-02, SEC-MOD-01.

## En bref pour Evan
1. Dans Train, un bouton ouvre le classement de ta salle, avec un podium.
2. Tu choisis ta salle, puis tu appuies sur « Je suis à la salle » quand tu y es.
3. L'app regarde ta position à ce moment-là seulement, et ne la garde pas.
4. Personne ne voit qui est à la salle en ce moment.
5. Tu entres dans le classement si tu veux, avec un pseudo, et tu en sors quand tu veux.

## 1. Le parcours
1. **Entrée** : une carte « Classement de ma salle » dans l'onglet Train.
2. **Choisir sa salle** : on cherche par nom ou par ville. On peut changer de salle (le rythme des changements est à faire valider, voir §6).
3. **Rejoindre le classement** : un écran explique les règles, avec deux boutons de même taille : « Rejoindre avec un pseudo » et « Pas maintenant ». Rien n'est coché d'avance (SEC-COM-03).
4. **Valider sa présence** : un bouton « Je suis à la salle ». L'app vérifie que tu es proche de la salle choisie, puis la séance du jour compte pour le classement de cette salle.
5. **Voir le classement** : le podium (1, 2, 3), puis la liste. Ta ligne est mise en avant, même si tu n'es pas dans le haut.

## 2. L'accord pour la position (vrai choix oui ou non)
- **Quand** : la première fois que tu appuies sur « Je suis à la salle », jamais à l'ouverture de l'app ni au premier lancement.
- **Écran de l'app avant la fenêtre de l'iPhone** :
  - Titre : « Vérifier que tu es à la salle ? »
  - Texte : « On regarde ta position une seule fois, au moment où tu appuies. On vérifie juste si tu es près de ta salle, puis on oublie ta position. Personne ne la voit. »
  - Deux boutons de même taille et de même couleur : « Oui, vérifier » et « Non merci ».
- **Si « Non merci »** : l'app marche comme avant. Tu peux voir le classement et faire tes séances. Seules tes séances ne comptent pas dans le classement de la salle. On ne redemande pas à chaque séance. Le choix se change dans les Réglages.
- **Si oui** : la fenêtre de l'iPhone s'affiche. Si l'iPhone refuse, on montre le même résultat que « Non merci », avec un lien vers les Réglages, sans reproche.
- **Retirer son accord** : dans Réglages > Confidentialité, à tout moment. C'est aussi simple que de le donner.
- Phrase ajoutée (Vérificateur, C7) : « On garde seulement le jour où tu es venu(e) à ta salle, sans l'heure, pendant 2 mois. » Si la durée change dans `ARCHI_CLASSEMENT_SALLE.md`, cette phrase change aussi.
- Phrase validée (C7) : « Tu peux changer ce choix quand tu veux dans les réglages. »
- Le texte final passe par le Vérificateur Scientifique (SEC-TON-04).

**Écran des règles** (avant « Rejoindre avec un pseudo »), texte du Vérificateur :
« Chaque séance validée à la salle rapporte des points, 2 séances par semaine au maximum. Venir plus ne rapporte pas plus : le repos fait partie de l'entraînement. Tu ne perds jamais de points si tu te reposes, si tu es malade ou blessé(e). Ton poids, ton corps et tes charges ne comptent jamais. »
Phrases validées (C7) : « Réservé aux 18 ans et plus. », « Les autres voient seulement ton pseudo, ton avatar, tes points et ta salle. », « Tu peux quitter le classement quand tu veux. »

## 3. Ce qui est montré et ce qui est caché
**Montré** : pseudo, avatar de l'app, rang, points du classement, et la salle (en haut de l'écran).
**Jamais montré** :
- qui est à la salle en ce moment, ni « vu il y a X minutes », ni l'heure des passages ;
- une carte avec des personnes, ou une distance entre les gens ;
- le vrai nom (sauf si la personne l'a choisi comme pseudo), le poids, les calories, le corps, l'Effort, le sommeil (SEC-COM-01, SEC-DON-02) ;
- une photo de profil prise de l'appareil photo. On utilise l'avatar de l'app, pour éviter les photos du corps (SEC-COM-08).

**Délai d'affichage** : le classement ne se met pas à jour en direct au moment où quelqu'un valide, pour qu'on ne puisse pas deviner qui vient d'arriver. Le délai exact est à faire valider (§6).

## 4. Les points (réponse du Vérificateur à C1, 08/10/2026)
- Les points viennent seulement des séances validées à la salle. Jamais des charges, du volume, du poids ou du corps.
- **1 séance validée = 1 point** (validé par le Studio Manager, 08/10). Donc au maximum 2 points par semaine.
- **Au maximum 1 séance compte par jour** (VALIDÉ).
- **Au maximum 2 séances comptent par semaine**, pour tout le monde. Une séance en plus rapporte 0 point. Le chiffre 2 vient de l'OMS 2020 (minimum conseillé de renforcement musculaire). L'utiliser comme limite est un choix de prudence, non sourcé (Vérificateur, `REPONSES_VALIDATION_SECURITE.md` §9).
- La limite ne dépend pas de l'objectif choisi par la personne.
- Onglets « Semaine » et « Mois » seulement, pas d'onglet « Jour » (VALIDÉ). Pas d'onglet « Monde » dans cette version.
- **Égalités** : même rang pour les ex aequo. On ne les départage jamais avec les charges, le volume ou l'heure d'arrivée.
- On ne perd jamais de points à cause du repos, d'une maladie ou d'une blessure. Pas de message « tu vas perdre ta place ». Pas de notification « quelqu'un t'a dépassé ».
- **Conséquence pour la maquette** : avec cette limite, beaucoup de gens seront à égalité tout en haut, surtout sur « Semaine ». Le podium doit savoir montrer plusieurs personnes à la même place, par exemple « 1er · 12 personnes » avec les avatars groupés, au lieu d'un seul gagnant. À montrer à Evan sur la maquette.
- **Podium affiché sur l'onglet « Mois »** (validé par le Studio Manager). En « Semaine », il y a au plus 2 points, donc pas de vrai podium à 3 marches.

## 5. Qui peut participer, et la sécurité
- **Majeurs seulement** : les comptes de moins de 18 ans ne sont pas dans le classement et ne le voient pas (SEC-COM-04).
- **Sortir du classement** : un bouton « Quitter le classement ». Le pseudo disparaît de la liste, sans trace (SEC-COM-07).
- **Masquer** : on peut cacher tous les classements de l'app et ne voir que ses propres progrès (SEC-COM-07).
- **Signaler** un pseudo choquant (SEC-MOD-01). Le pseudo est vérifié avant d'être affiché.
- **Salle ajoutée à la main** : son nom est écrit par une personne, donc il suit les mêmes règles que les pseudos (vérifié avant affichage, signalable).
- **Triche** : sans valider sa présence, une séance ne compte pas pour la salle. On ne fait pas d'autre contrôle de position en arrière-plan.

## 6. À faire valider
| N° | Question | Pour qui |
|---|---|---|
| C1 | Points. **Répondu** : 1 séance par jour max, 2 par semaine max, ex aequo jamais départagés (voir §4). | Vérificateur Scientifique |
| C2 | **Répondu** dans `ARCHI_CLASSEMENT_SALLE.md` (chiffres de départ non sourcés, ajustés en bêta). Question d'origine : Distance pour dire « tu es à la salle », et quoi faire quand la position de l'iPhone est imprécise à l'intérieur. Aucun chiffre n'est fixé ici. | Architecte Système |
| C3 | **Répondu** dans `ARCHI_CLASSEMENT_SALLE.md` : position vérifiée dans le téléphone, on garde la salle et le jour sans l'heure, effacés après 2 mois. Question d'origine : Ce qu'on garde : seulement « présence validée oui ou non + date + salle », jamais les coordonnées. Durée de conservation, RGPD. | Architecte Système |
| C4 | **Répondu** dans `ARCHI_CLASSEMENT_SALLE.md` : Google Places, limite par jour avant la partie payante, numéro de salle gardé, nom et adresse jamais gardés. Si la limite est atteinte : « Ajouter ma salle à la main ». Reste : compte Google à ouvrir par Evan, et avis juridique sur l'affichage du nom en Europe. | Architecte Système, Evan |
| C5 | **Répondu** dans `ARCHI_CLASSEMENT_SALLE.md` : mise à jour une fois par nuit, 1 changement de salle par mois, au moins 3 membres par salle. Question d'origine : Délai avant que le classement se mette à jour, et rythme de changement de salle. Aucun chiffre n'est fixé ici. | Architecte Système |
| C6 | Ce qui reste de l'ancien système de salle dans le code. | Ingénieur Développeur |
| C7 | **Validé** : tous les textes du §2, avec « venu(e) ». | Vérificateur Scientifique |
| C8 | **Validé** : Evan aime la maquette (08/10). Suite : PR brouillon sans Google, recherche Google éteinte tant qu'il n'y a pas de clé. | Evan |

## 7. Comment savoir si ça marche (bêta)
Part des personnes qui rejoignent le classement, part qui disent « Non merci » à la position, part qui quittent le classement, signalements de pseudos. Aucun objectif chiffré n'est fixé : on regarde d'abord les vrais chiffres.
