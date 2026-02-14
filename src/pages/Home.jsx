import React from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import './Home.css';

const Home = () => {
  const { connected } = useWallet();

  return (
    <div className="home">
      <div className="hero-section">
        <h1 className="hero-title">ChainDocs</h1>
        <p className="hero-subtitle">
          Secure, verifiable document and certificate issuance on Solana blockchain
        </p>
        <p className="hero-description">
          Issue tamper-proof documents and certificates. Holders can verify authenticity 
          instantly using blockchain technology.
        </p>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">🏛️</div>
          <h3>For Institutions</h3>
          <p>Issue documents and certificates securely on the blockchain. Each document is cryptographically verified and cannot be tampered with.</p>
          <Link to="/issuer" className="feature-button">
            Start Issuing
          </Link>
        </div>

        <div className="feature-card">
          <div className="feature-icon">👤</div>
          <h3>For Holders</h3>
          <p>Store your documents securely in your wallet. Verify credentials anytime, anywhere with just a few clicks.</p>
          <Link to="/holder" className="feature-button">
            View Documents
          </Link>
        </div>

        <div className="feature-card">
          <div className="feature-icon">✅</div>
          <h3>Verification</h3>
          <p>Verify document authenticity instantly. Share credentials securely to prove ownership without revealing sensitive data.</p>
          <Link to="/verify" className="feature-button">
            Verify Document
          </Link>
        </div>
      </div>

      {!connected && (
        <div className="connect-prompt">
          <p>Connect your Solana wallet to get started</p>
        </div>
      )}

      <div className="info-section">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h4>Issue</h4>
            <p>Institutions create and issue documents/certificates on the Solana blockchain</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h4>Store</h4>
            <p>Documents are stored securely in the holder's wallet with cryptographic proof</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h4>Verify</h4>
            <p>Holders can verify and share credentials anytime to prove authenticity</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
