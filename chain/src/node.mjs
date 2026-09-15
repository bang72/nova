import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NovaChain } from "./core.mjs";
import { formatNova } from "./emission.mjs";
import { blockDisplayId, transactionDisplayId } from "./continuum-address.mjs";

const dataDir = resolve(process.env.NOVA_DATA_DIR ?? ".nova");
const port = Number(process.env.NOVA_RPC_PORT ?? 4178);
const host = process.env.NOVA_RPC_HOST ?? "127.0.0.1";
const chain = new NovaChain(dataDir).load();
const validatorKey = JSON.parse(readFileSync(join(dataDir, "keys", "validator.json"), "utf8"));
let lastProduced = Date.now();

const reply = (response, status, data) => { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(data, null, 2)); };
const body = (request) => new Promise((resolveBody, reject) => { let raw=""; request.on("data",(chunk)=>{raw+=chunk;if(raw.length>131072)reject(new Error("request body too large"))});request.on("end",()=>{try{resolveBody(JSON.parse(raw||"{}"))}catch{reject(new Error("invalid JSON"))}});request.on("error",reject) });

const server = createServer(async (request,response) => {
  try {
    const url = new URL(request.url ?? "/", "http://nova.local");
    if (request.method === "GET" && url.pathname === "/health") return reply(response,200,{ok:true,chainId:chain.state.chainId,height:chain.state.height});
    if (request.method === "GET" && url.pathname === "/status") return reply(response,200,{chainId:chain.state.chainId,height:chain.state.height,latestBlock:chain.state.lastBlockHash,latestBlockId:chain.state.height?blockDisplayId(chain.state.lastBlockHash):null,genesisTime:chain.state.genesisTime,protocolVersion:chain.genesis.protocolVersion,supply:{...chain.state.supply,totalNova:formatNova(chain.state.supply.total)},validatorCount:Object.keys(chain.state.validators).length,mempool:chain.mempool.length});
    if (request.method === "GET" && url.pathname.startsWith("/account/")) { const id=decodeURIComponent(url.pathname.slice(9)),account=chain.account(id);return account?reply(response,200,{accountId:id,...account,balanceNova:formatNova(account.balance)}):reply(response,404,{error:"account_not_found"}); }
    if (request.method === "GET" && url.pathname.startsWith("/block/")) { const height=Number(url.pathname.slice(7)),block=chain.block(height);return block?reply(response,200,block):reply(response,404,{error:"block_not_found"}); }
    if (request.method === "GET" && url.pathname === "/genesis") return reply(response,200,chain.genesis);
    if (request.method === "POST" && url.pathname === "/tx") { const tx=await body(request),txId=chain.submit(tx),block=chain.produceBlock(validatorKey);const receipt=block.receipts.find(item=>item.txId===txId);return reply(response,receipt?.success?202:400,{txId,transactionId:transactionDisplayId(txId),blockHeight:block.header.height,blockHash:block.hash,blockId:blockDisplayId(block.hash),receipt}); }
    return reply(response,404,{error:"not_found"});
  } catch(error) { return reply(response,400,{error:error instanceof Error?error.message:"request_failed"}); }
});

server.listen(port,host,()=>console.log(`NOVA L1 ${chain.state.chainId} RPC listening on http://${host}:${port} at height ${chain.state.height}`));
const timer=setInterval(()=>{try{const now=Date.now();if(now-lastProduced>=chain.state.epochSeconds*1000){chain.produceBlock(validatorKey);lastProduced=now}}catch(error){console.error("block production failed",error)}},1000);
const shutdown=()=>{clearInterval(timer);server.close(()=>process.exit(0))};process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
