use anyhow::Context;
use clap::{Parser, Subcommand};
use ed25519_dalek::SigningKey;
use nova_crypto::{generate_ed25519, public_key};
use nova_primitives::AccountId;
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
        #[arg(long, default_value = "nova.key")]
        out: String,
    },
    InspectKey {
        path: String,
    },
}

fn main() -> anyhow::Result<()> {
    match Cli::parse().command {
        Command::Keygen { out } => {
            let key = generate_ed25519();
            fs::write(&out, hex::encode(key.to_bytes())).with_context(|| format!("write {out}"))?;
            let pk = public_key(&key);
            println!("account_id={}", AccountId::from_initial_key(&pk));
            println!("public_key={}", hex::encode(pk));
            println!("private_key_file={out}");
        }
        Command::InspectKey { path } => {
            let raw = fs::read_to_string(&path)?;
            let bytes: [u8; 32] = hex::decode(raw.trim())?
                .try_into()
                .map_err(|_| anyhow::anyhow!("expected 32-byte key"))?;
            let key = SigningKey::from_bytes(&bytes);
            let pk = public_key(&key);
            println!("account_id={}", AccountId::from_initial_key(&pk));
            println!("public_key={}", hex::encode(pk));
        }
    }
    Ok(())
}
