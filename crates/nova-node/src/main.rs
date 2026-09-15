use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use nova_crypto::ED25519_SUITE_ID;
use nova_primitives::{
    AccountId, AccountState, AuthorizationPolicy, Block, BlockHeader, SignedTransaction,
};
use nova_state::LedgerState;
use serde::Serialize;
use std::{
    str::FromStr,
    sync::{Arc, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

const CHAIN_ID: &str = "nova-devnet-1";

#[derive(Clone)]
struct App {
    ledger: Arc<RwLock<LedgerState>>,
    latest: Arc<RwLock<Block>>,
}

#[derive(Serialize)]
struct Status {
    chain_id: &'static str,
    height: u64,
    block_hash: String,
    state_root: String,
    protocol_version: u32,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let mut ledger = LedgerState::default();
    let pk = [1u8; 32];
    let id = AccountId::from_initial_key(&pk);
    ledger.insert_genesis_account(AccountState {
        id,
        balance: 0,
        nonce: 0,
        auth: AuthorizationPolicy {
            suite_id: ED25519_SUITE_ID,
            public_key: pk,
            version: 1,
        },
    });
    let root = ledger.root();
    let genesis = Block {
        header: BlockHeader {
            chain_id: CHAIN_ID.into(),
            height: 0,
            parent_hash: [0; 32],
            state_root: root,
            tx_root: [0; 32],
            timestamp_ms: now_ms(),
            protocol_version: 1,
        },
        transactions: vec![],
    };
    let app = App {
        ledger: Arc::new(RwLock::new(ledger)),
        latest: Arc::new(RwLock::new(genesis)),
    };

    let router = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/v1/status", get(status))
        .route("/v1/account/{id}", get(account))
        .route("/v1/tx", post(submit_tx))
        .route("/v1/block/latest", get(latest_block))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(app);

    let addr = "127.0.0.1:7711";
    tracing::info!(%addr, "NOVA node RPC online");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown())
        .await?;
    Ok(())
}

async fn status(State(app): State<App>) -> Json<Status> {
    let b = app.latest.read().unwrap();
    Json(Status {
        chain_id: CHAIN_ID,
        height: b.header.height,
        block_hash: hex::encode(b.header.hash()),
        state_root: hex::encode(b.header.state_root),
        protocol_version: b.header.protocol_version,
    })
}

async fn account(
    State(app): State<App>,
    Path(id): Path<String>,
) -> Result<Json<AccountState>, (StatusCode, String)> {
    let id = AccountId::from_str(&id).map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    app.ledger
        .read()
        .unwrap()
        .account(&id)
        .cloned()
        .map(Json)
        .ok_or((StatusCode::NOT_FOUND, "account not found".into()))
}

async fn latest_block(State(app): State<App>) -> Json<Block> {
    Json(app.latest.read().unwrap().clone())
}

async fn submit_tx(
    State(app): State<App>,
    Json(tx): Json<SignedTransaction>,
) -> Result<Json<Block>, (StatusCode, String)> {
    let mut ledger = app.ledger.write().unwrap();
    let previous = app.latest.read().unwrap().clone();
    let next_height = previous.header.height + 1;
    ledger
        .apply(&tx, CHAIN_ID, next_height)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let tx_root = tx.id();
    let block = Block {
        header: BlockHeader {
            chain_id: CHAIN_ID.into(),
            height: next_height,
            parent_hash: previous.header.hash(),
            state_root: ledger.root(),
            tx_root,
            timestamp_ms: now_ms(),
            protocol_version: 1,
        },
        transactions: vec![tx],
    };
    *app.latest.write().unwrap() = block.clone();
    Ok(Json(block))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

async fn shutdown() {
    let _ = tokio::signal::ctrl_c().await;
}
