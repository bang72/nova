use nova_primitives::MAX_SUPPLY_BASE;
use thiserror::Error;

pub const GENESIS_SUPPLY_NOVA: u64 = 10_000_000;
pub const EMISSION_POOL_NOVA: u64 = 240_000_000;
pub const EMISSION_YEARS: u64 = 1_000;

#[derive(Debug, Error)]
pub enum MonetaryError {
    #[error("mint would exceed NOVA hard cap")]
    CapExceeded,
}

pub fn checked_mint(current_supply: u128, amount: u128) -> Result<u128, MonetaryError> {
    let next = current_supply
        .checked_add(amount)
        .ok_or(MonetaryError::CapExceeded)?;
    if next > MAX_SUPPLY_BASE {
        return Err(MonetaryError::CapExceeded);
    }
    Ok(next)
}

/// Devnet-only deterministic emission budget.
/// Mainnet must replace this function with the audited fixed-point MEC vector set.
pub fn devnet_epoch_budget(epoch: u64) -> u64 {
    const FIRST: u64 = 1_000 * 100_000_000;
    FIRST / (1 + epoch / 100_000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cap_is_absolute() {
        assert!(checked_mint(MAX_SUPPLY_BASE - 1, 1).is_ok());
        assert!(checked_mint(MAX_SUPPLY_BASE, 1).is_err());
    }
}
