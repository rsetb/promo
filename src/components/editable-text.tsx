'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateSiteField } from '@/lib/actions';
import type { EditableSiteField } from '@/lib/types';

type EditableTextProps = {
  field: EditableSiteField;
  value: string;
  className?: string;
  canEdit: boolean;
  centered?: boolean;
};

/**
 * Nome de cada campo em português.
 *
 * O aria-label saía como "Editar heroPhoneDisplay2" — nome de variável, lido
 * em voz alta por leitor de tela.
 */
const FIELD_LABELS: Record<EditableSiteField, string> = {
  siteName: 'nome do site',
  heroTitle1: 'título principal',
  heroTitle2: 'subtítulo',
  heroSlogan: 'slogan',
  heroLocation: 'primeira cidade',
  heroPhoneDisplay: 'telefone da primeira cidade',
  heroLocation2: 'segunda cidade',
  heroPhoneDisplay2: 'telefone da segunda cidade',
};

/**
 * Texto do site editável no lugar. Quando `canEdit` é falso renderiza apenas o
 * texto — mas quem garante a permissão é a Server Action, não este componente.
 */
export function EditableText({ field, value, className, canEdit, centered }: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const save = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('field', field);
      formData.set('value', draft);

      const result = await updateSiteField(formData);
      if (result.ok) {
        setIsEditing(false);
        router.refresh();
        toast({ title: 'Salvo!', description: 'A informação do site foi atualizada.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  if (!canEdit) {
    return <span className={className}>{value}</span>;
  }

  if (isEditing) {
    return (
      <div className={`flex w-full items-center gap-2 ${centered ? 'justify-center' : ''}`}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className={`${className} h-auto border-dashed p-0`}
          disabled={isPending}
          autoFocus
        />
        <Button onClick={save} size="icon" className="h-9 w-9 shrink-0" disabled={isPending}>
          <Save className="h-5 w-5" />
        </Button>
        <Button
          onClick={() => {
            setDraft(value);
            setIsEditing(false);
          }}
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={isPending}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`group relative flex w-full items-center gap-2 ${centered ? 'justify-center' : ''}`}>
      <span className={className}>{value}</span>
      {/*
        Sempre visível, não só no hover: quem vê este botão já é admin, e no
        celular não existe hover — o lápis escondido tornava os textos do
        cabeçalho impossíveis de editar justamente no aparelho mais usado.
      */}
      <Button
        onClick={() => {
          setDraft(value);
          setIsEditing(true);
        }}
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Editar ${FIELD_LABELS[field]}`}
      >
        <Edit className="h-4 w-4" />
      </Button>
    </div>
  );
}
