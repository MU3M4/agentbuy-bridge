/**
 * One-time setup: deposit USDC into the Circle Gateway Wallet on Base Sepolia.
 *
 * GatewayClient.deposit() handles the approve + deposit transactions automatically.
 *
 * Usage:
 *   npm run deposit           # deposits 1 USDC (default)
 *   npm run deposit -- 0.5    # deposits 0.5 USDC
 *
 * Prerequisites:
 *   - PRIVATE_KEY set in .env
 *   - Testnet USDC on Base Sepolia: https://faucet.circle.com
 *   - Testnet ETH on Base Sepolia for gas: https://www.alchemy.com/faucets/base-sepolia
 */

import { GatewayClient } from "@circle-fin/x402-batching/client";

const rawKey = process.env.PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "";
if (!rawKey) throw new Error("PRIVATE_KEY (or EVM_PRIVATE_KEY) is required in .env");
const PRIVATE_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

const depositAmount = process.argv[2] || "1";

async function main() {
  const client = new GatewayClient({
    chain: "baseSepolia",
    privateKey: PRIVATE_KEY,
  });

  const before = await client.getBalances();
  console.log(`Wallet USDC     : ${before.wallet.formatted} USDC`);
  console.log(`Gateway balance : ${before.gateway.formattedAvailable} USDC\n`);

  if (Number(before.wallet.formatted) < Number(depositAmount)) {
    console.log(`Insufficient wallet USDC. Get testnet USDC from: https://faucet.circle.com`);
    process.exit(1);
  }

  console.log(`Depositing ${depositAmount} USDC into Circle Gateway Wallet...`);
  console.log(`(Note: Base Sepolia deposits take ~13-19 min to confirm onchain)\n`);

  const deposit = await client.deposit(depositAmount);
  console.log(`Deposit tx: ${deposit.depositTxHash}`);
  console.log(`Waiting for onchain confirmation...`);

  const after = await client.getBalances();
  console.log(`\nNew Gateway balance : ${after.gateway.formattedAvailable} USDC`);
  console.log(`Done. Run: npm run client`);
}

main().catch(console.error);
