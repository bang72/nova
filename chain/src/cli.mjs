#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";
import { createGenesis } from "./core.mjs";
import { generateIdentity, signPayload } from "./crypto.mjs";
import { formatNova, parseNova } from "./emission.mjs";

const args=process.argv.slice(2),command=args[0],flag=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:fallback},dataDir=resolve(process.env.NOVA_DATA_DIR??".nova"),rpc=process.env.NOVA_RPC_URL??"http://127.0.0.1:4178";
const output=(value)=>console.log(JSON.stringify(value,null,2));
async function request(path,options){const response=await fetch(`${rpc}${path}`,options);const value=await response.json();if(!response.ok)throw new Error(value.error??`RPC ${response.status}`);return value}
const readKey=()=>JSON.parse(readFileSync(resolve(flag("key",join(dataDir,"keys","ecosystem.json"))),"utf8"));
const signedTx=async(key,actions)=>{const account=await request(`/account/${key.accountId}`);const payload={chainDomain:(await request("/status")).chainId,accountId:key.accountId,authPolicyVersion:account.policy.version,nonce:account.nonce+1,actions,feePolicy:{payer:key.accountId,maxFee:"1000"},expiry:Math.floor(Date.now()/1000)+120};return{...payload,authorizationProof:{suiteId:key.suiteId,signature:signPayload(payload,key.privateKey)}}};

try {
  if(command==="init"){
    if(existsSync(join(dataDir,"genesis.json")))throw new Error(`Genesis already exists at ${dataDir}`);
    const labels=["ecosystem","validator","foundation","users","liquidity","audits"],keys=labels.map(generateIdentity);mkdirSync(join(dataDir,"keys"),{recursive:true});
    for(const key of keys){const path=join(dataDir,"keys",`${key.label}.json`);writeFileSync(path,JSON.stringify(key,null,2));chmodSync(path,0o600)}
    const result=createGenesis(dataDir,keys,{chainId:flag("chain-id",undefined),secondsPerYear:Number(flag("seconds-per-year","31557600"))});output({created:true,dataDir,chainId:result.genesis.chainId,stateRoot:result.genesis.stateRoot,genesisAccounts:result.genesis.allocations});
  } else if(command==="status") output(await request("/status"));
  else if(command==="balance"){const account=flag("account");if(!account)throw new Error("--account is required");output(await request(`/account/${account}`))}
  else if(command==="transfer"){const key=readKey(),to=flag("to"),amount=parseNova(flag("amount",""));if(!to)throw new Error("--to is required");const tx=await signedTx(key,[{type:"transfer",to,amount:amount.toString()}]);output(await request("/tx",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(tx)}))}
  else if(command==="account-create"){const sponsor=readKey(),label=flag("label","member"),key=generateIdentity(label),path=resolve(flag("out",join(dataDir,"keys",`${label}.json`)));const tx=await signedTx(sponsor,[{type:"create_account",accountId:key.accountId,suiteId:key.suiteId,publicKey:key.publicKey}]);const receipt=await request("/tx",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(tx)});writeFileSync(path,JSON.stringify(key,null,2));chmodSync(path,0o600);output({accountId:key.accountId,keyPath:path,receipt})}
  else if(command==="key-rotate"){const oldKey=readKey(),next=generateIdentity(oldKey.label),tx=await signedTx(oldKey,[{type:"rotate_key",suiteId:next.suiteId,publicKey:next.publicKey}]);const receipt=await request("/tx",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(tx)});const path=resolve(flag("out",join(dataDir,"keys",`${oldKey.label}-rotated.json`)));writeFileSync(path,JSON.stringify({...next,accountId:oldKey.accountId,policyVersion:oldKey.policyVersion+1},null,2));chmodSync(path,0o600);output({keyPath:path,receipt})}
  else if(command==="format"){console.log(formatNova(BigInt(flag("atoms","0"))))}
  else throw new Error("Commands: init, status, balance, transfer, account-create, key-rotate");
} catch(error){console.error(`NOVA CLI: ${error.message}`);process.exitCode=1}
