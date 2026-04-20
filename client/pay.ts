/**
 * Buyer client — pays for LLM inference via Circle USDC Nano Payments (x402)
 *
 * Prerequisites:
 *   1. Deposit USDC into your Gateway Wallet first: npm run deposit
 *   2. Fill in .env (PRIVATE_KEY, RESOURCE_SERVER_URL)
 *
 * GatewayClient.pay() handles the full x402 flow automatically:
 *   - Initial request → receives 402 + GatewayWalletBatched payment requirements
 *   - Signs EIP-3009 TransferWithAuthorization offchain (zero gas)
 *   - Retries with PAYMENT-SIGNATURE header
 *   - Returns the response on success
 */

import { GatewayClient } from "@circle-fin/x402-batching/client";

const rawKey = process.env.PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "";
if (!rawKey) throw new Error("PRIVATE_KEY (or EVM_PRIVATE_KEY) is required in .env");
const PRIVATE_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
const SERVER_URL = process.env.RESOURCE_SERVER_URL || "http://localhost:4021";

// Edit this to change what you ask the LLM
const PROMPT = "Explain what Circle USDC nano payments are in two sentences.";

async function main() {
  const client = new GatewayClient({
    chain: "baseSepolia",
    privateKey: PRIVATE_KEY,
  });

  // Check Gateway Wallet balance before attempting payment
  const balances = await client.getBalances();
  console.log(`Gateway balance : ${balances.gateway.formattedAvailable} USDC`);
  console.log(`Wallet USDC     : ${balances.wallet.formatted} USDC\n`);

  if (balances.gateway.available < 10_000n) {
    console.log("Gateway balance too low. Run: npm run deposit");
    process.exit(1);
  }

  const url = `${SERVER_URL}/chat`;
  console.log(`Calling : POST ${url}`);
  console.log(`Prompt  : ${PROMPT}\n`);

  // GatewayClient.pay() negotiates payment automatically
  const { data, status } = await client.pay<{
    reply: string;
    model: string;
    usage: Record<string, number>;
  }>(url, {
    method: "POST",
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You are a concise assistant." },
        { role: "user", content: PROMPT },
      ],
    }),
    headers: { "Content-Type": "application/json" },
  });

  console.log(`Status : ${status}`);
  console.log(`Reply  : ${data.reply}`);
  console.log(`Model  : ${data.model}`);
  console.log(`Usage  :`, data.usage);

  // Show updated balance
  const updated = await client.getBalances();
  console.log(`\nGateway balance after : ${updated.gateway.formattedAvailable} USDC`);
}

main().catch(console.error);
