export interface Project {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Define the new ItemAttachment interface
export interface ItemAttachment {
  id: string;
  item_id: string;
  attachment_type: 'image' | 'url'; // Use a literal type for clarity
  url: string;
  label?: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  project_id: string;
  parent_id: string | null;
  content: string;
  is_checklist: boolean;
  is_completed: boolean | null;
  position: number;
  created_at: string;
  updated_at: string;
  // linked_url?: string | null; // Remove - moved to attachments
  // image_url?: string | null; // Remove - moved to attachments
  // Add attachments array - Supabase select("*, item_attachments(*)") will populate this
  item_attachments?: ItemAttachment[] | null;
}
