#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createGenesis } from "../src/core.mjs";
import { generateIdentity } from "../src/crypto.mjs";

const args=process.argv.slice(2),flag=(name,fallback)=>{const index=args.indexOf(`--${name}`);return index>=0?args[index+1]:fallback};
const outputDir=resolve(flag("out",".nova-network")),validatorCount=Number(flag("validators","4")),basePort=Number(flag("base-port","4181"));
if(!Number.isInteger(validatorCount)||validatorCount<4||validatorCount>32)throw new Error("--validators must be between 4 and 32");
if(existsSync(outputDir))throw new Error(`network directory already exists: ${outputDir}`);
const bucketKeys=["ecosystem","validator","foundation","users","liquidity","audits"].map(generateIdentity);
const firstValidator=bucketKeys.find(key=>key.label==="validator"),validatorKeys=[firstValidator,...Array.from({length:validatorCount-1},(_,index)=>generateIdentity(`validator-${index+2}`))],identities=[...bucketKeys,...validatorKeys.slice(1)];
const chainId=flag("chain-id",`nova-candidate-${new Date().toISOString().slice(0,10).replaceAll("-","")}`),genesisTime=Math.floor(Date.now()/1000),urls=validatorKeys.map((_,index)=>`http://127.0.0.1:${basePort+index}`);
mkdirSync(join(outputDir,"client-keys"),{recursive:true});
for(const key of bucketKeys.filter(item=>item.label!=="validator")){const path=join(outputDir,"client-keys",`${key.label}.json`);writeFileSync(path,JSON.stringify(key,null,2));chmodSync(path,0o600)}
validatorKeys.forEach((key,index)=>{const nodeDir=join(outputDir,`node-${index+1}`);createGenesis(nodeDir,identities,{chainId,genesisTime,epochSeconds:Number(flag("epoch-seconds","4")),validatorIdentities:validatorKeys});mkdirSync(join(nodeDir,"keys"),{recursive:true});const keyPath=join(nodeDir,"keys","validator.json");writeFileSync(keyPath,JSON.stringify(key,null,2));chmodSync(keyPath,0o600);writeFileSync(join(nodeDir,"network.json"),JSON.stringify({host:"127.0.0.1",port:basePort+index,publicUrl:urls[index],peers:urls.filter((_,peerIndex)=>peerIndex!==index),validatorId:key.accountId},null,2))});
writeFileSync(join(outputDir,"network.json"),JSON.stringify({chainId,genesisTime,validators:validatorKeys.map((key,index)=>({validatorId:key.accountId,url:urls[index],nodeDir:`node-${index+1}`})),clientKeys:"client-keys"},null,2));
console.log(JSON.stringify({created:true,outputDir,chainId,validators:validatorCount,urls},null,2));
