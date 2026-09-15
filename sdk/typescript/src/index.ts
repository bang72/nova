export type NovaStatus={chain_id:string;height:number;block_hash:string;state_root:string;protocol_version:number};
export class NovaClient{
  constructor(readonly rpc:string){}
  async status():Promise<NovaStatus>{const r=await fetch(`${this.rpc}/v1/status`);if(!r.ok)throw new Error(`NOVA RPC ${r.status}`);return r.json()}
  async account(id:string){const r=await fetch(`${this.rpc}/v1/account/${encodeURIComponent(id)}`);if(!r.ok)throw new Error(`NOVA RPC ${r.status}`);return r.json()}
  async latestBlock(){const r=await fetch(`${this.rpc}/v1/block/latest`);if(!r.ok)throw new Error(`NOVA RPC ${r.status}`);return r.json()}
  async submitTransaction(tx:unknown){const r=await fetch(`${this.rpc}/v1/tx`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(tx)});if(!r.ok)throw new Error(await r.text());return r.json()}
}
