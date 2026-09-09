import { convertMeasurement, isKnownUnit, unitsFor } from '../units';

describe('unitsFor', () => {
  it('lists the weight units the brief requires (kg/g/lb/oz)', () => {
    expect(unitsFor('weight').map((u) => u.value)).toEqual(['kg', 'g', 'lb', 'oz']);
  });

  it('lists the length units the brief requires (m/cm/mm/ft/in/yd)', () => {
    expect(unitsFor('length').map((u) => u.value)).toEqual(['m', 'cm', 'mm', 'ft', 'in', 'yd']);
  });

  it('lists the time units the brief requires (minute/hour/day)', () => {
    expect(unitsFor('time').map((u) => u.value)).toEqual(['minute', 'hour', 'day']);
  });
});

describe('isKnownUnit', () => {
  it('accepts a real unit and rejects an unknown one', () => {
    expect(isKnownUnit('weight', 'kg')).toBe(true);
    expect(isKnownUnit('weight', 'stone')).toBe(false);
    expect(isKnownUnit('weight', null)).toBe(false);
  });
});

describe('convertMeasurement', () => {
  it('converts grams to kilograms', () => {
    expect(convertMeasurement(2500, 'g', 'kg', 'weight')).toBeCloseTo(2.5);
  });

  it('converts pounds to kilograms', () => {
    expect(convertMeasurement(10, 'lb', 'kg', 'weight')).toBeCloseTo(4.5359237);
  });

  it('converts feet to metres', () => {
    expect(convertMeasurement(10, 'ft', 'm', 'length')).toBeCloseTo(3.048);
  });

  it('converts hours to minutes', () => {
    expect(convertMeasurement(2, 'hour', 'minute', 'time')).toBe(120);
  });

  it('returns the value unchanged when units already match', () => {
    expect(convertMeasurement(25, 'kg', 'kg', 'weight')).toBe(25);
  });

  it('returns the value unchanged when either unit is not set yet (still-being-filled-in form)', () => {
    expect(convertMeasurement(25, null, 'kg', 'weight')).toBe(25);
    expect(convertMeasurement(25, 'kg', null, 'weight')).toBe(25);
  });
});
