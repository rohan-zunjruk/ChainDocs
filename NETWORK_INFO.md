# Network Configuration Guide

## Current Setup

**The application is currently configured to use Solana Devnet (Test Network)**

### Important Notes:

1. **Documents are NOT stored on-chain yet** - They are currently stored in browser localStorage as a simulation
2. **Devnet is a test network** - It uses fake SOL tokens and is free to use
3. **Mainnet uses real SOL** - Switching to Mainnet requires real SOL tokens for transaction fees

## Network Options

### Devnet (Current Default)
- **Purpose**: Development and testing
- **SOL**: Free test tokens (not real)
- **Status**: Documents stored locally (not on blockchain)
- **Use Case**: Testing the application without spending real money

### Testnet
- **Purpose**: Public testing environment
- **SOL**: Free test tokens (not real)
- **Status**: Documents stored locally (not on blockchain yet)
- **Use Case**: Testing with public test network

### Testnet
- **Purpose**: Public testing environment
- **SOL**: Free test tokens (not real)
- **Status**: Would store documents on testnet blockchain
- **Use Case**: Testing with real blockchain but without real money

### Mainnet
- **Purpose**: Production network
- **SOL**: Real SOL tokens (costs real money)
- **Status**: Would store documents on main Solana blockchain
- **Use Case**: Production use with real documents and real SOL

## How to Switch Networks

1. Use the network selector dropdown at the top of the page
2. Select your desired network (Devnet, Testnet, or Mainnet)
3. The page will reload to connect to the new network
4. Make sure your wallet is also switched to the same network

## Wallet Network Configuration

**Important**: Your wallet extension (Phantom, Solflare, etc.) must be set to the same network:

### Phantom Wallet:
1. Open Phantom extension
2. Click the gear icon (Settings)
3. Go to "Developer Settings"
4. Select the network (Devnet/Testnet/Mainnet)

### Solflare Wallet:
1. Open Solflare extension
2. Click on network selector
3. Choose Devnet, Testnet, or Mainnet

## Current Implementation Status

⚠️ **Important**: The current implementation stores documents in browser localStorage, not on the Solana blockchain. This means:

- Documents are not truly decentralized
- Documents are only visible in the browser where they were created
- Documents will be lost if browser data is cleared
- Documents cannot be verified by others independently

## To Enable True On-Chain Storage

To store documents on the actual Solana blockchain, you need to:

1. **Deploy a Solana Program (Smart Contract)** that handles document storage
2. **Update the `solana.js` utility functions** to interact with the deployed program
3. **Use real SOL** for transaction fees (if using Mainnet)
4. **Store document metadata** in program-derived accounts on-chain

## Recommended Setup for Production

1. **Development**: Use Devnet with localStorage (current setup)
2. **Testing**: Use Testnet with on-chain storage
3. **Production**: Use Mainnet with on-chain storage

## Cost Considerations

- **Devnet**: Free (test tokens)
- **Testnet**: Free (test tokens)
- **Mainnet**: Costs real SOL (~0.000005 SOL per transaction = ~$0.0001)

For production use with many documents, consider:
- Batch transactions to reduce costs
- Using a custom RPC endpoint for better performance
- Implementing document compression to reduce storage costs
