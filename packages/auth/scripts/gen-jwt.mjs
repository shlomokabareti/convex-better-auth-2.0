import { generateKeyPair, exportJWK } from "jose";

const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const privateJwk = await exportJWK(privateKey);
const publicJwk = await exportJWK(publicKey);
privateJwk.alg = "RS256";
publicJwk.alg = "RS256";
console.log("JWT_PRIVATE_KEY=" + JSON.stringify(privateJwk));
console.log("JWKS=" + JSON.stringify({ keys: [publicJwk] }));
