# Bouton métal liquide — `MetalButton`

Un bouton pilule noir cerclé d'un anneau de métal liquide animé (shader WebGL2), avec une variante ronde pour les boutons icônes, un logotype texte rempli du même métal, et un enveloppeur générique `Metal` pour n'importe quel contrôle.

## Installation

Copier le dossier `web-metal-button/` dans le projet (React 19, Next.js, Vite, Remix…).

```bash
npm i metal-fx
```

## Utilisation

```tsx
import { MetalButton, MetalWordmark, Metal } from './web-metal-button/MetalButton';

<MetalWordmark font="700 64px/1 Inter, sans-serif">Northwind</MetalWordmark>
<MetalButton onClick={start}>Start free trial</MetalButton>
<MetalButton preset="gold" shape="circle" aria-label="Generate" />
<Metal preset="silver"><a className="my-cta" href="/signup">Sign up</a></Metal>
```

## Props

| Prop | Type | Défaut | Description |
| --- | --- | --- | --- |
| `MetalButton.children` | `ReactNode` | 'Get started' | Libellé. |
| `MetalButton.icon` | `ReactNode | null` | étincelle | Icône après le libellé ; `null` pour aucune. |
| `MetalButton.shape` | `'pill' | 'circle'` | 'pill' | Pilule ou rond (icône seule, donner un `aria-label`). |
| `preset` | `'chromatic' | 'silver' | 'gold'` | 'chromatic' | Teinte du métal. |
| `strength` | `number` | 0.9 | Intensité 0..1. |
| `theme` | `'auto' | 'light' | 'dark'` | 'auto' | `auto` suit `data-theme` sur <html> puis le système. |
| `MetalButton.…` | `ButtonHTMLAttributes` | — | Tous les attributs de <button> (onClick, disabled…). |
| `MetalWordmark.children` | `string` | 'Northwind' | Texte du logotype. |
| `MetalWordmark.font` | `string` | 700 64px/1 system-ui | Raccourci CSS `font`. |
| `MetalWordmark.color` | `string` | selon thème | Couleur de base sous le métal. |
| `MetalWordmark.metalOpacity` | `number` | 0.9 | Part de métal visible. |
| `MetalWordmark.glow` | `boolean` | false | Halo autour des glyphes. |
| `Metal.variant` | `'button' | 'circle'` | 'button' | Forme de l’anneau. |
| `Metal.normalizeHost` | `boolean` | false | Laisser metal-fx neutraliser le fond / bordure de l’enfant. |

## Personnalisation

`--tk-metal-bg` (#000), `--tk-metal-fg` (#fafafa), `--tk-metal-height` (44px), `--tk-metal-focus` (#3b6cff), à poser sur `.tk-metal-btn__host`.

Thème : clair par défaut, sombre via `prefers-color-scheme: dark` ou `data-theme="dark"` sur `<html>` (`data-theme="light"` force le clair).

## Accessibilité

Vrai `<button>` (clavier, focus). Anneau de focus visible sur l'hôte (`:focus-within`). Sous reduced motion l'anneau est figé (`paused`) et metal-fx coupe lui-même ses animations. Le logotype reste du texte réel.

## Compatibilité navigateurs

Effet complet là où WebGL2 est disponible (Chrome, Edge, Safari 17+, Firefox). Sinon, ou avant hydratation, le bouton / le texte s'affiche sans métal. Composant SSR-safe : aucun accès à `window` / `document` hors effets.

## Crédits et licences

metal-fx (licence du paquet npm `metal-fx`, voir son dépôt).
