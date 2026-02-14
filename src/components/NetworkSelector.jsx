import React from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';
import './NetworkSelector.css';

const NetworkSelector = ({ network, onNetworkChange }) => {
  const networkOptions = [
    { value: WalletAdapterNetwork.Devnet, label: 'Devnet (Test)', description: 'Free test network for development' },
    { value: WalletAdapterNetwork.Testnet, label: 'Testnet', description: 'Public test network' },
    { value: WalletAdapterNetwork.Mainnet, label: 'Mainnet', description: 'Production network (real SOL)' },
  ];

  const getNetworkEndpoint = (net) => {
    if (net === WalletAdapterNetwork.Mainnet) {
      return clusterApiUrl('mainnet-beta');
    } else if (net === WalletAdapterNetwork.Testnet) {
      return clusterApiUrl('testnet');
    } else {
      return clusterApiUrl('devnet');
    }
  };

  return (
    <div className="network-selector">
      <div className="network-info">
        <span className="network-label">Network:</span>
        <select
          value={network}
          onChange={(e) => onNetworkChange(e.target.value)}
          className="network-select"
        >
          {networkOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="network-warning">
        {network === WalletAdapterNetwork.Mainnet && (
          <span className="warning-text">⚠️ Mainnet uses real SOL - be careful!</span>
        )}
        {network === WalletAdapterNetwork.Devnet && (
          <span className="info-text">ℹ️ Using Devnet - documents are stored locally (not on-chain yet)</span>
        )}
        {network === WalletAdapterNetwork.Testnet && (
          <span className="info-text">ℹ️ Using Testnet - documents are stored locally (not on-chain yet)</span>
        )}
      </div>
    </div>
  );
};

export default NetworkSelector;
