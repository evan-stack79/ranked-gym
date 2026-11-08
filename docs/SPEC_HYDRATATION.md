# SPEC_HYDRATATION — « Hydratation & Bouteille » (fiche Product v0)

**Statut :** **en attente Scientifique** — réponses Evan intégrées (8/11/2026). **Pas de code.** Vérificateur : C-HY1…3, C-HY5. Archi : détourage sur l’appareil après validation.
**Date :** 8/11/2026 · brief Studio Manager.
**Alignement :** RK-03 (zéro P2W) · RGPD (photo traitée sur l’appareil si possible).

## 1. En une phrase (pour Evan)
Le joueur prend en photo **sa** bouteille. L’app la découpe et l’affiche en dessin transparent qui se **vide** quand il boit. Sinon, il choisit une bouteille 2 L ou des verres d’eau.

## 2. Règles (numérotées)
| ID | Règle |
|----|-------|
| HY-01 | 3 modes : **Ma bouteille** (photo, **Ranked Pro**) · **Bouteille classique 2 L** (gratuit) · **Verres d’eau 250 ml** (gratuit). |
| HY-02 | Ajout rapide pour tous : boutons +1 verre / +½ bouteille / +bouteille entière, et annuler le dernier ajout. |
| HY-03 | Affichage : volume **restant** et **bu** en litres (ex. « 0,8 L restant »), niveau d’eau animé dans le dessin. |
| HY-04 | Objectif du jour **réaliste** : valeur par défaut + réglable par le joueur, dans une fourchette sûre **validée par le Vérificateur**. Jamais d’objectif extrême. |
| HY-05 | Ton **jamais injonctif** : pas de « bois plus ! », pas de honte, pas de rouge si objectif raté. Message neutre (« Bien joué », « Demain est un autre jour »). |
| HY-06 | Pas de récompense pour boire **au-delà** de l’objectif. Au-delà d’un plafond haut (à valider Vérificateur) : message doux d’information, pas de félicitation. |
| HY-07 | **Aucun lien** avec rang, Force, Discipline, points partenaires (RP) en v0. Tout lien futur = revue anti-P2W PM + Studio + GO Evan. |
| HY-08 | Photo bouteille : détourage **sur l’appareil** si possible ; photo brute **non envoyée** au serveur par défaut ; seule la forme découpée + volume sont gardés. Suppression possible à tout moment. |
| HY-09 | Si le détourage échoue : proposer de recadrer à la main, ou basculer sur le mode 2 L. Jamais bloquer le joueur. |
| HY-10 | Le joueur saisit le **volume** de sa bouteille (ex. 750 ml, 1 L, 1,5 L) ; l’app ne devine pas le volume depuis la photo en v0. |
| HY-11 | Rappels d’hydratation **dès la v0** : **désactivés par défaut**, opt-in, 3 max / jour, jamais la nuit. |
| HY-12 | **Seulement l’eau** est comptée (pas café, jus, sodas, ni eau des aliments). |
| HY-13 | « Ma bouteille » = avantage **Pro cosmétique uniquement** (look du dessin). 2 L + verres + ajout rapide + objectif + rappels + historique = **gratuits pour tous**. Aucun effet rang / Force / Discipline / points (RK-03, HY-07). |
| HY-14 | Emplacement (tranché Evan 8/11 12:10) : carte Eau sur l’**Accueil** **et** dans l’onglet **Alimentation**. Même donnée, même état partout (un « +1 » d’un côté se voit de l’autre). |
| HY-15 | Verre par défaut = **250 ml**. |

## 3. Écrans
1. **Carte Eau (Accueil + onglet Alimentation)** — dessin de la bouteille + litres restants + bouton « +1 ».
2. **Choix du mode** — 2 L · Verres (gratuits) · Ma bouteille (badge Pro ; si gratuit → écran Pro, aucune mention rang / points).
3. **Prise de vue guidée** — cadre en pointillés, conseils (« fond uni », « bouteille droite, entière »), bouton photo.
4. **Résultat détourage** — aperçu découpé + Valider / Refaire / Recadrer.
5. **Volume bouteille** — choix rapide 500 ml / 750 ml / 1 L / 1,5 L / autre.
6. **Objectif du jour** — valeur par défaut + curseur limité (fourchette Vérificateur).
7. **Historique simple** — 7 derniers jours en barres, sans note ni jugement.

## 4. Parcours
- **Premier lancement :** Accueil ou onglet Alimentation → Carte Eau → Choix du mode → (Pro, Ma bouteille : photo → détourage → volume) → objectif → rappels (oui / non) → prêt.
- **Tous les jours :** Accueil ou onglet Alimentation → Carte Eau → « +1 » (ou glisser le niveau) → le dessin se vide → litres mis à jour.
- **Changer de bouteille :** Réglages Eau → nouvelle photo ou autre mode ; l’historique reste.

## 5. MVP vs plus tard
| MVP (v0) | Plus tard (P1+) |
|----------|-----------------|
| Modes 2 L + verres 250 ml + ajout rapide (gratuit) | Plusieurs bouteilles enregistrées |
| Ma bouteille (Pro) : photo guidée + détourage on-device + volume saisi | Estimation du volume depuis la photo |
| Objectif par défaut + réglage borné | Objectif ajusté selon séance / chaleur (après Vérificateur) |
| Historique 7 jours | Widget iPhone / Dynamic Island eau |
| Rappels opt-in (3 max/j, pas la nuit) | Lien Apple Santé / Health Connect |
| — | Tout lien jeu (badge cosmétique) : seulement après revue anti-P2W |

## 6. Calculs à faire valider (Vérificateur — PM ne choisit pas)
- C-HY1 : objectif d’eau quotidien par défaut (fixe ou selon poids / activité ?).
- C-HY2 : fourchette min / max sûre du curseur objectif.
- C-HY3 : plafond haut déclenchant le message d’information (HY-06).
- ~~C-HY4~~ : tranché Evan — **seulement l’eau** (HY-12). À confirmer par le Vérificateur que l’objectif C-HY1 est bien exprimé « eau bue seule ».
- C-HY5 : ajustement séance de sport / chaleur — v0 ou plus tard ?

## 7. Réponses Evan (8/11/2026)
| Q | Réponse |
|---|---------|
| Q1 Carte Eau sur l’Accueil ? | **Oui** (correction 12:10) + aussi dans l’onglet **Alimentation** (HY-14) |
| Q2 Verre 250 ml ? | **Oui** (HY-15) |
| Q3 Rappels en v0 ? | **Oui** — opt-in, 3 max/j, jamais la nuit (HY-11) |
| Q4 Autres boissons ? | **Seulement l’eau** (HY-12) |
| Q5 Ma bouteille Pro ? | **Oui, Pro cosmétique** ; 2 L + verres gratuits ; aucun effet rang/points (HY-13) |

**Reste ouvert :** chiffres C-HY1…3, C-HY5 (Vérificateur).

## 8. Critères d’acceptation (CM2 — après code)
- CA-HY1 : Je prends ma bouteille en photo → je la vois découpée et transparente.
- CA-HY2 : J’appuie « +1 » → l’eau baisse dans le dessin et les litres changent.
- CA-HY3 : Sans photo et sans Pro, je peux utiliser la bouteille 2 L ou les verres de 250 ml.
- CA-HY9 : Je vois la carte Eau sur l’Accueil et dans l’onglet Alimentation ; si j’ajoute un verre sur l’une, l’autre affiche le même chiffre.
- CA-HY10 : Seule l’eau compte ; pas de bouton café / jus.
- CA-HY11 : Les rappels sont éteints au départ ; si je les allume, j’en reçois 3 max par jour et jamais la nuit.
- CA-HY12 : « Ma bouteille » change seulement le look ; un joueur Pro n’a pas plus de rang ni de points.
- CA-HY4 : Je ne peux pas régler un objectif extrême.
- CA-HY5 : L’app ne me gronde jamais si je bois moins.
- CA-HY6 : Mon rang, ma Force, ma Discipline et mes points ne bougent pas avec l’eau.
- CA-HY7 : Ma photo brute ne part pas sur internet (sauf choix clair de ma part).
- CA-HY8 : Si la découpe rate, je peux recadrer ou passer au mode 2 L.

## 9. Validation scientifique (Vérificateur, 8 novembre 2026)

Adultes de 18 ans et plus uniquement. Les choix de l'app ci-dessous ne sont pas des besoins à atteindre à tout prix. Aucune source ne donne une fourchette sûre pour tous.

| ID | Valeur retenue | Source (lien) | Statut |
|----|----------------|---------------|--------|
| C-HY1 | **1,5 L/j d'eau bue seule**, fixe et réglable. Pas de calcul selon le poids. Repère de départ, pas besoin mesuré. L'ANSES donne 1,5 à 2 L/j. Retirer les aliments des valeurs EFSA donne toutes les boissons, pas l'eau seule. | [ANSES](https://www.anses.fr/fr/article/eau-bouteille-eau-du-robinet-bonnes-pratiques-consommation), [EFSA](https://doi.org/10.2903/j.efsa.2010.1459) | VALIDÉ |
| C-HY2 | Curseur proposé **1,0 à 3,0 L/j**. Bornes de réglage, pas limites de santé. Le bas laisse une place aux autres boissons. Le haut évite de pousser vers de gros objectifs. L'IOM décrit 3,0 L/j de boissons chez les hommes. Preuve que ces bornes sont sûres pour tous : **non trouvé**. Ce n'est ni un minimum à boire, ni un maximum à ne pas dépasser. | [IOM](https://www.nationalacademies.org/read/10925/chapter/6) | VALIDÉ pour le réglage ; VETO pour « fourchette sûre » |
| C-HY3 | Message dès **3,0 L d'eau enregistrée par jour**. Choix de prudence de l'app, pas seuil de danger établi. Seuil officiel quotidien d'alerte pour l'eau seule : **non trouvé**. Aucun bonus au-delà de l'objectif. Pas d'alerte de débit en v0 : l'heure d'ajout ne prouve pas l'heure de consommation. | [IOM](https://www.nationalacademies.org/read/10925/chapter/6), [consensus 2015](https://journals.lww.com/cjsportsmed/fulltext/2015/07000/statement_of_the_third_international.2.aspx) | VALIDÉ pour l'information ; VETO pour un seuil médical |
| C-HY4 | Afficher **« Eau bue seule »**. Les aliments et les autres boissons apportent aussi de l'eau. Ils ne sont pas comptés ici. Ne pas afficher « besoins en eau couverts ». | [EFSA](https://doi.org/10.2903/j.efsa.2010.1459), [IOM](https://www.nationalacademies.org/read/10925/chapter/6) | VALIDÉ |
| C-HY5 | Ajustement sport et chaleur en **P1**. En v0, texte neutre seulement. Pas de calcul de sueur ni d'ajout automatique. Les pertes varient beaucoup. L'ACSM recommande un plan individuel. Le consensus conseille la soif pour éviter de trop boire. Boire au point de prendre du poids pendant l'effort est à éviter. | [ACSM, texte repris sur Medscape](https://www.medscape.com/viewarticle/717055_6), [consensus 2015](https://journals.lww.com/cjsportsmed/fulltext/2015/07000/statement_of_the_third_international.2.aspx) | PLUS TARD pour le calcul ; VALIDÉ pour le texte |

### Limites et messages
- Mineurs exclus. Ce suivi ne donne pas de conseil médical et ne vérifie pas ton état de santé.
- Grossesse ou allaitement : « Pour un repère adapté, tu peux en parler à ta sage-femme ou à ton médecin. » Pas de cible chiffrée proposée ici.
- Restriction d'eau prescrite, notamment pour une maladie du cœur ou des reins : « Si un médecin t'a donné une limite, suis-la. » Le curseur ne remplace pas cette limite.
- La soif peut être moins nette avec l'âge. L'ANSES conseille aussi de boire avant d'avoir soif. La phrase sur la soif n'est donc pas une règle pour tous.

Message haut : « L'objectif est un repère, pas un défi : boire plus n'apporte aucun bonus, et les besoins varient selon la journée. »
Message permanent : « Les aliments et les autres boissons apportent aussi de l'eau ; ils ne sont pas comptés ici. »
Message sport et chaleur : « Pendant le sport et quand il fait chaud, tu peux boire selon ta soif, sans chercher à finir l'objectif. » Ce texte ne remplace pas un plan adapté à un effort long ou intense.

### Sources vérifiées et chiffres exacts
- [EFSA 2010, Scientific Opinion on Dietary Reference Values for water, 8(3):1459](https://doi.org/10.2903/j.efsa.2010.1459). Eau totale : **2,0 L/j femmes ; 2,5 L/j hommes**. Aliments : **20 à 30 %** ; boissons : **70 à 80 %**. Température et activité modérées. Calcul à partir de ces chiffres : **1,4 à 1,6 L/j** de boissons chez les femmes et **1,75 à 2,0 L/j** chez les hommes. Avec seulement 20 % d'aliments : **1,6 et 2,0 L/j**. Ces résultats incluent toutes les boissons, pas seulement l'eau. Ils ne prouvent pas un besoin d'eau seule de 1,5 L/j. Texte consulté via WebSearch ; ouverture directe expirée.
- [IOM/NASEM, Dietary Reference Intakes, chapitre Water](https://www.nationalacademies.org/read/10925/chapter/6). Rapport annoncé en **2004**, livre affiché **2005**. Résumé pour les adultes de **19 à 30 ans** : eau totale **2,7 L/j femmes ; 3,7 L/j hommes** ; boissons **2,2 et 3,0 L/j** ; aliments **19 %**, boissons **81 %**. Pas de limite supérieure fixée. Capacité maximale d'excrétion rénale citée : **0,7 à 1,0 L/h**. Ce n'est ni un débit conseillé ni une garantie de sécurité, surtout pendant l'effort. Un apport inférieur au repère ne signifie pas à lui seul un manque d'eau.
- [ANSES, Eau en bouteille ou eau du robinet : bonnes pratiques de consommation](https://www.anses.fr/fr/article/eau-bouteille-eau-du-robinet-bonnes-pratiques-consommation). Texte exact : « un minimum de **1,5 à 2 litres d'eau par jour** (pour les adultes) et avant même d'avoir soif ». Ce conseil grand public n'est pas une cible adaptée à chaque personne.
- [Manger Bouger, Comment rythmer sa journée autour de 3 repas ?](https://www.mangerbouger.fr/manger-mieux/se-faire-plaisir-en-mangeant-equilibre/manger-equilibre-ca-veut-dire-quoi-et-comment-y-arriver/comment-rythmer-sa-journee-autour-de-3-repas). « De l'eau à volonté » à table ne veut pas dire boire sans limite. [La déshydratation](https://www.mangerbouger.fr/manger-mieux/a-tout-age-et-a-chaque-etape-de-la-vie/adultes-de-plus-de-75-ans/la-deshydratation) donne **1 à 1,5 L/j**, mais sur une page pour les personnes de **plus de 75 ans**. Même chiffre pour tous les adultes sur ces pages : **non trouvé**.
- [Sawka et al., ACSM 2007, Exercise and Fluid Replacement](https://journals.lww.com/acsm-msse/Fulltext/2007/02000/Exercise_and_Fluid_Replacement.22.aspx?WT.mc_id=HPxADx20100319xMP), [texte intégral repris par Medscape](https://www.medscape.com/viewarticle/717055_6). Plan individuel, pas de débit unique pour tous. Le tableau relie la surconsommation avec prise de poids au risque de baisse du sel dans le sang. Une formule selon le poids existe pour préparer un effort : **5 à 7 mL/kg au moins 4 h avant**. Ce n'est pas une formule quotidienne d'eau seule. Formule officielle quotidienne d'eau seule en mL/kg validée pour tous les adultes dans les sources retenues : **non trouvé**. Cela ne prouve pas que toute formule selon le poids est sans valeur. Une fiche officielle [ANSM, contexte de perfusion](https://agence-prd.ansm.sante.fr/php/ecodex/rcp/R0407268.htm) cite **25 à 35 mL/kg** d'apport hydrique quotidien adulte. Ce contexte médical ne valide pas un objectif d'eau seule pour l'app.
- [Hew-Butler et al., consensus 2015, Clin J Sport Med](https://journals.lww.com/cjsportsmed/fulltext/2015/07000/statement_of_the_third_international.2.aspx). Boire au-delà des pertes de sueur et d'urine est le mécanisme principal de l'hyponatrémie liée à l'effort, une baisse du sel dans le sang. La soif aide à éviter cet excès. Pas de seuil quotidien universel d'eau seule. Texte consulté via WebSearch ; ouverture directe expirée.
