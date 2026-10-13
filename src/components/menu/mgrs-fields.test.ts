import { splitMgrs, toMgrs } from '@/lib/geo/coords/mgrs';

import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from './mgrs-fields';

const DC = { lat: 38.8977, lon: -77.0365 };

function dcParts() {
  const m = toMgrs(DC, 5);
  if (!m.ok) throw new Error('setup');
  const p = splitMgrs(m.value);
  if (!p.ok) throw new Error('setup');
  return p.value;
}

describe('evaluateMgrsFields', () => {
  it('is empty with no input', () => {
    expect(evaluateMgrsFields(EMPTY_MGRS)).toEqual({ status: 'empty' });
  });

  it('accepts a full reference regardless of case and spacing', () => {
    const p = dcParts();
    const r = evaluateMgrsFields({ ...p, zoneBand: ` ${p.zoneBand.toLowerCase()} `, square: p.square.toLowerCase() });
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.coord.lat).toBeCloseTo(DC.lat, 3);
    expect(r.coord.lon).toBeCloseTo(DC.lon, 3);
  });

  it('accepts lower precision with matching digit counts', () => {
    const p = dcParts();
    expect(evaluateMgrsFields({ ...p, easting: p.easting.slice(0, 3), northing: p.northing.slice(0, 3) }).status).toBe('valid');
  });

  it.each([
    ['zone only', { zoneBand: '18S', square: '', easting: '', northing: '' }],
    ['zone without band', { zoneBand: '18', square: 'UJ', easting: '2', northing: '0' }],
    ['one-letter square', { zoneBand: '18S', square: 'U', easting: '23', northing: '06' }],
    ['northing still being typed', { zoneBand: '18S', square: 'UJ', easting: '23394', northing: '0739' }],
  ])('is incomplete for %s', (_name, parts) => {
    expect(evaluateMgrsFields(parts).status).toBe('incomplete');
  });

  it.each([
    ['more northing than easting digits', { zoneBand: '18S', square: 'UJ', easting: '233', northing: '07395' }],
    ['letters in the digits', { zoneBand: '18S', square: 'UJ', easting: '23A94', northing: '07395' }],
    ['a zone that does not exist', { zoneBand: '61S', square: 'UJ', easting: '23394', northing: '07395' }],
  ])('is invalid for %s', (_name, parts) => {
    expect(evaluateMgrsFields(parts).status).toBe('invalid');
  });

  it('is invalid when the band letter does not match the square', () => {
    const p = dcParts();
    expect(evaluateMgrsFields({ ...p, zoneBand: p.zoneBand.replace(/.$/, 'C') }).status).toBe('invalid');
  });
});

describe('mgrsFieldsFor', () => {
  it('splits a coordinate into ten-digit fields', () => {
    expect(mgrsFieldsFor(DC)).toEqual(dcParts());
  });

  it('is empty outside MGRS coverage', () => {
    expect(mgrsFieldsFor({ lat: 85, lon: 0 })).toEqual(EMPTY_MGRS);
  });
});
