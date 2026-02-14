# ChainDocs - Blockchain Document Verification System

A decentralized web application built on Solana blockchain that allows institutions to issue tamper-proof documents and certificates, while enabling holders to verify and manage their credentials securely.

## Features

- **Document Issuance**: Institutions can issue various types of documents (certificates, diplomas, licenses, etc.) to individuals
- **Secure Storage**: Documents are stored on the blockchain with cryptographic proof of ownership
- **Wallet Integration**: Seamless integration with Solana wallets (Phantom, Solflare)
- **Credential Verification**: Holders can verify document authenticity and share credentials securely
- **Modern UI**: Beautiful, responsive interface built with React

## Technology Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Blockchain**: Solana (Devnet)
- **Wallet Integration**: Solana Wallet Adapter
- **Routing**: React Router DOM
- **Styling**: CSS3 with modern gradients and animations

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Solana wallet (Phantom or Solflare) browser extension

### Installation

1. Clone the repository:
```bash
cd ChainDocs
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Connect Your Wallet

1. Install a Solana wallet extension:
   - [Phantom](https://phantom.app/)
   - [Solflare](https://solflare.com/)

2. Connect your wallet to the application using the "Select Wallet" button in the navbar

## Usage

### For Institutions (Issuers)

1. Navigate to the **Issuer** page
2. Connect your Solana wallet
3. Fill in the document details:
   - Holder's public key
   - Document type
   - Title and description
   - Additional metadata (optional)
4. Click "Issue Document" to create and issue the document on-chain

### For Document Holders

1. Navigate to **My Documents** page
2. Connect your wallet to view documents issued to you
3. Click "View Credentials" on any document to get shareable verification credentials
4. Share the credentials with verifiers as needed

### Document Verification

1. Navigate to the **Verify** page
2. Enter the Document ID and Credential Hash provided by the holder
3. Click "Verify Document" to check authenticity
4. View verified document details if valid

## Project Structure

```
ChainDocs/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Navbar.js
│   │   └── Navbar.css
│   ├── pages/
│   │   ├── Home.js
│   │   ├── Home.css
│   │   ├── IssuerDashboard.js
│   │   ├── IssuerDashboard.css
│   │   ├── HolderDashboard.js
│   │   ├── HolderDashboard.css
│   │   ├── VerifyDocument.js
│   │   └── VerifyDocument.css
│   ├── utils/
│   │   └── solana.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── package.json
└── README.md
```

## Important Notes

⚠️ **Current Implementation**: This application uses a simplified implementation that stores document data in localStorage for demonstration purposes. In a production environment, you would:

1. Deploy a Solana Program (smart contract) to handle document issuance and verification
2. Store document metadata on-chain in program-derived accounts
3. Use proper cryptographic signatures for verification
4. Implement proper access control and permissions

## Future Enhancements

- Deploy a custom Solana program for on-chain document storage
- Add support for document revocation
- Implement document expiration dates
- Add batch document issuance
- Create API endpoints for programmatic access
- Add document templates and customization options
- Implement multi-signature issuance for high-value documents

## Development

### Available Scripts

- `npm run dev` or `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm run preview` - Preview the production build locally

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or contributions, please open an issue on the repository.
