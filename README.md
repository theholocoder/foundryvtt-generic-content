# Lazybobcat - Generic Content

Module Foundry VTT orienté "préparation de session" : du contenu prêt à l'emploi (compendiums) + quelques outils légers
pour gagner du temps en impro.

## Ce que fournit le module

- Compendiums (packs) : journaux, scènes, cartes, playlists, tables aléatoires (ex : noms), etc.
- Pack "PNJ" : des acteurs prêts à utiliser (ciblé PF2e).
- Boîtes ProseMirror : un menu déroulant dans l'éditeur (journaux/pages) pour insérer des blocs HTML déjà stylés :
  - Narration
  - Citation
  - Jets de dés
  - Rencontre
  - Trésor
  - Investigation

## Compatibilité

- **Requis :** Foundry VTT (v13 minimum/validé)
- Optionnel : PF2e (système) pour les PNJ pré-configurés

## Développement (optionnel)

- Installer : `pnpm install`
- Dev : `pnpm dev`
- Vérif types : `pnpm check`
- Build : `pnpm build`
- Compendiums : `pnpm packs:pack` / `pnpm packs:unpack` / `pnpm packs:status`
