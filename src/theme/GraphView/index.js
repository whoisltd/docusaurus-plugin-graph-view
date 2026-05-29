import React, { useState, useMemo } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useGlobalData from '@docusaurus/useGlobalData';
import styles from './styles.module.css';

const LINK_TYPE_CONFIG = {
  tag:  { color: '#888888', label: 'Tag Links',  icon: '●', dashLabel: 'solid' },
  link: { color: '#3b82f6', label: 'Doc Links',  icon: '●', dashLabel: 'dashed' },
};

export default function GraphView() {
  const globalData = useGlobalData();
  const pluginData = globalData['docusaurus-plugin-graph-view']?.['default'] || {};
  const { graphData: data, docLinks = {} } = pluginData;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [visibleLinkTypes, setVisibleLinkTypes] = useState(new Set(['tag', 'link']));

  // Count edges by type
  const linkTypeCounts = useMemo(() => {
    if (!data) return {};
    const counts = {};
    data.links.forEach(l => {
      const type = l.type || 'tag';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [data]);

  // Only show filter options for types that exist in the data
  const availableLinkTypes = useMemo(() => {
    return Object.keys(LINK_TYPE_CONFIG).filter(type => linkTypeCounts[type] > 0);
  }, [linkTypeCounts]);

  const toggleLinkType = (type) => {
    setVisibleLinkTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow hiding all types
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };
  
  const linkedDocs = useMemo(() => {
    if (!selectedNode || !data) return [];
    const nodeIds = new Set();
    data.links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === selectedNode.id) nodeIds.add(t);
      if (t === selectedNode.id) nodeIds.add(s);
    });
    return data.nodes.filter(n => 
      nodeIds.has(n.id) && 
      n.group !== 'category' && 
      (selectedNode.group === 'tags' ? n.group !== 'tags' : n.group === 'tags')
    );
  }, [selectedNode, data]);

  // Get doc-to-doc linked documents (non-tag connections)
  const linkedByDocLink = useMemo(() => {
    if (!selectedNode || !data || selectedNode.group === 'tags') return [];
    const nodeIds = new Set();
    data.links.forEach(l => {
      const type = l.type || 'tag';
      if (type === 'tag') return; // skip tag edges
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === selectedNode.id) nodeIds.add(t);
      if (t === selectedNode.id) nodeIds.add(s);
    });
    return data.nodes.filter(n => 
      nodeIds.has(n.id) && n.group !== 'tags'
    );
  }, [selectedNode, data]);

  const searchResults = useMemo(() => {
    if (!data || !searchTerm || searchTerm.length < 2) return null;
    const term = searchTerm.toLowerCase();
    const matches = data.nodes.filter(n => 
      n.name.toLowerCase().includes(term) && 
      n.group !== 'category' && 
      n.group !== 'Uncategorized'
    );
    
    return {
      tags: matches.filter(n => n.group === 'tags'),
      notes: matches.filter(n => n.group !== 'tags')
    };
  }, [data, searchTerm]);

  const getDocUrl = (node) => {
    if (!node || node.group === 'tags') return null;
    return node.url || null;
  };

  const selectedNodeUrl = getDocUrl(selectedNode);

  return (
    <Layout title='Knowledge Graph' description='Interactive graph view of my second brain'>
      <div className={styles.explorerContainer}>
        <div className={styles.graphWrapper}>
          <div className={styles.graphContainer}>
            {data ? (
              <BrowserOnly fallback={<div className={styles.loading}>Loading graph...</div>}>
                {() => {
                  const GraphCanvas = require('../GraphCanvas').default;
                  return (
                    <GraphCanvas 
                      data={data} 
                      searchTerm={searchTerm} 
                      onNodeClick={setSelectedNode}
                      selectedNode={selectedNode}
                      visibleLinkTypes={visibleLinkTypes}
                    />
                  );
                }}
              </BrowserOnly>
            ) : (
              <div className={styles.loading}>Loading graph...</div>
            )}
            
            <div className={styles.controlPanel}>
              <div className={styles.searchSection}>
                <input 
                  type='text' 
                  placeholder='Search tags or notes...' 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchBar}
                />
                
                {searchResults && (
                  <div className={styles.resultsDropdown}>
                    {searchResults.tags.length > 0 && (
                      <div className={styles.resultGroup}>
                        <div className={styles.resultLabel}>Tags</div>
                        {searchResults.tags.slice(0, 5).map(tag => (
                          <div key={tag.id} className={styles.resultItem} onClick={() => { setSelectedNode(tag); setSearchTerm(''); }}>
                            # {tag.name.replace('#', '')}
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.notes.length > 0 && (
                      <div className={styles.resultGroup}>
                        <div className={styles.resultLabel}>Notes</div>
                        {searchResults.notes.slice(0, 10).map(note => (
                          <div key={note.id} className={styles.resultItem} onClick={() => { setSelectedNode(note); setSearchTerm(''); }}>
                            📄 {note.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Link Type Filters */}
              {availableLinkTypes.length > 1 && (
                <div className={styles.filterSection}>
                  <h4>Connections</h4>
                  <div className={styles.filterList}>
                    {availableLinkTypes.map(type => {
                      const config = LINK_TYPE_CONFIG[type];
                      const isActive = visibleLinkTypes.has(type);
                      return (
                        <button
                          key={type}
                          className={`${styles.filterBtn} ${isActive ? styles.filterBtnActive : ''}`}
                          onClick={() => toggleLinkType(type)}
                          title={`${isActive ? 'Hide' : 'Show'} ${config.label}`}
                        >
                          <span className={styles.filterLine} data-type={type} style={{ borderColor: config.color }} />
                          <span className={styles.filterLabel}>{config.label}</span>
                          <span className={styles.filterCount}>{linkTypeCounts[type]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={styles.legend}>
                <h4>Nodes</h4>
                <ul>
                  <li><span className={styles.legendColor} style={{background: '#444444'}}></span> Documents</li>
                  <li><span className={styles.legendColor} style={{background: '#2ecc71'}}></span> Tags</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {selectedNode && (
          <div className={styles.sideDock}>
            <button 
              className={styles.closeBtn} 
              onClick={() => setSelectedNode(null)}
            >
              ×
            </button>
            <div className={styles.nodeType}>
              {selectedNode.group === 'tags' ? 'TAG' : 'DOCUMENT'}
            </div>
            <h2 className={styles.nodeTitle}>
              {selectedNode.name}
            </h2>
            
            {selectedNode.group === 'tags' && linkedDocs.length > 0 && (
              <div className={styles.connectionSection}>
                <h3>Linked Documents</h3>
                <ul className={styles.linkedList}>
                  {linkedDocs.map(doc => (
                    <li key={doc.id} onClick={() => setSelectedNode(doc)} className={styles.linkedItem}>
                      📄 {doc.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedNode.group !== 'tags' && (
              <div className={styles.tagList}>
                {selectedNode.tags && selectedNode.tags.map(tag => (
                  <span key={tag} className={styles.tag}>#{tag}</span>
                ))}
              </div>
            )}

            {selectedNode.group !== 'tags' && linkedByDocLink.length > 0 && (
              <div className={styles.connectionSection}>
                <h3>🔗 Linked Documents</h3>
                <ul className={styles.linkedList}>
                  {linkedByDocLink.map(doc => (
                    <li key={doc.id} onClick={() => setSelectedNode(doc)} className={styles.linkedItem}>
                      📄 {doc.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {selectedNode.summary && (
              <div className={styles.summarySection}>
                <h3>Preview</h3>
                <div className={styles.summaryContent}>
                  {selectedNode.summary}
                </div>
              </div>
            )}
            
            {selectedNode.group !== 'tags' && selectedNodeUrl && (
              <div className={styles.actionSection}>
                <a href={selectedNodeUrl} className={styles.readMore}>
                  Read Full Page →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}