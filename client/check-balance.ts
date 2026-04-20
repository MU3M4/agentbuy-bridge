/**
 * Polls Circle Gateway balance every 60 seconds until the deposit is credited.
 * Run: npm run balance
 */

import { GatewayClient } from "@circle-fin/x402-batching/client";

const rawKey = process.env.PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "";
if (!rawKey) throw new Error("PRIVATE_KEY (or EVM_PRIVATE_KEY) is required in .env");
const PRIVATE_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

const client = new GatewayClient({ chain: "baseSepolia", privateKey: PRIVATE_KEY });

async function checkOnce() {
  const b = await client.getBalances();
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}]  Gateway: ${b.gateway.formattedAvailable} USDC  |  Wallet: ${b.wallet.formatted} USDC`);
  return b.gateway.available;
}

async function poll() {
  console.log("Polling Circle Gateway balance (every 60s)...\n");

  const available = await checkOnce();
  if (available > 0n) {
    console.log("\nBalance credited. Run: npm run client");
    process.exit(0);
  }

  const interval = setInterval(async () => {
    const available = await checkOnce();
    if (available > 0n) {
      console.log("\nBalance credited. Run: npm run client");
      clearInterval(interval);
      process.exit(0);
    }
  }, 60_000);
}

poll().catch(console.error);
