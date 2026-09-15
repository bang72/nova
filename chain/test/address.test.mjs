import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { blockDisplayId, decodeAccountId, decodeBech32m, encodeAccountId, isAccountId, transactionDisplayId, validatorDisplayId } from "../src/address.mjs";

test("NOVA Account IDs use a versioned 256-bit Bech32m payload",()=>{const identifier=randomBytes(32),address=encodeAccountId(identifier),decoded=decodeAccountId(address);assert.match(address,/^nova1/);assert.equal(decoded.network,"mainnet");assert.equal(decoded.version,1);assert.deepEqual(decoded.identifier,identifier);assert.equal(isAccountId(address),true)});
test("testnet addresses have a distinct prefix",()=>{const address=encodeAccountId(randomBytes(32),{testnet:true});assert.match(address,/^tnova1/);assert.equal(decodeAccountId(address).network,"testnet")});
test("checksum, mixed case and transcription errors are rejected",()=>{const address=encodeAccountId(randomBytes(32)),last=address.at(-1),replacement=last==="q"?"p":"q";assert.equal(isAccountId(`${address.slice(0,-1)}${replacement}`),false);assert.equal(isAccountId(address.toUpperCase()),false);assert.equal(isAccountId(`${address.slice(0,10)}x${address.slice(11)}`),false)});
test("implementation accepts the canonical empty Bech32m vector",()=>{const decoded=decodeBech32m("a1lqfn3a");assert.equal(decoded.hrp,"a");assert.deepEqual(decoded.data,[])});
test("validator, transaction and block identifiers cannot be confused with payment addresses",()=>{const account=encodeAccountId(randomBytes(32)),hash=randomBytes(32).toString("hex");assert.match(validatorDisplayId(account),/^novaval1/);assert.match(transactionDisplayId(hash),/^novatx1/);assert.match(blockDisplayId(hash),/^novablk1/);assert.equal(isAccountId(validatorDisplayId(account)),false);assert.equal(isAccountId(transactionDisplayId(hash)),false)});
