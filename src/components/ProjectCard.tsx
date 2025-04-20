
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Project } from "@/types/project";
import { Link } from "react-router-dom";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle>{project.title}</CardTitle>
          {project.description && (
            <CardDescription>{project.description}</CardDescription>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}
