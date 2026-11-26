import React, { useEffect, useRef, useState } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function CyberHero() {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [images, setImages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeBeat, setActiveBeat] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const frameCount = 192;

  useEffect(() => {
    let settledCount = 0;
    const loadedImages = [];

    const markSettled = () => {
      settledCount += 1;
      if (settledCount >= frameCount) {
        setLoaded(true);
      }
    };

    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      const frameNum = i.toString().padStart(5, "0");
      img.src = `/video_sequence/${frameNum}.jpg`;

      img.onload = () => {
        if (i === 1) {
          setLoaded(true);
        }
        markSettled();
      };

      img.onerror = () => {
        markSettled();
        if (i === 1) {
          setLoaded(true);
        }
      };
      loadedImages.push(img);
    }

    setImages(loadedImages);

    const fallbackTimer = setTimeout(() => {
      setLoaded(true);
    }, 4000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    if (!images.length || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const render = (frameIndex) => {
      const img = images[frameIndex];
      if (!img || !img.complete) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);

      // "use the full width of the window" -> simulate 'cover' fit instead of 'contain'
      const hRatio = window.innerWidth / img.width;
      const vRatio = window.innerHeight / img.height;
      const ratio = Math.max(hRatio, vRatio);

      const centerShift_x = (window.innerWidth - img.width * ratio) / 2;
      const centerShift_y = (window.innerHeight - img.height * ratio) / 2;

      // Hex #020202 background for seamless blending
      ctx.fillStyle = "#020202";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      ctx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        centerShift_x,
        centerShift_y,
        img.width * ratio,
        img.height * ratio,
      );
    };

    // Initial render
    if (images[0] && images[0].complete) {
      render(0);
    } else {
      images[0].onload = () => render(0);
    }

    const unsubscribe = scrollYProgress.onChange((v) => {
      const frameIndex = Math.min(frameCount - 1, Math.floor(v * frameCount));
      requestAnimationFrame(() => render(frameIndex)); // Strictly track active beat to manually unmount others
      if (v < 0.16) {
        setActiveBeat(0);
      } else {
        setActiveBeat(1);
      }
    });

    const handleResize = () => {
      render(
        Math.min(
          frameCount - 1,
          Math.floor(scrollYProgress.get() * frameCount),
        ),
      );
    };

    window.addEventListener("resize", handleResize);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", handleResize);
    };
  }, [images, scrollYProgress]);

  // Scroll mapping for text overlays
  // 0% Scroll
  const opacity0 = useTransform(
    scrollYProgress,
    [0, 0.08, 0.13, 1],
    [1, 1, 0, 0],
  );
  const y0 = useTransform(scrollYProgress, [0, 0.13, 1], [0, -50, -50]);

  // Rest of Scroll (Study Smarter stays until the end)
  const opacity30 = useTransform(
    scrollYProgress,
    [0, 0.13, 0.25, 1],
    [0, 0, 1, 1],
  );
  const y30 = useTransform(scrollYProgress, [0, 0.13, 0.3, 1], [50, 50, 0, 0]);

  return (
    <div
      ref={containerRef}
      style={{
        height: "250vh",
        position: "relative",
        backgroundColor: "#020202",
      }}
      className="cyber-font"
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Grain/Noise filter overlay */}
        <div className="grain-overlay" />

        {/* Holographic Glowing bleeds overlay (subtle) */}
        <div className="hologram-bleed pointer-events-none" />

        {/* Text Overlays Container */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            padding: "2rem",
          }}
        >
          {/* Beat 1: Syllabus Overload */}
          {activeBeat === 0 && (
            <motion.div
              style={{ opacity: opacity0, y: y0, position: "absolute" }}
            >
              <h1 className="cyber-title">
                <span className="text-cyan">Syllabus</span>{" "}
                <span className="hollow-text">Overload?</span>
              </h1>
              <p className="cyber-subtext">
                Difficult to understand where to start.
              </p>
              <div className="cyber-scroll-indicator">
                <ChevronDown size={24} className="animate-bounce mx-auto" />
                <span>Scroll Sequence</span>
              </div>
            </motion.div>
          )}

          {/* Beat 2: Study Smarter (Stays until end) */}
          {activeBeat === 1 && (
            <motion.div
              style={{
                opacity: opacity30,
                y: y30,
                position: "absolute",
                pointerEvents: "auto",
              }}
            >
              <h1 className="cyber-title">
                <span className="text-cyan">Study</span>{" "}
                <span className="hollow-text">Smart</span>
              </h1>
              <p className="cyber-subtext">By using NCET Papers.</p>
              <div
                style={{
                  marginTop: "2rem",
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "center",
                }}
              >
                <Link
                  to={user ? "/dashboard" : "/register"}
                  className="cyber-btn"
                  style={{
                    background: "#06b6d4",
                    color: "#ffffff",
                    border: "none",
                    boxShadow: "0 0 20px rgba(6,182,212,0.5)",
                  }}
                >
                  Get Started{" "}
                  <ArrowRight size={18} style={{ marginLeft: "8px" }} />
                </Link>
                {!user && (
                  <Link
                    to="/login"
                    className="cyber-btn"
                    style={{
                      background: "transparent",
                      color: "#94a3b8",
                      border: "1px solid rgba(148,163,184,0.3)",
                    }}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Loading Indicator */}
        {!loaded && (
          <div
            style={{
              position: "absolute",
              bottom: "2rem",
              right: "2rem",
              color: "#6ee7b7",
              fontSize: "0.8rem",
              fontFamily: "JetBrains Mono",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(0,0,0,0.5)",
              padding: "0.5rem 1rem",
              borderRadius: "4px",
              border: "1px solid rgba(110,231,183,0.3)",
            }}
          >
            <div
              className="spinner"
              style={{
                width: "16px",
                height: "16px",
                borderWidth: "2px",
                borderColor: "rgba(110,231,183,0.2)",
                borderTopColor: "#6ee7b7",
              }}
            />
            Loading Sequence Data...
          </div>
        )}
      </div>
    </div>
  );
}
