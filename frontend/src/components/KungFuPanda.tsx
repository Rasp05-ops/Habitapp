import { motion, useReducedMotion } from "framer-motion";

type KungFuPandaProps = {
  variant?: "login" | "streak";
};

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 47) % 120) - 60,
  y: -25 - ((i * 31) % 85),
  delay: (i % 7) * 0.11,
  size: 3 + (i % 3) * 2,
}));

/** Original panda-inspired illustration with a choreographed motion sequence. */
export default function KungFuPanda({ variant = "login" }: KungFuPandaProps) {
  const reduced = useReducedMotion();
  const energetic = variant === "streak";
  const duration = energetic ? 1.15 : 3.8;
  const particles = energetic ? PARTICLES : PARTICLES.slice(0, 7);

  return (
    <motion.div
      className={`panda-scene panda-${variant}`}
      aria-hidden="true"
      initial={reduced ? false : { opacity: 0, scale: .55, y: 28 }}
      animate={reduced ? undefined : { opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: .75, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.span
        className="panda-aura"
        animate={reduced ? undefined : { scale: [1, 1.14, 1], opacity: [.35, .75, .35] }}
        transition={{ duration: duration * 1.35, repeat: Infinity, ease: "easeInOut" }}
      />
      {!reduced && particles.map((particle, i) => (
        <motion.i
          className="panda-particle"
          key={i}
          style={{ width: particle.size, height: particle.size }}
          initial={{ opacity: 0, x: 0, y: 12, scale: .2 }}
          animate={energetic
            ? { opacity: [0, 1, 0], x: particle.x, y: particle.y, scale: [.2, 1.2, .1] }
            : { opacity: [0, .45, 0], x: [particle.x * .35, particle.x, particle.x * .35], y: [particle.y * .2, particle.y, particle.y * .2], scale: [.2, .7, .2] }}
          transition={{ duration: energetic ? 1.2 : 2.8, delay: .35 + particle.delay, repeat: Infinity, repeatDelay: energetic ? .4 : .8, ease: "easeOut" }}
        />
      ))}
      <motion.div
        className="panda"
        animate={reduced ? undefined : energetic
          ? { y: [8, -22, -5, 4], rotate: [-4, 10, -8, 0], scale: [1, 1.08, 1.02, 1] }
          : { y: [2, -3, 2], rotate: [0, 0, 0], scale: [1, 1.025, 1] }}
        transition={{ duration, repeat: Infinity, ease: energetic ? [0.22, 1, 0.36, 1] : "easeInOut", times: energetic ? [.0, .38, .7, 1] : undefined }}
      >
        <span className="panda-ear panda-ear-left" />
        <span className="panda-ear panda-ear-right" />
        <span className="panda-head">
          <span className="panda-eye panda-eye-left"><i /></span>
          <span className="panda-eye panda-eye-right"><i /></span>
          <span className="panda-muzzle"><i /></span>
        </span>
        <span className="panda-body">
          <span className="panda-belly" />
          <motion.span
            className="panda-arm panda-arm-left"
            animate={reduced ? undefined : energetic ? { rotate: [34, 105, 26, 34] } : { rotate: [34, 48, 34] }}
            transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="panda-arm panda-arm-right"
            animate={reduced ? undefined : energetic ? { rotate: [-62, -118, -50, -62] } : { rotate: [-62, -48, -62] }}
            transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: energetic ? .08 : 0 }}
          />
          <motion.span
            className="panda-leg panda-leg-left"
            animate={reduced ? undefined : energetic ? { rotate: [20, 48, 20] } : undefined}
            transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="panda-leg panda-leg-right"
            animate={reduced ? undefined : energetic ? { rotate: [-20, -48, -20] } : undefined}
            transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: .05 }}
          />
        </span>
      </motion.div>
      <motion.span
        className="panda-swoosh panda-swoosh-one"
        animate={reduced ? undefined : energetic
          ? { opacity: [0, 1, 0], scaleX: [.3, 1.5, .5], x: [-18, 12, 24] }
          : { opacity: [0, .35, 0], scaleX: [.7, 1, .7], x: [-3, 3, -3] }}
        transition={{ duration: energetic ? duration * .8 : 2.7, repeat: Infinity, delay: .2, ease: "easeOut" }}
      />
      <motion.span
        className="panda-swoosh panda-swoosh-two"
        animate={reduced ? undefined : energetic
          ? { opacity: [0, .95, 0], scaleX: [.2, 1.35, .4], x: [16, -12, -22] }
          : { opacity: [0, .25, 0], scaleX: [.7, 1, .7], x: [3, -3, 3] }}
        transition={{ duration: energetic ? duration * .9 : 3, repeat: Infinity, delay: .55, ease: "easeOut" }}
      />
      <motion.span
        className="panda-impact"
        animate={reduced ? undefined : energetic
          ? { scale: [0, 1.2, 2.1], opacity: [0, .7, 0] }
          : { scale: [.8, 1.05, .8], opacity: [.12, .25, .12] }}
        transition={{ duration: energetic ? .9 : 3.8, repeat: Infinity, repeatDelay: energetic ? .25 : 0, ease: "easeOut" }}
      />
    </motion.div>
  );
}
