use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fmt, str::FromStr};
use thiserror::Error;

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct AccountId(pub [u8; 32]);

impl AccountId {
    pub fn from_initial_key(public_key: &[u8; 32]) -> Self {
        let mut h = Sha256::new();
        h.update(b"NOVA_ACCOUNT_ID_V1");
        h.update(public_key);
        Self(h.finalize().into())
    }
}

impl fmt::Debug for AccountId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self)
    }
}

impl fmt::Display for AccountId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "nv1{}", hex::encode(self.0))
    }
}

#[derive(Debug, Error)]
pub enum AccountIdParseError {
    #[error("account id must start with nv1")]
    Prefix,
    #[error("invalid hex")]
    Hex(#[from] hex::FromHexError),
    #[error("account id must contain 32 bytes")]
    Length,
}

impl FromStr for AccountId {
    type Err = AccountIdParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let body = s.strip_prefix("nv1").ok_or(AccountIdParseError::Prefix)?;
        let bytes = hex::decode(body)?;
        let arr: [u8; 32] = bytes.try_into().map_err(|_| AccountIdParseError::Length)?;
        Ok(Self(arr))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthorizationPolicy {
    pub suite_id: u16,
    pub public_key: [u8; 32],
    pub version: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AccountState {
    pub id: AccountId,
    pub balance: u64,
    pub nonce: u64,
    pub auth: AuthorizationPolicy,
}
