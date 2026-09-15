import { mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { canonical, hashObject, merkleRoot, signPayload, verifyPayload } from "./crypto.mjs";
import { cumulativeEmission, GENESIS_SUPPLY, HARD_CAP } from "./emission.mjs";
import { accountStateKey, decodeContinuumId, isPaymentAddress } from "./continuum-address.mjs";

export const PROTOCOL = Object.freeze({ consensus: "C1", execution: "E1", crypto: "K1", storage: "S1", network: "N1" });
export const BASE_FEE = 1_000n;
const encode = (value) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2);
const clone = (value) => JSON.parse(JSON.stringify(value));

export class NovaChain {
  constructor(dataDir) { this.dataDir = dataDir; this.statePath = join(dataDir, "state.json"); this.blocksPath = join(dataDir, "blocks.jsonl"); this.mempool = []; this.processing = false; }
  load() {
    if (!existsSync(this.statePath)) throw new Error(`No NOVA genesis at ${this.dataDir}; run nova:init first`);
    this.state = JSON.parse(readFileSync(this.statePath, "utf8"));
    this.genesis = JSON.parse(readFileSync(join(this.dataDir, "genesis.json"), "utf8"));
    return this;
  }
  save() { const temp = `${this.statePath}.tmp`; writeFileSync(temp, encode(this.state)); renameSync(temp, this.statePath); }
  account(id) { try{const decoded=decodeContinuumId(id,{type:"account"});if(decoded.network!==this.state.addressNetwork)return null;return this.state.accounts[accountStateKey(id)]??null}catch{return null} }
  validator(id,state=this.state){try{const decoded=decodeContinuumId(id,{type:"account"});if(decoded.network!==state.addressNetwork)return null;return state.validators[accountStateKey(id)]??null}catch{return null}}
  circulating() { return BigInt(this.state.supply.total); }
  validateTransaction(tx, state = this.state, validationTime = Math.floor(Date.now() / 1000)) {
    const { authorizationProof, ...payload } = tx;
    if (tx.chainDomain !== state.chainId) throw new Error("chain_domain mismatch");
    if (decodeContinuumId(tx.accountId,{type:"account"}).network!==state.addressNetwork) throw new Error("sender address network mismatch");
    const account = state.accounts[accountStateKey(tx.accountId)]; if (!account) throw new Error("unknown account");
    if (tx.authPolicyVersion !== account.policy.version) throw new Error("authorization policy version mismatch");
    if (tx.nonce !== account.nonce + 1) throw new Error(`invalid nonce: expected ${account.nonce + 1}`);
    if (!Number.isInteger(tx.expiry) || tx.expiry < validationTime) throw new Error("transaction expired");
    if (!authorizationProof || authorizationProof.suiteId !== account.policy.suiteId) throw new Error("unsupported authorization proof");
    if (!verifyPayload(payload, authorizationProof.signature, account.policy.publicKey)) throw new Error("invalid signature");
    if (!Array.isArray(tx.actions) || tx.actions.length < 1 || tx.actions.length > 8) throw new Error("actions must contain 1-8 entries");
    const fee = BigInt(tx.feePolicy?.maxFee ?? "0"); if (fee < BASE_FEE) throw new Error("max fee below base fee");
    let required = BASE_FEE;
    for (const action of tx.actions) {
      if (action.type === "transfer") { const amount = BigInt(action.amount); if (amount <= 0n) throw new Error("transfer amount must be positive"); if (!isPaymentAddress(action.to)||decodeContinuumId(action.to,{type:"account"}).network!==state.addressNetwork||!state.accounts[accountStateKey(action.to)]) throw new Error("recipient does not exist or belongs to another network"); required += amount; }
      else if (action.type === "rotate_key") { if (!action.publicKey || action.suiteId !== "K-0001") throw new Error("invalid key rotation"); }
      else if (action.type === "create_account") { if (!isPaymentAddress(action.accountId)||decodeContinuumId(action.accountId,{type:"account"}).network!==state.addressNetwork||state.accounts[accountStateKey(action.accountId)]) throw new Error("invalid, cross-network or existing account id"); if (action.suiteId !== "K-0001" || !action.publicKey) throw new Error("invalid account authorization policy"); }
      else throw new Error(`unsupported action: ${action.type}`);
    }
    if (BigInt(account.balance) < required) throw new Error("insufficient balance");
    return { id: hashObject(tx), fee: BASE_FEE };
  }
  submit(tx) { const checked = this.validateTransaction(tx); if (this.mempool.some((item) => item.id === checked.id)) throw new Error("duplicate transaction"); this.mempool.push({ id: checked.id, tx: clone(tx) }); return checked.id; }
  applyTransaction(tx, state, proposerId, validationTime) {
    const checked = this.validateTransaction(tx, state, validationTime), sender = state.accounts[accountStateKey(tx.accountId)], events = [];
    sender.balance = (BigInt(sender.balance) - checked.fee).toString(); const proposer=state.accounts[accountStateKey(proposerId)];proposer.balance = (BigInt(proposer.balance) + checked.fee).toString();
    for (const action of tx.actions) {
      if (action.type === "transfer") { const amount = BigInt(action.amount),recipient=state.accounts[accountStateKey(action.to)]; sender.balance = (BigInt(sender.balance) - amount).toString(); recipient.balance = (BigInt(recipient.balance) + amount).toString(); events.push({ type: "transfer", from: tx.accountId, to: action.to, amount: amount.toString() }); }
      if (action.type === "rotate_key") { sender.policy = { suiteId: action.suiteId, publicKey: action.publicKey, version: sender.policy.version + 1 }; events.push({ type: "key_rotation", accountId: tx.accountId, policyVersion: sender.policy.version }); }
      if (action.type === "create_account") { state.accounts[accountStateKey(action.accountId)] = { accountId:action.accountId,balance: "0", nonce: 0, policy: { suiteId: action.suiteId, publicKey: action.publicKey, version: 1 } }; events.push({ type: "account_created", accountId: action.accountId }); }
    }
    sender.nonce += 1; return { txId: checked.id, success: true, fee: checked.fee.toString(), events };
  }
  applyEmission(state, timestamp, proposerId) {
    const elapsed = BigInt(Math.max(0, timestamp - state.genesisTime)), target = cumulativeEmission(elapsed, BigInt(state.secondsPerYear));
    const already = BigInt(state.supply.emitted), due = target - already; if (due <= 0n) return 0n;
    const destinations = this.genesis.emissionDestinations, shares = [[proposerId,50n],[destinations.contribution,25n],[destinations.archive,10n],[destinations.publicGoods,10n],[destinations.resilience,5n]];
    let distributed = 0n;
    for (let i=0;i<shares.length;i++) { const amount = i === shares.length-1 ? due-distributed : due*shares[i][1]/100n,account=state.accounts[accountStateKey(shares[i][0])];account.balance=(BigInt(account.balance)+amount).toString(); distributed+=amount; }
    state.supply.emitted=(already+due).toString();state.supply.total=(BigInt(state.supply.total)+due).toString();if(BigInt(state.supply.total)>HARD_CAP)throw new Error("HARD_CAP invariant violated");return due;
  }
  assertSupply(state) { let held=0n;for(const account of Object.values(state.accounts))held+=BigInt(account.balance);for(const validator of Object.values(state.validators))held+=BigInt(validator.stake);if(held!==BigInt(state.supply.total))throw new Error(`supply accounting mismatch: held=${held} total=${state.supply.total}`);if(held>HARD_CAP)throw new Error("HARD_CAP invariant violated"); }
  produceBlock(validatorKey, timestamp = Math.floor(Date.now()/1000), votingKeys = [validatorKey]) {
    if (this.processing) throw new Error("block production already running"); this.processing=true;
    const before=clone(this.state);let txEntries=[];
    try {
      if(!this.validator(validatorKey.accountId,before))throw new Error("proposer is not an active validator");if(timestamp < before.lastTimestamp)throw new Error("block timestamp moved backwards");if(timestamp>Math.floor(Date.now()/1000)+30)throw new Error("block timestamp exceeds allowed clock drift");
      const working=clone(this.state),height=working.height+1;txEntries=this.mempool.splice(0,100);const receipts=[];
      for(const entry of txEntries){try{receipts.push(this.applyTransaction(entry.tx,working,validatorKey.accountId,timestamp))}catch(error){receipts.push({txId:entry.id,success:false,error:error.message,events:[]})}}
      const emission=this.applyEmission(working,timestamp,validatorKey.accountId);
      working.height=height;working.lastTimestamp=timestamp;
      const stateRoot=hashObject({accounts:working.accounts,validators:working.validators,supply:working.supply});
      const header={chainId:working.chainId,height,parentCommitment:before.lastBlockHash,proposerId:validatorKey.accountId,epoch:Math.floor((timestamp-working.genesisTime)/working.epochSeconds),timestamp,stateRoot,transactionRoot:merkleRoot(txEntries.map(e=>e.tx)),receiptRoot:merkleRoot(receipts),dataAvailabilityCommitment:hashObject(txEntries.map(e=>canonical(e.tx))),protocolVersion:PROTOCOL,migrationMarker:null};
      const blockHash=hashObject(header),vote={chainId:working.chainId,height,blockHash,stateRoot};
      const signatures=votingKeys.map(key=>({validatorId:key.accountId,suiteId:"K-0001",signature:signPayload(vote,key.privateKey)}));
      const block={header,transactions:txEntries.map(e=>e.tx),receipts,emission:emission.toString(),certificate:{round:0,signatures},hash:blockHash};
      this.verifyBlockCertificate(block,working);this.assertSupply(working);working.lastBlockHash=blockHash;this.state=working;appendFileSync(this.blocksPath,encode(block).replace(/\n/g,"")+"\n");this.save();return block;
    } catch(error){this.state=before;if(txEntries.length)this.mempool.unshift(...txEntries);throw error} finally{this.processing=false}
  }
  verifyBlockCertificate(block,state=this.state){const vote={chainId:block.header.chainId,height:block.header.height,blockHash:block.hash,stateRoot:block.header.stateRoot};let signed=0n,total=0n;const seen=new Set();for(const validator of Object.values(state.validators))total+=BigInt(validator.stake);for(const proof of block.certificate.signatures){let signerKey;try{signerKey=accountStateKey(proof.validatorId)}catch{continue}if(seen.has(signerKey))continue;const validator=this.validator(proof.validatorId,state);if(validator&&verifyPayload(vote,proof.signature,validator.publicKey)){seen.add(signerKey);signed+=BigInt(validator.stake)}}if(signed*3n<total*2n)throw new Error("validator certificate below 2/3 stake threshold");return true}
  buildBlockProposal(validatorKey,timestamp=Math.floor(Date.now()/1000)){
    if(!this.validator(validatorKey.accountId))throw new Error("proposer is not an active validator");
    if(timestamp<this.state.lastTimestamp)throw new Error("block timestamp moved backwards");
    if(timestamp>Math.floor(Date.now()/1000)+30)throw new Error("block timestamp exceeds allowed clock drift");
    const working=clone(this.state),height=working.height+1,txEntries=this.mempool.slice(0,100),receipts=[];
    for(const entry of txEntries){try{receipts.push(this.applyTransaction(entry.tx,working,validatorKey.accountId,timestamp))}catch(error){receipts.push({txId:entry.id,success:false,error:error.message,events:[]})}}
    const emission=this.applyEmission(working,timestamp,validatorKey.accountId);working.height=height;working.lastTimestamp=timestamp;
    const stateRoot=hashObject({accounts:working.accounts,validators:working.validators,supply:working.supply});
    const header={chainId:working.chainId,height,parentCommitment:this.state.lastBlockHash,proposerId:validatorKey.accountId,epoch:Math.floor((timestamp-working.genesisTime)/working.epochSeconds),timestamp,stateRoot,transactionRoot:merkleRoot(txEntries.map(entry=>entry.tx)),receiptRoot:merkleRoot(receipts),dataAvailabilityCommitment:hashObject(txEntries.map(entry=>canonical(entry.tx))),protocolVersion:PROTOCOL,migrationMarker:null};
    return{header,transactions:txEntries.map(entry=>entry.tx),receipts,emission:emission.toString(),certificate:{round:0,signatures:[]},hash:hashObject(header)};
  }
  evaluateBlock(block,requireCertificate=true){
    if(block.header.chainId!==this.state.chainId)throw new Error("block chain_id mismatch");
    if(block.header.height!==this.state.height+1)throw new Error("non-sequential block height");
    if(block.header.parentCommitment!==this.state.lastBlockHash)throw new Error("parent commitment mismatch");
    if(!this.validator(block.header.proposerId))throw new Error("unknown block proposer");
    if(block.header.timestamp<this.state.lastTimestamp)throw new Error("block timestamp moved backwards");
    if(canonical(block.header.protocolVersion)!==canonical(PROTOCOL))throw new Error("unsupported protocol version");
    if(hashObject(block.header)!==block.hash)throw new Error("block hash mismatch");
    if(block.header.transactionRoot!==merkleRoot(block.transactions))throw new Error("transaction root mismatch");
    if(block.header.dataAvailabilityCommitment!==hashObject(block.transactions.map(tx=>canonical(tx))))throw new Error("data availability commitment mismatch");
    if(requireCertificate)this.verifyBlockCertificate(block,this.state);
    const working=clone(this.state),receipts=[];
    for(const tx of block.transactions){const txId=hashObject(tx);try{receipts.push(this.applyTransaction(tx,working,block.header.proposerId,block.header.timestamp))}catch(error){receipts.push({txId,success:false,error:error.message,events:[]})}}
    const emission=this.applyEmission(working,block.header.timestamp,block.header.proposerId);
    working.height=block.header.height;working.lastTimestamp=block.header.timestamp;
    const stateRoot=hashObject({accounts:working.accounts,validators:working.validators,supply:working.supply});
    if(stateRoot!==block.header.stateRoot)throw new Error("state root mismatch");
    if(merkleRoot(receipts)!==block.header.receiptRoot)throw new Error("receipt root mismatch");
    if(emission.toString()!==block.emission)throw new Error("emission mismatch");
    this.assertSupply(working);working.lastBlockHash=block.hash;return working;
  }
  signBlockProposal(block,validatorKey){
    if(!this.validator(validatorKey.accountId))throw new Error("signer is not an active validator");
    this.evaluateBlock(block,false);const vote={chainId:block.header.chainId,height:block.header.height,blockHash:block.hash,stateRoot:block.header.stateRoot};
    return{validatorId:validatorKey.accountId,suiteId:"K-0001",signature:signPayload(vote,validatorKey.privateKey)};
  }
  importBlock(block){
    const working=this.evaluateBlock(block,true),included=new Set(block.transactions.map(hashObject));this.state=working;this.mempool=this.mempool.filter(entry=>!included.has(entry.id));
    appendFileSync(this.blocksPath,encode(block).replace(/\n/g,"")+"\n");this.save();return block;
  }
  block(height){if(!existsSync(this.blocksPath))return null;for(const line of readFileSync(this.blocksPath,"utf8").trim().split("\n")){if(!line)continue;const block=JSON.parse(line);if(block.header.height===height)return block}return null}
}

export function createGenesis(dataDir, identities, options = {}) {
  mkdirSync(dataDir,{recursive:true});const chainId=options.chainId??`nova-devnet-${new Date().toISOString().slice(0,10).replaceAll("-","")}`,genesisTime=options.genesisTime??Math.floor(Date.now()/1000),allocations={ecosystem:4_000_000n,validator:2_000_000n,foundation:1_500_000n,users:1_000_000n,liquidity:1_000_000n,audits:500_000n};
  const accounts={},byLabel=Object.fromEntries(identities.map(item=>[item.label,item]));
  for(const [label,nova] of Object.entries(allocations)){const key=byLabel[label];if(!key)throw new Error(`missing genesis identity: ${label}`);accounts[accountStateKey(key.accountId)]={accountId:key.accountId,balance:(label==="validator"?0n:nova*1_000_000n).toString(),nonce:0,policy:{suiteId:key.suiteId,publicKey:key.publicKey,version:1}}}
  const validator=byLabel.validator,validatorIdentities=options.validatorIdentities??[validator];
  if(!validatorIdentities.length||!validatorIdentities.some(item=>item.accountId===validator.accountId))throw new Error("genesis validator set must include the validator allocation account");
  const validators={},bonded=2_000_000n*1_000_000n,baseStake=bonded/BigInt(validatorIdentities.length);let assigned=0n;
  validatorIdentities.forEach((item,index)=>{const key=accountStateKey(item.accountId);if(!accounts[key])accounts[key]={accountId:item.accountId,balance:"0",nonce:0,policy:{suiteId:item.suiteId,publicKey:item.publicKey,version:1}};const stake=index===validatorIdentities.length-1?bonded-assigned:baseStake;validators[key]={accountId:item.accountId,stake:stake.toString(),publicKey:item.publicKey,status:"active"};assigned+=stake});
  const addressNetworks=new Set(identities.map(item=>decodeContinuumId(item.accountId,{type:"account"}).network));if(addressNetworks.size!==1)throw new Error("genesis identities must use one NOVA address network");
  const state={chainId,addressNetwork:[...addressNetworks][0],genesisTime,secondsPerYear:options.secondsPerYear??31_557_600,epochSeconds:options.epochSeconds??10,height:0,lastTimestamp:genesisTime,lastBlockHash:"0".repeat(64),accounts,validators,supply:{genesis:GENESIS_SUPPLY.toString(),emitted:"0",total:GENESIS_SUPPLY.toString()}};
  const genesis={chainId,genesisTime,protocolVersion:PROTOCOL,hardCap:HARD_CAP.toString(),allocations:Object.fromEntries(Object.entries(allocations).map(([k,v])=>[k,{accountId:byLabel[k].accountId,amount:(v*1_000_000n).toString()}])),emissionDestinations:{contribution:byLabel.users.accountId,archive:byLabel.audits.accountId,publicGoods:byLabel.ecosystem.accountId,resilience:byLabel.foundation.accountId},stateRoot:hashObject({accounts:state.accounts,validators:state.validators,supply:state.supply})};
  writeFileSync(join(dataDir,"genesis.json"),encode(genesis));writeFileSync(join(dataDir,"state.json"),encode(state));writeFileSync(join(dataDir,"blocks.jsonl"),"");return{genesis,state};
}
