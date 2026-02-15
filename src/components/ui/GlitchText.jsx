import { useState, useEffect } from 'react';
import styles from './GlitchText.module.css';

export default function GlitchText({ children, style = {} }) {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.03) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 80 + Math.random() * 120);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={styles.glitch}
      style={{
        ...style,
        transform: glitch ? `translate(${Math.random() * 3 - 1}px, ${Math.random() * 2 - 1}px)` : 'none',
        opacity: glitch ? 0.7 : 1,
        textShadow: glitch ? '2px 0 var(--color-primary), -2px 0 var(--color-primary)' : style.textShadow || 'none',
      }}
    >
      {children}
    </span>
  );
}
