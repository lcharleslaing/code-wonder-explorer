import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase, uploadImage } from "@/integrations/supabase/client";
import { Item } from "@/types/project";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useState, useRef, useEffect } from "react";
import { SquareCheck, Pencil, FileText, ListCheck, Trash2, LinkIcon, Paperclip } from "lucide-react";
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

interface ItemListProps {
  items: Item[];
  projectId: string;
  parentId: string | null;
}

export default function ItemList({ items, projectId, parentId }: ItemListProps) {
  const list = items.filter(i => i.parent_id === parentId);
  return (
    <ul className="space-y-3">
      {list.map(item => (
        <li key={item.id} className="border-b pb-2 last:border-b-0">
          <ItemRow item={item} projectId={projectId} allItems={items} />
        </li>
      ))}
    </ul>
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

function ItemRow({
  item,
  projectId,
  allItems,
}: {
  item: Item;
  projectId: string;
  allItems: Item[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const prevEditing = useRef(editing); // Ref to track previous editing state

  const [addingChild, setAddingChild] = useState(false);
  const [childContent, setChildContent] = useState("");
  const [childChecklist, setChildChecklist] = useState(false);

  // State for confirmation dialog
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-col">
      <div className="flex gap-2 items-start w-full">
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
        <div className="flex-grow flex flex-col gap-1 min-w-0">
          {editing ? (
            <div className="flex-grow flex flex-col gap-1">
              <Textarea
                ref={editTextAreaRef}
                className="border rounded px-2 py-1 text-sm flex-grow resize-none overflow-hidden min-h-[40px]"
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    // Use the content update mutation
                    updateContentMutation.mutate(content);
                  }
                  if (e.key === "Escape") {
                    cancelEdit();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateContentMutation.mutate(content)}
                  disabled={updateContentMutation.isPending}
                >
                  Save (Ctrl+Enter)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelEdit}
                >
                  Cancel (Esc)
                </Button>
              </div>
            </div>
          ) : (
            <span
              className={`${(item.is_completed && item.is_checklist) ? "line-through text-muted-foreground" : ""} cursor-pointer flex-grow whitespace-pre-wrap pt-1 min-w-0`}
              onClick={() => setEditing(true)}
            >
              {item.content}
            </span>
          )}

          {/* Attachments section moved here - inside the content container */}
          {!editing && item.item_attachments && item.item_attachments.length > 0 && (
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
                    <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
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

          {/* Action buttons now below content and attachments */}
          {!editing && (
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
                onClick={() => setAddingChild(!addingChild)}
              >
                <span className="mr-1 sm:mr-1">+</span>
                <span className="hidden sm:inline">Add child</span>
              </Button>
            </div>
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

      {addingChild && (
        <form
          onSubmit={e => {
            e.preventDefault();
            addChild();
          }}
          className="flex gap-2 items-center pl-3 ml-0 mt-2 border-l-2 border-blue-200"
        >
          <Input
            className="border rounded px-2 py-1 text-sm flex-grow"
            placeholder="New Task (or '- ' for Note)..."
            value={childContent}
            onChange={e => setChildContent(e.target.value)}
          />
          <Button type="submit" size="sm">Add</Button>
        </form>
      )}
      <div className="mt-3 pl-3 border-l-2 border-blue-200">
        <ItemList items={allItems} projectId={projectId} parentId={item.id} />
      </div>
    </div>
  );
}
