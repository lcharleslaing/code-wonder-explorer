import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Item, Project } from "@/types/project";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import ItemList from "@/components/ItemList";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// URL Regex (simple version, corrected)
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

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

  // Fetch project items and their attachments
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*, item_attachments(*)")
        .eq("project_id", projectId)
        .order("position");
      if (error) throw error;
      return data as Item[];
    },
    enabled: !!projectId && !!user,
  });

  // Update Add Root Item logic
  const addRootItem = async (params: { content: string }) => {
    if (!projectId || !user) return;

    const originalContent = params.content.trim(); // Keep original for URL check
    let finalContent = originalContent;
    let isChecklist = true;
    // let linkedUrl: string | null = null; // Remove direct link saving

    // Check for note prefix
    if (finalContent.startsWith('-')) {
      isChecklist = false;
      finalContent = finalContent.substring(1).trimStart();
    }

    // --- Step 1: Insert the main item ---
    const { data: newItemData, error: itemError } = await supabase
      .from("items")
      .insert([
        {
          content: finalContent,
          project_id: projectId,
          is_checklist: isChecklist,
          position: (items?.length ?? 0) + 1,
          // linked_url: linkedUrl, // Remove direct link saving
        },
      ])
      .select() // Select the newly created item to get its ID
      .single(); // Expecting only one item back

    if (itemError || !newItemData) {
      toast({ title: "Error Creating Item", description: itemError?.message || "Failed to get new item data.", variant: "destructive" });
      return; // Stop if item creation failed
    }

    const newItemId = newItemData.id;
    console.log('Created item with ID:', newItemId);

    // --- Step 2: Check original content for URL and add attachment if found ---
    const urlMatch = originalContent.match(URL_REGEX); // Check original content
    if (urlMatch) {
      const detectedUrl = urlMatch[0];
      console.log('Found URL, creating attachment:', detectedUrl);
      const { error: attachmentError } = await supabase
        .from("item_attachments")
        .insert({
          item_id: newItemId,
          attachment_type: 'url',
          url: detectedUrl,
          // label: getHostname(detectedUrl) // Optional: Add label later if needed
        });

      if (attachmentError) {
        toast({ title: "Warning", description: `Item created, but failed to attach URL: ${attachmentError.message}`, variant: "destructive" });
        // Don't return, item was still created
      }
    }

    // --- Step 3: Show success and invalidate ---
    toast({ title: "Added!", description: "Item added." });
    queryClient.invalidateQueries({ queryKey: ["items", projectId] });
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
        <h2 className="font-semibold text-xl mb-4">{project.title} Tasks & Notes</h2>
        <ItemList items={items || []} projectId={projectId as string} parentId={null} />
      </div>
    </div>
  );
}

function AddItemForm({ onAdd }: { onAdd: (params: { content: string }) => void }) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    onAdd({ content: trimmedContent });
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full"
    >
      <Textarea
        ref={textareaRef}
        className="flex-grow min-h-[40px] resize-none overflow-hidden"
        placeholder="New Task (or '- ' for Note)..."
        value={content}
        onChange={e => setContent(e.target.value)}
        required
        rows={1}
      />
      <Button type="submit">Add</Button>
    </form>
  );
}
