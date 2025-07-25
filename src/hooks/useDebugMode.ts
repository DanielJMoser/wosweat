import { useState, useEffect } from 'react';

/**
 * Custom hook for debug mode functionality
 * Activated by Ctrl+Shift+D keyboard shortcut
 * Follows Clean Code: Single Responsibility, meaningful names
 */
export const useDebugMode = () => {
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+D combination
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault(); // Prevent any default browser behavior
        
        setIsDebugMode(prevMode => {
          const newMode = !prevMode;
          console.log(`Debug mode ${newMode ? 'enabled' : 'disabled'}`);
          
          // Optional: Store in localStorage for persistence
          localStorage.setItem('wosweat-debug-mode', String(newMode));
          
          return newMode;
        });
      }
    };

    // Check localStorage on initial load
    const storedDebugMode = localStorage.getItem('wosweat-debug-mode');
    if (storedDebugMode === 'true') {
      setIsDebugMode(true);
      console.log('Debug mode restored from localStorage');
    }

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Function to manually toggle debug mode (for programmatic access)
  const toggleDebugMode = () => {
    setIsDebugMode(prev => !prev);
  };

  // Function to disable debug mode
  const disableDebugMode = () => {
    setIsDebugMode(false);
    localStorage.removeItem('wosweat-debug-mode');
  };

  return {
    isDebugMode,
    toggleDebugMode,
    disableDebugMode
  };
};