import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Project, Item } from "@/types/project";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Import the default logo path
const DEFAULT_LOGO = "/logo.png";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedProject, setEditedProject] = useState({
    title: project.title,
    description: project.description || ""
  });
  const queryClient = useQueryClient();

  // Function to get the thumbnail URL from the project's items
  const getThumbnail = () => {
    // Find an item with image attachments
    if (!project.items) return DEFAULT_LOGO;

    for (const item of project.items) {
      if (item.item_attachments && item.item_attachments.length > 0) {
        const imageAttachment = item.item_attachments.find(
          attachment => attachment.attachment_type === 'image'
        );

        if (imageAttachment) {
          return imageAttachment.url;
        }
      }
    }

    return DEFAULT_LOGO;
  };

  const thumbnailUrl = getThumbnail();
  const isDefaultLogo = thumbnailUrl === DEFAULT_LOGO;

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          title: editedProject.title,
          description: editedProject.description || null
        })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project updated successfully!",
      });

      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      // Step 1: Fetch all items for this project if not already available
      let itemsToDelete = project.items || [];

      if (!itemsToDelete.length) {
        const { data: fetchedItems, error: fetchError } = await supabase
          .from("items")
          .select("*")
          .eq("project_id", project.id);

        if (fetchError) throw fetchError;
        itemsToDelete = fetchedItems as Item[];
      }

      // Step 2: Delete all item attachments
      if (itemsToDelete.length > 0) {
        const itemIds = itemsToDelete.map(item => item.id);

        // Delete all attachments for these items
        const { error: attachmentError } = await supabase
          .from("item_attachments")
          .delete()
          .in("item_id", itemIds);

        if (attachmentError) throw attachmentError;
      }

      // Step 3: Delete all items
      if (itemsToDelete.length > 0) {
        const { error: itemsError } = await supabase
          .from("items")
          .delete()
          .eq("project_id", project.id);

        if (itemsError) throw itemsError;
      }

      // Step 4: Finally delete the project
      const { error: projectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (projectError) throw projectError;

      toast({
        title: "Success",
        description: "Project deleted successfully!",
      });

      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Stop event propagation for buttons to prevent navigation
  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <Link to={`/projects/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <Card style={{ cursor: 'pointer', height: 300, display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 8, transition: 'background 0.2s' }}>
          <CardHeader style={{ flexShrink: 0 }}>
            <CardTitle style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 20 }}>{project.title}</CardTitle>
            {project.description && (
              <CardDescription style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontSize: 14 }}>{project.description}</CardDescription>
            )}
          </CardHeader>

          <CardContent style={{ flexGrow: 1, overflow: 'hidden' }}>
            <div style={{ width: '100%', height: 128, overflow: 'hidden', borderRadius: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fafafa' }}>
              <img
                src={thumbnailUrl}
                alt={`Thumbnail for ${project.title}`}
                style={isDefaultLogo
                  ? { height: '100%', width: 'auto', maxHeight: 128, objectFit: 'contain' }
                  : { width: '100%', height: '100%', objectFit: 'cover' }
                }
              />
            </div>
          </CardContent>

          <CardFooter style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <Button
              style={{ flex: 1 }}
              onClick={(e) => {
                handleButtonClick(e);
                setIsEditDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              style={{ flex: 1, color: '#d32f2f', background: 'none', border: '1px solid #d32f2f' }}
              onClick={(e) => {
                handleButtonClick(e);
                setIsDeleteDialogOpen(true);
              }}
            >
              Delete
            </Button>
          </CardFooter>
        </Card>
      </Link>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input
              placeholder="Project title"
              value={editedProject.title}
              onChange={(e) => setEditedProject(prev => ({ ...prev, title: e.target.value }))}
              required
            />
            <Textarea
              placeholder="Project description (optional)"
              value={editedProject.description}
              onChange={(e) => setEditedProject(prev => ({ ...prev, description: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!editedProject.title}>
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project
              "{project.title}" and all of its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
