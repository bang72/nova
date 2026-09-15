use nova_crypto::verify;
use nova_primitives::{AccountId, AccountState, Action, Height, SignedTransaction};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Clone, Debug, Default)]
pub struct LedgerState {
    accounts: BTreeMap<AccountId, AccountState>,
    pub total_supply: u128,
}

#[derive(Debug, Error)]
pub enum StateError {
    #[error("unknown account")]
    UnknownAccount,
    #[error("wrong chain id")]
    ChainId,
    #[error("transaction expired")]
    Expired,
    #[error("invalid nonce: expected {expected}, received {received}")]
    Nonce { expected: u64, received: u64 },
    #[error("signature verification failed")]
    Signature,
    #[error("insufficient balance")]
    Balance,
    #[error("amount overflow")]
    Overflow,
}

impl LedgerState {
    pub fn insert_genesis_account(&mut self, account: AccountState) {
        self.total_supply += account.balance as u128;
        self.accounts.insert(account.id, account);
    }

    pub fn account(&self, id: &AccountId) -> Option<&AccountState> {
        self.accounts.get(id)
    }

    pub fn accounts(&self) -> impl Iterator<Item = (&AccountId, &AccountState)> {
        self.accounts.iter()
    }

    pub fn apply(
        &mut self,
        signed: &SignedTransaction,
        chain_id: &str,
        height: Height,
    ) -> Result<(), StateError> {
        if signed.tx.chain_id != chain_id {
            return Err(StateError::ChainId);
        }
        if signed.tx.expiry_height < height {
            return Err(StateError::Expired);
        }
        let sender_snapshot = self
            .accounts
            .get(&signed.tx.sender)
            .cloned()
            .ok_or(StateError::UnknownAccount)?;
        if signed.tx.nonce != sender_snapshot.nonce {
            return Err(StateError::Nonce {
                expected: sender_snapshot.nonce,
                received: signed.tx.nonce,
            });
        }
        verify(
            sender_snapshot.auth.suite_id,
            &sender_snapshot.auth.public_key,
            &signed.tx.signing_bytes(),
            &signed.signature,
        )
        .map_err(|_| StateError::Signature)?;

        match signed.tx.action.clone() {
            Action::Transfer { to, amount } => {
                let debit = amount
                    .checked_add(signed.tx.fee)
                    .ok_or(StateError::Overflow)?;
                if sender_snapshot.balance < debit {
                    return Err(StateError::Balance);
                }
                if !self.accounts.contains_key(&to) {
                    return Err(StateError::UnknownAccount);
                }
                {
                    let sender = self.accounts.get_mut(&signed.tx.sender).unwrap();
                    sender.balance -= debit;
                    sender.nonce += 1;
                }
                {
                    let recipient = self.accounts.get_mut(&to).unwrap();
                    recipient.balance = recipient
                        .balance
                        .checked_add(amount)
                        .ok_or(StateError::Overflow)?;
                }
            }
            Action::RotateKey {
                new_suite_id,
                new_public_key,
            } => {
                let sender = self.accounts.get_mut(&signed.tx.sender).unwrap();
                if sender.balance < signed.tx.fee {
                    return Err(StateError::Balance);
                }
                sender.balance -= signed.tx.fee;
                sender.nonce += 1;
                sender.auth.suite_id = new_suite_id;
                sender.auth.public_key = new_public_key;
                sender.auth.version += 1;
            }
        }
        Ok(())
    }

    pub fn root(&self) -> [u8; 32] {
        let mut h = Sha256::new();
        h.update(b"NOVA_STATE_V1");
        h.update(self.total_supply.to_be_bytes());
        for (id, a) in &self.accounts {
            h.update(id.0);
            h.update(a.balance.to_be_bytes());
            h.update(a.nonce.to_be_bytes());
            h.update(a.auth.suite_id.to_be_bytes());
            h.update(a.auth.version.to_be_bytes());
            h.update(a.auth.public_key);
        }
        h.finalize().into()
    }
}
