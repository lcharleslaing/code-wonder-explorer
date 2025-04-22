import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase, uploadImage } from "@/integrations/supabase/client";
import { Item } from "@/types/project";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useState, useRef, useEffect, createContext, useContext } from "react";
import { SquareCheck, Pencil, FileText, ListCheck, Trash2, LinkIcon, Paperclip, ChevronRight, ChevronDown, MoveHorizontal, FolderOpen, FolderClosed, Eye, EyeOff, Copy, CheckSquare, MessageSquare, GripVertical, CircleUserRound, CircleX, ClipboardCopy, Edit2, Plus, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ItemListProps {
  items: Item[];
  projectId: string;
  parentId: string | null;
  parentCollapsed?: boolean;
}

// Create a context for project controls (focus mode, collapse/expand)
export interface ProjectControlsContextType {
  focusMode: boolean;
  toggleFocusMode: () => void;
  setFocusMode: (value: boolean) => void;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  setIsCollapsed: (value: boolean) => void;
  hasChildren?: boolean;
  updateHasChildren: (value: boolean) => void;
}

export const ProjectControlsContext = createContext<ProjectControlsContextType>({
  focusMode: false,
  toggleFocusMode: () => { },
  setFocusMode: () => { },
  isCollapsed: false,
  toggleCollapsed: () => { },
  setIsCollapsed: () => { },
  hasChildren: false,
  updateHasChildren: () => { },
});

// Add this new component to export
export function ProjectControlsProvider({ children }: { children: React.ReactNode }) {
  const [focusMode, setFocusMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);

  const toggleFocusMode = () => setFocusMode(!focusMode);
  const toggleCollapsed = () => setIsCollapsed(!isCollapsed);

  // Add a function to update hasChildren
  const updateHasChildren = (value: boolean) => setHasChildren(value);

  return (
    <ProjectControlsContext.Provider
      value={{
        focusMode,
        toggleFocusMode,
        setFocusMode,
        isCollapsed,
        toggleCollapsed,
        setIsCollapsed,
        hasChildren,
        updateHasChildren
      }}
    >
      {children}
    </ProjectControlsContext.Provider>
  );
}

// Add a custom hook for easier access to context
export function useProjectControls() {
  return useContext(ProjectControlsContext);
}

export default function ItemList({
  items,
  projectId,
  parentId,
  parentCollapsed,
}: ItemListProps) {
  const queryClient = useQueryClient();
  const list = items.filter(i => i.parent_id === parentId);

  // Get global controls from context
  const { focusMode, isCollapsed, updateHasChildren } = useProjectControls();

  // Local collapse state based on parent's state or global state
  const [localCollapsed, setLocalCollapsed] = useState(false);

  // Determine effective collapse state
  const effectiveCollapsed = parentId === null ? isCollapsed : (parentCollapsed || localCollapsed);

  // Function to check if any item has children
  const hasChildren = list.some(item =>
    items.some(i => i.parent_id === item.id)
  );

  // Update parent context with children info if this is the root level
  useEffect(() => {
    if (parentId === null) {
      updateHasChildren(hasChildren);
    }
  }, [parentId, hasChildren, updateHasChildren]);

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require a bit of movement before activating drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event to update item positions
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Find the indices of the items being dragged
      const oldIndex = list.findIndex(item => item.id === active.id);
      const newIndex = list.findIndex(item => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Create a map of items to their new positions
        const newList = arrayMove([...list], oldIndex, newIndex);
        const positionUpdates = newList.map((item, index) => ({
          id: item.id,
          position: index + 1, // Positions start at 1
        }));

        // Update positions in the database
        try {
          // For each item, update its position
          for (const update of positionUpdates) {
            await supabase
              .from("items")
              .update({ position: update.position })
              .eq("id", update.id);
          }

          // Refresh data after all updates
          queryClient.invalidateQueries({ queryKey: ["items", projectId] });
          toast({ title: "Items reordered successfully" });
        } catch (error) {
          console.error("Error updating positions:", error);
          toast({
            title: "Failed to update positions",
            variant: "destructive"
          });
        }
      }
    }
  };

  // Create a sorted list by position
  const sortedList = [...list].sort((a, b) => (a.position || 0) - (b.position || 0));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedList.map(item => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-3">
          {sortedList.map(item => (
            <SortableItemRow
              key={item.id}
              id={item.id}
              item={item}
              projectId={projectId}
              allItems={items}
              parentCollapsed={effectiveCollapsed}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// Helper function to extract hostname
function getHostname(url: string): string {
  try {
    const parsedUrl = new URL(url);
    // Remove www. if it exists
    return parsedUrl.hostname.replace(/^www\./, '');
  } catch (e) {
    // If URL parsing fails, return a generic label or part of the URL
    return url.length > 30 ? url.substring(0, 27) + '...' : url;
  }
}

// Wrap ItemRow with dnd-kit sortable functionality
function SortableItemRow({ id, item, projectId, allItems, parentCollapsed }: {
  id: string;
  item: Item;
  projectId: string;
  allItems: Item[];
  parentCollapsed?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <li className="border-b pb-2 last:border-b-0">
      <div
        ref={setNodeRef}
        style={style}
        className={`flex gap-2 items-start w-full ${isDragging ? 'bg-muted/60 rounded-md' : ''}`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab mt-2 text-muted-foreground hover:text-foreground flex items-center h-6 w-6 justify-center"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <ItemRow
            item={item}
            projectId={projectId}
            allItems={allItems}
            parentCollapsed={parentCollapsed}
          />
        </div>
      </div>
    </li>
  );
}

function ItemRow({
  item,
  projectId,
  allItems,
  parentCollapsed = false,
}: {
  item: Item;
  projectId: string;
  allItems: Item[];
  parentCollapsed?: boolean;
}) {
  // Get focus mode from the project controls context
  const { focusMode } = useProjectControls();

  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const prevEditing = useRef(editing); // Ref to track previous editing state

  const [addingChild, setAddingChild] = useState(false);
  const [childContent, setChildContent] = useState("");
  const [childChecklist, setChildChecklist] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // State for confirmation dialog
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null); // Add this reference for the child input

  // Check if this item has children
  const hasChildren = allItems.some(i => i.parent_id === item.id);

  // Effect to sync with parent collapse state
  useEffect(() => {
    if (parentCollapsed !== undefined) {
      setIsCollapsed(parentCollapsed);
    }
  }, [parentCollapsed]);

  useEffect(() => {
    // Adjust height based on content whenever editing
    if (editing && editTextAreaRef.current) {
      editTextAreaRef.current.style.height = 'auto';
      editTextAreaRef.current.style.height = `${editTextAreaRef.current.scrollHeight}px`;
    }
    // Focus and select only when transitioning from not editing to editing
    if (editing && !prevEditing.current && editTextAreaRef.current) {
      editTextAreaRef.current.focus();
      // Set timeout allows the focus to settle before selecting
      setTimeout(() => editTextAreaRef.current?.select(), 0);
    }
    // Update previous editing state ref for the next render
    prevEditing.current = editing;
  }, [editing, content]); // Keep content dependency for height adjustment

  // Add effect to focus on child input when addingChild state changes
  useEffect(() => {
    if (addingChild && childInputRef.current) {
      // Use setTimeout to ensure DOM has updated before focusing
      setTimeout(() => {
        childInputRef.current?.focus();
      }, 0);
    }
  }, [addingChild]);

  // Mutation for updating item content specifically
  const updateContentMutation = useMutation({
    mutationFn: async (newContent: string) => {
      // URL/prefix logic isn't needed when just updating content
      const { error } = await supabase
        .from("items")
        .update({ content: newContent })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["items", projectId] });
      // Maybe a subtle toast for content update?
    },
    onError: (error) => {
      toast({ title: "Error updating content", description: error.message, variant: "destructive" });
    }
  });

  // Mutation for toggling between note and task types
  const toggleItemTypeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("items")
        .update({ is_checklist: !item.is_checklist })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", projectId] });
      toast({
        title: item.is_checklist ? "Converted to note" : "Converted to task",
        description: item.is_checklist ? "Item is now a note" : "Item is now a task"
      });
    },
    onError: (error) => {
      toast({
        title: "Error changing item type",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation for adding an image attachment
  const addImageAttachmentMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const { error } = await supabase
        .from("item_attachments")
        .insert({
          item_id: item.id,
          attachment_type: 'image',
          url: imageUrl
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", projectId] });
      toast({ title: "Success", description: "Image attached." });
    },
    onError: (error) => {
      toast({ title: "Error attaching image", description: error.message, variant: "destructive" });
      console.error("Error creating image attachment record:", error);
    },
  });

  // Update handleFileChange to use the new mutation
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      toast({ title: "Uploading image..." });
      const imageUrl = await uploadImage(file);
      // Use the new mutation to add attachment record
      addImageAttachmentMutation.mutate(imageUrl);
    } catch (error: unknown) {
      let errorMessage = "An unknown error occurred";
      if (error instanceof Error) { // Type check
        errorMessage = error.message;
      }
      toast({ title: "Upload failed", description: errorMessage, variant: "destructive" });
      console.error("Image upload process failed:", error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Helper function to get all descendant IDs (recursive)
  function getAllDescendantIds(itemId: string, allItems: Item[]): string[] {
    const directChildren = allItems.filter(i => i.parent_id === itemId);
    let descendantIds: string[] = directChildren.map(child => child.id);
    directChildren.forEach(child => {
      descendantIds = descendantIds.concat(getAllDescendantIds(child.id, allItems));
    });
    return descendantIds;
  }

  // Helper to check for incomplete checklist descendants
  function hasIncompleteChecklistDescendants(itemId: string, allItems: Item[]): boolean {
    const descendantIds = getAllDescendantIds(itemId, allItems);
    return allItems.some(i =>
      descendantIds.includes(i.id) && i.is_checklist && !i.is_completed
    );
  }

  // New helper function to check siblings and complete parent if necessary
  async function checkAndCompleteParentIfNeeded(parentId: string | null) {
    if (!parentId) return;

    const parent = allItems.find(i => i.id === parentId);
    console.log(`[Parent Check ${parentId}] Checking parent...`, { parent }); // Log parent found

    if (!parent || !parent.is_checklist || parent.is_completed) {
      console.log(`[Parent Check ${parentId}] Aborting: Parent not found, not checklist, or already completed.`);
      return;
    }

    // Fetch current state of siblings to ensure accuracy after update
    console.log(`[Parent Check ${parentId}] Fetching current sibling state...`);
    const { data: currentSiblingsState, error: siblingError } = await supabase
      .from("items")
      .select("id, is_completed, is_checklist")
      .eq("parent_id", parentId);

    if (siblingError || !currentSiblingsState) {
      console.error(`[Parent Check ${parentId}] Error fetching sibling state:`, siblingError);
      return;
    }
    console.log(`[Parent Check ${parentId}] Fetched siblings:`, currentSiblingsState);

    const checklistSiblings = currentSiblingsState.filter(s => s.is_checklist);
    console.log(`[Parent Check ${parentId}] Filtered checklist siblings:`, checklistSiblings);

    if (checklistSiblings.length === 0) {
      console.log(`[Parent Check ${parentId}] Aborting: No checklist siblings found.`);
      return; // No checklist siblings to evaluate
    }

    const allChecklistSiblingsNowComplete = checklistSiblings.every(s => s.is_completed);
    console.log(`[Parent Check ${parentId}] All checklist siblings complete?`, allChecklistSiblingsNowComplete);

    if (allChecklistSiblingsNowComplete) {
      console.log(`[Parent Check ${parentId}] Triggering auto-completion...`);
      const { error: parentUpdateError } = await supabase
        .from("items")
        .update({ is_completed: true })
        .eq("id", parent.id);

      if (parentUpdateError) {
        toast({ title: "Error", description: `Failed to auto-complete parent: ${parentUpdateError.message}`, variant: "destructive" });
        console.error(`[Parent Check ${parentId}] Error auto-completing parent:`, parentUpdateError);
      } else {
        console.log(`[Parent Check ${parentId}] Parent auto-completed successfully.`);
        // Invalidate query AFTER the parent update succeeds to refresh UI
        queryClient.invalidateQueries({ queryKey: ["items", projectId] });
      }
    } else {
      console.log(`[Parent Check ${parentId}] Not auto-completing: Not all checklist siblings are complete.`);
    }
  }

  // Refactor toggleComplete/performComplete to update directly
  async function performCompleteAction(completeChildren: boolean) {
    setShowCompleteConfirm(false); // Close dialog if open

    if (completeChildren) {
      // Bulk complete self and descendants
      const descendantIds = getAllDescendantIds(item.id, allItems);
      const allIdsToComplete = [item.id, ...descendantIds];
      const { error } = await supabase
        .from("items")
        .update({ is_completed: true })
        .in("id", allIdsToComplete);

      if (error) {
        toast({ title: "Error", description: `Failed to bulk update: ${error.message}`, variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["items", projectId] });
        // Check parent AFTER successful bulk update
        await checkAndCompleteParentIfNeeded(item.parent_id);
      }

    } else {
      const currentlyCompleted = item.is_completed;
      if (currentlyCompleted) {
        // --- Unchecking Logic --- (includes bulk uncheck of ancestors)
        const idsToUncheck: string[] = [item.id];
        let currentParentId: string | null = item.parent_id;
        while (currentParentId) {
          const parent = allItems.find(i => i.id === currentParentId);
          if (parent && parent.is_checklist && parent.is_completed) {
            idsToUncheck.push(parent.id);
            currentParentId = parent.parent_id;
          } else {
            break;
          }
        }
        const { error } = await supabase
          .from("items")
          .update({ is_completed: false })
          .in("id", idsToUncheck);

        if (error) {
          toast({ title: "Error", description: `Failed to uncheck item(s): ${error.message}`, variant: "destructive" });
        } else {
          queryClient.invalidateQueries({ queryKey: ["items", projectId] });
          // No need to check parent completion when unchecking
        }
        // --- End Unchecking Logic ---
      } else {
        // --- Checking Logic (single item) ---
        const { error: updateError } = await supabase
          .from("items")
          .update({ is_completed: true })
          .eq("id", item.id);

        if (updateError) {
          toast({ title: "Error", description: updateError.message, variant: "destructive" });
        } else {
          queryClient.invalidateQueries({ queryKey: ["items", projectId] });
          // Check parent AFTER successful single item check
          await checkAndCompleteParentIfNeeded(item.parent_id);
        }
        // --- End Checking Logic ---
      }
    }
  }

  async function toggleComplete() {
    const isChecking = !item.is_completed;

    if (isChecking && item.is_checklist && hasIncompleteChecklistDescendants(item.id, allItems)) {
      // Show confirmation dialog if checking and incomplete checklist children exist
      setShowCompleteConfirm(true);
    } else {
      // Otherwise, proceed with normal toggle (checking or unchecking)
      await performCompleteAction(false);
    }
  }

  async function deleteItem() {
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["items", projectId] });
  }

  // Add child note/checklist item
  async function addChild() {
    const originalContent = childContent.trim(); // Keep original
    if (!originalContent) return;

    let finalContent = originalContent;
    let isChecklist = true;
    // let linkedUrl: string | null = null; // Remove

    // Check for note prefix
    if (finalContent.startsWith('-')) {
      isChecklist = false;
      finalContent = finalContent.substring(1).trimStart();
    }

    // --- Step 1: Insert the child item ---
    const { data: newItemData, error: itemError } = await supabase
      .from("items")
      .insert([
        {
          content: finalContent,
          project_id: projectId,
          is_checklist: isChecklist,
          parent_id: item.id,
          position: (allItems.filter(i => i.parent_id === item.id).length ?? 0) + 1,
          // linked_url: linkedUrl, // Remove
        },
      ])
      .select()
      .single();

    if (itemError || !newItemData) {
      toast({ title: "Error Creating Child Item", description: itemError?.message || "Failed to get new item data.", variant: "destructive" });
      setAddingChild(false); // Close form even on error
      return;
    }

    const newItemId = newItemData.id;
    console.log('Created child item with ID:', newItemId);

    // --- Step 2: Check original content for URL and add attachment ---
    const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
    const urlMatch = originalContent.match(URL_REGEX);
    if (urlMatch) {
      const detectedUrl = urlMatch[0];
      console.log('Found URL, creating attachment:', detectedUrl);
      const { error: attachmentError } = await supabase
        .from("item_attachments")
        .insert({
          item_id: newItemId,
          attachment_type: 'url',
          url: detectedUrl,
        });

      if (attachmentError) {
        toast({ title: "Warning", description: `Child item created, but failed to attach URL: ${attachmentError.message}`, variant: "destructive" });
      }
    }

    // --- Step 3: Reset form and invalidate ---
    queryClient.invalidateQueries({ queryKey: ["items", projectId] });
    setChildContent("");
    setAddingChild(false);
  }

  function cancelEdit() {
    setContent(item.content);
    setEditing(false);
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex gap-2 items-start w-full">
        {hasChildren && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="mt-1 text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label={isCollapsed ? "Expand item" : "Collapse item"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-4"></div>}

        {item.is_checklist ? (
          <Checkbox
            id={`item-check-${item.id}`}
            className="mt-[5px]"
            checked={item.is_completed}
            onCheckedChange={toggleComplete}
            aria-label="Toggle task completion"
          />
        ) : (
          <FileText className="text-blue-600 mt-1 flex-shrink-0" />
        )}
        <div className="flex-grow flex flex-col gap-1 min-w-0 relative">
          <div className="relative">
            <span
              className={`${(item.is_completed && item.is_checklist) ? "line-through text-muted-foreground" : ""} cursor-pointer flex-grow whitespace-pre-wrap pt-1 min-w-0 pr-6`}
              onClick={() => setEditing(true)}
            >
              {item.content}
            </span>

            {/* Add floating "+" button for all items */}
            {!editing && !isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-4 w-4 p-0 rounded-full hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingChild(!addingChild);
                  if (addingChild) {
                    setChildContent("");
                  }
                }}
                title="Add sub-item"
              >
                <Plus className="h-2.5 w-2.5 text-primary" />
              </Button>
            )}
          </div>

          {/* Only show attachments when not collapsed and not in focus mode */}
          {!editing && !isCollapsed && !focusMode && item.item_attachments && item.item_attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.item_attachments.map(att => (
                <div key={att.id}>
                  {att.attachment_type === 'url' && att.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      asChild
                    >
                      <a href={att.url} target="_blank" rel="noopener noreferrer">
                        <LinkIcon className="mr-1 h-3 w-3" />
                        {getHostname(att.url)}
                      </a>
                    </Button>
                  )}
                  {att.attachment_type === 'image' && att.url && (
                    <Dialog open={previewImageId === att.id} onOpenChange={(open) => setPreviewImageId(open ? att.id : null)}>
                      <DialogTrigger asChild>
                        <img
                          src={att.url}
                          alt={att.label || "Attached image thumbnail"}
                          className="max-w-[80px] max-h-[60px] rounded border cursor-pointer object-cover hover:opacity-80 transition-opacity"
                        />
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl p-2">
                        <img
                          src={att.url}
                          alt={att.label || "Attached image preview"}
                          className="max-w-full max-h-[80vh] object-contain mx-auto"
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons only shown when not collapsed and not in focus mode */}
          {!editing && !isCollapsed && !focusMode && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                id={`file-upload-${item.id}`}
              />
              <Button
                variant="outline"
                size="sm"
                title="Copy to Clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(item.content)
                    .then(() => toast({ title: "Copied to clipboard" }))
                    .catch(err => toast({
                      title: "Failed to copy",
                      description: "Could not copy to clipboard",
                      variant: "destructive"
                    }));
                }}
                className="h-8"
              >
                <Copy className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Attach Image"
                onClick={() => fileInputRef.current?.click()}
                disabled={addImageAttachmentMutation.isPending}
                className="h-8"
              >
                <Paperclip className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Attach</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                title="Edit"
                className="h-8"
              >
                <Pencil className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleItemTypeMutation.mutate()}
                title={item.is_checklist ? "Convert to Note" : "Convert to Task"}
                className="h-8"
                disabled={toggleItemTypeMutation.isPending}
              >
                {item.is_checklist ? (
                  <>
                    <MessageSquare className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">To Note</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">To Task</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deleteItem}
                title="Delete"
                className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={() => {
                  setAddingChild(!addingChild);
                  // If opening, will be focused via useEffect
                  // If closing, clear the content
                  if (addingChild) {
                    setChildContent("");
                  }
                }}
              >
                <span className="mr-1 sm:mr-1">+</span>
                <span className="hidden sm:inline">Add child</span>
              </Button>
            </div>
          )}

          {/* Show child form when not collapsed (works in both normal and focus mode) */}
          {!isCollapsed && addingChild && (
            <form
              onSubmit={e => {
                e.preventDefault();
                addChild();
              }}
              className="flex gap-2 items-center pl-3 ml-0 mt-2 border-l-2 border-blue-200"
            >
              <Input
                ref={childInputRef}
                className="border rounded px-2 py-1 text-sm flex-grow"
                placeholder="New Task (or '- ' for Note)..."
                value={childContent}
                onChange={e => setChildContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (childContent.trim()) {
                      addChild();
                    }
                  }
                  if (e.key === "Escape") {
                    setAddingChild(false);
                    setChildContent("");
                  }
                }}
                onBlur={() => {
                  if (!childContent.trim()) {
                    setAddingChild(false);
                  }
                }}
              />
              <Button type="submit" size="sm">Add</Button>
            </form>
          )}
        </div>
      </div>

      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Completion</AlertDialogTitle>
            <AlertDialogDescription>
              This task has incomplete sub-tasks. Do you want to mark all sub-tasks as complete as well?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCompleteConfirm(false)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => performCompleteAction(true)}>Yes, Mark All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isCollapsed && hasChildren && (
        <div className="mt-3 pl-3 border-l-2 border-blue-200">
          <ItemList
            items={allItems}
            projectId={projectId}
            parentId={item.id}
            parentCollapsed={parentCollapsed}
          />
        </div>
      )}
    </div>
  );
}
