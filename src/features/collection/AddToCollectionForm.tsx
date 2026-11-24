import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';
import { MAX_QUANTITY } from '../../lib/collection/duplicates';
import { CONDITIONS, CONDITION_LABELS, VARIANTS, VARIANT_LABELS } from '../../lib/collection/types';
import type { CardDetail } from '../../providers/cards/types';
import { availableVariants } from './variants';
import { useCollection } from './CollectionContext';

const formSchema = z.object({
  quantity: z.coerce.number().int('Quantité entière').min(1, 'Minimum 1').max(MAX_QUANTITY),
  condition: z.enum(CONDITIONS),
  variant: z.enum(VARIANTS),
});

export function AddToCollectionForm({ card }: { card: CardDetail }) {
  const { add } = useCollection();
  const variants = availableVariants(card);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = formSchema.safeParse({
      quantity: form.get('quantity'),
      condition: form.get('condition'),
      variant: form.get('variant'),
    });
    if (!parsed.success) {
      setMessage({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Formulaire invalide' });
      return;
    }

    setPending(true);
    const result = await add({
      tcg: card.tcg,
      cardId: card.id,
      cardName: card.name,
      setId: card.set.id,
      setName: card.set.name,
      localId: card.localId,
      imageUrl: card.image?.small ?? null,
      ...parsed.data,
    });
    setPending(false);
    if (!result.ok) setMessage({ tone: 'error', text: result.error.message });
    else
      setMessage({
        tone: 'ok',
        text:
          result.value === 'incremented'
            ? 'Déjà dans votre collection : quantité mise à jour.'
            : 'Ajoutée à votre collection.',
      });
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="card-panel flex flex-col gap-3"
      noValidate
    >
      <h2 className="font-semibold">Ajouter à ma collection</h2>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Quantité
          <input
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            defaultValue={1}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          État
          <select name="condition" defaultValue="NM" className="input">
            {CONDITIONS.map((c) => (
              <option key={c} value={c} title={CONDITION_LABELS[c]}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Version
          <select name="variant" defaultValue={variants[0]} className="input">
            {variants.map((v) => (
              <option key={v} value={v}>
                {VARIANT_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-slate-500">
        {CONDITIONS.map((c) => `${c} ${CONDITION_LABELS[c].toLowerCase()}`).join(' · ')}
      </p>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Ajout…' : 'Ajouter'}
      </button>
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm ${message.tone === 'error' ? 'text-red-300' : 'text-emerald-300'}`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
