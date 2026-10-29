export type MissionId = 'checkout' | 'reservation';
export type Decision = 'reject' | 'confirm' | 'charge';
export interface CheckCase { id: string; label: string; input: Record<string, unknown>; expected: Decision; reason: string; }
export interface Mission {
  id: MissionId; ticket: string; title: string; summary: string; customer: string;
  customerMessage: string; file: string; starter: string; contract: string[];
  artifacts: { id: string; title: string; kind: string; content: string }[];
  hints: string[]; checks: CheckCase[];
}
export const missions: Record<MissionId, Mission> = {
  checkout: {
    id: 'checkout', ticket: 'FS-101', title: 'The order that never went through.',
    summary: 'A customer can see their order summary, but cannot finish checkout. Find the cause and preserve the working payment paths.',
    customer: 'Maya · customer support',
    customerMessage: 'A customer says “Place order” keeps showing an error. They tried twice. Other orders are coming through. Can you investigate?',
    file: 'checkout/decideOrder.js',
    starter: `function decide(input) {
  const { totalCents, email, paymentToken } = input;

  if (typeof email !== 'string' || !email.trim()) {
    return 'reject';
  }

  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    return 'reject';
  }

  if (typeof paymentToken !== 'string' || !paymentToken.trim()) {
    return 'reject';
  }

  return 'charge';
}`,
    contract: [
      'Return exactly "reject", "confirm", or "charge". This is a decision function; it never takes a real payment.',
      'An email must be a non-empty string after trimming. Email-format validation happens upstream.',
      'The total is already calculated by the order service. It must be a non-negative safe integer, in cents.',
      'A zero-total order is valid. Confirm it without requiring or charging a payment token.',
      'A positive total requires a non-empty payment token. Otherwise reject the order.',
    ],
    artifacts: [
      { id: 'customer', title: 'Ask for reproduction steps', kind: 'Support reply · authored', content: 'The customer used the FULL100 coupon on a €49 course. The summary says €0.00. They did not enter a card because nothing was due. The message is “Unable to place order”.' },
      { id: 'logs', title: 'Inspect checkout events', kind: 'Application log · fixture', content: '09:41:03 cart_priced totalCents=4900\n09:41:06 coupon_applied code=FULL100 totalCents=0\n09:41:12 checkout_attempt email=present paymentToken=absent\n09:41:12 decision=reject\n09:42:10 control_order totalCents=4900 paymentToken=present decision=charge' },
      { id: 'policy', title: 'Read the product decision', kind: 'Product note · authored', content: 'Fully discounted orders should complete without collecting a payment method. Negative totals are invalid. Existing paid orders must still require a payment token. A zero-total order must never be sent to the payment service.' },
    ],
    hints: [
      'Compare the failing order with the successful control order. Which values changed? Read the checkout events before editing.',
      'An amount of zero is different from an invalid amount. After changing that boundary, check whether another guard still requires a card.',
      'Consider three branches separately: invalid inputs, valid zero-total orders, and positive totals. A free order should confirm before the paid-order token guard.',
    ],
    checks: [
      { id: 'free', label: 'A fully discounted order completes', input: { totalCents: 0, email: 'learner@example.test', paymentToken: '' }, expected: 'confirm', reason: 'No payment method is required when the amount due is zero.' },
      { id: 'free-card', label: 'A free order never charges a saved card', input: { totalCents: 0, email: 'learner@example.test', paymentToken: 'saved_card' }, expected: 'confirm', reason: 'Having a saved card must not change a zero-total order into a payment.' },
      { id: 'paid', label: 'A normal paid order still charges', input: { totalCents: 4900, email: 'learner@example.test', paymentToken: 'test_card' }, expected: 'charge', reason: 'The existing paid-order path must continue to work.' },
      { id: 'no-card', label: 'A paid order cannot bypass payment', input: { totalCents: 4900, email: 'learner@example.test', paymentToken: '  ' }, expected: 'reject', reason: 'Whitespace is not a usable payment token.' },
      { id: 'negative', label: 'A negative total is rejected', input: { totalCents: -100, email: 'learner@example.test', paymentToken: 'test_card' }, expected: 'reject', reason: 'A negative amount is invalid, not a free order.' },
      { id: 'fraction', label: 'Fractional cents are rejected', input: { totalCents: 4.5, email: 'learner@example.test', paymentToken: 'test_card' }, expected: 'reject', reason: 'This contract accepts integer cents only.' },
      { id: 'email', label: 'A free order still needs an email', input: { totalCents: 0, email: '  ', paymentToken: '' }, expected: 'reject', reason: 'The confirmation needs a non-empty customer email.' },
      { id: 'string', label: 'An amount encoded as text is rejected', input: { totalCents: '0', email: 'learner@example.test', paymentToken: '' }, expected: 'reject', reason: 'Do not silently coerce malformed order-service data.' },
      { id: 'unsafe', label: 'An unsafe integer is rejected', input: { totalCents: Number.MAX_SAFE_INTEGER + 1, email: 'learner@example.test', paymentToken: 'test_card' }, expected: 'reject', reason: 'Amounts must be representable as safe integers.' },
    ],
  },
  reservation: {
    id: 'reservation', ticket: 'FS-102', title: 'A free seat is still a reservation.',
    summary: 'Apply the same reasoning to a different workflow. A workshop offers free seats, but eligibility rules still matter.',
    customer: 'Noah · workshop operations',
    customerMessage: 'People with a complimentary place cannot reserve it. Please fix that without letting ineligible attendees or unpaid bookings through.',
    file: 'workshops/decideReservation.js',
    starter: `function decide(input) {
  const { feeCents, eligible, paymentToken } = input;

  if (!Number.isSafeInteger(feeCents) || feeCents <= 0) {
    return 'reject';
  }

  if (eligible !== true) {
    return 'reject';
  }

  if (typeof paymentToken !== 'string' || !paymentToken.trim()) {
    return 'reject';
  }

  return 'charge';
}`,
    contract: [
      'Return exactly "reject", "confirm", or "charge". No real booking or payment is made.',
      'An attendee is eligible only when eligible is exactly true, including for complimentary places.',
      'feeCents must be a non-negative safe integer. Zero means a complimentary place.',
      'Eligible attendees with a zero fee can confirm without a payment token.',
      'Positive fees require a non-empty payment token. Invalid inputs must be rejected.',
    ],
    artifacts: [
      { id: 'customer', title: 'Read the attendee report', kind: 'Support reply · authored', content: 'The attendee is marked eligible=true and feeCents=0. They do not have a saved card. Their reservation was rejected.' },
      { id: 'policy', title: 'Read eligibility requirements', kind: 'Product note · authored', content: 'A complimentary place waives payment, not eligibility. Confirming ineligible attendees would be a regression, even when their fee is zero.' },
    ],
    hints: [],
    checks: [
      { id: 'free', label: 'An eligible complimentary seat confirms', input: { feeCents: 0, eligible: true, paymentToken: '' }, expected: 'confirm', reason: 'A complimentary seat does not need a payment token.' },
      { id: 'free-card', label: 'A complimentary seat never charges', input: { feeCents: 0, eligible: true, paymentToken: 'saved_card' }, expected: 'confirm', reason: 'A saved card does not change the complimentary fee.' },
      { id: 'ineligible', label: 'A free seat still requires eligibility', input: { feeCents: 0, eligible: false, paymentToken: '' }, expected: 'reject', reason: 'Free payment must not bypass a separate eligibility condition.' },
      { id: 'typed', label: 'Eligibility cannot be a truthy string', input: { feeCents: 0, eligible: 'true', paymentToken: '' }, expected: 'reject', reason: 'Eligibility must be exactly the boolean true.' },
      { id: 'paid', label: 'An eligible paid reservation still charges', input: { feeCents: 2500, eligible: true, paymentToken: 'test_card' }, expected: 'charge', reason: 'Preserve the ordinary paid flow.' },
      { id: 'no-card', label: 'A paid reservation needs a valid token', input: { feeCents: 2500, eligible: true, paymentToken: ' ' }, expected: 'reject', reason: 'A paid seat requires a non-empty payment token.' },
      { id: 'negative', label: 'A negative fee is rejected', input: { feeCents: -1, eligible: true, paymentToken: 'test_card' }, expected: 'reject', reason: 'Negative fees are invalid.' },
      { id: 'invalid', label: 'Malformed fees are rejected', input: { feeCents: '0', eligible: true, paymentToken: '' }, expected: 'reject', reason: 'A string is not an integer amount.' },
      { id: 'fraction', label: 'Fractional fees are rejected', input: { feeCents: 0.5, eligible: true, paymentToken: 'test_card' }, expected: 'reject', reason: 'Fees use integer cents.' },
    ],
  },
};
export interface CheckResult { id: string; label: string; expected: Decision; actual: string; passed: boolean; reason: string; }
export interface PracticeRun { source: string; results: CheckResult[]; at: string; }
export const allPassed = (run: PracticeRun | null | undefined, source: string, count: number) => Boolean(run && run.source === source && run.results.length === count && run.results.every(result => result.passed));
