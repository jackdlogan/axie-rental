// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAxieDelegation {
    // selector: 0xae6a2ef4 — delegate(uint256,address,uint64,uint64)
    // gameType = 0 for Axie Origin
    function delegate(uint256 tokenId, address delegatee, uint64 expiryTs, uint64 gameType) external;
    function bulkDelegate(
        uint256[] calldata tokenIds,
        address[] calldata delegatees,
        uint64[] calldata expiryTimes,
        uint64[] calldata gameTypes
    ) external;
    function revokeDelegation(uint256 tokenId) external;
    // NOTE: isDelegated() is in the spec but NOT on the live contract — use getDelegationInfo instead.
    function getDelegationInfo(uint256 tokenId)
        external
        view
        returns (address delegatee, uint64 delegatedAt, uint64 expiryTs);
}
