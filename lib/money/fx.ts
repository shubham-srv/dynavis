/**
 * Currency conversion for a multinational group.
 *
 * Constant currency is the default for anything strategic. Under nominal rates a 6% AED
 * move reads as 6% growth, and someone makes a decision on it (PLAN §12.2). The basis
 * and the rate date travel with every converted number so the UI can state them — a
 * figure without a rate date is not reproducible, and finance will ask.
 */

export type FxBasis = "constant" | "nominal"

export interface FxTable {
  /** Reporting currency. Everything converts *to* this. */
  base: string
  /**
   * The period whose rates constant-currency conversion uses for every period, so that
   * period-over-period movement reflects trading rather than the FX market.
   */
  constantBasisPeriod: string
  /** rates[currency][periodId] — units of `currency` per 1 unit of `base`. */
  rates: Readonly<Record<string, Readonly<Record<string, number>>>>
}

export interface Converted {
  /** `null` in, `null` out: an unmeasured amount is not zero (PLAN §12.3). */
  value: number | null
  currency: string
  rate: number
  basis: FxBasis
  /** The period the rate came from — `meta.currency.fxAsOf` in the envelope. */
  rateAsOf: string
}

function rateFor(currency: string, periodId: string, fx: FxTable): number {
  const series = fx.rates[currency]
  if (!series) {
    throw new RangeError(
      `no FX rates for "${currency}" (reporting currency is ${fx.base})`
    )
  }
  const rate = series[periodId]
  if (rate === undefined) {
    // Deliberately not "fall back to the nearest period". A silently wrong rate
    // produces a plausible number, which is worse than a missing one.
    throw new RangeError(`no ${currency} rate for period "${periodId}"`)
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`invalid ${currency} rate for "${periodId}": ${rate}`)
  }
  return rate
}

/** Convert a local amount into the reporting currency. */
export function toReporting(
  amount: number | null,
  currency: string,
  periodId: string,
  fx: FxTable,
  basis: FxBasis = "constant"
): Converted {
  if (currency === fx.base) {
    return {
      value: amount,
      currency: fx.base,
      rate: 1,
      basis,
      rateAsOf: periodId,
    }
  }
  const rateAsOf = basis === "constant" ? fx.constantBasisPeriod : periodId
  const rate = rateFor(currency, rateAsOf, fx)
  return {
    value: amount === null ? null : amount / rate,
    currency: fx.base,
    rate,
    basis,
    rateAsOf,
  }
}

/**
 * True when the two periods would convert at different rates — i.e. when a
 * period-over-period delta computed on this basis contains FX movement as well as
 * trading. Used to decide whether the UI must caveat a money delta.
 */
export function deltaContainsFx(
  currency: string,
  periodId: string,
  priorPeriodId: string,
  fx: FxTable,
  basis: FxBasis
): boolean {
  if (currency === fx.base || basis === "constant") return false
  return (
    rateFor(currency, periodId, fx) !== rateFor(currency, priorPeriodId, fx)
  )
}
