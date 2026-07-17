import { MapPin } from 'lucide-react';
import { EditableText } from '@/components/editable-text';
import { EditableLogo } from '@/components/editable-logo';
import { BranchVisibilityToggle } from '@/components/branch-visibility-toggle';
import { WhatsappIcon } from '@/components/whatsapp-icon';
import type { SiteInfoView } from '@/lib/types';

type HeroProps = {
  siteInfo: SiteInfoView;
  canEdit: boolean;
};

/**
 * Uma unidade de atendimento: cidade + WhatsApp. Existem duas (Fortaleza e
 * Cumbuco) e antes elas eram dois blocos de JSX copiados com sufixo "2".
 *
 * Flexbox, não CSS Grid: uma tentativa anterior usava
 * `sm:grid-cols-[auto,1fr]` (arbitrary value com vírgula) e o valor de
 * `sm:` vazava para fora do media query no Chromium desta suíte de testes —
 * `matchMedia('(min-width: 640px)')` confirmava `false` a 375px, mas o grid
 * renderizava como se a regra tivesse aplicado mesmo assim. Não valia a pena
 * investigar a fundo um bug de plataforma; flexbox simples não tem essa classe
 * de problema.
 */
function Branch({
  location,
  locationField,
  phone,
  phoneDisplay,
  phoneField,
  canEdit,
  dimmed,
}: {
  location: string;
  locationField: 'heroLocation' | 'heroLocation2';
  phone: string;
  phoneDisplay: string;
  phoneField: 'heroPhoneDisplay' | 'heroPhoneDisplay2';
  canEdit: boolean;
  /** Escurece o bloco: unidade desligada do site, mas o admin ainda edita. */
  dimmed?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 sm:w-full sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${dimmed ? 'opacity-40' : ''}`}
    >
      {/* Mobile: local em cima, centralizado. Desktop: volta à esquerda. */}
      <div className="flex min-w-0 items-center justify-center gap-1.5 text-center sm:justify-start sm:text-left">
        <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <EditableText
          field={locationField}
          value={location}
          canEdit={canEdit}
          className="truncate text-xs font-semibold text-muted-foreground sm:whitespace-nowrap sm:text-lg"
        />
      </div>
      {/*
        Telefone embaixo no mobile, um pouco maior que o local (pedido do
        usuário) — text-base contra text-xs. No desktop os dois ficam iguais
        (sm:text-lg), como já era antes.
      */}
      <div className="flex min-w-0 items-center justify-center gap-1.5 text-center sm:justify-end sm:text-right">
        <a
          href={`https://wa.me/${phone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-w-0 items-center gap-2"
        >
          <WhatsappIcon className="h-5 w-5 shrink-0 text-green-500 sm:h-4 sm:w-4" />
          {!canEdit && (
            <span className="truncate text-base font-semibold text-muted-foreground group-hover:underline sm:whitespace-nowrap sm:text-lg">
              {phoneDisplay}
            </span>
          )}
        </a>
        {canEdit && (
          <EditableText
            field={phoneField}
            value={phoneDisplay}
            canEdit
            className="truncate text-base font-semibold text-muted-foreground sm:whitespace-nowrap sm:text-lg"
          />
        )}
      </div>
    </div>
  );
}

export function Hero({ siteInfo, canEdit }: HeroProps) {
  return (
    <div className="px-4 pb-12 pt-8 text-center sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-center pt-4">
        <EditableLogo
          logoFile={siteInfo.logoFile}
          siteName={siteInfo.siteName}
          canEdit={canEdit}
          size={160}
          className="h-40 w-40 rounded-full object-contain"
          priority
        />
      </div>

      <div className="flex flex-col items-center">
        <EditableText
          field="heroTitle1"
          value={siteInfo.heroTitle1}
          canEdit={canEdit}
          centered
          className="text-5xl font-black tracking-tighter text-foreground sm:text-6xl md:text-7xl"
        />
        <EditableText
          field="heroTitle2"
          value={siteInfo.heroTitle2}
          canEdit={canEdit}
          centered
          className="text-4xl font-bold tracking-tighter text-foreground sm:text-5xl md:text-6xl"
        />
      </div>

      <div className="mx-auto mt-4 max-w-md px-4">
        {/*
          Unidades sempre empilhadas verticalmente entre si (Fortaleza acima de
          Cumbuco); é DENTRO de cada uma que local/telefone respondem ao
          breakpoint — ver Branch acima.
        */}
        <div className="flex flex-col items-center gap-3 sm:gap-2">
          <Branch
            location={siteInfo.heroLocation}
            locationField="heroLocation"
            phone={siteInfo.heroPhone}
            phoneDisplay={siteInfo.heroPhoneDisplay}
            phoneField="heroPhoneDisplay"
            canEdit={canEdit}
          />
          {/*
            Visitante: some de vez quando desligado. Admin: continua vendo
            (esmaecida) para poder editar o texto e religar sem redigitar.
          */}
          {(canEdit || siteInfo.showBranch2) && (
            <Branch
              location={siteInfo.heroLocation2}
              locationField="heroLocation2"
              phone={siteInfo.heroPhone2}
              phoneDisplay={siteInfo.heroPhoneDisplay2}
              phoneField="heroPhoneDisplay2"
              canEdit={canEdit}
              dimmed={canEdit && !siteInfo.showBranch2}
            />
          )}
          {canEdit && (
            <BranchVisibilityToggle label={siteInfo.heroLocation2} initialVisible={siteInfo.showBranch2} />
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-2xl">
        <div className="p-1 text-lg text-muted-foreground">
          <EditableText
            field="heroSlogan"
            value={siteInfo.heroSlogan}
            canEdit={canEdit}
            centered
            className="text-lg text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}
