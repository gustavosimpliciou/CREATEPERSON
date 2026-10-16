import { useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import CharacterViewport, { type CharacterShape } from '@/components/CharacterViewport';
import {
  Accessibility, CircleUserRound, Component, Crosshair, Eye, Footprints, Glasses,
  Info, Layers3, RotateCcw, Scissors, Shirt, Sparkles, UserRound, WandSparkles,
} from 'lucide-react';
import { initialPieceSelections, pieceCatalog } from '@/studio/catalog';
import type { BaseRatio } from '@/studio/baseAssets';
import './studio.css';

const queryClient = new QueryClient();
const initialShape: CharacterShape = {
  ...initialPieceSelections,
  model: 'feminino',
  ratio: '3HT',
  height: 1,
  torso: 1,
};

const navItems = [
  { id: 'personagem', label: 'Personagem', icon: UserRound, ready: true },
  { id: 'corpo', label: 'Corpo', icon: Accessibility, ready: true },
  { id: 'rosto', label: 'Rosto', icon: CircleUserRound, ready: true },
  { id: 'cabelo', label: 'Cabelo', icon: Scissors, ready: true },
  { id: 'vestuario', label: 'Vestuário', icon: Shirt, ready: true },
  { id: 'acessorios', label: 'Acessórios', icon: Glasses, ready: true },
  { id: 'poses', label: 'Poses', icon: WandSparkles, ready: false },
  { id: 'exportar', label: 'Exportar', icon: Layers3, ready: false },
] as const;
type StudioSection = (typeof navItems)[number]['id'];

const catalogSections = {
  rosto: [{ field: 'eyes', title: 'Conjunto de olhos', options: pieceCatalog.eyes, icon: Eye }],
  cabelo: [{ field: 'hair', title: 'Penteados', options: pieceCatalog.hair, icon: Sparkles }],
  vestuario: [
    { field: 'shirt', title: 'Camisas', options: pieceCatalog.shirts, icon: Shirt },
    { field: 'pants', title: 'Calças', options: pieceCatalog.pants, icon: Accessibility },
    { field: 'shoes', title: 'Calçados', options: pieceCatalog.shoes, icon: Footprints },
  ],
  acessorios: [{ field: 'accessory', title: 'Acessórios', options: pieceCatalog.accessories, icon: Component }],
} as const;

function SliderControl({ label, value, min, max, step, unit, onChange, testId }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void; testId: string;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-row">
      <div className="slider-head">
        <label htmlFor={testId}>{label}</label>
        <output className="slider-value" htmlFor={testId} data-testid={`${testId}-value`}>{Math.round(value * 100)}{unit}</output>
      </div>
      <input id={testId} className="range" type="range" min={min} max={max} step={step} value={value}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        data-testid={testId} aria-label={label} />
      <div className="range-ends"><span>{Math.round(min * 100)}{unit}</span><span>{Math.round(max * 100)}{unit}</span></div>
    </div>
  );
}

function PropertiesPanel({ section, shape, setShape, reset }: {
  section: StudioSection; shape: CharacterShape; setShape: (shape: CharacterShape) => void; reset: () => void;
}) {
  const update = (key: keyof CharacterShape, value: CharacterShape[keyof CharacterShape]) =>
    setShape({ ...shape, [key]: value } as CharacterShape);
  const activeCatalog = section in catalogSections
    ? catalogSections[section as keyof typeof catalogSections]
    : null;
  if (activeCatalog) {
    const step = navItems.findIndex((item) => item.id === section) + 1;
    return (
      <aside className="properties">
        <header className="panel-title">
          <h2>PROPRIEDADES</h2><span>{String(step).padStart(2, '0')} / 08</span>
        </header>
        {activeCatalog.map((group) => (
          <section className="panel-section" key={group.field}>
            <div className="section-top">
              <div className="section-label">{group.title}</div>
              <div className="section-kicker">{group.options.length} OPÇÕES</div>
            </div>
            <div className="piece-grid">
              {group.options.map((option) => {
                const selected = String(shape[group.field]) === option.id;
                const Icon = group.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`piece-card ${selected ? 'active' : ''}`}
                    onClick={() => setShape({ ...shape, [group.field]: option.id } as CharacterShape)}
                    data-testid={`piece-${group.field}-${option.id}`}
                    aria-pressed={selected}
                  >
                    <span className={`piece-art piece-art-${option.icon}`} style={{ '--piece-tone': option.colorVariant } as CSSProperties}>
                      <Icon size={19} strokeWidth={1.55} />
                    </span>
                    <span className="piece-name">{option.name}</span>
                    <span className="piece-style">{option.style}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <div className="note-card">
          <div className="note-heading"><Info size={13} /> Peças do editor</div>
          Olhos, cabelo e roupas são sobreposições geométricas ajustadas às bases em T-pose.
        </div>
        <section className="panel-section reset-section">
          <button className="segment reset-button" onClick={reset} data-testid="button-reset-character">
            <RotateCcw size={13} /> Restaurar personagem
          </button>
        </section>
      </aside>
    );
  }
  return (
    <aside className="properties">
      <header className="panel-title">
        <h2>PROPRIEDADES</h2><span>{section === 'corpo' ? '02 / 08' : '01 / 08'}</span>
      </header>
      {section === 'personagem' ? (
        <>
          <section className="panel-section">
            <div className="section-top"><div className="section-label">Modelo base</div><div className="section-kicker">CHIBI / 01</div></div>
            <div className="segmented" role="group" aria-label="Modelo do personagem">
              {(['feminino', 'masculino'] as const).map((model) => (
                <button key={model} className={`segment ${shape.model === model ? 'active' : ''}`} onClick={() => update('model', model)}
                  data-testid={`model-${model}`} aria-pressed={shape.model === model}>
                  {model === 'feminino' ? 'Feminino' : 'Masculino'}
                </button>
              ))}
            </div>
            <p className="future-tooltip" style={{ margin: '11px 0 0' }}>Malhas importadas do pacote Chibi Base Meshes. As proporções variam entre 2, 3 e 4 cabeças.</p>
          </section>
          <section className="panel-section">
            <div className="section-top"><div className="section-label">Proporção da base</div><div className="section-kicker">2 / 3 / 4 HT</div></div>
            <div className="shape-options">
              {[
                { ratio: '2HT' as const, name: '2 cabeças' },
                { ratio: '3HT' as const, name: '3 cabeças' },
                { ratio: '4HT' as const, name: '4 cabeças' },
              ].map((preset) => (
                <button key={preset.ratio} className={`shape-option ${shape.ratio === preset.ratio ? 'active' : ''}`}
                  onClick={() => update('ratio', preset.ratio)} data-testid={`shape-${preset.ratio.toLowerCase()}`} aria-pressed={shape.ratio === preset.ratio}>
                  <i className="shape-icon" /><span>{preset.name}</span>
                </button>
              ))}
            </div>
            <p className="future-tooltip" style={{ margin: '11px 0 0' }}>Cada opção troca a malha completa do pacote.</p>
          </section>
          <section className="panel-section">
            <div className="section-top"><div className="section-label">Ajustes rápidos</div><div className="section-kicker">AO VIVO</div></div>
            <SliderControl label="Altura" value={shape.height} min={0.86} max={1.14} step={0.01} unit="%" onChange={(value) => update('height', value)} testId="slider-height" />
            <SliderControl label="Largura total" value={shape.torso} min={0.76} max={1.24} step={0.01} unit="%" onChange={(value) => update('torso', value)} testId="slider-torso" />
          </section>
        </>
      ) : (
        <>
          <section className="panel-section">
            <div className="section-top"><div className="section-label">Proporções da base</div><div className="section-kicker">2 / 3 / 4 HT</div></div>
            <div className="shape-options">
              {(['2HT', '3HT', '4HT'] as const).map((ratio: BaseRatio) => (
                <button key={ratio} className={`shape-option ${shape.ratio === ratio ? 'active' : ''}`}
                  onClick={() => update('ratio', ratio)} data-testid={`shape-${ratio.toLowerCase()}`} aria-pressed={shape.ratio === ratio}>
                  <i className="shape-icon" /><span>{ratio}</span>
                </button>
              ))}
            </div>
            <SliderControl label="Altura" value={shape.height} min={0.86} max={1.14} step={0.01} unit="%" onChange={(value) => update('height', value)} testId="slider-height" />
            <SliderControl label="Largura total" value={shape.torso} min={0.76} max={1.24} step={0.01} unit="%" onChange={(value) => update('torso', value)} testId="slider-torso" />
          </section>
          <section className="panel-section">
            <div className="section-top"><div className="section-label">Modelo base</div><div className="section-kicker">CORPO</div></div>
            <div className="segmented" role="group" aria-label="Modelo do personagem">
              {(['feminino', 'masculino'] as const).map((model) => (
                <button key={model} className={`segment ${shape.model === model ? 'active' : ''}`} onClick={() => update('model', model)} data-testid={`model-${model}`} aria-pressed={shape.model === model}>
                  {model === 'feminino' ? 'Feminino' : 'Masculino'}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
      <div className="note-card">
        <div className="note-heading"><Info size={13} /> Base Dreamloft3D</div>
        Malhas importadas sem rig ou textura facial. A cabeça só pode ser redimensionada escolhendo outra proporção.
        <a href={`${import.meta.env.BASE_URL}licenses/dreamloft3d-chibi-license.txt`} target="_blank" rel="noreferrer">Ver licença do pacote</a>
      </div>
      <section className="panel-section" style={{ paddingTop: 0, borderBottom: 0 }}>
        <button className="segment" style={{ width: '100%', border: '1px solid #303235', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={reset} data-testid="button-reset-character"><RotateCcw size={13} /> Restaurar personagem</button>
      </section>
    </aside>
  );
}

function Home() {
  const [section, setSection] = useState<StudioSection>('personagem');
  const [shape, setShape] = useState<CharacterShape>(initialShape);
  const reset = () => setShape({ ...initialShape });
  return (
    <main className="studio">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><span>N</span></div><div><div className="brand-name">NATIVOS</div><div className="brand-sub">CHARACTER STUDIO</div></div></div>
        <div className="top-divider" />
        <div className="project-name"><b>Personagem sem título</b> <span>·</span> Projeto local</div>
        <div className="top-spacer" />
        <div className="saved-state"><i className="live-dot" /> Alterações locais</div>
        <div className="phase-tag">FASE 02</div>
      </header>
      <div className="workspace">
        <nav className="rail" aria-label="Ferramentas do estúdio">
          {navItems.map(({ id, label, icon: Icon, ready }) => (
            <button key={id} className={`rail-item ${(section === id) ? 'active' : ''}`} disabled={!ready}
              title={ready ? label : `${label} — disponível em uma fase futura`}
              onClick={() => ready && setSection(id)} data-testid={`nav-${id}`}>
              <Icon strokeWidth={1.7} /><span>{label}</span>
            </button>
          ))}
          <div className="rail-spacer" />
          <div className="rail-caption">FASE<br />02</div>
        </nav>
        <CharacterViewport shape={shape} />
        <PropertiesPanel section={section} shape={shape} setShape={setShape} reset={reset} />
      </div>
      <footer className="bottom-bar">
        <div className="bottom-left"><i className="bottom-dot" /><span className="bottom-status">Cena pronta</span><span>·</span><span>Editor local</span></div>
        <div className="bottom-right"><Crosshair size={11} /><span>CÂMERA ORBITAL</span><span>·</span><span>ARRASTE PARA NAVEGAR</span></div>
      </footer>
    </main>
  );
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
