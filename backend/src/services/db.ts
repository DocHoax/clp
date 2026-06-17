import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

class DBService {
  public supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseAnonKey) {
      try {
        this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: false,
          },
        });
        console.log('Supabase client initialized successfully.');
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
      }
    } else {
      console.warn('Supabase configuration is missing. DB services will be limited.');
    }
  }

  async registerDevice(
    userId: string,
    deviceName: string,
    osType: string,
    pushToken?: string
  ): Promise<any> {
    if (!this.supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await this.supabase
      .from('devices')
      .upsert(
        {
          user_id: userId,
          device_name: deviceName,
          os_type: osType,
          push_token: pushToken || null,
          is_active: true,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_name' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error registering device:', error);
      throw error;
    }
    return data;
  }

  async getDevices(userId: string): Promise<any[]> {
    if (!this.supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await this.supabase
      .from('devices')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching devices:', error);
      throw error;
    }
    return data || [];
  }
}

export const dbService = new DBService();
export default DBService;
