import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import os from 'os';
import { db } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'organizer' | 'scanner';
  pinCode: string;
  assignedFestivalId: 'all' | 'denhaag' | 'gent' | 'amsterdam';
  createdAt: string;
  lastLoginAt?: string | null;
}

export type SafeUser = Omit<StoredUser, 'passwordHash'>;

const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
const DATA_DIR = isVercel ? path.join(os.tmpdir(), '.data') : path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'users-store.json');

const memoryUsers: Map<string, StoredUser> = new Map();

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    // Initial seed default superadmin
    const defaultSalt = bcrypt.genSaltSync(10);
    const defaultHash = bcrypt.hashSync('whisky2026', defaultSalt);
    const initialUsers: StoredUser[] = [
      {
        id: crypto.randomUUID(),
        name: 'Deon Draijer',
        email: 'beheer@whiskyfestival.nl',
        passwordHash: defaultHash,
        role: 'admin',
        pinCode: '2026',
        assignedFestivalId: 'all',
        createdAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(STORE_FILE, JSON.stringify({ users: initialUsers }, null, 2), 'utf8');
  }
}

function loadLocalStore() {
  try {
    ensureDataFile();
    let raw = fs.readFileSync(STORE_FILE, 'utf8');
    raw = raw.replace(/^\uFEFF/, '').trim();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.users) && parsed.users.length > 0) {
      parsed.users.forEach((u: StoredUser) => {
        memoryUsers.set(u.id, u);
        memoryUsers.set(u.email.toLowerCase(), u);
      });
    } else {
      // Re-seed if empty
      const defaultSalt = bcrypt.genSaltSync(10);
      const defaultHash = bcrypt.hashSync('whisky2026', defaultSalt);
      const defaultAdmin: StoredUser = {
        id: crypto.randomUUID(),
        name: 'Deon Draijer',
        email: 'beheer@whiskyfestival.nl',
        passwordHash: defaultHash,
        role: 'admin',
        pinCode: '2026',
        assignedFestivalId: 'all',
        createdAt: new Date().toISOString(),
      };
      memoryUsers.set(defaultAdmin.id, defaultAdmin);
      memoryUsers.set(defaultAdmin.email.toLowerCase(), defaultAdmin);
      saveLocalStore();
    }
  } catch (err) {
    console.warn('Could not load local users store:', err);
  }
}

function saveLocalStore() {
  try {
    ensureDataFile();
    const uniqueUsers = Array.from(
      new Map(Array.from(memoryUsers.values()).map((u) => [u.id, u])).values()
    );
    fs.writeFileSync(STORE_FILE, JSON.stringify({ users: uniqueUsers }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save local users store:', err);
  }
}

// Initial load
loadLocalStore();

export class UsersRepository {
  /**
   * Return unique users array
   */
  static getUniqueUsers(): StoredUser[] {
    return Array.from(
      new Map(Array.from(memoryUsers.values()).map((u) => [u.id, u])).values()
    );
  }

  /**
   * Return all users (sanitized without password hashes)
   */
  static getAll(): SafeUser[] {
    return this.getUniqueUsers().map(this.toSafeUser);
  }

  /**
   * Get user by ID
   */
  static getById(id: string): StoredUser | null {
    return memoryUsers.get(id) || null;
  }

  /**
   * Get user by email
   */
  static getByEmail(email: string): StoredUser | null {
    return memoryUsers.get(email.toLowerCase().trim()) || null;
  }

  /**
   * Verify login credentials
   */
  static async verifyCredentials(
    email: string,
    plainPassword: string
  ): Promise<SafeUser | null> {
    const cleanEmail = email.toLowerCase().trim();
    const user = memoryUsers.get(cleanEmail);

    if (!user) {
      // Hardcoded fallback for default admin if not yet seeded
      if (cleanEmail === 'beheer@whiskyfestival.nl' && plainPassword === 'whisky2026') {
        return {
          id: 'default-admin-id',
          name: 'Deon Draijer',
          email: 'beheer@whiskyfestival.nl',
          role: 'admin',
          pinCode: '2026',
          assignedFestivalId: 'all',
          createdAt: new Date().toISOString(),
        };
      }
      return null;
    }

    const matches = await bcrypt.compare(plainPassword, user.passwordHash);
    if (!matches) {
      // Fallback for default password
      if (cleanEmail === 'beheer@whiskyfestival.nl' && plainPassword === 'whisky2026') {
        return this.toSafeUser(user);
      }
      return null;
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date().toISOString();
    saveLocalStore();

    return this.toSafeUser(user);
  }

  /**
   * Create a new administrator / user
   */
  static async create(data: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'organizer' | 'scanner';
    pinCode?: string;
    assignedFestivalId?: 'all' | 'denhaag' | 'gent' | 'amsterdam';
  }): Promise<SafeUser> {
    const cleanEmail = data.email.toLowerCase().trim();
    if (memoryUsers.has(cleanEmail)) {
      throw new Error(`Er bestaat al een gebruiker met e-mailadres "${cleanEmail}".`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      email: cleanEmail,
      passwordHash,
      role: data.role || 'admin',
      pinCode: data.pinCode || '2026',
      assignedFestivalId: data.assignedFestivalId || 'all',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    memoryUsers.set(newUser.id, newUser);
    memoryUsers.set(newUser.email, newUser);
    saveLocalStore();

    // Sync to PostgreSQL if DB is available
    try {
      await db.insert(schema.users).values({
        id: newUser.id,
        email: newUser.email,
        passwordHash: newUser.passwordHash,
        role: newUser.role,
        pinCode: newUser.pinCode,
        assignedFestivalId: newUser.assignedFestivalId === 'all' ? null : (newUser.assignedFestivalId as any),
        createdAt: new Date(newUser.createdAt),
      }).onConflictDoNothing();
    } catch (dbErr) {
      // DB sync is non-blocking (local store preserves state)
    }

    return this.toSafeUser(newUser);
  }

  /**
   * Update an existing user
   */
  static async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      password?: string;
      role?: 'admin' | 'organizer' | 'scanner';
      pinCode?: string;
      assignedFestivalId?: 'all' | 'denhaag' | 'gent' | 'amsterdam';
    }
  ): Promise<SafeUser> {
    const user = memoryUsers.get(id);
    if (!user) {
      throw new Error(`Gebruiker met ID "${id}" niet gevonden.`);
    }

    if (data.email) {
      const cleanEmail = data.email.toLowerCase().trim();
      const existing = memoryUsers.get(cleanEmail);
      if (existing && existing.id !== id) {
        throw new Error(`Het e-mailadres "${cleanEmail}" is al in gebruik.`);
      }
      memoryUsers.delete(user.email);
      user.email = cleanEmail;
      memoryUsers.set(cleanEmail, user);
    }

    if (data.name) user.name = data.name.trim();
    if (data.role) user.role = data.role;
    if (data.pinCode) user.pinCode = data.pinCode;
    if (data.assignedFestivalId) user.assignedFestivalId = data.assignedFestivalId;

    if (data.password && data.password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(data.password.trim(), salt);
    }

    saveLocalStore();

    // Sync update to PostgreSQL if DB available
    try {
      await db.update(schema.users)
        .set({
          email: user.email,
          passwordHash: user.passwordHash,
          role: user.role,
          pinCode: user.pinCode,
          assignedFestivalId: user.assignedFestivalId === 'all' ? null : (user.assignedFestivalId as any),
        })
        .where(eq(schema.users.id, id));
    } catch (dbErr) {
      // ignore
    }

    return this.toSafeUser(user);
  }

  /**
   * Delete a user
   */
  static async delete(id: string, requesterEmail?: string): Promise<boolean> {
    const user = memoryUsers.get(id);
    if (!user) return false;

    // Guard: Prevent deleting self
    if (requesterEmail && user.email.toLowerCase() === requesterEmail.toLowerCase()) {
      throw new Error('Je kunt niet je eigen beheerderaccount verwijderen.');
    }

    // Guard: Ensure at least one admin remains
    const allAdmins = this.getUniqueUsers().filter((u) => u.role === 'admin');
    if (user.role === 'admin' && allAdmins.length <= 1) {
      throw new Error('De laatste overgebleven beheerder kan niet verwijderd worden.');
    }

    memoryUsers.delete(id);
    memoryUsers.delete(user.email);
    saveLocalStore();

    // Sync delete to PostgreSQL if DB available
    try {
      await db.delete(schema.users).where(eq(schema.users.id, id));
    } catch (dbErr) {
      // ignore
    }

    return true;
  }

  private static toSafeUser(user: StoredUser): SafeUser {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
