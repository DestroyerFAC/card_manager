const formatters = new Map<string, Intl.NumberFormat>();

export function formatPrice(amount: number | null | undefined, currency = 'EUR'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}
