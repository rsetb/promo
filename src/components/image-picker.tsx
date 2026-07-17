'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { imageUrl } from '@/lib/types';

type ImagePickerProps = {
  /** Foto já salva no produto (nome do arquivo), se houver. */
  currentFile?: string | null;
  /** Arquivo escolhido agora; null = nenhum. */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Endereço colado; o servidor baixa e guarda no volume. */
  url: string;
  onUrlChange: (url: string) => void;
  /** True quando o admin removeu a foto existente. */
  removed: boolean;
  onRemovedChange: (removed: boolean) => void;
  disabled?: boolean;
};

/**
 * Escolha da foto do produto, com prévia.
 *
 * A prévia do arquivo novo usa createObjectURL, que reserva memória até um
 * revoke — daí o cleanup no effect. Sem ele, trocar de foto várias vezes vaza.
 */
export function ImagePicker({
  currentFile,
  file,
  onFileChange,
  url,
  onUrlChange,
  removed,
  onRemovedChange,
  disabled,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const existing = !removed && currentFile ? imageUrl(currentFile) : null;
  const shown = preview ?? existing;

  const clear = () => {
    onFileChange(null);
    onUrlChange('');
    onRemovedChange(true);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const chosen = e.target.files?.[0] ?? null;
          onFileChange(chosen);
          if (chosen) {
            onUrlChange('');
            onRemovedChange(false);
          }
        }}
      />

      {shown ? (
        <div className="relative">
          {/* <img> e não next/image: a prévia é uma blob: URL local, que o
              otimizador do Next não consegue processar. */}
          <img
            src={shown}
            alt="Prévia da foto do produto"
            className="h-16 w-16 rounded-md border object-cover"
          />
          <Button
            type="button"
            onClick={clear}
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
            disabled={disabled}
            aria-label="Remover foto"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <ImagePlus className="h-5 w-5" />
        </div>
      )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {shown ? 'Trocar foto' : 'Escolher foto'}
        </Button>
      </div>

      {/*
        A imagem da URL é baixada e guardada no volume, não apenas apontada:
        um link quebra quando o site de origem sai do ar ou bloqueia hotlink.
        Por isso não há prévia aqui — ela só aparece depois de salvar.
      */}
      <Input
        type="url"
        inputMode="url"
        placeholder="ou cole o endereço de uma imagem"
        value={url}
        onChange={(e) => {
          onUrlChange(e.target.value);
          if (e.target.value) {
            onFileChange(null);
            onRemovedChange(false);
          }
        }}
        disabled={disabled || !!file}
        className="h-8 text-xs"
        aria-label="Endereço da imagem"
      />
    </div>
  );
}
