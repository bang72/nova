use anyhow::Context;
use clap::{Parser, Subcommand};
use ed25519_dalek::SigningKey;
use nova_crypto::{generate_ed25519, public_key};
use nova_primitives::AccountId;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Parser)]
#[command(name = "nova", version, about = "NOVA protocol command line interface")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Keygen {
        #[arg(long, default_value = "nova-account.json")]
        out: String,
    },
    InspectKey {
        path: String,
    },
}

#[derive(Serialize, Deserialize)]
struct KeyFile {
    version: u32,
    account_seed_hex: String,
    signing_private_key_hex: String,
}

fn main() -> anyhow::Result<()> {
    match Cli::parse().command {
        Command::Keygen { out } => {
            let key = generate_ed25519();
            let mut seed = [0u8; 32];
            OsRng.fill_bytes(&mut seed);
            let file = KeyFile {
                version: 1,
                account_seed_hex: hex::encode(seed),
                signing_private_key_hex: hex::encode(key.to_bytes()),
            };
            fs::write(&out, serde_json::to_string_pretty(&file)?)
                .with_context(|| format!("write {out}"))?;
            let pk = public_key(&key);
            println!("account_id={}", AccountId::from_seed(&seed));
            println!("public_key={}", hex::encode(pk));
            println!("key_file={out}");
        }
        Command::InspectKey { path } => {
            let raw = fs::read_to_string(&path)?;
            let file: KeyFile = serde_json::from_str(&raw)?;
            let seed: [u8; 32] = hex::decode(file.account_seed_hex)?
                .try_into()
                .map_err(|_| anyhow::anyhow!("expected 32-byte account seed"))?;
            let secret: [u8; 32] = hex::decode(file.signing_private_key_hex)?
                .try_into()
                .map_err(|_| anyhow::anyhow!("expected 32-byte signing key"))?;
            let key = SigningKey::from_bytes(&secret);
            let pk = public_key(&key);
            println!("account_id={}", AccountId::from_seed(&seed));
            println!("public_key={}", hex::encode(pk));
        }
    }
    Ok(())
}
