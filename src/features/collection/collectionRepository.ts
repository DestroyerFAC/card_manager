import { z } from 'zod';
import {
  CONDITIONS,
  VARIANTS,
  type CollectionItem,
  type NewCollectionEntry,
} from '../../lib/collection/types';
import { appError, type AppError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { AppSupabaseClient } from '../../lib/supabase/client';

const PAGE_SIZE = 1000; // PostgREST default max-rows
const COLUMNS =
  'id, tcg, card_id, quantity, condition, variant, card_name, set_id, set_name, local_id, image_url, created_at';

const rowSchema = z.object({
  id: z.string(),
  tcg: z.literal('pokemon'),
  card_id: z.string(),
  quantity: z.number().int().positive(),
  condition: z.enum(CONDITIONS),
  variant: z.enum(VARIANTS),
  card_name: z.string(),
  set_id: z.string(),
  set_name: z.string(),
  local_id: z.string(),
  image_url: z.string().nullable(),
  created_at: z.string(),
});

function toItem(row: z.infer<typeof rowSchema>): CollectionItem {
  return {
    id: row.id,
    tcg: row.tcg,
    cardId: row.card_id,
    quantity: row.quantity,
    condition: row.condition,
    variant: row.variant,
    cardName: row.card_name,
    setId: row.set_id,
    setName: row.set_name,
    localId: row.local_id,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

const dbError = (message: string): AppError => appError('unavailable', message);

/** Persistence boundary: RLS scopes every query to the signed-in user server-side. */
export class CollectionRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<CollectionItem[], AppError>> {
    const items: CollectionItem[] = [];
    try {
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await this.client
          .from('collection_items')
          .select(COLUMNS)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) return err(dbError('Impossible de charger la collection'));
        const parsed = z.array(rowSchema).safeParse(data);
        if (!parsed.success) return err(appError('parse', 'Données de collection invalides'));
        items.push(...parsed.data.map(toItem));
        if (parsed.data.length < PAGE_SIZE) return ok(items);
      }
    } catch {
      return err(appError('network', 'Connexion impossible'));
    }
  }

  async add(entry: NewCollectionEntry): Promise<Result<CollectionItem, AppError>> {
    try {
      const { data, error } = await this.client.rpc('add_collection_item', {
        p_tcg: entry.tcg,
        p_card_id: entry.cardId,
        p_condition: entry.condition,
        p_variant: entry.variant,
        p_quantity: entry.quantity,
        p_card_name: entry.cardName,
        p_set_id: entry.setId,
        p_set_name: entry.setName,
        p_local_id: entry.localId,
        p_image_url: entry.imageUrl,
      });
      if (error) return err(dbError('Ajout impossible'));
      const parsed = rowSchema.safeParse(data);
      return parsed.success ? ok(toItem(parsed.data)) : err(appError('parse', 'Réponse invalide'));
    } catch {
      return err(appError('network', 'Connexion impossible'));
    }
  }

  async setQuantity(id: string, quantity: number): Promise<Result<void, AppError>> {
    try {
      const { error } = await this.client
        .from('collection_items')
        .update({ quantity })
        .eq('id', id);
      return error ? err(dbError('Mise à jour impossible')) : ok(undefined);
    } catch {
      return err(appError('network', 'Connexion impossible'));
    }
  }

  async remove(id: string): Promise<Result<void, AppError>> {
    try {
      const { error } = await this.client.from('collection_items').delete().eq('id', id);
      return error ? err(dbError('Suppression impossible')) : ok(undefined);
    } catch {
      return err(appError('network', 'Connexion impossible'));
    }
  }
}
