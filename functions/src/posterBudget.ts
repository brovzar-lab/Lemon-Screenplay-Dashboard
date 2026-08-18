import { getFirestore } from 'firebase-admin/firestore';
import {
  admitBudgetReservation,
  chargeUncertainBudgetReservationInLedger,
  normalizeBudgetLedger,
  settleBudgetReservationInLedger,
  type DailyBudgetLedger,
} from './budgetCounter';
import { POSTER_MODELS, type PosterModelKey } from './posterCore';

const SYSTEM_COLLECTION = 'system';
const DEFAULT_DAILY_LIMIT_MICROUSD = 5_000_000;
const SETTLEMENT_BUFFER_MS = 60 * 60 * 1000;

function dailyLimitMicrousd(): number {
  const configured = Number(process.env.POSTER_DAILY_BUDGET_MICROUSD);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT_MICROUSD;
}

export function posterBudgetDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function posterReservationExpiresAtMs(now: Date): number {
  const nextDay = new Date(`${posterBudgetDate(now)}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.getTime() + SETTLEMENT_BUFFER_MS;
}

export function settlePosterLedger(
  ledger: DailyBudgetLedger,
  requestId: string,
  model: PosterModelKey,
  uncertain: boolean,
  nowMs: number,
): DailyBudgetLedger {
  if (!ledger.active_reservations[requestId]) return ledger;
  const cost = POSTER_MODELS[model].costMicrousd;
  return uncertain
    ? chargeUncertainBudgetReservationInLedger(ledger, requestId, cost, nowMs)
    : settleBudgetReservationInLedger(
        ledger,
        requestId,
        POSTER_MODELS[model].id,
        {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
        cost,
        nowMs,
      );
}

export async function reservePosterBudget(
  requestId: string,
  model: PosterModelKey,
  sourceId: string,
): Promise<string> {
  const now = new Date();
  const date = posterBudgetDate(now);
  const limit = dailyLimitMicrousd();
  const ref = getFirestore().collection(SYSTEM_COLLECTION).doc(`poster-budget-${date}`);
  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const ledger = normalizeBudgetLedger(snapshot.data(), date, limit);
    const next = admitBudgetReservation(
      ledger,
      requestId,
      {
        reserved_microusd: POSTER_MODELS[model].costMicrousd,
        expires_at_ms: posterReservationExpiresAtMs(now),
        model: POSTER_MODELS[model].id,
        job_id: sourceId,
      },
      now.getTime(),
    );
    transaction.set(ref, { ...next, budget_kind: 'poster_images' });
  });
  return date;
}

export async function settlePosterBudget(
  requestId: string,
  model: PosterModelKey,
  uncertain: boolean,
  reservationDate: string,
): Promise<void> {
  const now = new Date();
  const limit = dailyLimitMicrousd();
  const ref = getFirestore().collection(SYSTEM_COLLECTION).doc(`poster-budget-${reservationDate}`);
  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const ledger = normalizeBudgetLedger(snapshot.data(), reservationDate, limit);
    const next = settlePosterLedger(ledger, requestId, model, uncertain, now.getTime());
    transaction.set(ref, { ...next, budget_kind: 'poster_images' });
  });
}
