const path = require('path');
const fs = require('fs');
const grayMatter = require('gray-matter');

module.exports = function (context, options) {
  const { siteDir } = context;
  const { 
    paths = ['docs'], 
    routePath = '/graph',
    title = 'Knowledge Graph',
    linkDetection = true,
    wikilinks = false,
  } = options;

  return {
    name: 'docusaurus-plugin-graph-view',

    async loadContent() {
      const nodes = [];
      const edges = [];
      const docLinks = {};
      const seenEdges = new Set();

      // Lookup maps for link resolution (populated in Pass 1)
      const filePathToDocId = {};  // absolute file path → docId
      const titleToDocId = {};     // lowercase title → docId

      // Helper to walk directories
      function walk(dir) {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) results = results.concat(walk(fullPath));
          else if (file.endsWith('.md') || file.endsWith('.mdx')) results.push(fullPath);
        });
        return results;
      }

      // Helper to add a deduplicated edge with type
      function addEdge(source, target, type = 'tag') {
        if (source === target) return;
        const key = `${source}|${target}|${type}`;
        const reverseKey = `${target}|${source}|${type}`;
        if (seenEdges.has(key) || seenEdges.has(reverseKey)) return;
        seenEdges.add(key);
        edges.push({ source, target, type });
      }

      // Collect all files with their parsed content
      const allDocs = [];

      // ──────────────────────────────────────────────
      // Pass 1: Collect all nodes and build lookup maps
      // ──────────────────────────────────────────────
      paths.forEach(p => {
        const fullPath = path.isAbsolute(p) ? p : path.join(siteDir, p);
        if (!fs.existsSync(fullPath)) return;

        const files = walk(fullPath);
        files.forEach(file => {
          const content = fs.readFileSync(file, 'utf8');
          const { data, content: markdown } = grayMatter(content);
          
          // Determine URL: Preserve directory structure even if slug is present
          const relativePath = path.relative(fullPath, file);
          const dirName = path.dirname(relativePath);
          const baseName = path.basename(relativePath).replace(/\.(md|mdx)$/, '');
          
          const slug = data.slug || baseName;
          
          let route;
          if (slug.startsWith('/')) {
            route = slug;
          } else {
            const folderPart = dirName === '.' ? '' : `/${dirName}`;
            route = `/${p}${folderPart}/${slug}`.replace(/\\/g, '/');
          }
          
          // Clean up route
          route = route.replace(/\/index$/, '');
          
          const docId = `doc:${route}`;
          const nodeTitle = data.title || slug.split('/').pop();
          
          docLinks[nodeTitle] = route;
          if (data.slug) docLinks[slug] = route;

          // Build lookup maps
          filePathToDocId[file] = docId;
          titleToDocId[nodeTitle.toLowerCase()] = docId;
          // Also map by filename without extension for wikilink resolution
          titleToDocId[baseName.toLowerCase()] = docId;

          nodes.push({
            id: docId,
            name: nodeTitle,
            group: p,
            url: route,
            summary: markdown.slice(0, 300).replace(/[#*`]/g, '').trim() + '...',
            tags: data.tags || []
          });

          // Build tag nodes and edges
          (data.tags || []).forEach(tag => {
            const tagId = `tag:${tag}`;
            if (!nodes.find(n => n.id === tagId)) {
              nodes.push({ id: tagId, name: `#${tag}`, group: 'tags' });
            }
            addEdge(docId, tagId, 'tag');
          });

          // Store doc info for Pass 2
          allDocs.push({ file, fullPath, docId, markdown, data });
        });
      });

      // ──────────────────────────────────────────────
      // Pass 2: Extract inline link edges
      // ──────────────────────────────────────────────
      if (linkDetection) {
        allDocs.forEach(({ file, docId, markdown }) => {
          // --- Markdown links: [label](./relative-path.md) ---
          const mdLinkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
          let match;

          while ((match = mdLinkRegex.exec(markdown)) !== null) {
            const rawTarget = match[2].trim();

            // Skip external URLs, anchors-only, protocol links
            if (/^(https?:|mailto:|tel:|#|\/\/)/i.test(rawTarget)) continue;

            // Clean the target: remove query strings, anchors, and markdown link titles
            const cleanTarget = decodeURI(rawTarget.split(/[?#\s]/)[0]).replace(/\\/g, '/');
            if (!cleanTarget) continue;

            // Resolve relative to current file's directory
            const currentDir = path.dirname(file);
            const targetPath = path.resolve(currentDir, cleanTarget);

            // Try exact match first
            let targetDocId = filePathToDocId[targetPath];

            // If no match, try appending .md / .mdx extensions
            if (!targetDocId && !path.extname(cleanTarget)) {
              targetDocId = filePathToDocId[targetPath + '.md'] 
                         || filePathToDocId[targetPath + '.mdx'];
            }

            if (targetDocId) {
              addEdge(docId, targetDocId, 'link');
            }
          }

          // --- Wikilinks: [[target]] or [[target|alias]] or [[target#heading]] ---
          if (wikilinks) {
            const wikiRegex = /(?<!!)\[\[([^\]]+)\]\]/g;
            let wikiMatch;

            while ((wikiMatch = wikiRegex.exec(markdown)) !== null) {
              const rawTarget = wikiMatch[1];
              // Parse: [[target#heading|alias]]
              const [targetAndHeading] = rawTarget.split('|');
              const [target] = targetAndHeading.split('#');
              const cleanTarget = target.trim();
              if (!cleanTarget) continue;

              // Lookup by title or filename (case-insensitive)
              const targetDocId = titleToDocId[cleanTarget.toLowerCase()];

              if (targetDocId) {
                addEdge(docId, targetDocId, 'link');
              }
            }
          }
        });
      }

      return { graphData: { nodes, links: edges }, docLinks };
    },

    async contentLoaded({ content, actions }) {
      const { setGlobalData, addRoute } = actions;
      
      // Make data available globally
      setGlobalData(content);

      // Inject the graph page
      addRoute({
        path: routePath,
        component: path.resolve(__dirname, './src/theme/GraphView'),
        exact: true,
      });
    },

    getThemePath() {
      return path.resolve(__dirname, './src/theme');
    },
  };
};