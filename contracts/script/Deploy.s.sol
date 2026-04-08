// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../RentalEscrow.sol";

contract Deploy is Script {
    // Ronin mainnet addresses
    address constant USDC            = 0x0B7007c13325C48911F73A2daD5FA5dCBf808aDc;
    address constant AXIE_DELEGATION = 0xD6d11474eb323521ada927f14A4b839b90009Ac8;

    function run() external {
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        RentalEscrow escrow = new RentalEscrow(USDC, AXIE_DELEGATION, feeRecipient);
        vm.stopBroadcast();

        console.log("RentalEscrow deployed at:", address(escrow));
    }
}
