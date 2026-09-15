use nova_crypto::{suite_supported, verify};
use nova_primitives::{
    AccountId, AccountState, Action, Height, SignedTransaction, MAX_SUPPLY_BASE,
};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Clone, Debug, Default)]
pub struct LedgerState {
    accounts: BTreeMap<AccountId, AccountState>,
    pub total_supply: u128,
    pub fee_pool: u128,
}

#[derive(Debug, Error)]
pub enum StateError {
    #[error("unknown account")]
    UnknownAccount,
    #[error("duplicate genesis account")]
    DuplicateGenesisAccount,
    #[error("genesis supply exceeds hard cap")]
    SupplyCap,
    #[error("wrong chain id")]
    ChainId,
    #[error("transaction expired")]
    Expired,
    #[error("authorization policy version mismatch: expected {expected}, received {received}")]
    AuthVersion { expected: u32, received: u32 },
    #[error("invalid nonce: expected {expected}, received {received}")]
    Nonce { expected: u64, received: u64 },
    #[error("signature verification failed")]
    Signature,
    #[error("unsupported cryptographic suite")]
    UnsupportedSuite,
    #[error("insufficient balance")]
    Balance,
    #[error("zero-value transfer is not valid")]
    ZeroAmount,
    #[error("amount overflow")]
    Overflow,
    #[error("supply conservation invariant failed")]
    SupplyInvariant,
}

impl LedgerState {
    pub fn insert_genesis_account(&mut self, account: AccountState) -> Result<(), StateError> {
        if self.accounts.contains_key(&account.id) {
            return Err(StateError::DuplicateGenesisAccount);
        }
        let next_supply = self
            .total_supply
            .checked_add(account.balance as u128)
            .ok_or(StateError::Overflow)?;
        if next_supply > MAX_SUPPLY_BASE {
            return Err(StateError::SupplyCap);
        }
        self.total_supply = next_supply;
        self.accounts.insert(account.id, account);
        self.verify_supply_invariant()
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
        if signed.tx.auth_policy_version != sender_snapshot.auth.version {
            return Err(StateError::AuthVersion {
                expected: sender_snapshot.auth.version,
                received: signed.tx.auth_policy_version,
            });
        }
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
                if amount == 0 {
                    return Err(StateError::ZeroAmount);
                }
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
                self.fee_pool = self
                    .fee_pool
                    .checked_add(signed.tx.fee as u128)
                    .ok_or(StateError::Overflow)?;
            }
            Action::RotateKey {
                new_suite_id,
                new_public_key,
            } => {
                if !suite_supported(new_suite_id) {
                    return Err(StateError::UnsupportedSuite);
                }
                let sender = self.accounts.get_mut(&signed.tx.sender).unwrap();
                if sender.balance < signed.tx.fee {
                    return Err(StateError::Balance);
                }
                sender.balance -= signed.tx.fee;
                sender.nonce += 1;
                sender.auth.suite_id = new_suite_id;
                sender.auth.public_key = new_public_key;
                sender.auth.version += 1;
                self.fee_pool = self
                    .fee_pool
                    .checked_add(signed.tx.fee as u128)
                    .ok_or(StateError::Overflow)?;
            }
        }
        self.verify_supply_invariant()
    }

    pub fn verify_supply_invariant(&self) -> Result<(), StateError> {
        let balances = self.accounts.values().try_fold(0u128, |sum, account| {
            sum.checked_add(account.balance as u128)
                .ok_or(StateError::Overflow)
        })?;
        let conserved = balances
            .checked_add(self.fee_pool)
            .ok_or(StateError::Overflow)?;
        if conserved != self.total_supply {
            return Err(StateError::SupplyInvariant);
        }
        Ok(())
    }

    pub fn root(&self) -> [u8; 32] {
        let mut h = Sha256::new();
        h.update(b"NOVA_STATE_V1");
        h.update(self.total_supply.to_be_bytes());
        h.update(self.fee_pool.to_be_bytes());
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

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use nova_crypto::{public_key, sign, ED25519_SUITE_ID};
    use nova_primitives::{AuthorizationPolicy, UnsignedTransaction};

    fn account(seed: u8, secret: u8, balance: u64) -> (AccountState, SigningKey) {
        let signing = SigningKey::from_bytes(&[secret; 32]);
        let public = public_key(&signing);
        let id = AccountId::from_seed(&[seed; 32]);
        (
            AccountState {
                id,
                balance,
                nonce: 0,
                auth: AuthorizationPolicy {
                    suite_id: ED25519_SUITE_ID,
                    public_key: public,
                    version: 1,
                },
            },
            signing,
        )
    }

    #[test]
    fn transfer_conserves_supply_and_collects_fee() {
        let (alice, alice_key) = account(1, 11, 1_000);
        let (bob, _) = account(2, 22, 0);
        let alice_id = alice.id;
        let bob_id = bob.id;
        let mut state = LedgerState::default();
        state.insert_genesis_account(alice).unwrap();
        state.insert_genesis_account(bob).unwrap();
        let unsigned = UnsignedTransaction {
            chain_id: "nova-test".into(),
            sender: alice_id,
            auth_policy_version: 1,
            nonce: 0,
            fee: 3,
            expiry_height: 10,
            action: Action::Transfer {
                to: bob_id,
                amount: 100,
            },
        };
        let signed = SignedTransaction {
            signature: sign(&alice_key, &unsigned.signing_bytes()),
            tx: unsigned,
        };
        state.apply(&signed, "nova-test", 1).unwrap();
        assert_eq!(state.account(&alice_id).unwrap().balance, 897);
        assert_eq!(state.account(&bob_id).unwrap().balance, 100);
        assert_eq!(state.fee_pool, 3);
        assert_eq!(state.total_supply, 1_000);
        state.verify_supply_invariant().unwrap();
    }
}
