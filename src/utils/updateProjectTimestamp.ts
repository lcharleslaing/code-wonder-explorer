import { supabase } from "@/integrations/supabase/client";

/**
 * Updates a project's timestamp to the current time 
 * This ensures the project will appear at the top of the dashboard when sorted by updated_at
 */
export const updateProjectTimestamp = async (projectId: string) => {
  try {
    const { error } = await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", projectId);
    
    if (error) {
      console.error("Error updating project timestamp:", error);
    }
  } catch (err) {
    console.error("Error in updateProjectTimestamp:", err);
  }
}; 