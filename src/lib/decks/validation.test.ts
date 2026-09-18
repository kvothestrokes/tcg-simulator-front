/**
 * Unit tests for validation.ts — pure validation helpers.
 * These tests are written FIRST (RED) before implementation exists.
 */

import { describe, expect, it } from 'vitest';

import {
  validateCardDefShape,
  validateCardId,
  validateDeckName,
  validateQty,
} from './validation';

// ─── validateQty ───────────────────────────────────────────────────────────

describe('validateQty', () => {
  it('accepts qty = 1 (minimum valid value)', () => {
    const result = validateQty(1);
    expect(result.ok).toBe(true);
  });

  it('accepts qty > 1', () => {
    const result = validateQty(4);
    expect(result.ok).toBe(true);
  });

  it('rejects qty = 0', () => {
    const result = validateQty(0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects negative qty', () => {
    const result = validateQty(-3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});

// ─── validateCardId ────────────────────────────────────────────────────────

describe('validateCardId', () => {
  const catalog = new Set(['cp_001', 'cp_008', 'cp_012']);

  it('accepts a card_id present in the catalog', () => {
    const result = validateCardId('cp_001', catalog);
    expect(result.ok).toBe(true);
  });

  it('accepts another known card_id from the catalog', () => {
    const result = validateCardId('cp_012', catalog);
    expect(result.ok).toBe(true);
  });

  it('rejects a card_id not in the catalog', () => {
    const result = validateCardId('unknown_card', catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects an empty string', () => {
    const result = validateCardId('', catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});

// ─── validateCardDefShape ──────────────────────────────────────────────────

describe('validateCardDefShape', () => {
  it('accepts a valid CardDef-shaped object', () => {
    const valid = {
      id: 'cp_001',
      nombre: 'Dron Desechable',
      tipo: 'Nave',
      faccion: 'CyberPunk',
      rareza: 'Común',
      coste_recursos: 1,
      coste_heat: 0,
      numero_coleccion: 'CP-001',
      autor: '',
    };
    const result = validateCardDefShape(valid);
    expect(result.ok).toBe(true);
  });

  it('rejects an object missing the required "nombre" field', () => {
    const invalid = {
      id: 'cp_001',
      tipo: 'Nave',
      faccion: 'CyberPunk',
      rareza: 'Común',
      coste_recursos: 1,
      coste_heat: 0,
      numero_coleccion: 'CP-001',
      autor: '',
    };
    const result = validateCardDefShape(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects an object missing the required "id" field', () => {
    const invalid = {
      nombre: 'Dron Desechable',
      tipo: 'Nave',
      faccion: 'CyberPunk',
      rareza: 'Común',
      coste_recursos: 1,
      coste_heat: 0,
      numero_coleccion: 'CP-001',
      autor: '',
    };
    const result = validateCardDefShape(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects a non-object value', () => {
    const result = validateCardDefShape(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});

// ─── validateDeckName ──────────────────────────────────────────────────────

describe('validateDeckName', () => {
  it('accepts a non-empty deck name', () => {
    const result = validateDeckName('My Deck');
    expect(result.ok).toBe(true);
  });

  it('accepts a single-character name', () => {
    const result = validateDeckName('X');
    expect(result.ok).toBe(true);
  });

  it('rejects an empty string', () => {
    const result = validateDeckName('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects a whitespace-only string', () => {
    const result = validateDeckName('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});
