import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './WalletConnection.css';

const WalletConnection = () => {
  const { publicKey, wallet, disconnect, connecting, connected } = useWallet();
  const [isInstalled, setIsInstalled] = useState({});

  useEffect(() => {
    // Check which wallet extensions are installed
    const checkWallets = () => {
      setIsInstalled({
        phantom: typeof window !== 'undefined' && (!!window.solana?.isPhantom || !!window.phantom?.solana),
        solflare: typeof window !== 'undefined' && !!window.solflare,
        backpack: typeof window !== 'undefined' && !!window.backpack,
        coinbase: typeof window !== 'undefined' && !!window.coinbaseSolana,
        trust: typeof window !== 'undefined' && !!window.trustWallet,
      });
    };

    checkWallets();
    // Check periodically in case user installs wallet
    const interval = setInterval(checkWallets, 2000);
    
    // Also listen for wallet installation events
    window.addEventListener('load', checkWallets);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('load', checkWallets);
    };
  }, []);

  const getWalletName = () => {
    if (!wallet) return 'Not Connected';
    return wallet.adapter.name;
  };

  const getWalletIcon = () => {
    if (!wallet) return '👛';
    const name = wallet.adapter.name.toLowerCase();
    if (name.includes('phantom')) return '👻';
    if (name.includes('solflare')) return '🔥';
    if (name.includes('backpack')) return '🎒';
    if (name.includes('coinbase')) return '🔵';
    if (name.includes('trust')) return '🛡️';
    return '👛';
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.toString().slice(0, 4)}...${address.toString().slice(-4)}`;
  };

  if (connected && publicKey) {
    return (
      <div className="wallet-connected">
        <div className="wallet-info">
          <span className="wallet-icon">{getWalletIcon()}</span>
          <div className="wallet-details">
            <span className="wallet-name">{getWalletName()}</span>
            <span className="wallet-address">{formatAddress(publicKey)}</span>
          </div>
        </div>
        <button onClick={disconnect} className="disconnect-btn">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connection">
      <WalletMultiButton className="wallet-multi-button" />
      {connecting && (
        <div className="connecting-indicator">
          <span className="spinner"></span>
          Connecting...
        </div>
      )}
      {!connected && (
        <div className="wallet-install-hint">
          <p className="hint-title">💡 Don't have a wallet?</p>
          <div className="wallet-links">
            {!isInstalled.phantom && (
              <a
                href="https://phantom.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="wallet-link"
              >
                Install Phantom
              </a>
            )}
            {!isInstalled.solflare && (
              <a
                href="https://solflare.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="wallet-link"
              >
                Install Solflare
              </a>
            )}
            {!isInstalled.backpack && (
              <a
                href="https://www.backpack.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="wallet-link"
              >
                Install Backpack
              </a>
            )}
            <a
              href="/wallet-guide"
              className="wallet-link guide-link"
            >
              View Guide
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnection;
