# RFC — `modal_stack` gem

| | |
|---|---|
| **Auteur** | Metalzoid (gagnaire.flo@gmail.com) |
| **Date** | 2026-04-26 |
| **Statut** | Draft — implémentation à venir |
| **Cible** | Ruby on Rails 7.2+ / Ruby 3.2+ |
| **Licence** | MIT |
| **Repo cible** | `github.com/metalzoid/modal_stack` |

---

## 1. Résumé

`modal_stack` est une gem Rails qui ajoute une **navigation stack** par-dessus Hotwire. Elle permet d'empiler N modals, drawers et bottom sheets, avec deep-linking du **top du stack** via une URL Rails native, une gestion complète de l'historique navigateur (back/forward), un support de wizard multi-étapes, et une intégration profonde avec Turbo Streams.

Là où `ultimate_turbo_modal` (l'état de l'art actuel) gère bien **une** modal avec history, `modal_stack` gère **un stack** de modals avec navigation arrière étape-par-étape, le tout avec des actions Turbo Stream impératives (`modal_push`, `modal_pop`, `modal_replace`).

**Limite assumée** : l'URL encode le top du stack, pas l'ensemble. Voir §6.1 pour le détail (deep-linking complet pour les stacks nested, top-only pour les "fork stacks").

---

## 2. Motivation

### Le pain point
Toutes les apps SaaS Rails finissent par buter sur :
- **Empilement** : ouvrir une modal "créer un client" depuis une modal "créer une facture" sans tout casser (z-index, focus trap, scroll lock).
- **Wizards intra-modal** : un onboarding 4 étapes dans un drawer, où le bouton "retour" doit revenir à l'étape précédente, pas fermer le drawer.
- **Deep-linking** : partager `/projects/42/edit?tab=billing&step=plan` et reconstruire le bon stack.
- **Back natif** : l'utilisateur fait <kbd>cmd</kbd>+<kbd>←</kbd>, ça doit faire ce qu'il attend.

Aujourd'hui chaque app réinvente ça avec des bouts de Stimulus. Le résultat est fragile (focus trap qui leak, scroll lock qui coince, history qui drift).

### Pourquoi maintenant
- Turbo 8 (page morphing, scroll preservation) débloque des patterns invisibles avant.
- View Transitions API native dans Chrome/Safari/Firefox 2026 → animations fluides sans gros JS.
- `<dialog>` natif HTML enfin stable cross-browser → focus trap + ESC gratuits.
- Idiomorph permet de muter le DOM sans tout démonter.

### Différenciateur vs `ultimate_turbo_modal`
| Capacité | UTM | modal_stack |
|---|---|---|
| 1 modal + history | ✅ | ✅ |
| `<dialog>` natif + focus trap | ✅ | ✅ |
| Drawer | ✅ | ✅ |
| **Stack N modals** | ❌ | ✅ |
| **Wizard multi-step intra-modal** | ❌ | ✅ |
| **Back nav step-par-step** | ❌ | ✅ |
| **Bottom sheet mobile** | ❌ | ✅ |
| **Turbo Stream actions impératives** | partiel | ✅ |
| **State strategies pour wizard** | ❌ | ✅ |

---

## 3. Objectifs / Non-objectifs

### Objectifs
- API ergonomique en 3 lignes pour les cas simples.
- Stack illimité (limite hard à 5 par défaut, configurable).
- Deep-linking total : ouvrir n'importe quelle URL reconstruit le stack.
- Back navigateur = pop d'étape → pop de modal → retour page.
- Multi-presets (Tailwind, Bootstrap, vanilla) générés au choix.
- Support ERB, ViewComponent, helpers Rails.
- Accessibilité conforme WAI-ARIA Authoring Practices (dialog).
- Tests : Capybara, RSpec, Minitest.
- Zero JS custom requis pour les cas standard.

### Non-objectifs (v1)
- Phlex (post-1.0).
- Animations 3D / parallaxes / autres effets spectaculaires.
- Server-pushed modal (auto-open via ActionCable broadcast) — possible mais hors scope.
- Mobile native bridge (Hotwire Native) — détection user-agent pour ne pas casser, pas d'optim dédiée (cf. §15 Q3).
- React/Vue interop.
- IE/legacy browser fallback (les `<dialog>` et View Transitions définissent le baseline).

---

## 4. Prior art

| Projet | Apport | Limite |
|---|---|---|
| `cmer/ultimate_turbo_modal` | Référence : `<dialog>` + Idiomorph + history | Single modal, pas de wizard intra |
| `wicked` | Wizards plein page | Pas de modal/drawer |
| Pattern hotrails.dev | DIY simple | Pas de stack |
| TanStack Router (JS) | Inspiration : routes parallèles imbriquées | Pas Rails |
| Linear modal stack (UI) | Inspiration UX : drill-down dans une modal | Propriétaire |

---

## 5. API publique

### 5.1 Installation

```bash
bundle add modal_stack
bin/rails generate modal_stack:install --preset=tailwind  # ou bootstrap, vanilla
```

Le générateur :
- Détecte importmap vs esbuild/bun et installe le JS au bon endroit.
- Crée `app/views/layouts/modal.html.erb` (le layout dédié).
- Monte le frame stack dans `application.html.erb` (un seul frame parent).
- Copie le preset CSS choisi dans `app/assets/stylesheets/modal_stack/`.
- Pin le Stimulus controller.

### 5.2 Routing

```ruby
# config/routes.rb
resources :projects do
  resource :edit, only: [:show, :update], module: :projects
end
# Génère edit_project_edit_path(@project) → /projects/:project_id/edit
```

Pas de DSL custom — on reste sur les routes Rails standard. Le seul ajout est un helper de namespace optionnel pour les wizards, déclaré **dans** la ressource parente (forme alignée avec l'annexe §17) :

```ruby
resources :projects do
  modal_stack_for :onboarding do
    wizard steps: [:profile, :preferences, :confirm]
  end
end
# Génère: /projects/:project_id/onboarding/profile, /preferences, /confirm
```

### 5.3 Helper de lien

```erb
<%= modal_link_to "Éditer", edit_project_path(@project) %>
<!-- Équivalent à: link_to ..., data: { turbo_frame: "modal_stack", turbo_action: "advance" } -->

<%= modal_link_to "Détails", project_path(@project), as: :drawer, side: :right %>
<%= modal_link_to "Confirmer", danger_path, as: :confirmation %>
```

### 5.4 Helper de formulaire

```erb
<%= modal_form_with model: @project do |f| %>
  ...
<% end %>
<!-- Le form sait qu'il est dans une modal et set les bons attrs -->
```

### 5.5 Layout dédié

Côté contrôleur, on déclare simplement :

```ruby
class Projects::EditController < ApplicationController
  layout 'modal'

  def show
    @project = Project.find(params[:project_id])
  end

  def update
    @project = Project.find(params[:project_id])
    if @project.update(project_params)
      redirect_to @project  # ferme la modal automatiquement (303 → top-level)
    else
      render_modal :show, status: :unprocessable_entity  # re-render dans la modal
    end
  end
end
```

Le layout `modal.html.erb` contient juste :

```erb
<%= modal_stack_container size: :md, dismissible: true do %>
  <%= yield %>
<% end %>
```

### 5.6 Turbo Stream actions impératives

```ruby
# Push une nouvelle modal au-dessus de la pile (history.pushState)
turbo_stream.modal_push(partial: 'projects/edit', locals: { project: @project })

# Replace le top du stack — par défaut history.replaceState (pas de nouvelle entrée)
turbo_stream.modal_replace(partial: 'wizard/step_2', locals: { ... })

# Replace le top mais pousse une nouvelle entrée history (back = revient au step précédent)
# C'est ce qu'utilise le wizard pour un back step-par-step natif
turbo_stream.modal_replace(partial: 'wizard/step_2', locals: { ... }, history: :push)

# Pop le top (history.back)
turbo_stream.modal_pop

# Pop tout (close all modals, retour page de fond)
turbo_stream.modal_close_all

# Update une zone hors stack pendant qu'une modal est ouverte
turbo_stream.update('flash', partial: 'shared/flash')
```

**Sémantique `replace` vs `push`** :
- `modal_push` = nouveau layer DOM + nouvelle entrée history. Back = pop visuel.
- `modal_replace history: :replace` (défaut) = morph du layer top, **pas** d'entrée history. Back = sort du wizard.
- `modal_replace history: :push` = morph du layer top + nouvelle entrée history. Back = revient au step précédent. C'est le mode wizard.

Toutes ces actions broadcastent un événement custom DOM (`modal_stack:pushed`, `:popped`, `:replaced`) que le dev peut écouter via Stimulus.

### 5.7 ViewComponent

```ruby
class ProjectEditComponent < ViewComponent::Base
  include ModalStack::Component  # ajoute size, dismissible, etc.

  size :lg
  dismissible true
end
```

```erb
<!-- _component.html.erb -->
<%= modal_stack_container do %>
  <h2>Édition</h2>
  ...
<% end %>
```

### 5.8 Wizard DSL

```ruby
class OnboardingWizard < ModalStack::Wizard
  state_strategy :session  # :session, :token, :draft

  # Chaque step submit → modal_replace(next_step, history: :push)
  # Le DOM est morph (préserve les inputs), une entrée history est ajoutée.
  # Back navigateur = revient au step précédent (modal_replace history: :push appliqué inversement).

  step :profile do
    on_submit do |params|
      @user.assign_attributes(params)
      validate_or_re_render!
    end
  end

  step :preferences do
    on_submit { |params| store(:preferences, params) }
  end

  step :confirm do
    on_submit do
      @user.save!
      finish redirect_to: dashboard_path
    end
  end
end
```

Le contrôleur du wizard est généré à partir de la classe :

```ruby
class OnboardingController < ModalStack::WizardController
  wizard OnboardingWizard
  layout 'modal'
end
```

Routes auto :
```
GET  /onboarding/profile      → step :profile
POST /onboarding/profile      → submit step
GET  /onboarding/preferences  → step :preferences
...
```

#### State strategies

- `:session` — sérialisation Marshal/JSON dans `session[:wizards][wizard_id]`. Default. Marche tant qu'on a une session Rails. Warning runtime au-delà de 3KB (cf. §15 Q5).
- `:token` — chaque step renvoie un token signé/chiffré (MessageVerifier+MessageEncryptor) que le step suivant POST. Stateless mais limite ~2KB.
- `:draft` — chaque step persiste dans un draft record (ex. `Project.find_or_create_by(status: :draft, user: current_user)`). Le dev fournit le scope.

API uniforme côté wizard :
```ruby
store(:profile, params)   # écrit
read(:profile)            # lit
clear!                    # purge tout
```

---

## 6. Architecture interne

### 6.1 Le stack et la source de vérité

**Décision** : le stack a **deux modes de représentation**, selon que les routes empilées forment une chaîne nested ou non.

#### Mode A — Nested stack (deep-linkable complet)

Quand les modals successives sont des routes nested au sens Rails (`/projects/42/edit` → `/projects/42/edit/billing` → `/projects/42/edit/billing/plans`), le stack est entièrement reconstructible depuis l'URL du top via la chaîne d'ancestors résolus par le routeur.

L'opt-in se fait au niveau du contrôleur :

```ruby
class Projects::Edit::BillingController < ApplicationController
  layout 'modal'
  modal_stack_ancestors do
    push edit_project_path(params[:project_id])
  end
end
```

Le helper `modal_stack_ancestors` déclare la chaîne de URLs à reconstruire avant de monter le top. Au load direct sur l'URL la plus profonde, le serveur émet un `<script type="application/json" id="modal-stack-bootstrap">` qui liste les ancestors ; le client les fetche en parallèle et les empile avant d'afficher le top.

#### Mode B — Fork stack (top-only deep-linkable)

Quand les modals successives ne forment pas une chaîne nested (ex. modal "créer client" ouverte depuis modal "créer facture"), seul le top est encodé dans l'URL. Au reload, le stack revient à profondeur 1 (le top). C'est une limite assumée : l'alternative (encoder le stack en `?_stack=...`) salirait l'URL pour un cas peu fréquent en pratique (les fork stacks viennent d'une intent utilisateur, pas d'un partage d'URL).

#### Source de vérité runtime

Une fois en page :
- **Source de vérité côté client** : un store JS interne (`ModalStack.state`), pas le DOM. Le DOM est un rendu de l'état.
- **Source de vérité côté serveur** : aucune. Le serveur ne connaît pas le stack ouvert chez le client. Les Turbo Stream actions (`modal_push`, etc.) opèrent en delta sur l'état client.
- **URL** : reflète le top du stack via `history.pushState`. Mise à jour à chaque push/pop/replace.

### 6.2 Reconstruction au load

Cas Mode A (nested), URL `/projects/42/edit/billing/plans` :

1. Rails route vers `Projects::Edit::Billing::PlansController#show`, layout `modal`.
2. Le contrôleur déclare ses ancestors via `modal_stack_ancestors`.
3. La vue rend le top + un `<script type="application/json" id="modal-stack-bootstrap">[{url: "/projects/42/edit"}, {url: "/projects/42/edit/billing"}]</script>`.
4. Le Stimulus controller fetche les ancestors en parallèle via `Promise.all(urls.map(fetch))`, les empile (les plus profonds d'abord, sans focus/scroll lock), puis monte le top en faisant `dialog.showModal()`. **V1 = N requêtes parallèles** (généralement 1-3 ancestors, latence acceptable). Un endpoint batch `POST /_modal_stack/bootstrap` (qui rend les N partials côté serveur en une seule réponse multipart) est une optimisation post-1.0, gated sur un benchmark P95 réel.
5. Si un ancestor 404 ou n'a pas le layout `modal`, l'étape est skippée silencieusement (le stack démarre à la profondeur où la chaîne est valide).

Cas Mode B (fork), URL `/clients/new?_modal_origin=invoice_42_new` :

1. Rails route normalement vers `ClientsController#new`, layout `modal`.
2. Pas de bootstrap d'ancestors. Le stack démarre à profondeur 1.
3. Le query param `_modal_origin` est purement informatif (pour le bouton "retour" textuel) et ignoré côté routing.

### 6.3 DOM structure

Un seul `<dialog>` racine ouvert via `showModal()` qui contient les layers stackés visuellement. Ce choix résout deux problèmes en un coup :
- Pas de top-layer multiple (un seul `<dialog>` natif → un seul top-layer du browser).
- Pas de frame turbo qui "remplace au lieu d'empiler" : on n'utilise pas `<turbo-frame>` comme conteneur du stack.

```html
<body>
  <main>...page de fond...</main>

  <dialog id="modal-stack-root"
          data-controller="modal-stack"
          data-modal-stack-depth-value="2">
    <!-- Layer 1 (du dessous, inert, partiellement visible) -->
    <div data-modal-stack-target="layer" data-depth="1" inert>
      <div class="modal-stack__panel">...edit form...</div>
    </div>

    <!-- Layer 2 (top, focusable) -->
    <div data-modal-stack-target="layer" data-depth="2">
      <div class="modal-stack__panel">...nested form...</div>
    </div>
  </dialog>
</body>
```

Push d'une modal :
- Si `dialog.open === false` → `dialog.showModal()` (active le top-layer natif, focus trap natif au niveau dialog).
- Append d'un nouveau `<div data-modal-stack-target="layer">` à l'intérieur.
- Marque tous les layers précédents `inert` (focus trap intra-dialog).

Pop du dernier layer → `dialog.close()` (libère le top-layer, restaure le focus sur la page).

Les Turbo Streams `modal_push/pop/replace` ciblent ce `<dialog>` par id. Pas de `<turbo-frame>` impliqué — on rend `Turbo.renderStreamMessage` directement.

### 6.4 Stimulus controllers

Deux controllers :

- `modal-stack` (sur le `<dialog>` racine) — orchestre push/pop/replace, gère history, scroll lock, écoute `popstate`, expose le store `ModalStack.state`.
- `modal-stack-link` (auto-mount sur `modal_link_to`) — intercepte le click pour view transition + push.

Pas de controller "layer" séparé : le focus trap est natif (`showModal()` + `inert` sur les layers du dessous au sein du même dialog).

### 6.5 History strategy — state machine explicite

Le store `ModalStack.state` est la source de vérité. Forme :

```ts
{
  layers: Array<{
    id: string,           // uuid v4 généré au push
    url: string,          // URL associée au layer
    historyId: number,    // history.state.modalStackId
    variant: 'modal' | 'drawer' | 'bottom_sheet' | 'confirmation',
    dismissible: boolean,
  }>,
  baseUrl: string,        // URL de la page de fond (sans modal)
}
```

Chaque entrée history porte `{ modalStackId, layerId, depth }` dans `history.state`. Cela rend le `popstate` listener déterministe — on compare des IDs, pas des URLs.

Transitions :

| Action | DOM | history | store |
|---|---|---|---|
| `push(url)` | append layer | `pushState({modalStackId, layerId, depth: N+1}, '', url)` | append layer |
| `pop()` | remove top, `dialog.close()` si depth devient 0 | `history.back()` si l'entrée précédente est notre `baseUrl` ou un de nos layers ; sinon `pushState(baseUrl)` (cas redirect) | drop top |
| `replace(url, history: :push)` | morph top content | `pushState(...)` avec nouveau layerId | mute top.url |
| `replace(url, history: :replace)` | morph top content | `replaceState(...)` même layerId | mute top.url |
| `closeAll()` | clear children + `dialog.close()` | `go(-N)` si toutes nos entrées sont contiguës ; sinon `pushState(baseUrl)` | reset |

`popstate` handler :

```js
window.addEventListener('popstate', (e) => {
  const target = e.state?.modalStackId === this.stackId ? e.state : null
  const currentDepth = this.state.layers.length
  const targetDepth = target?.depth ?? 0

  if (targetDepth < currentDepth) this.popTo(targetDepth)        // back
  else if (targetDepth > currentDepth) this.rebuildTo(target)    // forward
  else if (target?.layerId !== this.topLayerId) this.swapTopTo(target)
})
```

Cas pièges traités explicitement :

| Cas | Comportement |
|---|---|
| Forward après back | `popstate` vers une entrée connue → rebuild via store snapshot conservé en `sessionStorage` |
| Rechargement avec stack ouvert | Bootstrap §6.2 + lecture `sessionStorage[modalStackSnapshot]` pour valider la cohérence |
| Lien externe puis retour | Le top du stack est restauré via `sessionStorage` snapshot (ou ignoré si snapshot expiré > 30 min) |
| Submit form avec redirect 303 vers page de fond | Le contrôleur Rails set `Turbo-Modal-Action: close_all` en réponse → JS `closeAll()` avant la navigation |
| Submit form avec redirect 303 vers une autre URL "modal" | Header `Turbo-Modal-Action: replace_top` → on remplace le top sans push |
| Deux onglets | Chaque onglet a son propre `stackId` (uuid au boot), pas de collision |

Cette state machine est testée à 100% (cf. §13).

### 6.6 Focus management

`<dialog>.showModal()` fait l'essentiel gratuitement :
- Focus trap natif au niveau du `<dialog>` racine (Tab confiné dans le dialog, pas dans `<main>`).
- ESC géré nativement → on intercepte `cancel` event pour décider pop vs ignore (selon `dismissible`).
- Le focus initial va au 1er focusable du dialog.

Pour le focus trap **intra-dialog** (entre layers stackés) :
- Au push d'un nouveau layer : `previousTopLayer.inert = true`, sauver `document.activeElement` dans `state.layers[N-1].returnFocus`, focus le 1er focusable du nouveau layer.
- Au pop : `newTopLayer.inert = false`, focus `state.layers[newTop].returnFocus`.

`inert` étant natif et bien supporté (Safari 15.4+, Chrome 102+, Firefox 112+), pas de polyfill.

### 6.7 Scroll lock

- Premier modal pushé → `<body>` reçoit `data-modal-stack-locked` (CSS désactive le scroll, compense la scrollbar).
- Last pop → unlock.
- Les layers internes peuvent scroller via overflow-y normal.

### 6.8 View Transitions

```javascript
function pushLayer(html) {
  if (!document.startViewTransition) {
    return mountLayer(html)  // fallback CSS @keyframes
  }
  document.startViewTransition(() => mountLayer(html))
}
```

Les transitions CSS fallback sont dans le preset choisi (Tailwind/Bootstrap/vanilla) et configurables via CSS variables :

```css
:root {
  --modal-stack-duration: 200ms;
  --modal-stack-ease: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 6.9 Z-index management

CSS variable computée :
```css
[data-depth="1"] { z-index: calc(var(--modal-stack-base) + 10); }
[data-depth="2"] { z-index: calc(var(--modal-stack-base) + 20); }
/* etc. */
```

Backdrop opacity stacké : chaque layer assombrit légèrement plus.

---

## 7. Variants

| Variant | Containeur | Position | Dismiss | Mobile |
|---|---|---|---|---|
| `:modal` | `<dialog>` centré | center | backdrop + ESC + close btn | full-width <640px |
| `:drawer` | `<dialog>` slide | left/right (configurable) | backdrop + ESC + swipe | full-width <640px |
| `:bottom_sheet` | `<dialog>` slide | bottom | swipe-down + handle + backdrop | natif |
| `:confirmation` | `<dialog>` centré small | center | backdrop disabled, requires answer | natif |

API uniforme :
```ruby
turbo_stream.modal_push(partial: 'foo', as: :drawer, side: :right, size: :md)
```

```erb
<%= modal_link_to "...", url, as: :bottom_sheet, dismissible: :swipe %>
```

### Confirmation preset

```erb
<%= confirm_modal title: "Supprimer ce projet ?",
                  body: "Action irréversible.",
                  confirm: { label: "Supprimer", url: project_path(@p), method: :delete },
                  cancel: "Annuler" %>
```

Remplace les `data-turbo-confirm` natifs avec un vrai composant stylable.

---

## 8. Styling & presets

### 8.1 Architecture CSS

- **Couche comportement** (toujours chargée, ~1.5kb) : focus trap visuel, scroll lock body, z-index, transitions de base.
- **Couche preset** (chargée selon choix install) : Tailwind, Bootstrap, vanilla.

### 8.2 Tailwind preset

Génère un `tailwind.config.js` snippet à inclure et un `modal_stack.css` qui déclare les composants `@apply`-ifiés. Customisable via `theme.extend.modalStack`.

### 8.3 Bootstrap preset

Réutilise les classes BS5 (`modal`, `modal-dialog`, `offcanvas` pour drawer). Fournit un override CSS pour le stacking que BS ne gère pas.

### 8.4 Vanilla preset

CSS pur (~3kb) avec des variables CSS pour customisation totale. Aucune dépendance.

### 8.5 Customisation

Toutes les classes CSS appliquées sont configurables :

```ruby
# config/initializers/modal_stack.rb
ModalStack.configure do |config|
  config.classes.modal_panel = "rounded-2xl bg-white shadow-xl ..."
  config.classes.drawer_panel = "..."
  config.default_sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" }
end
```

---

## 9. JS packaging

### 9.1 Auto-detection à l'install

```ruby
# Generator logic
if File.exist?('config/importmap.rb')
  install_via_importmap
elsif File.exist?('package.json')
  install_via_npm
else
  raise "Aucune stratégie JS détectée"
end
```

### 9.2 Importmap

```ruby
# Pin dans config/importmap.rb
pin "modal_stack", to: "modal_stack.js", preload: true
```

Le JS est servi par Propshaft/Sprockets depuis la gem.

### 9.3 esbuild/bun

Publication d'un package npm `@metalzoid/modal-stack` synchrone avec la gem (CI publie les deux ensemble).

```javascript
// app/javascript/application.js
import { ModalStack } from '@metalzoid/modal-stack'
import { Application } from '@hotwired/stimulus'
ModalStack.install(Application.start())
```

### 9.4 CDN fallback

Disponible via jsDelivr pour démos/prototypes (pas de prod).

---

## 10. Helpers de test

### 10.1 Capybara (system tests)

```ruby
# Ajout via require 'modal_stack/capybara'
within_modal { expect(page).to have_content "Édition" }
within_modal(depth: 2) { ... }              # cible un niveau précis
expect(page).to have_modal_open
expect(page).to have_modal_stack(depth: 2)
close_modal                                  # ESC sur top
close_all_modals
```

### 10.2 RSpec matchers

```ruby
expect(page).to have_modal.with_title("Édition")
expect(page).to have_modal_stack.of_depth(2)
```

### 10.3 Minitest

```ruby
assert_modal_open
assert_modal_stack_depth 2
within_modal { assert_text "Édition" }
```

### 10.4 Request specs

```ruby
patch project_path(@project), params: ...
assert_turbo_stream_action :modal_replace
assert_turbo_stream_action :modal_close_all
```

---

## 11. Sécurité

- **Tokens wizard** chiffrés avec `Rails.application.message_verifier(:modal_stack_wizard)` + `message_encryptor`.
- **Pas de leak XSS** : le helper `modal_link_to` ne fait que poser des data-attrs, le contenu est rendu par les vues utilisateur (responsabilité standard Rails).
- **Pas d'injection turbo** : les actions Turbo Stream passent par les helpers officiels `turbo-rails`.
- **CSRF** : géré par les `<meta>` standards Rails, rien à ajouter.
- **Pas de markdown/HTML brut** dans les confirmations preset.

---

## 12. Performance

- **JS bundle** : viser <8kb gzipped pour les controllers + helpers.
- **CSS** : ~3kb (vanilla preset), 0 si Tailwind (purge).
- **First paint** : aucun JS bloquant. Stimulus monte au DOMContentLoaded.
- **Idiomorph** : déjà chargé par `turbo-rails` 8+, pas de coût additionnel.
- **Reconstructions URL → stack** : un seul fetch par layer (pas N).

Benchmark cible : push/pop d'un layer < 16ms (1 frame) en P50, < 50ms P95 sur Macbook M1.

---

## 13. Tests internes de la gem

- **CI matrix** : Rails 7.2 / 8.0 + Ruby 3.2 / 3.3 / 3.4 = 6 combos.
- **Browser tests** : Cuprite (Chromium headless) sur Ubuntu CI.
- **Visual regression** : Percy/Chromatic snapshots pour les 3 presets sur les 4 variants × 3 sizes.
- **Accessibilité** : axe-core injecté dans Capybara, fail si violation critical.
- **Test coverage cible** : 95%+ lignes, 100% sur le state machine du stack.

---

## 14. Plan de rollout

### Scope v1 — réduit pour livrer

L'idée n'est plus "tout dans 1.0", c'est "1.0 utilisable, le reste en mineurs". Le différenciateur core (stack + history + deep-linking) doit être impeccable avant d'ajouter wizard, bottom sheet ou multi-presets.

### Milestones v1

| # | Tag | Contenu | Estimation |
|---|---|---|---|
| M0 | `0.1.0` | POC : 1 modal `<dialog>.showModal()` + state machine §6.5 + history + Tailwind preset + Capybara helpers de base | 3 sem |
| M1 | `0.2.0` | Stack N modals (Mode B fork only) + tests state machine 100% + RSpec/Minitest helpers | 3 sem |
| M2 | `0.3.0` | Mode A nested deep-linking (ancestors bootstrap §6.2) | 2 sem |
| M3 | `0.4.0` | Drawer + confirmation preset + i18n (FR/EN) | 2 sem |
| M4 | `0.5.0` | Polish : focus edge cases, popstate cross-browser, doc API, site landing | 2 sem |
| M5 | `0.9.0` | Beta publique, fenêtre feedback 4 sem | 4 sem |
| M6 | `1.0.0` | Stabilisation post-beta, View Transitions API, benchmarks | 2 sem |

**Total v1 : 18 semaines (~4.5 mois)** avec buffer réaliste à 6 mois.

### Post-1.0 (mineurs)

| Tag | Contenu |
|---|---|
| `1.1` | Wizard DSL + 3 state strategies (`:session`, `:token`, `:draft` avec signed scope) |
| `1.2` | Bottom sheet (avec swipe physics — chantier dédié) |
| `1.3` | ViewComponent intégration + `modal_form_with` |
| `1.4` | Bootstrap preset |
| `1.5` | Vanilla CSS preset + visual regression CI |
| `2.0` | Phlex + audit breaking changes accumulés |

Rationnel du découpage :
- **Wizard en 1.1** : une gem de wizard + state machine est un projet à part entière (cf. `wicked`, 13 ans de polish). En refactorer une version intégrée mérite 4-6 sem dédiées, pas 1.5.
- **Bottom sheet en 1.2** : la swipe physics qualité-Linear est un vrai sujet (inertie, snap points, velocity). À traiter sérieusement, pas en 1 semaine.
- **Multi-presets en 1.4-1.5** : chaque preset = surface de bug × N variants × M sizes. Tailwind seul suffit pour le launch.

### Communication

- **Pré-1.0** (M0-M4) : dev logs sur Bsky/Mastodon, feedback ciblé dans `/r/rails`, `discuss.hotwired.dev`.
- **Beta M5** : appel à testeurs avec 3-5 apps Rails de complexité variée. Issues prioritisées.
- **1.0 launch** : article hotrails.dev, soumission gorails, ruby-weekly, screencast 5 min "stack de modals + back natif".
- **Post-1.0** : un mineur tous les 2-3 mois, pas plus.

---

## 15. Décisions sur les questions ouvertes

Tranchées le 2026-04-26.

### Q1 — Un seul `<dialog>.showModal()` racine, layers internes en `<div>`

**Problème initial** : `showModal()` sur N `<dialog>` casse le z-index ordering (chaque dialog devient son propre top-layer). On avait envisagé `show()` pour contourner, mais ça nous obligeait à réimplémenter focus trap, scroll lock, ESC, backdrop — perdant tout le bénéfice du `<dialog>` natif.

**Choix retenu** : un seul `<dialog id="modal-stack-root">` ouvert via `showModal()`, qui contient les layers stackés en `<div data-modal-stack-target="layer">`. Voir §6.3 pour la structure DOM.

Ce qu'on récupère gratuitement :
- **Top-layer natif** unique → pas de bagarre z-index avec d'autres modals (toasts, dropdowns, etc.).
- **Focus trap natif** au niveau du dialog (Tab ne fuit pas dans `<main>`).
- **ESC natif** → événement `cancel` interceptable pour la logique pop.
- **Scroll lock natif** sur `<body>` (browser le fait pour `showModal()`).
- **Backdrop natif** via `::backdrop`.

Ce qu'on assume manuellement (mais une seule fois, pas N fois) :
- Focus trap **inter-layers** au sein du dialog : `inert` sur les layers du dessous (cf. §6.6).
- Visuel des backdrops empilés (chaque layer a son propre dégradé) : pur CSS, pas de JS.

```javascript
// Push initial (depth 0 → 1)
dialog.showModal()
appendLayer(html)

// Push N → N+1
appendLayer(html)
previousLayer.inert = true

// Pop N → N-1
removeTopLayer()
newTopLayer.inert = false

// Pop 1 → 0
dialog.close()  // libère le top-layer browser
```

**Conséquence design** : `<dialog>` n'est plus un "container par modal" mais un "container du stack entier". Les variants (drawer, bottom_sheet) sont des classes CSS sur le layer interne, pas sur le `<dialog>` lui-même. Le `<dialog>` racine est invisible (transparent, fullscreen) et seul le layer top peint réellement.

### Q2 — Idiomorph en opt-in avec auto-détection

On ne déclare **pas** Idiomorph en dépendance dure. Au runtime, le Stimulus controller détecte si Turbo 8 morphing est actif. Si oui, `modal_replace` utilise le morph (préserve focus, scroll position dans les inputs, diff DOM au lieu d'un swap brut). Sinon, fallback swap classique via `Turbo.renderStreamMessage`.

```javascript
const supportsMorph = typeof Turbo !== 'undefined' && Turbo.session?.refreshScroll !== undefined
if (supportsMorph) {
  morphLayer(target, html)
} else {
  swapLayer(target, html)  // remplace le contenu via Turbo's safe renderer
}
```

Concrètement : wizard step transitions fluides sur Rails 8 / Turbo 8+, fonctionnelles (sans préservation focus) en dessous.

### Q3 — Hotwire Native : "don't break" + flag opt-out

La gem détecte le user-agent Hotwire Native (`request.user_agent` contient `"Hotwire Native"`). Quand détecté, `modal_link_to` rend un `link_to` standard (pas de `data-turbo-frame`), laissant le navigation controller natif gérer le push. Pas d'optimisation iOS/Android dédiée, mais **pas de casse** non plus.

```ruby
def modal_link_to(name, url, **opts)
  if hotwire_native_request?
    link_to(name, url, opts)
  else
    link_to(name, url, opts.merge(data: { turbo_frame: "modal_stack", turbo_action: "advance" }))
  end
end
```

Bridge components dédiés = post-1.0 si demande utilisateur.

### Q4 — Broadcasts vers modal ouverte : ignore-able via event

Quand un broadcast ActionCable tente une action sur le stack (ex. `turbo_stream.broadcast_modal_pop_to(...)`), le Stimulus controller émet l'event `modal_stack:before-remote-action` (cancelable). Si rien ne l'intercepte, l'action s'applique. Si `event.preventDefault()` est appelé, l'action est skippée.

```javascript
// Code applicatif (Stimulus controller form-dirty par exemple)
this.element.addEventListener('modal_stack:before-remote-action', (e) => {
  if (this.formIsDirty && e.detail.action === 'modal_pop') {
    e.preventDefault()
    notifyUser('Save your changes first')
  }
})
```

Default safe : pas de perte de données silencieuse, mais pas de friction par défaut.

### Q5 — Wizard `:session` : warning runtime au-delà de 3KB

Au moment où le wizard sérialise son state vers `session[:wizards][id]`, on mesure `bytesize`. Si > 3KB :

```ruby
ActiveSupport::Notifications.instrument(
  "wizard.size_warning.modal_stack",
  wizard: self.class.name,
  size: state_bytesize,
  threshold: 3.kilobytes
)
Rails.logger.warn(
  "[modal_stack] Wizard #{self.class.name} state is #{state_bytesize} bytes. " \
  "Cookie sessions cap at ~4KB. Consider state_strategy :draft for large payloads."
)
```

Pas de hard fail (aurait été frustrant pour les wizards à la limite). Doc explicite dans le README.

### Q6 — i18n natif dès v1 (FR + EN livrés)

Tous les strings exposés à l'utilisateur final passent par `I18n.t("modal_stack.*")`. Les locales `fr.yml` et `en.yml` sont livrées dans la gem et auto-chargées (`config.i18n.load_path << gem_path/'config/locales/*.yml'`).

```yaml
# config/locales/modal_stack.fr.yml
fr:
  modal_stack:
    close: "Fermer"
    back: "Retour"
    confirm:
      default_label: "Confirmer"
      default_cancel: "Annuler"
    swipe_hint: "Glissez vers le bas pour fermer"
```

D'autres locales acceptées via PRs communauté.

### Q7 — `data-turbo-confirm` : cohabite, replacement opt-in

Par défaut, `data-turbo-confirm` reste géré par Turbo natif (window.confirm). Le helper `confirm_modal` est totalement séparé, le dev choisit. Pour ceux qui veulent remplacer globalement :

```ruby
# config/initializers/modal_stack.rb
ModalStack.configure do |c|
  c.replace_turbo_confirm = true
end
```

Quand activé, un Stimulus controller intercepte les `turbo:before-fetch-request` quand `data-turbo-confirm` est présent et lance le preset `:confirmation` à la place du `window.confirm` natif.

Pas de surprise à l'install, magie disponible au choix.

---

## 16. Décisions verrouillées (recap)

| Décision | Choix |
|---|---|
| Nom | `modal_stack` |
| Scope v1 | Stack + history + Tailwind + drawer + confirmation. Wizard, bottom sheet, ViewComponent, Bootstrap, vanilla → mineurs post-1.0 |
| URL strategy | Path-based. Deep-linking complet pour Mode A nested, top-only pour Mode B fork (§6.1) |
| View layers | ERB + helpers Rails (v1). ViewComponent en 1.3 |
| Phlex | Post-2.0 |
| CSS | Tailwind preset en v1. Bootstrap (1.4) puis vanilla (1.5) |
| Wizard state | 3 strategies au choix (session / token / draft) — livré en 1.1 |
| Variants v1 | Modal + Drawer + Confirmation. Bottom sheet en 1.2 |
| Animations | View Transitions API + fallback CSS |
| JS packaging | Importmap + esbuild/bun avec auto-détection |
| Form errors | Re-render dans la modal par défaut + Turbo Stream explicite override |
| Tests | Capybara + RSpec + Minitest |
| Versions | Rails 7.2+ / Ruby 3.2+ |
| Licence | MIT |
| Dialog element | Un seul `<dialog>.showModal()` racine, layers internes en `<div>` (§6.3, §15.Q1) |
| Conteneur stack | Pas de `<turbo-frame>` racine — Turbo Streams directs sur le `<dialog>` (§6.3) |
| State runtime | Store JS `ModalStack.state` + state machine §6.5, snapshot `sessionStorage` pour reload |
| Wizard step semantics | `modal_replace history: :push` (morph DOM + nouvelle entrée history) |
| Idiomorph | Opt-in avec auto-détection Turbo 8 |
| Hotwire Native | "Don't break" via détection user-agent, pas d'optim |
| Broadcasts modal | Apply par défaut, cancelable via event JS |
| Cookie session | Warning runtime > 3KB, pas de hard fail |
| i18n | Natif dès v1, FR + EN livrés |
| `data-turbo-confirm` | Cohabite par défaut, replacement opt-in |
| Rollout | ~6 mois jusqu'à 1.0 (vs 9 sem initialement) |

---

## 17. Annexe — exemple end-to-end

```ruby
# config/routes.rb
Rails.application.routes.draw do
  resources :projects do
    resource :edit, only: [:show, :update], module: :projects
    modal_stack_for :onboarding do
      wizard steps: [:profile, :preferences, :confirm]
    end
  end
end
```

```erb
<!-- app/views/projects/index.html.erb -->
<% @projects.each do |project| %>
  <article>
    <h3><%= project.name %></h3>
    <%= modal_link_to "Éditer", edit_project_path(project) %>
    <%= modal_link_to "Onboarding", project_onboarding_path(project), as: :drawer %>
  </article>
<% end %>
```

```ruby
# app/controllers/projects/edit_controller.rb
class Projects::EditController < ApplicationController
  layout 'modal'

  def show
    @project = Project.find(params[:project_id])
  end

  def update
    @project = Project.find(params[:project_id])
    if @project.update(project_params)
      redirect_to @project, notice: "Mis à jour"
    else
      render_modal :show, status: :unprocessable_entity
    end
  end
end
```

```ruby
# app/wizards/onboarding_wizard.rb
class OnboardingWizard < ModalStack::Wizard
  state_strategy :draft, scope: -> { Project.find(params[:project_id]).onboarding_drafts }

  step :profile do
    on_submit { |params| store(:profile, params) }
  end

  step :preferences do
    on_submit { |params| store(:preferences, params) }
  end

  step :confirm do
    on_submit do
      OnboardingService.complete!(read(:profile), read(:preferences))
      finish redirect_to: project_path(params[:project_id])
    end
  end
end
```

Voilà. 50 lignes de code applicatif, un onboarding 3 étapes drawer-based, deep-linkable, avec back natif, dans un projet existant.
