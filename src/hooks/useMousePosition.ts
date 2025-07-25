import { useState, useEffect } from 'react';
import { MousePosition } from '../types/ui';

/**
 * Custom hook to track mouse position
 * Follows Clean Code principles: Single Responsibility, meaningful names
 */
export const useMousePosition = (): MousePosition => {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    let animationFrameId: number;

    const updateMousePosition = (event: MouseEvent) => {
      // Use requestAnimationFrame for smooth performance
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setMousePosition({
          x: event.clientX,
          y: event.clientY
        });
      });
    };

    // Add event listener
    window.addEventListener('mousemove', updateMousePosition);

    // Cleanup function
    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return mousePosition;
};