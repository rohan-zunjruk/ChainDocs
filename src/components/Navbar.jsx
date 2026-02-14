import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import WalletConnection from './WalletConnection';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">📜</span>
          ChainDocs
        </Link>
        <div className="navbar-menu">
          <Link 
            to="/" 
            className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link 
            to="/issuer" 
            className={`navbar-link ${location.pathname === '/issuer' ? 'active' : ''}`}
          >
            Issuer
          </Link>
          <Link 
            to="/holder" 
            className={`navbar-link ${location.pathname === '/holder' ? 'active' : ''}`}
          >
            My Documents
          </Link>
          <Link 
            to="/verify" 
            className={`navbar-link ${location.pathname === '/verify' ? 'active' : ''}`}
          >
            Verify
          </Link>
        </div>
        <div className="navbar-wallet">
          <WalletConnection />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
