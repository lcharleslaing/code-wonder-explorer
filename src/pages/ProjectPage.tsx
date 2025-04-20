
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Item, Project } from "@/types/project";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import ItemList from "@/components/ItemList";

export default function ProjectPage() {
  const { id: projectId } = useParams();
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch project info
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!projectId && !!user,
  });

  // Fetch project items
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("project_id", projectId)
        .order("position");
      if (error) throw error;
      return data as Item[];
    },
    enabled: !!projectId && !!user,
  });

  // Add root note/checklist
  const addRootItem = async (params: {
    content: string;
    is_checklist: boolean;
  }) => {
    if (!projectId || !user) return;
    const { error } = await supabase.from("items").insert([
      {
        content: params.content,
        project_id: projectId,
        is_checklist: params.is_checklist,
        position: (items?.length ?? 0) + 1,
      },
    ]);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Added!", description: "Item added." });
      queryClient.invalidateQueries({ queryKey: ["items", projectId] });
    }
  };

  if (projectLoading || itemsLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading project...</div>;
  }
  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>
          <p className="mb-4">Project not found.</p>
          <Button onClick={() => navigate("/")}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/")}>← Back</Button>
        <h1 className="text-3xl font-bold mt-2">{project.title}</h1>
        {project.description && (
          <p className="text-muted-foreground mt-1">{project.description}</p>
        )}
      </div>
      <div className="mb-8">
        <h2 className="font-semibold text-xl mb-2">Add Note or Checklist</h2>
        <div className="flex gap-2 flex-col sm:flex-row">
          <AddItemForm onAdd={addRootItem} />
        </div>
      </div>
      <div>
        <h2 className="font-semibold text-xl mb-4">Notes & Checklists</h2>
        <ItemList items={items || []} projectId={projectId as string} parentId={null} />
      </div>
    </div>
  );
}

function AddItemForm({ onAdd }: { onAdd: (params: { content: string; is_checklist: boolean }) => void }) {
  const [content, setContent] = React.useState("");
  const [isChecklist, setIsChecklist] = React.useState(false);
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (!content.trim()) return;
        onAdd({ content, is_checklist: isChecklist });
        setContent("");
        setIsChecklist(false);
      }}
      className="flex gap-2 items-center"
    >
      <Input
        className="w-[220px]"
        placeholder="New note or checklist..."
        value={content}
        onChange={e => setContent(e.target.value)}
        required
      />
      <label className="inline-flex items-center text-sm gap-1 cursor-pointer">
        <input
          type="checkbox"
          checked={isChecklist}
          onChange={e => setIsChecklist(e.target.checked)}
          className="accent-primary h-4 w-4 mr-1"
        />
        Checklist
      </label>
      <Button type="submit">Add</Button>
    </form>
  );
}
