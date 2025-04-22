import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Project } from "@/types/project";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { LayoutGrid, List } from "lucide-react";

type ViewMode = 'grid' | 'list';

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useSupabaseAuth();

  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ title: "", description: "" });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      if (!user) return [] as Project[];

      // First get all projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false })
        .eq("user_id", user.id);

      if (projectsError) throw projectsError;

      // For each project, fetch its items with their attachments
      const projectsWithItems = await Promise.all(
        (projectsData as Project[]).map(async (project) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from("items")
            .select(`
              *,
              item_attachments(*)
            `)
            .eq("project_id", project.id)
            .order("position", { ascending: true });

          if (itemsError) {
            console.error("Error fetching items for project", project.id, itemsError);
            return project;
          }

          return {
            ...project,
            items: itemsData
          };
        })
      );

      return projectsWithItems as Project[];
    },
    enabled: !!user && !authLoading,
  });

  // Redirect to /auth if not logged in, but wait for auth status check
  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  const handleCreateProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert([{
          title: newProject.title,
          description: newProject.description,
          user_id: user!.id // Must be logged in to create project
        }])
        .select();

      if (error) {
        console.error("Error creating project:", error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Project created successfully!",
      });

      setIsCreating(false);
      setNewProject({ title: "", description: "" });
      refetch();
      if (data && data.length > 0) {
        navigate(`/projects/${data[0].id}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return <div className="container mx-auto flex items-center justify-center h-[70vh]">Loading projects...</div>;
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <div className="flex items-center gap-4">
          <div className="flex border rounded-md overflow-hidden">
            <Button 
              variant={viewMode === 'grid' ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-none px-3"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Grid
            </Button>
            <Button 
              variant={viewMode === 'list' ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-none px-3"
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>Create Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  placeholder="Project title"
                  value={newProject.title}
                  onChange={(e) =>
                    setNewProject((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
                <Textarea
                  placeholder="Project description (optional)"
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
                <Button onClick={handleCreateProject} disabled={!newProject.title}>
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {projects?.map((project) => (
            <div 
              key={project.id} 
              className="border rounded-md p-4 hover:border-primary cursor-pointer flex justify-between items-center"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div>
                <h3 className="font-semibold text-lg">{project.title}</h3>
                {project.description && (
                  <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {project.items ? `${project.items.length} items` : "No items"}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={(e) => {
                e.stopPropagation();
                navigate(`/projects/${project.id}`);
              }}>
                Open
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
