import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase, uploadImage } from "@/integrations/supabase/client";
import { Item } from "@/types/project";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useState, useRef, useEffect, createContext, useContext, useCallback } from "react";
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
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from '@dnd-kit/utilities';
import { updateProjectTimestamp } from "@/utils/updateProjectTimestamp";

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

// Add this new context for the Alt key state
export const AltKeyContext = createContext<boolean>(false);

export function ProjectControlsProvider({ children, projectId }: { children: React.ReactNode, projectId?: string }) {
  // Get saved states from localStorage with project-specific keys if projectId is available
  const storageKeyPrefix = projectId ? `project_${projectId}_` : 'global_';
  
  const [focusMode, setFocusMode] = useState(() => {
    const savedMode = localStorage.getItem(`${storageKeyPrefix}focusMode`);
    return savedMode === 'true';
  });
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedCollapsed = localStorage.getItem(`${storageKeyPrefix}isCollapsed`);
    return savedCollapsed === 'true';
  });
  
  const [hasChildren, setHasChildren] = useState(false);
  
  // Add global Alt key tracking
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Add effect to listen for Alt key press/release at the provider level
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };
    
    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const toggleFocusMode = useCallback(() => setFocusMode(prev => !prev), []);
  
  // Improved toggle function with better state handling
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => {
      const newState = !prev;
      
      // Force update localStorage immediately for global state
      localStorage.setItem(`${storageKeyPrefix}isCollapsed`, newState.toString());
      
      // Also clear any individual item collapse states to ensure proper inheritance
      if (projectId) {
        // Reset localStorage for all items when toggling global collapse
        const itemPrefix = `project_${projectId}_item_`;
        
        // Find and update all item-specific collapse states
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(itemPrefix) && key.endsWith('_collapsed')) {
            localStorage.setItem(key, newState.toString());
          }
        }
      }
      
      return newState;
    });
  }, [storageKeyPrefix, projectId]);

  // Add a function to update hasChildren
  const updateHasChildren = useCallback((value: boolean) => setHasChildren(value), []);
  
  // Save states to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}focusMode`, focusMode.toString());
  }, [focusMode, storageKeyPrefix]);
  
  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}isCollapsed`, isCollapsed.toString());
  }, [isCollapsed, storageKeyPrefix]);

  return (
    <AltKeyContext.Provider value={isAltPressed}>
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
    </AltKeyContext.Provider>
  );
}

// Add a custom hook for easier access to context
export function useProjectControls() {
  return useContext(ProjectControlsContext);
}

// New hook for Alt key state
export function useAltKey() {
  return useContext(AltKeyContext);
}

// Helper to generate unique storage keys for each item
const getItemCollapseKey = (projectId: string, itemId: string) => {
  return `project_${projectId}_item_${itemId}_collapsed`;
};

// Initialize child items to start collapsed by default
const getChildInitialCollapsed = (projectId: string, itemId: string) => {
  const savedState = localStorage.getItem(getItemCollapseKey(projectId, itemId));
  // If no saved state, default to collapsed (true)
  return savedState !== 'false'; 
};

// Add this at the top level, outside of any components
export const DragContext = createContext<{
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  projectId: string | null;
  allItems: Item[];
}>({
  activeId: null,
  setActiveId: () => {},
  projectId: null,
  allItems: [],
});

export default function ItemList({
  items,
  projectId,
  parentId,
  parentCollapsed,
}: ItemListProps) {
  const queryClient = useQueryClient();
  const list = items.filter(i => i.parent_id === parentId);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Add state for adding root items when in focus mode
  const [addingRootItem, setAddingRootItem] = useState(false);
  const [rootItemContent, setRootItemContent] = useState("");

  // Get global controls from context
  const { focusMode, isCollapsed, updateHasChildren } = useProjectControls();

  // Local collapse state based on parent's state or global state
  const [localCollapsed, setLocalCollapsed] = useState(false);

  // Determine effective collapse state - only used for initially hiding/showing children
  // When a parent is collapsed by global state, we want to respect that
  // But once a user interacts, the local state takes precedence
  const effectiveCollapsed = parentId === null ? isCollapsed : parentCollapsed;

  // Function to check if any item has children
  const hasChildren = list.some(item =>
    items.some(i => i.parent_id === item.id)
  );

  // Function to add root item
  async function addRootItem() {
    const trimmedContent = rootItemContent.trim();
    if (!trimmedContent) return;

    let finalContent = trimmedContent;
    let isChecklist = true;

    // Check for note prefix
    if (finalContent.startsWith('-')) {
      isChecklist = false;
      finalContent = finalContent.substring(1).trimStart();
    }

    try {
      // Insert the new root item
      const { data: newItemData, error: itemError } = await supabase
        .from("items")
        .insert([
          {
            content: finalContent,
            project_id: projectId,
            is_checklist: isChecklist,
            parent_id: null,
            position: (items.filter(i => i.parent_id === null).length ?? 0) + 1,
          },
        ])
        .select()
        .single();

      if (itemError || !newItemData) {
        toast({
          title: "Error Creating Item",
          description: itemError?.message || "Failed to create item",
          variant: "destructive"
        });
        return;
      }

      // Check for URLs in content and create attachment if found
      const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
      const urlMatch = trimmedContent.match(URL_REGEX);
      
      if (urlMatch) {
        const detectedUrl = urlMatch[0];
        await supabase
          .from("item_attachments")
          .insert({
            item_id: newItemData.id,
            attachment_type: 'url',
            url: detectedUrl,
          });
      }

      // Update project timestamp
      await updateProjectTimestamp(projectId);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["items", projectId] });
      
      // Reset the form
      setRootItemContent("");
      setAddingRootItem(false);
      
      toast({ title: "Item added successfully" });
    } catch (error) {
      console.error("Error adding root item:", error);
      toast({
        title: "Error adding item",
        variant: "destructive"
      });
    }
  }

  // Update parent context with children info if this is the root level
  useEffect(() => {
    if (parentId === null) {
      updateHasChildren(hasChildren);
    }
  }, [parentId, hasChildren, updateHasChildren]);

  // Sync with global collapse state for root-level items
  useEffect(() => {
    if (parentId === null) {
      // Only apply global collapse state to root level
      setLocalCollapsed(isCollapsed);
      
      // Update localStorage for all items (both collapsed and expanded states)
      list.forEach(item => {
        localStorage.setItem(
          getItemCollapseKey(projectId, item.id), 
          isCollapsed.toString()
        );
      });
    }
  }, [isCollapsed, parentId, list, projectId]);

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

  // Create a sorted list by position
  const sortedList = [...list].sort((a, b) => (a.position || 0) - (b.position || 0));
  
  // Handle drag start event
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);
  }

  // Handle drag over event for parent switching
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const activeItem = items.find(item => item.id === active.id);
    const overItem = items.find(item => item.id === over.id);

    if (!activeItem || !overItem) return;

    // Don't allow dropping an item into its own descendants (would create a cycle)
    // Need to get all descendant IDs to prevent circular references
    const descendantIds: string[] = [];
    // Find all descendants of the active item to prevent circular references
    function getItemDescendants(itemId: string): void {
      const directChildren = items.filter(i => i.parent_id === itemId);
      for (const child of directChildren) {
        descendantIds.push(child.id);
        getItemDescendants(child.id);
      }
    }
    getItemDescendants(activeItem.id);
    
    if (descendantIds.includes(overItem.id)) return;
  }

  // Handle drag end event
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeItem = items.find(item => item.id === active.id);
    const overItem = items.find(item => item.id === over.id);

    if (!activeItem || !overItem) return;

    // Check if we need to make the item a child of the target item
    // This is decided based on:
    // 1. Mouse position - if it's close to the indent area
    // 2. The target item having children (or allowing children)
    // 3. Not creating circular references
    const isShiftKeyPressed = event.activatorEvent instanceof KeyboardEvent && event.activatorEvent.shiftKey;
    const hasOverItemChildren = items.some(i => i.parent_id === overItem.id);
    
    // Make active item a child of over item when Shift is pressed, or over item already has children
    const makeChild = isShiftKeyPressed && hasOverItemChildren;
    
    if (makeChild) {
      // Target parent will be the over item
      const newParentId = overItem.id;
      
      // Get next position for child item 
      const childItems = items.filter(i => i.parent_id === newParentId);
      const newPosition = (childItems.length ?? 0) + 1;
      
      try {
        // Update the parent_id and position
        await supabase
          .from("items")
          .update({ 
            parent_id: newParentId,
            position: newPosition
          })
          .eq("id", activeItem.id);
          
        // Update project timestamp so it appears at the top of the dashboard
        await updateProjectTimestamp(projectId);
        
        // Refresh data after all updates
        queryClient.invalidateQueries({ queryKey: ["items", projectId] });
        toast({ title: "Item added as child" });
        return;
      } catch (error) {
        console.error("Error adding item as child:", error);
        toast({
          title: "Failed to add as child",
          variant: "destructive"
        });
        return;
      }
    }
    
    // Check if we're moving within the same parent or to a different parent
    if (activeItem.parent_id === overItem.parent_id) {
      // Same parent case - just reorder
      const sameParentItems = items.filter(item => item.parent_id === activeItem.parent_id);
      const oldIndex = sameParentItems.findIndex(item => item.id === active.id);
      const newIndex = sameParentItems.findIndex(item => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Create a map of items to their new positions
        const newList = arrayMove([...sameParentItems], oldIndex, newIndex);
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

          // Update project timestamp so it appears at the top of the dashboard
          await updateProjectTimestamp(projectId);

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
    } else {
      // Different parent case - change parent and reorder
      const newParentId = overItem.parent_id;
      const sourceParentItems = items.filter(item => item.parent_id === activeItem.parent_id && item.id !== activeItem.id);
      const targetParentItems = items.filter(item => item.parent_id === newParentId);
      
      // Find the position in the new parent's list
      const overIndex = targetParentItems.findIndex(item => item.id === over.id);
      
      try {
        // 1. Update the dragged item's parent_id and position
        await supabase
          .from("items")
          .update({ 
            parent_id: newParentId,
            position: overIndex + 1.5 // Put it between items initially
          })
          .eq("id", activeItem.id);
        
        // 2. Update positions for all items in the new parent
        const newTargetItems = [
          ...targetParentItems.slice(0, overIndex + 1),
          { ...activeItem, parent_id: newParentId },
          ...targetParentItems.slice(overIndex + 1)
        ];
        
        const positionUpdates = newTargetItems.map((item, index) => ({
          id: item.id,
          position: index + 1,
        }));
        
        for (const update of positionUpdates) {
          await supabase
            .from("items")
            .update({ position: update.position })
            .eq("id", update.id);
        }
        
        // 3. Update positions for all items in the old parent
        const sourcePositionUpdates = sourceParentItems.map((item, index) => ({
          id: item.id,
          position: index + 1,
        }));
        
        for (const update of sourcePositionUpdates) {
          await supabase
            .from("items")
            .update({ position: update.position })
            .eq("id", update.id);
        }
        
        // Update project timestamp so it appears at the top of the dashboard
        await updateProjectTimestamp(projectId);
        
        // Refresh data after all updates
        queryClient.invalidateQueries({ queryKey: ["items", projectId] });
        toast({ title: "Item moved successfully" });
      } catch (error) {
        console.error("Error moving item:", error);
        toast({
          title: "Failed to move item",
          variant: "destructive"
        });
      }
    }
  }

  // Only render the DndContext once at the root level
  if (parentId === null) {
    return (
      <DragContext.Provider value={{ activeId, setActiveId, projectId, allItems: items }}>
        {/* Add root item form in focus mode */}
        {focusMode && (
          <div className="mb-4">
            {addingRootItem ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addRootItem();
                }}
                className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full"
              >
                <Textarea
                  className="flex-grow min-h-[40px] resize-none overflow-hidden"
                  placeholder="New Task (or '- ' for Note)..."
                  value={rootItemContent}
                  autoFocus
                  onChange={(e) => setRootItemContent(e.target.value)}
                  onKeyDown={(e) => {
                    // Only submit with Ctrl+Enter, normal Enter adds a new line
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (rootItemContent.trim()) {
                        addRootItem();
                      }
                    } else if (e.key === "Escape") {
                      setAddingRootItem(false);
                      setRootItemContent("");
                    }
                  }}
                  onBlur={() => {
                    if (!rootItemContent.trim()) {
                      setAddingRootItem(false);
                    }
                  }}
                />
                <Button type="submit">Add</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddingRootItem(false);
                    setRootItemContent("");
                  }}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <Button
                onClick={() => setAddingRootItem(true)}
                className="mb-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add New Item
              </Button>
            )}
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
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
                  parentCollapsed={isCollapsed} // Pass the global collapse state directly
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </DragContext.Provider>
    );
  }

  // For child lists, just render the items without another DndContext
  return (
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
  );
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

  const { activeId } = useContext(DragContext);
  const isActive = activeId === id;
  
  // Check if this item has children
  const hasChildren = allItems.some(i => i.parent_id === item.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <li 
      className={`border-b pb-2 last:border-b-0 ${isActive ? 'opacity-50' : ''} relative`}
    >
      <div
        ref={setNodeRef}
        style={style}
        className={`flex gap-2 items-start w-full ${isDragging ? 'bg-muted/60 rounded-md' : ''}`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab mt-2 text-muted-foreground hover:text-foreground flex items-center h-6 w-6 justify-center"
          title="Drag to reorder. Drag onto an item with children to nest, or hold Shift while dragging to make it a child of another item."
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
      
      {/* Add visual indicator to show that an item can be a drop target for children */}
      {hasChildren && (
        <div 
          className={`absolute top-0 left-0 w-full h-full pointer-events-none
            ${activeId && activeId !== id ? 'border-2 border-dashed border-transparent hover:border-primary-300 rounded-lg' : ''}`}
        />
      )}
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
  
  // Use the global Alt key state instead of tracking it per item
  const isAltPressed = useAltKey();
  
  // Keep tracking hover state at the item level
  const [isHovered, setIsHovered] = useState(false);

  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const prevEditing = useRef(editing); // Ref to track previous editing state

  const [addingChild, setAddingChild] = useState(false);
  const [childContent, setChildContent] = useState("");
  const [childChecklist, setChildChecklist] = useState(false);
  
  // Initialize isCollapsed from localStorage or parent state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // When parentCollapsed is true, we force this item to be collapsed
    if (parentCollapsed) return true;
    
    // Otherwise, check localStorage for saved state
    return getChildInitialCollapsed(projectId, item.id);
  });
  
  // Save collapse state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(getItemCollapseKey(projectId, item.id), isCollapsed.toString());
  }, [isCollapsed, projectId, item.id]);

  // State for confirmation dialog
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if this item has children
  const hasChildren = allItems.some(i => i.parent_id === item.id);

  // Effect to sync with parent collapse state changes
  useEffect(() => {
    // Explicitly check for both true and false cases to ensure bidirectional sync
    if (parentCollapsed === true) {
      setIsCollapsed(true);
    } else if (parentCollapsed === false) {
      setIsCollapsed(false);
    }
  }, [parentCollapsed]);
  
  // Function to toggle collapse state
  const toggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    setIsCollapsed(prevState => !prevState);
  }, []);

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

  // Mutation for updating item content specifically
  const updateContentMutation = useMutation({
    mutationFn: async (newContent: string) => {
      // URL/prefix logic isn't needed when just updating content
      const { error } = await supabase
        .from("items")
        .update({ content: newContent })
        .eq("id", item.id);
      if (error) throw error;
      await updateProjectTimestamp(projectId);
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
      await updateProjectTimestamp(projectId);
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
      await updateProjectTimestamp(projectId);
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
        await updateProjectTimestamp(projectId);
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
          await updateProjectTimestamp(projectId);
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
          await updateProjectTimestamp(projectId);
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
    try {
      // First get all descendant IDs to delete their attachments too
      const descendantIds = getAllDescendantIds(item.id, allItems);
      const allIdsToDelete = [item.id, ...descendantIds];
      
      // 1. Delete all attachments for this item and its descendants
      const { error: attachmentError } = await supabase
        .from("item_attachments")
        .delete()
        .in("item_id", allIdsToDelete);
        
      if (attachmentError) {
        console.error("Error deleting attachments:", attachmentError);
        toast({ 
          title: "Warning", 
          description: "Item deleted but some attachments may not have been removed.",
          variant: "destructive" 
        });
      }
      
      // 2. For any image attachments, also delete the actual files from storage
      // Get all image attachments first
      const { data: imageAttachments } = await supabase
        .from("item_attachments")
        .select("url")
        .in("item_id", allIdsToDelete)
        .eq("attachment_type", "image");
        
      if (imageAttachments && imageAttachments.length > 0) {
        // Extract file paths from URLs to delete from storage
        const filePaths = imageAttachments
          .map(att => {
            try {
              // Extract the path portion from the URL
              // URLs should be in format like: https://[bucket].supabase.co/storage/v1/object/public/[path]
              const url = new URL(att.url);
              const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)/);
              return pathMatch ? pathMatch[1] : null;
            } catch (e) {
              console.error("Error parsing attachment URL:", e);
              return null;
            }
          })
          .filter(Boolean); // Remove any null entries
          
        // Delete files from storage if paths were extracted
        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('attachments') // Replace with your actual bucket name if different
            .remove(filePaths);
            
          if (storageError) {
            console.error("Error deleting files from storage:", storageError);
          }
        }
      }
      
      // 3. Finally delete the items (including descendants)
      const { error } = await supabase
        .from("items")
        .delete()
        .in("id", allIdsToDelete);
        
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        await updateProjectTimestamp(projectId);
        queryClient.invalidateQueries({ queryKey: ["items", projectId] });
        toast({ title: "Item deleted", description: "Item and all its attachments have been removed." });
      }
    } catch (error) {
      console.error("Error in delete process:", error);
      toast({ 
        title: "Error deleting item", 
        description: "An unexpected error occurred", 
        variant: "destructive" 
      });
    }
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
    await updateProjectTimestamp(projectId);
    queryClient.invalidateQueries({ queryKey: ["items", projectId] });
    setChildContent("");
    setAddingChild(false);
  }

  function cancelEdit() {
    setContent(item.content);
    setEditing(false);
  }

  return (
    <div 
      className="flex flex-col w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-2 items-start w-full">
        {hasChildren && (
          <button
            onClick={toggleCollapse}
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
            {editing ? (
              <div className="relative">
                <Textarea
                  ref={editTextAreaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[40px] p-2 resize-none overflow-hidden"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (content.trim()) {
                        updateContentMutation.mutate(content);
                      }
                    } else if (e.key === "Escape") {
                      cancelEdit();
                    }
                  }}
                  onBlur={() => {
                    if (content.trim() !== item.content) {
                      updateContentMutation.mutate(content);
                    } else {
                      setEditing(false);
                    }
                  }}
                />
                <div className="flex justify-end mt-2 gap-2">
                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => updateContentMutation.mutate(content)}
                    disabled={!content.trim() || updateContentMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <span
                  className={`${(item.is_completed && item.is_checklist) ? "line-through text-muted-foreground" : ""} cursor-pointer flex-grow whitespace-pre-wrap pt-1 min-w-0 pr-6 hover:bg-muted/20 rounded ${focusMode ? "hover:after:content-['Alt+Hover_to_show_options'] hover:after:absolute hover:after:right-2 hover:after:top-1 hover:after:text-xs hover:after:opacity-50" : ""}`}
                  onClick={() => setEditing(true)}
                >
                  {item.content}
                </span>
                
                {/* Add floating "+" button for all items */}
                {!editing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-5 w-5 p-0 rounded-full bg-primary/10 hover:bg-primary/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingChild(!addingChild);
                      if (addingChild) {
                        setChildContent("");
                      }
                    }}
                    title="Add sub-item"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Only show attachments when not in focus mode and this item itself is not collapsed */}
          {!editing && !focusMode && item.item_attachments && item.item_attachments.length > 0 && (
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

          {/* Action buttons shown when not in focus mode OR when Alt is pressed AND this specific item is hovered */}
          {(!focusMode || (focusMode && isAltPressed && isHovered)) && !editing && (
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

          {/* Show child form */}
          {addingChild && (
            <form
              onSubmit={e => {
                e.preventDefault();
                addChild();
              }}
              className="flex gap-2 items-center pl-3 ml-0 mt-2 border-l-2 border-blue-200"
            >
              <Textarea
                className="min-h-[40px] p-2 resize-none overflow-hidden"
                placeholder="New Task (or '- ' for Note)..."
                value={childContent}
                autoFocus
                onChange={e => setChildContent(e.target.value)}
                onKeyDown={e => {
                  // Only submit with Ctrl+Enter, normal Enter adds a new line
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (childContent.trim()) {
                      addChild();
                    }
                  } else if (e.key === "Escape") {
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

      {/* Show nested items only when this item is not collapsed */}
      {!isCollapsed && hasChildren && (
        <div className="mt-3 pl-3 border-l-2 border-blue-200">
          <ItemList
            items={allItems}
            projectId={projectId}
            parentId={item.id}
            parentCollapsed={false}
          />
        </div>
      )}
    </div>
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
