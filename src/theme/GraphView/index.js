import React, { useState, useMemo } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useGlobalData from '@docusaurus/useGlobalData';
import styles from './styles.module.css';

export default function GraphView() {
  const globalData = useGlobalData();
  const pluginData = globalData['docusaurus-plugin-graph-view']?.['default'] || {};
  const { graphData: data, docLinks = {} } = pluginData;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  
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

              <div className={styles.legend}>
                <h4>Legend</h4>
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