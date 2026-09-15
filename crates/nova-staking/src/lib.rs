use nova_primitives::AccountId;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct StakingParams {
    pub min_validator_bond: u64,
    pub unbonding_epochs: u64,
    pub downtime_slash_bps: u16,
    pub equivocation_slash_bps: u16,
    pub max_commission_bps: u16,
}

impl Default for StakingParams {
    fn default() -> Self {
        Self {
            min_validator_bond: 25_000 * 100_000_000,
            unbonding_epochs: 21,
            downtime_slash_bps: 50,
            equivocation_slash_bps: 5_000,
            max_commission_bps: 2_000,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ValidatorStake {
    pub operator: AccountId,
    pub bonded: u64,
    pub delegated: u64,
    pub commission_bps: u16,
    pub jailed_until_epoch: Option<u64>,
}

#[derive(Clone, Copy, Debug)]
pub enum SlashClass { Downtime, Equivocation }

#[derive(Debug, Error)]
pub enum StakingError {
    #[error("validator bond below minimum")]
    BondTooLow,
    #[error("commission exceeds protocol limit")]
    CommissionTooHigh,
}

pub fn validate_validator(v: &ValidatorStake, p: StakingParams) -> Result<(), StakingError> {
    if v.bonded < p.min_validator_bond { return Err(StakingError::BondTooLow); }
    if v.commission_bps > p.max_commission_bps { return Err(StakingError::CommissionTooHigh); }
    Ok(())
}

pub fn slash_amount(stake: u64, class: SlashClass, p: StakingParams) -> u64 {
    let bps = match class { SlashClass::Downtime => p.downtime_slash_bps, SlashClass::Equivocation => p.equivocation_slash_bps };
    ((stake as u128 * bps as u128) / 10_000u128) as u64
}
