import { createHash, generateKeyPairSync, sign, verify, createPrivateKey, createPublicKey, randomBytes } from "node:crypto";

export const hashHex = (input) => createHash("sha256").update(input).digest("hex");
export const canonical = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(typeof value === "bigint" ? value.toString() : value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
};
export const hashObject = (value) => hashHex(canonical(value));
export function merkleRoot(values) {
  if (!values.length) return hashHex("");
  let layer = values.map((value) => Buffer.from(hashObject(value), "hex"));
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) next.push(createHash("sha256").update(Buffer.concat([layer[i], layer[i + 1] ?? layer[i]])).digest());
    layer = next;
  }
  return layer[0].toString("hex");
}
export function generateIdentity(label = "account") {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    label,
    accountId: `nova1${randomBytes(20).toString("hex")}`,
    suiteId: "K-0001",
    policyVersion: 1,
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  };
}
export function signPayload(payload, privateKeyBase64) {
  const key = createPrivateKey({ key: Buffer.from(privateKeyBase64, "base64"), type: "pkcs8", format: "der" });
  return sign(null, Buffer.from(canonical(payload)), key).toString("base64");
}
export function verifyPayload(payload, signature, publicKeyBase64) {
  const key = createPublicKey({ key: Buffer.from(publicKeyBase64, "base64"), type: "spki", format: "der" });
  return verify(null, Buffer.from(canonical(payload)), key, Buffer.from(signature, "base64"));
}
