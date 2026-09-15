use crate::{AccountId, Height};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    Transfer { to: AccountId, amount: u64 },
    RotateKey { new_suite_id: u16, new_public_key: [u8; 32] },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UnsignedTransaction {
    pub chain_id: String,
    pub sender: AccountId,
    pub nonce: u64,
    pub fee: u64,
    pub expiry_height: Height,
    pub action: Action,
}

impl UnsignedTransaction {
    pub fn signing_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(160);
        out.extend_from_slice(b"NOVA_TX_V1\0");
        put_bytes(&mut out, self.chain_id.as_bytes());
        out.extend_from_slice(&self.sender.0);
        out.extend_from_slice(&self.nonce.to_be_bytes());
        out.extend_from_slice(&self.fee.to_be_bytes());
        out.extend_from_slice(&self.expiry_height.to_be_bytes());
        match &self.action {
            Action::Transfer { to, amount } => {
                out.push(1);
                out.extend_from_slice(&to.0);
                out.extend_from_slice(&amount.to_be_bytes());
            }
            Action::RotateKey { new_suite_id, new_public_key } => {
                out.push(2);
                out.extend_from_slice(&new_suite_id.to_be_bytes());
                out.extend_from_slice(new_public_key);
            }
        }
        out
    }
}

fn put_bytes(out: &mut Vec<u8>, bytes: &[u8]) {
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SignedTransaction {
    pub tx: UnsignedTransaction,
    pub signature: Vec<u8>,
}

impl SignedTransaction {
    pub fn id(&self) -> [u8; 32] {
        let mut h = Sha256::new();
        h.update(self.tx.signing_bytes());
        h.update(&self.signature);
        h.finalize().into()
    }
}
