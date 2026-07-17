'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maskPriceInput } from '@/lib/format';
import { PRICE_KINDS } from '@/lib/types';

export type PriceFormState = Record<string, string>;

/**
 * Os campos de preço (e quantidade) de um produto.
 *
 * Gerado a partir de PRICE_KINDS, então a lista de tipos vive num lugar só:
 * adicionar um quarto jeito de vender não exige mexer aqui nem lembrar de
 * quantos formulários existem.
 */
export function PriceFields({
  values,
  onChange,
  disabled,
  onEnter,
  compact,
}: {
  values: PriceFormState;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
  /** Layout enxuto para a edição inline na lista. */
  compact?: boolean;
}) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && onEnter) {
      event.preventDefault();
      onEnter();
    }
  };

  return (
    <div className={compact ? 'flex flex-col gap-1' : 'space-y-3'}>
      {PRICE_KINDS.map((kind) => (
        <div key={kind.id} className={compact ? 'flex gap-1' : 'grid grid-cols-2 gap-3'}>
          <div className="grid gap-1">
            {!compact && <Label htmlFor={`price-${kind.id}`}>{kind.formLabel}</Label>}
            <Input
              id={compact ? undefined : `price-${kind.id}`}
              value={values[kind.formField] ?? ''}
              onChange={(e) => onChange(kind.formField, maskPriceInput(e.target.value))}
              onKeyDown={handleKeyDown}
              placeholder={compact ? kind.label : '0,00'}
              className={compact ? 'w-24 text-sm' : undefined}
              disabled={disabled}
              inputMode="numeric"
              aria-label={kind.formLabel}
            />
          </div>

          {kind.qtyFormField && (
            <div className="grid gap-1">
              {!compact && <Label htmlFor={`qty-${kind.id}`}>{kind.qtyLabel}</Label>}
              <Input
                id={compact ? undefined : `qty-${kind.id}`}
                value={values[kind.qtyFormField] ?? ''}
                // Só dígitos: "12,5 unidades" não existe.
                onChange={(e) => onChange(kind.qtyFormField!, e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown}
                placeholder={compact ? 'un' : '12'}
                className={compact ? 'w-16 text-sm' : undefined}
                disabled={disabled}
                inputMode="numeric"
                aria-label={kind.qtyLabel!}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
