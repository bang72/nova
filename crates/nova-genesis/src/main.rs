use anyhow::{bail, Context};
use clap::{Parser, Subcommand};
use nova_primitives::{AccountId, MAX_SUPPLY_BASE};
use serde::{Deserialize, Serialize};
use std::{fs, str::FromStr};

#[derive(Parser)]
#[command(name="nova-genesis", version, about="Build and verify NOVA genesis manifests")]
struct Cli { #[command(subcommand)] command: Cmd }

#[derive(Subcommand)]
enum Cmd { Verify { file: String } }

#[derive(Debug, Serialize, Deserialize)]
struct Genesis {
    chain_id: String,
    protocol_version: u32,
    accounts: Vec<GenesisAccount>,
    validators: Vec<GenesisValidator>,
}
#[derive(Debug, Serialize, Deserialize)]
struct GenesisAccount { account_id: String, public_key_hex: String, balance: u64 }
#[derive(Debug, Serialize, Deserialize)]
struct GenesisValidator { account_id: String, voting_power: u64 }

fn main() -> anyhow::Result<()> {
    match Cli::parse().command {
        Cmd::Verify { file } => verify(&file),
    }
}

fn verify(path: &str) -> anyhow::Result<()> {
    let raw = fs::read_to_string(path).with_context(|| format!("read {path}"))?;
    let g: Genesis = serde_json::from_str(&raw)?;
    if g.chain_id.trim().is_empty() { bail!("chain_id is empty"); }
    if g.accounts.is_empty() { bail!("genesis has no accounts"); }
    if g.validators.is_empty() { bail!("genesis has no validators"); }
    let mut total = 0u128;
    for a in &g.accounts {
        let id = AccountId::from_str(&a.account_id)?;
        let pk: [u8;32] = hex::decode(&a.public_key_hex)?.try_into().map_err(|_| anyhow::anyhow!("public key must be 32 bytes"))?;
        if id != AccountId::from_initial_key(&pk) { bail!("account {} does not match initial public key", a.account_id); }
        total = total.checked_add(a.balance as u128).context("supply overflow")?;
    }
    if total > MAX_SUPPLY_BASE { bail!("genesis exceeds hard cap"); }
    for v in &g.validators {
        AccountId::from_str(&v.account_id)?;
        if v.voting_power == 0 { bail!("validator power must be positive"); }
    }
    println!("valid chain_id={} protocol_version={} accounts={} validators={} supply_base={}", g.chain_id, g.protocol_version, g.accounts.len(), g.validators.len(), total);
    Ok(())
}
