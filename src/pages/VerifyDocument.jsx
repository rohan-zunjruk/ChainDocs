import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { verifyDocument } from '../utils/solana';
import './VerifyDocument.css';

const VerifyDocument = () => {
  const [searchParams] = useSearchParams();
  const [documentId, setDocumentId] = useState('');
  const [credentialHash, setCredentialHash] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hashParam = searchParams.get('hash');
    const idParam = searchParams.get('id');
    
    if (hashParam) setCredentialHash(hashParam);
    if (idParam) setDocumentId(idParam);
  }, [searchParams]);

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!documentId || !credentialHash) {
      alert('Please provide both Document ID and Credential Hash');
      return;
    }

    setLoading(true);
    setVerificationResult(null);

    try {
      const result = await verifyDocument(credentialHash, documentId);
      setVerificationResult(result);
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        valid: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-container">
      <div className="verify-card">
        <h1>Verify Document</h1>
        <p className="verify-description">
          Enter the document credentials to verify its authenticity on the blockchain.
        </p>

        <form onSubmit={handleVerify} className="verify-form">
          <div className="form-group">
            <label>Document ID *</label>
            <input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="Enter document ID"
              required
            />
          </div>

          <div className="form-group">
            <label>Credential Hash *</label>
            <input
              type="text"
              value={credentialHash}
              onChange={(e) => setCredentialHash(e.target.value)}
              placeholder="Enter credential hash"
              required
            />
          </div>

          <button type="submit" className="btn-verify" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Document'}
          </button>
        </form>

        {verificationResult && (
          <div className={`verification-result ${verificationResult.valid ? 'valid' : 'invalid'}`}>
            {verificationResult.valid ? (
              <>
                <div className="result-icon">✅</div>
                <h2>Document Verified</h2>
                <p className="result-message">This document is authentic and verified on the blockchain.</p>
                {verificationResult.document && (
                  <div className="document-details">
                    <h3>Document Details</h3>
                    <div className="detail-item">
                      <strong>Document ID:</strong>
                      <span>{verificationResult.document.documentId}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Type:</strong>
                      <span>{verificationResult.document.documentType}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Title:</strong>
                      <span>{verificationResult.document.title}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Issued To:</strong>
                      <span>{verificationResult.document.holder.slice(0, 8)}...{verificationResult.document.holder.slice(-8)}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Issued By:</strong>
                      <span>{verificationResult.document.issuer.slice(0, 8)}...{verificationResult.document.issuer.slice(-8)}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Issue Date:</strong>
                      <span>{new Date(verificationResult.document.issueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="result-icon">❌</div>
                <h2>Verification Failed</h2>
                <p className="result-message">
                  {verificationResult.error || 'The document could not be verified. Please check the credentials and try again.'}
                </p>
              </>
            )}
          </div>
        )}

        <div className="verify-info">
          <h3>How Verification Works</h3>
          <ol>
            <li>The document holder shares their credential hash and document ID</li>
            <li>We verify these credentials against the blockchain records</li>
            <li>If valid, the document details are displayed</li>
            <li>The verification confirms the document's authenticity and ownership</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default VerifyDocument;
