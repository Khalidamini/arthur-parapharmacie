import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface NavigationCommand {
  type: 'navigate';
  page: string;
  message?: string;
  guidance?: string;
}

interface NavigationHandlerProps {
  onNavigationCommand: (callback: (command: NavigationCommand) => void) => void;
}

export const NavigationHandler = ({ onNavigationCommand }: NavigationHandlerProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigation = (command: NavigationCommand) => {
      if (command.type === 'navigate' && command.page) {
        console.log('Navigation command received:', command);
        navigate(command.page);
      }
    };

    onNavigationCommand(handleNavigation);
  }, [navigate, onNavigationCommand]);

  return null; // This component doesn't render anything
};
