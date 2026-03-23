
import React from 'react';
import { motion } from 'framer-motion';

const LiveBackground: React.FC = () => {
  // Generate fewer random stars for better performance
  const stars = React.useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 1.5 + 0.5,
    duration: Math.random() * 5 + 5,
    delay: Math.random() * 5,
  })), []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-gradient-to-br from-emerald-950 via-[#0f1f1a] to-[#061410]">
      {/* Stars */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute bg-white rounded-full opacity-10"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animation: `pulse ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.2); }
        }
      `}</style>

      {/* Helal (Crescent Moon) */}
      <motion.div
        className="absolute top-20 right-20 md:top-32 md:right-32 opacity-10 dark:opacity-20"
        initial={{ rotate: -10, x: 20, y: -20 }}
        animate={{ 
          rotate: [10, -10, 10],
          x: [0, 20, 0],
          y: [0, -20, 0]
        }}
        transition={{
          duration: 40,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M50 10C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C61.0457 90 71.0457 85.5228 78.2843 78.2843C65.1371 83.2843 50 73.2843 50 50C50 26.7157 65.1371 16.7157 78.2843 21.7157C71.0457 14.4772 61.0457 10 50 10Z" 
            fill="white" 
            className="drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          />
        </svg>
      </motion.div>

      {/* Subtle moving light blobs */}
      <motion.div
        className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-emerald-900/10 rounded-full blur-[120px]"
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <motion.div
        className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-emerald-800/10 rounded-full blur-[120px]"
        animate={{
          x: [0, -80, 0],
          y: [0, 100, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
};

export default LiveBackground;
