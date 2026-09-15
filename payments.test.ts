import { describe, expect, it } from 'vitest';
import { agreePaymentPasses, applyChequeBranchVerification, applyChequeDateVerification, applyPaymentVerification, cleanPaymentValue, paymentPatchError, type Payment, type PaymentPass } from './payments';

const pass = (values: PaymentPass['values']): PaymentPass => ({
  values,
  detectedMode: null,
  unreadable: '',
});

describe('payment extraction safeguards', () => {
  it('allows payment evidence before consideration but respects explicit zero', () => {
    const payments = [{ id: 'one', mode: 'cheque', amount: '' }] as Payment[];
    expect(paymentPatchError(payments, 'one', { amount: '100' }, '')).toBeNull();
    expect(paymentPatchError(payments, 'one', { amount: '100' }, '   ')).toBeNull();
    expect(paymentPatchError(payments, 'one', { amount: '100' }, '0')).toContain('cannot exceed');
  });
  it('rejects a payment update that exceeds final consideration', () => {
    const payments: Payment[] = [
      { id: 'one', mode: 'upi', advance: false, tds: false, amount: '600', refNo: '', bank: '', branch: '', date: '', payer: '', payee: '' },
      { id: 'two', mode: 'cheque', advance: false, tds: false, amount: '300', refNo: '', bank: '', branch: '', date: '', payer: '', payee: '' },
    ];
    expect(paymentPatchError(payments, 'two', { amount: '401' }, '1000')).toContain('cannot exceed');
    expect(paymentPatchError(payments, 'two', { amount: '400' }, '1000')).toBeNull();
  });
  it('keeps clear values only when independent reads agree', () => {
    const result = agreePaymentPasses(
      pass({ amount: '125000', refNo: '123456', bank: 'Union Bank', date: '2026-01-02' }),
      pass({ amount: '125000', refNo: '123456', bank: ' union   bank ', date: '2026-01-02' }),
    );

    expect(result.values).toEqual({ amount: '125000', refNo: '123456', bank: 'Union Bank', date: '2026-01-02' });
    expect(result.unreadable).toBe('');
  });

  it('omits a bank value when the reads disagree', () => {
    const result = agreePaymentPasses(
      pass({ bank: 'Union Bank', amount: '125000' }),
      pass({ bank: 'HSBC', amount: '125000' }),
    );

    expect(result.values).toEqual({ amount: '125000' });
    expect(result.unreadable).toContain('bank');
  });

  it('omits a value supplied by only one read', () => {
    const result = agreePaymentPasses(pass({ bank: 'Indian Bank' }), pass({}));
    expect(result.values).toEqual({});
    expect(result.unreadable).toContain('bank');
  });

  it('rejects invalid cheque numbers and dates', () => {
    expect(cleanPaymentValue('refNo', '12345', 'cheque')).toBe('');
    expect(cleanPaymentValue('refNo', '123456', 'cheque')).toBe('123456');
    expect(cleanPaymentValue('refNo', '02002408', 'cheque')).toBe('02002408');
    expect(cleanPaymentValue('refNo', '12345678901', 'cheque')).toBe('');
    expect(cleanPaymentValue('date', '31-02-2026', 'cheque')).toBe('');
  });

  it('rejects cheque labels as payer or payee names', () => {
    expect(cleanPaymentValue('payee', 'RUPEES', 'cheque')).toBe('');
    expect(cleanPaymentValue('payee', 'PAY', 'cheque')).toBe('');
    expect(cleanPaymentValue('payer', 'FOR BEARER', 'cheque')).toBe('');
    expect(cleanPaymentValue('payer', 'DUBALA SURAIAH/SHASHIKALA', 'cheque')).toBe('DUBALA SURAIAH/SHASHIKALA');
  });

  it('clears a critical value that fails targeted visual verification', () => {
    const agreed = { values: { bank: 'Union Bank', branch: 'Gurgaon', date: '2021-07-14' }, detectedMode: null, unreadable: '' };
    const result = applyPaymentVerification(agreed, pass({ bank: 'Union Bank', branch: 'Gopal Nagar Siricilla', date: '2026-08-26' }));
    expect(result.values).toEqual({ bank: 'Union Bank' });
    expect(result.unreadable).toContain('branch, date');
  });

  it('adds a handwritten cheque date only when two focused reads agree', () => {
    const base = { values: {}, detectedMode: null, unreadable: '' };
    expect(applyChequeDateVerification(base, pass({ date: '2026-08-26' }), pass({ date: '2026-08-26' })).values.date).toBe('2026-08-26');
    expect(applyChequeDateVerification(base, pass({ date: '2026-08-26' }), pass({ date: '2021-07-14' })).values.date).toBeUndefined();
  });

  it('adds a printed branch only when two focused reads agree', () => {
    const base = { values: {}, detectedMode: null, unreadable: 'Could not verify branch from the instrument; those fields were left blank.' };
    const result = applyChequeBranchVerification(base, pass({ branch: 'Gopal Nagar Siricilla' }), pass({ branch: ' gopal  nagar siricilla ' }));
    expect(result.values.branch).toBe('Gopal Nagar Siricilla');
    expect(result.unreadable).toBe('');
  });
});
