use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use thiserror::Error;

pub const ED25519_SUITE_ID: u16 = 1;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("unsupported crypto suite {0}")]
    UnsupportedSuite(u16),
    #[error("invalid public key")]
    PublicKey,
    #[error("invalid signature")]
    Signature,
}

pub fn suite_supported(suite_id: u16) -> bool {
    suite_id == ED25519_SUITE_ID
}

pub fn generate_ed25519() -> SigningKey {
    SigningKey::generate(&mut OsRng)
}

pub fn public_key(key: &SigningKey) -> [u8; 32] {
    key.verifying_key().to_bytes()
}

pub fn sign(key: &SigningKey, msg: &[u8]) -> Vec<u8> {
    key.sign(msg).to_bytes().to_vec()
}

pub fn verify(
    suite_id: u16,
    public_key: &[u8; 32],
    msg: &[u8],
    sig: &[u8],
) -> Result<(), CryptoError> {
    if !suite_supported(suite_id) {
        return Err(CryptoError::UnsupportedSuite(suite_id));
    }
    let key = VerifyingKey::from_bytes(public_key).map_err(|_| CryptoError::PublicKey)?;
    let sig = Signature::from_slice(sig).map_err(|_| CryptoError::Signature)?;
    key.verify(msg, &sig).map_err(|_| CryptoError::Signature)
}
