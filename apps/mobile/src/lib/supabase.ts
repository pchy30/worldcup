import "react-native-url-polyfill/auto";
import { createClient, Session, User } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// SecureStore has a 2048-byte value limit. For large JWT tokens we chunk the
// value across multiple keys and reassemble on read.
const CHUNK_SIZE = 1800;

class LargeSecureStore {
  private async _getChunks(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (countStr === null) {
      // Try as a plain non-chunked value first (backwards compat)
      return SecureStore.getItemAsync(key);
    }
    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join("");
  }

  private async _setChunks(key: string, value: string): Promise<void> {
    const chunks: string[] = [];
    let offset = 0;
    while (offset < value.length) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
      offset += CHUNK_SIZE;
    }
    await SecureStore.setItemAsync(`${key}_count`, String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }
  }

  private async _deleteChunks(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (countStr !== null) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}_count`);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }

  async getItem(key: string): Promise<string | null> {
    return this._getChunks(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await this._setChunks(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this._deleteChunks(key);
  }
}

const secureStore = new LargeSecureStore();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key) => secureStore.getItem(key),
      setItem: (key, value) => secureStore.setItem(key, value),
      removeItem: (key) => secureStore.removeItem(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── useSession hook ─────────────────────────────────────────────────────────

export interface SessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
  };
}
