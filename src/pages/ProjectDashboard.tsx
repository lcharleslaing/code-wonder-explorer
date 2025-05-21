import { useState, useEffect } from "react";
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

  // Initialize view mode from localStorage or default to grid
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedViewMode = localStorage.getItem('dashboardViewMode');
    return (savedViewMode === 'list' || savedViewMode === 'grid') ? savedViewMode : 'grid';
  });

  // Save view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardViewMode', viewMode);
  }, [viewMode]);

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
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>Projects</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
            <Button
              style={{ borderRadius: 0, padding: '0 12px' }}
              onClick={() => setViewMode('grid')}
              disabled={viewMode === 'grid'}
            >
              <LayoutGrid style={{ height: 16, width: 16, marginRight: 4 }} />
              Grid
            </Button>
            <Button
              style={{ borderRadius: 0, padding: '0 12px' }}
              onClick={() => setViewMode('list')}
              disabled={viewMode === 'list'}
            >
              <List style={{ height: 16, width: 16, marginRight: 4 }} />
              List
            </Button>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger>
              <Button>Create Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div style={{ display: 'grid', gap: 16, padding: '16px 0' }}>
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
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects?.map((project) => (
            <div
              key={project.id}
              style={{ border: '1px solid #ccc', borderRadius: 4, padding: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div>
                <h3 style={{ fontWeight: 600, fontSize: 20 }}>{project.title}</h3>
                {project.description && (
                  <p style={{ color: '#888', fontSize: 14, marginTop: 4 }}>{project.description}</p>
                )}
                <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                  {project.items ? `${project.items.length} items` : "No items"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
