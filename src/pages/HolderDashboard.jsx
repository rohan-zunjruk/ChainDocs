import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'react-router-dom';
import { getHolderDocuments, getHolderDocumentsFromCache, generateShareableCredentials, claimDocumentAsNFT, importDocumentFromShareableData } from '../utils/solana';
import DocumentNotification from '../components/DocumentNotification';
import './HolderDashboard.css';

const HolderDashboard = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [shareableCredentials, setShareableCredentials] = useState(null);
  const [viewDetailsDocument, setViewDetailsDocument] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [newDocumentNotification, setNewDocumentNotification] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importing, setImporting] = useState(false);
  const previousDocumentIds = useRef(new Set());
  const [searchParams, setSearchParams] = useSearchParams();

  const handleImportDocument = async (code = null) => {
    const codeToImport = code || importCode.trim();
    
    if (!codeToImport) {
      alert('Please enter a shareable code');
      return;
    }

    setImporting(true);
    try {
      const result = importDocumentFromShareableData(codeToImport);
      
      if (result.success) {
        // Verify the document is for this holder
        if (publicKey && result.document.holder !== publicKey.toString()) {
          alert(`This document was issued to a different wallet address.\n\nDocument holder: ${result.document.holder}\nYour wallet: ${publicKey.toString()}`);
          setImporting(false);
          return;
        }

        // Close modal first
        setImportCode('');
        setShowImportModal(false);
        
        // Immediately reload documents from localStorage (without blockchain scan for speed)
        console.log('🔄 Reloading documents after import...');
        
        // Quick reload from localStorage only
        const allDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
        const holderDocs = allDocuments.filter(doc => {
          const docHolder = doc.holder ? doc.holder.toString() : '';
          return docHolder.toLowerCase() === publicKey.toString().toLowerCase();
        });
        
        // Sort by issue date
        holderDocs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        
        // Mark claimed status
        const claimedDocs = JSON.parse(localStorage.getItem('chaindocs_claimed') || '[]');
        const docsWithStatus = holderDocs.map(doc => ({
          ...doc,
          claimed: claimedDocs.includes(doc.documentId),
          nftMint: localStorage.getItem(`chaindocs_nft_${doc.documentId}`) || null,
        }));
        
        // Update state immediately
        setDocuments(docsWithStatus);
        console.log('✅ Documents updated in state:', docsWithStatus.length);
        
        // Also update previous document IDs
        const currentIds = new Set(docsWithStatus.map(d => d.documentId));
        previousDocumentIds.current = currentIds;
        
        // Show success message
        alert(`Document imported successfully!\n\nTitle: ${result.document.title}\n\nThe document should now appear in your documents list.`);
        
        // Try to scroll to the document after a short delay
        setTimeout(() => {
          const element = document.getElementById(`document-${result.document.documentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            console.log('⚠️ Document element not found, may need to scroll manually');
          }
        }, 500);
        
        // Also do a full reload in the background to sync with blockchain
        setTimeout(() => {
          loadDocuments();
        }, 1000);
      } else {
        alert(`Error importing document: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing document:', error);
      alert(`Error: ${error.message || 'Invalid document code'}`);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      // As soon as wallet is connected: show cached documents (including claimed NFTs)
      const cachedDocs = getHolderDocumentsFromCache(publicKey);
      if (cachedDocs.length > 0) {
        setDocuments(cachedDocs);
        previousDocumentIds.current = new Set(cachedDocs.map(d => d.documentId));
      }
      
      // When connection is ready, run full load (blockchain scan)
      if (connection) {
        loadDocuments();
      }
      
      // Check for import parameter in URL
      const importParam = searchParams.get('import');
      if (importParam) {
        handleImportDocument(importParam);
        setSearchParams({});
      }
      
      // Real-time monitoring for new documents (every 15 seconds)
      const interval = setInterval(() => {
        if (publicKey && connection) {
          checkForNewDocuments();
        }
      }, 15000);
      
      return () => clearInterval(interval);
    }
  }, [publicKey, connection]);

  // Separate function to check for new documents without full reload
  const checkForNewDocuments = async () => {
    if (!publicKey || !connection) return;
    
    try {
      const holderDocs = await getHolderDocuments(publicKey.toString(), connection);
      const currentIds = new Set(holderDocs.map(d => d.documentId));
      
      // Find new documents that weren't in the previous set
      const newDocs = holderDocs.filter(doc => !previousDocumentIds.current.has(doc.documentId));
      
      if (newDocs.length > 0) {
        // Sort by issue date (newest first)
        newDocs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        
        // Show notification for the newest document
        const newestDoc = newDocs[0];
        
        // Only show notification if document is not already claimed
        if (!newestDoc.claimed) {
          setNewDocumentNotification(newestDoc);
        }
        
        // Update documents list
        holderDocs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        setDocuments(holderDocs);
        
        // Update previous IDs
        previousDocumentIds.current = currentIds;
        
        console.log('🎉 New document detected:', newestDoc.title);
      } else {
        // Update previous IDs even if no new docs (in case of refresh)
        previousDocumentIds.current = currentIds;
        
        // Update documents list in case of changes (like claims)
        holderDocs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        setDocuments(holderDocs);
      }
    } catch (error) {
      // Silently fail for background checks to avoid spam
      if (!error.message.includes('429') && !error.message.includes('rate limit')) {
        console.log('Background check error:', error.message);
      }
    }
  };

  const loadDocuments = async () => {
    if (!publicKey || !connection) return;
    setLoading(true);
    setScanStatus('Scanning blockchain...');
    try {
      console.log('🔄 Loading documents for holder:', publicKey.toString());
      setScanStatus('Checking local cache...');
      
      // Query both local cache and blockchain
      // This will automatically discover documents issued to this holder
      setScanStatus('Scanning blockchain transactions... (rate-limited to avoid errors)');
      const holderDocs = await getHolderDocuments(publicKey.toString(), connection);
      
      console.log('📄 Documents loaded:', holderDocs.length);
      
      // Sort by issue date (newest first)
      holderDocs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
      
      // Update previous document IDs for notification tracking
      const currentIds = new Set(holderDocs.map(d => d.documentId));
      previousDocumentIds.current = currentIds;
      
      setDocuments(holderDocs);
      setScanStatus(null);
      
      if (holderDocs.length > 0) {
        console.log('✅ Documents displayed:', holderDocs.map(d => d.title));
      } else {
        console.log('ℹ️ No documents found. Make sure documents have been issued to this address.');
        setScanStatus('No documents found. Check console (F12) for details.');
      }
    } catch (error) {
      console.error('❌ Error loading documents:', error);
      
      let errorMessage = error.message || 'Unknown error';
      let statusMessage = `Error: ${errorMessage}`;
      
      // Handle rate limit errors specifically
      if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('slow down')) {
        statusMessage = '⚠️ Rate limited by server. Please wait a moment and try again.';
        errorMessage = 'Server is rate limiting requests. The scan will automatically retry with delays.';
      }
      
      setScanStatus(statusMessage);
      
      // Don't show alert for rate limit errors, just log
      if (!errorMessage.includes('429') && !errorMessage.includes('rate limit')) {
        alert(`Error loading documents: ${errorMessage}\n\nCheck browser console (F12) for details.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClaimDocument = async (document) => {
    if (!publicKey || !sendTransaction) {
      alert('Please connect your wallet');
      return;
    }

    if (document.claimed) {
      alert('This document has already been claimed!');
      return;
    }

    setClaiming(document.documentId);
    try {
      const result = await claimDocumentAsNFT(
        connection,
        { publicKey, sendTransaction },
        document
      );

      if (result.success) {
        alert(`Document claimed successfully as NFT!\n\nNFT Mint: ${result.nftMint}\nTransaction: ${result.transactionSignature}\n\nView on Explorer: https://explorer.solana.com/tx/${result.transactionSignature}?cluster=${getNetworkCluster()}`);
        // Reload documents to show updated claimed status
        await loadDocuments();
      } else {
        alert(`Error claiming document: ${result.error}`);
      }
    } catch (error) {
      console.error('Error claiming document:', error);
      alert(`Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setClaiming(null);
    }
  };

  const handleViewCredentials = (documentId) => {
    if (!publicKey) return;
    const credentials = generateShareableCredentials(documentId, publicKey);
    if (credentials) {
      setShareableCredentials(credentials);
      setSelectedDocument(documentId);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const getNetworkCluster = () => {
    const savedNetwork = localStorage.getItem('solana_network') || 'devnet';
    if (savedNetwork === 'mainnet-beta') return 'mainnet';
    if (savedNetwork === 'testnet') return 'testnet';
    return 'devnet';
  };

  if (!publicKey) {
    return (
      <div className="dashboard-container">
        <div className="connect-wallet-prompt">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your Solana wallet to view your documents</p>
        </div>
      </div>
    );
  }

  const handleNotificationClaim = async (document) => {
    // The claim is handled in DocumentNotification component
    // Just reload documents and dismiss notification
    await loadDocuments();
    setNewDocumentNotification(null);
    previousDocumentIds.current.add(document.documentId);
  };

  const handleNotificationDismiss = () => {
    setNewDocumentNotification(null);
  };

  return (
    <div className="dashboard-container">
      {/* New Document Notification */}
      {newDocumentNotification && (
        <DocumentNotification
          newDocument={newDocumentNotification}
          onClaim={handleNotificationClaim}
          onDismiss={handleNotificationDismiss}
        />
      )}

      <div className="dashboard-header">
        <div>
          <h1>
            My Documents
            {newDocumentNotification && (
              <span className="notification-badge" title="New document available!">
                🔔 New!
              </span>
            )}
          </h1>
          <p className="discovery-note">
            🔍 Automatically discovering documents issued to your wallet...
            {newDocumentNotification && (
              <span className="new-doc-indicator">
                {' '}New document available! Check the notification above.
              </span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-import" 
            onClick={() => setShowImportModal(true)}
            title="Import document using shareable code"
          >
            📥 Import Document
          </button>
          <button className="btn-secondary" onClick={loadDocuments} disabled={loading}>
            {loading ? '🔍 Scanning...' : '🔍 Scan'}
          </button>
        </div>
      </div>

      {scanStatus && (
        <div className="scan-status">
          <p>{scanStatus}</p>
        </div>
      )}

      {loading && documents.length === 0 ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Scanning blockchain for documents...</p>
          <p className="loading-detail">This may take a few moments</p>
          <p className="loading-detail">Requests are rate-limited to avoid server errors</p>
          <p className="loading-detail">Check browser console (F12) for progress</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h2>No Documents Found</h2>
          <p>No documents have been issued to your wallet address yet.</p>
          <p className="discovery-info">
            Documents will automatically appear here when an institution issues them to you.
            The system scans the blockchain every 60 seconds to discover new documents.
          </p>
          <div className="scan-help">
            <h4>How to find your documents:</h4>
            <ol>
              <li>Make sure an institution has issued a document to your wallet address: <code style={{fontSize: '0.85rem', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px'}}>{publicKey.toString()}</code></li>
              <li>Click "🔍 Scan for Documents" button above</li>
              <li>Wait for the scan to complete (checks recent blockchain transactions)</li>
              <li>Documents will appear automatically if found</li>
            </ol>
            <p className="help-note">
              💡 Tip: Documents are stored on-chain, so they can be discovered even if you haven't accessed the app before. Check the browser console (F12) for detailed scan logs.
            </p>
          </div>
          <button className="btn-secondary" onClick={loadDocuments} style={{ marginTop: '1rem' }}>
            🔍 Scan Now
          </button>
        </div>
      ) : (
        <>
          <div className="documents-section">
            <h2>Your Documents ({documents.length})</h2>
            
            {/* Unclaimed Documents */}
            {documents.filter(doc => !doc.claimed).length > 0 && (
              <div className="documents-subsection">
                <h3 className="subsection-title">
                  📬 Available to Claim ({documents.filter(doc => !doc.claimed).length})
                </h3>
            <div className="documents-grid">
              {documents.filter(doc => !doc.claimed).map((doc) => (
                <div 
                  key={doc.documentId} 
                  id={`document-${doc.documentId}`}
                  className={`document-card unclaimed-card ${newDocumentNotification && newDocumentNotification.documentId === doc.documentId ? 'highlight-new' : ''}`}
                >
                      <div className="document-header">
                        <span className="document-type">{doc.documentType}</span>
                        <span className="claim-badge">New</span>
                      </div>
                      <h3>{doc.title}</h3>
                      <div className="document-info">
                        <p><strong>Issuer:</strong> {doc.issuer.slice(0, 8)}...{doc.issuer.slice(-8)}</p>
                        <p><strong>Document ID:</strong> {doc.documentId.slice(0, 16)}...</p>
                        <p><strong>Issued:</strong> {new Date(doc.issueDate).toLocaleDateString()}</p>
                      </div>
                  <div className="document-actions">
                    <button
                      className="btn-claim"
                      onClick={() => handleClaimDocument(doc)}
                      disabled={claiming === doc.documentId}
                    >
                      {claiming === doc.documentId ? 'Claiming...' : '🎁 Claim as NFT'}
                    </button>
                    <button
                      className="btn-view-details"
                      onClick={() => {
                        setViewDetailsDocument(doc);
                        setNewDocumentNotification(null); // Dismiss notification when viewing
                      }}
                    >
                      View Details
                    </button>
                  </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Claimed Documents */}
            {documents.filter(doc => doc.claimed).length > 0 && (
              <div className="documents-subsection">
                <h3 className="subsection-title">
                  ✅ Claimed Documents ({documents.filter(doc => doc.claimed).length})
                </h3>
                <div className="documents-grid">
                  {documents.filter(doc => doc.claimed).map((doc) => (
                    <div key={doc.documentId} className="document-card claimed-card">
                      <div className="document-header">
                        <span className="document-type">{doc.documentType}</span>
                        <span className="nft-badge">NFT</span>
                      </div>
                      <h3>{doc.title}</h3>
                      <div className="document-info">
                        <p><strong>Issuer:</strong> {doc.issuer.slice(0, 8)}...{doc.issuer.slice(-8)}</p>
                        <p><strong>Document ID:</strong> {doc.documentId.slice(0, 16)}...</p>
                        {doc.nftMint && (
                          <p><strong>NFT Mint:</strong> {doc.nftMint.slice(0, 8)}...{doc.nftMint.slice(-8)}</p>
                        )}
                      </div>
                      <div className="document-actions">
                        <button
                          className="btn-primary"
                          onClick={() => handleViewCredentials(doc.documentId)}
                        >
                          View Credentials
                        </button>
                        <button
                          className="btn-view-details"
                          onClick={() => setViewDetailsDocument(doc)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {shareableCredentials && (
            <div className="credentials-modal">
              <div className="credentials-content">
                <h2>Shareable Credentials</h2>
                <p className="credentials-note">
                  Share these credentials to allow others to verify your document.
                </p>
                
                <div className="credential-item">
                  <label>Document ID</label>
                  <div className="credential-value">
                    <code>{shareableCredentials.documentId}</code>
                    <button
                      className="btn-copy"
                      onClick={() => copyToClipboard(shareableCredentials.documentId)}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="credential-item">
                  <label>Credential Hash</label>
                  <div className="credential-value">
                    <code>{shareableCredentials.credentialHash}</code>
                    <button
                      className="btn-copy"
                      onClick={() => copyToClipboard(shareableCredentials.credentialHash)}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="credential-item">
                  <label>Verification URL</label>
                  <div className="credential-value">
                    <code className="url">{shareableCredentials.verificationUrl}</code>
                    <button
                      className="btn-copy"
                      onClick={() => copyToClipboard(shareableCredentials.verificationUrl)}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="credentials-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setShareableCredentials(null);
                      setSelectedDocument(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {viewDetailsDocument && (
            <div className="document-details-modal">
              <div className="document-details-content">
                <div className="modal-header">
                  <h2>Document Details</h2>
                  <button
                    className="close-button"
                    onClick={() => setViewDetailsDocument(null)}
                  >
                    ×
                  </button>
                </div>
                
                <div className="details-section">
                  <h3>Document Information</h3>
                  <div className="detail-item">
                    <label>Title:</label>
                    <span>{viewDetailsDocument.title}</span>
                  </div>
                  <div className="detail-item">
                    <label>Type:</label>
                    <span className="capitalize">{viewDetailsDocument.documentType}</span>
                  </div>
                  <div className="detail-item">
                    <label>Issue Date:</label>
                    <span>{new Date(viewDetailsDocument.issueDate).toLocaleString()}</span>
                  </div>
                </div>

                <div className="details-section">
                  <h3>Blockchain Information</h3>
                  <div className="detail-item">
                    <label>Document ID:</label>
                    <div className="detail-value-with-copy">
                      <code>{viewDetailsDocument.documentId}</code>
                      <button
                        className="btn-copy-small"
                        onClick={() => copyToClipboard(viewDetailsDocument.documentId)}
                        title="Copy Document ID"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  
                  {viewDetailsDocument.transactionSignature && (
                    <>
                      <div className="detail-item">
                        <label>Issue Transaction:</label>
                        <div className="detail-value-with-copy">
                          <code className="transaction-sig">{viewDetailsDocument.transactionSignature}</code>
                          <button
                            className="btn-copy-small"
                            onClick={() => copyToClipboard(viewDetailsDocument.transactionSignature)}
                            title="Copy Transaction Signature"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                      <div className="detail-item">
                        <label>View Issue Transaction:</label>
                        <a
                          href={`https://explorer.solana.com/tx/${viewDetailsDocument.transactionSignature}?cluster=${getNetworkCluster()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="explorer-link"
                        >
                          Open in Solana Explorer ↗
                        </a>
                      </div>
                    </>
                  )}
                  
                  {viewDetailsDocument.claimed && viewDetailsDocument.nftMint && (
                    <>
                      <div className="detail-item">
                        <label>NFT Mint Address:</label>
                        <div className="detail-value-with-copy">
                          <code>{viewDetailsDocument.nftMint}</code>
                          <button
                            className="btn-copy-small"
                            onClick={() => copyToClipboard(viewDetailsDocument.nftMint)}
                            title="Copy NFT Mint"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                      <div className="detail-item">
                        <label>Claim Transaction:</label>
                        <div className="detail-value-with-copy">
                          <code className="transaction-sig">
                            {localStorage.getItem(`chaindocs_claim_tx_${viewDetailsDocument.documentId}`) || 'N/A'}
                          </code>
                          {localStorage.getItem(`chaindocs_claim_tx_${viewDetailsDocument.documentId}`) && (
                            <button
                              className="btn-copy-small"
                              onClick={() => copyToClipboard(localStorage.getItem(`chaindocs_claim_tx_${viewDetailsDocument.documentId}`))}
                              title="Copy Claim Transaction"
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="details-section">
                  <h3>Credential Information</h3>
                  <div className="detail-item">
                    <label>Credential Hash:</label>
                    <div className="detail-value-with-copy">
                      <code>{viewDetailsDocument.credentialHash}</code>
                      <button
                        className="btn-copy-small"
                        onClick={() => copyToClipboard(viewDetailsDocument.credentialHash)}
                        title="Copy Credential Hash"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <div className="detail-item">
                    <label>Verification URL:</label>
                    <div className="detail-value-with-copy">
                      <code className="verification-url">
                        {`${window.location.origin}/verify?hash=${viewDetailsDocument.credentialHash}&id=${viewDetailsDocument.documentId}`}
                      </code>
                      <button
                        className="btn-copy-small"
                        onClick={() => copyToClipboard(
                          `${window.location.origin}/verify?hash=${viewDetailsDocument.credentialHash}&id=${viewDetailsDocument.documentId}`
                        )}
                        title="Copy Verification URL"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                </div>

                <div className="details-section">
                  <h3>Status</h3>
                  <div className="detail-item">
                    <label>Claim Status:</label>
                    <span>
                      {viewDetailsDocument.claimed ? (
                        <span className="status-badge claimed-status">✅ Claimed as NFT</span>
                      ) : (
                        <span className="status-badge unclaimed-status">📬 Available to Claim</span>
                      )}
                    </span>
                  </div>
                  {viewDetailsDocument.claimed && viewDetailsDocument.nftMint && (
                    <div className="detail-item">
                      <label>NFT Mint Address:</label>
                      <div className="detail-value-with-copy">
                        <code>{viewDetailsDocument.nftMint}</code>
                        <button
                          className="btn-copy-small"
                          onClick={() => copyToClipboard(viewDetailsDocument.nftMint)}
                          title="Copy NFT Mint"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}
                  {!viewDetailsDocument.claimed && (
                    <div className="detail-item">
                      <button
                        className="btn-claim-large"
                        onClick={() => {
                          setViewDetailsDocument(null);
                          handleClaimDocument(viewDetailsDocument);
                        }}
                        disabled={claiming === viewDetailsDocument.documentId}
                      >
                        {claiming === viewDetailsDocument.documentId ? 'Claiming...' : '🎁 Claim as NFT'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="details-section">
                  <h3>Parties</h3>
                  <div className="detail-item">
                    <label>Issuer:</label>
                    <div className="detail-value-with-copy">
                      <code>{viewDetailsDocument.issuer}</code>
                      <button
                        className="btn-copy-small"
                        onClick={() => copyToClipboard(viewDetailsDocument.issuer)}
                        title="Copy Issuer Address"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <div className="detail-item">
                    <label>Holder (You):</label>
                    <div className="detail-value-with-copy">
                      <code>{viewDetailsDocument.holder}</code>
                      <button
                        className="btn-copy-small"
                        onClick={() => copyToClipboard(viewDetailsDocument.holder)}
                        title="Copy Holder Address"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                </div>

                {viewDetailsDocument.metadata && Object.keys(viewDetailsDocument.metadata).length > 0 && (
                  <div className="details-section">
                    <h3>Additional Metadata</h3>
                    <pre className="metadata-display">
                      {JSON.stringify(viewDetailsDocument.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setViewDetailsDocument(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {/* Import Document Modal - Always available */}
      {showImportModal && (
        <div className="import-modal">
          <div className="import-modal-content">
            <div className="modal-header">
              <h2>Import Document</h2>
              <button
                className="close-button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportCode('');
                }}
              >
                ×
              </button>
            </div>
            
            <div className="import-section">
              <p className="import-description">
                Paste the shareable code provided by the issuer to import the document into your wallet.
              </p>
              
              <div className="form-group">
                <label>Shareable Code *</label>
                <textarea
                  value={importCode}
                  onChange={(e) => setImportCode(e.target.value)}
                  placeholder="Paste the shareable code here..."
                  rows="6"
                  className="import-code-input"
                />
              </div>

              <div className="import-help">
                <h4>How to get the code:</h4>
                <ul>
                  <li>Ask the issuer to share the document credentials</li>
                  <li>They can use the "Share" button on their dashboard</li>
                  <li>Copy the shareable code or use the shareable link</li>
                  <li>Paste it here to import</li>
                </ul>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportCode('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => handleImportDocument()}
                  disabled={importing || !importCode.trim()}
                >
                  {importing ? 'Importing...' : 'Import Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HolderDashboard;
