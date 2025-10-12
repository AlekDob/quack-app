import { useEffect, useState } from 'react';
import './DuckAnimation.css';

const DUCK_VARIANTS = ['>°)>', '>^)>', '>·)>', '>~)>', '>´)>'];

interface Duck {
  id: number;
  variant: string;
  delay: number;
  verticalOffset: number;
}

export default function DuckAnimation() {
  const [ducks] = useState<Duck[]>(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      variant: DUCK_VARIANTS[i % DUCK_VARIANTS.length],
      delay: i * 2, // Stagger the ducks
      verticalOffset: Math.sin(i * 0.8) * 2, // Slight vertical variation
    }))
  );

  return (
    <div className="duck-animation-container">
      <div className="duck-parade">
        {ducks.map((duck) => (
          <span
            key={duck.id}
            className="duck"
            style={{
              animationDelay: `${duck.delay}s`,
              top: `calc(50% + ${duck.verticalOffset}px)`,
            }}
          >
            {duck.variant}
          </span>
        ))}
      </div>
      <p className="duck-subtitle">Quack! Start chatting to wake up the ducks...</p>
    </div>
  );
}
