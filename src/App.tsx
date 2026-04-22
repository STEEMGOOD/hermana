import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { flushSync } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Disc3,
  Heart,
  Mail,
  Music4,
  Pause,
  Play,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import './App.css'
import { siteContent } from './siteContent'

type AudioIssue = 'blocked' | 'missing' | null
type LyricsStatus = 'loading' | 'ready' | 'missing'
type StageSectionId = 'inicio' | 'fotos' | 'carta' | 'musica' | 'cierre'

type StageSection = {
  id: StageSectionId
  label: string
  eyebrow: string
  title: string
  description: string
}

type LyricLine = {
  id: string
  text: string
  time: number
}

type SectionHeaderProps = {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
}

type MemoryCardProps = {
  memory: (typeof siteContent.memories)[number]
  index: number
}

type MusicPanelProps = {
  activeLyrics: LyricLine[]
  activeLyricIndex: number
  activeSongIndex: number
  audioIssue: AudioIssue
  audioMessage: string
  isPlaying: boolean
  lyricsStatus: LyricsStatus
  lyricsViewportRef: RefObject<HTMLDivElement | null>
  onSelectSong: (index: number) => void
  onSongPlay: () => void
  onSongSeeked: () => void
  onSongTimeUpdate: () => void
  onTogglePlayback: () => void
  songAudioRef: RefObject<HTMLAudioElement | null>
}

const smoothEase = [0.22, 1, 0.36, 1] as const
const timestampExpression = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?]/g
const siteBasePath = import.meta.env.BASE_URL

function resolvePublicAssetPath(path: string) {
  if (/^(?:https?:)?\/\//.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path

  return encodeURI(`${siteBasePath}${normalizedPath}`)
}

const revealUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: smoothEase,
    },
  },
}

const stageSections: StageSection[] = [
  {
    id: 'inicio',
    label: 'Bienvenida',
    eyebrow: 'Bienvenida',
    title: 'Quise empezar por aquí, con unas palabras hechas con mucho aprecio.',
    description:
      'Antes de las fotos, la carta y la música, quería abrir este rincón con algo sencillo, cercano y muy sincero.',
  },
  {
    id: 'fotos',
    label: 'Fotos',
    eyebrow: 'Recuerdos',
    title: 'Fotos que guardan pedacitos de todo lo que eres.',
    description:
      'Momentos que no necesitan demasiadas explicaciones porque ya hablan solos.',
  },
  {
    id: 'carta',
    label: 'Carta',
    eyebrow: 'Carta',
    title: 'Hay cosas que se sienten mejor cuando se dejan por escrito.',
    description:
      'Esta parte quería que se sintiera cercana, como una carta abierta en medio de todo lo demás.',
  },
  {
    id: 'musica',
    label: 'Música',
    eyebrow: 'Música',
    title: 'Las canciones también saben decir lo que a veces cuesta poner en palabras.',
    description:
      'Aquí están algunas de las canciones que te acompañan y que también dicen algo de tu forma de sentir.',
  },
  {
    id: 'cierre',
    label: 'Cierre',
    eyebrow: 'Final',
    title: 'Y al final, solo quería dejarte esto.',
    description:
      'Que todo este detalle existe porque eres importante y mereces algo hecho con aprecio.',
  },
]

const heroHighlights = [
  {
    label: 'Para ti',
    value: 'Con cariño',
    text: 'Cada detalle de esta página existe porque quería dejarte algo bonito, sincero y hecho desde la amistad.',
  },
  {
    label: 'Recuerdo',
    value: 'Buena vibra',
    text: 'Entre recuerdos, palabras y canciones, la idea es que aquí se sienta cercanía, confianza y una amistad bonita.',
  },
]

const letterQualities = [
  'Tu disciplina incluso cuando el semestre aprieta.',
  'Tu capacidad para seguir adelante sin dejar de ser sensible.',
  'Tu forma de convertir el esfuerzo en algo bonito y propio.',
]

function toSeconds(minutes: string, seconds: string, fraction?: string) {
  if (!fraction) {
    return Number(minutes) * 60 + Number(seconds)
  }

  const decimal =
    fraction.length === 3 ? Number(fraction) / 1000 : Number(fraction) / 100

  return Number(minutes) * 60 + Number(seconds) + decimal
}

function parseLyricsFile(fileContent: string) {
  return fileContent
    .split(/\r?\n/)
    .flatMap((row, rowIndex) => {
      const matches = [...row.matchAll(timestampExpression)]

      if (matches.length === 0) {
        return []
      }

      const text = row.replace(timestampExpression, '').trim()

      return matches.map((match, matchIndex) => ({
        id: `${rowIndex}-${matchIndex}-${match[0]}`,
        text,
        time: toSeconds(match[1], match[2], match[3]),
      }))
    })
    .sort((first, second) => first.time - second.time)
}

function decodeLyricsContent(buffer: ArrayBuffer) {
  const utf8Text = new TextDecoder('utf-8').decode(buffer)

  if (utf8Text.includes('Ã') || utf8Text.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(buffer)
  }

  return utf8Text
}

function findCurrentLyricIndex(currentTime: number, lines: LyricLine[]) {
  let currentIndex = -1

  for (let index = 0; index < lines.length; index += 1) {
    if (currentTime + 0.05 >= lines[index].time) {
      currentIndex = index
      continue
    }

    break
  }

  return currentIndex
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
}: SectionHeaderProps) {
  return (
    <motion.div
      className="section-heading"
      initial="hidden"
      animate="visible"
      variants={revealUp}
    >
      <span className="section-heading__eyebrow">
        <Icon size={16} />
        {eyebrow}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
    </motion.div>
  )
}

function MemoryCard({ memory, index }: MemoryCardProps) {
  const [imageSrc, setImageSrc] = useState<string>(memory.image)

  return (
    <motion.article
      className="memory-card"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.5,
            delay: index * 0.08,
            ease: smoothEase,
          },
        },
      }}
    >
      <div className="memory-card__image-wrap">
        <img
          src={resolvePublicAssetPath(imageSrc)}
          alt={memory.alt}
          loading="lazy"
          onError={() => {
            if (imageSrc !== memory.fallbackImage) {
              setImageSrc(memory.fallbackImage)
            }
          }}
        />
        <span className="memory-card__tag">{memory.tag}</span>
      </div>
      <div className="memory-card__body">
        <h3>{memory.title}</h3>
        <p>{memory.description}</p>
      </div>
    </motion.article>
  )
}

function WelcomePanel({ audioMessage }: { audioMessage: string }) {
  return (
    <div className="panel-shell">
      <div className="welcome-layout">
        <div className="welcome-copy">
          <SectionHeader
            icon={Sparkles}
            eyebrow={stageSections[0].eyebrow}
            title={siteContent.hero.title}
            description={stageSections[0].description}
          />
          <p className="welcome-lead">{siteContent.hero.subtitle}</p>

          <div className="welcome-badges">
            <span className="welcome-badge">Tu risa</span>
            <span className="welcome-badge">Tus canciones</span>
            <span className="welcome-badge">Tu lugar aquí</span>
          </div>

          <article className="panel-note-card">
            <strong>Lo que quería dejarte aquí</strong>
            <p>
              Un rincón al que puedas volver cuando necesites una pausa, una sonrisa
              o simplemente recordar lo mucho que te aprecio como amiga.
            </p>
          </article>
        </div>

        <div className="spotlight-stack">
          <article className="spotlight-card spotlight-card--quote">
            <p className="mini-label">Mensaje de entrada</p>
            <p className="spotlight-card__quote">"{siteContent.hero.quote}"</p>
          </article>

          <div className="stat-grid">
            {heroHighlights.map((item) => (
              <article key={item.label} className="stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.text}</p>
              </article>
            ))}
          </div>

          <article className="spotlight-card spotlight-card--song">
            <div className="spotlight-card__row">
              <Disc3 size={16} />
              <span>Canción de entrada</span>
            </div>
            <strong>{siteContent.backgroundSong.title}</strong>
            <p>{siteContent.backgroundSong.artist}</p>
            <small>{audioMessage}</small>
          </article>
        </div>
      </div>
    </div>
  )
}

function PhotosPanel() {
  return (
    <div className="panel-shell">
      <SectionHeader
        icon={Camera}
        eyebrow={stageSections[1].eyebrow}
        title={stageSections[1].title}
        description={stageSections[1].description}
      />

      <div className="photos-topline">
        <article className="panel-note-card">
          <strong>Momentos que merecen quedarse</strong>
          <p>
            Hay recuerdos que siguen hablando incluso cuando el tiempo ya pasó.
          </p>
        </article>
      </div>

      <div className="memory-grid">
        {siteContent.memories.map((memory, index) => (
          <MemoryCard key={memory.tag} memory={memory} index={index} />
        ))}
      </div>
    </div>
  )
}

function LetterPanel() {
  return (
    <div className="panel-shell">
      <SectionHeader
        icon={Mail}
        eyebrow={stageSections[2].eyebrow}
        title={stageSections[2].title}
        description={stageSections[2].description}
      />

      <div className="letter-layout">
        <motion.article
          className="letter-card"
          initial="hidden"
          animate="visible"
          variants={revealUp}
        >
          <p className="letter-card__greeting">{siteContent.letter.greeting}</p>
          {siteContent.letter.paragraphs.map((paragraph) => (
            <p key={paragraph} className="letter-card__paragraph">
              {paragraph}
            </p>
          ))}
          <p className="letter-card__signature">{siteContent.letter.signature}</p>
        </motion.article>

        <motion.aside
          className="qualities-card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: smoothEase }}
        >
          <p className="mini-label">Lo que más admiro de ti</p>
          <ul className="qualities-list">
            {letterQualities.map((quality) => (
              <li key={quality}>{quality}</li>
            ))}
          </ul>
        </motion.aside>
      </div>
    </div>
  )
}

function MusicPanel({
  activeLyrics,
  activeLyricIndex,
  activeSongIndex,
  audioIssue,
  audioMessage,
  isPlaying,
  lyricsStatus,
  lyricsViewportRef,
  onSelectSong,
  onSongPlay,
  onSongSeeked,
  onSongTimeUpdate,
  onTogglePlayback,
  songAudioRef,
}: MusicPanelProps) {
  const activeSong = siteContent.favoriteSongs[activeSongIndex]

  return (
    <div className="panel-shell">
      <SectionHeader
        icon={Music4}
        eyebrow={stageSections[3].eyebrow}
        title={stageSections[3].title}
        description={stageSections[3].description}
      />

      <div className="music-layout">
        <article className="lyrics-panel">
          <div className="lyrics-panel__header">
            <div>
              <p className="mini-label">La letra</p>
              <h3>{activeSong.title}</h3>
              <p className="lyrics-panel__artist">{activeSong.artist}</p>
            </div>
            <span className="lyrics-panel__tag">Sonando ahora</span>
          </div>

          <div className="lyrics-panel__body" ref={lyricsViewportRef}>
            {lyricsStatus === 'ready' ? (
              activeLyrics.map((line, index) => (
                <p
                  key={line.id}
                  data-lyric-index={index}
                  className={`lyrics-line${index === activeLyricIndex ? ' is-active' : ''}`}
                >
                  {line.text || '\u00A0'}
                </p>
              ))
            ) : (
              <div className="lyrics-panel__empty">
                <strong>
                  {lyricsStatus === 'loading'
                    ? 'Cargando letra'
                    : 'No se pudo encontrar la letra :('}
                </strong>
                <p>
                  {lyricsStatus === 'loading'
                    ? 'Espera un momento mientras aparece la letra.'
                    : 'Esta canción no tiene la letra disponible en este momento.'}
                </p>
              </div>
            )}
          </div>

          <p className="lyrics-panel__footer">
            Algunas canciones también terminan diciendo cosas que uno quería guardar.
          </p>
        </article>

        <div className="player-stack">
          <article className="player-card">
            <div className="player-card__header">
              <Disc3 size={16} />
              <span>Sonido de fondo</span>
            </div>
            <strong>{siteContent.backgroundSong.title}</strong>
            <p>{siteContent.backgroundSong.artist}</p>
            <small>{audioMessage}</small>
            <button
              className="button button--primary player-card__button"
              type="button"
              onClick={onTogglePlayback}
              disabled={audioIssue === 'missing'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pausar fondo' : 'Activar fondo'}
            </button>
          </article>

          <article className="selector-card">
            <p className="mini-label">Tus canciones</p>
            <div className="song-selector-list">
              {siteContent.favoriteSongs.map((song, index) => (
                <button
                  key={song.title}
                  className={`song-selector${index === activeSongIndex ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => onSelectSong(index)}
                >
                  <span className="song-selector__count">0{index + 1}</span>
                  <span className="song-selector__content">
                    <strong>{song.title}</strong>
                    <small>{song.artist}</small>
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="selected-player">
            <p className="mini-label">Escuchando</p>
            <h3>{activeSong.title}</h3>
            <p>{activeSong.note}</p>
            <audio
              ref={songAudioRef}
              className="song-player"
              controls
              preload="auto"
              playsInline
              src={resolvePublicAssetPath(activeSong.src)}
              onLoadedMetadata={onSongTimeUpdate}
              onPlay={onSongPlay}
              onSeeked={onSongSeeked}
              onTimeUpdate={onSongTimeUpdate}
            />
          </article>
        </div>
      </div>
    </div>
  )
}

function ClosingPanel() {
  return (
    <div className="panel-shell">
      <article className="closing-card">
        <SectionHeader
          icon={Heart}
          eyebrow={stageSections[4].eyebrow}
          title={siteContent.closing.title}
          description={stageSections[4].description}
        />
        {siteContent.closing.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <strong>{siteContent.closing.signature}</strong>
      </article>
    </div>
  )
}

function App() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const songAudioRef = useRef<HTMLAudioElement>(null)
  const lyricsViewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [audioIssue, setAudioIssue] = useState<AudioIssue>('missing')
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [activeSongIndex, setActiveSongIndex] = useState(0)
  const [activeLyrics, setActiveLyrics] = useState<LyricLine[]>([])
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1)
  const [lyricsStatus, setLyricsStatus] = useState<LyricsStatus>('loading')

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const syncPlaybackState = () => {
      setIsPlaying(!audio.paused)
    }

    const handleAudioError = () => {
      setAudioIssue('missing')
      setIsPlaying(false)
    }

    const tryAutoplay = async () => {
      try {
        audio.volume = 0.72
        await audio.play()
        setAudioIssue(null)
        setIsPlaying(true)
      } catch {
        setAudioIssue('blocked')
        setIsPlaying(false)
      }
    }

    audio.loop = true
    audio.preload = 'auto'
    audio.addEventListener('play', syncPlaybackState)
    audio.addEventListener('pause', syncPlaybackState)
    audio.addEventListener('error', handleAudioError)

    void tryAutoplay()

    return () => {
      audio.removeEventListener('play', syncPlaybackState)
      audio.removeEventListener('pause', syncPlaybackState)
      audio.removeEventListener('error', handleAudioError)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    stage.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeSectionIndex])

  useEffect(() => {
    if (stageSections[activeSectionIndex].id !== 'musica') {
      return
    }

    const backgroundAudio = audioRef.current

    if (backgroundAudio && !backgroundAudio.paused) {
      backgroundAudio.pause()
    }
  }, [activeSectionIndex])

  useEffect(() => {
    const activeSong = siteContent.favoriteSongs[activeSongIndex]
    let cancelled = false

    void fetch(resolvePublicAssetPath(activeSong.lyricsFile))
      .then((response) => {
        if (!response.ok) {
          throw new Error('missing-lyrics-file')
        }

        return response.arrayBuffer()
      })
      .then((buffer) => {
        if (cancelled) {
          return
        }

        const content = decodeLyricsContent(buffer)
        const parsedLyrics = parseLyricsFile(content)

        if (parsedLyrics.length === 0) {
          setLyricsStatus('missing')
          return
        }

        setActiveLyrics(parsedLyrics)
        setActiveLyricIndex(
          findCurrentLyricIndex(songAudioRef.current?.currentTime ?? 0, parsedLyrics),
        )
        setLyricsStatus('ready')
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setLyricsStatus('missing')
      })

    return () => {
      cancelled = true
    }
  }, [activeSongIndex])

  useEffect(() => {
    const viewport = lyricsViewportRef.current

    if (!viewport || activeLyricIndex < 0) {
      return
    }

    const activeLine = viewport.querySelector<HTMLElement>(
      `[data-lyric-index="${activeLyricIndex}"]`,
    )

    activeLine?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeLyricIndex, activeSongIndex])

  const handleTogglePlayback = async () => {
    const audio = audioRef.current

    if (!audio || audioIssue === 'missing') {
      return
    }

    if (!audio.paused) {
      audio.pause()
      return
    }

    try {
      await audio.play()
      setAudioIssue(null)
      setIsPlaying(true)
    } catch {
      setAudioIssue('blocked')
      setIsPlaying(false)
    }
  }

  const syncSelectedSongLyrics = () => {
    const songAudio = songAudioRef.current

    if (!songAudio || activeLyrics.length === 0) {
      setActiveLyricIndex(-1)
      return
    }

    const nextIndex = findCurrentLyricIndex(songAudio.currentTime, activeLyrics)

    setActiveLyricIndex((currentIndex) =>
      currentIndex === nextIndex ? currentIndex : nextIndex,
    )
  }

  const handleSelectedSongPlay = () => {
    const backgroundAudio = audioRef.current

    if (backgroundAudio && !backgroundAudio.paused) {
      backgroundAudio.pause()
    }

    syncSelectedSongLyrics()
  }

  const handleSelectSong = (index: number) => {
    const selectedSong = siteContent.favoriteSongs[index]
    const backgroundAudio = audioRef.current
    const songAudio = songAudioRef.current
    const selectedSongSrc = resolvePublicAssetPath(selectedSong.src)

    if (backgroundAudio && !backgroundAudio.paused) {
      backgroundAudio.pause()
    }

    flushSync(() => {
      setLyricsStatus('loading')
      setActiveLyrics([])
      setActiveLyricIndex(-1)
      setActiveSongIndex(index)
    })

    if (!songAudio) {
      return
    }

    songAudio.pause()

    const selectedSongUrl = new URL(selectedSongSrc, window.location.href).href

    if (
      songAudio.currentSrc !== selectedSongUrl &&
      songAudio.src !== selectedSongUrl
    ) {
      songAudio.src = selectedSongSrc
    }

    songAudio.currentTime = 0
    void songAudio.play().catch(() => {})
  }

  const goToSection = (index: number) => {
    if (index < 0 || index >= stageSections.length) {
      return
    }

    startTransition(() => {
      setActiveSectionIndex(index)
    })
  }

  const goToNextSection = () => {
    if (activeSectionIndex === stageSections.length - 1) {
      goToSection(0)
      return
    }

    goToSection(activeSectionIndex + 1)
  }

  const goToPreviousSection = () => {
    goToSection(activeSectionIndex - 1)
  }

  const activeSection = stageSections[activeSectionIndex]

  const playerLabel =
    audioIssue === 'missing'
      ? 'Falta el MP3'
      : isPlaying
        ? 'Pausar'
        : 'Activar canción'

  const audioMessage =
    audioIssue === 'missing'
      ? 'La canción principal está esperando su momento.'
      : audioIssue === 'blocked'
        ? 'Solo falta un toque para que vuelva a sonar.'
        : 'My Blood acompaña este rincón desde el comienzo.'

  const progressLabel = `${activeSectionIndex + 1}`.padStart(2, '0')

  const renderActivePanel = () => {
    switch (activeSection.id) {
      case 'inicio':
        return <WelcomePanel audioMessage={audioMessage} />
      case 'fotos':
        return <PhotosPanel />
      case 'carta':
        return <LetterPanel />
      case 'musica':
        return (
          <MusicPanel
            activeLyrics={activeLyrics}
            activeLyricIndex={activeLyricIndex}
            activeSongIndex={activeSongIndex}
            audioIssue={audioIssue}
            audioMessage={audioMessage}
            isPlaying={isPlaying}
            lyricsStatus={lyricsStatus}
            lyricsViewportRef={lyricsViewportRef}
            onSelectSong={handleSelectSong}
            onSongPlay={handleSelectedSongPlay}
            onSongSeeked={syncSelectedSongLyrics}
            onSongTimeUpdate={syncSelectedSongLyrics}
            onTogglePlayback={handleTogglePlayback}
            songAudioRef={songAudioRef}
          />
        )
      case 'cierre':
        return <ClosingPanel />
      default:
        return null
    }
  }

  return (
    <div className="page-shell">
      <audio
        ref={audioRef}
        src={resolvePublicAssetPath(siteContent.backgroundSong.src)}
      />

      <header className="topbar">
        <button className="brand" type="button" onClick={() => goToSection(0)}>
          <Heart size={18} />
          <span>Para ti</span>
        </button>

        <div className="topbar__steps" aria-label="Secciones del recorrido">
          {stageSections.map((section, index) => (
            <button
              key={section.id}
              className={`section-pill${index === activeSectionIndex ? ' is-active' : ''}`}
              type="button"
              onClick={() => goToSection(index)}
              aria-current={index === activeSectionIndex ? 'step' : undefined}
            >
              {section.label}
            </button>
          ))}
        </div>

        <button
          className="player-chip"
          type="button"
          onClick={handleTogglePlayback}
          disabled={audioIssue === 'missing'}
        >
          {isPlaying ? <Pause size={16} /> : <Volume2 size={16} />}
          <span>{playerLabel}</span>
        </button>
      </header>

      {audioIssue && (
        <motion.aside
          className="audio-alert"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Volume2 size={18} />
          <div className="audio-alert__copy">
            <strong>
              {audioIssue === 'missing'
                ? 'Agrega el MP3 principal'
                : 'Tu navegador bloqueó la música al entrar'}
            </strong>
            <p>{audioMessage}</p>
          </div>

          {audioIssue === 'blocked' && (
            <button
              className="audio-alert__button"
              type="button"
              onClick={handleTogglePlayback}
            >
              <Play size={14} />
              Iniciar
            </button>
          )}
        </motion.aside>
      )}

      <main className="page-content">
        <section className="story-stage" ref={stageRef}>
          <div className="story-frame">
            <div className="stage-meta">
              <div>
                <p className="stage-meta__eyebrow">
                  {progressLabel} / {stageSections.length.toString().padStart(2, '0')}
                </p>
                <h1>{activeSection.label}</h1>
              </div>

              <div className="stage-indicator" aria-hidden="true">
                {stageSections.map((section, index) => (
                  <span
                    key={section.id}
                    className={`stage-indicator__dot${index === activeSectionIndex ? ' is-current' : ''}`}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.section
                key={activeSection.id}
                className="story-panel"
                initial={{ opacity: 0, y: 32, scale: 0.985 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.55, ease: smoothEase },
                }}
                exit={{
                  opacity: 0,
                  y: -20,
                  scale: 0.985,
                  transition: { duration: 0.28, ease: smoothEase },
                }}
              >
                {renderActivePanel()}
              </motion.section>
            </AnimatePresence>

            <footer className="stage-controls">
              <button
                className="stage-button stage-button--ghost"
                type="button"
                onClick={goToPreviousSection}
                disabled={activeSectionIndex === 0}
              >
                <ArrowLeft size={16} />
                Retroceder
              </button>

              <p className="stage-controls__text">
                {activeSection.id === 'inicio'
                  ? 'Todo empieza con unas palabras hechas desde la amistad.'
                  : activeSection.id === 'fotos'
                    ? 'Hay recuerdos que no necesitan más que una imagen para quedarse.'
                    : activeSection.id === 'carta'
                      ? 'Hay cosas que una carta sabe decir mejor que nadie.'
                      : activeSection.id === 'musica'
                        ? 'Tu música también guarda parte de lo que sientes.'
                        : 'Lo importante siempre termina quedándose al final.'}
              </p>

              <button
                className="stage-button stage-button--primary"
                type="button"
                onClick={goToNextSection}
              >
                {activeSectionIndex === stageSections.length - 1
                  ? 'Volver al inicio'
                  : 'Continuar'}
                <ArrowRight size={16} />
              </button>
            </footer>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
