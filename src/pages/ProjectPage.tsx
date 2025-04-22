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
    <div className="sticky top-[56px] z-40 w-full bg-background border-b">
      <div className="container mx-auto flex justify-between items-center h-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="px-2"
        >
          ← Back to Projects
        </Button>

        <div className="flex gap-2">
          {hasChildren && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCollapsed}
            >
              {isCollapsed ? (
                <>
                  <ChevronsRight className="h-4 w-4 mr-1" />
                  Expand All
                </>
              ) : (
                <>
                  <ChevronsDown className="h-4 w-4 mr-1" />
                  Collapse All
                </>
              )}
            </Button>
          )}
          <Button
            variant={focusMode ? "default" : "outline"}
            size="sm"
            onClick={toggleFocusMode}
          >
            {focusMode ? (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Normal View
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Focus Mode
              </>
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
      <div className="flex flex-col">
        {/* Secondary navbar with solid bg and no gap */}
        <ProjectNavbar />

        {/* Main content area with padding for sticky navbar */}
        <div className="container mx-auto py-6 pt-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{project.title}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>

          {/* Conditionally render based on focus mode */}
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
        <div className="mb-8">
          <h2 className="font-semibold text-xl mb-2">Add Note or Checklist</h2>
          <div className="flex gap-2 flex-col sm:flex-row">
            <AddItemForm onAdd={addRootItem} />
          </div>
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-xl">{project.title} Tasks & Notes</h2>

          <div className="flex gap-2 items-center">
            {/* Add a "+" button that's visible in focus mode */}
            {focusMode && (
              <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-8 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
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

            {/* Sort and filter controls */}
            <Select
              value={filterOption}
              onValueChange={(value) => setFilterOption(value as FilterOption)}
            >
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center">
                    <FilterX className="mr-2 h-4 w-4" />
                    <span>All Items</span>
                  </div>
                </SelectItem>
                <SelectItem value="notes">
                  <div className="flex items-center">
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Notes Only</span>
                  </div>
                </SelectItem>
                <SelectItem value="tasks">
                  <div className="flex items-center">
                    <CheckSquare className="mr-2 h-4 w-4" />
                    <span>Tasks Only</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortOption}
              onValueChange={(value) => setSortOption(value as SortOption)}
            >
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">
                  <div className="flex items-center">
                    <SortDesc className="mr-2 h-4 w-4" />
                    <span>Recently Updated</span>
                  </div>
                </SelectItem>
                <SelectItem value="oldest">
                  <div className="flex items-center">
                    <SortAsc className="mr-2 h-4 w-4" />
                    <span>Oldest Updates</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pass the processed items to ItemList */}
        <ItemList
          items={items}
          projectId={projectId}
          parentId={null}
        />
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

  // Add a new effect for auto-focus when component mounts
  useEffect(() => {
    // Focus the textarea when the component mounts
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
      textareaRef.current.focus(); // Re-focus after submitting
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
        onKeyDown={e => {
          // Only submit with Ctrl+Enter, normal Enter adds a new line
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
            // Clear the input on Escape
            setContent("");
            textareaRef.current?.blur();
          }
        }}
        required
        rows={1}
      />
      <Button type="submit">Add</Button>
    </form>
  );
}
