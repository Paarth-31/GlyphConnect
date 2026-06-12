import { pool, queryAsUser, queryService } from './client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'superadmin';
  is_verified: boolean;
  is_active: boolean;
  two_fa_enabled: boolean;
  created_at: Date;
  locked_until?: Date | string | null;
}

export async function createUser(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const hash = await bcrypt.hash(password, 12);
  const rows = await queryService<User>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, avatar_url, role,
               is_verified, is_active, two_fa_enabled, created_at`,
    [email, hash, displayName]
  );
  return rows[0];
}

export async function verifyPassword(
  email: string,
  password: string
): Promise<User | null> {
  const rows = await queryService<User & { password_hash: string }>(
    `SELECT id, email, password_hash, display_name, avatar_url, role,
            is_verified, is_active, two_fa_enabled, locked_until, created_at
     FROM users
     WHERE email = $1 AND is_active = TRUE`,
    [email]
  );
  if (!rows[0]) return null;

  const user = rows[0];

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new Error('Account temporarily locked due to failed login attempts');
  }

  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    await queryService(
      `UPDATE users
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE
             WHEN failed_login_count + 1 >= 5
             THEN NOW() + INTERVAL '15 minutes'
             ELSE NULL
           END
       WHERE id = $1`,
      [user.id]
    );
    return null;
  }

  await queryService(
    `UPDATE users
     SET failed_login_count = 0,
         locked_until       = NULL,
         last_login_at      = NOW()
     WHERE id = $1`,
    [user.id]
  );

  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await queryService<User>(
    `SELECT id, email, display_name, avatar_url, role,
            is_verified, is_active, two_fa_enabled, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createRefreshToken(
  userId: string,
  deviceInfo: object,
  ipAddress: string
): Promise<string> {
  const token = uuidv4() + uuidv4();
  const hash = await bcrypt.hash(token, 8);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await queryService(
    `INSERT INTO user_sessions_auth
       (user_id, refresh_token, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hash, JSON.stringify(deviceInfo), ipAddress, expiresAt]
  );
  return token;
}

export async function getUserProfile(userId: string) {
  const rows = await queryService(
    `SELECT u.id, u.email, u.display_name, u.avatar_url, u.role,
            p.full_name, p.bio, p.timezone, p.locale, p.preferred_lang,
            p.phone, p.country_code
     FROM users u
     JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<{
    display_name: string;
    full_name: string;
    bio: string;
    timezone: string;
    locale: string;
    preferred_lang: string;
    phone: string;
    country_code: string;
  }>
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (updates.display_name) {
      await client.query(
        'UPDATE users SET display_name = $1 WHERE id = $2',
        [updates.display_name, userId]
      );
    }

    const profileFields = ['full_name','bio','timezone','locale','preferred_lang','phone','country_code'];
    const profileUpdates = profileFields.filter((f) => updates[f as keyof typeof updates] !== undefined);

    if (profileUpdates.length > 0) {
      const setClauses = profileUpdates.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = profileUpdates.map((f) => updates[f as keyof typeof updates]);
      await client.query(
        `UPDATE user_profiles SET ${setClauses}, updated_at = NOW() WHERE user_id = $1`,
        [userId, ...values]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}