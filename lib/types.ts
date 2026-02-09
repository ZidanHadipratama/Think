export interface Chat {
  id: string;
  title: string;
  updated_at?: number;
  summary?: string;
}

export interface Message {
  id?: number;
  chat_id: string;
  role: string;
  content: string;
  created_at?: number;
  type?: string;
  tool_call_id?: string | null;
  tool_name?: string | null;
  tool_args?: string | null; // Stored as JSON string
  parent_id?: number | null;
}
