// Links a Google-verified identity to a users row.
//
// THREAT (account pre-hijacking): until email verification existed, anyone
// could register with a victim's email and choose a password. If the victim
// later signs in with Google, the account would be "theirs" in name only: the
// attacker still knows the password and can keep logging in. Google proves
// control of the mailbox, so when the matching row has never been verified we
// treat the earlier credentials as untrusted: the password is replaced by a
// fresh random opaque hash, every session is revoked and the login throttle is
// cleared, and only then is the account marked verified.
//
// TRADEOFF: a legitimate but unverified user who later uses Google for the
// first time loses their old password. They keep access through Google or
// through "olvidé mi contraseña" (which also proves mailbox control).
//
// Already verified accounts are only logged in (nothing is wiped). New
// accounts are created verified. All of it runs in ONE transaction with the
// row locked, so a concurrent register/login cannot interleave.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');

const randomOpaqueHash = (rounds) => bcrypt.hash(crypto.randomBytes(32).toString('hex'), rounds);

// db: anything with .connect() (pg Pool). Returns { user, created, wiped }.
async function linkGoogleIdentity(db, { email, nombre }, { bcryptRounds }) {
  // Hash outside the transaction: bcrypt is slow and must not hold row locks.
  const opaqueHash = await randomOpaqueHash(bcryptRounds);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let { rows } = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE', [email]);
    let user = rows[0];
    let created = false;
    let wiped = false;

    if (!user) {
      const inserted = await client.query(
        `INSERT INTO users (nombre, email, password_hash, telefono, genero, email_verified_at)
         VALUES ($1, $2, $3, NULL, '', now())
         ON CONFLICT (email) DO NOTHING
         RETURNING *`,
        [nombre, email, opaqueHash]
      );
      if (inserted.rows[0]) {
        user = inserted.rows[0];
        created = true;
      } else {
        // Lost a race with a concurrent register: re-read and fall through.
        ({ rows } = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE', [email]));
        user = rows[0];
      }
    }

    if (!created && !user.email_verified_at) {
      const updated = await client.query(
        `UPDATE users SET password_hash = $1, email_verified_at = now(),
                actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [opaqueHash, user.id]
      );
      user = updated.rows[0];
      await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
      await client.query('DELETE FROM login_attempts WHERE key = $1', [sha256Hex(email)]);
      wiped = true;
    }

    await client.query('COMMIT');
    return { user, created, wiped };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { linkGoogleIdentity };
