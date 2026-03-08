import { useRef, useState, useEffect, memo } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
}

const LazyImage = memo(function LazyImage({ src, alt, className }: LazyImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" } // start loading 200px before visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : undefined}
      alt={alt}
      onLoad={() => setIsLoaded(true)}
      className={cn(
        "transition-opacity duration-500",
        isLoaded ? "opacity-100" : "opacity-0",
        className
      )}
    />
  );
});

export default LazyImage;
