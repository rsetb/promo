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
  /** Escurece a linha: unidade desligada do site, mas o admin ainda edita. */
  dimmed?: boolean;
}) {
  return (
    <>
      {/* min-w-0: sem isto a coluna não encolhe, e numa tela de 375px a soma de
          ícone + texto + lápis (sempre visível desde que deixou de depender de
          hover) passava da largura da tela — só não aparecia em telas ≥412px. */}
      <div className={`flex min-w-0 items-center gap-1.5 justify-self-start text-left ${dimmed ? 'opacity-40' : ''}`}>
        <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <EditableText
          field={locationField}
          value={location}
          canEdit={canEdit}
          className="truncate text-xs font-semibold text-muted-foreground sm:whitespace-nowrap sm:text-lg"
        />
      </div>
      <div className={`flex min-w-0 items-center gap-1.5 justify-self-end text-right ${dimmed ? 'opacity-40' : ''}`}>
        <a
          href={`https://wa.me/${phone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-w-0 items-center gap-2"
        >
          <WhatsappIcon className="h-4 w-4 shrink-0 text-green-500" />
          {!canEdit && (
            <span className="truncate text-xs font-semibold text-muted-foreground group-hover:underline sm:whitespace-nowrap sm:text-lg">
              {phoneDisplay}
            </span>
          )}
        </a>
        {canEdit && (
          <EditableText
            field={phoneField}
            value={phoneDisplay}
            canEdit
            className="truncate text-xs font-semibold text-muted-foreground sm:whitespace-nowrap sm:text-lg"
          />
        )}
      </div>
    </>
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
        <div className="grid grid-cols-[auto,1fr] items-center gap-x-4 gap-y-2">
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
