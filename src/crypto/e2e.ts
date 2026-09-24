import "./polyfill";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";

// End-to-end encryption primitives for banters.
//
// - Identity: each user has an X25519 key pair. The private key never leaves
//   the device in the clear; the server keeps only a copy sealed under a key
//   derived (scrypt) from the user's password, so signing in elsewhere works.
// - Banter key: one random 32-byte key per banter, sealed to each participant's
//   public key (ephemeral X25519 + HKDF-SHA256 + XChaCha20-Poly1305).
// - Messages: XChaCha20-Poly1305 under the banter key, with the banter, key id,
//   sender and kind bound in as associated data so ciphertexts can't be
//   replayed into another banter or re-attributed to another sender.

export type Identity = { publicKey: Uint8Array; privateKey: Uint8Array };

export type KeyBackup = {
  v: 1;
  kdf: { name: "scrypt"; N: number; r: number; p: number; salt: string };
  nonce: string;
  ct: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();
const SCRYPT = { N: 1 << 15, r: 8, p: 1 } as const;
const NONCE_LEN = 24;

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Identity ------------------------------------------------------------

export function generateIdentity(): Identity {
  const privateKey = x25519.utils.randomSecretKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

export function identityFromPrivateKey(privateKey: Uint8Array): Identity {
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

async function passwordKey(password: string, salt: Uint8Array, kdf: { N: number; r: number; p: number }) {
  return scryptAsync(enc.encode(password), salt, { ...kdf, dkLen: 32 });
}

/** Seal the private key under the password so it can be restored on another device. */
export async function createKeyBackup(identity: Identity, password: string): Promise<KeyBackup> {
  const salt = randomBytes(16);
  const nonce = randomBytes(NONCE_LEN);
  const key = await passwordKey(password, salt, SCRYPT);
  const ct = xchacha20poly1305(key, nonce, enc.encode("rebanter:backup:v1")).encrypt(identity.privateKey);
  return { v: 1, kdf: { name: "scrypt", ...SCRYPT, salt: toBase64(salt) }, nonce: toBase64(nonce), ct: toBase64(ct) };
}

/** Throws if the password is wrong or the backup was tampered with. */
export async function openKeyBackup(backup: KeyBackup, password: string): Promise<Identity> {
  const key = await passwordKey(password, fromBase64(backup.kdf.salt), backup.kdf);
  const privateKey = xchacha20poly1305(key, fromBase64(backup.nonce), enc.encode("rebanter:backup:v1")).decrypt(fromBase64(backup.ct));
  return identityFromPrivateKey(privateKey);
}

// ---- Banter keys ---------------------------------------------------------

export function generateBanterKey(): { keyId: string; key: Uint8Array } {
  return { keyId: toHex(randomBytes(16)), key: randomBytes(32) };
}

function wrapKeyFor(sharedSecret: Uint8Array, ephemeralPub: Uint8Array, recipientPub: Uint8Array) {
  return hkdf(sha256, sharedSecret, concat(ephemeralPub, recipientPub), enc.encode("rebanter:wrap:v1"), 32);
}

/** Seal a banter key to one recipient: base64(ephemeral pub | nonce | ciphertext). */
export function wrapBanterKey(key: Uint8Array, keyId: string, recipientPublicKey: string): string {
  const recipientPub = fromBase64(recipientPublicKey);
  const ephemeral = generateIdentity();
  const wrapKey = wrapKeyFor(x25519.getSharedSecret(ephemeral.privateKey, recipientPub), ephemeral.publicKey, recipientPub);
  const nonce = randomBytes(NONCE_LEN);
  const ct = xchacha20poly1305(wrapKey, nonce, enc.encode(keyId)).encrypt(key);
  return toBase64(concat(ephemeral.publicKey, nonce, ct));
}

export function unwrapBanterKey(wrapped: string, keyId: string, identity: Identity): Uint8Array {
  const raw = fromBase64(wrapped);
  const ephemeralPub = raw.subarray(0, 32);
  const nonce = raw.subarray(32, 32 + NONCE_LEN);
  const ct = raw.subarray(32 + NONCE_LEN);
  const wrapKey = wrapKeyFor(x25519.getSharedSecret(identity.privateKey, ephemeralPub), ephemeralPub, identity.publicKey);
  return xchacha20poly1305(wrapKey, nonce, enc.encode(keyId)).decrypt(ct);
}

// ---- Messages ------------------------------------------------------------

export type MessageContent = { body: string | null; imageUrl: string | null; dropId?: string | null };
type MessageContext = { banterId: string; keyId: string; senderId: string; kind: string };

function messageAad({ banterId, keyId, senderId, kind }: MessageContext) {
  return enc.encode(`rebanter:msg:v1|${banterId}|${keyId}|${senderId}|${kind}`);
}

export function encryptMessage(key: Uint8Array, ctx: MessageContext, content: MessageContent): string {
  const nonce = randomBytes(NONCE_LEN);
  const ct = xchacha20poly1305(key, nonce, messageAad(ctx)).encrypt(enc.encode(JSON.stringify({ b: content.body, i: content.imageUrl, ...(content.dropId ? { d: content.dropId } : {}) })));
  return toBase64(concat(nonce, ct));
}

/** Throws if the ciphertext doesn't authenticate under this key and context. */
export function decryptMessage(key: Uint8Array, ctx: MessageContext, ciphertext: string): MessageContent {
  const raw = fromBase64(ciphertext);
  const plain = xchacha20poly1305(key, raw.subarray(0, NONCE_LEN), messageAad(ctx)).decrypt(raw.subarray(NONCE_LEN));
  const parsed = JSON.parse(dec.decode(plain)) as { b?: string | null; i?: string | null; d?: string | null };
  return { body: parsed.b ?? null, imageUrl: parsed.i ?? null, dropId: parsed.d ?? null };
}
