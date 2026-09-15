import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createGenesis } from "../src/core.mjs";
import { generateIdentity, signPayload } from "../src/crypto.mjs";
import { parseNova } from "../src/emission.mjs";

test("RPC creates an account and finalizes a signed transfer", async (context) => {
  const dir=mkdtempSync(join(tmpdir(),"nova-rpc-")),keys=["ecosystem","validator","foundation","users","liquidity","audits"].map(generateIdentity);
  createGenesis(dir,keys,{chainId:"nova-rpc-test",genesisTime:Math.floor(Date.now()/1000)});
  const { mkdirSync, writeFileSync } = await import("node:fs");mkdirSync(join(dir,"keys"));writeFileSync(join(dir,"keys","validator.json"),JSON.stringify(keys.find(k=>k.label==="validator")));
  const nodeEntry=fileURLToPath(new URL("../src/node.mjs",import.meta.url));
  const port=43000+(process.pid%1000),base=`http://127.0.0.1:${port}`,child=spawn(process.execPath,[nodeEntry],{env:{...process.env,NOVA_DATA_DIR:dir,NOVA_RPC_PORT:String(port)},stdio:["ignore","pipe","pipe"]});
  context.after(()=>child.kill("SIGTERM"));
  await new Promise((resolveReady,reject)=>{const timeout=setTimeout(()=>reject(new Error("RPC start timeout")),5000);child.stdout.on("data",(chunk)=>{if(String(chunk).includes("RPC listening")){clearTimeout(timeout);resolveReady()}});child.on("exit",(code)=>reject(new Error(`RPC exited ${code}`)))});
  const call=async(path,options)=>{const response=await fetch(`${base}${path}`,options);const value=await response.json();if(!response.ok)throw new Error(value.error);return value};
  const sponsor=keys.find(k=>k.label==="ecosystem"),member=generateIdentity("alice");
  const make=async(actions)=>{const account=await call(`/account/${sponsor.accountId}`),status=await call("/status"),payload={chainDomain:status.chainId,accountId:sponsor.accountId,authPolicyVersion:account.policy.version,nonce:account.nonce+1,actions,feePolicy:{payer:sponsor.accountId,maxFee:"1000"},expiry:Math.floor(Date.now()/1000)+60};return{...payload,authorizationProof:{suiteId:sponsor.suiteId,signature:signPayload(payload,sponsor.privateKey)}}};
  const createTx=await make([{type:"create_account",accountId:member.accountId,suiteId:member.suiteId,publicKey:member.publicKey}]);
  const created=await call("/tx",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(createTx)});assert.equal(created.receipt.success,true);
  const amount=parseNova("12.5"),transferTx=await make([{type:"transfer",to:member.accountId,amount:amount.toString()}]);
  const transferred=await call("/tx",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(transferTx)});assert.equal(transferred.receipt.success,true);
  const account=await call(`/account/${member.accountId}`);assert.equal(BigInt(account.balance),amount);assert.equal((await call("/status")).height,2);
});
