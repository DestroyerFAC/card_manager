import { describe, expect, it } from 'vitest';
import { extractCardName, extractCardNumber, normalizeOcrText, readCard } from './normalize';

describe('normalizeOcrText', () => {
  it('collapses whitespace, drops empty lines and control characters', () => {
    expect(normalizeOcrText('  Pika\tchu  \n\n\u0007  PV 60 ')).toBe('Pika chu\nPV 60');
  });

  it('unifies typographic quotes and dashes', () => {
    expect(normalizeOcrText('Pok’mon – ex')).toBe("Pok'mon - ex");
  });
});

describe('extractCardName', () => {
  it('removes printed labels around the name', () => {
    expect(extractCardName('DE BASE Pikachu PV 60 ©')).toBe('Pikachu');
  });

  it('keeps accents, hyphens and mechanic suffixes', () => {
    expect(extractCardName('Niveau 1 Dracaufeu-ex PV330')).toBe('Dracaufeu-ex');
    expect(extractCardName('Salamèche')).toBe('Salamèche');
    expect(extractCardName('Zacian V PV 220')).toBe('Zacian V');
  });

  it('picks the line with the most letters', () => {
    expect(extractCardName('| ~ 4\nBASE\nRondoudou PV 70\n=')).toBe('Rondoudou');
  });

  it('returns null when nothing name-like was read', () => {
    expect(extractCardName('')).toBeNull();
    expect(extractCardName('12 / ~ ©')).toBeNull();
    expect(extractCardName('PV 60')).toBeNull();
  });
});

describe('extractCardNumber', () => {
  it('reads a standard collector number', () => {
    expect(extractCardNumber('Illus. Naoyo Kimura 025/165 ©2023')).toEqual({
      key: '25',
      total: 165,
    });
  });

  it('tolerates spaces and backslashes around the slash', () => {
    expect(extractCardNumber('136 \\ 189')).toEqual({ key: '136', total: 189 });
    expect(extractCardNumber('4 / 102')).toEqual({ key: '4', total: 102 });
  });

  it('repairs common digit confusions inside the number only', () => {
    expect(extractCardNumber('O25/I65')).toEqual({ key: '25', total: 165 });
    expect(extractCardNumber('1S6/2O1')).toEqual({ key: '156', total: 201 });
  });

  it('keeps special prefixes (trainer gallery, promos)', () => {
    expect(extractCardNumber('TG05/TG30')).toEqual({ key: 'TG5', total: null });
    expect(extractCardNumber('Promo SWSH 020')).toEqual({ key: 'SWSH20', total: null });
  });

  it('returns null without a recognisable number', () => {
    expect(extractCardNumber('©2023 Pokémon / Nintendo')).toBeNull();
    expect(extractCardNumber('')).toBeNull();
  });
});

describe('readCard', () => {
  it('combines both regions', () => {
    expect(readCard('Pikachu PV60', '025/165')).toEqual({
      name: 'Pikachu',
      number: { key: '25', total: 165 },
    });
  });
});
