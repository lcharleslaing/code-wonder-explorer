
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

export function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      toast({ title: "Logged out", description: "You've been logged out." });
      navigate("/auth");
    } else {
      toast({ title: "Logout Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Log Out
    </Button>
  );
}
