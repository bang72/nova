import { mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { canonical, hashObject, merkleRoot, signPayload, verifyPayload } from "./crypto.mjs";
import { cumulativeEmission, GENESIS_SUPPLY, HARD_CAP } from "./emission.mjs";

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
  account(id) { return this.state.accounts[id] ?? null; }
  circulating() { return BigInt(this.state.supply.total); }
  validateTransaction(tx, state = this.state) {
    const { authorizationProof, ...payload } = tx;
    if (tx.chainDomain !== state.chainId) throw new Error("chain_domain mismatch");
    const account = state.accounts[tx.accountId]; if (!account) throw new Error("unknown account");
    if (tx.authPolicyVersion !== account.policy.version) throw new Error("authorization policy version mismatch");
    if (tx.nonce !== account.nonce + 1) throw new Error(`invalid nonce: expected ${account.nonce + 1}`);
    if (!Number.isInteger(tx.expiry) || tx.expiry < Math.floor(Date.now() / 1000)) throw new Error("transaction expired");
    if (!authorizationProof || authorizationProof.suiteId !== account.policy.suiteId) throw new Error("unsupported authorization proof");
    if (!verifyPayload(payload, authorizationProof.signature, account.policy.publicKey)) throw new Error("invalid signature");
    if (!Array.isArray(tx.actions) || tx.actions.length < 1 || tx.actions.length > 8) throw new Error("actions must contain 1-8 entries");
    const fee = BigInt(tx.feePolicy?.maxFee ?? "0"); if (fee < BASE_FEE) throw new Error("max fee below base fee");
    let required = BASE_FEE;
    for (const action of tx.actions) {
      if (action.type === "transfer") { const amount = BigInt(action.amount); if (amount <= 0n) throw new Error("transfer amount must be positive"); if (!state.accounts[action.to]) throw new Error("recipient does not exist"); required += amount; }
      else if (action.type === "rotate_key") { if (!action.publicKey || action.suiteId !== "K-0001") throw new Error("invalid key rotation"); }
      else if (action.type === "create_account") { if (!/^nova1[a-f0-9]{40}$/.test(action.accountId) || state.accounts[action.accountId]) throw new Error("invalid or existing account id"); if (action.suiteId !== "K-0001" || !action.publicKey) throw new Error("invalid account authorization policy"); }
      else throw new Error(`unsupported action: ${action.type}`);
    }
    if (BigInt(account.balance) < required) throw new Error("insufficient balance");
    return { id: hashObject(tx), fee: BASE_FEE };
  }
  submit(tx) { const checked = this.validateTransaction(tx); if (this.mempool.some((item) => item.id === checked.id)) throw new Error("duplicate transaction"); this.mempool.push({ id: checked.id, tx: clone(tx) }); return checked.id; }
  applyTransaction(tx, state, proposerId) {
    const checked = this.validateTransaction(tx, state), sender = state.accounts[tx.accountId], events = [];
    sender.balance = (BigInt(sender.balance) - checked.fee).toString(); state.accounts[proposerId].balance = (BigInt(state.accounts[proposerId].balance) + checked.fee).toString();
    for (const action of tx.actions) {
      if (action.type === "transfer") { const amount = BigInt(action.amount); sender.balance = (BigInt(sender.balance) - amount).toString(); state.accounts[action.to].balance = (BigInt(state.accounts[action.to].balance) + amount).toString(); events.push({ type: "transfer", from: tx.accountId, to: action.to, amount: amount.toString() }); }
      if (action.type === "rotate_key") { sender.policy = { suiteId: action.suiteId, publicKey: action.publicKey, version: sender.policy.version + 1 }; events.push({ type: "key_rotation", accountId: tx.accountId, policyVersion: sender.policy.version }); }
      if (action.type === "create_account") { state.accounts[action.accountId] = { balance: "0", nonce: 0, policy: { suiteId: action.suiteId, publicKey: action.publicKey, version: 1 } }; events.push({ type: "account_created", accountId: action.accountId }); }
    }
    sender.nonce += 1; return { txId: checked.id, success: true, fee: checked.fee.toString(), events };
  }
  applyEmission(state, timestamp, proposerId) {
    const elapsed = BigInt(Math.max(0, timestamp - state.genesisTime)), target = cumulativeEmission(elapsed, BigInt(state.secondsPerYear));
    const already = BigInt(state.supply.emitted), due = target - already; if (due <= 0n) return 0n;
    const destinations = this.genesis.emissionDestinations, shares = [[proposerId,50n],[destinations.contribution,25n],[destinations.archive,10n],[destinations.publicGoods,10n],[destinations.resilience,5n]];
    let distributed = 0n;
    for (let i=0;i<shares.length;i++) { const amount = i === shares.length-1 ? due-distributed : due*shares[i][1]/100n; state.accounts[shares[i][0]].balance=(BigInt(state.accounts[shares[i][0]].balance)+amount).toString(); distributed+=amount; }
    state.supply.emitted=(already+due).toString();state.supply.total=(BigInt(state.supply.total)+due).toString();if(BigInt(state.supply.total)>HARD_CAP)throw new Error("HARD_CAP invariant violated");return due;
  }
  assertSupply(state) { let held=0n;for(const account of Object.values(state.accounts))held+=BigInt(account.balance);for(const validator of Object.values(state.validators))held+=BigInt(validator.stake);if(held!==BigInt(state.supply.total))throw new Error(`supply accounting mismatch: held=${held} total=${state.supply.total}`);if(held>HARD_CAP)throw new Error("HARD_CAP invariant violated"); }
  produceBlock(validatorKey, timestamp = Math.floor(Date.now()/1000)) {
    if (this.processing) throw new Error("block production already running"); this.processing=true;
    const before=clone(this.state);
    try {
      if(timestamp < before.lastTimestamp)throw new Error("block timestamp moved backwards");if(timestamp>Math.floor(Date.now()/1000)+30)throw new Error("block timestamp exceeds allowed clock drift");
      const working=clone(this.state),height=working.height+1,txEntries=this.mempool.splice(0,100),receipts=[];
      for(const entry of txEntries){try{receipts.push(this.applyTransaction(entry.tx,working,validatorKey.accountId))}catch(error){receipts.push({txId:entry.id,success:false,error:error.message,events:[]})}}
      const emission=this.applyEmission(working,timestamp,validatorKey.accountId);
      working.height=height;working.lastTimestamp=timestamp;
      const stateRoot=hashObject({accounts:working.accounts,validators:working.validators,supply:working.supply});
      const header={chainId:working.chainId,height,parentCommitment:before.lastBlockHash,epoch:Math.floor((timestamp-working.genesisTime)/working.epochSeconds),timestamp,stateRoot,transactionRoot:merkleRoot(txEntries.map(e=>e.tx)),receiptRoot:merkleRoot(receipts),dataAvailabilityCommitment:hashObject(txEntries.map(e=>canonical(e.tx))),protocolVersion:PROTOCOL,migrationMarker:null};
      const blockHash=hashObject(header),vote={chainId:working.chainId,height,blockHash,stateRoot},signature=signPayload(vote,validatorKey.privateKey);
      const block={header,transactions:txEntries.map(e=>e.tx),receipts,emission:emission.toString(),certificate:{round:0,signatures:[{validatorId:validatorKey.accountId,suiteId:"K-0001",signature}]},hash:blockHash};
      this.verifyBlockCertificate(block,working);this.assertSupply(working);working.lastBlockHash=blockHash;this.state=working;appendFileSync(this.blocksPath,encode(block).replace(/\n/g,"")+"\n");this.save();return block;
    } catch(error){this.state=before;throw error} finally{this.processing=false}
  }
  verifyBlockCertificate(block,state=this.state){const vote={chainId:block.header.chainId,height:block.header.height,blockHash:block.hash,stateRoot:block.header.stateRoot};let signed=0n,total=0n;for(const validator of Object.values(state.validators))total+=BigInt(validator.stake);for(const proof of block.certificate.signatures){const validator=state.validators[proof.validatorId];if(validator&&verifyPayload(vote,proof.signature,validator.publicKey))signed+=BigInt(validator.stake)}if(signed*3n<total*2n)throw new Error("validator certificate below 2/3 stake threshold");return true}
  block(height){if(!existsSync(this.blocksPath))return null;for(const line of readFileSync(this.blocksPath,"utf8").trim().split("\n")){if(!line)continue;const block=JSON.parse(line);if(block.header.height===height)return block}return null}
}

export function createGenesis(dataDir, identities, options = {}) {
  mkdirSync(dataDir,{recursive:true});const chainId=options.chainId??`nova-devnet-${new Date().toISOString().slice(0,10).replaceAll("-","")}`,genesisTime=options.genesisTime??Math.floor(Date.now()/1000),allocations={ecosystem:4_000_000n,validator:2_000_000n,foundation:1_500_000n,users:1_000_000n,liquidity:1_000_000n,audits:500_000n};
  const accounts={},byLabel=Object.fromEntries(identities.map(item=>[item.label,item]));
  for(const [label,nova] of Object.entries(allocations)){const key=byLabel[label];if(!key)throw new Error(`missing genesis identity: ${label}`);accounts[key.accountId]={balance:(label==="validator"?0n:nova*1_000_000n).toString(),nonce:0,policy:{suiteId:key.suiteId,publicKey:key.publicKey,version:1}}}
  const validator=byLabel.validator;const state={chainId,genesisTime,secondsPerYear:options.secondsPerYear??31_557_600,epochSeconds:options.epochSeconds??10,height:0,lastTimestamp:genesisTime,lastBlockHash:"0".repeat(64),accounts,validators:{[validator.accountId]:{stake:(2_000_000n*1_000_000n).toString(),publicKey:validator.publicKey,status:"active"}},supply:{genesis:GENESIS_SUPPLY.toString(),emitted:"0",total:GENESIS_SUPPLY.toString()}};
  const genesis={chainId,genesisTime,protocolVersion:PROTOCOL,hardCap:HARD_CAP.toString(),allocations:Object.fromEntries(Object.entries(allocations).map(([k,v])=>[k,{accountId:byLabel[k].accountId,amount:(v*1_000_000n).toString()}])),emissionDestinations:{contribution:byLabel.users.accountId,archive:byLabel.audits.accountId,publicGoods:byLabel.ecosystem.accountId,resilience:byLabel.foundation.accountId},stateRoot:hashObject({accounts:state.accounts,validators:state.validators,supply:state.supply})};
  writeFileSync(join(dataDir,"genesis.json"),encode(genesis));writeFileSync(join(dataDir,"state.json"),encode(state));writeFileSync(join(dataDir,"blocks.jsonl"),"");return{genesis,state};
}
