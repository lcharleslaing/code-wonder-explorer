
// Show "Go to Login" or dashboard button depending on auth state
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, isLoading } = useSupabaseAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Your Blank App</h1>
        <p className="text-xl text-gray-600 mb-6">
          Start building your amazing project here!
        </p>
        {user ? (
          <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
        ) : (
          <Button onClick={() => navigate("/auth")}>Log In or Sign Up</Button>
        )}
      </div>
    </div>
  );
};

export default Index;
