import { useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import CharacterViewport, { type CharacterShape } from '@/components/CharacterViewport';
import {
  Accessibility, Crosshair,
  Info, RotateCcw, UserRound, Smile, Scissors, Shirt, Glasses,
} from 'lucide-react';
import type { BaseRatio } from '@/studio/baseAssets';
import LibraryPanel from '@/components/LibraryPanel';
import HairEditor from '@/components/HairEditor';
import { emptySelections, sampleSelections } from '@/studio/modular/registry';
import './studio.css';

const queryClient = new QueryClient();
const initialShape: CharacterShape = {
  model: 'feminino',
  ratio: '3HT',
  height: 1,
  torso: 1,
  parts: { ...emptySelections },
  colors: {},
};

const navItems = [
  { id: 'personagem', label: 'Personagem', icon: UserRound, ready: true },
  { id: 'corpo', label: 'Corpo', icon: Accessibility, ready: true },
  { id: 'rosto', label: 'Rosto', icon: Smile, ready: true },
  { id: 'cabelo', label: 'Cabelo', icon: Scissors, ready: true },
  { id: 'roupas', label: 'Roupas', icon: Shirt, ready: true },
  { id: 'acessorios', label: 'Acessórios', icon: Glasses, ready: true },
] as const;
type StudioSection = (typeof navItems)[number]['id'];

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

function PropertiesPanel({ section, shape, setShape, reset, onEditHair, onHairSelect }: {
  section: StudioSection; shape: CharacterShape; setShape: (shape: CharacterShape) => void; reset: () => void; onEditHair?: () => void; onHairSelect?: () => void;
}) {
  const update = (key: keyof CharacterShape, value: CharacterShape[keyof CharacterShape]) =>
    setShape({ ...shape, [key]: value } as CharacterShape);
  if (section !== 'personagem' && section !== 'corpo') return <LibraryPanel section={section} shape={shape} setShape={setShape} onEditHair={onEditHair} onHairSelect={onHairSelect} />;
  return (
    <aside className="properties">
      <header className="panel-title">
        <h2>PROPRIEDADES</h2><span>{section === 'corpo' ? 'CORPO' : 'BASE'}</span>
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
        Seis bases originais, com peças ajustadas individualmente. Escolha uma categoria para montar seu personagem.
        <a href={`${import.meta.env.BASE_URL}licenses/dreamloft3d-chibi-license.txt`} target="_blank" rel="noreferrer">Ver licença do pacote</a>
      </div>
      <section className="panel-section" style={{ paddingTop: 0, borderBottom: 0 }}>
        <button className="sample-button" onClick={() => setShape({ ...shape, parts: { ...sampleSelections }, colors: {} })} data-testid="button-sample-outfit">Experimentar conjunto inicial</button>
        <button className="segment" style={{ width: '100%', border: '1px solid #303235', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={reset} data-testid="button-reset-character"><RotateCcw size={13} /> Restaurar base sem peças</button>
        <p className="future-tooltip">Altura de referência: 120 mm. Ajustes de escala afetam corpo e peças juntos.</p>
      </section>
    </aside>
  );
}

function Home() {
  const [section, setSection] = useState<StudioSection>('personagem');
  const [shape, setShape] = useState<CharacterShape>(initialShape);
  const [hairEditorOpen, setHairEditorOpen] = useState(false);
  const reset = () => setShape({ ...initialShape });
  const hasHair = Boolean(shape.parts.hair);
  return (
    <main className="studio">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><span>N</span></div><div><div className="brand-name">NATIVOS</div><div className="brand-sub">CHARACTER STUDIO</div></div></div>
        <div className="top-divider" />
        <div className="project-name"><b>Personagem sem título</b> <span>·</span> Projeto local</div>
        <div className="top-spacer" />
        <div className="saved-state"><i className="live-dot" /> Alterações locais</div>
        <div className="phase-tag">COLEÇÃO 01</div>
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
          <div className="rail-caption">18 PEÇAS</div>
        </nav>
        <CharacterViewport shape={shape} />
        {section === "cabelo" && hasHair && (
          <HairEditor
            open={hairEditorOpen}
            shape={shape}
            onClose={() => setHairEditorOpen(false)}
            onChange={setShape}
          />
        )}
        <PropertiesPanel
          section={section}
          shape={shape}
          setShape={setShape}
          reset={reset}
          onEditHair={() => setHairEditorOpen(true)}
          onHairSelect={() => {
            if (section === "cabelo" && shape.parts.hair) {
              setHairEditorOpen(true);
            }
          }}
        />
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
