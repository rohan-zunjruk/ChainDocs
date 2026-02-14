import React from 'react';
import { Link } from 'react-router-dom';
import './WalletGuide.css';

const WalletGuide = () => {
  const wallets = [
    {
      name: 'Phantom',
      icon: '👻',
      description: 'The most popular Solana wallet with a user-friendly interface',
      link: 'https://phantom.app/',
      features: ['Easy to use', 'Built-in DEX', 'NFT support', 'Mobile app available'],
    },
    {
      name: 'Solflare',
      icon: '🔥',
      description: 'A secure and feature-rich Solana wallet',
      link: 'https://solflare.com/',
      features: ['Hardware wallet support', 'Staking', 'Multi-chain', 'Mobile app'],
    },
    {
      name: 'Backpack',
      icon: '🎒',
      description: 'A modern crypto wallet for Solana',
      link: 'https://www.backpack.app/',
      features: ['Modern UI', 'NFT focused', 'Social features'],
    },
  ];

  return (
    <div className="wallet-guide">
      <div className="guide-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1>Connect Your Wallet</h1>
        <p className="guide-subtitle">
          Choose a Solana wallet to connect and start using ChainDocs
        </p>
      </div>

      <div className="wallets-grid">
        {wallets.map((wallet) => (
          <div key={wallet.name} className="wallet-card">
            <div className="wallet-icon-large">{wallet.icon}</div>
            <h2>{wallet.name}</h2>
            <p className="wallet-description">{wallet.description}</p>
            <ul className="wallet-features">
              {wallet.features.map((feature, index) => (
                <li key={index}>✓ {feature}</li>
              ))}
            </ul>
            <a
              href={wallet.link}
              target="_blank"
              rel="noopener noreferrer"
              className="install-button"
            >
              Install {wallet.name}
            </a>
          </div>
        ))}
      </div>

      <div className="guide-steps">
        <h2>How to Connect</h2>
        <ol>
          <li>
            <strong>Install a wallet:</strong> Click on one of the wallets above to install the browser extension
          </li>
          <li>
            <strong>Create or import:</strong> Set up your wallet by creating a new wallet or importing an existing one
          </li>
          <li>
            <strong>Connect:</strong> Click the "Select Wallet" button in the navigation bar and choose your wallet
          </li>
          <li>
            <strong>Approve:</strong> Approve the connection request in your wallet popup
          </li>
        </ol>
      </div>

      <div className="guide-tips">
        <h2>💡 Tips</h2>
        <ul>
          <li>Make sure you're using the Solana Devnet (default) for testing</li>
          <li>Never share your private key or seed phrase with anyone</li>
          <li>Keep your wallet extension updated for the best experience</li>
          <li>You can switch between wallets anytime by disconnecting and reconnecting</li>
        </ul>
      </div>
    </div>
  );
};

export default WalletGuide;
