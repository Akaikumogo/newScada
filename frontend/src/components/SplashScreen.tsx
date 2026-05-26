import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const telemetryItems = [
  'IEC-104 LINK',
  'M_ME_TF_1',
  'AI_644',
  '220kV LINE',
  '500kV BUS',
  'IA=245.2A',
  'IB=244.8A',
  'IC=246.1A',
  'UAB=220.4kV',
  'P=421MW',
  'Q=36MVAr',
  'F=50.00Hz',
  'COSφ=0.98',
  'BREAKER: ON',
  'DISCONNECTOR: CLOSED',
  'RELAY READY',
  'OIK SERVER',
  'RTU CONNECTED',
  'SUBSTATION SYNC',
  'ALARM BUFFER',
  'TELEMETRY STREAM',
  'SYSTEM LINK ESTABLISHED'
];

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function ScadaOikSplash({ onFinish }: { onFinish?: () => void }) {
  const [phase, setPhase] = useState<'stream' | 'blast' | 'title'>('stream');

  const packets = useMemo(() => {
    return Array.from({ length: 70 }).map((_, i) => ({
      id: i,
      text: telemetryItems[i % telemetryItems.length],
      x: random(-650, 650),
      y: random(-360, 360),
      delay: random(0, 1.8),
      duration: random(2.2, 3.4),
      size: random(10, 16)
    }));
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('blast'), 3200);
    const t2 = setTimeout(() => setPhase('title'), 3900);
    const t3 = setTimeout(() => onFinish?.(), 7200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#020617] text-cyan-300">
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.07)_1px,transparent_1px)] bg-[size:42px_42px]" />

      {/* Scanline */}
      <motion.div
        className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/20 to-transparent blur-xl"
        animate={{ y: ['-20%', '120vh'] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
      />

      {/* Center energy */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_80px_25px_rgba(34,211,238,.8)]"
        animate={{
          scale: phase === 'blast' ? [1, 8, 28] : [1, 1.5, 1],
          opacity: phase === 'title' ? 0 : [0.4, 1, 0.5]
        }}
        transition={{ duration: phase === 'blast' ? 0.7 : 1.2 }}
      />

      {/* Telemetry packets */}
      <div className="absolute left-1/2 top-1/2">
        {packets.map((p) => (
          <motion.div
            key={p.id}
            className="absolute whitespace-nowrap font-mono font-semibold text-cyan-200/80 drop-shadow-[0_0_10px_rgba(34,211,238,.9)]"
            style={{ fontSize: p.size }}
            initial={{
              x: p.x,
              y: p.y,
              opacity: 0,
              scale: 0.6,
              filter: 'blur(2px)'
            }}
            animate={{
              x: 0,
              y: 0,
              opacity:
                phase === 'stream' ? [0, 1, 1, 0.2] : phase === 'blast' ? 0 : 0,
              scale: phase === 'stream' ? [0.6, 1, 0.8, 0.1] : 0,
              filter:
                phase === 'stream'
                  ? ['blur(2px)', 'blur(0px)', 'blur(0px)', 'blur(6px)']
                  : 'blur(10px)'
            }}
            transition={{
              delay: p.delay,
              duration: p.duration,
              ease: 'easeInOut'
            }}
          >
            {p.text}
          </motion.div>
        ))}
      </div>

      {/* Electric rings */}
      <AnimatePresence>
        {phase !== 'title' && (
          <motion.div
            className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/40"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.4, 1.5, 2.4], opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* Title */}
      <AnimatePresence>
        {phase === 'title' && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.h1
              className="text-center text-6xl font-black tracking-[0.22em] text-cyan-100 drop-shadow-[0_0_35px_rgba(34,211,238,1)] md:text-8xl"
              initial={{ scale: 0.4, opacity: 0, letterSpacing: '1em' }}
              animate={{ scale: 1, opacity: 1, letterSpacing: '0.22em' }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              SCADA OIK
            </motion.h1>

            <motion.div
              className="mt-8 h-[2px] w-[520px] max-w-[80vw] bg-cyan-300 shadow-[0_0_25px_#22d3ee]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            />

            <motion.p
              className="mt-6 font-mono text-sm tracking-[0.45em] text-cyan-300/90"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: [0, 1, 0.5, 1], y: 0 }}
              transition={{ delay: 1.1, duration: 1.2 }}
            >
              SYSTEM LINK ESTABLISHED
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom status */}
      <div className="absolute bottom-6 left-6 font-mono text-xs text-cyan-300/60">
        OIK CORE / IEC-104 / RTU / TELEMETRY / GRID ONLINE
      </div>
    </div>
  );
}
