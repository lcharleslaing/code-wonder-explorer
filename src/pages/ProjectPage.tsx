import { useState, useRef, useEffect, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateProjectTimestamp } from "@/utils/updateProjectTimestamp";

// Add imports for the ProjectControls components
import { ProjectControlsProvider, useProjectControls } from "@/components/ItemList";
import { Eye, EyeOff, ChevronsRight, ChevronsDown, FilterX, SortAsc, SortDesc, Clock, FileText, CheckSquare, Plus } from "lucide-react";

// URL Regex (simple version, corrected)
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

// Define sort and filter types
type SortOption = 'newest' | 'oldest';
type FilterOption = 'all' | 'notes' | 'tasks';

// Create a separate navbar component that can use hooks properly
function ProjectNavbar() {
  const { focusMode, toggleFocusMode, isCollapsed, toggleCollapsed, hasChildren } = useProjectControls();
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'sticky',
      top: 64,
      zIndex: 40,
      width: '100%',
      background: '#fff',
      borderBottom: '1px solid #eee',
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
      fontFamily: 'Roboto, Arial, sans-serif',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 56,
        padding: '0 24px',
      }}>
        <Button
          style={{ background: 'none', border: '1px solid #3f51b5', color: '#3f51b5', fontWeight: 500, borderRadius: 6, padding: '6px 16px', marginRight: 12, cursor: 'pointer', transition: 'background 0.2s' }}
          onClick={() => navigate("/")}
          onMouseOver={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseOut={e => (e.currentTarget.style.background = 'none')}
        >
          ← Back to Dashboard
        </Button>
        <div style={{ display: 'flex', gap: 12 }}>
          {hasChildren && (
            <Button
              style={{ background: 'none', border: '1px solid #3f51b5', color: '#3f51b5', fontWeight: 500, borderRadius: 6, padding: '6px 16px', cursor: 'pointer', transition: 'background 0.2s' }}
              onClick={toggleCollapsed}
              onMouseOver={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseOut={e => (e.currentTarget.style.background = 'none')}
            >
              {isCollapsed ? (
                <><ChevronsRight style={{ height: 18, width: 18, marginRight: 6 }} /> Expand All</>
              ) : (
                <><ChevronsDown style={{ height: 18, width: 18, marginRight: 6 }} /> Collapse All</>
              )}
            </Button>
          )}
          <Button
            style={{ background: focusMode ? '#3f51b5' : 'none', color: focusMode ? '#fff' : '#3f51b5', border: '1px solid #3f51b5', fontWeight: 500, borderRadius: 6, padding: '6px 16px', cursor: 'pointer', transition: 'background 0.2s' }}
            onClick={toggleFocusMode}
            onMouseOver={e => (e.currentTarget.style.background = focusMode ? '#3949ab' : '#f5f5f5')}
            onMouseOut={e => (e.currentTarget.style.background = focusMode ? '#3f51b5' : 'none')}
          >
            {focusMode ? (
              <><Eye style={{ height: 18, width: 18, marginRight: 6 }} /> Normal View</>
            ) : (
              <><EyeOff style={{ height: 18, width: 18, marginRight: 6 }} /> Focus Mode</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { id: projectId } = useParams();
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Add state for sorting and filtering with localStorage persistence
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    const savedSort = localStorage.getItem(`project_${projectId}_sortOption`);
    return (savedSort === 'newest' || savedSort === 'oldest') ? savedSort as SortOption : 'newest';
  });

  const [filterOption, setFilterOption] = useState<FilterOption>(() => {
    const savedFilter = localStorage.getItem(`project_${projectId}_filterOption`);
    return (savedFilter === 'all' || savedFilter === 'notes' || savedFilter === 'tasks')
      ? savedFilter as FilterOption
      : 'all';
  });

  // Save preferences to localStorage
  useEffect(() => {
    if (projectId) {
      localStorage.setItem(`project_${projectId}_sortOption`, sortOption);
    }
  }, [projectId, sortOption]);

  useEffect(() => {
    if (projectId) {
      localStorage.setItem(`project_${projectId}_filterOption`, filterOption);
    }
  }, [projectId, filterOption]);

  // Add state for the add item dialog
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);

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

  // Fetch project items and their attachments, including created_at
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*, item_attachments(*)")
        .eq("project_id", projectId);
      if (error) throw error;
      return data as Item[];
    },
    enabled: !!projectId && !!user,
  });

  // Apply sorting and filtering
  const processedItems = useMemo(() => {
    if (!items) return [];

    // First apply filtering
    let filteredItems = [...items];
    if (filterOption === 'notes') {
      filteredItems = filteredItems.filter(item => !item.is_checklist);
    } else if (filterOption === 'tasks') {
      // Get all task IDs
      const taskIds = new Set(items.filter(item => item.is_checklist).map(item => item.id));

      // Get parent IDs of tasks (for folder structure)
      const parentIds = new Set<string>();
      items.forEach(item => {
        if (item.is_checklist && item.parent_id) {
          parentIds.add(item.parent_id);
        }
      });

      // Filter to include:
      // 1. Direct tasks (is_checklist = true)
      // 2. Parent folders that contain tasks
      // 3. Items with task children
      filteredItems = filteredItems.filter(item =>
        item.is_checklist ||                                // Direct tasks
        parentIds.has(item.id) ||                           // Parent folders containing tasks
        items.some(i => i.parent_id === item.id && i.is_checklist) // Items with task children
      );
    }

    // Then sort the filtered items
    if (sortOption === 'newest') {
      return [...filteredItems].sort((a, b) => {
        return new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime();
      });
    } else if (sortOption === 'oldest') {
      return [...filteredItems].sort((a, b) => {
        return new Date(a.updated_at || '').getTime() - new Date(b.updated_at || '').getTime();
      });
    }

    return filteredItems;
  }, [items, filterOption, sortOption]);

  // Update Add Root Item logic
  const addRootItem = async (params: { content: string }) => {
    if (!projectId || !user) return;

    const originalContent = params.content.trim(); // Keep original for URL check
    let finalContent = originalContent;
    let isChecklist = true;

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
        },
      ])
      .select()
      .single();

    if (itemError || !newItemData) {
      toast({ title: "Error Creating Item", description: itemError?.message || "Failed to get new item data.", variant: "destructive" });
      return;
    }

    const newItemId = newItemData.id;

    // --- Step 2: Check original content for URL and add attachment if found ---
    const urlMatch = originalContent.match(URL_REGEX);
    if (urlMatch) {
      const detectedUrl = urlMatch[0];
      const { error: attachmentError } = await supabase
        .from("item_attachments")
        .insert({
          item_id: newItemId,
          attachment_type: 'url',
          url: detectedUrl,
        });

      if (attachmentError) {
        toast({ title: "Warning", description: `Item created, but failed to attach URL: ${attachmentError.message}`, variant: "destructive" });
      }
    }

    toast({ title: "Added!", description: "Item added." });

    // Update project timestamp to move it to the top of dashboard
    await updateProjectTimestamp(projectId);

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
    <ProjectControlsProvider projectId={projectId as string}>
      <div style={{ background: '#fafbfc', minHeight: '100vh', fontFamily: 'Roboto, Arial, sans-serif' }}>
        {/* Secondary navbar with solid bg and no gap */}
        <ProjectNavbar />
        {/* Main content area with padding for sticky navbar */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 0' }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            padding: '32px 32px 24px 32px',
            marginBottom: 32,
          }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>{project.title}</h1>
            {project.description && (
              <p style={{ color: '#666', fontSize: 18, marginBottom: 0 }}>{project.description}</p>
            )}
          </div>
          <ProjectContent
            project={project}
            projectId={projectId as string}
            items={processedItems}
            addRootItem={addRootItem}
            addItemDialogOpen={addItemDialogOpen}
            setAddItemDialogOpen={setAddItemDialogOpen}
            sortOption={sortOption}
            setSortOption={setSortOption}
            filterOption={filterOption}
            setFilterOption={setFilterOption}
          />
        </div>
      </div>
    </ProjectControlsProvider>
  );
}

// Create a component for the main content that can use the ProjectControls context
function ProjectContent({
  project,
  projectId,
  items,
  addRootItem,
  addItemDialogOpen,
  setAddItemDialogOpen,
  sortOption,
  setSortOption,
  filterOption,
  setFilterOption
}: {
  project: Project;
  projectId: string;
  items: Item[];
  addRootItem: (params: { content: string }) => Promise<void>;
  addItemDialogOpen: boolean;
  setAddItemDialogOpen: (open: boolean) => void;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  filterOption: FilterOption;
  setFilterOption: (option: FilterOption) => void;
}) {
  const { focusMode } = useProjectControls();

  return (
    <>
      {/* Only show the add form when not in focus mode */}
      {!focusMode && (
        <div style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          padding: 24,
          marginBottom: 32,
        }}>
          <h2 style={{ fontWeight: 600, fontSize: 22, marginBottom: 12 }}>Add Note or Checklist</h2>
          <AddItemForm onAdd={addRootItem} />
        </div>
      )}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: 24,
        marginBottom: 32,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontWeight: 600, fontSize: 22 }}>{project.title} Tasks & Notes</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {focusMode && (
              <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
                <DialogTrigger>
                  <Button style={{ height: 36, background: '#3f51b5', color: '#fff', borderRadius: 6, fontWeight: 500, padding: '0 18px', fontSize: 15 }}> <Plus style={{ height: 18, width: 18, marginRight: 6 }} /> Add Item </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Item</DialogTitle>
                  </DialogHeader>
                  <AddItemForm
                    onAdd={(params) => {
                      addRootItem(params);
                      setAddItemDialogOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            )}
            <Select value={filterOption} onValueChange={value => setFilterOption(value as FilterOption)}>
              <SelectTrigger style={{ width: 120, height: 36, borderRadius: 6, fontSize: 15 }}>
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><FilterX style={{ marginRight: 8, height: 16, width: 16 }} /> All Items</SelectItem>
                <SelectItem value="notes"><FileText style={{ marginRight: 8, height: 16, width: 16 }} /> Notes Only</SelectItem>
                <SelectItem value="tasks"><CheckSquare style={{ marginRight: 8, height: 16, width: 16 }} /> Tasks Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOption} onValueChange={value => setSortOption(value as SortOption)}>
              <SelectTrigger style={{ width: 140, height: 36, borderRadius: 6, fontSize: 15 }}>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest"><SortDesc style={{ marginRight: 8, height: 16, width: 16 }} /> Recently Updated</SelectItem>
                <SelectItem value="oldest"><SortAsc style={{ marginRight: 8, height: 16, width: 16 }} /> Oldest Updates</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <ItemList items={items} projectId={projectId} parentId={null} />
      </div>
    </>
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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    onAdd({ content: trimmedContent });
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', gap: 12, alignItems: 'flex-end', width: '100%' }}
    >
      <Textarea
        ref={textareaRef}
        style={{ flexGrow: 1, minHeight: 40, resize: 'none', overflow: 'hidden', fontSize: 16, borderRadius: 6, border: '1px solid #ccc', padding: 12, fontFamily: 'Roboto, Arial, sans-serif' }}
        placeholder="New Task (or '- ' for Note)..."
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const trimmedContent = content.trim();
            if (trimmedContent) {
              onAdd({ content: trimmedContent });
              setContent("");
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.focus();
              }
            }
          } else if (e.key === "Escape") {
            setContent("");
            textareaRef.current?.blur();
          }
        }}
        required
        rows={1}
      />
      <Button type="submit" style={{ height: 40, background: '#3f51b5', color: '#fff', borderRadius: 6, fontWeight: 500, padding: '0 18px', fontSize: 15 }}>Add</Button>
    </form>
  );
}
