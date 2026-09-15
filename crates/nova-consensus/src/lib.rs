use nova_primitives::AccountId;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use thiserror::Error;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Validator {
    pub id: AccountId,
    pub voting_power: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ValidatorSet {
    validators: BTreeMap<AccountId, Validator>,
    total_power: u128,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FinalityCertificate {
    pub height: u64,
    pub block_hash: [u8; 32],
    pub signers: Vec<AccountId>,
}

#[derive(Debug, Error)]
pub enum ConsensusError {
    #[error("validator set must not be empty")]
    EmptySet,
    #[error("duplicate validator")]
    Duplicate,
    #[error("voting power must be positive")]
    ZeroPower,
    #[error("unknown signer")]
    UnknownSigner,
    #[error("certificate lacks >2/3 voting power")]
    NoQuorum,
}

impl ValidatorSet {
    pub fn new(validators: Vec<Validator>) -> Result<Self, ConsensusError> {
        if validators.is_empty() {
            return Err(ConsensusError::EmptySet);
        }
        let mut map = BTreeMap::new();
        let mut total = 0u128;
        for v in validators {
            if v.voting_power == 0 {
                return Err(ConsensusError::ZeroPower);
            }
            total += v.voting_power as u128;
            if map.insert(v.id, v).is_some() {
                return Err(ConsensusError::Duplicate);
            }
        }
        Ok(Self {
            validators: map,
            total_power: total,
        })
    }

    pub fn total_power(&self) -> u128 {
        self.total_power
    }

    pub fn verify_quorum(&self, certificate: &FinalityCertificate) -> Result<(), ConsensusError> {
        let mut seen = BTreeSet::new();
        let mut signed = 0u128;
        for signer in &certificate.signers {
            if !seen.insert(*signer) {
                continue;
            }
            let v = self
                .validators
                .get(signer)
                .ok_or(ConsensusError::UnknownSigner)?;
            signed += v.voting_power as u128;
        }
        if signed.saturating_mul(3) <= self.total_power.saturating_mul(2) {
            return Err(ConsensusError::NoQuorum);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(x: u8) -> AccountId {
        AccountId([x; 32])
    }

    #[test]
    fn strict_two_thirds_quorum() {
        let set = ValidatorSet::new(vec![
            Validator {
                id: id(1),
                voting_power: 34,
            },
            Validator {
                id: id(2),
                voting_power: 33,
            },
            Validator {
                id: id(3),
                voting_power: 33,
            },
        ])
        .unwrap();
        let ok = FinalityCertificate {
            height: 1,
            block_hash: [9; 32],
            signers: vec![id(1), id(2)],
        };
        assert!(set.verify_quorum(&ok).is_ok());
        let no = FinalityCertificate {
            height: 1,
            block_hash: [9; 32],
            signers: vec![id(2), id(3)],
        };
        assert!(set.verify_quorum(&no).is_err());
    }
}
