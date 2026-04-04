// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC20.sol";
import "./interfaces/IAxieDelegation.sol";

/// @title RentalEscrow
/// @notice Trustless escrow for Axie rentals. Borrower deposits USDC; owner
///         delegates the Axie; escrow verifies the Axie is delegated to the
///         borrower via the official AxieDelegation contract, then releases funds.
///         If the owner fails to delegate within DELEGATION_DEADLINE, borrower
///         can claim a full refund.
contract RentalEscrow {
    // ─── Structs ────────────────────────────────────────────────────────────

    struct RentalDeposit {
        address borrower;
        address owner;
        uint256 axieId;
        uint256 amount;
        uint256 rentalDays;
        uint256 deadline;   // timestamp by which owner must delegate
        uint256 feeBps;     // fee rate locked at deposit time — admin changes don't affect live rentals
        bool released;
        bool refunded;
    }

    // ─── State ──────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    /// @dev Axie NFT proxy – used to check lock state via raw selector 0xc7d25b15
    address public immutable axieNft;
    /// @dev AxieDelegation proxy – used to verify isDelegated for confirmAndRelease
    IAxieDelegation public immutable axieDelegation;
    address public admin;
    uint256 public platformFeeBps = 250; // 2.5%
    address public feeRecipient;
    bool public paused;

    uint256 public constant DELEGATION_DEADLINE = 24 hours;
    uint256 public constant MAX_FEE_BPS = 1000; // 10%

    mapping(bytes32 => RentalDeposit) public rentals;

    // ─── Events ─────────────────────────────────────────────────────────────

    event Deposited(
        bytes32 indexed rentalId,
        address indexed borrower,
        address indexed owner,
        uint256 amount
    );
    event Released(
        bytes32 indexed rentalId,
        address indexed owner,
        uint256 amount
    );
    event Refunded(
        bytes32 indexed rentalId,
        address indexed borrower,
        uint256 amount
    );
    event FeeUpdated(uint256 feeBps);
    event FeeRecipientUpdated(address recipient);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event Paused(address indexed admin);
    event Unpaused(address indexed admin);

    // ─── Errors ─────────────────────────────────────────────────────────────

    error RentalAlreadyExists();
    error RentalNotFound();
    error NotBorrower();
    error AlreadyReleased();
    error AlreadyRefunded();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error NotDelegated();
    error StillDelegated();
    error ZeroAmount();
    error TransferFailed();
    error FeeTooHigh();
    error NotAdmin();
    error ZeroAddress();
    error ContractPaused();

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _axieNft,
        address _axieDelegation,
        address _feeRecipient
    ) {
        if (
            _usdc == address(0) ||
            _axieNft == address(0) ||
            _axieDelegation == address(0) ||
            _feeRecipient == address(0)
        ) revert ZeroAddress();
        usdc = IERC20(_usdc);
        axieNft = _axieNft;
        axieDelegation = IAxieDelegation(_axieDelegation);
        admin = msg.sender;
        feeRecipient = _feeRecipient;
    }

    // ─── Internal: NFT lock check ────────────────────────────────────────────

    /// @dev Calls the lock-state function on the Axie NFT contract (selector 0xc7d25b15).
    ///      Returns true if the axie context is locked (i.e. owner has delegated it and
    ///      not yet revoked). The context lock persists even after delegation expiry until
    ///      the owner calls revokeDelegation — making this the correct check for claimRefund.
    function _isAxieLocked(uint256 axieId) internal view returns (bool) {
        (bool success, bytes memory data) = axieNft.staticcall(
            abi.encodeWithSelector(bytes4(0xc7d25b15), axieId)
        );
        if (!success || data.length < 32) return false;
        return abi.decode(data, (uint256)) != 0;
    }

    // ─── Borrower: Deposit ───────────────────────────────────────────────────

    /// @notice Borrower deposits USDC into escrow to initiate a rental.
    /// @param rentalId  Off-chain rental ID (keccak256 of DB id).
    /// @param owner     Address of the Axie owner.
    /// @param axieId    Token ID of the Axie to be rented.
    /// @param amount    USDC amount (in wei, 6 decimals for USDC).
    /// @param rentalDays Number of days for the rental.
    function deposit(
        bytes32 rentalId,
        address owner,
        uint256 axieId,
        uint256 amount,
        uint256 rentalDays
    ) external whenNotPaused {
        if (rentals[rentalId].borrower != address(0)) revert RentalAlreadyExists();
        if (amount == 0) revert ZeroAmount();

        rentals[rentalId] = RentalDeposit({
            borrower: msg.sender,
            owner: owner,
            axieId: axieId,
            amount: amount,
            rentalDays: rentalDays,
            deadline: block.timestamp + DELEGATION_DEADLINE,
            feeBps: platformFeeBps,  // snapshot fee rate — immune to admin changes
            released: false,
            refunded: false
        });

        if (!usdc.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }

        emit Deposited(rentalId, msg.sender, owner, amount);
    }

    // ─── Anyone: Confirm & Release ──────────────────────────────────────────

    /// @notice Verify that the Axie is actively delegated to the borrower on-chain,
    ///         then release USDC to the owner (minus platform fee).
    ///         Can be called by anyone once delegation is confirmed on-chain.
    ///         Uses getDelegationInfo() — isDelegated() is not on the live contract.
    function confirmAndRelease(bytes32 rentalId) external {
        RentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0)) revert RentalNotFound();
        if (r.released) revert AlreadyReleased();
        if (r.refunded) revert AlreadyRefunded();
        (address delegatee, , uint64 expiryTs) = axieDelegation.getDelegationInfo(r.axieId);
        if (delegatee != r.borrower || block.timestamp > expiryTs) revert NotDelegated();

        r.released = true;

        uint256 fee = (r.amount * r.feeBps) / 10_000;
        uint256 ownerAmount = r.amount - fee;

        if (!usdc.transfer(r.owner, ownerAmount)) revert TransferFailed();
        if (fee > 0 && !usdc.transfer(feeRecipient, fee)) revert TransferFailed();

        emit Released(rentalId, r.owner, ownerAmount);
    }

    // ─── Borrower: Claim Refund ──────────────────────────────────────────────

    /// @notice If owner did not delegate within 24h, borrower can claim a full refund.
    ///         Uses _isAxieLocked (REP15 context lock) which persists even after
    ///         delegation expiry until the owner explicitly revokes — preventing a
    ///         borrower from claiming a refund after the axie was already used.
    function claimRefund(bytes32 rentalId) external {
        RentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0)) revert RentalNotFound();
        if (r.released) revert AlreadyReleased();
        if (r.refunded) revert AlreadyRefunded();
        if (msg.sender != r.borrower) revert NotBorrower();
        if (block.timestamp < r.deadline) revert DeadlineNotPassed();
        // Cannot refund if owner delegated (context lock persists until revocation)
        if (_isAxieLocked(r.axieId)) revert StillDelegated();

        r.refunded = true;

        if (!usdc.transfer(r.borrower, r.amount)) revert TransferFailed();

        emit Refunded(rentalId, r.borrower, r.amount);
    }

    // ─── View ────────────────────────────────────────────────────────────────

    function getRental(bytes32 rentalId)
        external
        view
        returns (
            address borrower,
            address owner,
            uint256 axieId,
            uint256 amount,
            uint256 rentalDays,
            uint256 deadline,
            bool released,
            bool refunded
        )
    {
        RentalDeposit storage r = rentals[rentalId];
        return (
            r.borrower,
            r.owner,
            r.axieId,
            r.amount,
            r.rentalDays,
            r.deadline,
            r.released,
            r.refunded
        );
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setFee(uint256 _feeBps) external onlyAdmin {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        platformFeeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setFeeRecipient(address _recipient) external onlyAdmin {
        if (_recipient == address(0)) revert ZeroAddress();
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    function transferAdmin(address _newAdmin) external onlyAdmin {
        if (_newAdmin == address(0)) revert ZeroAddress();
        emit AdminTransferred(admin, _newAdmin);
        admin = _newAdmin;
    }

    /// @notice Pause new deposits. Existing rentals (confirm/refund) are unaffected.
    ///         Use if the Axie NFT or delegation contract behaves unexpectedly.
    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Resume new deposits.
    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }
}
