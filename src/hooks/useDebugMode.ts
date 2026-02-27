import { useState, useEffect } from 'react';

export const useDebugMode = () => {
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setIsDebugMode(prevMode => {
          const newMode = !prevMode;
          localStorage.setItem('wosweat-debug-mode', String(newMode));
          return newMode;
        });
      }
    };

    const storedDebugMode = localStorage.getItem('wosweat-debug-mode');
    if (storedDebugMode === 'true') {
      setIsDebugMode(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const disableDebugMode = () => {
    setIsDebugMode(false);
    localStorage.removeItem('wosweat-debug-mode');
  };

  return { isDebugMode, disableDebugMode };
};
