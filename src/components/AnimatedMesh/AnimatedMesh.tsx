import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useMousePosition } from '../../hooks/useMousePosition';
import { AnimationConfig } from '../../types/ui';
import './AnimatedMesh.scss';

interface AnimatedMeshProps {
  config?: Partial<AnimationConfig>;
  className?: string;
}

/**
 * AnimatedMesh Component
 * Creates a dynamic mesh background that follows mouse movement
 * Uses GSAP for smooth, performant animations
 */
export const AnimatedMesh: React.FC<AnimatedMeshProps> = ({
  config = {},
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosition = useMousePosition();
  const [isInitialized, setIsInitialized] = useState(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const meshPointsRef = useRef<HTMLElement[]>([]);
  const linesRef = useRef<SVGLineElement[]>([]);
  const gravityWellsRef = useRef<Array<{x: number, y: number, strength: number, id: string}>>([]);
  const physicsAnimationRef = useRef<number | null>(null);

  // Default configuration with user overrides
  const meshConfig: AnimationConfig = {
    intensity: 0.5,
    speed: 2.0,
    particleCount: 15, // Reduced for better performance
    mouseInfluence: 0.2,
    gravityStrength: 300, // Enhanced gravity well strength
    maxGravityDistance: 350, // Increased maximum distance for gravity effect
    ...config
  };

  // Initialize mesh points
  useEffect(() => {
    console.log('Initializing AnimatedMesh...');
    
    if (!containerRef.current || isInitialized) return;

    const container = containerRef.current;
    const { particleCount } = meshConfig;

    console.log(`Creating ${particleCount} mesh points`);

    // Clear existing content
    container.innerHTML = '';
    meshPointsRef.current = [];
    linesRef.current = [];

    // Get container dimensions - force viewport dimensions for full coverage
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);

    // Create SVG for lines first (so it's behind points)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mesh-lines');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
      overflow: visible;
    `;
    container.appendChild(svg);
    
    console.log('SVG created and added to container');

    // Create mesh points
    for (let i = 0; i < particleCount; i++) {
      const point = document.createElement('div');
      point.className = 'mesh-point';
      point.dataset.index = i.toString();
      
      // Initial random position
      const x = Math.random() * (containerWidth - 20) + 10;
      const y = Math.random() * (containerHeight - 20) + 10;
      
      point.style.cssText = `
        position: absolute;
        width: 12px;
        height: 12px;
        background: radial-gradient(circle, #ff6b9d 0%, #c471ed 50%, #12c2e9 100%);
        border-radius: 50%;
        pointer-events: none;
        transform-origin: center center;
        left: ${x}px;
        top: ${y}px;
        z-index: 1000;
        box-shadow: 
          0 0 20px rgba(255, 107, 157, 1),
          0 0 40px rgba(196, 113, 237, 0.8),
          0 0 60px rgba(18, 194, 233, 0.6);
        border: 2px solid rgba(255, 107, 157, 0.8);
      `;

      container.appendChild(point);
      meshPointsRef.current.push(point);
      
      console.log(`Created point ${i} at ${x}, ${y}`);
    }

    setIsInitialized(true);
    console.log('AnimatedMesh initialization complete');
  }, [meshConfig.particleCount]);

  // Create floating animation with GSAP
  useEffect(() => {
    if (!isInitialized || meshPointsRef.current.length === 0) return;

    console.log('Starting GSAP animations...');

    // Kill existing timeline
    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    // Create main timeline
    timelineRef.current = gsap.timeline({ repeat: -1 });
    const points = meshPointsRef.current;
    const { intensity, speed } = meshConfig;

    // Animate each point individually
    points.forEach((point, index) => {
      // Floating animation
      gsap.to(point, {
        x: `+=${(Math.random() - 0.5) * 100 * intensity}`,
        y: `+=${(Math.random() - 0.5) * 60 * intensity}`,
        scale: 0.8 + Math.random() * 0.6,
        opacity: 0.4 + Math.random() * 0.6,
        duration: 3 + Math.random() * 2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: index * 0.2,
      });

      // Add rotation for extra visual interest
      gsap.to(point, {
        rotation: 360,
        duration: 8 + Math.random() * 4,
        ease: "none",
        repeat: -1,
      });
    });

    console.log('GSAP animations started');

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [isInitialized, meshConfig.intensity, meshConfig.speed]);

  // Gravity wells physics system
  useEffect(() => {
    if (!isInitialized || meshPointsRef.current.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const { gravityStrength = 150, maxGravityDistance = 200, mouseInfluence } = meshConfig;
    const containerRect = container.getBoundingClientRect();
    const mouseX = mousePosition.x - containerRect.left;
    const mouseY = mousePosition.y - containerRect.top;

    // Create gravity well at mouse position
    const gravityWell = {
      x: mouseX,
      y: mouseY,
      strength: gravityStrength,
      id: 'mouse'
    };

    // Physics simulation loop
    const animatePhysics = () => {
      meshPointsRef.current.forEach((point, index) => {
        const currentX = parseFloat(point.style.left) || 0;
        const currentY = parseFloat(point.style.top) || 0;

        // Calculate distance to gravity well
        const dx = gravityWell.x - (currentX + 6); // +6 for point center
        const dy = gravityWell.y - (currentY + 6);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxGravityDistance && distance > 0) {
          // Calculate gravitational force (inverse square law with enhanced damping)
          const force = Math.min(gravityWell.strength / (distance * distance + 50), 4);
          const influence = Math.max(0, 1 - distance / maxGravityDistance);
          
          // Orbital mechanics - create more pronounced circular motion
          const angle = Math.atan2(dy, dx);
          const orbitalVelocity = Math.sqrt(force * distance) * 0.05;
          
          // Add tangential velocity for stronger orbital motion
          const tangentAngle = angle + Math.PI / 2;
          const orbitalX = Math.cos(tangentAngle) * orbitalVelocity * influence;
          const orbitalY = Math.sin(tangentAngle) * orbitalVelocity * influence;
          
          // Enhanced gravitational pull
          const pullStrength = force * influence * 0.6;
          const pullX = Math.cos(angle) * pullStrength;
          const pullY = Math.sin(angle) * pullStrength;
          
          // Combine forces with stronger orbital component
          const totalX = pullX + orbitalX * 1.5;
          const totalY = pullY + orbitalY * 1.5;

          // Apply physics with more responsive animation
          gsap.to(point, {
            x: `+=${totalX}`,
            y: `+=${totalY}`,
            scale: 1.2 + influence * 1.2,
            rotation: `+=${orbitalVelocity * 40}`,
            duration: 0.05,
            ease: "power1.out",
            overwrite: "auto"
          });

          // Dramatically enhanced glow effect with distance-based intensity
          const glowIntensity = Math.max(0.5, influence * 1.5);
          const proximityBoost = Math.max(1, (maxGravityDistance - distance) / maxGravityDistance * 3);
          point.style.filter = `
            drop-shadow(0 0 ${12 + glowIntensity * 20}px rgba(255, 107, 157, ${glowIntensity * proximityBoost}))
            drop-shadow(0 0 ${24 + glowIntensity * 35}px rgba(196, 113, 237, ${glowIntensity * proximityBoost * 0.8}))
            drop-shadow(0 0 ${36 + glowIntensity * 50}px rgba(18, 194, 233, ${glowIntensity * proximityBoost * 0.6}))
            drop-shadow(0 0 ${48 + glowIntensity * 70}px rgba(255, 255, 255, ${glowIntensity * proximityBoost * 0.3}))
          `;
          
          // Add pulsing effect for very close particles
          if (distance < maxGravityDistance * 0.3) {
            gsap.to(point, {
              opacity: 0.8 + Math.sin(Date.now() * 0.01 + index) * 0.2,
              duration: 0.1,
              ease: "power1.inOut"
            });
          }
        } else {
          // Gradually reset effects when outside gravity well
          gsap.to(point, {
            scale: 1,
            opacity: 0.4 + Math.random() * 0.6,
            duration: 0.5,
            ease: "power2.out"
          });
          point.style.filter = '';
        }
      });

      // Continue animation loop
      physicsAnimationRef.current = requestAnimationFrame(animatePhysics);
    };

    // Start physics animation
    if (physicsAnimationRef.current) {
      cancelAnimationFrame(physicsAnimationRef.current);
    }
    physicsAnimationRef.current = requestAnimationFrame(animatePhysics);

    return () => {
      if (physicsAnimationRef.current) {
        cancelAnimationFrame(physicsAnimationRef.current);
      }
    };
  }, [mousePosition, isInitialized, meshConfig]);

  // Update connecting lines
  useEffect(() => {
    if (!isInitialized || !containerRef.current) return;

    const container = containerRef.current;
    const svg = container.querySelector('.mesh-lines') as SVGElement;
    if (!svg) return;

    // Clear existing lines
    svg.innerHTML = '';
    linesRef.current = [];

    const points = meshPointsRef.current;
    const maxDistance = 120;

    // Create lines between nearby points
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const point1 = points[i];
        const point2 = points[j];

        const x1 = parseFloat(point1.style.left) || 0;
        const y1 = parseFloat(point1.style.top) || 0;
        const x2 = parseFloat(point2.style.left) || 0;
        const y2 = parseFloat(point2.style.top) || 0;

        const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

        if (distance <= maxDistance) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          const opacity = Math.max(0.3, (1 - distance / maxDistance) * 0.9);
          
          line.setAttribute('x1', (x1 + 6).toString()); // +6 for point center (12px/2)
          line.setAttribute('y1', (y1 + 6).toString());
          line.setAttribute('x2', (x2 + 6).toString());
          line.setAttribute('y2', (y2 + 6).toString());
          line.setAttribute('stroke', `rgba(255, 107, 157, ${opacity})`);
          line.setAttribute('stroke-width', '3');
          line.setAttribute('stroke-linecap', 'round');
          line.setAttribute('class', 'mesh-line');
          line.style.filter = 'drop-shadow(0 0 4px rgba(255, 107, 157, 0.8))';

          svg.appendChild(line);
          linesRef.current.push(line);
          
          console.log(`Created line from (${x1 + 6}, ${y1 + 6}) to (${x2 + 6}, ${y2 + 6}) with opacity ${opacity}`);
        }
      }
    }
  }, [isInitialized]);

  // Periodic line updates
  useEffect(() => {
    if (!isInitialized) return;

    const updateLines = () => {
      const container = containerRef.current;
      const svg = container?.querySelector('.mesh-lines') as SVGElement;
      if (!svg) return;

      // Clear and recreate lines
      svg.innerHTML = '';
      linesRef.current = [];

      const points = meshPointsRef.current;
      const maxDistance = 120;

      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const point1 = points[i];
          const point2 = points[j];

          const rect1 = point1.getBoundingClientRect();
          const rect2 = point2.getBoundingClientRect();
          const containerRect = container!.getBoundingClientRect();

          const x1 = rect1.left - containerRect.left + 6;
          const y1 = rect1.top - containerRect.top + 6;
          const x2 = rect2.left - containerRect.left + 6;
          const y2 = rect2.top - containerRect.top + 6;

          const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

          if (distance <= maxDistance) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const opacity = Math.max(0.3, (1 - distance / maxDistance) * 0.9);
            
            line.setAttribute('x1', x1.toString());
            line.setAttribute('y1', y1.toString());
            line.setAttribute('x2', x2.toString());
            line.setAttribute('y2', y2.toString());
            line.setAttribute('stroke', `rgba(255, 107, 157, ${opacity})`);
            line.setAttribute('stroke-width', '3');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('class', 'mesh-line');
            line.style.filter = 'drop-shadow(0 0 4px rgba(255, 107, 157, 0.8))';

            svg.appendChild(line);
            linesRef.current.push(line);
          }
        }
      }
    };

    const interval = setInterval(updateLines, 100); // Update lines every 100ms
    return () => clearInterval(interval);
  }, [isInitialized]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!isInitialized) return;
      
      console.log('Window resized, reinitializing mesh...');
      setIsInitialized(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized]);

  // Respect user's motion preferences
  const shouldAnimate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  console.log(`AnimatedMesh render: shouldAnimate=${shouldAnimate}, isInitialized=${isInitialized}`);

  if (!shouldAnimate) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`animated-mesh ${className}`}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
};