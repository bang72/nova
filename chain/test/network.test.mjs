import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createGenesis } from "../src/core.mjs";
import { generateIdentity, signPayload } from "../src/crypto.mjs";
import { parseNova } from "../src/emission.mjs";

const waitFor=async(check,timeout=12000)=>{const started=Date.now();while(Date.now()-started<timeout){try{const value=await check();if(value)return value}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw new Error("network convergence timeout")};

test("four validator processes finalize a broadcast transfer",async context=>{
  const root=mkdtempSync(join(tmpdir(),"nova-process-network-")),bucketKeys=["ecosystem","validator","foundation","users","liquidity","audits"].map(generateIdentity),validatorKeys=[bucketKeys.find(key=>key.label==="validator"),...['validator-2','validator-3','validator-4'].map(generateIdentity)],identities=[...bucketKeys,...validatorKeys.slice(1)],basePort=46000+(process.pid%1000),urls=validatorKeys.map((_,index)=>`http://127.0.0.1:${basePort+index}`),genesisTime=Math.floor(Date.now()/1000)+1,entry=fileURLToPath(new URL("../src/consensus-node.mjs",import.meta.url)),children=[];
  validatorKeys.forEach((key,index)=>{const nodeDir=join(root,`node-${index+1}`);createGenesis(nodeDir,identities,{chainId:"nova-process-test",genesisTime,epochSeconds:1,validatorIdentities:validatorKeys});mkdirSync(join(nodeDir,"keys"),{recursive:true});const keyPath=join(nodeDir,"keys","validator.json");writeFileSync(keyPath,JSON.stringify(key));chmodSync(keyPath,0o600);writeFileSync(join(nodeDir,"network.json"),JSON.stringify({host:"127.0.0.1",port:basePort+index,peers:urls.filter((_,peerIndex)=>peerIndex!==index),validatorId:key.accountId}));const child=spawn(process.execPath,[entry],{env:{...process.env,NOVA_DATA_DIR:nodeDir},stdio:["ignore","ignore","pipe"]});children.push(child)});
  context.after(()=>children.forEach(child=>child.kill("SIGTERM")));
  await waitFor(async()=>{const results=await Promise.all(urls.map(url=>fetch(`${url}/health`).then(response=>response.ok)));return results.every(Boolean)});
  const sender=bucketKeys.find(key=>key.label==="ecosystem"),recipient=bucketKeys.find(key=>key.label==="users"),account=await fetch(`${urls[0]}/account/${sender.accountId}`).then(response=>response.json()),recipientBefore=BigInt((await fetch(`${urls[0]}/account/${recipient.accountId}`).then(response=>response.json())).balance),amount=parseNova("12.5"),payload={chainDomain:"nova-process-test",accountId:sender.accountId,authPolicyVersion:account.policy.version,nonce:account.nonce+1,actions:[{type:"transfer",to:recipient.accountId,amount:amount.toString()}],feePolicy:{payer:sender.accountId,maxFee:"1000"},expiry:Math.floor(Date.now()/1000)+60},tx={...payload,authorizationProof:{suiteId:sender.suiteId,signature:signPayload(payload,sender.privateKey)}};
  const accepted=await fetch(`${urls[0]}/tx`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(tx)});assert.equal(accepted.status,202);
  const converged=await waitFor(async()=>{const statuses=await Promise.all(urls.map(async url=>({status:await fetch(`${url}/status`).then(response=>response.json()),account:await fetch(`${url}/account/${recipient.accountId}`).then(response=>response.json())})));if(!statuses.every(item=>BigInt(item.account.balance)>=recipientBefore+amount))return null;const hashes=new Set(statuses.map(item=>item.status.latestBlock)),heights=new Set(statuses.map(item=>item.status.height));return hashes.size===1&&heights.size===1?statuses:null});
  assert.ok(converged[0].status.height>=1);assert.equal(new Set(converged.map(item=>item.status.latestBlock)).size,1);
});
