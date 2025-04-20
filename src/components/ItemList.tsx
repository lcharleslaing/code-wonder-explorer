
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Item } from "@/types/project";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useState } from "react";
import { SquareCheck, Pencil, FileText, ListCheck } from "lucide-react";

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

  const [addingChild, setAddingChild] = useState(false);
  const [childContent, setChildContent] = useState("");
  const [childChecklist, setChildChecklist] = useState(false);

  // Update item content/completion
  async function updateItem(fields: Partial<Item>) {
    const { error } = await supabase
      .from("items")
      .update(fields)
      .eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["items", projectId] });
    setEditing(false);
  }

  // Toggle checklist completion
  async function toggleComplete() {
    await updateItem({ is_completed: !item.is_completed });
  }

  // Delete item
  async function deleteItem() {
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["items", projectId] });
  }

  // Add child note/checklist item
  async function addChild() {
    if (!childContent.trim()) return;
    const { error } = await supabase.from("items").insert([
      {
        content: childContent,
        project_id: projectId,
        is_checklist: childChecklist,
        parent_id: item.id,
        position: (allItems.filter(i => i.parent_id === item.id).length ?? 0) + 1,
      },
    ]);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["items", projectId] });
    setChildContent("");
    setChildChecklist(false);
    setAddingChild(false);
  }

  return (
    <div>
      <div className="flex gap-2 items-center">
        {item.is_checklist ? <ListCheck className="text-violet-500" /> : <FileText className="text-blue-600" />}
        {editing ? (
          <>
            <input
              className="border rounded px-2 py-1 text-sm"
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
              onBlur={() => setEditing(false)}
              onKeyDown={e => {
                if (e.key === "Enter") updateItem({ content });
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateItem({ content })}
            >
              Save
            </Button>
          </>
        ) : (
          <>
            <span className={item.is_completed ? "line-through text-muted-foreground" : ""}>{item.content}</span>
            {item.is_checklist && (
              <button
                aria-label="Toggle complete"
                className={
                  "ml-2 rounded-full p-1 border " +
                  (item.is_completed ? "bg-green-300" : "bg-gray-100")
                }
                onClick={toggleComplete}
              >
                <SquareCheck className="w-4 h-4" />
              </button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={deleteItem}>🗑️</Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2"
          onClick={() => setAddingChild(!addingChild)}
        >
          + Add child
        </Button>
      </div>
      {addingChild && (
        <form
          onSubmit={e => {
            e.preventDefault();
            addChild();
          }}
          className="flex gap-2 items-center ml-6 mt-2"
        >
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="Child note/checklist"
            value={childContent}
            onChange={e => setChildContent(e.target.value)}
          />
          <label className="text-xs flex gap-1 items-center cursor-pointer">
            <input
              type="checkbox"
              checked={childChecklist}
              onChange={e => setChildChecklist(e.target.checked)}
              className="accent-primary"
            />
            Checklist
          </label>
          <Button type="submit" size="sm">Add</Button>
        </form>
      )}
      {/* Recursively render children */}
      <div className="ml-6 mt-3">
        <ItemList items={allItems} projectId={projectId} parentId={item.id} />
      </div>
    </div>
  );
}
