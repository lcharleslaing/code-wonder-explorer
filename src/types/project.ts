
export interface Project {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
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
}
