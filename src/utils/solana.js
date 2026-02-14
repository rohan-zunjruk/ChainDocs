import { Connection, PublicKey, Transaction, SystemProgram, Keypair, TransactionInstruction } from '@solana/web3.js';
import { globalRateLimiter } from './rateLimiter.js';

// This is a simplified implementation
// In production, you would use a proper Solana program (smart contract)
// For now, we'll simulate document storage using account data

export const DOCUMENT_PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // Placeholder
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'); // Solana Memo program

/**
 * Rate limiting helper with retry logic and Retry-After header support
 */
async function rateLimitedRequest(requestFn, retries = 3, baseDelay = 1000) {
  let delay = baseDelay;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Use global rate limiter to throttle requests
      return await globalRateLimiter.execute(requestFn);
    } catch (error) {
      // Check for 429 Too Many Requests
      const isRateLimitError = error.message && (
        error.message.includes('429') ||
        error.message.includes('Too Many Requests') ||
        error.message.includes('rate limit') ||
        error.message.includes('slow down')
      );
      
      if (isRateLimitError) {
        // Try to extract Retry-After header from various sources
        let retryAfter = delay;
        
        // Check error response headers
        if (error.response && error.response.headers) {
          const retryAfterHeader = error.response.headers['retry-after'] || 
                                   error.response.headers['Retry-After'];
          if (retryAfterHeader) {
            retryAfter = parseInt(retryAfterHeader) * 1000;
          }
        }
        
        // Try to parse from error message
        if (retryAfter === delay) {
          const match = error.message.match(/retry[-\s]after[:\s]+(\d+)/i);
          if (match) {
            retryAfter = parseInt(match[1]) * 1000;
          }
        }
        
        // Ensure minimum delay
        retryAfter = Math.max(retryAfter, 1000);
        
        if (attempt < retries - 1) {
          console.log(`⏳ Rate limited (429). Waiting ${retryAfter}ms before retry ${attempt + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          // Exponential backoff
          delay = Math.min(delay * 2, 30000); // Max 30 seconds
          continue;
        }
      }
      
      // For other errors or final retry, throw
      throw error;
    }
  }
}

/**
 * Delay helper for rate limiting
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a document account on Solana
 * In production, this would interact with your Solana program
 */
export async function issueDocument(
  connection,
  issuerWallet,
  holderPublicKey,
  documentData
) {
  try {
    // Generate a unique document ID
    const documentId = Keypair.generate();
    
    // Create document metadata
    const documentMetadata = {
      issuer: issuerWallet.publicKey.toString(),
      holder: holderPublicKey.toString(),
      documentType: documentData.type,
      title: documentData.title,
      issueDate: new Date().toISOString(),
      credentialHash: generateCredentialHash(documentData),
      metadata: documentData.metadata || {},
    };

    // --------------------------------------------------------------------
    // On-chain storage (Solana devnet/testnet/mainnet) via Memo program
    // --------------------------------------------------------------------

    // Build a compact payload to store in the memo
    const memoPayload = {
      v: 1,
      app: 'chaindocs',
      documentId: documentId.publicKey.toBase58(),
      issuer: documentMetadata.issuer,
      holder: documentMetadata.holder,
      credentialHash: documentMetadata.credentialHash,
      type: documentMetadata.documentType,
      title: documentMetadata.title,
      issuedAt: documentMetadata.issueDate,
    };

    const encoder = new TextEncoder();
    const memoData = encoder.encode(JSON.stringify(memoPayload));

    // Memo program instruction (no keys required, but transaction needs fee payer)
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: memoData,
    });

    // Create transaction and get recent blockhash
    const transaction = new Transaction();
    
    // Get recent blockhash (required for transaction)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = issuerWallet.publicKey;

    transaction.add(memoInstruction);

    if (typeof issuerWallet.sendTransaction !== 'function') {
      throw new Error('Wallet does not support sending transactions');
    }

    // Send transaction with proper options
    const signature = await issuerWallet.sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    }, 'confirmed');

    // Also keep a local cache copy for quick UI access
    const documentRecord = {
      documentId: documentId.publicKey.toString(),
      ...documentMetadata,
      transactionSignature: signature,
    };

    const existingDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
    existingDocuments.push(documentRecord);
    localStorage.setItem('chaindocs_documents', JSON.stringify(existingDocuments));

    // Add issuer to registry so holders can discover documents
    const issuerRegistry = JSON.parse(localStorage.getItem('chaindocs_issuers') || '[]');
    if (!issuerRegistry.includes(issuerWallet.publicKey.toString())) {
      issuerRegistry.push(issuerWallet.publicKey.toString());
      localStorage.setItem('chaindocs_issuers', JSON.stringify(issuerRegistry));
    }

    return {
      success: true,
      documentId: documentId.publicKey.toString(),
      transactionSignature: signature,
    };
  } catch (error) {
    console.error('Error issuing document:', error);
    let errorMessage = 'Unknown error occurred';
    
    if (error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.toString) {
      errorMessage = error.toString();
    }

    // Provide more helpful error messages
    if (errorMessage.includes('User rejected')) {
      errorMessage = 'Transaction was rejected. Please try again and approve the transaction.';
    } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('0 SOL')) {
      errorMessage = 'Insufficient devnet SOL. Please get devnet SOL from a faucet.';
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Scan recent blocks for documents issued to a holder
 */
async function scanRecentBlocksForDocuments(connection, holderAddress, maxBlocks = 50) {
  const documents = [];
  const decoder = new TextDecoder();
  
  try {
    // Get recent blockhashes and scan transactions
    const slot = await connection.getSlot();
    const blocksToScan = Math.min(maxBlocks, slot);
    
    // Scan recent blocks (this is a simplified approach - in production use an indexer)
    for (let i = 0; i < blocksToScan; i++) {
      try {
        const blockSlot = slot - i;
        const block = await connection.getBlock(blockSlot, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        if (!block || !block.transactions) continue;
        
        for (const tx of block.transactions) {
          if (!tx.transaction || !tx.transaction.message) continue;
          
          const instructions = tx.transaction.message.instructions || [];
          for (const ix of instructions) {
            // Check if this is a memo instruction
            if (ix.programId && ix.programId.toString() === MEMO_PROGRAM_ID.toString()) {
              try {
                // Decode memo data
                const memoData = decoder.decode(ix.data);
                const memoPayload = JSON.parse(memoData);
                
                // Check if this is a chaindocs document for our holder
                if (memoPayload.app === 'chaindocs' && 
                    memoPayload.holder === holderAddress &&
                    memoPayload.action !== 'claim') { // Exclude claim transactions
                  
                  const docId = memoPayload.documentId;
                  const exists = documents.find(d => d.documentId === docId);
                  
                  if (!exists) {
                    const blockchainDoc = {
                      documentId: docId,
                      issuer: memoPayload.issuer,
                      holder: memoPayload.holder,
                      documentType: memoPayload.type,
                      title: memoPayload.title,
                      issueDate: memoPayload.issuedAt,
                      credentialHash: memoPayload.credentialHash,
                      transactionSignature: tx.transaction.signatures[0],
                      metadata: {},
                    };
                    documents.push(blockchainDoc);
                  }
                }
              } catch (e) {
                // Not our memo format or invalid JSON, skip
              }
            }
          }
        }
      } catch (e) {
        // Block might not be available, skip
        if (i === 0) break; // If we can't get recent blocks, stop trying
      }
    }
  } catch (error) {
    console.log('Error scanning blocks:', error);
  }
  
  return documents;
}

/**
 * Parse memo instruction from transaction
 */
function parseMemoInstruction(instruction, decoder) {
  try {
    // Handle different instruction formats
    let memoData;
    
    if (instruction.data) {
      // If data is already a Buffer/Uint8Array
      if (instruction.data instanceof Uint8Array || Buffer.isBuffer(instruction.data)) {
        memoData = decoder.decode(instruction.data);
      } else if (typeof instruction.data === 'string') {
        // If it's already a string
        memoData = instruction.data;
      } else {
        // Try to convert
        memoData = decoder.decode(new Uint8Array(instruction.data));
      }
    } else {
      return null;
    }
    
    // Try to parse as JSON
    const memoPayload = JSON.parse(memoData);
    return memoPayload;
  } catch (e) {
    return null;
  }
}

/**
 * Query blockchain for documents issued to a holder by scanning recent transactions
 */
export async function queryBlockchainDocuments(connection, holderPublicKey) {
  try {
    const documents = [];
    const holderAddress = holderPublicKey.toString();
    const decoder = new TextDecoder();
    
    console.log('🔍 Scanning blockchain for documents issued to:', holderAddress);
    
    // Method 1: Get all local documents and verify on-chain
    const allLocalDocs = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
    const holderLocalDocs = allLocalDocs.filter(doc => doc.holder === holderAddress);
    console.log('📋 Found', holderLocalDocs.length, 'local documents');
    
    // Verify local documents exist on-chain (with rate limiting)
    for (let i = 0; i < holderLocalDocs.length; i++) {
      const doc = holderLocalDocs[i];
      
      // Add delay between verification requests
      if (i > 0 && i % 5 === 0) {
        await delay(200);
      }
      
      if (doc.transactionSignature) {
        try {
          const tx = await rateLimitedRequest(
            () => connection.getTransaction(doc.transactionSignature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            }),
            2,
            500
          );
          
          if (tx && tx.meta && tx.meta.err === null) {
            documents.push(doc);
          }
        } catch (e) {
          // Transaction might not be found, but keep the document anyway
          documents.push(doc);
        }
      } else {
        documents.push(doc);
      }
    }
    
    // Method 2: Scan transactions from known issuers (with rate limiting)
    const issuerRegistry = JSON.parse(localStorage.getItem('chaindocs_issuers') || '[]');
    const uniqueIssuers = [...new Set(issuerRegistry)];
    console.log('🏛️ Scanning', uniqueIssuers.length, 'known issuers');
    
    // Limit concurrent requests and add delays
    const MAX_ISSUERS = 10; // Limit number of issuers to scan
    const MAX_TXS_PER_ISSUER = 50; // Limit transactions per issuer
    const REQUEST_DELAY = 200; // Delay between requests (ms)
    
    for (let i = 0; i < Math.min(uniqueIssuers.length, MAX_ISSUERS); i++) {
      const issuerAddress = uniqueIssuers[i];
      
      // Add delay between issuers
      if (i > 0) {
        await delay(REQUEST_DELAY);
      }
      
      try {
        const issuerPubkey = new PublicKey(issuerAddress);
        
        // Rate-limited request for signatures
        const signatures = await rateLimitedRequest(
          async () => {
            await delay(REQUEST_DELAY);
            return await connection.getSignaturesForAddress(issuerPubkey, { limit: MAX_TXS_PER_ISSUER });
          },
          3,
          1000
        );
        
        console.log(`  Scanning ${signatures.length} transactions from issuer ${issuerAddress.slice(0, 8)}...`);
        
        // Process transactions with delays
        for (let j = 0; j < signatures.length; j++) {
          const sigInfo = signatures[j];
          
          // Add delay between transaction requests
          if (j > 0 && j % 5 === 0) {
            await delay(REQUEST_DELAY);
          }
          
          try {
            // Rate-limited transaction fetch
            const tx = await rateLimitedRequest(
              () => connection.getTransaction(sigInfo.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
              }),
              2,
              500
            );
            
            if (!tx || !tx.meta || tx.meta.err !== null) continue;
            
            // Handle both legacy and versioned transactions
            let instructions = [];
            if (tx.transaction.message.instructions) {
              instructions = tx.transaction.message.instructions;
            } else if (tx.transaction.message.compiledInstructions) {
              // Handle compiled instructions
              const compiledIxs = tx.transaction.message.compiledInstructions;
              const accountKeys = tx.transaction.message.accountKeys || [];
              
              for (const compiledIx of compiledIxs) {
                const programId = accountKeys[compiledIx.programIdIndex];
                if (programId && programId.toString() === MEMO_PROGRAM_ID.toString()) {
                  instructions.push({
                    programId: programId,
                    data: compiledIx.data,
                  });
                }
              }
            }
            
            for (const ix of instructions) {
              if (ix.programId && ix.programId.toString() === MEMO_PROGRAM_ID.toString()) {
                const memoPayload = parseMemoInstruction(ix, decoder);
                
                if (memoPayload && 
                    memoPayload.app === 'chaindocs' && 
                    memoPayload.holder === holderAddress &&
                    memoPayload.action !== 'claim') {
                  
                  const exists = documents.find(d => d.documentId === memoPayload.documentId);
                  if (!exists) {
                    const blockchainDoc = {
                      documentId: memoPayload.documentId,
                      issuer: memoPayload.issuer,
                      holder: memoPayload.holder,
                      documentType: memoPayload.type,
                      title: memoPayload.title,
                      issueDate: memoPayload.issuedAt,
                      credentialHash: memoPayload.credentialHash,
                      transactionSignature: sigInfo.signature,
                      metadata: memoPayload.metadata || {},
                    };
                    documents.push(blockchainDoc);
                    console.log('✅ Found document:', blockchainDoc.title, blockchainDoc.documentId);
                  }
                }
              }
            }
          } catch (e) {
            // Skip failed transaction fetches
          }
        }
      } catch (e) {
        if (e.message && (e.message.includes('429') || e.message.includes('rate limit'))) {
          console.log('⚠️ Rate limited while scanning issuer:', issuerAddress);
          await delay(2000); // Wait longer on rate limit
        } else {
          console.log('Error scanning issuer:', issuerAddress, e.message);
        }
      }
    }
    
    // Method 3: Scan by checking all recent transactions with memo program
    // This is more comprehensive but slower - use sparingly with rate limiting
    try {
      console.log('🔎 Scanning recent transactions for memo instructions...');
      
      // Rate-limited request for memo program signatures
      const recentSignatures = await rateLimitedRequest(
        async () => {
          await delay(REQUEST_DELAY * 2);
          return await connection.getSignaturesForAddress(MEMO_PROGRAM_ID, { limit: 30 });
        },
        3,
        1000
      );
      
      console.log(`  Found ${recentSignatures.length} recent memo transactions`);
      
      // Process with delays to avoid rate limits
      for (let i = 0; i < Math.min(recentSignatures.length, 20); i++) { // Limit to 20 for performance
        const sigInfo = recentSignatures[i];
        
        // Add delay between requests
        if (i > 0 && i % 3 === 0) {
          await delay(REQUEST_DELAY * 2); // Longer delay for this method
        }
        
        try {
          // Rate-limited transaction fetch
          const tx = await rateLimitedRequest(
            () => connection.getTransaction(sigInfo.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            }),
            2,
            500
          );
          
          if (!tx || !tx.meta || tx.meta.err !== null) continue;
          
          let instructions = [];
          if (tx.transaction.message.instructions) {
            instructions = tx.transaction.message.instructions;
          }
          
          for (const ix of instructions) {
            if (ix.programId && ix.programId.toString() === MEMO_PROGRAM_ID.toString()) {
              const memoPayload = parseMemoInstruction(ix, decoder);
              
              if (memoPayload && 
                  memoPayload.app === 'chaindocs' && 
                  memoPayload.holder === holderAddress &&
                  memoPayload.action !== 'claim') {
                
                const exists = documents.find(d => d.documentId === memoPayload.documentId);
                if (!exists) {
                  const blockchainDoc = {
                    documentId: memoPayload.documentId,
                    issuer: memoPayload.issuer,
                    holder: memoPayload.holder,
                    documentType: memoPayload.type,
                    title: memoPayload.title,
                    issueDate: memoPayload.issuedAt,
                    credentialHash: memoPayload.credentialHash,
                    transactionSignature: sigInfo.signature,
                    metadata: memoPayload.metadata || {},
                  };
                  documents.push(blockchainDoc);
                  console.log('✅ Found document via memo scan:', blockchainDoc.title);
                }
              }
            }
          }
          } catch (e) {
            // Skip failed transactions
            if (e.message && e.message.includes('429')) {
              console.log('⚠️ Rate limited during memo scan, slowing down...');
              await delay(2000); // Longer delay on rate limit
            }
          }
        }
      } catch (e) {
        console.log('Memo program scanning failed:', e.message);
        if (e.message && e.message.includes('429')) {
          console.log('⚠️ Rate limited. Consider reducing scan frequency.');
        }
      }
    
    // Save all discovered documents to localStorage
    const existingDocs = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
    const existingIds = new Set(existingDocs.map(d => d.documentId));
    
    for (const doc of documents) {
      if (!existingIds.has(doc.documentId)) {
        existingDocs.push(doc);
        existingIds.add(doc.documentId);
      }
    }
    
    localStorage.setItem('chaindocs_documents', JSON.stringify(existingDocs));
    
    console.log('📊 Total documents found:', documents.length);
    return documents;
  } catch (error) {
    console.error('❌ Error querying blockchain documents:', error);
    
    // If rate limited, return what we have so far
    if (error.message && (error.message.includes('429') || error.message.includes('rate limit'))) {
      console.log('⚠️ Rate limited during scan. Returning documents found so far.');
      return documents; // Return partial results
    }
    
    return [];
  }
}

/**
 * Get documents for a holder from cache only (no blockchain). Use for instant display on load.
 */
export function getHolderDocumentsFromCache(holderPublicKey) {
  try {
    const holderAddress = holderPublicKey.toString();
    const allDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
    let holderDocs = allDocuments.filter(doc => {
      const docHolder = doc.holder ? doc.holder.toString() : '';
      return docHolder.toLowerCase() === holderAddress.toLowerCase();
    });
    const claimedDocs = JSON.parse(localStorage.getItem('chaindocs_claimed') || '[]');
    holderDocs = holderDocs.map(doc => ({
      ...doc,
      claimed: claimedDocs.includes(doc.documentId),
      nftMint: localStorage.getItem(`chaindocs_nft_${doc.documentId}`) || null,
    }));
    holderDocs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
    return holderDocs;
  } catch (error) {
    console.error('Error fetching documents from cache:', error);
    return [];
  }
}

/**
 * Get documents for a holder (combines local cache and blockchain query)
 */
export async function getHolderDocuments(holderPublicKey, connection = null) {
  try {
    const holderAddress = holderPublicKey.toString();
    
    // First get from local cache
    const allDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
    console.log('📋 Total documents in localStorage:', allDocuments.length);
    
    // Filter by holder address (case-insensitive comparison)
    let holderDocs = allDocuments.filter(doc => {
      const docHolder = doc.holder ? doc.holder.toString() : '';
      return docHolder.toLowerCase() === holderAddress.toLowerCase();
    });
    
    console.log('👤 Documents for holder', holderAddress.slice(0, 8) + '...:', holderDocs.length);
    
    // If connection is provided, also query blockchain
    if (connection) {
      const blockchainDocs = await queryBlockchainDocuments(connection, holderPublicKey);
      
      // Merge blockchain docs with local docs (avoid duplicates, update existing)
      const existingIds = new Set(holderDocs.map(d => d.documentId));
      blockchainDocs.forEach(doc => {
        const existingIndex = holderDocs.findIndex(d => d.documentId === doc.documentId);
        if (existingIndex >= 0) {
          // Update existing document with blockchain data
          holderDocs[existingIndex] = { ...holderDocs[existingIndex], ...doc };
        } else if (!existingIds.has(doc.documentId)) {
          // Add new document
          holderDocs.push(doc);
        }
      });
    }
    
    // Mark claimed status
    const claimedDocs = JSON.parse(localStorage.getItem('chaindocs_claimed') || '[]');
    holderDocs = holderDocs.map(doc => ({
      ...doc,
      claimed: claimedDocs.includes(doc.documentId),
      nftMint: localStorage.getItem(`chaindocs_nft_${doc.documentId}`) || null,
    }));
    
    console.log('✅ Returning', holderDocs.length, 'documents for holder');
    return holderDocs;
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
}

/**
 * Get documents issued by an issuer
 */
export async function getIssuerDocuments(issuerPublicKey) {
  try {
    const allDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
    return allDocuments.filter(doc => doc.issuer === issuerPublicKey.toString());
  } catch (error) {
    console.error('Error fetching issuer documents:', error);
    return [];
  }
}

/**
 * Verify a document using credential hash
 */
export async function verifyDocument(credentialHash, documentId) {
  try {
    const allDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
    const document = allDocuments.find(doc => doc.documentId === documentId);
    
    if (!document) {
      return {
        valid: false,
        error: 'Document not found',
      };
    }

    if (document.credentialHash === credentialHash) {
      return {
        valid: true,
        document: {
          documentId: document.documentId,
          issuer: document.issuer,
          holder: document.holder,
          documentType: document.documentType,
          title: document.title,
          issueDate: document.issueDate,
        },
      };
    } else {
      return {
        valid: false,
        error: 'Invalid credentials',
      };
    }
  } catch (error) {
    console.error('Error verifying document:', error);
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Generate a credential hash from document data
 */
function generateCredentialHash(documentData) {
  const dataString = JSON.stringify({
    type: documentData.type,
    title: documentData.title,
    holder: documentData.holderPublicKey,
    issueDate: new Date().toISOString(),
    metadata: documentData.metadata,
  });
  
  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16) + Date.now().toString(16);
}

/**
 * Claim a document as NFT
 */
export async function claimDocumentAsNFT(connection, holderWallet, document) {
  try {
    // Create a memo transaction to mark the claim
    // In production, you would mint a proper NFT using Metaplex Token Metadata program
    const claimPayload = {
      v: 1,
      app: 'chaindocs',
      action: 'claim',
      documentId: document.documentId,
      holder: holderWallet.publicKey.toString(),
      claimedAt: new Date().toISOString(),
    };

    const encoder = new TextEncoder();
    const memoData = encoder.encode(JSON.stringify(claimPayload));

    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: memoData,
    });

    const transaction = new Transaction();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = holderWallet.publicKey;
    transaction.add(memoInstruction);

    if (typeof holderWallet.sendTransaction !== 'function') {
      throw new Error('Wallet does not support sending transactions');
    }

    // Send claim transaction
    const signature = await holderWallet.sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    }, 'confirmed');

    // Generate a mock NFT mint address (in production, this would be the actual NFT mint)
    const nftMint = Keypair.generate().publicKey.toString();

    // Mark as claimed in localStorage
    const claimedDocs = JSON.parse(localStorage.getItem('chaindocs_claimed') || '[]');
    if (!claimedDocs.includes(document.documentId)) {
      claimedDocs.push(document.documentId);
      localStorage.setItem('chaindocs_claimed', JSON.stringify(claimedDocs));
    }

    // Store NFT mint address
    localStorage.setItem(`chaindocs_nft_${document.documentId}`, nftMint);
    localStorage.setItem(`chaindocs_claim_tx_${document.documentId}`, signature);

    return {
      success: true,
      transactionSignature: signature,
      nftMint: nftMint,
    };
  } catch (error) {
    console.error('Error claiming document:', error);
    let errorMessage = 'Unknown error occurred';
    
    if (error.message) {
      errorMessage = error.message;
    }

    if (errorMessage.includes('User rejected')) {
      errorMessage = 'Transaction was rejected. Please try again and approve the transaction.';
    } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('0 SOL')) {
      errorMessage = 'Insufficient devnet SOL. Please get devnet SOL from a faucet.';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate shareable credentials for a document (for issuer to share with holder)
 */
export function generateShareableCredentials(documentId, holderPublicKey) {
  const allDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
  const document = allDocuments.find(doc => 
    doc.documentId === documentId && doc.holder === holderPublicKey.toString()
  );
  
  if (!document) {
    return null;
  }

  return {
    documentId: document.documentId,
    credentialHash: document.credentialHash,
    verificationUrl: `${window.location.origin}/verify?hash=${document.credentialHash}&id=${document.documentId}`,
  };
}

/**
 * Generate complete shareable document data (for manual transfer)
 */
export function generateShareableDocumentData(documentId) {
  const allDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
  const document = allDocuments.find(doc => doc.documentId === documentId);
  
  if (!document) {
    return null;
  }

  // Create a complete shareable payload
  const shareableData = {
    v: 1,
    app: 'chaindocs',
    documentId: document.documentId,
    issuer: document.issuer,
    holder: document.holder,
    documentType: document.documentType,
    title: document.title,
    issueDate: document.issueDate,
    credentialHash: document.credentialHash,
    transactionSignature: document.transactionSignature,
    metadata: document.metadata || {},
  };

  return {
    ...shareableData,
    shareableCode: btoa(JSON.stringify(shareableData)), // Base64 encoded for easy sharing
    shareableUrl: `${window.location.origin}/holder?import=${btoa(JSON.stringify(shareableData))}`,
  };
}

/**
 * Import document from shareable data
 */
export function importDocumentFromShareableData(shareableData) {
  try {
    // Handle both JSON object and base64 encoded string
    let documentData;
    
    if (typeof shareableData === 'string') {
      // Try to decode base64
      try {
        documentData = JSON.parse(atob(shareableData));
      } catch (e) {
        // Try parsing as direct JSON
        documentData = JSON.parse(shareableData);
      }
    } else {
      documentData = shareableData;
    }

    // Validate document data
    if (!documentData.documentId || !documentData.issuer || !documentData.holder) {
      throw new Error('Invalid document data');
    }

    // Create document record
    const documentRecord = {
      documentId: documentData.documentId,
      issuer: documentData.issuer,
      holder: documentData.holder,
      documentType: documentData.documentType || documentData.type,
      title: documentData.title,
      issueDate: documentData.issueDate || documentData.issuedAt,
      credentialHash: documentData.credentialHash,
      transactionSignature: documentData.transactionSignature,
      metadata: documentData.metadata || {},
    };

    // Save to localStorage
    const existingDocuments = JSON.parse(localStorage.getItem('chaindocs_documents') || '[]');
    const existingIndex = existingDocuments.findIndex(doc => doc.documentId === documentRecord.documentId);
    
    if (existingIndex >= 0) {
      // Update existing document
      existingDocuments[existingIndex] = documentRecord;
      console.log('📝 Updated existing document:', documentRecord.documentId);
    } else {
      // Add new document
      existingDocuments.push(documentRecord);
      console.log('✅ Added new document:', documentRecord.documentId);
    }
    
    localStorage.setItem('chaindocs_documents', JSON.stringify(existingDocuments));
    
    // Add issuer to registry
    const issuerRegistry = JSON.parse(localStorage.getItem('chaindocs_issuers') || '[]');
    if (!issuerRegistry.includes(documentRecord.issuer)) {
      issuerRegistry.push(documentRecord.issuer);
      localStorage.setItem('chaindocs_issuers', JSON.stringify(issuerRegistry));
    }

    return {
      success: true,
      document: documentRecord,
    };
  } catch (error) {
    console.error('Error importing document:', error);
    return {
      success: false,
      error: error.message || 'Invalid document data',
    };
  }
}
