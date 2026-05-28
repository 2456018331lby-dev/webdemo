export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      homes: {
        Row: {
          id: string;
          name: string;
          owner_profile_id: string;
          created_at: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          home_id: string;
          name: string;
          created_at: string;
        };
      };
      devices: {
        Row: {
          id: string;
          home_id: string;
          room_id: string | null;
          name: string;
          device_type: string;
          bridge_id: string | null;
          controller_id: string | null;
          firmware_version: string | null;
          online: boolean;
          created_at: string;
        };
      };
      device_state: {
        Row: {
          device_id: string;
          desired_state: Json;
          reported_state: Json;
          last_reported_at: string | null;
          updated_at: string;
        };
      };
      device_commands: {
        Row: {
          id: string;
          device_id: string;
          correlation_id: string;
          command_type: string;
          status: "queued" | "delivered" | "acknowledged" | "failed" | "timed_out";
          payload: Json;
          requested_by: string | null;
          requested_at: string;
          delivered_at: string | null;
          acknowledged_at: string | null;
          failure_reason: string | null;
          attempt_count: number;
          next_retry_at: string | null;
        };
      };
    };
  };
};
