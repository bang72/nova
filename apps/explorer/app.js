const RPC = localStorage.getItem('nova_rpc') || 'http://127.0.0.1:7711';
async function refresh(){
  try{
    const r=await fetch(`${RPC}/v1/status`); if(!r.ok) throw new Error(r.status);
    const s=await r.json();
    health.textContent='online'; chain.textContent=s.chain_id; height.textContent=s.height; version.textContent=`v${s.protocol_version}`; hash.textContent=s.block_hash; root.textContent=s.state_root;
  }catch(e){health.textContent='offline';}
}
refresh(); setInterval(refresh,5000);
