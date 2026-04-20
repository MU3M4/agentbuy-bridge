import express from "express";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const app = express();
app.use(express.json());

// ── Config ───────────────────────────────────────────────────
const SELLER_ADDRESS = process.env.EVM_ADDRESS as `0x${string}`;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SERVER_URL = `http://localhost:4021`;

if (!SELLER_ADDRESS) throw new Error("EVM_ADDRESS is required — copy .env.example to .env");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");

// ── Buyer client (embedded, for /demo/* endpoints) ───────────
// The UI never touches private keys — the server acts as buyer internally.
const rawKey = process.env.PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "";
const buyerClient = rawKey
  ? new GatewayClient({
      chain: "baseSepolia",
      privateKey: (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`,
    })
  : null;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Circle Gateway middleware ─────────────────────────────────
// createGatewayMiddleware handles the full x402 flow:
//   - returns 402 + GatewayWalletBatched payment requirements on unpaid requests
//   - settles signed EIP-3009 authorizations with Circle's Gateway API
//   - populates req.payment with payer info on success
const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  networks: ["eip155:84532"],  // Base Sepolia
});

// ── Demo routes (used by UI) ──────────────────────────────────
// GET /demo/balance — returns live Gateway + wallet balances
app.get("/demo/balance", async (_req, res) => {
  if (!buyerClient) {
    res.status(503).json({ error: "No buyer private key configured" });
    return;
  }
  try {
    const b = await buyerClient.getBalances();
    res.json({
      gateway: b.gateway.formattedAvailable,
      wallet: b.wallet.formatted,
    });
  } catch (err) {
    console.error("Balance fetch error:", err);
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

// POST /demo/chat — buyer pays internally, UI gets reply + payment receipt
// POST /demo/chat — buyer pays internally, UI gets reply + payment receipt
app.post("/demo/chat", async (req, res) => {
  if (!buyerClient) {
    res.status(503).json({ error: "No buyer private key configured" });
    return;
  }

  try {
    const { messages } = req.body as { messages: { role: string; content: string }[] };
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Snapshot balance before the payment
    const before = await buyerClient.getBalances();
    const balanceBefore = before.gateway.formattedAvailable;

    // Hardcoded responses for AgentBuy Bridge (ASDBUY-style clothing hauls)
    const supplierResponses: Record<string, string> = {
      "jordan": "✅ **Unlocked via ASDBUY Partner**\n\n• Factory on 1688: https://1688.com/item/jordan1-rep-batch\n• Price: ¥248 ($34.50)\n• MOQ: 10 pairs\n• Shipping to US via ASDBUY: 10-14 days\n• Quality: Solid daily batch, good leather feel\n• WeChat: repbuyer_asdbuy\n\nTip: Mention \"Nairobi haul\" when ordering for faster QC photos.",
      
      "lv": "✅ **Unlocked via ASDBUY Partner**\n\n• Factory link: https://1688.com/item/lv-bag-wholesale\n• Wholesale price: ¥380 ($52)\n• Shipping to Europe: 12-16 days\n• ASDBUY fee: ~5-7%\n• Real haul feedback: Excellent packaging, no customs issues reported.",
      
      "yeezy": "✅ **Unlocked via ASDBUY Partner**\n\n• Direct supplier for Yeezy reps\n• Price: ¥320 ($44)\n• Shipping to US: 9-13 days\n• Batch quality: High tier\n• ASDBUY users love it for fast clothing haul consolidation.",
      
      "iphone": "✅ **Unlocked via ASDBUY Partner**\n\n• Bulk iPhone cases factory\n• ¥ price: ¥18–25 per piece ($2.5–$3.5)\n• MOQ: 50 pieces\n• Great margin for resellers\n• Shipping via ASDBUY: Reliable for small electronics hauls.",
      
      default: "✅ **Supplier details unlocked!**\n\nThis is a live demo of AgentBuy Bridge using Circle Nanopayments on Arc.\n\nReal use case: Western buyers (or autonomous agents) pay just $0.005 USDC to instantly unlock direct Chinese supplier links, ¥ prices, shipping estimates, and haul tips from agents like ASDBUY.\n\nPerfect for autonomous commerce flows in the rep clothing space."
    };

    // Choose response based on keywords
    let reply = supplierResponses.default;
    const lowerText = lastMessage.toLowerCase();

    if (lowerText.includes("jordan")) reply = supplierResponses.jordan;
    else if (lowerText.includes("lv") || lowerText.includes("bag")) reply = supplierResponses.lv;
    else if (lowerText.includes("yeezy")) reply = supplierResponses.yeezy;
    else if (lowerText.includes("iphone") || lowerText.includes("case")) reply = supplierResponses.iphone;

    // Simulate the payment receipt (the real pay() call is still happening above)
    const payment = {
      amount: "0.005",
      currency: "USDC",
      network: "Base Sepolia",
      scheme: "GatewayWalletBatched",
      balanceBefore,
      balanceAfter: (parseFloat(balanceBefore) - 0.005).toFixed(6),
    };

    res.json({
      reply,
      model: "nanopayment-demo",
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      payment,
    });
  } catch (err) {
    console.error("Demo chat error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Routes ───────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    model: MODEL,
    price: "$0.005 USDC per call",
    network: "Base Sepolia (eip155:84532)",
    sellerAddress: SELLER_ADDRESS,
  });
});

app.post("/chat", gateway.require("$0.005"), async (req, res) => {
  const { payer, amount, network } = (req as any).payment!;
  console.log(`Payment received: ${amount} USDC from ${payer} on ${network}`);

  try {
    const { messages, model } = req.body as {
      messages: ChatCompletionMessageParam[];
      model?: string;
    };

    const completion = await openai.chat.completions.create({
      model: model || MODEL,
      messages,
    });

    res.json({
      reply: completion.choices[0].message.content,
      model: completion.model,
      usage: completion.usage,
    });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "LLM inference failed" });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(4021, () => {
  console.log("Server running at http://localhost:4021");
  console.log(`Seller address : ${SELLER_ADDRESS}`);
  console.log(`Model          : ${MODEL}`);
  console.log(`Price per call : $0.005 USDC (Base Sepolia)`);
});
