import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Zap, Brain, Compass, LineChart } from 'lucide-react';

interface LandingPageProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  onDecode: () => void;
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  error: string | null;
}

import { FloatingPaths } from './ui/background-paths';

export const SparkleButton = ({ children, onClick, className = '' }: any) => {
  const [particles, setParticles] = useState<{id: number, x: number, y: number}[]>([]);

  const triggerSparkles = () => {
    const newParticles = Array.from({ length: 6 }).map((_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1000);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      onMouseEnter={triggerSparkles}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
    >
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, scale: Math.random() * 1.5 + 0.5 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-black rounded-full pointer-events-none"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
      ))}
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  );
};

const FeatureCard = ({ icon: Icon, title, desc, delay, className = '' }: any) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`editorial-card relative overflow-hidden group ${className}`}
    >
      {/* Border Beam / Spotlight */}
      <motion.div
        animate={{ opacity: isHovered ? 1 : 0 }}
        className="absolute inset-0 border-2 border-primary/20 pointer-events-none transition-opacity duration-300"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
        <div className="w-12 h-12 border border-black/10 rounded-full flex items-center justify-center bg-white group-hover:scale-110 transition-transform duration-500">
          <Icon size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="font-serif italic text-2xl mb-2">{title}</h3>
          <p className="font-sans text-xs text-muted leading-relaxed uppercase tracking-wider">{desc}</p>
        </div>
      </div>
    </motion.div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({
  repoUrl,
  setRepoUrl,
  onDecode,
  getRootProps,
  getInputProps,
  isDragActive,
  error
}) => {
  return (
    <div className="relative w-full min-h-screen pb-32">
      {/* Background with Stars and Waves */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[0] opacity-60">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
        {/* Layered Mountain / Wave Silhouette */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-x-0 bottom-0 h-3/4 flex items-end justify-center opacity-10"
        >
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full min-w-[1200px]" preserveAspectRatio="none" style={{ height: "40vh" }}>
            <path fill="currentColor" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full min-w-[1200px]" preserveAspectRatio="none" style={{ height: "60vh", opacity: 0.5 }}>
            <path fill="currentColor" d="M0,160L60,149.3C120,139,240,117,360,133.3C480,149,600,203,720,208C840,213,960,171,1080,144C1200,117,1320,107,1380,101.3L1440,96L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
          </svg>
        </motion.div>
      </div>

      {/* Main Content Layout similar to screenshot */}
      <div className="relative z-10 w-full h-screen flex flex-col pt-32 px-6">
        {/* Hero Top Title */}
        <div className="text-center space-y-4 max-w-4xl mx-auto flex-1 mt-[10vh]">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl lg:text-6xl font-serif text-primary"
          >
            The Repository Intelligence Core,
          </motion.h1>
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-3xl lg:text-4xl font-serif text-teal-600 drop-shadow-sm"
          >
            empowering your engineering journey.
          </motion.h2>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 space-y-16 lg:pl-32">
        {/* Input Section */}
        <section className="max-w-2xl mx-auto w-full">
          <div className="editorial-card bg-white/80 backdrop-blur-md text-left space-y-10 shadow-2xl shadow-black/5 border-black/10">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="text-editorial-label italic">Source Input</span>
                <div className="h-px flex-1 bg-black/5" />
              </div>
              <div className="flex flex-col md:flex-row gap-0 border border-black/10">
                <input
                  type="text"
                  placeholder="github.com/user/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="flex-1 bg-white/50 px-6 py-4 font-sans text-xs outline-none focus:bg-white transition-colors placeholder:opacity-30 border-r border-black/10"
                />
                <SparkleButton
                  onClick={onDecode}
                  className="btn-editorial md:w-auto w-full border-none px-10 py-4 font-sans text-[11px] uppercase tracking-[0.2em]"
                >
                  PROCESS
                </SparkleButton>
              </div>
            </div>

            <div
              {...getRootProps()}
              className={`h-40 w-full border border-dashed border-black/20 flex flex-col items-center justify-center bg-white/50 cursor-pointer transition-all
                ${isDragActive ? 'bg-primary/5 border-primary/40' : 'hover:bg-white hover:border-black/30'}`}
            >
              <input {...getInputProps()} />
              <span className="text-editorial-label italic opacity-40">Drop archive here</span>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-2xl mx-auto text-red-600 font-sans text-[10px] uppercase tracking-widest italic mt-6 text-center"
            >
              Error: {error}
            </motion.p>
          )}
        </section>

        {/* Feature Grid (Bento) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16">
          <FeatureCard
            icon={Zap}
            title="Rapid Ingestion"
            desc="Millisecond processing using optimized vector techniques."
            delay={0}
            className="md:col-span-2 min-h-[220px] bg-white/80 backdrop-blur-md"
          />
          <FeatureCard
            icon={Brain}
            title="Contextual AI"
            desc="Advanced logic explanation and mapping."
            delay={0.1}
            className="md:col-span-1 min-h-[220px] bg-white/80 backdrop-blur-md"
          />
          <FeatureCard
            icon={Compass}
            title="Node Mapping"
            desc="Navigable visual layouts."
            delay={0.2}
            className="md:col-span-1 min-h-[220px] bg-white/80 backdrop-blur-md"
          />
          <FeatureCard
            icon={LineChart}
            title="Metrics Overview"
            desc="Holistic analysis of codebase structure."
            delay={0.3}
            className="md:col-span-2 min-h-[220px] bg-white/80 backdrop-blur-md"
          />
        </section>
      </div>
    </div>
  );
};

