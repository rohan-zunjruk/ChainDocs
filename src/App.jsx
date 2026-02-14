import React, { useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import IssuerDashboard from './pages/IssuerDashboard';
import HolderDashboard from './pages/HolderDashboard';
import VerifyDocument from './pages/VerifyDocument';
import WalletGuide from './pages/WalletGuide';
import NetworkSelector from './components/NetworkSelector';

import './App.css';

function App() {
  // Default to Devnet (test network) - change to WalletAdapterNetwork.Mainnet for production
  const [network, setNetwork] = useState(() => {
    // Check localStorage for saved network preference
    const savedNetwork = localStorage.getItem('solana_network');
    return savedNetwork || WalletAdapterNetwork.Devnet;
  });

  const endpoint = useMemo(() => {
    if (network === WalletAdapterNetwork.Mainnet) {
      return clusterApiUrl('mainnet-beta');
    } else if (network === WalletAdapterNetwork.Testnet) {
      return clusterApiUrl('testnet');
    } else {
      return clusterApiUrl('devnet');
    }
  }, [network]);

  const handleNetworkChange = (newNetwork) => {
    setNetwork(newNetwork);
    localStorage.setItem('solana_network', newNetwork);
    // Reload page to reconnect with new network
    window.location.reload();
  };
  
  // Configure all available wallets
  // Phantom and Solflare are the most popular Chrome extension wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // Add more wallet adapters here as needed
      // They will automatically appear in the wallet selection modal
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Router>
            <div className="App">
              <Navbar />
              <main className="main-content">
                <NetworkSelector network={network} onNetworkChange={handleNetworkChange} />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/issuer" element={<IssuerDashboard />} />
                  <Route path="/holder" element={<HolderDashboard />} />
                  <Route path="/verify" element={<VerifyDocument />} />
                  <Route path="/wallet-guide" element={<WalletGuide />} />
                </Routes>
              </main>
            </div>
          </Router>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
