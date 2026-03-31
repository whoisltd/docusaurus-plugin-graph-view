const path = require('path');
const fs = require('fs');
const grayMatter = require('gray-matter');

module.exports = function (context, options) {
  const { siteDir } = context;
  const { 
    paths = ['docs'], 
    routePath = '/graph',
    title = 'Knowledge Graph'
  } = options;

  return {
    name: 'docusaurus-plugin-graph-view',

    async loadContent() {
      const nodes = [];
      const edges = [];
      const docLinks = {};
      
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

      // Scan all configured paths
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

          nodes.push({
            id: docId,
            name: nodeTitle,
            group: p,
            url: route,
            summary: markdown.slice(0, 300).replace(/[#*`]/g, '').trim() + '...',
            tags: data.tags || []
          });

          // Build tag nodes
          (data.tags || []).forEach(tag => {
            const tagId = `tag:${tag}`;
            if (!nodes.find(n => n.id === tagId)) {
              nodes.push({ id: tagId, name: `#${tag}`, group: 'tags' });
            }
            edges.push({ source: docId, target: tagId });
          });
        });
      });

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