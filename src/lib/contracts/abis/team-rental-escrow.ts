export const teamRentalEscrowAbi = [
  // ── Write ──────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "rentalId",   type: "bytes32"   },
      { name: "owner",      type: "address"   },
      { name: "axieIds",    type: "uint256[]" },
      { name: "amount",     type: "uint256"   },
      { name: "rentalDays", type: "uint256"   },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "confirmDelegation",
    inputs: [{ name: "rentalId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimFunds",
    inputs: [{ name: "rentalId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimProRatedRefund",
    inputs: [{ name: "rentalId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRefund",
    inputs: [{ name: "rentalId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refundRejected",
    inputs: [{ name: "rentalId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── Read ───────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "getRental",
    inputs: [{ name: "rentalId", type: "bytes32" }],
    outputs: [
      { name: "borrower",            type: "address"   },
      { name: "owner",               type: "address"   },
      { name: "axieIds",             type: "uint256[]" },
      { name: "amount",              type: "uint256"   },
      { name: "rentalDays",          type: "uint256"   },
      { name: "depositedAt",         type: "uint256"   },
      { name: "rentalStart",         type: "uint256"   },
      { name: "delegationConfirmed", type: "bool"      },
      { name: "released",            type: "bool"      },
      { name: "refunded",            type: "bool"      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "platformFeeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // ── Events ─────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "rentalId", type: "bytes32",   indexed: true  },
      { name: "borrower", type: "address",   indexed: true  },
      { name: "owner",    type: "address",   indexed: true  },
      { name: "amount",   type: "uint256",   indexed: false },
      { name: "axieIds",  type: "uint256[]", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DelegationConfirmed",
    inputs: [
      { name: "rentalId",    type: "bytes32",   indexed: true  },
      { name: "borrower",    type: "address",   indexed: true  },
      { name: "owner",       type: "address",   indexed: true  },
      { name: "axieIds",     type: "uint256[]", indexed: false },
      { name: "rentalStart", type: "uint256",   indexed: false },
    ],
  },
  {
    type: "event",
    name: "Released",
    inputs: [
      { name: "rentalId", type: "bytes32", indexed: true  },
      { name: "owner",    type: "address", indexed: true  },
      { name: "amount",   type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProRatedRefund",
    inputs: [
      { name: "rentalId",       type: "bytes32", indexed: true  },
      { name: "borrower",       type: "address", indexed: true  },
      { name: "borrowerAmount", type: "uint256", indexed: false },
      { name: "ownerAmount",    type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { name: "rentalId", type: "bytes32", indexed: true  },
      { name: "borrower", type: "address", indexed: true  },
      { name: "amount",   type: "uint256", indexed: false },
    ],
  },
] as const;
