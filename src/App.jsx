import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { X, Play, Pause, ExternalLink, ArrowRight, ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize, Minimize, Download } from 'lucide-react';
import './index.css';

/* ─── Config (values loaded from .env) ─── */
const FOLDER_ID         = import.meta.env.VITE_DRIVE_FOLDER_ID;
const API_KEY           = import.meta.env.VITE_DRIVE_API_KEY;
const DRIVE_URL         = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&key=${API_KEY}&fields=files(id,name,mimeType,webContentLink,thumbnailLink)`;
const DRIVE_FOLDER_LINK = import.meta.env.VITE_DRIVE_FOLDER_LINK;

/* ─── Animation variants ─── */
const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }
  }),
};
const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};
const scaleIn = {
  hidden:  { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

/* ─── Custom cursor ─── */
function Cursor() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);
  const pos     = useRef({ x: 0, y: 0 });
  const ring    = useRef({ x: 0, y: 0 });
  const raf     = useRef(null);

  useEffect(() => {
    const move = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.left = e.clientX + 'px';
        dotRef.current.style.top  = e.clientY + 'px';
      }
    };
    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.12;
      ring.current.y += (pos.current.y - ring.current.y) * 0.12;
      if (ringRef.current) {
        ringRef.current.style.left = ring.current.x + 'px';
        ringRef.current.style.top  = ring.current.y + 'px';
      }
      raf.current = requestAnimationFrame(animate);
    };
    const hover = () => {
      dotRef.current?.classList.add('expanded');
      ringRef.current?.classList.add('expanded');
    };
    const unhover = () => {
      dotRef.current?.classList.remove('expanded');
      ringRef.current?.classList.remove('expanded');
    };
    window.addEventListener('mousemove', move);
    document.querySelectorAll('a, button, .work-card').forEach(el => {
      el.addEventListener('mouseenter', hover);
      el.addEventListener('mouseleave', unhover);
    });
    raf.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      <div className="cursor-dot"  ref={dotRef} />
      <div className="cursor-ring" ref={ringRef} />
    </>
  );
}

/* ─── Custom Video Player ─── */
function CinematicPlayer({ src, poster }) {
  const videoRef    = useRef(null);
  const progressRef = useRef(null);
  const wrapRef     = useRef(null);
  const hideTimer   = useRef(null);

  const [playing, setPlaying]     = useState(false);
  const [muted, setMuted]         = useState(false);
  const [progress, setProgress]   = useState(0);
  const [buffered, setBuffered]   = useState(0);
  const [duration, setDuration]   = useState(0);
  const [current, setCurrent]     = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showUI, setShowUI]       = useState(true);
  const [loaded, setLoaded]       = useState(false);

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const resetHideTimer = useCallback(() => {
    setShowUI(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowUI(false), 2500);
    }
  }, [playing]);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [playing, resetHideTimer]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setProgress((v.currentTime / v.duration) * 100);
      setCurrent(v.currentTime);
    };
    const onDur = () => { setDuration(v.duration); setLoaded(true); };
    const onBuf = () => {
      if (v.buffered.length > 0) {
        setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
      }
    };
    const onEnd = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onDur);
    v.addEventListener('progress', onBuf);
    v.addEventListener('ended', onEnd);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onDur);
      v.removeEventListener('progress', onBuf);
      v.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const seek = (e) => {
    const bar = progressRef.current;
    const v   = videoRef.current;
    if (!bar || !v) return;
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  };

  const toggleFS = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFSChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`cinema-player ${showUI ? '' : 'hide-ui'}`}
      onMouseMove={resetHideTimer}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Poster / loading state */}
      {!loaded && poster && (
        <div className="cinema-poster">
          <img src={poster} alt="" referrerPolicy="no-referrer" />
          <div className="cinema-poster-play" onClick={toggle}>
            <Play size={32} color="#000" fill="#000" />
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={src}
        className="cinema-video"
        muted={muted}
        playsInline
        preload="auto"
        poster={poster}
        onClick={toggle}
        style={{ opacity: loaded ? 1 : 0 }}
      />

      {/* Big center play button */}
      {loaded && !playing && (
        <div className="cinema-big-play" onClick={toggle}>
          <Play size={40} color="#000" fill="#000" />
        </div>
      )}

      {/* Bottom controls bar */}
      <div className="cinema-controls">
        {/* Progress bar */}
        <div className="cinema-progress-wrap" ref={progressRef} onClick={seek}>
          <div className="cinema-progress-buf" style={{ width: `${buffered}%` }} />
          <div className="cinema-progress-fill" style={{ width: `${progress}%` }}>
            <div className="cinema-progress-thumb" />
          </div>
        </div>

        <div className="cinema-controls-row">
          <div className="cinema-controls-left">
            <button className="cinema-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button className="cinema-btn" onClick={() => setMuted(!muted)} aria-label="Toggle mute">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <span className="cinema-time">{fmt(current)} / {fmt(duration)}</span>
          </div>

          <div className="cinema-controls-right">
            <button className="cinema-btn" onClick={toggleFS} aria-label="Toggle fullscreen">
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  const [works,       setWorks]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);  // -1 = closed
  const [navScrolled, setNavScrolled] = useState(false);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (v) => setNavScrolled(v > 60));

  /* Build filtered media list for navigation */
  const mediaList = useMemo(() =>
    works.filter(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')),
    [works]
  );

  /* fetch drive files */
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(DRIVE_URL);
        const data = await res.json();
        if (data.files) setWorks(data.files);
      } catch (e) {
        console.error('Drive fetch failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* lock scroll when gallery open */
  const isOpen = activeIndex >= 0;
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  /* Keyboard navigation */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') setActiveIndex(-1);
      if (e.key === 'ArrowRight') setActiveIndex(i => Math.min(i + 1, mediaList.length - 1));
      if (e.key === 'ArrowLeft')  setActiveIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, mediaList.length]);

  const openByFile = useCallback((file) => {
    const idx = mediaList.findIndex(f => f.id === file.id);
    if (idx !== -1) setActiveIndex(idx);
  }, [mediaList]);

  const goPrev = () => setActiveIndex(i => Math.max(i - 1, 0));
  const goNext = () => setActiveIndex(i => Math.min(i + 1, mediaList.length - 1));

  /* Derive current media data from index */
  const activeFile = isOpen ? mediaList[activeIndex] : null;
  const activeMedia = useMemo(() => {
    if (!activeFile) return null;
    const isVideo = activeFile.mimeType.startsWith('video/');
    return {
      type:  isVideo ? 'video' : 'image',
      src:   isVideo
               ? `https://www.googleapis.com/drive/v3/files/${activeFile.id}?alt=media&key=${API_KEY}`
               : (activeFile.thumbnailLink ? activeFile.thumbnailLink.replace(/=s\d+/, '=s0') : `https://www.googleapis.com/drive/v3/files/${activeFile.id}?alt=media&key=${API_KEY}`),
      thumb: activeFile.thumbnailLink ? activeFile.thumbnailLink.replace(/=s\d+/, '=s400') : null,
      title: activeFile.name.split('.')[0],
      kind:  isVideo ? 'Video Edit' : 'Photography',
    };
  }, [activeFile]);

  return (
    <>
      <Cursor />

      {/* Ambient orbs */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />

      {/* ── Navigation ── */}
      <nav className={`nav ${navScrolled ? 'scrolled' : ''}`}>
        <a href="#hero" className="nav-logo" aria-label="Savio Joy — Home">SAVIO JOY</a>
        <ul className="nav-links">
          <li><a href="#about">About</a></li>
          <li><a href="#works">Works</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      {/* ── Hero ── */}
      <header id="hero" className="hero">
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="hero-eyebrow"
        >
          Visual Portfolio
        </motion.div>

        <motion.h1
          className="hero-title"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          SAVIO
          <span className="outline">JOY</span>
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          Video Editor &amp; Aspiring Cinematographer
        </motion.p>

        <motion.p
          className="hero-description"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          Creating visually engaging content through smooth transitions,
          music synchronisation, and a deep attention to lighting and composition.
        </motion.p>

        <motion.div
          className="hero-cta-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65 }}
        >
          <a href="#works" className="btn btn-accent">
            Explore My Work <ArrowRight size={16} />
          </a>
          <a href="#contact" className="btn btn-outline">Get In Touch</a>
        </motion.div>

        <div className="hero-scroll" aria-hidden="true">
          <div className="hero-scroll-line" />
          <span>Scroll</span>
        </div>
      </header>

      <hr className="gradient-line" />

      {/* ── About ── */}
      <section id="about">
        <div className="section">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <p className="section-label">Who I Am</p>
            <h2 className="section-title">The Filmmaker<br />Behind the Frame</h2>
          </motion.div>

          <div className="about-grid">
            {/* Left — stats */}
            <motion.div
              className="about-left"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              custom={1}
            >
              <div className="about-stat-stack">
                {[
                  { num: '7+',  label: 'Years of Self-taught Editing' },
                  { num: '50+', label: 'Projects Completed' },
                  { num: '∞',   label: 'Hours Spent on Frame Details' },
                ].map(({ num, label }) => (
                  <div key={label} className="about-stat">
                    <div className="about-stat-number">{num}</div>
                    <div className="about-stat-label">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — bio */}
            <motion.div
              className="about-right"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              custom={2}
            >
              <div className="about-text">
                <p>
                  <strong>Savio Joy</strong> is a passionate video editor and aspiring
                  cinematographer from <strong>Thrissur, Kerala</strong>. He started
                  exploring editing at the age of 15 and has since developed a strong
                  interest in visual storytelling and cinematic content creation.
                </p>
                <p>
                  He enjoys working on <strong>automotive cinematography</strong>,
                  travel videos, and short-form reel edits — including paid projects.
                  His focus is on creating engaging visuals through clean edits, smooth
                  transitions, and effective use of music and mood.
                </p>
                <p>
                  He aims to pursue <strong>Visual Communication</strong> to further
                  develop his skills in filmmaking, editing, and storytelling, gaining
                  professional exposure in the creative media field.
                </p>
              </div>

              <div className="about-tags">
                {['Automotive Cinematography', 'Travel Films', 'Reel Edits',
                  'Color Grading', 'Motion Design', 'Music Sync'].map(t => (
                  <span key={t} className="about-tag">{t}</span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <hr className="gradient-line" />

      {/* ── Works ── */}
      <section id="works">
        <div className="section">
          <div className="works-header">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <p className="section-label">Portfolio</p>
              <h2 className="section-title">Selected Works</h2>
            </motion.div>

            <motion.a
              href={DRIVE_FOLDER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              View All <ExternalLink size={15} />
            </motion.a>
          </div>

          {loading ? (
            <div className="works-loading">
              <div className="loader-wrap">
                <div className="loader-ring" />
                <p className="loader-text">Loading gallery…</p>
              </div>
            </div>
          ) : (
            <div className="works-grid">
              {works.map((file, index) => {
                const isVideo = file.mimeType.startsWith('video/');
                const isImage = file.mimeType.startsWith('image/');
                if (!isImage && !isVideo) return null;
                const mediaSrc = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
                // Get a high-quality thumbnail (e.g., 800px width) from Drive for instant rendering
                const thumbUrl = file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s800') : mediaSrc;
                const title    = file.name.split('.')[0];

                return (
                  <motion.div
                    key={file.id}
                    className="work-card"
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-40px' }}
                    custom={index % 5}
                    onClick={() => openByFile(file)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${title}`}
                    onKeyDown={(e) => e.key === 'Enter' && openByFile(file)}
                  >
                    <img
                      src={thumbUrl}
                      alt={title}
                      className="work-card-media"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />

                    {isVideo && (
                      <div className="play-btn" aria-hidden="true">
                        <Play size={20} color="#000" fill="#000" />
                      </div>
                    )}

                    <div className="work-card-overlay" aria-hidden="true">
                      <p className="work-card-type">{isVideo ? 'Video Edit' : 'Photography'}</p>
                      <h3 className="work-card-title">{title}</h3>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <hr className="gradient-line" />

      {/* ── Contact ── */}
      <section id="contact">
        <div className="section">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <p className="section-label">Let's Talk</p>
            <h2 className="section-title">Start a Project</h2>
          </motion.div>

          <motion.div
            className="contact-inner"
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <div className="contact-left">
              <p className="section-label" style={{ marginBottom: 0 }}>Ready to collaborate?</p>
              <p className="contact-big">Let's Create Something Cinematic.</p>
              <p className="contact-sub">
                Whether it's automotive shoots, travel films, or reel edits —
                reach out and let's bring your vision to life.
              </p>
            </div>

            <div className="contact-right">
              <a
                href="mailto:xaviojoy892@gmail.com"
                className="contact-link-block"
                aria-label="Send email to Savio Joy"
              >
                <p className="contact-link-label">Email</p>
                <p className="contact-link-value">xaviojoy892@gmail.com</p>
              </a>
              <a
                href="https://instagram.com/xa.vio"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-link-block"
                aria-label="Visit Savio Joy on Instagram"
              >
                <p className="contact-link-label">Instagram</p>
                <p className="contact-link-value">@xa.vio</p>
              </a>
              <a
                href={DRIVE_FOLDER_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-link-block"
                aria-label="View full portfolio on Google Drive"
              >
                <p className="contact-link-label">Full Portfolio</p>
                <p className="contact-link-value">Google Drive Folder</p>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <a href="#hero" className="footer-logo" aria-label="Back to top">SAVIO JOY</a>
        <p>© {new Date().getFullYear()} Savio Joy — All rights reserved.</p>
        <p style={{ fontSize: '0.7rem', letterSpacing: '2px', color: 'var(--text-dim)' }}>
          THRISSUR · KERALA
        </p>
      </footer>

      {/* ── Gallery Viewer ── */}
      <AnimatePresence>
        {activeMedia && (
          <motion.div
            className="gallery-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setActiveIndex(-1)}
            role="dialog"
            aria-modal="true"
            aria-label={activeMedia.title}
          >
            {/* Top bar */}
            <div className="gallery-topbar" onClick={(e) => e.stopPropagation()}>
              <div className="gallery-topbar-info">
                <h3 className="gallery-topbar-title">{activeMedia.title}</h3>
                <span className="gallery-topbar-kind">{activeMedia.kind}</span>
              </div>
              <div className="gallery-topbar-actions">
                <span className="gallery-counter">{activeIndex + 1} / {mediaList.length}</span>
                <button className="gallery-btn" onClick={() => setActiveIndex(-1)} aria-label="Close">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Prev arrow */}
            {activeIndex > 0 && (
              <button
                className="gallery-arrow gallery-arrow-prev"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                aria-label="Previous"
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {/* Next arrow */}
            {activeIndex < mediaList.length - 1 && (
              <button
                className="gallery-arrow gallery-arrow-next"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                aria-label="Next"
              >
                <ChevronRight size={28} />
              </button>
            )}

            {/* Main content area */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeMedia.src}
                className="gallery-stage"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                {activeMedia.type === 'image' ? (
                  <img
                    src={activeMedia.src}
                    alt={activeMedia.title}
                    className="gallery-media-img"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                ) : (
                  <CinematicPlayer
                    src={activeMedia.src}
                    poster={activeMedia.thumb}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Bottom filmstrip */}
            <div className="gallery-filmstrip" onClick={(e) => e.stopPropagation()}>
              {mediaList.map((f, i) => {
                const thumb = f.thumbnailLink ? f.thumbnailLink.replace(/=s\d+/, '=s120') : null;
                const isV   = f.mimeType.startsWith('video/');
                if (!thumb) return null;
                return (
                  <button
                    key={f.id}
                    className={`filmstrip-item ${i === activeIndex ? 'active' : ''}`}
                    onClick={() => setActiveIndex(i)}
                    aria-label={f.name.split('.')[0]}
                  >
                    <img src={thumb} alt="" referrerPolicy="no-referrer" draggable={false} />
                    {isV && <div className="filmstrip-play"><Play size={10} color="#fff" fill="#fff" /></div>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
