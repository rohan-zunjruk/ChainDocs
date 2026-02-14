import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { claimDocumentAsNFT } from '../utils/solana';
import './DocumentNotification.css';

const DocumentNotification = ({ newDocument, onClaim, onDismiss }) => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [claiming, setClaiming] = useState(false);
  const [showNotification, setShowNotification] = useState(true);

  useEffect(() => {
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted' && newDocument) {
      new Notification('New Document Issued! 🎉', {
        body: `${newDocument.title} has been issued to your wallet. Click to view.`,
        icon: '/favicon.ico',
        tag: `doc-${newDocument.documentId}`,
      });
    }

    // Auto-dismiss after 30 seconds
    const timer = setTimeout(() => {
      setShowNotification(false);
      if (onDismiss) onDismiss();
    }, 30000);

    return () => clearTimeout(timer);
  }, [newDocument]);

  const handleClaimNow = async () => {
    if (!publicKey || !sendTransaction) {
      alert('Please connect your wallet');
      return;
    }

    setClaiming(true);
    try {
      const result = await claimDocumentAsNFT(
        connection,
        { publicKey, sendTransaction },
        newDocument
      );

      if (result.success) {
        alert(`Document claimed successfully as NFT!\n\nNFT Mint: ${result.nftMint}\nTransaction: ${result.transactionSignature}`);
        setShowNotification(false);
        if (onClaim) onClaim(newDocument);
      } else {
        alert(`Error claiming document: ${result.error}`);
      }
    } catch (error) {
      console.error('Error claiming document:', error);
      alert(`Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setClaiming(false);
    }
  };

  const handleViewDetails = () => {
    setShowNotification(false);
    if (onDismiss) onDismiss();
    // Scroll to document
    setTimeout(() => {
      const element = document.getElementById(`document-${newDocument.documentId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the document
        element.classList.add('highlight-new');
        setTimeout(() => {
          element.classList.remove('highlight-new');
        }, 3000);
      }
    }, 100);
  };

  if (!showNotification || !newDocument) return null;

  return (
    <div className="document-notification">
      <div className="notification-content">
        <div className="notification-icon">🎉</div>
        <div className="notification-text">
          <h3>New Document Issued!</h3>
          <p className="notification-title">{newDocument.title}</p>
          <p className="notification-subtitle">
            Issued by: {newDocument.issuer.slice(0, 8)}...{newDocument.issuer.slice(-8)}
          </p>
        </div>
        <div className="notification-actions">
          <button
            className="btn-claim-now"
            onClick={handleClaimNow}
            disabled={claiming}
          >
            {claiming ? 'Claiming...' : '🎁 Claim Now'}
          </button>
          <button
            className="btn-view-now"
            onClick={handleViewDetails}
          >
            View
          </button>
          <button
            className="btn-dismiss"
            onClick={() => {
              setShowNotification(false);
              if (onDismiss) onDismiss();
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentNotification;
