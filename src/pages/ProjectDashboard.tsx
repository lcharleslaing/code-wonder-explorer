
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
import { LogoutButton } from "@/components/LogoutButton";

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useSupabaseAuth();

  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ title: "", description: "" });

  // Redirect to /auth if not logged in, but wait for auth status check
  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
        .eq("user_id", user?.id);

      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });

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
    return <div>Loading projects...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <div className="flex gap-2 items-center">
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
          <LogoutButton />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
