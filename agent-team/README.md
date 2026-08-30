# Agent Team — Cursor → Codex

Cet orchestrateur construit une proposition dans un worktree Git détaché, fait contrôler le résultat par Codex, autorise au plus un retour automatique à Cursor (deux revues maximum), exécute les validations du projet, puis demande une décision indépendante à un second passage Codex. Il ne commit, n'applique, ne pousse et ne déploie rien.

## Commandes

```sh
npm run agents:check
npm run agents:mission -- "Décrire précisément la mission"
npm run agents:status -- <run-id>
```

Validation mécanique sans appeler les agents ni créer de worktree :

```sh
npm run agents:mission -- --dry-run "mission de validation"
```

Le lancement réel exige un dépôt principal totalement propre. Les résultats sont dans `.agent-runs/<run-id>/`, notamment `FINAL_REPORT.md`, `changes.patch`, les JSON de revue et les logs. Le worktree est conservé jusqu'à la décision manuelle d'Evan. La V1 ne comporte volontairement aucune commande d'application ou de nettoyage automatique.

`agents:status` est strictement en lecture seule. Un verdict `GO` signifie seulement « prêt à être examiné par Evan » : aucun changement n'est transféré au dépôt principal.

## Sécurité

Les fichiers dont le nom évoque un secret (`.env`, clés, credentials, tokens) et les contenus ressemblant à des secrets bloquent la transmission aux modèles. Cursor reçoit un garde de commandes et une sandbox limitée au worktree ; Codex s'exécute en lecture seule. Les commandes Git mutantes, GitHub et de déploiement sont interdites. Les validations ont un délai maximal et les journaux sont expurgés avant écriture.
