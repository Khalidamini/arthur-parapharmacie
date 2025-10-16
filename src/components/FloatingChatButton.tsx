import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

const FloatingChatButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Ne pas afficher le bouton si on est déjà sur la page chat
  if (location.pathname === '/chat') {
    return null;
  }

  return (
    <Button
      onClick={() => navigate('/chat')}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50 bg-gradient-primary"
      size="icon"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
};

export default FloatingChatButton;
