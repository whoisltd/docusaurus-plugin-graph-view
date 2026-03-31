# docusaurus-plugin-graph-view

> An interactive knowledge graph for your Docusaurus site.

## Features
- **Core Mechanics:** Elastic dragging, 2D Canvas rendering, and reactive highlighting.
- **Smart Readability:** Semantic zooming hides labels until you zoom close or hover.
- **Multi-Path Scanning:** Aggregate notes from multiple directories (e.g., `docs` and `blog`).
- **Deep Navigation:** Automatic URL mapping for nested folder structures.
- **Zero-Config Previews:** Hover over nodes to see summaries of your content.

## Installation

```bash
npm install docusaurus-plugin-graph-view
```

## Usage

Add the plugin to your `docusaurus.config.js`:

```javascript
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-graph-view',
      {
        paths: ['docs'], // Directories to scan
        routePath: '/graph', // Where the graph will live
        title: 'Knowledge Graph', // Page and Navbar title
      },
    ],
  ],
};
```

## License
MIT © [whoisltd](https://github.com/whoisltd)
