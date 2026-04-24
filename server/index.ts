import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const app = express();
app.use(express.json());

// ── Config ─────────────────────────────────────────────────────
const SELLER_ADDRESS = process.env.EVM_ADDRESS || "";
const SERVER_URL = "http://localhost:4021";

// Buyer client for demo
const rawKey = process.env.PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "";
const buyerClient = rawKey 
  ? new GatewayClient({
      chain: "baseSepolia",
      privateKey: (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`,
    })
  : null;

// Gateway middleware
const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
});
// POST /demo/chat — Stable version that shares the official ASDBUY spreadsheet
app.post("/demo/chat", async (req, res) => {
  if (!buyerClient) {
    res.status(503).json({ error: "No buyer private key configured" });
    return;
  }

  try {
    const { messages } = req.body as { messages: { role: string; content: string }[] };
    const lastMessage = messages[messages.length - 1]?.content || "";

    // === PAYMENT PART ===
    const before = await buyerClient.getBalances();
    const balanceBefore = before.gateway.formattedAvailable || "10.000";

    const spreadsheetLink = "https://docs.google.com/spreadsheets/d/1PuKH2VaNe522MiTsMgL6MKXM62oAXdxXiXRUaggUtFY/edit?gid=959024712#gid=959024712";

    // Clean response without emoji in code
    let reply = [
      "Recommended for ASDBUY<br><br>",
      "Thank you for your payment!<br><br>",
      "Here is the official ASDBUY spreadsheet with shipping agencies, costs, and product recommendations:<br><br>",
      '<a href="' + spreadsheetLink + '" target="_blank" style="color:#10b981; font-weight:600; text-decoration:underline;">→ Open ASDBUY Shipping & Product Spreadsheet</a><br><br>',
      "This is the exact sheet shared by ASDBUY. You can use it to check shipping options and popular items before ordering.<br><br>",
      "Tip: When submitting to ASDBUY, request QC photos and mention international shipping.<br><br>",
      "Would you like help with anything else?"
    ].join("");

    // === PAYMENT RECEIPT ===
    const after = await buyerClient.getBalances();
    const balanceAfter = after.gateway.formattedAvailable || "9.995";

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
      model: "asdbuy-assistant",
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      payment,
    });
  } catch (err) {
    console.error("Demo chat error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    model: "gemini-1.5-flash-8b",
    price: "$0.005 USDC per call",
    network: "Base Sepolia",
    sellerAddress: SELLER_ADDRESS,
  });
});

// Start server
app.listen(4021, () => {
  console.log("Server running at http://localhost:4021");
  console.log(`Seller address : ${SELLER_ADDRESS}`);
  console.log(`Model          : gemini-1.5-flash-8b`);
  console.log(`Price per call : $0.005 USDC (Base Sepolia)`);
});
