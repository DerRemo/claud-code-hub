// Cloudflare Access JWT validation mit JWKS-Cache.
//
// Wird vom secureMiddleware in server.js aufgerufen, wenn ein Request
// vom Tunnel kommt (Cf-Ray-Header präsent). Prüft die Signatur des
// Cf-Access-Jwt-Assertion-Headers gegen den JWKS von Cloudflare, verifiziert
// Audience-Tag + Expiry und extrahiert die Email-Claim als User-Identity.
//
// Config via zwei Env-Variablen:
//   CF_ACCESS_TEAM_DOMAIN — z.B. derremo.cloudflareaccess.com
//   CF_ACCESS_AUD         — Application-Audience-Tag aus dem Cloudflare-Dashboard
//
// Beide leer/unset → Modul ist disabled, isEnabled() liefert false, der
// secureMiddleware überspringt die JWT-Validation. Ermöglicht lokale
// Entwicklung und staged Rollout.

import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';

const TEAM_DOMAIN = process.env.CF_ACCESS_TEAM_DOMAIN || '';
const AUDIENCE    = process.env.CF_ACCESS_AUD         || '';

// Klasse für machine-lesbare Error-Codes. Der secureMiddleware mapt
// .code auf das audit-log 'reason'-Feld.
export class InvalidJwtError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// jose's createRemoteJWKSet erledigt JWKS-Fetch + Cache + Refresh
// automatisch. Wir setzen cooldownDuration damit rapid-fire bad-kid-
// Requests keinen DDoS-Angriffsvektor geben.
let jwks = null;
function getJwks() {
  if (!TEAM_DOMAIN) return null;
  if (jwks) return jwks;
  const url = new URL(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`);
  jwks = createRemoteJWKSet(url, {
    cooldownDuration: 30_000,  // min 30s zwischen Refreshes bei bad-kid
    cacheMaxAge: 60 * 60_000,  // JWKS 1h cachen, danach Refresh beim nächsten Use
  });
  return jwks;
}

export function isEnabled() {
  return !!(TEAM_DOMAIN && AUDIENCE);
}

// Prüft den Cf-Access-Jwt-Assertion-Header des Requests gegen die
// JWKS. Wirft InvalidJwtError mit .code ∈ {no-jwt, bad-sig, expired,
// bad-aud, bad-iss, no-email, unknown}.
//
// jwtVerify prüft automatisch Signatur, exp, nbf (falls vorhanden), und
// audience. Issuer wird zusätzlich gegen die Team-URL geprüft — das ist
// zwar redundant zur JWKS-URL-Scope (ein Token von einer fremden Cloudflare-
// Team kann die Signatur-Prüfung schon nicht passieren), aber matcht
// Cloudflare's offiziellen Verifier-Pattern.
export async function verifyJwtFromRequest(req) {
  const raw = req.headers['cf-access-jwt-assertion'];
  if (!raw) throw new InvalidJwtError('no-jwt');
  const keySet = getJwks();
  try {
    const { payload } = await jwtVerify(raw, keySet, {
      audience: AUDIENCE,
      issuer: `https://${TEAM_DOMAIN}`,
    });
    if (!payload.email) throw new InvalidJwtError('no-email');
    return { email: payload.email, sub: payload.sub || null, iat: payload.iat || null };
  } catch (e) {
    if (e instanceof InvalidJwtError) throw e;
    if (e instanceof joseErrors.JWTExpired) throw new InvalidJwtError('expired');
    if (e instanceof joseErrors.JWTClaimValidationFailed) {
      if (e.claim === 'aud') throw new InvalidJwtError('bad-aud');
      if (e.claim === 'iss') throw new InvalidJwtError('bad-iss');
    }
    if (e instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new InvalidJwtError('bad-sig');
    }
    if (e instanceof joseErrors.JWSInvalid || e instanceof joseErrors.JWTInvalid) {
      throw new InvalidJwtError('bad-sig');
    }
    throw new InvalidJwtError('unknown', e.message);
  }
}

// In-memory Tracker für `auth.login`-Event-Detection. Pro Email merken
// wir uns die letzte gesehene `iat`-Claim. Wenn der nächste JWT einen
// strikt höheren iat hat, ist es eine neue Access-Session → wir loggen
// es einmal als auth.login. Map wird beim Server-Restart zurückgesetzt,
// sodass der erste JWT nach Restart immer als Login zählt. Akzeptabel.
//
// Kein Mutex: zwei parallele JWT-Verifies mit demselben iat-Wert können
// beide als „neu" durchlaufen und ein duplicate auth.login feuern. Das
// ist in der Praxis minimales Noise (max 1 extra Event pro Session),
// kein Security-Issue, kein Fix nötig.
const lastSeenIat = new Map();
export function isNewLoginIat(email, iat) {
  if (!email || !iat) return false;
  const prev = lastSeenIat.get(email);
  if (prev && prev >= iat) return false;
  lastSeenIat.set(email, iat);
  return true;
}
