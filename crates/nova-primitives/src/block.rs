use crate::{Height, SignedTransaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BlockHeader {
    pub chain_id: String,
    pub height: Height,
    pub parent_hash: [u8; 32],
    pub state_root: [u8; 32],
    pub tx_root: [u8; 32],
    pub timestamp_ms: u64,
    pub protocol_version: u32,
}

impl BlockHeader {
    pub fn hash(&self) -> [u8; 32] {
        let mut h = Sha256::new();
        h.update(b"NOVA_BLOCK_V1");
        h.update(self.chain_id.as_bytes());
        h.update(self.height.to_be_bytes());
        h.update(self.parent_hash);
        h.update(self.state_root);
        h.update(self.tx_root);
        h.update(self.timestamp_ms.to_be_bytes());
        h.update(self.protocol_version.to_be_bytes());
        h.finalize().into()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    pub header: BlockHeader,
    pub transactions: Vec<SignedTransaction>,
}
