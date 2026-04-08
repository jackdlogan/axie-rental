// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAxieDelegation {
    function delegate(uint256 tokenId, address delegatee, uint64 expiryTs, uint64 gameType) external;
    function bulkDelegate(
        uint256[] calldata tokenIds,
        address[] calldata delegatees,
        uint64[] calldata expiryTimes,
        uint64[] calldata gameTypes
    ) external;
    function revokeDelegation(uint256 tokenId) external;
    function getDelegationInfo(uint256 tokenId)
        external
        view
        returns (address delegatee, uint64 delegatedAt, uint64 expiryTs);
}

/// @title RentalEscrow v2
/// @notice Trustless escrow for Axie rentals.
///
/// Flow:
///   1. Borrower calls deposit() — funds locked in escrow.
///   2. Owner delegates Axie on-chain (AxieDelegation contract).
///   3. Anyone calls confirmDelegation() — escrow verifies delegation covers
///      the full rental period and records the start time. Funds stay locked.
///   4a. After rental period ends, owner calls claimFunds() to receive payment.
///   4b. If owner revokes early, borrower calls claimProRatedRefund() to receive
///       a refund proportional to unused time; owner keeps payment for time used.
///   4c. If owner never delegated within 24 h, borrower calls claimRefund()
///       for a full refund.
contract RentalEscrow {

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct RentalDeposit {
        address borrower;
        address owner;
        uint256 axieId;
        uint256 amount;
        uint256 rentalDays;
        uint256 depositedAt;          // when deposit() was called
        uint256 rentalStart;          // set by confirmDelegation(); 0 until then
        uint256 feeBps;               // fee rate snapshot — immune to admin changes
        bool    delegationConfirmed;
        bool    released;
        bool    refunded;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20            public immutable usdc;
    IAxieDelegation   public immutable axieDelegation;
    address           public admin;
    uint256           public platformFeeBps = 250;   // 2.5 %
    address           public feeRecipient;
    bool              public paused;

    // Fee timelock — prevents surprise fee hikes on live rentals
    uint256 public pendingFeeBps;
    uint256 public feeChangeAvailableAt;             // 0 when no proposal pending

    uint256 public constant DELEGATION_DEADLINE = 24 hours;
    uint256 public constant DURATION_BUFFER     = 1 hours;   // clock-drift tolerance
    uint256 public constant FEE_TIMELOCK        = 48 hours;
    uint256 public constant MAX_FEE_BPS         = 1000;      // 10 %

    mapping(bytes32 => RentalDeposit) public rentals;

    // ─── Events ──────────────────────────────────────────────────────────────

    event Deposited(
        bytes32 indexed rentalId,
        address indexed borrower,
        address indexed owner,
        uint256 amount
    );
    event DelegationConfirmed(
        bytes32 indexed rentalId,
        address indexed borrower,
        address indexed owner,
        uint256 axieId,
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

    /// @notice Borrower deposits USDC into escrow to initiate a rental.
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
            borrower:              msg.sender,
            owner:                 owner,
            axieId:                axieId,
            amount:                amount,
            rentalDays:            rentalDays,
            depositedAt:           block.timestamp,
            rentalStart:           0,
            feeBps:                platformFeeBps,
            delegationConfirmed:   false,
            released:              false,
            refunded:              false
        });

        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        emit Deposited(rentalId, msg.sender, owner, amount);
    }

    // ─── Step 2: Confirm delegation (anyone) ─────────────────────────────────

    /// @notice Verifies the Axie is delegated to the borrower for at least the
    ///         full rental period, then records the rental start time.
    ///         Funds remain locked — owner claims them after the rental ends.
    /// @dev    Can be called by anyone once the owner has delegated on-chain.
    function confirmDelegation(bytes32 rentalId) external {
        RentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0))  revert RentalNotFound();
        if (r.delegationConfirmed)     revert DelegationAlreadyConfirmed();
        if (r.refunded)                revert AlreadyRefunded();
        if (block.timestamp > r.depositedAt + DELEGATION_DEADLINE) revert DeadlinePassed();

        (address delegatee, , uint64 expiryTs) = axieDelegation.getDelegationInfo(r.axieId);

        if (delegatee != r.borrower)      revert NotDelegatedToBorrower();
        if (block.timestamp >= expiryTs)  revert DelegationExpiredOnChain();

        // Delegation must cover the full rental period (minus a small clock-drift buffer)
        if (expiryTs < block.timestamp + r.rentalDays * 1 days - DURATION_BUFFER)
            revert DurationTooShort();

        r.delegationConfirmed = true;
        r.rentalStart         = block.timestamp;

        emit DelegationConfirmed(rentalId, r.borrower, r.owner, r.axieId, block.timestamp);
    }

    // ─── Step 3a: Owner claims funds after rental period ─────────────────────

    /// @notice Owner receives full payment once the rental period has elapsed.
    function claimFunds(bytes32 rentalId) external {
        RentalDeposit storage r = rentals[rentalId];
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

        if (!usdc.transfer(r.owner, ownerAmount)) revert TransferFailed();
        if (fee > 0 && !usdc.transfer(feeRecipient, fee)) revert TransferFailed();

        emit Released(rentalId, r.owner, ownerAmount);
    }

    // ─── Step 3b: Borrower claims pro-rated refund if revoked early ──────────

    /// @notice If the owner revokes the Axie delegation before the rental period
    ///         ends, the borrower reclaims a refund for the unused time.
    ///         The owner keeps payment (minus fee) for the time the Axie was used.
    function claimProRatedRefund(bytes32 rentalId) external {
        RentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0))  revert RentalNotFound();
        if (!r.delegationConfirmed)    revert DelegationNotConfirmed();
        if (r.released)                revert AlreadyReleased();
        if (r.refunded)                revert AlreadyRefunded();
        if (msg.sender != r.borrower)  revert NotBorrower();

        uint256 rentalEnd = r.rentalStart + r.rentalDays * 1 days;
        if (block.timestamp >= rentalEnd) revert RentalPeriodEnded();

        // Delegation must no longer be active for the borrower
        (address delegatee, , uint64 expiryTs) = axieDelegation.getDelegationInfo(r.axieId);
        if (delegatee == r.borrower && block.timestamp < expiryTs) revert StillDelegated();

        r.refunded = true;

        // Pro-rate by seconds for precision
        uint256 secondsUsed  = block.timestamp - r.rentalStart;
        uint256 totalSeconds = r.rentalDays * 1 days;
        uint256 ownerEarned  = (r.amount * secondsUsed) / totalSeconds;

        uint256 fee           = (ownerEarned * r.feeBps) / 10_000;
        uint256 ownerAmount   = ownerEarned - fee;
        uint256 borrowerAmount = r.amount - ownerEarned;

        if (ownerAmount   > 0 && !usdc.transfer(r.owner,     ownerAmount))   revert TransferFailed();
        if (fee           > 0 && !usdc.transfer(feeRecipient, fee))          revert TransferFailed();
        if (borrowerAmount > 0 && !usdc.transfer(r.borrower, borrowerAmount)) revert TransferFailed();

        emit ProRatedRefund(rentalId, r.borrower, borrowerAmount, ownerAmount);
    }

    // ─── Step 3c: Borrower claims full refund if owner never delegated ───────

    /// @notice If the owner did not delegate within 24 h, borrower gets a full refund.
    function claimRefund(bytes32 rentalId) external {
        RentalDeposit storage r = rentals[rentalId];
        if (r.borrower == address(0))  revert RentalNotFound();
        if (r.delegationConfirmed)     revert DelegationAlreadyConfirmed();
        if (r.released)                revert AlreadyReleased();
        if (r.refunded)                revert AlreadyRefunded();
        if (msg.sender != r.borrower)  revert NotBorrower();
        if (block.timestamp < r.depositedAt + DELEGATION_DEADLINE) revert DeadlineNotPassed();

        (address delegatee, , uint64 expiryTs) = axieDelegation.getDelegationInfo(r.axieId);
        if (delegatee == r.borrower && block.timestamp < expiryTs) revert StillDelegated();

        r.refunded = true;

        if (!usdc.transfer(r.borrower, r.amount)) revert TransferFailed();

        emit Refunded(rentalId, r.borrower, r.amount);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getRental(bytes32 rentalId)
        external
        view
        returns (
            address borrower,
            address owner,
            uint256 axieId,
            uint256 amount,
            uint256 rentalDays,
            uint256 depositedAt,
            uint256 rentalStart,
            bool    delegationConfirmed,
            bool    released,
            bool    refunded
        )
    {
        RentalDeposit storage r = rentals[rentalId];
        return (
            r.borrower,
            r.owner,
            r.axieId,
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

    /// @notice Propose a fee change. Takes effect only after a 48 h timelock.
    function proposeFeeChange(uint256 _feeBps) external onlyAdmin {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        pendingFeeBps       = _feeBps;
        feeChangeAvailableAt = block.timestamp + FEE_TIMELOCK;
        emit FeeProposed(_feeBps, feeChangeAvailableAt);
    }

    /// @notice Execute the pending fee change after the timelock has passed.
    function executeFeeChange() external onlyAdmin {
        if (feeChangeAvailableAt == 0)                 revert NoFeePending();
        if (block.timestamp < feeChangeAvailableAt)    revert TimelockNotPassed();
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

    /// @notice Pause new deposits. Existing rentals (confirm/claim) are unaffected.
    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }
}
