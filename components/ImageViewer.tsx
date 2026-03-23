import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  isRTL?: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ images, initialIndex = 0, onClose, isRTL = false }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, scale]);

  const handlePrev = () => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    resetZoom();
  };

  const handleNext = () => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    resetZoom();
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!images || images.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center backdrop-blur-sm"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header Controls */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex space-x-4 rtl:space-x-reverse text-white">
            <button onClick={handleZoomOut} className="p-2 hover:bg-white/20 rounded-full transition-colors" disabled={scale === 1}>
              <i className="fas fa-search-minus"></i>
            </button>
            <button onClick={handleZoomIn} className="p-2 hover:bg-white/20 rounded-full transition-colors" disabled={scale >= 5}>
              <i className="fas fa-search-plus"></i>
            </button>
            <button onClick={resetZoom} className="p-2 hover:bg-white/20 rounded-full transition-colors" disabled={scale === 1}>
              <i className="fas fa-compress"></i>
            </button>
          </div>
          <div className="text-white/70 font-mono text-sm">
            {currentIndex + 1} / {images.length}
          </div>
          <button onClick={onClose} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); isRTL ? handleNext() : handlePrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-white hover:bg-white/20 rounded-full transition-colors z-50"
            >
              <i className="fas fa-chevron-left text-2xl"></i>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); isRTL ? handlePrev() : handleNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-white hover:bg-white/20 rounded-full transition-colors z-50"
            >
              <i className="fas fa-chevron-right text-2xl"></i>
            </button>
          </>
        )}

        {/* Image Container */}
        <div 
          className={`relative w-full h-full flex items-center justify-center overflow-hidden ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          onMouseDown={handleMouseDown}
        >
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`View ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain select-none pointer-events-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
            draggable={false}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageViewer;
