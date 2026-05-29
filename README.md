# docusaurus-plugin-graph-view

[![npm version](https://img.shields.io/npm/v/docusaurus-plugin-graph-view.svg)](https://www.npmjs.com/package/docusaurus-plugin-graph-view)
[![license](https://img.shields.io/npm/l/docusaurus-plugin-graph-view.svg)](https://github.com/whoisltd/docusaurus-plugin-graph-view/blob/main/LICENSE)

> An interactive, knowledge graph for your [Docusaurus](https://docusaurus.io/) site.

<p align="center">
  <img src="./demo.gif" alt="demo" />
</p>

## Features

- **Force-Directed Graph** — Powered by [d3-force](https://github.com/d3/d3-force) and rendered on a 2D Canvas for smooth 60fps performance.
- **Cinematic Pan & Zoom** —Viewport smoothly glides and focuses in close on any node when selected via click, search, or side panel links, auto-fitting back when cleared.
- **Connection Filters** — Real-time filter controls to toggle Tag Links (solid lines) vs. Doc-to-Doc Connections (dashed lines), showing edge counts inside filter badges.
- **Tag-Based Clustering** — Frontmatter `tags` are automatically extracted and rendered as hub nodes, connecting related documents visually.
- **Dynamic CSS Variables Theme Integration** — Respects your site's custom theme colors natively. Easily customize graph highlight colors, tag nodes, and link weights directly via your site's `custom.css` variables.
- **Mobile Responsive Drawer** — Swaps fluidly on screens `< 768px` to a vertical bottom-drawer overlay so your graph remains fully interactive and exploreable on phones and tablets.
- **Inline-Link Detection** — Automatically discovers connection pathways between documents, mapping out rich relationships across your second brain.
- **Obsidian Wikilink Support** — Opt-in `[[wikilink]]` edge matching with a companion Remark compiler plugin to natively support Obsidian workflows.
- **Content Preview** — Interactive sidebar panel showing frontmatter tags, page summaries, and adjacent connections to ease note discovery.
- **Search Auto-Highlight** — Instant search box to locate nodes with dynamic focus and highlighted glowing halos.

---

## Installation

```bash
npm install docusaurus-plugin-graph-view
```

**Peer dependency:** `@docusaurus/core >= 3.0.0`

---

## Document Connections (How Linking Works)

The plugin automatically parses your markdown files to build a web of interconnected nodes. Documents can link together in three ways:

### 1. Tag-to-Document Clusters (Default)
Any tags defined in your document's frontmatter automatically become "Tag Hubs" in your graph:
```markdown
---
title: Backpropagation Guide
tags: [machine-learning, neural-networks]
---
```
*In the graph, this creates a green Tag Hub node for `#machine-learning` and `#neural-networks` and draws a solid line connection to this document.*

### 2. Standard Markdown Relative Links
Standard markdown links connecting one document to another will generate **Doc-to-Doc connections** (represented as dashed blue lines):
```markdown
Learn more about this in our [Activation Functions](./activation-functions.md) article.
```
*Note: Trailing link titles like `[Label](./path.md "My Title")`, anchor headings, and query variables are cleaned and resolved automatically.*

### 3. Obsidian-Style Wikilinks
If you use Obsidian or another personal wiki editor, you can enable wikilinks to visualize and traverse your vaults natively:
```markdown
We use [[backpropagation|Backpropagation]] to compute gradients across [[activation-functions#relu|ReLU nodes]].
```
Both standard wikilinks `[[neural-networks]]` and aliased/anchor variations are parsed and mapped accurately in the graph.

---

## Usage

### Simple Configuration
Add the plugin to your `docusaurus.config.js` to enable standard parsing and Tag/Markdown connections:

```javascript
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-graph-view',
      {
        paths: ['docs'],          // Directories to scan for .md/.mdx files
        routePath: '/graph',      // Route where the graph page will be accessible
        title: 'Knowledge Graph', // Page title
        linkDetection: true,      // Detect inline [links](./path.md) between docs
        wikilinks: false,         // Detect [[wikilinks]] (set true to map wikilink edges)
      },
    ],
  ],
};
```

---

### Obsidian & Wikilinks Setup (Recommended)
To support wikilink edges in the graph **and** compile wikilinks to standard clickable URLs on your live Docusaurus pages, configure the companion Remark plugin alongside the graph plugin in your `docusaurus.config.js`:

```javascript
const path = require('path');
// Import the companion Remark plugin
const wikilinkPlugin = require('docusaurus-plugin-graph-view/remark/wikilinkPlugin');

module.exports = {
  presets: [
    [
      'classic',
      {
        docs: {
          // Wire the remark plugin to convert [[wikilinks]] inside markdown pages
          remarkPlugins: [
            [wikilinkPlugin, { siteDir: __dirname, paths: ['docs'] }],
          ],
        },
      },
    ],
  ],
  plugins: [
    [
      'docusaurus-plugin-graph-view',
      {
        paths: ['docs'],
        wikilinks: true, // Enables wikilink edge mapping in the interactive graph
      },
    ],
  ],
};
```

---

## Styling Customization

You can fully customize the colors of the graph nodes, highlights, and connections to match your site's branding. Simply add these CSS custom variables to your site's `/src/css/custom.css` file:

```css
/* Color overrides for both light and dark modes */
:root {
  --graph-color-highlight: #a855f7;       /* Glowing highlights and floating particles */
  --graph-color-node-tag: #2ecc71;        /* Hub nodes representing tags */
  
  --graph-color-node-doc-light: #444444;  /* Document nodes in Light Mode */
  --graph-color-node-doc-dark: #888888;   /* Document nodes in Dark Mode */
  
  --graph-color-link-doc-light: #3b82f6;  /* Dashed Document Links in Light Mode */
  --graph-color-link-doc-dark: #60a5fa;   /* Dashed Document Links in Dark Mode */
  
  --graph-color-link-tag-light: rgba(0,0,0,0.25);       /* Solid Tag Links in Light Mode */
  --graph-color-link-tag-dark: rgba(255,255,255,0.25);  /* Solid Tag Links in Dark Mode */
}
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `paths` | `string[]` | `['docs']` | Content directories to scan for Markdown files. |
| `routePath` | `string` | `'/graph'` | URL route for the graph page. |
| `title` | `string` | `'Knowledge Graph'` | Page title shown in the browser tab. |
| `linkDetection` | `boolean` | `true` | Detect inline `[links](./path.md)` between docs and create edges. |
| `wikilinks` | `boolean` | `false` | Detect `[[wikilinks]]` for Obsidian-based workflows. |

---

## Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/whoisltd/docusaurus-plugin-graph-view/issues).

## License

MIT © [whoisltd](https://github.com/whoisltd)
