import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';

const LINK_STYLES = {
  tag:  { dash: null,   label: 'Tag' },
  link: { dash: [6, 3], label: 'Doc Link' },
};

export default function GraphCanvas({ data, searchTerm, onNodeClick, selectedNode, visibleLinkTypes }) {
  const fgRef = useRef();
  const [ForceGraph2D, setForceGraph2D] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  // Dynamic CSS variable colors state for standard Docusaurus custom styling compatibility
  const [colors, setColors] = useState({
    purple: '#a855f7',
    hubGreen: '#2ecc71',
    docLight: '#444444',
    docDark: '#888888',
    linkTagLight: 'rgba(0,0,0,0.25)',
    linkTagDark: 'rgba(255,255,255,0.25)',
    linkDocLight: '#3b82f6',
    linkDocDark: '#60a5fa'
  });

  useEffect(() => {
    import('react-force-graph-2d').then(mod => {
      setForceGraph2D(() => mod.default);
    });
  }, []);

  // Sync theme-specific custom CSS variables dynamically with high performance (reads once on theme switch)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readCssVar = (name, fallback) => {
      const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return val || fallback;
    };

    const updateColors = () => {
      setColors({
        purple: readCssVar('--graph-color-highlight', '#a855f7'),
        hubGreen: readCssVar('--graph-color-node-tag', '#2ecc71'),
        docLight: readCssVar('--graph-color-node-doc-light', '#444444'),
        docDark: readCssVar('--graph-color-node-doc-dark', '#888888'),
        linkTagLight: readCssVar('--graph-color-link-tag-light', 'rgba(0,0,0,0.25)'),
        linkTagDark: readCssVar('--graph-color-link-tag-dark', 'rgba(255,255,255,0.25)'),
        linkDocLight: readCssVar('--graph-color-link-doc-light', '#3b82f6'),
        linkDocDark: readCssVar('--graph-color-link-doc-dark', '#60a5fa')
      });
    };

    updateColors();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateColors();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  // Pre-process data and build adjacency list for O(1) neighbor lookup
  const { graphData, adjacencyList } = useMemo(() => {
    if (!data) return { graphData: { nodes: [], links: [] }, adjacencyList: new Map() };
    
    // Filter out category and folder nodes
    const filteredNodes = data.nodes.filter(n => 
      n.group !== 'category' && n.group !== 'Uncategorized'
    ).map(n => ({ ...n }));
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Filter links: keep only visible types and links between existing nodes
    const filteredLinks = data.links.filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      const typeVisible = !visibleLinkTypes || visibleLinkTypes.has(l.type || 'tag');
      return nodeIds.has(s) && nodeIds.has(t) && typeVisible;
    }).map(l => ({ ...l }));

    const adj = new Map();
    const degreeMap = new Map();

    filteredLinks.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      
      degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
      degreeMap.set(t, (degreeMap.get(t) || 0) + 1);

      if (!adj.has(s)) adj.set(s, new Set());
      if (!adj.has(t)) adj.set(t, new Set());
      adj.get(s).add(t);
      adj.get(t).add(s);
    });
    
    filteredNodes.forEach(n => {
      n.degree = degreeMap.get(n.id) || 1;
    });
    
    return { graphData: { nodes: filteredNodes, links: filteredLinks }, adjacencyList: adj };
  }, [data, visibleLinkTypes]);

  const radiusScale = useMemo(() => {
    const tagNodes = graphData.nodes.filter(n => n.group === 'tags');
    if (!tagNodes.length) return () => 6;
    const maxDegree = Math.max(1, ...tagNodes.map(n => n.degree || 1));
    return d3.scaleLog().domain([1, maxDegree]).range([4, 12]);
  }, [graphData]);

  const lowerSearchTerm = useMemo(() => searchTerm?.toLowerCase(), [searchTerm]);

  const handleNodeHover = node => {
    const hNodes = new Set();
    const hLinks = new Set();

    if (node) {
      hNodes.add(node.id);
      const neighbors = adjacencyList.get(node.id);
      if (neighbors) {
        neighbors.forEach(neighborId => hNodes.add(neighborId));
      }
      
      graphData.links.forEach(link => {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        if (s === node.id || t === node.id) {
          hLinks.add(link);
        }
      });
    }

    // Set cursor affordance when hovering over nodes
    if (typeof document !== 'undefined') {
      document.body.style.cursor = node ? 'pointer' : 'default';
    }

    setHoverNode(node);
    setHighlightNodes(hNodes);
    setHighlightLinks(hLinks);
  };

  useEffect(() => {
    if (!fgRef.current || !ForceGraph2D) return;
    
    fgRef.current.d3Force('charge').strength(-150);
    fgRef.current.d3Force('link').distance(30).strength(1.0);
    fgRef.current.d3Force('x', d3.forceX().strength(0.1));
    fgRef.current.d3Force('y', d3.forceY().strength(0.1));
    fgRef.current.d3Force('center', d3.forceCenter());
    fgRef.current.d3Force('collide', d3.forceCollide(d => (d.group === 'tags' ? radiusScale(d.degree) : 3.5) + 6));
    
    const timer = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 100);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [graphData, ForceGraph2D]);

  // Smooth camera centering and zooming on selected node
  useEffect(() => {
    if (!fgRef.current || !ForceGraph2D) return;

    if (selectedNode) {
      // Find coordinates from the active simulation nodes
      const activeNode = graphData.nodes.find(n => n.id === selectedNode.id);
      if (activeNode && typeof activeNode.x === 'number' && typeof activeNode.y === 'number') {
        fgRef.current.centerAt(activeNode.x, activeNode.y, 800);
        fgRef.current.zoom(2.2, 800);
      }
    } else {
      fgRef.current.zoomToFit(400, 100);
    }
  }, [selectedNode, graphData, ForceGraph2D]);

  const paintNode = (node, ctx, globalScale) => {
    const isDark = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
    const isTag = node.group === 'tags';
    const radius = isTag ? radiusScale(node.degree) : 3.5;
    
    const isHighlighted = highlightNodes.has(node.id);
    const isMatched = lowerSearchTerm && node.name.toLowerCase().includes(lowerSearchTerm);
    const hasSearch = lowerSearchTerm && lowerSearchTerm.length > 0;

    let alpha = 1.0;
    if (hoverNode) {
      alpha = isHighlighted ? 1.0 : 0.15;
    } else if (hasSearch) {
      alpha = isMatched ? 1.0 : 0.05;
    }
    ctx.globalAlpha = alpha;

    if (isMatched) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI, false);
      ctx.strokeStyle = isDark ? '#fff' : '#000';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    const highlightColor = colors.purple;
    const tagColor = colors.hubGreen;
    const docColor = isDark ? colors.docDark : colors.docLight;

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = (node === hoverNode || (isHighlighted && hoverNode)) ? highlightColor : (isTag ? tagColor : docColor);
    ctx.fill();

    const label = node.name;
    const fontSize = 12 / globalScale;
    const showLabel = isTag || (isHighlighted && hoverNode) || isMatched || globalScale > 2.5;
    
    if (showLabel) {
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isDark ? '#ddd' : '#333';
      
      const labelOpacity = (isTag || (isHighlighted && hoverNode) || isMatched) 
        ? 1 
        : Math.min(1, (globalScale - 2.5) * 2);
        
      ctx.globalAlpha = alpha * labelOpacity;
      if (ctx.globalAlpha > 0.1) {
        ctx.fillText(label, node.x, node.y + radius + 2);
      }
    }
    ctx.globalAlpha = 1;
  };

  // Custom link rendering with dashed/dotted styles per type
  const paintLink = (link, ctx, globalScale) => {
    const isDark = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
    const isHighlighted = highlightLinks.has(link);
    const style = LINK_STYLES[link.type] || LINK_STYLES.tag;

    const source = link.source;
    const target = link.target;
    if (!source || !target || source.x == null || target.x == null) return;

    ctx.beginPath();
    
    if (style.dash && !isHighlighted) {
      ctx.setLineDash(style.dash.map(v => v / Math.max(globalScale * 0.5, 0.5)));
    } else {
      ctx.setLineDash([]);
    }

    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    
    const highlightColor = colors.purple;
    const linkColors = link.type === 'link' 
      ? { light: colors.linkDocLight, dark: colors.linkDocDark }
      : { light: colors.linkTagLight, dark: colors.linkTagDark };

    if (isHighlighted) {
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 2 / globalScale;
    } else {
      ctx.strokeStyle = isDark ? linkColors.dark : linkColors.light;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1 / globalScale;
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };

  if (!ForceGraph2D) return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Graph Engine...</div>;

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        onNodeHover={handleNodeHover}
        onNodeClick={onNodeClick}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={paintLink}
        linkDirectionalParticles={link => highlightLinks.has(link) ? 2 : 0}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={() => colors.purple}
      />
    </div>
  );
}