// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC20.sol";
import "./interfaces/IAxieDelegation.sol";

/// @title TeamRentalEscrow
/// @notice Trustless escrow for Axie team rentals (multiple Axies per rental, up to 50).
///
/// Flow:
///   1. Borrower calls deposit() — funds locked in escrow for the whole team.
///   2. Owner bulk-delegates all Axies on-chain (AxieDelegation.bulkDelegate).
///   3. Anyone calls confirmDelegation() — escrow verifies ALL Axies are delegated
///      to the borrower for the full rental period and records the start time.
///   4a. After rental period ends, owner calls claimFunds().
///   4b. If owner revokes ANY Axie early, borrower calls claimProRatedRefund().
///   4c. If owner never delegated within 24 h, borrower calls claimRefund().
///   4d. Owner can immediately refund a rejected offer via refundRejected().
contract TeamRentalEscrow {

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct TeamRentalDeposit {
        address  borrower;
        address  owner;
        uint256[] axieIds;          // up to 50 Axies
        uint256  amount;            // total price for the whole team
        uint256  rentalDays;
        uint256  depositedAt;
        uint256  rentalStart;       // set by confirmDelegation(); 0 until then
        uint256  feeBps;
        bool     delegationConfirmed;
        bool     released;
        bool     refunded;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20           public immutable usdc;
    IAxieDelegation  public immutable axieDelegation;
    address          public admin;
    uint256          public platformFeeBps = 250;  // 2.5 %
    address          public feeRecipient;
    bool             public paused;

    uint256 public pendingFeeBps;
    uint256 public feeChangeAvailableAt;

    uint256 public constant DELEGATION_DEADLINE = 24 hours;
    uint256 public constant DURATION_BUFFER     = 1 hours;
    uint256 public constant FEE_TIMELOCK        = 48 hours;
    uint256 public constant MAX_FEE_BPS         = 1000;
    uint256 public constant MAX_AXIES           = 50;

    mapping(bytes32 => TeamRentalDeposit) public rentals;

    // ─── Events ──────────────────────────────────────────────────────────────

    event Deposited(
        bytes32 indexed rentalId,
        address indexed borrower,
        address indexed owner,
        uint256 amount,
        uint256[] axieIds
    );
    event DelegationConfirmed(
        bytes32 indexed rentalId,
        address indexed borrower,
        address indexed owner,
        uint256[] axieIds,
        uint256 rentalStart
    );
    event Released(
        bytes32 indexed rentalId,
        address indexed owner,
        uint256 amount
    );
    event ProRatedRefund(
        bytes32 indexed rentalId,
        address indexed borrower,
        uint256 borrowerAmount,
        uint256 ownerAmount
    );
    event Refunded(
        bytes32 indexed rentalId,
        address indexed borrower,
        uint256 amount
    );
    event FeeProposed(uint256 feeBps, uint256 availableAt);
    event FeeExecuted(uint256 feeBps);
    event FeeRecipientUpdated(address recipient);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error RentalAlreadyExists();
    error RentalNotFound();
    error NotBorrower();
    error NotOwner();
    error AlreadyReleased();
    error AlreadyRefunded();
    error DelegationAlreadyConfirmed();
    error DelegationNotConfirmed();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error RentalPeriodNotEnded();
    error RentalPeriodEnded();
    error NotDelegatedToBorrower();
    error DelegationExpiredOnChain();
    error DurationTooShort();
    error StillDelegated();
    error ZeroAmount();
    error TransferFailed();
    error FeeTooHigh();
    error NoFeePending();
    error TimelockNotPassed();
    error NotAdmin();
    error ZeroAddress();
    error ContractPaused();
    error TooManyAxies();
    error NoAxies();

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _axieDelegation,
        address _feeRecipient
    ) {
        if (_usdc == address(0) || _axieDelegation == address(0) || _feeRecipient == address(0))
            revert ZeroAddress();
        usdc           = IERC20(_usdc);
        axieDelegation = IAxieDelegation(_axieDelegation);
        admin          = msg.sender;
        feeRecipient   = _feeRecipient;
    }

    // ─── Step 1: Borrower deposits ───────────────────────────────────────────

    /// @notice Borrower deposits USDC into escrow for a team rental.
    /// @param axieIds  Array of Axie token IDs in the team (max 50).
    function deposit(
        bytes32 rentalId,
        address owner,
        uint256[] calldata axieIds,
        uint256 amount,
        uint256 rentalDays
    ) external whenNotPaused {
        if (rentals[rentalId].borrower != address(0)) revert RentalAlreadyExists();
        if (amount == 0)                              revert ZeroAmount();
        if (axieIds.length == 0)                      revert NoAxies();
        if (axieIds.length > MAX_AXIES)               revert TooManyAxies();

        rentals[rentalId] = TeamRentalDeposit({
            borrower:            msg.sender,
            owner:               owner,
            axieIds:             axieIds,
            amount:              amount,
            rentalDays:          rentalDays,
            depositedAt:         block.timestamp,
            rentalStart:         0,
            feeBps:              platformFeeBps,
            delegationConfirmed: false,
            released:            false,
            refunded:            false
        });

        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        emit Deposited(rentalId, msg.sender, owner, amount, axieIds);
    }

    // ─── Step 2: Confirm delegation (anyone) ─────────────────────────────────

    /// @notice Verifies ALL Axies in the team are delegated to the borrower for
    ///         at least the full rental period, then records the rental start time.
    function confirmDelegation(bytes32 rentalId) external {
        TeamRentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0))  revert RentalNotFound();
        if (r.delegationConfirmed)     revert DelegationAlreadyConfirmed();
        if (r.refunded)                revert AlreadyRefunded();
        if (block.timestamp > r.depositedAt + DELEGATION_DEADLINE) revert DeadlinePassed();

        uint256 len = r.axieIds.length;
        for (uint256 i = 0; i < len; i++) {
            (address delegatee, , uint64 expiryTs) = axieDelegation.getDelegationInfo(r.axieIds[i]);

            if (delegatee != r.borrower)     revert NotDelegatedToBorrower();
            if (block.timestamp >= expiryTs) revert DelegationExpiredOnChain();
            if (expiryTs < block.timestamp + r.rentalDays * 1 days - DURATION_BUFFER)
                revert DurationTooShort();
        }

        r.delegationConfirmed = true;
        r.rentalStart         = block.timestamp;

        emit DelegationConfirmed(rentalId, r.borrower, r.owner, r.axieIds, block.timestamp);
    }

    // ─── Step 3a: Owner claims funds after rental period ─────────────────────

    function claimFunds(bytes32 rentalId) external {
        TeamRentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0))  revert RentalNotFound();
        if (!r.delegationConfirmed)    revert DelegationNotConfirmed();
        if (r.released)                revert AlreadyReleased();
        if (r.refunded)                revert AlreadyRefunded();
        if (msg.sender != r.owner)     revert NotOwner();
        if (block.timestamp < r.rentalStart + r.rentalDays * 1 days)
            revert RentalPeriodNotEnded();

        r.released = true;

        uint256 fee         = (r.amount * r.feeBps) / 10_000;
        uint256 ownerAmount = r.amount - fee;

        if (!usdc.transfer(r.owner, ownerAmount))        revert TransferFailed();
        if (fee > 0 && !usdc.transfer(feeRecipient, fee)) revert TransferFailed();

        emit Released(rentalId, r.owner, ownerAmount);
    }

    // ─── Step 3b: Borrower claims pro-rated refund if ANY Axie revoked early ─

    /// @notice If the owner revokes ANY Axie in the team before the rental period
    ///         ends, the borrower reclaims a refund for the unused time.
    function claimProRatedRefund(bytes32 rentalId) external {
        TeamRentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0))  revert RentalNotFound();
        if (!r.delegationConfirmed)    revert DelegationNotConfirmed();
        if (r.released)                revert AlreadyReleased();
        if (r.refunded)                revert AlreadyRefunded();
        if (msg.sender != r.borrower)  revert NotBorrower();

        uint256 rentalEnd = r.rentalStart + r.rentalDays * 1 days;
        if (block.timestamp >= rentalEnd) revert RentalPeriodEnded();

        // Check that at least one Axie is no longer delegated to the borrower
        bool anyRevoked = false;
        uint256 len = r.axieIds.length;
        for (uint256 i = 0; i < len; i++) {
            (address delegatee, , uint64 expiryTs) = axieDelegation.getDelegationInfo(r.axieIds[i]);
            if (delegatee != r.borrower || block.timestamp >= expiryTs) {
                anyRevoked = true;
                break;
            }
        }
        if (!anyRevoked) revert StillDelegated();

        r.refunded = true;

        uint256 secondsUsed   = block.timestamp - r.rentalStart;
        uint256 totalSeconds  = r.rentalDays * 1 days;
        uint256 ownerEarned   = (r.amount * secondsUsed) / totalSeconds;

        uint256 fee            = (ownerEarned * r.feeBps) / 10_000;
        uint256 ownerAmount    = ownerEarned - fee;
        uint256 borrowerAmount = r.amount - ownerEarned;

        if (ownerAmount    > 0 && !usdc.transfer(r.owner,      ownerAmount))    revert TransferFailed();
        if (fee            > 0 && !usdc.transfer(feeRecipient, fee))            revert TransferFailed();
        if (borrowerAmount > 0 && !usdc.transfer(r.borrower,   borrowerAmount)) revert TransferFailed();

        emit ProRatedRefund(rentalId, r.borrower, borrowerAmount, ownerAmount);
    }

    // ─── Step 3c: Owner immediately refunds a rejected offer ─────────────────

    /// @notice Owner can immediately refund a borrower whose offer was not chosen,
    ///         without waiting for the 24 h deadline.
    function refundRejected(bytes32 rentalId) external {
        TeamRentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0))  revert RentalNotFound();
        if (r.delegationConfirmed)     revert DelegationAlreadyConfirmed();
        if (r.released)                revert AlreadyReleased();
        if (r.refunded)                revert AlreadyRefunded();
        if (msg.sender != r.owner)     revert NotOwner();

        r.refunded = true;

        if (!usdc.transfer(r.borrower, r.amount)) revert TransferFailed();

        emit Refunded(rentalId, r.borrower, r.amount);
    }

    // ─── Step 3d: Borrower claims full refund if owner never delegated ────────

    /// @notice If the owner did not delegate within 24 h, borrower gets a full refund.
    function claimRefund(bytes32 rentalId) external {
        TeamRentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0))  revert RentalNotFound();
        if (r.delegationConfirmed)     revert DelegationAlreadyConfirmed();
        if (r.released)                revert AlreadyReleased();
        if (r.refunded)                revert AlreadyRefunded();
        if (msg.sender != r.borrower)  revert NotBorrower();
        if (block.timestamp < r.depositedAt + DELEGATION_DEADLINE) revert DeadlineNotPassed();

        // Ensure none of the axies are still delegated to the borrower
        uint256 len = r.axieIds.length;
        for (uint256 i = 0; i < len; i++) {
            (address delegatee, , uint64 expiryTs) = axieDelegation.getDelegationInfo(r.axieIds[i]);
            if (delegatee == r.borrower && block.timestamp < expiryTs) revert StillDelegated();
        }

        r.refunded = true;

        if (!usdc.transfer(r.borrower, r.amount)) revert TransferFailed();

        emit Refunded(rentalId, r.borrower, r.amount);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getRental(bytes32 rentalId)
        external
        view
        returns (
            address  borrower,
            address  owner,
            uint256[] memory axieIds,
            uint256  amount,
            uint256  rentalDays,
            uint256  depositedAt,
            uint256  rentalStart,
            bool     delegationConfirmed,
            bool     released,
            bool     refunded
        )
    {
        TeamRentalDeposit storage r = rentals[rentalId];
        return (
            r.borrower,
            r.owner,
            r.axieIds,
            r.amount,
            r.rentalDays,
            r.depositedAt,
            r.rentalStart,
            r.delegationConfirmed,
            r.released,
            r.refunded
        );
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function proposeFeeChange(uint256 _feeBps) external onlyAdmin {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        pendingFeeBps        = _feeBps;
        feeChangeAvailableAt = block.timestamp + FEE_TIMELOCK;
        emit FeeProposed(_feeBps, feeChangeAvailableAt);
    }

    function executeFeeChange() external onlyAdmin {
        if (feeChangeAvailableAt == 0)              revert NoFeePending();
        if (block.timestamp < feeChangeAvailableAt) revert TimelockNotPassed();
        platformFeeBps       = pendingFeeBps;
        feeChangeAvailableAt = 0;
        emit FeeExecuted(platformFeeBps);
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

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }
}
