/**
 * Remark plugin to convert Obsidian-style [[wikilinks]] to standard markdown links.
 * 
 * Supports:
 *   [[filename]]                → [filename](./resolved-path.md)
 *   [[filename|Display Text]]   → [Display Text](./resolved-path.md)
 *   [[filename#heading]]        → [filename](./resolved-path.md#heading)
 *   [[filename#heading|alias]]  → [alias](./resolved-path.md#heading)
 * 
 * Usage in docusaurus.config.js:
 *   const wikilinkPlugin = require('docusaurus-plugin-graph-view/remark/wikilinkPlugin');
 *   
 *   presets: [['classic', {
 *     docs: {
 *       remarkPlugins: [[wikilinkPlugin, { siteDir: __dirname }]],
 *     },
 *   }]],
 */

const fs = require('fs');
const path = require('path');

// Cache file map across invocations (rebuilt once per build)
let cachedFileMap = null;
let cachedSiteDir = null;

function buildFileMap(siteDir, docsPaths) {
  const map = {};

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir);
    entries.forEach(name => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(md|mdx)$/.test(name)) {
        const baseName = path.basename(name).replace(/\.(md|mdx)$/, '');
        // Map by lowercase filename for case-insensitive resolution
        // If there are duplicates, last one wins (same as Obsidian behavior)
        map[baseName.toLowerCase()] = full;
      }
    });
  }

  docsPaths.forEach(p => {
    const docsDir = path.isAbsolute(p) ? p : path.join(siteDir, p);
    walk(docsDir);
  });

  return map;
}

function slugifyHeading(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

/**
 * Split a text string containing [[wikilinks]] into an array of text and link AST nodes.
 */
function splitWikilinks(text, currentFile, fileMap) {
  const regex = /(?<!!)\[\[([^\]]+)\]\]/g;
  const nodes = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the wikilink
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const raw = match[1];
    const pipeIdx = raw.indexOf('|');
    const targetAndHeading = pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw;
    const alias = pipeIdx >= 0 ? raw.slice(pipeIdx + 1).trim() : '';

    const hashIdx = targetAndHeading.indexOf('#');
    const target = (hashIdx >= 0 ? targetAndHeading.slice(0, hashIdx) : targetAndHeading).trim();
    const heading = hashIdx >= 0 ? targetAndHeading.slice(hashIdx + 1).trim() : '';

    // Resolve target file
    const targetFile = target ? fileMap[target.toLowerCase()] : null;

    if (targetFile) {
      // Calculate relative path from current file to target
      let relativePath = path.relative(path.dirname(currentFile), targetFile)
        .split(path.sep).join('/');
      // Strip .md/.mdx extension — Docusaurus routes don't use them
      relativePath = relativePath.replace(/\.(md|mdx)$/, '');
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
      }

      const anchor = heading ? '#' + slugifyHeading(heading) : '';
      const displayName = alias || heading || path.basename(targetFile).replace(/\.(md|mdx)$/, '');
      const url = relativePath + anchor;

      nodes.push({
        type: 'link',
        url: url,
        children: [{ type: 'text', value: displayName }],
      });
    } else {
      // Unresolved wikilink — keep as plain text
      nodes.push({ type: 'text', value: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', value: text }];
}

/**
 * Recursively process AST nodes, replacing text nodes containing [[wikilinks]]
 * with a mix of text and link nodes.
 */
function processNode(node, currentFile, fileMap) {
  if (!node.children) return;

  const newChildren = [];
  let changed = false;

  for (const child of node.children) {
    // Only process text nodes that contain [[ and are not inside code/links
    if (child.type === 'text' && child.value.includes('[[')) {
      const parts = splitWikilinks(child.value, currentFile, fileMap);
      if (parts.length !== 1 || parts[0].type !== 'text' || parts[0].value !== child.value) {
        newChildren.push(...parts);
        changed = true;
        continue;
      }
    }

    // Skip code blocks and inline code — don't process wikilinks inside them
    if (child.type !== 'code' && child.type !== 'inlineCode') {
      processNode(child, currentFile, fileMap);
    }

    newChildren.push(child);
  }

  if (changed) {
    node.children = newChildren;
  }
}

function wikilinkPlugin(options = {}) {
  const { siteDir = process.cwd(), paths: docsPaths = ['docs'] } = options;

  return (tree, vfile) => {
    // Build file map once per build
    if (!cachedFileMap || cachedSiteDir !== siteDir) {
      cachedFileMap = buildFileMap(siteDir, docsPaths);
      cachedSiteDir = siteDir;
    }

    // Get the current file path from vfile
    const currentFile = vfile.path || (vfile.history && vfile.history[vfile.history.length - 1]);
    if (!currentFile) return;

    processNode(tree, currentFile, cachedFileMap);
  };
}

module.exports = wikilinkPlugin;
