# ChainDocs — Architecture & Workflows

---

# Slide 1 — Title

ChainDocs

Secure, verifiable document issuance on Solana

Presenter: (Your Name) — Date: Feb 14, 2026

Notes: High-level demo of issuer → holder → verifier flows.

---

# Slide 2 — Problem & Solution

- Problem: Institutions need tamper-proof, verifiable documents without heavy infra.
- Solution: Light-weight front-end that writes proof data as Solana Memo transactions and uses wallet-based discovery + local cache for UX.

Key benefits:
- Fast prototype using existing wallets
- Holders discover/import documents automatically
- Simple sharing (link/code) and simulated claim-to-NFT flow

---

# Slide 3 — Architecture (visual)

```mermaid
flowchart LR
  Browser[Browser UI (React)] -->|Wallet Adapter| Wallet[Wallet Extension]
  Browser -->|RPC| Solana[Solana RPC]
  Browser -->|localStorage| Cache[Local Cache]
  Solana --> Memo[Memo Program TXs]
  Wallet -->|sign tx| Solana
  subgraph Utils
    solana.js
    rateLimiter.js
  end
  Browser --> Utils
```

Notes: `src/utils/solana.js` contains core flows; `rateLimiter.js` avoids 429s during scans.

---

# Slide 4 — Issuer & Holder Flows

Issuer flow:
- Fill holder public key + metadata in `IssuerDashboard`
- Call `issueDocument` → writes JSON payload to Solana Memo tx
- Save record to `chaindocs_documents`, `chaindocs_issuers`
- Generate `shareableCode` / `shareableUrl` for holder

Holder flow:
- Connect wallet (auto-discovery starts)
- Load cached docs, then `getHolderDocuments` scans blockchain (rate-limited)
- Import via shareable code (saves to localStorage)
- Claim as NFT: `claimDocumentAsNFT` writes claim memo + stores mock NFT data locally
- Verify via `VerifyDocument` (checks credentialHash against cache)

---

# Slide 5 — Trade-offs & Next Steps

Current limitations (demo):
- Uses Memo program + localStorage — not a production registry
- Credential hashing is simplistic — replace with SHA-256
- Claiming simulates NFT minting — integrate Metaplex for real NFTs
- Scanning is rate-limited and partial — use an indexer (e.g., The Graph / custom index service)

Suggested next steps:
- Replace memo-based storage with on-chain program + proper storage
- Add server-side indexer for fast discovery and verifiable queries
- Strengthen cryptographic hashing and signatures
- Provide export (PDF/PPTX) of this slide deck

---

Thank you — want this exported to PDF or PPTX, or should I add speaker notes per slide?
