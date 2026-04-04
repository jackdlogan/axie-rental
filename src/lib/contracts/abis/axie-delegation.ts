export const axieDelegationAbi = [
  {
    // selector: 0xae6a2ef4 — verified against on-chain successful tx
    type: "function",
    name: "delegate",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "delegatee", type: "address" },
      { name: "expiryTs", type: "uint64" },
      { name: "gameType", type: "uint64" },  // pass 0 for Axie Origin
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "bulkDelegate",
    inputs: [
      { name: "tokenIds", type: "uint256[]" },
      { name: "delegatees", type: "address[]" },
      { name: "expiryTimes", type: "uint64[]" },
      { name: "gameTypes", type: "uint64[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    // Returns (contextHash) — used to get the bytes32 key for attachContext
    type: "function",
    name: "getContextHash",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "revokeDelegation",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getDelegationInfo",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "delegatee", type: "address" },
      { name: "delegatedAt", type: "uint64" },
      { name: "expiryTs", type: "uint64" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isDelegated",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AxieDelegated",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "delegatee", type: "address", indexed: true },
      { name: "expiryTs", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DelegationRevoked",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "operator", type: "address", indexed: true },
    ],
  },
] as const;
