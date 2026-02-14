import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { issueDocument, getIssuerDocuments, generateShareableDocumentData } from '../utils/solana';
import './IssuerDashboard.css';

const IssuerDashboard = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [shareDocument, setShareDocument] = useState(null);
  const [formData, setFormData] = useState({
    holderPublicKey: '',
    documentType: 'certificate',
    title: '',
    description: '',
    metadata: '',
  });

  React.useEffect(() => {
    if (publicKey) {
      loadDocuments();
    }
  }, [publicKey]);

  const loadDocuments = async () => {
    if (!publicKey) return;
    const issuerDocs = await getIssuerDocuments(publicKey.toString());
    setDocuments(issuerDocs);
  };

  const getNetworkCluster = () => {
    const savedNetwork = localStorage.getItem('solana_network') || 'devnet';
    if (savedNetwork === 'mainnet-beta') return 'mainnet';
    if (savedNetwork === 'testnet') return 'testnet';
    return 'devnet';
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!publicKey) {
      alert('Please connect your wallet');
      return;
    }

    setLoading(true);
    try {
      // Use the connection from wallet adapter context (already configured for the selected network)
      const documentData = {
        holderPublicKey: formData.holderPublicKey,
        type: formData.documentType,
        title: formData.title,
        description: formData.description,
        metadata: formData.metadata ? JSON.parse(formData.metadata) : {},
      };

      const result = await issueDocument(
        connection,
        { publicKey, sendTransaction },
        formData.holderPublicKey,
        documentData
      );

      if (result.success) {
        // Clear form and reload documents
        setFormData({
          holderPublicKey: '',
          documentType: 'certificate',
          title: '',
          description: '',
          metadata: '',
        });
        setShowForm(false);
        
        // Reload documents to get the latest data including transaction signature
        await loadDocuments();
        
        // Find the newly created document to show in modal
        const updatedDocs = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
        const latestDoc = updatedDocs.find(doc => doc.documentId === result.documentId);
        
        if (latestDoc) {
          // Auto-open details modal for the new document
          setTimeout(() => {
            setSelectedDocument(latestDoc);
          }, 300);
        }
        
        alert(`Document issued successfully! The details modal will open automatically.`);
      } else {
        alert(`Error: ${result.error || 'Unknown error occurred'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error.message || error.toString() || 'Unknown error occurred';
      alert(`Error issuing document: ${errorMessage}\n\nMake sure:\n- Your wallet has devnet SOL\n- Your wallet is connected to Devnet\n- You approved the transaction`);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="dashboard-container">
        <div className="connect-wallet-prompt">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your Solana wallet to issue documents</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Issuer Dashboard</h1>
        <button 
          className="btn-primary" 
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Issue New Document'}
        </button>
      </div>

      {showForm && (
        <div className="issue-form">
          <h2>Issue New Document</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Holder's Public Key *</label>
              <input
                type="text"
                value={formData.holderPublicKey}
                onChange={(e) => setFormData({ ...formData, holderPublicKey: e.target.value })}
                placeholder="Enter holder's Solana public key"
                required
              />
            </div>

            <div className="form-group">
              <label>Document Type *</label>
              <select
                value={formData.documentType}
                onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                required
              >
                <option value="certificate">Certificate</option>
                <option value="diploma">Diploma</option>
                <option value="license">License</option>
                <option value="credential">Credential</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Bachelor of Science in Computer Science"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about the document"
                rows="4"
              />
            </div>

            <div className="form-group">
              <label>Additional Metadata (JSON)</label>
              <textarea
                value={formData.metadata}
                onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                placeholder='{"grade": "A+", "institution": "University Name"}'
                rows="3"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Issuing...' : 'Issue Document'}
            </button>
          </form>
        </div>
      )}

      <div className="documents-section">
        <h2>Issued Documents ({documents.length})</h2>
        {documents.length === 0 ? (
          <div className="empty-state">
            <p>No documents issued yet. Issue your first document above.</p>
          </div>
        ) : (
          <div className="documents-grid">
            {documents.map((doc) => (
              <div key={doc.documentId} className="document-card">
                <div className="document-header">
                  <span className="document-type">{doc.documentType}</span>
                  <span className="document-date">
                    {new Date(doc.issueDate).toLocaleDateString()}
                  </span>
                </div>
                <h3>{doc.title}</h3>
                <div className="document-info">
                  <p><strong>Holder:</strong> {doc.holder.slice(0, 8)}...{doc.holder.slice(-8)}</p>
                  <p><strong>Document ID:</strong> {doc.documentId.slice(0, 16)}...</p>
                </div>
                <div className="document-actions">
                  <button
                    className="btn-share"
                    onClick={() => setShareDocument(doc)}
                    title="Share credentials with holder"
                  >
                    📤 Share
                  </button>
                  <button
                    className="btn-view-details"
                    onClick={() => setSelectedDocument(doc)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDocument && (
        <div className="document-details-modal">
          <div className="document-details-content">
            <div className="modal-header">
              <h2>Document Details</h2>
              <button
                className="close-button"
                onClick={() => setSelectedDocument(null)}
              >
                ×
              </button>
            </div>
            
            <div className="details-section">
              <h3>Document Information</h3>
              <div className="detail-item">
                <label>Title:</label>
                <span>{selectedDocument.title}</span>
              </div>
              <div className="detail-item">
                <label>Type:</label>
                <span className="capitalize">{selectedDocument.documentType}</span>
              </div>
              <div className="detail-item">
                <label>Issue Date:</label>
                <span>{new Date(selectedDocument.issueDate).toLocaleString()}</span>
              </div>
            </div>

            <div className="details-section">
              <h3>Blockchain Information</h3>
              <div className="detail-item">
                <label>Document ID:</label>
                <div className="detail-value-with-copy">
                  <code>{selectedDocument.documentId}</code>
                  <button
                    className="btn-copy-small"
                    onClick={() => copyToClipboard(selectedDocument.documentId)}
                    title="Copy Document ID"
                  >
                    📋
                  </button>
                </div>
              </div>
              
              {selectedDocument.transactionSignature && (
                <>
                  <div className="detail-item">
                    <label>Transaction Signature:</label>
                    <div className="detail-value-with-copy">
                      <code className="transaction-sig">{selectedDocument.transactionSignature}</code>
                      <button
                        className="btn-copy-small"
                        onClick={() => copyToClipboard(selectedDocument.transactionSignature)}
                        title="Copy Transaction Signature"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <div className="detail-item">
                    <label>View on Explorer:</label>
                    <a
                      href={`https://explorer.solana.com/tx/${selectedDocument.transactionSignature}?cluster=${getNetworkCluster()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="explorer-link"
                    >
                      Open in Solana Explorer ↗
                    </a>
                  </div>
                </>
              )}
            </div>

            <div className="details-section">
              <h3>Credential Information</h3>
              <div className="detail-item">
                <label>Credential Hash:</label>
                <div className="detail-value-with-copy">
                  <code>{selectedDocument.credentialHash}</code>
                  <button
                    className="btn-copy-small"
                    onClick={() => copyToClipboard(selectedDocument.credentialHash)}
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
                    {`${window.location.origin}/verify?hash=${selectedDocument.credentialHash}&id=${selectedDocument.documentId}`}
                  </code>
                  <button
                    className="btn-copy-small"
                    onClick={() => copyToClipboard(
                      `${window.location.origin}/verify?hash=${selectedDocument.credentialHash}&id=${selectedDocument.documentId}`
                    )}
                    title="Copy Verification URL"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>

            <div className="details-section">
              <h3>Parties</h3>
              <div className="detail-item">
                <label>Issuer (You):</label>
                <div className="detail-value-with-copy">
                  <code>{selectedDocument.issuer}</code>
                  <button
                    className="btn-copy-small"
                    onClick={() => copyToClipboard(selectedDocument.issuer)}
                    title="Copy Issuer Address"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div className="detail-item">
                <label>Holder:</label>
                <div className="detail-value-with-copy">
                  <code>{selectedDocument.holder}</code>
                  <button
                    className="btn-copy-small"
                    onClick={() => copyToClipboard(selectedDocument.holder)}
                    title="Copy Holder Address"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>

            {selectedDocument.metadata && Object.keys(selectedDocument.metadata).length > 0 && (
              <div className="details-section">
                <h3>Additional Metadata</h3>
                <pre className="metadata-display">
                  {JSON.stringify(selectedDocument.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setSelectedDocument(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {shareDocument && (
        <div className="share-modal">
          <div className="share-modal-content">
            <div className="modal-header">
              <h2>Share Document Credentials</h2>
              <button
                className="close-button"
                onClick={() => setShareDocument(null)}
              >
                ×
              </button>
            </div>
            
            <div className="share-section">
              <h3>Share with Holder</h3>
              <p className="share-description">
                Share these credentials with the holder so they can manually import the document into their wallet.
              </p>
              
              {(() => {
                const shareableData = generateShareableDocumentData(shareDocument.documentId);
                if (!shareableData) return <p>Error generating shareable data</p>;
                
                return (
                  <>
                    <div className="share-method">
                      <h4>Method 1: Shareable Link</h4>
                      <p className="method-description">Send this link to the holder. They can click it to automatically import the document.</p>
                      <div className="share-input-group">
                        <input
                          type="text"
                          value={shareableData.shareableUrl}
                          readOnly
                          className="share-input"
                        />
                        <button
                          className="btn-copy"
                          onClick={() => {
                            copyToClipboard(shareableData.shareableUrl);
                          }}
                        >
                          Copy Link
                        </button>
                      </div>
                    </div>

                    <div className="share-method">
                      <h4>Method 2: Shareable Code</h4>
                      <p className="method-description">Share this code. The holder can paste it in the "Import Document" section.</p>
                      <div className="share-input-group">
                        <textarea
                          value={shareableData.shareableCode}
                          readOnly
                          className="share-code-input"
                          rows="4"
                        />
                        <button
                          className="btn-copy"
                          onClick={() => {
                            copyToClipboard(shareableData.shareableCode);
                          }}
                        >
                          Copy Code
                        </button>
                      </div>
                    </div>

                    <div className="share-instructions">
                      <h4>Instructions for Holder:</h4>
                      <ol>
                        <li>Go to "My Documents" page</li>
                        <li>Click "Import Document" button</li>
                        <li>Paste the shareable code or use the link</li>
                        <li>Document will appear in their wallet</li>
                      </ol>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShareDocument(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssuerDashboard;
